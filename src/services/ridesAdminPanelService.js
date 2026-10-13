const ridesAdminpanelDOA = require('../dao/ridesAdminpanelDOA'); // Update path to your function file
const User = require('../dao/userDAO');
const ridesDAO = require('../dao/ridesDAO');
const { isOverlapping } = require('../helpers/overlappingCheckHelper');
const userDAO = require('../dao/userDAO');
const { buildScheduledAssignNotificationData, buildReAssignNotificationData } = require('./chauffeurNotificationDataBuilder');
const { buildAcceptNotification } = require('./customerNotificationDataBuilder');
const { queuePushNotification } = require('../adaptors/notificationService');
const { removeScheduledRide } = require('../helpers/scheduleHelper');
const { filterLocations } = require('../helpers/locationHelper');
const { Payments, PaymentType } = require('../dto'); 
const paymentsDAO = require('../dao/paymentsDAO');
const { addServerLog } = require('../services/serverLogsService');
const rideExportService = require('../services/rideExportService');
const { error } = require('../validators/invoiceValidator');
const fs = require("fs");
const {getCommissionSumByUserId, getTotalCommissionSum} = require('./commissionService');

const getRidesForChauffeurs = async (body, params) => {
  try {
    const {
      status = null,
      search_string = null,
      start_date = null,
      end_date = null,
    } = body;

    const { page, limit } = params;
    const pageNumber = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));

    const dateFilter = {
      startDate: start_date,
      endDate: end_date,
    };

    const result = await ridesAdminpanelDOA.fetchRidesForChauffeurs(
      status,
      search_string,
      dateFilter,
      pageNumber,
      pageSize
    );

    if (!result.rides.length) {
      console.log("No rides found.");
      return { rides: [], totalPages: 0, currentPage: pageNumber };
    }

    return result;
  } catch (error) {
    console.error("Error in getRidesForChauffeurs service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRidesForChauffeurs",
      error_message: `getRidesForChauffeurs service error - ${error.message}.`
    });
    throw new Error("Failed to fetch rides. Please try again later.");
  }
};

const getRidesForUserType = async (body, params, user) => {
  try {
    const {
      ride_type,
      status = null,
      search_string = null,
      start_date = null,
      end_date = null,
      selected_org = null,
      rate_type = null
    } = body;

    console.log("Getting request", body);

    const { page, limit } = params;
    const pageNumber = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));

    // Extract organization id from token
    const org_id = user.organization_id;
    console.log("Extracting organization id from token", org_id);

    if (!org_id) {
      const error = new Error("Organization ID is required to fetch all customer rides.");
      error.statusCode = 409;
      throw error;
    }

    const dateFilter = {
      startDate: start_date,
      endDate: end_date,
    };

    console.log(
      `Service: Fetching rides for rideType: ${ride_type} on page ${pageNumber} with limit ${pageSize}...`
    );

    const result = await ridesAdminpanelDOA.fetchRidesForCustomer(
      ride_type,
      status,
      search_string,
      dateFilter,
      pageNumber,
      pageSize,
      org_id,
      selected_org,
      rate_type
    );

    console.log("Service: rides.", result);

    if (!result.rides.length) {
      console.log("No rides found.");
      return { rides: [], totalPages: 0, currentPage: pageNumber };
    }

    return result;
  } catch (error) {
    console.error("Error in getRidesForUserType service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRidesForUserType",
      error_message: `getRidesForUserType service error - ${error.message}.`
    });
    if (error.statusCode) {
      throw error;
    }
    const serverError = new Error("Failed to fetch rides. Please try again later.");
    serverError.statusCode = 500;
    throw serverError;
  }
};

const getRevenueReport = async (start_date, end_date, chauffeurId) => {
  try {
    let params = {
      TableName: "Rides",
      IndexName: "status-index",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "Completed",
      },
    };

    let filterExpressions = [];
    if (start_date && end_date) {
      filterExpressions.push("#order_date BETWEEN :startDate AND :endDate");
      params.ExpressionAttributeNames["#order_date"] = "order_date";
      params.ExpressionAttributeValues[":startDate"] = start_date;
      params.ExpressionAttributeValues[":endDate"] = end_date;
    }

    if (chauffeurId) {
      filterExpressions.push("#chauffeurId = :chauffeurId");
      params.ExpressionAttributeNames["#chauffeurId"] = "chauffeur_id";
      params.ExpressionAttributeValues[":chauffeurId"] = chauffeurId;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
    }

    const rides = await ridesAdminpanelDOA.getRevenueReport(params);

    if (!rides || !Array.isArray(rides)) {
      console.error("Error: No data found or invalid format", rides);
      return { message: "No rides found in the given date range." };
    }
    const revenueReport = calculateRevenueByPaymentMethod(rides);
    return revenueReport;
  } catch (error) {
    console.error("Error fetching revenue report:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRevenueReport",
      error_message: `getRevenueReport service error - ${error.message}.`
    });
    throw new Error("Failed to fetch revenue report");
  }
};

