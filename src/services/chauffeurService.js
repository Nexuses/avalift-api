const NotificationDAO = require("../dao/notificationDOA");
const chauffeurRidesDOA = require("../dao/chauffeurRidesDAO");
const { getRideByStatus } = require("../controllers/adminController");
const ridesDAO = require("../dao/ridesDAO");
const auditDAO = require("../dao/auditDAO");
const paymentsDAO = require("../dao/paymentsDAO");
const { addServerLog } = require("./serverLogsService");
const userDAO = require("../dao/userDAO");
const {buildNotifyCustomerAboutApplePayInitialization} = require("./customerNotificationDataBuilder");
const { queuePushNotification } = require("../adaptors/notificationService");

async function getChauffeurNotifications(chauffeurId, page, limit) {
  if (!chauffeurId) {
    throw new Error("Chauffeur ID is required");
  }
  const pageNumber = Math.max(1, parseInt(page, 10));
  const pageSize = Math.max(1, parseInt(limit, 10));

  return await NotificationDAO.getNotificationsByChauffeurId(
    chauffeurId,
    pageNumber,
    pageSize
  );
}

async function getChauffeurRideHistory(chauffeurId, params) {
  let { page, limit } = params;
  page = parseInt(params.page) || 1;
  limit = parseInt(params.limit) || 10;

  if (!chauffeurId) {
    throw new Error("Chauffeur ID is required");
  }

  const rideHistory = await chauffeurRidesDOA.getRideHistoryByChauffeurId(
    chauffeurId,
    page,
    limit
  );

  // Iterate over each ride and add calculated ride duration
  const ridesWithDuration = await Promise.all(
    rideHistory.rides.map(async (ride) => {
      const ride_duration = await chauffeurRidesDOA.getChauffeurRideDuration(
        ride.status_log
      );
      return {
        ...ride,
        ride_duration, // Append calculated duration
      };
    })
  );

  return {
    ...rideHistory,
    rides: ridesWithDuration,
  };
}

async function getRideStatus(data) {
  // Check if the ride ID is provided
  if (!data.ride_id) {
    throw new Error("ride id is required");
  }

  // Fetch the ride status using the ride ID (expects an array response)
  let ride = await chauffeurRidesDOA.getRideStatus(data.ride_id);

  let customerRide = await ridesDAO.getRideById(data.ride_id);
  if (!customerRide) {
    throw new Error("Ride Not Found");
  }

  // Check if the array has at least one item
  if (ride && ride.length > 0) {
    ride = ride[0];
  } else {
    console.log("No ride found for the provided ride ID.");
    return null;
  }

  // Ensure before_ride_images is always an array
  ride.before_ride_images = Array.isArray(ride.before_ride_images) ? ride.before_ride_images : [];

  // Determine if the ride is an organization ride
  let is_organisation_ride = false;
  //console.log("ORGANISATION_ID: ", ride.organisation_id);

  let orgId = ride.organisation_id;
  if (orgId === "*") {
    orgId = 1;
  } else {
    orgId = parseInt(orgId) || null;
  }
  ride.organisation_id = orgId;
  is_organisation_ride = orgId !== 1;
  ride.is_organisation_ride = is_organisation_ride;

  // Extract the 'Started' status datetime from status_log
  let startedTime = "";
  if (ride.status_log && Array.isArray(ride.status_log)) {
    const startedLog = ride.status_log.find((log) => log.status === "Started");
    if (startedLog) {
      startedTime = startedLog.datetime;
    }
  }

  // Find vehicle audit for the ride and attach the isVehicleAuditComplete flag
  try {
    const vehicleAudit = await auditDAO.getAuditByRideId(ride.ride_id);
    ride.isVehicleAuditComplete = vehicleAudit.length > 0 ? true : false;
  } catch (auditError) {
    console.error("Error fetching vehicle audit:", auditError);
    ride.isVehicleAuditComplete = false;
  }

  // Construct a new response object without status_log
  const response = {
    ...ride,
    estimated_amount:customerRide.estimated_amount,
    estimated_time_in_minutes:customerRide.estimated_time_in_minutes,
    started_time: startedTime,
    payment_method: ride.paymentDetails?.payment_method,
    requested_drop_point: ride.requested_drop_point,
    requested_drop: ride.requested_drop,
    respond_to_tip: ride.respond_to_tip
  };
  // Remove status_log from the response
  delete response.status_log;

  //console.log("Ride Status with is_organisation_ride flag:", ride);
  return [response];
}

