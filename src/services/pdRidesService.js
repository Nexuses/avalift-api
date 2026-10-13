const { addItemWithAutoIncrement } = require("../dao/counterDAO");
const { createEntryInRideTable } = require("../dao/ridesDAO");
const ridesDAO = require("../dao/ridesDAO");
const userDAO = require("../dao/userDAO");
const notificationDAO = require("../dao/notificationDOA");
const chauffeurRidesDAO = require("../dao/chauffeurRidesDAO");
const chauffeurNotification = require("../services/chauffeurNotificationDataBuilder");
const notificationService = require("../adaptors/notificationService");
const locationDAO = require("../dao/currentLocationsDAO");
const {
  pdAddChauffeurSchema,
  pdDropChauffeurSchema,
  rideSchemaPickupDrop,
  rideSchemaPickup,
} = require("../validators/pdRidesValidator");
const rideController = require("../controllers/rideController");
const { addServerLog } = require("../services/serverLogsService");

/**
 * Adds a chauffeur to a PD ride.
 */
const addChauffeurToPDRide = async (pdRideId, chauffeurData) => {
  try {
    // Validate input
    const validatedData = await pdAddChauffeurSchema.validateAsync(
      chauffeurData,
      {
        abortEarly: false,
      }
    );

    const { chauffeur_id, drop_point } = validatedData;

    // Retrieve the PD ride
    const pdRide = await ridesDAO.getRide(pdRideId, "DETAILS");
    if (!pdRide) {
      const error = new Error("PD Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    // Check if chauffeur is already assigned
    const existingPickup = pdRide.pickups.find(
      (cp) => cp.chauffeur_id === chauffeur_id
    );
    if (existingPickup) {
      const error = new Error("Chauffeur is already assigned to this PD ride.");
      error.statusCode = 400;
      throw error;
    }

    // Check capacity
    if (pdRide.current_count >= pdRide.max_capacity) {
      const error = new Error("PD ride has reached its maximum capacity.");
      error.statusCode = 400;
      throw error;
    }

    // Add chauffeur to pickups
    pdRide.pickups.push({
      lat: null, // To be updated when pickup is requested
      long: null,
      sequence: pdRide.current_count + 1,
      chauffeur_id,
      drop_point,
    });
    pdRide.current_count += 1;

    // Update status log
    pdRide.status_log.push({
      status: `Chauffeur ${chauffeur_id} Added`,
      datetime: new Date().toISOString(),
    });

    // Update the PD ride in DynamoDB
    await ridesDAO.updateRide(pdRide);
  } catch (error) {
    console.error("Error in addChauffeurToPDRide:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addChauffeurToPDRide",
      error_message: `addChauffeurToPDRide service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Drops a chauffeur from a PD ride.
 */
const dropChauffeurFromPDRide = async (pdRideId, chauffeur_id) => {
  try {
    // Validate input
    const validatedData = await pdDropChauffeurSchema.validateAsync(
      { chauffeur_id },
      {
        abortEarly: false,
      }
    );

    // Retrieve the PD ride
    const pdRide = await ridesDAO.getRide(pdRideId, "DETAILS");
    if (!pdRide) {
      const error = new Error("PD Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    // Find the chauffeur in pickups
    const chauffeurIndex = pdRide.pickups.findIndex(
      (cp) => cp.chauffeur_id === chauffeur_id
    );
    if (chauffeurIndex === -1) {
      const error = new Error("Chauffeur not found in this PD ride.");
      error.statusCode = 404;
      throw error;
    }

    // Remove chauffeur from pickups
    pdRide.pickups.splice(chauffeurIndex, 1);
    pdRide.current_count -= 1;

    // Update status log
    pdRide.status_log.push({
      status: `Chauffeur ${chauffeur_id} Dropped`,
      datetime: new Date().toISOString(),
    });

    // Update the PD ride in DynamoDB
    await ridesDAO.updateRide(pdRide);
  } catch (error) {
    console.error("Error in dropChauffeurFromPDRide:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "dropChauffeurFromPDRide",
      error_message: `dropChauffeurFromPDRide service error - ${error.message}.`,
    });
    throw error;
  }
};

const pickup = async (messageData) => {
  try {
    const rideData = {
      PK: `PD#${messageData.pd_id}`,
      SK: `PICKUP#${messageData.chauffeur_id}#${messageData.ride_id}`,
      ...messageData,
    };
    await createEntryInRideTable("PDPickupDrop", rideData);
    const rideRequest = await chauffeurRidesDAO.getRideById(
      messageData.ride_id
    );
    const updateData = {
      status: "Started",
      updatedAt: new Date().toISOString(),
      status_log: [
        ...(rideRequest.status_log ?? []),
        {
          action: "PD Picked Chauffeur",
          status: "Ride Started",
          datetime: new Date().toISOString(),
        },
      ],
    };
    const rideKey = {
      PK: `CHAUFFEUR#${messageData.chauffeur_id}`,
      SK: `RIDE#${messageData.ride_id}`,
    };
    await chauffeurRidesDAO.updateRideTable(rideKey, updateData);
  } catch (error) {
    console.error("Error in pickup:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "pickup",
      error_message: `pickup service error - ${error.message}.`,
    });
    throw error;
  }
};

const drop = async (messageData) => {
  try {
    const rideData = {
      PK: `PD#${messageData.pd_id}`,
      SK: `DROP#${messageData.chauffeur_id}#${messageData.ride_id}`,
      ...messageData,
    };
    await createEntryInRideTable("PDPickupDrop", rideData);
    const rideRequest = await chauffeurRidesDAO.getRideById(
      messageData.ride_id
    );
    const updateData = {
      status: "Completed",
      updatedAt: new Date().toISOString(),
      status_log: [
        ...(rideRequest.status_log ?? []),
        {
          action: "PD Dropped Chauffeur",
          status: "Ride Completed",
          datetime: new Date().toISOString(),
        },
      ],
    };
    const rideKey = {
      PK: `CHAUFFEUR#${messageData.chauffeur_id}`,
      SK: `RIDE#${messageData.ride_id}`,
    };
    await chauffeurRidesDAO.updateRideTable(rideKey, updateData);
    await userDAO.userCommissionPD(messageData);
  } catch (error) {
    console.error("Error in drop:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "drop",
      error_message: `drop service error - ${error.message}.`,
    });
    throw error;
  }
};