const calculateRevenueByPaymentMethod = (rides) => {
  let revenueReport = {};
  rides.forEach((ride) => {
    const paymentMethod = ride.paymentDetails?.payment_method || "Unknown";
    const amount = ride.estimated_amount || 0;
    if (!revenueReport[paymentMethod]) {
      revenueReport[paymentMethod] = 0;
    }
    revenueReport[paymentMethod] += amount;
  });
  return revenueReport;
};

const getRevenue = async (start_date, end_date) => {
  try {
    const revenueByChauffeur = await ridesAdminpanelDOA.fetchRevenueByChauffeur(start_date, end_date);
    return revenueByChauffeur;
  } catch (error) {
    console.error("Error fetching revenue:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRevenue",
      error_message: `getRevenue service error - ${error.message}.`
    });
    throw error;
  }
};

const calculateRevenue = async (rides) => {
  try {
    const chauffeurs = await User.findAllByRole('chauffeur');
    const chauffeurMap = {};
    chauffeurs.forEach((c) => {
      chauffeurMap[c.id] = `${c.first_name} ${c.last_name}`;
    });

    let revenueByChauffeur = {};
    rides.forEach((ride) => {
      const chauffeurId = ride.chauffeur_id;
      const paymentMethod = ride.paymentDetails.payment_method || "Unknown";
      const revenue = parseFloat(ride.estimated_amount) || 0;
      if (!revenueByChauffeur[chauffeurId]) {
        revenueByChauffeur[chauffeurId] = {
          chauffeur_name: chauffeurMap[chauffeurId] || "Unknown",
          total_revenue: 0,
          payment_methods: {},
        };
      }
      revenueByChauffeur[chauffeurId].total_revenue += revenue;
      if (!revenueByChauffeur[chauffeurId].payment_methods[paymentMethod]) {
        revenueByChauffeur[chauffeurId].payment_methods[paymentMethod] = 0;
      }
      revenueByChauffeur[chauffeurId].payment_methods[paymentMethod] += revenue;
    });

    return revenueByChauffeur;
  } catch (error) {
    console.error('Error calculating revenue', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "calculateRevenue",
      error_message: `calculateRevenue service error - ${error.message}.`
    });
    throw error;
  }
};

const assignChauffeurToScheduledRide = async (rideId, chauffeurId) => {
  if (!chauffeurId || chauffeurId === "null") {
    return { error: "Invalid chauffeurId provided.", statusCode: 400 };
  }

  try {
    const ride = await ridesDAO.getRideById(rideId);
    if (!ride) {
      return { error: "Ride not found.", statusCode: 404 };
    }

    if (ride.ride_type !== "scheduled") {
      return { error: "Only scheduled rides can be assigned.", statusCode: 400 };
    }

    if (ride.chauffeur_id !== 0) {
      return { error: "Ride already has an assigned chauffeur.", statusCode: 409 };
    }

    const activeRides = await ridesDAO.getActiveInstantRideForChauffeur(chauffeurId);
    if (activeRides && activeRides.length > 0) {
      return { error: "Chauffeur currently has an active ride and cannot be assigned.", statusCode: 409 };
    }

    const newPickup = ride.scheduled_pickup;
    const newDuration = ride.estimated_time_in_minutes;
    const scheduledRides = await ridesDAO.getScheduledRidesForChauffeur(chauffeurId);
    console.log("Scheduled rides for chauffeur:", scheduledRides);

    const hasOverlap = scheduledRides.some(existingRide =>
      isOverlapping(
        existingRide.scheduled_pickup,
        existingRide.estimated_time_in_minutes,
        newPickup,
        newDuration
      )
    );
    if (hasOverlap) {
      return { error: "Chauffeur has an overlapping scheduled ride and cannot be assigned.", statusCode: 409 };
    }

    const chauffeurDetails = await userDAO.findById(chauffeurId);
    const chauffeurName = chauffeurDetails.first_name + " " + chauffeurDetails.last_name;

    const updateData = {
      chauffeur_id: chauffeurId,
      chauffeur_name: chauffeurName,
      lower_chauffeur_name: chauffeurName.toLowerCase(),
      status: "Accepted",
      status_log: [
        ...ride.status_log,
        {
          action: "Admin Chauffeur Assigned",
          status: "Accepted",
          datetime: new Date().toISOString(),
        },
      ],
    };

    const updatedRide = await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, updateData);
    await removeScheduledRide(updatedRide.ride_id);

    // Notify Chauffeur
    try {
      console.log("Sending notification to chauffeur...", chauffeurId);
      console.log("type......",typeof(chauffeurId));
      const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(chauffeurId);
      console.log("Device ID for chauffeur:", chauffeurDeviceId);
      if (chauffeurDeviceId) {
        const notificationData = await buildScheduledAssignNotificationData(updatedRide);
        await queuePushNotification(chauffeurDeviceId, notificationData);
      } else {
        console.warn("No valid device_id found for chauffeur.");
      }
    } catch (notifError) {
      console.error("Error sending notification to chauffeur:", notifError);
      await addServerLog({
        log_level: "ERROR",
        service_name: "assignChauffeurToScheduledRide",
        error_message: `Notification error (chauffeur) - ${notifError.message}.`
      });
    }

    // Notify Customer
    try {
      const customerDeviceId = await userDAO.findDeviceIdByUserId(updatedRide.customer_id);
      if (customerDeviceId) {
        const notificationData = buildAcceptNotification(updatedRide);
        await queuePushNotification(customerDeviceId, notificationData);
      } else {
        console.warn("No valid device_id found for customer.");
      }
    } catch (notifError) {
      console.error("Error sending notification to customer:", notifError);
      await addServerLog({
        log_level: "ERROR",
        service_name: "assignChauffeurToScheduledRide",
        error_message: `Notification error (customer) - ${notifError.message}.`
      });
    }

    return {
      ride_id: updatedRide.ride_id,
      message: "Chauffeur assigned successfully.",
      statusCode: 200,
    };

  } catch (dbError) {
    console.error("Database error:", dbError);
    await addServerLog({
      log_level: "ERROR",
      service_name: "assignChauffeurToScheduledRide",
      error_message: `assignChauffeurToScheduledRide service error - ${dbError.message}.`
    });
    return { error: "Failed to update ride in the database.", statusCode: 500 };
  }
};

