// adminNotificationDataBuilder.js
const { User } = require('../dto');
const NotificationDAO = require("../dao/notificationDOA");
const { addServerLog } = require("../services/serverLogsService"); // Adjust path if needed

/**
 * Builds notification data for when a customer creates a ride.
 * @param {Object} rideData - The ride data to generate the notification details.
 * @param {string} adminId - The admin ID to whom the notification is addressed.
 * @returns {Object} - The constructed notification data.
 */
function buildRideCreationNotificationData(rideData, adminId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
  
    console.log("Building notification data for", rideData);
    return {
      title: "New Ride Created",
      body: `A new ride has been created by ${rideData.customer_details.name}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        customer_id: rideData.customer_id.toString(),
        customer_name: rideData.customer_details.name.toString(),
        customer_mobilenumber: rideData.customer_details.mobile_number.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point.toString() || "",
        requested_drop_lat: rideData.requested_drop.lat.toString() || "",
        requested_drop_long: rideData.requested_drop.long.toString() || "",
        estimated_amount: rideData.estimated_amount.toString(),
        order_date: rideData.order_date.toString(),
      },
      notification_type: "AdminNRC", // admin notify ride creation
      recipient_type: "admin",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildRideCreationNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildRideCreationNotificationData",
      error_message: `Error building ride creation notification data - ${error.message}.`
    });
    throw error;
  }
}

/**
 * Builds notification data for when a chauffeur declines a ride.
 * @param {Object} rideData - The ride data to generate the notification details.
 * @param {String} adminId - The admin ID who should receive the notification.
 * @param {String} chauffeurId - The chauffeur ID who declined the ride.
 * @returns {Object} - The constructed notification data.
 */
async function buildRideDeclinedNotificationData(rideData, adminId, chauffeurId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
  
    // Fetch chauffeur details asynchronously
    const chauffeur = await User.findOne({
      where: { id: chauffeurId },
    });
  
    if (!chauffeur) {
      throw new Error(`Chauffeur with ID ${chauffeurId} not found.`);
    }
  
    return {
      title: "Ride Declined",
      body: `Chauffeur ${chauffeur.first_name} ${chauffeur.last_name} has declined the ride ${rideData.ride_id}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        chauffeur_id: chauffeur.id.toString(),
        chauffeur_name: `${chauffeur.first_name} ${chauffeur.last_name}`,
        chauffeur_mobilenumber: chauffeur.mobile_number.toString(),
        chauffeur_country_code: chauffeur.country_code.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
      },
      notification_type: "AdminNRD", // Admin Notify Ride Decline
      recipient_type: "admin",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildRideDeclinedNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildRideDeclinedNotificationData",
      error_message: `Error building ride declined notification data - ${error.message}.`
    });
    throw new Error("Failed to build ride declined notification data.");
  }
}

/**
 * Retrieves notifications for an admin.
 * @param {string} adminId - The admin ID.
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<Object>} - Notifications data.
 */
async function adminNotifications(adminId, page, limit) {
  try {
    if (!adminId) {
      throw new Error("Admin ID is required");
    }
    return await NotificationDAO.getNotificationsForAdmin(adminId, page, limit);
  } catch (error) {
    console.error("Error in adminNotifications:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "adminNotifications",
      error_message: `Error fetching notifications for admin - ${error.message}.`
    });
    throw error;
  }
}

function buildScheduledRideNotificationData(rideData, adminId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
  
    console.log("Building scheduled ride notification data for", rideData);
    return {
      title: "New Scheduled Ride Created",
      body: `A new scheduled ride has been created by ${rideData.customer_details.name}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        customer_id: rideData.customer_id.toString(),
        customer_name: rideData.customer_details.name.toString(),
        customer_mobilenumber: rideData.customer_details.mobile_number.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
        requested_drop_long: rideData.requested_drop?.long?.toString() || "",
        estimated_amount: rideData.estimated_amount.toString(),
        order_date: rideData.order_date.toString(),
        notification_type: "AdminSRC",
      },
      notification_type: "AdminSRC", // Admin Scheduled Ride Creation
      recipient_type: "admin",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildScheduledRideNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildScheduledRideNotificationData",
      error_message: `Error building scheduled ride notification data - ${error.message}.`
    });
    throw error;
  }
}

async function buildPDRideDeclinedNotificationData(rideData, adminId, pdId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
    const pd = await User.findOne({
      where: { id: pdId },
    });
    if (!pd) {
      throw new Error(`PD with ID ${pdId} not found.`);
    }
    return {
      title: "Ride Declined",
      body: `PD ${pd.first_name} ${pd.last_name} has declined the ride ${rideData.ride_id}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        pd_id: pd.id.toString(),
        pd_name: `${pd.first_name} ${pd.last_name}`,
        pd_mobilenumber: pd.mobile_number.toString(),
        pd_country_code: pd.country_code.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "AdminNRD",
      },
      notification_type: "AdminNRD", // Admin Notify Ride Decline
      recipient_type: "admin",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildPDRideDeclinedNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildPDRideDeclinedNotificationData",
      error_message: `Error building PD ride declined notification data - ${error.message}.`
    });
    throw new Error("Failed to build ride declined notification data.");
  }
}