const chauffeursPicked = async (pd_id) => {
  try {
    const picked = await chauffeurRidesDAO.fetchPickedUpChauffeurs(pd_id);
    const chauffeurs = await userDAO.findAllByRole("chauffeur");
    let chauffeursMap = {};
    for (const chauffeur of chauffeurs) {
      chauffeursMap[
        chauffeur.id
      ] = `${chauffeur.first_name} ${chauffeur.last_name}`;
    }
    const updatedPicked = picked.map((ride) => ({
      ...ride,
      chauffeur_name: chauffeursMap[ride.chauffeur_id] || "Unknown",
      picked_time: ride.updatedAt,
    }));
    return updatedPicked;
  } catch (error) {
    console.error("Error fetching picked chauffeurs:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "chauffeursPicked",
      error_message: `chauffeursPicked service error - ${error.message}.`,
    });
    throw error;
  }
};

const chauffeursDropped = async (pd_id) => {
  try {
    const dropped = await chauffeurRidesDAO.fetchDroppedChauffeurs(pd_id);
    const chauffeurs = await userDAO.findAllByRole("chauffeur");
    let chauffeursMap = {};
    for (const chauffeur of chauffeurs) {
      chauffeursMap[
        chauffeur.id
      ] = `${chauffeur.first_name} ${chauffeur.last_name}`;
    }
    const updatedDropped = dropped.map((ride) => ({
      ...ride,
      chauffeur_name: chauffeursMap[ride.chauffeur_id] || "Unknown",
      dropped_time: ride.updatedAt,
    }));
    return updatedDropped;
  } catch (error) {
    console.error("Error fetching dropped chauffeurs:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "chauffeursDropped",
      error_message: `chauffeursDropped service error - ${error.message}.`,
    });
    throw error;
  }
};