const reassignChauffeurToScheduledRide = async (rideId, newChauffeurId) => {
  if (!newChauffeurId || newChauffeurId === "null") {
    return { error: "Invalid chauffeur ID provided.", statusCode: 400 };
  }

  const ride = await ridesDAO.getRideById(rideId);
  if (!ride) {
    return { error: "Ride not found.", statusCode: 404 };
  }

  if (ride.chauffeur_id === 0) {
    return { error: "Ride is not yet assigned to a chauffeur, use the assign function instead.", statusCode: 409 };
  }

  if (ride.chauffeur_id === newChauffeurId) {
    return { error: "New chauffeur is already assigned to this ride.", statusCode: 409 };
  }

  const activeRides = await ridesDAO.getActiveInstantRideForChauffeur(newChauffeurId);
  if (activeRides.length > 0) {
    return { error: "New chauffeur currently has an active ride and cannot be assigned.", statusCode: 409 };
  }

  let oldChauffeurId = ride.chauffeur_id;
  const newPickup = ride.scheduled_pickup;
  const newDuration = ride.estimated_time_in_minutes;
  const scheduledRides = await ridesDAO.getScheduledRidesForChauffeur(newChauffeurId);

  const hasOverlap = scheduledRides.some(existingRide =>
    isOverlapping(
      existingRide.scheduled_pickup,
      existingRide.estimated_time_in_minutes,
      newPickup,
      newDuration
    )
  );
  if (hasOverlap) {
    return { error: "New chauffeur has an overlapping scheduled ride and cannot be assigned.", statusCode: 409 };
  }

  const chauffeurDetails = await userDAO.findById(newChauffeurId);
  const chauffeurName = chauffeurDetails.first_name + " " + chauffeurDetails.last_name;

  const updateData = {
    chauffeur_id: newChauffeurId,
    chauffeur_name: chauffeurName,
    lower_chauffeur_name: chauffeurName.toLowerCase(),
    status: "Accepted",
    status_log: [
      ...ride.status_log,
      {
        action: "Admin Chauffeur Reassigned",
        status: "Accepted",
        datetime: new Date().toISOString(),
      },
    ],
  };

  try {
    const updatedRide = await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, updateData);
    // Send a push notification to the new chauffeur.
    const chauffeur = await userDAO.findDeviceIdByUserId(newChauffeurId);
    if (chauffeur && chauffeur.device_id) {
      const notificationData = buildScheduledAssignNotificationData(updatedRide);
      await queuePushNotification(chauffeur.device_id, notificationData);
    }
    const oldChauffeur = await userDAO.findDeviceIdByUserId(oldChauffeurId);
    if (oldChauffeur && oldChauffeur.device_id) {
      const notificationData = buildReAssignNotificationData(updatedRide);
      await queuePushNotification(oldChauffeur.device_id, notificationData);
    }
    return {
      ride_id: updatedRide.ride_id,
      message: "Chauffeur reassigned successfully.",
      statusCode: 200,
    };
  } catch (dbError) {
    console.error("Database error:", dbError);
    await addServerLog({
      log_level: "ERROR",
      service_name: "reassignChauffeurToScheduledRide",
      error_message: `reassignChauffeurToScheduledRide service error - ${dbError.message}.`
    });
    return { error: "Failed to update ride in the database.", statusCode: 500 };
  }
};

