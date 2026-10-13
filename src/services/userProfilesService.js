// services/userProfileService.js
const {
  createUserProfile,
  listUserProfiles,
  updateUserProfileWithImage,
  uploadFileToS3,
  getUserProfile,deleteFileFromS3,clearUserProfileImage
} = require("../dao/userProfilesDAO");
const ridesDAO = require("../dao/ridesDAO");
const userDAO = require("../dao/userDAO");
const dashboardDAO = require("../dao/dashboardDAO");
const paymentsDAO = require("../dao/paymentsDAO");
const  userStatusDAO  = require("../dao/usersStatusDAO");
const { addServerLog } = require("./serverLogsService");
const chauffeurRidesDAO = require("../dao/chauffeurRidesDAO");
const tipDOA = require("../dao/chauffeurTipWalletDAO");
require("dotenv").config();
const redisClient = require("../config/redis");

/**
 * Service to create a user profile.
 * @param {string} userId - Unique identifier for the user.
 * @param {Array} documents - Array of document objects, e.g., [{ image: 'path' }, { license: 'path' }]
 * @returns {object} The created user profile.
 */
const createProfile = async (userId, documents) => {
  // Ensure documents are an array
  if (!Array.isArray(documents)) {
    throw new Error("Documents should be an array of objects");
  }

  try {
    // Fetch user details
    const user = await userDAO.findByUserId(userId);

    if (!user) {
      throw new Error("User not found.");
    }

    await createUserProfile(userId, documents);
    // Return the profile data including user details
    return {
      user_id: user.userId,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      documents,
    };
  } catch (error) {
    console.log("userId:", userId);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createProfile",
      error_message: `createProfile service error - ${error.message}.`,
    });
    throw new Error("Failed to create user profile");
  }
};

const UserProfileService = {
  listUserProfiles: async () => {
    try {
      // Call the DAO method to list profiles
      const profiles = await listUserProfiles();
      return profiles;
    } catch (error) {
      console.error(
        "Error in UserProfileService (listUserProfiles):",
        error.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "listUserProfiles",
        error_message: `listUserProfiles service error - ${error.message}.`,
      });
      throw error;
    }
  },
};