async function getTotalHoursWorked(responsePicked, responseDropped) {
  try {
    const chauffeursPicked = responsePicked.chauffeursPicked;
    const chauffeursDropped = responseDropped.chauffeursDropped;
    if (!Array.isArray(chauffeursPicked) || !Array.isArray(chauffeursDropped)) {
      throw new Error("chauffeursPicked or chauffeursDropped is not an array");
    }
    const data = { chauffeursPicked, chauffeursDropped };
    const totalHoursWorked = await calculateTotalHours(data);
    return totalHoursWorked;
  } catch (error) {
    console.error("Error in getTotalHoursWorked:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getTotalHoursWorked",
      error_message: `getTotalHoursWorked service error - ${error.message}.`,
    });
    throw error;
  }
}

async function calculateTotalHours(data) {
  try {
    const pickedRides = data.chauffeursPicked.reduce((acc, ride) => {
      acc[ride.ride_id] = new Date(ride.updatedAt);
      return acc;
    }, {});
    const droppedRides = data.chauffeursDropped.reduce((acc, ride) => {
      if (pickedRides[ride.ride_id]) {
        const dropTime = new Date(ride.updatedAt);
        const pickTime = pickedRides[ride.ride_id];
        acc.push((dropTime - pickTime) / (1000 * 60 * 60));
      }
      return acc;
    }, []);
    const totalHours = droppedRides.reduce((sum, hours) => sum + hours, 0);
    return totalHours;
  } catch (error) {
    console.error("Error in calculateTotalHours:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "calculateTotalHours",
      error_message: `calculateTotalHours service error - ${error.message}.`,
    });
    throw error;
  }
}

async function fetchRides(pd_id, action, from_date, to_date) {
  try {
    const result = await ridesDAO.fetchRidesWithStatusAndDateRange(
      pd_id,
      action,
      from_date,
      to_date
    );
    // console.log(result);
    // ✅ Extract unique chauffeur and PD IDs
    const chauffeurIds = new Set();
    const pdIds = new Set();

    result.forEach((ride) => {
      if (ride.chauffeur_id) chauffeurIds.add(ride.chauffeur_id);
      if (ride.pd_id) pdIds.add(ride.pd_id);
    });

    const userResults = await userDAO.findChauffeurPD(chauffeurIds, pdIds);

    // ✅ Create a map of user IDs to names
    const userMap = {};
    userResults.forEach(({ id, first_name, last_name }) => {
      userMap[id] = `${first_name} ${last_name}`;
    });

    // ✅ Add names to ride objects
    const enrichedRides = result.map((ride) => ({
      ...ride,
      chauffeur_name: userMap[ride.chauffeur_id] || "Unknown",
      pd_name: userMap[ride.pd_id] || "Unknown",
    }));

    return enrichedRides;
  } catch (error) {
    console.error("Error in fetchRides:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRides",
      error_message: `fetchRides service error - ${error.message}.`,
    });
    throw error;
  }
}

async function assignPD(pd_id, chauffeur_id, ride_id) {
  try {
    const data = await chauffeurRidesDAO.getRide(
      `CHAUFFEUR#${chauffeur_id}`,
      `RIDE#${ride_id}`
    );
    if (!data) {
      console.error("Ride request not found");
      throw new Error("Ride Request not found");
    }
    const userName = await userDAO.findById(pd_id);
    const name = `${userName.first_name} ${userName.last_name}`;
    const updateData = {
      pd_id: pd_id,
      pd_name: `${userName?.first_name || ""} ${
        userName?.last_name || ""
      }`.trim(),
      lower_pd_name: name.toLowerCase(),
      status: "Accepted",
      updatedAt: new Date().toISOString(),
    };
    if (!data.chauffeur_id || !data.ride_id) {
      console.error("Invalid ride data:", data);
      throw new Error("Invalid ride data");
    }
    const rideKey = {
      PK: `CHAUFFEUR#${data.chauffeur_id}`,
      SK: `RIDE#${data.ride_id}`,
    };
    const result = await chauffeurRidesDAO.updateRideTable(rideKey, updateData);
    const user = await userDAO.findDeviceIdByUserId(pd_id);
    if (!user) {
      console.error("User not found");
      throw new Error("User not found");
    }
    const rideData = await chauffeurNotification.buildPDAssignNotificationData(
      data,
      pd_id
    );
    await notificationService.queuePushNotification(user, rideData);
    const chauffeur = await userDAO.findDeviceIdByUserId(data.chauffeur_id);
    if (!chauffeur) {
      console.error("Chauffeur not found");
      throw new Error("Chauffeur not found");
    }
    const chauffeurRide = await chauffeurNotification.buildAcceptNotification(
      data
    );
    await notificationService.queuePushNotification(chauffeur, chauffeurRide);
    return result;
  } catch (error) {
    console.error("Error in assignPD:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "assignPD",
      error_message: `assignPD service error - ${error.message}.`,
    });
    throw error;
  }
}

