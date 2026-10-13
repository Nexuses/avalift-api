/**
 * Builds notification data for nearby chauffeurs.
 * @param {Object} rideData - The ride data to generate the notification details.
 * @returns {Object} - The constructed notification data.
 */
function buildCustomerRideRequestNotificationData(rideData, chauffeur) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildCustomerRideRequestNotificationData",
      error_message: `buildCustomerRideRequestNotificationData service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "New Ride Request",
    body: `A customer is requesting a ride near your location. ${rideData.requested_pickup_point}.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "new_ride_request",
      recipient_type: "chauffeur",
      recipient_id: chauffeur.id.toString(),
      order_date: rideData.order_date.toString(),
    },
    notification_type: "new_ride_request",
    recipient_type: "chauffeur",
    recipient_id: chauffeur.id.toString(),
  };
}

function buildOrganisationRideRequestNotificationData(rideData, admin) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildOrganisationRideRequestNotificationData",
      error_message: `buildOrganisationRideRequestNotificationData service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "New Organisation Ride Request",
    body: `An organisation user is requesting a ride at ${rideData.requested_pickup_point}.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "new_org_ride_request",
      recipient_type: "admin",
      recipient_id: admin.id.toString(),
      order_date: rideData.order_date.toString(),
    },
    notification_type: "new_org_ride_request",
    recipient_type: "admin",
    recipient_id: admin.id.toString(),
  };
}

function buildOrganisationScheduledRideRequestNotificationData(rideData, admin) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildOrganisationRideRequestNotificationData",
      error_message: `buildOrganisationRideRequestNotificationData service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "New Organization Scheduled Ride Request",
    body: `An organization user is requesting a scheduled ride at ${rideData.requested_pickup_point}.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "new_org_ride_request",
      recipient_type: "admin",
      recipient_id: admin.user_id.toString(),
      order_date: rideData.order_date.toString(),
      scheduled_pickup: rideData.scheduled_pickup.toString(),
    },
    notification_type: "new_org_schedule_ride_request",
    recipient_type: "admin",
    recipient_id: admin.user_id.toString(),
  };
}


function buildOrganisationScheduledRideReminderNotificationData(rideData, admin) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildOrganisationRideRequestNotificationData",
      error_message: `buildOrganisationRideRequestNotificationData service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "Scheduled Ride Reminder",
    body: `Reminder: The scheduled ride ${rideData.ride_id}is still unassigned. Please take action.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "new_org_ride_request",
      recipient_type: "admin",
      recipient_id: admin.user_id.toString(),
      order_date: rideData.order_date.toString(),
      scheduled_pickup: rideData.scheduled_pickup.toString(),
    },
    notification_type: "new_org_schedule_ride_request",
    recipient_type: "admin",
    recipient_id: admin.user_id.toString(),
  };
}

function buildAcceptNotification(rideData) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildAcceptNotification",
      error_message: `buildAcceptNotification service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "Your scheduled ride has been confirmed",
    body: `Your ride from ${rideData.requested_pickup_point} has been accepted.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      notification_type: "CustRC"
    },
    notification_type: "CustRC",
    recipient_type: "customer",
    recipient_id: rideData.chauffeur_id,
  };
};

function buildScheduleRideRequestNotificationData(rideData, chauffeurId) {
  console.log(rideData);

  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildScheduleRideRequestNotificationData",
      error_message: `buildScheduleRideRequestNotificationData service error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "New Ride Request",
    body: `A customer is requesting a ride near your location. ${rideData.requested_pickup_point}.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "new_ride_request",
      recipient_type: "chauffeur",
      recipient_id: chauffeurId.toString(),
      order_date: rideData.order_date.toString(),
      scheduled_pickup: rideData.scheduled_pickup.toString(),
    },
    notification_type: "new_ride_request",
    recipient_type: "chauffeur",
    recipient_id: chauffeurId.toString(),
  };
}

function buildNotifyCustomerAboutApplePayInitialization(rideData) {
  if (!rideData) {
    // Log error before throwing
    addServerLog({
      log_level: "ERROR",
      service_name: "buildNotifyCustomerAboutApplePayInitialization",
      error_message: `buildNotifyCustomerAboutApplePayInitializationservice error - Invalid ride data for notification.`
    }).catch(err => console.error("Error logging server log:", err));
    throw new Error("Invalid ride data for notification.");
  }

  return {
    title: "Apple Pay Payment Initiated",
    body: `Chauffeur has started the payment process through Apple Pay for your ride ${rideData.ride_id}.`,
    data: {
      ride_id: rideData.ride_id.toString(),
      requested_pickup_point: rideData.requested_pickup_point.toString(),
      requested_pickup_lat: rideData.requested_pickup.lat.toString(),
      requested_pickup_long: rideData.requested_pickup.long.toString(),
      customer_id: rideData.customer_id.toString(),
      estimated_amount: rideData.estimated_amount.toString(),
      requested_drop_point: rideData.requested_drop_point
        ? rideData.requested_drop_point.toString()
        : "NA",
      requested_drop_lat: rideData.requested_drop?.lat
        ? rideData.requested_drop.lat.toString()
        : "0.00",
      requested_drop_long: rideData.requested_drop?.long
        ? rideData.requested_drop.long.toString()
        : "0.00",
      notification_type: "Apple_Pay_Payment_Initiated",
      recipient_type: "chauffeur",
      recipient_id: rideData.customer_id.toString(),
      order_date: rideData.order_date.toString(),
      scheduled_pickup: rideData.scheduled_pickup.toString(),      
    },
    notification_type: "Apple_Pay_Payment_Initiated",
    recipient_type: "Customer",
    recipient_id: rideData.customer_id.toString(),
  }
}

module.exports = {
  buildCustomerRideRequestNotificationData,
  buildOrganisationRideRequestNotificationData,
  buildAcceptNotification,
  buildScheduleRideRequestNotificationData,
  buildOrganisationScheduledRideRequestNotificationData,
  buildOrganisationScheduledRideReminderNotificationData,
  buildNotifyCustomerAboutApplePayInitialization
};