const dashboardData = async (userId, role, organizationId) => {
  try {
    let params;

    if (role === "chauffeur") {
      const allowedStatuses = [
        "Review-Pending",
        "Completed",
        "Payment-Pending",
        "Cancelled",
      ];
      const promises = allowedStatuses.map((status) => {
        const params = {
          TableName: "Rides",
          IndexName: "chauffeur_id-index", // Query using GSI
          KeyConditionExpression: "#chauffeur_id = :chauffeur_id",
          FilterExpression: "#status = :status",
          ExpressionAttributeNames: {
            "#chauffeur_id": "chauffeur_id",
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":chauffeur_id": userId,
            ":status": status,
          },
        };
        return ridesDAO.getDashboardData(params);
      });

      const results = await Promise.all(promises);
      const allRides = results.flatMap((result) => result || []); // Ensure non-null values
      const data = await calculateRideStats(allRides);
      // const paymentData = await dashboardDAO.fetchRevenueByChauffeur(userId);
      const revenueData = await getRevenueBreakdownByPaymentMethod(allRides);
      // const paymentData = Object.values(revenueData.breakdown).reduce((sum, value) => sum + value, 0);
      const chauffeurWallet = await paymentsDAO.findChauffeurWalletById(userId);
      const tipWalletBalance = await tipDOA.getChauffeurTipWalletByChauffeurId(userId);
      // data.todays_commission = await getDailyCommission(userId);
      data.wallet_balance = Number(chauffeurWallet?.wallet_balance ?? 0);
      data.totalAmount = Number(revenueData.totalAmount).toFixed(2);
      data.totalDiscount = Number(revenueData.totalDiscount).toFixed(2);
      data.todaysEarnings = Number(revenueData.todayEarnings).toFixed(2);
      data.tipWalletBalance = Number(tipWalletBalance?.balance ?? 0);

      return data;
    } else if (role === "pd") {
      params = {
        TableName: "ChauffeurRides",
        IndexName: "pd_id-index", // Use the secondary index
        KeyConditionExpression: "#pd_id = :pd_id",
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
          "#pd_id": "pd_id",
        },
        ExpressionAttributeValues: {
          ":pd_id": userId,
          ":status": "Completed",
        },
      };
    } else if (role === "admin") {
      // Fetch all rides data
      let chauffeurData = {};
      let allChauffeurData = {};
      [allChauffeurData, chauffeurData] = await Promise.all([
        getChaufferData(organizationId),
        getRidesByStatus(organizationId),
      ]);

       // ✅ Get Date Ranges
        // Dubai timezone offset (UTC+4)
        const tzOffset = "+04:00";
       // 1. Get today's date in Dubai timezone
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }); // "YYYY-MM-DD"

        // 2. Construct full date-times in Dubai time (manually)
        const startDubaiStr = `${today}T00:00:00`;
        const endDubaiStr = `${today}T23:59:59.999`;

        // 3. Convert them to UTC ISO strings
        const todayStartUTC = new Date(`${startDubaiStr}+04:00`).toISOString(); // Dubai is UTC+4
        const todayEndUTC = new Date(`${endDubaiStr}+04:00`).toISOString();
        // Start of month in Dubai
        const startOfMonth = `${today.slice(0, 8)}01`; // replace DD with "01"
        const monthStartUTC = new Date(`${startOfMonth}T00:00:00.000${tzOffset}`).toISOString();

        // Start of year in Dubai
        const yearStart = `${today.slice(0, 4)}-01-01`;
        const yearStartUTC = new Date(`${yearStart}T00:00:00.000${tzOffset}`).toISOString();

        // console.log("Start of day in UTC:", todayStartUTC);
        // console.log("End of day in UTC:", todayEndUTC);
        // console.log("Start of month in UTC:", monthStartUTC);
        // console.log("Start of year in UTC:", yearStartUTC);


      // ✅ Initialize a container to store rides per chauffeur
      let chauffeurRidesCount = {};
      if (allChauffeurData.length > 0) {
        // ✅ Process rides only within the last 30 days
        allChauffeurData.forEach((ride) => {
          const date = ride.order_date
            ? ride.order_date.split("T")[0]
            : "Unknown";
          const chauffeurId = ride.chauffeur_id || "Unknown";
          const chauffeurName = ride.chauffeur_name || "Unknown"; // Include name
          const rideStatus = ride.status || "Unknown"; // Get ride status

          const rideDate = new Date(date);
          if (rideDate < monthStartUTC || rideDate > today)
            return; // Skip if outside last 30 days

          const allowedStatuses = [
            "Completed",
            "Payment-Pending",
            "Review-Pending",
          ];
          if (!allowedStatuses.includes(rideStatus)) return; // Skip if not in the allowed statuses

          if (!chauffeurRidesCount[chauffeurId]) {
            chauffeurRidesCount[chauffeurId] = {
              name: chauffeurName,
              totalRides: 0,
            };
          }
          chauffeurRidesCount[chauffeurId].totalRides += 1; // Increment count
        });
      }

      chauffeurData.data = chauffeurData.data || {};
      const ridesCount = await fetchRidesCount(organizationId);
      const statusCount = await getRideStatusCountForLastMonth(
        allChauffeurData
      );
      const chauffeurRidesByDate = await getDateWisePastWeekRideStatusCount(
        allChauffeurData
      );
      // ✅ Fetch Revenue Data
      const totalRevenue = await dashboardDAO.fetchRevenue(
        chauffeurData.rideIds,
        organizationId
      );
      const yearlyRevenue = await dashboardDAO.fetchRevenue(
        chauffeurData.rideIds,
        organizationId,
        yearStartUTC,
        todayEndUTC
      );
      const monthlyRevenue = await dashboardDAO.fetchRevenue(
        chauffeurData.rideIds,
        organizationId,
        monthStartUTC,
        todayEndUTC
      );
      const todayRevenue = await dashboardDAO.fetchRevenue(
        chauffeurData.rideIds,
        organizationId,
        todayStartUTC,
        todayEndUTC
      );

      return {
        chauffeurData:
          { todayRevenue, monthlyRevenue, yearlyRevenue, totalRevenue } || [],
        // chauffeurRidesByDate, // ✅ No need to stringify, send raw object
        chauffeurRidesCount, // ✅ Sending both raw and transformed data
        ridesCount,
        statusCount,
        chauffeurRidesByDate,
      };
    } else {
      throw new Error("Invalid role provided");
    }

    const dashboard = await ridesDAO.getDashboardData(params);
    const data = await calculateRideStats(dashboard);
    const pdWallet = await paymentsDAO.findPDWalletById(userId);
    data.wallet_balance = Number(pdWallet?.wallet_balance ?? 0);
    data.todays_commission = await getDailyCommission(userId);
    data.totalAmount = "0";
    return data;
  } catch (error) {
    console.error("Error in getting dashboard data:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "dashboardData",
      error_message: `dashboardData service error - ${error.message}.`,
    });
    throw new Error(`Error in getting dashboard data ${error.message}`);
  }
};