async function reAssignPD(pd_id, chauffeur_id, ride_id) {
  try {
    const data = await chauffeurRidesDAO.getRide(
      `CHAUFFEUR#${chauffeur_id}`,
      `RIDE#${ride_id}`
    );
    if (!data) {
      console.error("Ride request not found");
      throw new Error("Ride Request not found");
    }
    const reAssignUser = await userDAO.findDeviceIdByUserId(pd_id);
    if (!reAssignUser) {
      console.error("User not found");
      throw new Error("User not found");
    }
    const rideReAssignData =
      chauffeurNotification.buildPDReAssignNotificationData(data);
    await notificationService.queuePushNotification(
      reAssignUser,
      rideReAssignData
    );
    const userName = await userDAO.findById(pd_id);
    const name = `${userName.first_name} ${userName.last_name}`;
    const updateData = {
      pd_id: pd_id,
      pd_name: `${userName?.first_name || ""} ${
        userName?.last_name || ""
      }`.trim(),
      lower_pd_name: name.toLowerCase(),
      status: "Accepted",
      updatedAt: new Date().toISOString(),
    };
    if (!data.chauffeur_id || !data.ride_id) {
      console.error("Invalid ride data:", data);
      throw new Error("Invalid ride data");
    }
    const rideKey = {
      PK: `CHAUFFEUR#${data.chauffeur_id}`,
      SK: `RIDE#${data.ride_id}`,
    };
    const result = await chauffeurRidesDAO.updateRideTable(rideKey, updateData);
    const user = await userDAO.findDeviceIdByUserId(pd_id);
    if (!user) {
      console.error("User not found");
      throw new Error("User not found");
    }
    const rideData = await chauffeurNotification.buildPDAssignNotificationData(
      data,
      pd_id
    );
    await notificationService.queuePushNotification(user, rideData);
    const chauffeur = await userDAO.findDeviceIdByUserId(data.chauffeur_id);
    if (!chauffeur) {
      console.error("Chauffeur not found");
      throw new Error("Chauffeur not found");
    }
    const chauffeurRide = await chauffeurNotification.buildAcceptNotification(
      data
    );
    await notificationService.queuePushNotification(chauffeur, chauffeurRide);
    return result;
  } catch (error) {
    console.error("Error in reAssignPD:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "reAssignPD",
      error_message: `reAssignPD service error - ${error.message}.`,
    });
    throw error;
  }
}

async function getAllRides(pd_id) {
  try {
    console.log(pd_id);
    if (!pd_id) {
      throw new Error("PD ID is required");
    }
    const rides = await chauffeurRidesDAO.fetchAllRidesForPD(pd_id);
    return rides;
  } catch (error) {
    console.error("Error fetching rides:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllRides",
      error_message: `getAllRides service error - ${error.message}.`,
    });
    throw error;
  }
}