async function cancelRequest(ride_id, chauffeur_id) {
  try {
    if (!ride_id || !chauffeur_id) {
      throw new Error("Ride ID and Chauffeur ID are required.");
    }

    const updates = { status: "Cancelled" };
    const ride = await chauffeurRidesDOA.getRideById(ride_id);
    if (!ride) {
      throw new Error("Ride does not exist.");
    }
    if (ride.status === "Started") {
      throw new Error("Ride already started cannot cancel");
    }

    const rideKey = {
      PK: ride.PK,
      SK: ride.SK,
    };
    const data = {
      status: "Cancelled",
      status_log: [
        ...(ride.status_log || []),
        {
          status: "Cancelled",
          datetime: new Date().toISOString(),
          action: "Chauffeur cancelled pickup request",
        },
      ],
    };
    const cancelledRide = await chauffeurRidesDOA.updateRideTable(
      rideKey,
      data
    );
    if (!cancelledRide) {
      throw new Error("Failed to cancel ride. It may not exist.");
    }

    return cancelledRide;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "cancelRequest",
      error_message: `cancelRequest service error - ${error.message}.`,
    });
    console.error("Error cancelling the ride:", error.message);
    throw error;
  }
}

const chauffeurSummary = async (start_date, end_date, user_id) => {
  try {
    let rides = await ridesDAO.fetchRideByUserIdAndDateRange(
      start_date,
      end_date,
      user_id
    );
    // ✅ Ensure rides is always an array
    if (!Array.isArray(rides)) {
      return [];
    }

    if (rides.length === 0) {
      return [];
    }
    const revenueByPaymentMethods = await getRevenueBreakdownByPaymentMethod(rides);

    const totalRevenue = Object.values(revenueByPaymentMethods.breakdown).reduce((sum, value) => sum + value, 0);
    const rideIds = rides.map((ride) => ride.ride_id);
    const totalRides = rideIds.length;
    // const result = await paymentsDAO.chauffeurPaymentsSummary(rides);
    // const totalAmount = await paymentsDAO.chauffeurPaymentsSummary(
    //   rideIds,
    //   start_date,
    //   end_date,
    //   user_id
    // );
    rides = rides.sort((a, b) => parseInt(b.ride_id) - parseInt(a.ride_id));

    return { 
      totalRides, 
      totalAmount:{total:totalRevenue, totalDiscount:revenueByPaymentMethods.totalDiscount, totalTip:revenueByPaymentMethods.totalTip}, 
      rides 
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "chauffeurSummary",
      error_message: `chauffeurSummary service error - ${error.message}.`,
    });
    console.error("Error in getting chauffeur summary");
    throw error;
  }
};

const getActiveChauffeurPdRides = async (chauffeurId) => {
  try {
    if (!chauffeurId) {
      throw new Error("chauffeur ID is required");
    }
    const changedchauffeurId = chauffeurId.toString();

    return await chauffeurRidesDOA.getActiveChauffeurPdRides(
      changedchauffeurId
    );
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveChauffeurPdRides",
      error_message: `getActiveChauffeurPdRides service error - ${error.message}.`,
    });
    console.error("Getting customer Rides error:", error.message);
    throw error;
  }
};

