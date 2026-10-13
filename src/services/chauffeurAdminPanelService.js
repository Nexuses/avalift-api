const chauffeurRidesDAO = require('../dao/chauffeurRidesDAO');
const ridesDAO = require('../dao/ridesDAO');
const chauffeurNotification = require('./chauffeurNotificationDataBuilder');
const notificationService = require('../adaptors/notificationService');
const userDAO = require('../dao/userDAO');
const usersStatusDAO = require('../dao/usersStatusDAO');
const { addServerLog } = require('../services/serverLogsService');

/**
 * Service to get all rides for a specific chauffeur.
 * @param {object} data - Chauffeur's user ID contained in the request.
 * @returns {Promise<object[]>} - List of rides for the chauffeur.
 * @throws {Error} - If there is an error fetching rides.
 */
const getAllRidesForChauffeur = async (data) => {
  try {
    console.log(data);
    const user_id = data.user_id;
    console.log('user', user_id);
    if (!user_id) {
      throw new Error('Chauffeur Id is required.');
    }
    console.log('here', user_id);

    console.log(`Fetching all rides for chauffeur with ID: ${user_id}`);

    const rides = await chauffeurRidesDAO.fetchAllRidesForChauffeur(user_id);

    if (!rides.length) {
      console.log(`No rides found for chauffeur with ID: ${user_id}`);
      return [];
    }

    console.log(`Found ${rides.length} rides for chauffeur with ID: ${user_id}`);
    return rides;
  } catch (error) {
    console.error(`Error in getAllRidesForChauffeur service: ${error.message}`);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'getAllRidesForChauffeur',
      error_message: `getAllRidesForChauffeur service error - ${error.message}.`
    });
    throw new Error('Failed to fetch rides. Please try again later.');
  }
};

/**
 * Assigns a chauffeur to an existing ride.
 * @param {string} ride_id - The ride's ID.
 * @param {string} chauffeur_id - The chauffeur's ID.
 * @param {string} customer_id - The customer's ID.
 * @returns {Promise<object>} - The updated ride record.
 * @throws {Error} - If there is an error in assignment.
 */
const assignChauffeurToRide = async (ride_id, chauffeur_id, customer_id) => {
  try {
    // Validate ride existence
    const rideRequest = await ridesDAO.getRideById(ride_id);
    if (!rideRequest) {
      throw new Error(`Ride with ID ${ride_id} not found.`);
    }

    // Fix ride status check (use && instead of ||)
    if (rideRequest.status !== 'Accepted' && rideRequest.status !== 'Requested') {
      throw new Error(`Ride already ${rideRequest.status}`);
    }

    // Validate chauffeur ID before assignment
    if (!chauffeur_id) {
      throw new Error('Chauffeur ID is required to assign a ride.');
    }
    const chauffeur = await userDAO.findById(chauffeur_id);
    const chauffeurName = `${chauffeur.dataValues.first_name} ${chauffeur.dataValues.last_name}`;
    
    const updateData = {
      chauffeur_id: chauffeur_id,
      chauffeur_name: chauffeurName,
      lower_chauffeur_name: chauffeurName.toLowerCase(),
      status: 'Accepted',
      updatedAt: new Date().toISOString(),
      status_log: [
        ...rideRequest.status_log,
        {
          action: 'Admin Assigned Chauffeur',
          status: 'Accepted',
          datetime: new Date().toISOString(),
        },
      ]
    };

    // Update the rideTable directly
    const rideKey = {
      PK: `${customer_id}`,
      SK: `#${ride_id}`,
    };

    const ride = await ridesDAO.updateRideTable(rideKey, updateData);
    const data = await ridesDAO.getRide(`${customer_id}`, `#${ride_id}`);
    const rideData = await chauffeurNotification.buildAssignNotificationData(data);
    const user = await userDAO.findDeviceIdByUserId(chauffeur_id);
    console.log('User:', user);
    const notification = await notificationService.queuePushNotification(user, rideData);
    return ride;
  } catch (error) {
    console.error(`Error in assignChauffeurToRide service: ${error.message}`);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'assignChauffeurToRide',
      error_message: `assignChauffeurToRide service error - ${error.message}.`
    });
    throw new Error('Failed to assign chauffeur. Please try again.');
  }
};