async function calculateRideStats(rides) {
  let totalRides = 0;
  let totalAmount = 0;
  let upcomingRides = 0;
  let todayRides = 0;
  let totalDistance = 0;
  const currentDate = getDubaiDateString(new Date()); // Current timestamp
  const dubaiDate = getDubaiDateString(new Date());
  const tzOffset = "+04:00";
  const todayStart = new Date(`${dubaiDate}T00:00:00.000${tzOffset}`).toISOString(); // Start of today (midnight)
  const todayEnd = new Date(`${dubaiDate}T23:59:59.999${tzOffset}`).toISOString(); // End of today (just before midnight)
  // console.log('Dubai Date');
  // console.log(todayStart, todayEnd);

  const todayStartDate = new Date(todayStart);
  const todayEndDate = new Date(todayEnd);

  for (const ride of rides) {
    totalRides += 1;

    if (ride.requested_pickup && ride.requested_drop) {
      const lat1 = parseFloat(ride.requested_pickup.lat);
      const lon1 = parseFloat(ride.requested_pickup.long);
      const lat2 = parseFloat(ride.requested_drop.lat);
      const lon2 = parseFloat(ride.requested_drop.long);

      totalDistance += (await haversineDistance(lat1, lon1, lat2, lon2)) || 0;
    }

    if (ride.ride_type === "scheduled" && ride.scheduled_pickup > currentDate) {
      upcomingRides += 1;
    }

   // console.log(ride.planned_end_time);

    // Compare today's date
    if (ride.planned_end_time) {
        const rideDate = new Date(ride.planned_end_time);

        if (
          rideDate.getTime() >= todayStartDate.getTime() &&
          rideDate.getTime() <= todayEndDate.getTime()
        ) {
          todayRides += 1;
        }
      }
    }
  return {
    totalRides,
    totalAmount,
    upcomingRides,
    todayRides,
  };
}

async function getRidesByStatus(organizationId) {
  try {
    const allowedStatuses = [
      "Requested",
      "Accepted",
      "Started",
      "Reached Customer",
      "Payment Initiated",
      "Review-Pending",
      "Completed",
      "Payment-Pending",
      "Cancelled",
    ];

    let allRides = [];

    for (const status of allowedStatuses) {
      if (!status) {
        console.warn("⚠️ Skipping empty status value.");
        continue;
      }

      const params = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
        },
      };

      if (organizationId !== "*") {
        params.FilterExpression = "#organisation_id = :organizationId";
        params.ExpressionAttributeNames["#organisation_id"] = "organisation_id";
        params.ExpressionAttributeValues[":organizationId"] =
          String(organizationId);
      }

      try {
        const result = await ridesDAO.getDashboardData(params);
        if (result) {
          allRides = allRides.concat(result);
        } else {
          console.warn(`⚠️ No rides found for status: ${status}`);
        }
      } catch (error) {
        console.error(
          `Error while querying rides for status ${status}:`,
          error.message
        );
        await addServerLog({
          log_level: "ERROR",
          service_name: "getRidesByStatus",
          error_message: `getRidesByStatus service error - ${error.message}.`,
        });
        throw new Error(`Error in admin dashboard: ${error.message}`);
      }
    }

    if (allRides.length === 0) {
      console.warn("⚠️ No rides found with allowed statuses.");
      return { totalRides: 0, statusCount: {} };
    }
    const rideIds = allRides.map((ride) => ride.ride_id);
    const data = await calculateRideStats(allRides);
    return { data, rideIds };
  } catch (error) {
    console.error("Error in getting ride by status:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRidesByStatus",
      error_message: `getRidesByStatus service error - ${error.message}.`,
    });
    throw new Error(`Error in getting ride by status: ${error.message}`);
  }
}