async function fetchPendingPickupsAndDrops(pd_id, status) {
  try {
    if (!pd_id) {
      throw new Error("PD ID is required");
    }
    const rides = await chauffeurRidesDAO.checkPendingRideForPD(pd_id);
    let pendingPickups = 0;
    let pendingDrops = 0;
    let pickupDetails = [];
    let dropDetails = [];

    for (const ride of rides) {
      let chauffeurDetails = {};
      if (ride.chauffeur_id) {
        try {
          const chauffeur = await userDAO.findMobileNumberByUserId(
            ride.chauffeur_id
          );
          chauffeurDetails = {
            country_code: chauffeur.country_code,
            mobile_number: chauffeur.mobile_number,
          };
        } catch (error) {
          console.error(
            `Error fetching mobile details for chauffeur ID ${ride.chauffeur_id}:`,
            error.message
          );
          chauffeurDetails = { country_code: "", mobile_number: "" };
        }
      }
      if (ride.status === "Accepted") {
        pendingPickups++;
        pickupDetails.push({
          chauffeur_id: ride.chauffeur_id,
          chauffeur_name: ride.chauffeur_name,
          country_code: chauffeurDetails.country_code,
          mobile_number: chauffeurDetails.mobile_number,
          ride_id: ride.ride_id,
          pickup_point: ride.requested_pickup_point || "N/A",
          estimated_time: ride.estimated_time_in_minutes || 0,
          customer_name: ride.customer_name || "Unknown",
          pickup_lat_long: ride.requested_pickup,
          status: ride.status,
        });
      } else if (ride.status === "Droprequest") {
        pendingDrops++;
        dropDetails.push({
          chauffeur_id: ride.chauffeur_id,
          chauffeur_name: ride.chauffeur_name,
          country_code: chauffeurDetails.country_code,
          mobile_number: chauffeurDetails.mobile_number,
          ride_id: ride.ride_id,
          drop_point: ride.requested_drop_point || "N/A",
          estimated_time: ride.estimated_time_in_minutes || 0,
          customer_name: ride.customer_name || "Unknown",
          drop_lat_long: ride.requested_drop,
          status: ride.status,
        });
      }
    }
    return {
      pendingPickups,
      pendingDrops,
      pickupDetails,
      dropDetails,
    };
  } catch (error) {
    console.error("Error in fetching pending Rides:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchPendingPickupsAndDrops",
      error_message: `fetchPendingPickupsAndDrops service error - ${error.message}.`,
    });
    throw error;
  }
}

async function pdRideHistory(pd_id, page = 1, limit = 10) {
  try {
    const chauffeursPicked = await module.exports.chauffeursPicked(pd_id);
    const chauffeursDropped = await module.exports.chauffeursDropped(pd_id);
    let chauffeurMaps = {};
    const chauffeurs = await userDAO.findAllByRole("chauffeur");
    chauffeurs.forEach((chauffeur) => {
      chauffeurMaps[
        chauffeur.id
      ] = `${chauffeur.first_name} ${chauffeur.last_name}`;
    });
    const droppedMap = {};
    chauffeursDropped.forEach((drop) => {
      droppedMap[drop.ride_id] = drop;
    });
    const mappedRides = chauffeursPicked.map((pickup) => ({
      ride_id: pickup.ride_id,
      picked_chauffeur: {
        chauffeur_id: pickup.chauffeur_id,
        requested_pickup_point: pickup.requested_pickup_point,
        status: pickup.status,
        picked_time: pickup.updatedAt,
      },
      dropped_chauffeur: droppedMap[pickup.ride_id]
        ? {
            chauffeur_id: droppedMap[pickup.ride_id].chauffeur_id,
            drop_point: droppedMap[pickup.ride_id].requested_drop_point,
            status: droppedMap[pickup.ride_id].status,
            dropped_time: droppedMap[pickup.ride_id].updatedAt,
          }
        : null,
      chauffeur_name: chauffeurMaps[pickup.chauffeur_id] || "Unknown",
    }));
    mappedRides.sort((a, b) => Number(b.ride_id) - Number(a.ride_id));
    const offset = (page - 1) * limit;
    const paginatedRides = mappedRides.slice(offset, offset + limit);
    return {
      totalRecords: mappedRides.length,
      totalPages: Math.ceil(mappedRides.length / limit),
      currentPage: page,
      rides: paginatedRides,
    };
  } catch (error) {
    console.error("Error in pdRideHistory:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "pdRideHistory",
      error_message: `pdRideHistory service error - ${error.message}.`,
    });
    throw error;
  }
}