/**
 * Reassigns a ride from one chauffeur to another.
 * @param {string} ride_id - The ride's ID.
 * @param {string} chauffeur_id - The new chauffeur's ID.
 * @param {string} customer_id - The customer's ID.
 * @returns {Promise<object>} - The updated ride record.
 * @throws {Error} - If there is an error in reassignment.
 */
const reassignChauffeurToRide = async (ride_id, chauffeur_id, customer_id) => {
  try {
    // Validate ride existence
    const rideRequest = await ridesDAO.getRideById(ride_id);
    if (!rideRequest) {
      throw new Error(`Ride with ID ${ride_id} not found.`);
    }

    // Fix ride status check (use && instead of ||)
    if (['Accepted', 'Requested'].includes(rideRequest.status)) {
      throw new Error(`Ride already ${rideRequest.status}`);
    }

    // Validate chauffeur ID before assignment
    if (!chauffeur_id) {
      throw new Error('Chauffeur ID is required to assign a ride.');
    }

    const rideKey = {
      PK: `${customer_id}`,
      SK: `#${ride_id}`,
    };

    const data = await ridesDAO.getRide(rideKey.PK, rideKey.SK);
    console.log('Current Ride Data:', data);
    const reassign = await chauffeurNotification.buildReAssignNotificationData(data);
    const oldChauffeur = await userDAO.findDeviceIdByUserId(data.chauffeur_id);
    const reassignNotification = await notificationService.queuePushNotification(oldChauffeur, reassign);

    const ride = await ridesDAO.updateRideTable(rideKey, { chauffeur_id, updatedAt: new Date().toISOString() });
    const newData = await ridesDAO.getRide(rideKey.PK, rideKey.SK);
    const rideData = await chauffeurNotification.buildAssignNotificationData(newData);

    const user = await userDAO.findDeviceIdByUserId(chauffeur_id);
    const notification = await notificationService.queuePushNotification(user, rideData);
    return ride;
  } catch (error) {
    console.error(`Error in reassignChauffeurToRide service: ${error.message}`);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'reassignChauffeurToRide',
      error_message: `reassignChauffeurToRide service error - ${error.message}.`
    });
    throw new Error('Failed to reassign chauffeur. Please try again.');
  }
};

/**
 * Fetches daily user online/offline log summary.
 * @param {object} data - Contains a date property.
 * @returns {Promise<object[]>} - Log summary with user details.
 * @throws {Error} - If there is an error fetching the log summary.
 */
const fetchUserLogSummary = async (data) => {
  try {
    let { date } = data;

    // Default to current UTC date at midnight if no date is provided
    if (!date || date === "") {
      date = new Date().toISOString().split("T")[0] + "T00:00:00.000Z";
    }

    // Fetch log summary for the given date
    const logSummary = await usersStatusDAO.getUserStatusByDate(date);

    console.log(logSummary);

    if (!logSummary || logSummary.length === 0) {
      console.warn(`No log summary found for date: ${date}`);
      return logSummary;
    }

    // Fetch user details safely
    const updatedLogSummary = await Promise.all(
      logSummary.map(async (user) => {
        const userDetails = await userDAO.findById(user.user_id); // Fetch user details
        
        // Check if userDetails is null
        if (!userDetails) {
          console.warn(`User details not found for user_id: ${user.user_id}`);
          return {
            user_id: user.user_id,
            name: " ",
            mobile: " ",
            date_utc: user.date_utc,
            online_duration_hours: user.online_duration,
            offline_duration_hours: user.offline_duration
          };
        }

        return {
          user_id: user.user_id,
          name: userDetails.first_name ? `${userDetails.first_name} ${userDetails.last_name}` : " ",
          mobile: userDetails.mobile_number ? `${userDetails.country_code} ${userDetails.mobile_number}` : " ",
          date_utc: user.date_utc,
          online_duration_hours: user.online_duration,
          offline_duration_hours: user.offline_duration
        };
      })
    );

    return updatedLogSummary;
  } catch (error) {
    console.error(`Error in fetchUserLogSummary service: ${error.message}`);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'fetchUserLogSummary',
      error_message: `fetchUserLogSummary service error - ${error.message}.`
    });
    throw new Error('Failed to fetch log summary. Please try again later.');
  }
};


module.exports = {
  getAllRidesForChauffeur,
  assignChauffeurToRide,
  reassignChauffeurToRide,
  fetchUserLogSummary
};
