const { addServerLog } = require("../services/serverLogsService");

async function buildPickUpNotificationData(rideData, user_id, chauffeur_id) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "New Pickup Request",
      body: `A pickup is requested nearby at ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        chauffeur_id: chauffeur_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "chauff-pickup-req-pd",
        recipient_type: "PD",
        recipient_id: user_id.toString(),
      },
      notification_type: "chauff-pickup-req-pd",
      recipient_type: "PD",
      recipient_id: user_id.toString(),
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildPickUpNotificationData",
      error_message: `buildPickUpNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildAssignNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "New Pickup Assigned",
      body: `A pickup is assigned nearby at ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "ChauPR",
      },
      notification_type: "ChauPR",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildAssignNotificationData",
      error_message: `buildAssignNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildReAssignNotificationData(rideData) {
  try {
    console.log("inside the buildReAssignNotificationData",rideData);
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "You have been reassigned",
      body: `You have been reassigned from ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "ChauPR",
      },
      notification_type: "ChauPR",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildReAssignNotificationData",
      error_message: `buildReAssignNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildPDAssignNotificationData(rideData, pd_id) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "New Pickup Assigned",
      body: `A pickup is assigned nearby at ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "Adm",
      },
      notification_type: "Adm",
      recipient_type: "pd",
      recipient_id: pd_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildPDAssignNotificationData",
      error_message: `buildPDAssignNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildPDReAssignNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "Ride Re-Assigned",
      body: `You have been re-assigned from ride ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "Adm",
      },
      notification_type: "Adm",
      recipient_type: "pd",
      recipient_id: rideData.pd_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildPDReAssignNotificationData",
      error_message: `buildPDReAssignNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildCreateRideNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "Your ride has been created",
      body: `Chauffeur has been assigned to your ride ${rideData.ride_id}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "adminCR",
      },
      notification_type: "adminCR",
      recipient_type: "customer",
      recipient_id: rideData.customer_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildCreateRideNotificationData",
      error_message: `buildCreateRideNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildAcceptNotification(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "Your ride request has been accepted",
      body: `Your ride from ${rideData.requested_pickup_point} has been accepted.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        notification_type: "ChauPR",
      },
      notification_type: "ChauPR",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildAcceptNotification",
      error_message: `buildAcceptNotification service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildScheduledAssignNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "You have been assigned a ride",
      body: `You have been assigned a ride nearby at ${rideData.requested_pickup_point}.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        customer_name: rideData.customer_details.name.toString(),
        mobile_number: rideData.customer_details.mobile_number.toString(),
        customer_id: rideData.customer_id.toString(),
        estimated_amount: rideData.estimated_amount.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
        requested_drop_long: rideData.requested_drop?.long?.toString() || "",
        scheduled_pickup: rideData.scheduled_pickup.toString(),
        notification_type: "ChauSA",
      },
      notification_type: "ChauSA",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id.toString(),
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildScheduledAssignNotificationData",
      error_message: `buildScheduledAssignNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildCancelRideFromCustomerNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "Your ride has been cancelled by customer",
      body: `Your current ride has been cancelled by customer.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_pickup_lat: rideData.requested_pickup.lat.toString(),
        requested_pickup_long: rideData.requested_pickup.long.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        requested_drop_lat: rideData.requested_drop?.lat?.toString() || "",
        requested_drop_long: rideData.requested_drop?.long?.toString() || "",
        notification_type: "CustCN",
      },
      notification_type: "CustCN",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id.toString(),
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildCancelRideFromCustomerNotificationData",
      error_message: `buildCancelRideFromCustomerNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

async function buildScheduleRideRemovedNotificationData(rideData) {
  try {
    if (!rideData) throw new Error("Invalid ride data for notification.");
    return {
      title: "Scheduled ride has been removed",
      body: `Scheduled ride for ${rideData.ride_id} has been removed.`,
      data: {
        ride_id: rideData.ride_id.toString(),
        requested_pickup_point: rideData.requested_pickup_point.toString(),
        requested_drop_point: rideData.requested_drop_point?.toString() || "",
        notification_type: "ChauRSR",
      },
      notification_type: "ChauRSR",
      recipient_type: "chauffeur",
      recipient_id: rideData.chauffeur_id.toString(),
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "buildScheduleRideRemovedNotificationData",
      error_message: `buildScheduleRideRemovedNotificationData service error - ${error.message}.`
    });
    throw error;
  }
}

module.exports = {
  buildPickUpNotificationData,
  buildAssignNotificationData,
  buildReAssignNotificationData,
  buildCreateRideNotificationData,
  buildPDAssignNotificationData,
  buildPDReAssignNotificationData,
  buildAcceptNotification,
  buildScheduledAssignNotificationData,
  buildCancelRideFromCustomerNotificationData,
  buildScheduleRideRemovedNotificationData
};