async function getPdNotifications(pdId, params) {
  try {
    if (!pdId) {
      throw new Error("Pd ID is required");
    }
    const { page, limit } = params;
    const newPage = parseInt(page);
    return await notificationDAO.getNotificationsByPdId(pdId, newPage, limit);
  } catch (error) {
    console.error("Error in getPdNotifications:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPdNotifications",
      error_message: `getPdNotifications service error - ${error.message}.`,
    });
    throw error;
  }
}

async function getRideStatus(data) {
  try {
    if (!data.ride_id) {
      throw new Error("ride id is required");
    }
    let ride = await chauffeurRidesDAO.getPdRideStatus(data.ride_id);
    console.log("ride data", ride);
    let pd;
    let location;
    console.log("ride[0].pd_id", ride[0].pd_id);
    if (ride[0].pd_id !== 0) {
      console.log("coming here");
      pd = await userDAO.findById(ride[0].pd_id);
      console.log("pd data", pd);
      location = await locationDAO.findCurrentLocationByUserId(ride[0].pd_id);
      console.log("location data", location);
    }
    if (ride && ride.length > 0) {
      ride = ride[0];
    } else {
      console.log("No ride found for the provided ride ID.");
      return null;
    }
    return {
      ride_id: ride.ride_id,
      pd_id: ride.pd_id,
      pd_name: ride.pd_name,
      pd_mobile_number: pd ? `${pd.country_code} ${pd.mobile_number}` : "",
      status: ride.status,
      pd_current_lat: location ? location.current_lat : 0.0,
      pd_current_long: location ? location.current_long : 0.0,
    };
  } catch (error) {
    console.error("Error in getRideStatus:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideStatus",
      error_message: `getRideStatus service error - ${error.message}.`,
    });
    throw error;
  }
}

async function rideSummary(startDate, endDate, userId) {
  try {
    const results = await chauffeurRidesDAO.rideSummary(
      startDate,
      endDate,
      userId
    );
    console.log(results);
    if (results.rides.length === 0) {
      return [];
    }
    results.rides = results.rides.sort(
      (a, b) => parseInt(b.ride_id) - parseInt(a.ride_id)
    );
    return results;
  } catch (error) {
    console.error("Error in rideSummary:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "rideSummary",
      error_message: `rideSummary service error - ${error.message}.`,
    });
    throw new Error(`Error in pd ride summary services: ${error.message}`);
  }
}

async function fetchChauffeursWithPd(pd_id) {
  try {
    const data = await chauffeurRidesDAO.fetchAllChauffeurswithPD(pd_id);
    const pdMap = {};
    data.forEach((ride) => {
      if (ride.pd_name && ride.chauffeur_name) {
        if (!pdMap[ride.pd_name]) {
          pdMap[ride.pd_name] = {
            pd_id: ride.pd_id,
            chauffeurs: [],
          };
        }
        pdMap[ride.pd_name].chauffeurs.push({
          chauffeur_id: ride.chauffeur_id,
          chauffeur_name: ride.chauffeur_name,
          ride_id: ride.ride_id || ride.SK.replace("RIDE#", ""),
          status: ride.status,
        });
      }
    });
    return pdMap;
  } catch (error) {
    console.error("Error in fetchChauffeursWithPd:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchChauffeursWithPd",
      error_message: `fetchChauffeursWithPd service error - ${error.message}.`,
    });
    throw new Error(`Error in fetching chauffeurs: ${error.message}`);
  }
}

module.exports = {
  addChauffeurToPDRide,
  dropChauffeurFromPDRide,
  pickup,
  drop,
  chauffeursPicked,
  chauffeursDropped,
  getTotalHoursWorked,
  fetchRides,
  assignPD,
  reAssignPD,
  getAllRides,
  fetchPendingPickupsAndDrops,
  pdRideHistory,
  getPdNotifications,
  getRideStatus,
  rideSummary,
  fetchChauffeursWithPd,
};