async function getChaufferData(organizationId) {
  try {
    const allowedStatuses = [
      "Requested",
      "Accepted",
      "Started",
      "Reached Customer",
      "Payment Initiated",
      "Completed",
      "Review-Pending",
      "Cancelled",
      "Payment-Pending",
    ];

    let allRides = [];

    for (const status of allowedStatuses) {
      if (!status) {
        console.warn("⚠️ Skipping empty status value.");
        continue;
      }

      // Fresh params every time
      const params = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
        },
      };

      // Add organization filter if not wildcard
      if (organizationId && organizationId !== "*") {
        params.FilterExpression = "#organisation_id = :organizationId";
        params.ExpressionAttributeNames["#organisation_id"] = "organisation_id";
        params.ExpressionAttributeValues[":organizationId"] =
          String(organizationId); // ensure string
      }

      try {
        const result = await ridesDAO.getDashboardData(params);
        if (result) {
          allRides = allRides.concat(result);
        } else {
          console.warn(`⚠️ No rides found for status: ${status}`);
        }
      } catch (error) {
        console.error(
          `❌ Error while querying rides for status ${status}:`,
          error.message
        );
        await addServerLog({
          log_level: "ERROR",
          service_name: "getChaufferData",
          error_message: `getChaufferData service error - ${error.message}.`,
        });
        throw new Error(`Error in admin dashboard: ${error.message}`);
      }
    }

    if (allRides.length === 0) {
      console.warn("⚠️ No rides found with allowed statuses.");
      return { totalRides: 0, statusCount: {} };
    }

    return allRides;
  } catch (error) {
    console.error("Error in getting ride by status:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getChaufferData",
      error_message: `getChaufferData service error - ${error.message}.`,
    });
    throw new Error(`Error in getting ride by status: ${error.message}`);
  }
}

async function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (degree) => degree * (Math.PI / 180);
  const R = 6371; // Radius of the Earth in km

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function getLatestRides(ridesData, limit = 10) {
  // Sort the rides by `order_date` in descending order
  const sortedRides = ridesData.sort(
    (a, b) => new Date(b.order_date) - new Date(a.order_date)
  );
  // Get the latest 10 rides
  const latestRides = sortedRides.slice(0, limit);
  return latestRides;
}

const saveProfileImage = async ({
  userId,
  fileBuffer,
  fileName,
  fileMimeType,
}) => {
  try {
    // 1. Validate the user exists
    const user = await userDAO.findByUserId(userId);

    if (!user) {
      throw new Error("User not found.");
    }

    // 2. Upload to S3
    const s3Key = await uploadFileToS3(fileBuffer, fileName, fileMimeType);

    // 3. Update DynamoDB user profile with the new image URL (or key)
    const updatedProfile = await updateUserProfileWithImage(userId, s3Key);

    // 4. Generate full S3 URL
    const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return {
      imageUrl,
      createdAt: updatedProfile.Attributes.created_at,
    };
  } catch (error) {
    console.error("Service error (saveProfileImage):", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveProfileImage",
      error_message: `saveProfileImage service error - ${error.message}.`,
    });
    throw new Error("Failed to upload and save profile image.");
  }
};

async function fetchRidesCount(organizationId) {
  try {
    // Fetch all rides data
    const allChauffeurData = await getChaufferData(organizationId);

    // ✅ Get Date Ranges
    const tzOffset = "+04:00";

    // Get today's date string in Dubai timezone
    const dubaiToday = getDubaiDateString(new Date());

    // Valid ISO format strings with manual time setting and Dubai offset
    const todayStartUTC = new Date(`${dubaiToday}T00:00:00.000${tzOffset}`).toISOString();
    const todayEndUTC = new Date(`${dubaiToday}T23:59:59.999${tzOffset}`).toISOString();

    const startOfMonth = `${dubaiToday.slice(0, 8)}01`;
    const monthStartUTC = new Date(`${startOfMonth}T00:00:00.000${tzOffset}`).toISOString();

    const yearStart = `${dubaiToday.slice(0, 4)}-01-01`;
    const yearStartUTC = new Date(`${yearStart}T00:00:00.000${tzOffset}`).toISOString();

    console.log({ todayStartUTC, todayEndUTC, monthStartUTC, yearStartUTC });
    
    // ✅ Initialize Counters
    let totalRides = 0;
    let todayRides = 0;
    let monthlyRides = 0;
    let yearlyRides = 0;
    if (allChauffeurData.length > 0) {
      // ✅ Process all rides
      allChauffeurData.forEach((ride) => {
        const rideDate = ride.planned_end_time ? getDubaiDateString(ride.planned_end_time) : "Unknown";

        if (rideDate !== "Unknown") {
          totalRides += 1; // Increment total rides count

          if (rideDate >= todayStartUTC) todayRides += 1;
          if (rideDate >= monthStartUTC) monthlyRides += 1;
          if (rideDate >= yearStartUTC) yearlyRides += 1;
        }
      });
    }

    return {
      totalRides,
      todayRides,
      monthlyRides,
      yearlyRides,
    };
  } catch (error) {
    console.error("Error fetching rides count:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesCount",
      error_message: `fetchRidesCount service error - ${error.message}.`,
    });
    throw error;
  }
}