async function getRevenueBreakdownByPaymentMethod(rides) {
  try {
    const breakdown = {};
    let totalDiscount = 0;
    let totalTip = 0;

    rides.forEach((ride) => {
      const finalAmount = parseFloat(ride?.final_price_calculation?.final_total_amount || 0);
      const previousBalance = parseFloat(ride?.final_price_calculation?.previous_balance || 0);
      const discount = parseFloat(ride?.final_price_calculation?.coupon_discount || 0);
      const paymentMethod = ride?.paymentDetails?.payment_method || "Unknown";
      const netAmount = finalAmount - previousBalance;
      const tipAmount = parseFloat(ride?.final_price_calculation?.tip_amount || 0);

      if (!breakdown[paymentMethod]) {
        breakdown[paymentMethod] = 0;
      }

      breakdown[paymentMethod] += netAmount;
      totalDiscount += discount;
      totalTip += tipAmount;
    });

    return { breakdown, totalDiscount, totalTip };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRevenueBreakdownByPaymentMethod",
      error_message: `getRevenueBreakdownByPaymentMethod service error - ${error.message}.`,
    });
    console.error("getRevenueBreakdownByPaymentMethod error:", error.message);
    throw error;
  }
};

const activateApplePayIndication = async (chauffeurId, data) => {
  try {
    const {ride_id, chauffeur_initiate_apple_pay} = data;

    if (!ride_id || !chauffeur_initiate_apple_pay) {
      throw new Error("Ride ID and chauffeur_initiate_apple_pay are required");
    }
    const getRideDetails = await ridesDAO.getRideById(ride_id);

    if (!getRideDetails) {
      throw new Error("Ride not found");
    }
    if (getRideDetails.chauffeur_id !== chauffeurId ) {
      throw new Error("Ride does not belong to the chauffeur");
    }

    if (getRideDetails.status !== "Payment Initiated") {
      throw new Error("Ride must be at 'Payment Initiated' status to activate Apple Pay indication");
    }

    const updateData = { 
      chauffeur_initiate_apple_pay: true, 
      paymentDetails: {
        payment_method: "Apple Pay"
      }
    }; 
    const rideKey = { PK: `${getRideDetails.customer_id}`, SK: `#${getRideDetails.ride_id}` };
    const ride = await ridesDAO.updateRideTable(rideKey, updateData);

    //send notification to customer
    try {

      const deviceId = await userDAO.findDeviceIdByUserId(getRideDetails.customer_id);

      if (!deviceId) {
        console.warn("Device ID not found for customer:", getRideDetails.customer_id);
      }
      const notificationData = await buildNotifyCustomerAboutApplePayInitialization(getRideDetails)
      await queuePushNotification(deviceId, notificationData);
    } catch (error) {
      console.error("Error in sending notification to customer:", error.message);
    }
    console.log("Ride updated with chauffeur_initiate_apple_pay:", ride);

    return ride;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "activateApplePayIndication",
      error_message: `activateApplePayIndication service error - ${error.message}.`,
    });
    console.error("Error in activating Apple Pay indication:", error.message);
    throw error;
  }
};

const checkApplePayPayment = async (data) => {
  try {
    const {ride_id} = data;

    if (!ride_id) {
      const error = new Error("Ride ID is are required");
      error.status = 400;
      throw error;
    }
    const getRideDetails = await ridesDAO.getRideById(ride_id);

    if (!getRideDetails) {
      const error = new Error("Ride not found");
      error.status = 404;
      throw error;
    }

    if (getRideDetails.chauffeur_initiate_apple_pay !== true) {
      const error = new Error("Chauffeur has not initiated Apple Pay yet");
      error.status = 404;
      throw error;
    }

    //console.log(getRideDetails.apple_pay_paid);
    const apple_pay_paid = getRideDetails?.apple_pay_paid;
    const apple_pay_payment_failed = getRideDetails?.apple_pay_payment_failed;
    //console.log(apple_pay_paid);

    return {
      apple_pay_paid,
      apple_pay_payment_failed
    }
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkApplePayPayment",
      error_message: `checkApplePayPayment service error - ${error.message}.`,
    });
    console.error("Error in checking Apple Pay payment:", error.message);
    throw error;
  }
}

module.exports = {
  getChauffeurNotifications,
  cancelRequest,
  getChauffeurRideHistory,
  getRideStatus,
  chauffeurSummary,
  getActiveChauffeurPdRides,
  activateApplePayIndication,
  checkApplePayPayment
};