const generateRevenueReport = async (chauffeur_id, startDate, endDate, pageNumber, pageSize) => {
  try {
    // const revenueByPaymentMethod = await ridesAdminpanelDOA.fetchRevenueByPaymentMethod(chauffeur_id, startDate, endDate);
    const rides = await ridesDAO.getAllRides(chauffeur_id, startDate, endDate);
    const result = sortAndPaginateRides(rides, pageNumber, pageSize, 'order_date', 'desc');
    const revenueByPaymentMethods = await getRevenueBreakdownByPaymentMethod(rides);
    const totalRevenue = Object.values(revenueByPaymentMethods).reduce((sum, value) => sum + value, 0);
    const totalCommission = chauffeur_id ? await getCommissionSumByUserId(chauffeur_id) : await getTotalCommissionSum();
    const totalTip = await getAllTipAmounts(rides);
    const totalAmountWithoutTip = totalRevenue - totalTip;
    return {
      totalRevenue,
      totalCommission,
      totalTip,
      totalAmountWithoutTip,
      paymentMethods: revenueByPaymentMethods,
      rides: result
    };
  } catch (error) {
    console.error("Error generating revenue report:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "generateRevenueReport",
      error_message: `generateRevenueReport service error - ${error.message}.`
    });
    throw error;
  }
};

const exportRidesToExcel = async (start_date, end_date) => {
  try {
    // ✅ Fetch rides from DB
    const rides = await ridesAdminpanelDOA.fetchRidesByDateRange(start_date, end_date);

    if (!rides || rides.length === 0) {
      throw new Error("No rides found for the selected date range.");
    }

    // ✅ Generate Excel File
    const filePath = await rideExportService.exportRidesToExcel(rides);

    // ✅ Ensure File Exists Before Returning
    if (!fs.existsSync(filePath)) {
      throw new Error("Error generating Excel file.");
    }

    return filePath; // ✅ Return the generated file path

  } catch (error) {
    console.error("🚨 Error exporting to Excel:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "exportRidesToExcel",
      error_message: `exportRidesToExcel service error - ${error.message}.`
    });
    throw error; // ✅ Ensure error is properly thrown for the controller to handle
  }
};

const sortAndPaginateRides = (rides, pageNumber = 1, pageSize = 10, sortField = 'order_date', sortDirection = 'desc') => {
  if (!Array.isArray(rides)) return [];

  // ✅ Sort rides by order_date (or any field)
  const sorted = rides.sort((a, b) => {
    const dateA = new Date(a[sortField]);
    const dateB = new Date(b[sortField]);
    return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
  });

  // ✅ Pagination calculation
  const start = (pageNumber - 1) * pageSize;
  const end = start + pageSize;

  return {
    totalRides: sorted.length,
    totalPages: Math.ceil(sorted.length / pageSize),
    currentPage: pageNumber,
    pageSize,
    data: sorted.slice(start, end)
  };
};

async function getRevenueBreakdownByPaymentMethod(rides) {
  const breakdown = {};

  rides.forEach((ride) => {
    const finalAmount = ride?.final_price_calculation?.final_total_amount || 0;
    const previousBalance = ride?.final_price_calculation?.previous_balance || 0;
    const paymentMethod = ride?.paymentDetails?.payment_method || "Unknown";

    const netAmount = finalAmount - previousBalance;

    if (!breakdown[paymentMethod]) {
      breakdown[paymentMethod] = 0;
    }

    breakdown[paymentMethod] += netAmount;
    //console.log(breakdown)
  });

  return breakdown;
}

async function getAllTipAmounts(rides) {
  let totalTips = 0;

  rides.forEach((ride) => {
    const tipAmount = ride?.final_price_calculation?.tip_amount || 0;
    totalTips += tipAmount;
  });

  return totalTips;
}



module.exports = { 
  getRidesForChauffeurs, 
  getRidesForUserType, 
  getRevenueReport, 
  getRevenue, 
  assignChauffeurToScheduledRide, 
  reassignChauffeurToScheduledRide,
  generateRevenueReport,
  exportRidesToExcel,
  sortAndPaginateRides,
  getAllTipAmounts
};