function getDubaiDateString(date) {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dubai",
  }); // YYYY-MM-DD
}

const getRideStatusCountForLastMonth = async (allRides) => {
  try {
    // ✅ Get today's date and calculate the date 30 days ago
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    let rideStatusCount = {};
    if (allRides.length > 0) {
      // ✅ Filter rides for the last 30 days
      const recentRides = allRides.filter((ride) => {
        const rideDate = new Date(ride.order_date); // Convert ride date to Date object
        return rideDate >= thirtyDaysAgo && rideDate <= today;
      });

      // ✅ Group rides by status
      rideStatusCount = recentRides.reduce((acc, ride) => {
        const status = ride.status || "Unknown"; // Default to "Unknown" if status is missing
        const rideType = ride.ride_type || "Unknown"; // Default to "Unknown" if ride_type is missing

        if (!acc[rideType]) acc[rideType] = {}; // Initialize status key if not present
        if (!acc[rideType][status]) acc[rideType][status] = 0; // Initialize type count

        acc[rideType][status] += 1; // Increment count

        return acc;
      }, {});
    }

    return rideStatusCount;
  } catch (error) {
    console.error("Error calculating ride status count:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideStatusCountForLastMonth",
      error_message: `getRideStatusCountForLastMonth service error - ${error.message}.`,
    });
    throw error;
  }
};

const getDateWisePastWeekRideStatusCount = async (allRides) => {
  try {
    // ✅ Get the date range (Last 7 days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    // ✅ Initialize the result object with last 7 days as keys
    const rideStats = {};

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD

      rideStats[dateStr] = {
        scheduled: { Completed: 0, Cancelled: 0 },
        instant: { Completed: 0, Cancelled: 0 },
      };
    }
    if (allRides.length > 0) {
      // ✅ Process rides to count completed & cancelled rides for 'scheduled' and 'instant'
      allRides.forEach((ride) => {
        const rideDate = new Date(ride.order_date).toISOString().split("T")[0]; // Extract date part
        const rideType = ride.ride_type; // scheduled | instant
        const rideStatus = ride.status; // Completed | Cancelled

        if (
          rideStats[rideDate] &&
          (rideType === "scheduled" || rideType === "instant") &&
          (rideStatus === "Completed" || rideStatus === "Cancelled")
        ) {
          rideStats[rideDate][rideType][rideStatus] += 1; // Increment the respective counter
        }
      });
    }

    return rideStats;
  } catch (error) {
    console.error(
      "🚨 Error processing date-wise past week ride status count:",
      error
    );
    await addServerLog({
      log_level: "ERROR",
      service_name: "getDateWisePastWeekRideStatusCount",
      error_message: `getDateWisePastWeekRideStatusCount service error - ${error.message}.`,
    });
    throw error;
  }
};

const getCommission = async (data, params) => {
  try {
    const { start_date, end_date, user_id, user_type } = data;

    const { page, limit } = params;
    // If no date range is provided (empty string), default to today’s data.
    let start, end;
    if (!start_date || !end_date || start_date === "" || end_date === "") {
      const today = new Date();
      // Set start as the beginning of today, and end as the beginning of tomorrow.
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );
    } else {
      start = new Date(start_date);
      end = new Date(end_date);
    }

    // Call DAO with our dynamic parameters.
    const commission = await dashboardDAO.findCommissionDetails(
      start,
      end,
      user_id,
      user_type,
      page,
      limit
    );
    return commission;
  } catch (error) {
    console.error("Error in getCommission service:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCommission",
      error_message: `getCommission service error - ${error.message}.`,
    });
    throw error;
  }
};

async function getDailyCommission(user_id) {
  try {
    const tzOffset = "+04:00";
    const dubaiDate = getDubaiDateString(new Date());
    const currentDay = new Date(`${dubaiDate}T23:59:59.999${tzOffset}`).toISOString();
    const startDate = new Date(`${dubaiDate}T00:00:00.000${tzOffset}`).toISOString();

    const commission = await dashboardDAO.findDailyCommission(
      startDate,
      currentDay,
      user_id
    );
    return commission;
  } catch (error) {
    console.error("Error in getting commission", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getDailyCommission",
      error_message: `getDailyCommission service error - ${error.message}.`,
    });
    throw error;
  }
}