function buildReScheduledRideNotificationData(rideData, adminId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
  
    console.log("Building re-scheduled ride notification data for", rideData);
    return {
      title: "A ride has been rescheduled",
      body: `A ride has been rescheduled by ${rideData.customer_details.name}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        customer_id: rideData.customer_id.toString(),
        customer_name: rideData.customer_details.name.toString(),
        customer_mobilenumber: rideData.customer_details.mobile_number.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
        requested_drop_long: rideData.requested_drop?.long?.toString() || "",
        estimated_amount: rideData.estimated_amount.toString(),
        order_date: rideData.order_date.toString(),
        scheduled_pickup: rideData.scheduled_pickup.toString(),
        notification_type: "AdminNRSR",
      },
      notification_type: "AdminNRSR", // Admin Notify Re Scheduled Ride 
      recipient_type: "ADMIN",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildReScheduledRideNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildReScheduledRideNotificationData",
      error_message: `Error building re-scheduled ride notification data - ${error.message}.`
    });
    throw error;
  }
}

function buildRideCancelNotificationData(rideData, adminId) {
  try {
    if (!rideData) {
      throw new Error("Invalid ride data for notification.");
    }
  
    console.log("Building ride cancellation notification for", rideData);
    return {
      title: "Ride Cancelled",
      body: `The ride requested by ${rideData.customer_details.name} has been cancelled.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        customer_id: rideData.customer_id.toString(),
        customer_name: rideData.customer_details.name.toString(),
        customer_mobilenumber: rideData.customer_details.mobile_number.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
        requested_drop_long: rideData.requested_drop?.long?.toString() || "",
        estimated_amount: rideData.estimated_amount.toString(),
        order_date: rideData.order_date.toString(),
        cancel_reason: rideData.cancel_reason ? rideData.cancel_reason.toString() : "No reason provided",
        notification_type: "AdminRCC",
      },
      notification_type: "AdminRCC", // Admin Ride Cancellation
      recipient_type: "admin",
      recipient_id: adminId.toString(),
    };
  } catch (error) {
    console.error("Error in buildRideCancelNotificationData:", error.message);
    addServerLog({
      log_level: "ERROR",
      service_name: "buildRideCancelNotificationData",
      error_message: `Error building ride cancellation notification data - ${error.message}.`
    });
    throw error;
  }
}
  function buildNotifyCustomerAboutRescheduleFromAdmin(rideData) {
    try {
      if (!rideData) {
        throw new Error("Invalid ride data for notification.");
      }
  
      console.log("Building ride reschedule notification for", rideData);
  
      return {
        title: "Ride Rescheduled",
        body: `Your scheduled ride has been rescheduled from admin panel.`,
        data: {
          ride_id: rideData.ride_id.toString(),
          customer_id: rideData.customer_id.toString(),
          requested_pickup_point: rideData.requested_pickup_point.toString(),
          requested_pickup_lat: rideData.requested_pickup.lat.toString(),
          requested_pickup_long: rideData.requested_pickup.long.toString(),
          requested_drop_point: rideData.requested_drop_point?.toString() || "",
          requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
          requested_drop_long: rideData.requested_drop?.long?.toString() || "",
          notification_type: "AdminReschedule",
        },
        notification_type: "AdminReschedule",
        recipient_type: "customer",
        recipient_id: rideData.customer_id.toString(),
      };
    } catch (error) {
      console.error("Error in buildNotifyCustomerAboutRescheduleFromAdmin:", error.message);
      addServerLog({
        log_level: "ERROR",
        service_name: "buildNotifyCustomerAboutRescheduleFromAdmin",
        error_message: `Error building ride reschedule notification data - ${error.message}.`
      });
      throw error;
    }
  }

  function buildChauffeurRideCreationNotificationData(rideData, adminId) {
    try {
      if (!rideData) {
        throw new Error("Invalid ride data for notification.");
      }
    
      console.log("Building notification data for", rideData);
      return {
        title: "Chauffeur created pickup request",
        body: `A new pickup has been created by ${rideData.chauffeur_name}.`,
        data: {
          ride_id: rideData.ride_id.toString(),
          chauffeur_name: rideData.chauffeur_name.toString(),
          requested_pickup_point: rideData.requested_pickup_point.toString(),
          requested_pickup_lat: rideData.requested_pickup.lat.toString(),
          requested_pickup_long: rideData.requested_pickup.long.toString(),
          //requested_drop_point: rideData.requested_drop_point.toString() || "",
          //requested_drop_lat: rideData.requested_drop.lat.toString() || "",
          //requested_drop_long: rideData.requested_drop.long.toString() || "",
          //estimated_amount: rideData.estimated_amount.toString(),
          order_date: rideData.order_date.toString(),
        },
        notification_type: "AdminNRC", // admin notify ride creation
        recipient_type: "admin",
        recipient_id: adminId.toString(),
      };
    } catch (error) {
      console.error("Error in buildRideCreationNotificationData:", error.message);
      addServerLog({
        log_level: "ERROR",
        service_name: "buildRideCreationNotificationData",
        error_message: `Error building ride creation notification data - ${error.message}.`
      });
      throw error;
    }
  }

module.exports = { 
  buildRideCreationNotificationData,
  buildRideDeclinedNotificationData,
  adminNotifications,
  buildScheduledRideNotificationData,
  buildPDRideDeclinedNotificationData,
  buildReScheduledRideNotificationData,
  buildRideCancelNotificationData,
  buildNotifyCustomerAboutRescheduleFromAdmin,
  buildNotifyCustomerAboutRescheduleFromAdmin,
  buildChauffeurRideCreationNotificationData
};