async function getRevenueBreakdownByPaymentMethod(rides) {
  try {
    let totalAmount = 0;
    let totalDiscount = 0;
    let todayEarnings = 0;

    const dubaiDate = getDubaiDateString(new Date());
    const tzOffset = "+04:00";

    // Start of Today (00:00:00.000 in Dubai time)
    const startOfToday = new Date(`${dubaiDate}T00:00:00.000${tzOffset}`).toISOString();

    // End of Today (23:59:59.999 in Dubai time)
    const endOfToday = new Date(`${dubaiDate}T23:59:59.999${tzOffset}`).toISOString();

    console.log({ startOfToday, endOfToday });

    const todayStartDate = new Date(startOfToday);
    const todayEndDate = new Date(endOfToday);

    const validStatuses = ["Completed", "Review-Pending", "Payment-Pending"];

    rides.forEach((ride) => {
      const finalAmount = parseFloat(
        ride?.final_price_calculation?.final_total_amount || 0
      );
      const previousBalance = parseFloat(
        ride?.final_price_calculation?.previous_balance || 0
      );
      const discount = parseFloat(
        ride?.final_price_calculation?.coupon_discount || 0
      );
      const netAmount = finalAmount - previousBalance;

      // ✅ Total Revenue
      totalAmount += netAmount;

      // ✅ Today's Earnings
      if (ride.planned_end_time) {
        const rideEndTime = new Date(ride.planned_end_time);
        if (rideEndTime >= todayStartDate && rideEndTime < todayEndDate) {
          todayEarnings += netAmount;
        }
      }

      // ✅ Total Discount (only for certain statuses)
      if (validStatuses.includes(ride.status)) {
        totalDiscount += discount;
        totalAmount += discount;
      }
    });

    // ✅ Round off to 2 decimal places
    return {
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      todayEarnings: parseFloat(todayEarnings.toFixed(2)),
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRevenueBreakdownByPaymentMethod",
      error_message: `getRevenueBreakdownByPaymentMethod service error - ${error.message}.`,
    });
    console.error("getRevenueBreakdownByPaymentMethod error:", error.message);
    throw error;
  }
}

async function userActiveInactive(data) {
  const { user_id, enable } = data;
  try {
    // 1) Fetch user + role
    const user = await userStatusDAO.findUserByIdWithRole(user_id);
    if (!user) {
      throw new Error("User not found");
    }

    // 2) If disabling, enforce ride constraints
    if (enable === false) {
      if (user.role_id === 4) {
        const active = await ridesDAO.getActiveRideForChauffeur(user_id);
        if (active.length) {
          throw new Error("Chauffeur has an active ride or a scheduled ride.");
        }
      }
      if (user.role_id === 3) {
        const pending = await chauffeurRidesDAO.checkPendingRideForPD(user_id);
        if (pending.length) {
          throw new Error("PD has pending rides.");
        }
      }
    }

    // 3) Pick the right status name
    const statusName = enable ? "Online" : "Offline";
    const status = await userStatusDAO.findStatusByName(statusName);
    if (!status) {
      throw new Error(`Status "${statusName}" not found`);
    }

    // 4) Update user status
    const updated = await userDAO.updateUser(user_id, { status_id: status.id });

    if(!enable) {
      const sessionKey = `session:${user.id}`;
      await redisClient.del(sessionKey);
    }

    const activeInactive = await userDAO.makeActiveInactive(user_id,enable);


    return {
      message: `User ${enable ? "enabled " : "disabled "} successfully.`,
      user:activeInactive
    };

  } catch (error) {
    console.error("Error in userActiveInactive:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "userActiveInactive",
      error_message: `User active/inactive toggle error - ${error.message}`,
    });
    throw error;
  }
}

const removeProfileImage = async ({ userId }) => {
  try {
    // Fetch user profile
    const user = await userDAO.findByUserId(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const userProfile = await getUserProfile(userId);
    const s3Key = userProfile?.images;

    if (!s3Key) {
      throw new Error("No profile image to remove.");
    }

    // Delete from S3
    await deleteFileFromS3(s3Key);

    // Update DynamoDB to remove the image key
    await clearUserProfileImage(userId);

    return { deletedImage: s3Key };
  } catch (error) {
    console.error("Service error (removeProfileImage):", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "removeProfileImage",
      error_message: `removeProfileImage service error - ${error.message}.`,
    });
    throw error;
  }
};


module.exports = {
  createProfile,
  dashboardData,
  saveProfileImage,
  getCommission,
  userActiveInactive,
  removeProfileImage 
};
