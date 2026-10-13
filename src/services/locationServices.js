const { createLocationSchema } = require("../validators/locationValidator");
const { CurrentLocation } = require("../dto");
const userDOA = require("../dao/userDAO");
const ridesDOA = require("../dao/ridesDAO");
const currentLocationDOA = require("../dao/currentLocationsDAO");
const { findNearbyUsers, findAllUserLocations } = require('../dao/currentLocationsDAO');
const { getActiveRideForChauffeur } = require("../dao/ridesDAO");
const { getLastSeenOffline } = require("../dao/usersStatusDAO");
const { saveUserLocation } = require("../dao/locationHistoryDAO");
const { getDriverLocations } = require('../dao/locationHistoryDAO');
const { addServerLog } = require("../services/serverLogsService");
require('dotenv').config();

/**
 * Create or update a user's current location.
 * @param {number} user_id
 * @param {string} user_type
 * @param {object} data - { user_id, user_type, current_lat, current_long }.
 * @returns {object} The updated location details.
 */
const createOrUpdateCurrentLocation = async (data, user_id, user_type) => {
  // Ensure user_type is converted to a string if it's an array
  const userTypeString = Array.isArray(user_type) ? user_type.join(",") : user_type;

  const changedData = {
    user_id: user_id,
    user_type: userTypeString,
    ...data
  };

  // Validate input using Joi
  const { error, value } = createLocationSchema.validate(changedData, { abortEarly: false });
  if (error) {
    throw new Error(`Validation error: ${error.details.map((x) => x.message).join(", ")}`);
  }

  const { current_lat, current_long } = value;

  try {
    // Calculate the POINT value for geography
    const location = { type: 'Point', coordinates: [current_long, current_lat] };

    // Find or update the current location
    const [locationEntry, created] = await CurrentLocation.findOrCreate({
      where: { user_id, user_type: userTypeString },
      defaults: { current_lat, current_long, location },
    });

    if (!created) {
      // Update location if it already exists
      await locationEntry.update({ current_lat, current_long, location });
    }

    try {
      await saveUserLocation(user_id.toString(), current_lat, current_long);
    } catch (innerError) {
      console.error("Error in saveUserLocation:", innerError);
      // Note: This error is logged but not rethrown, so the location update can still succeed.
    }

    return locationEntry;
  } catch (error) {
    console.error("Error in createOrUpdateCurrentLocation:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createOrUpdateCurrentLocation",
      error_message: `createOrUpdateCurrentLocation service error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Get a user's current location or all locations by user_type.
 * @param {number} [user_id] - The unique identifier for the user.
 * @param {string} [user_type] - The type of user ("pd" or "chauffeur").
 * @returns {object} The current location(s).
 */
const getCurrentLocation = async (data) => {
  const { user_id, user_type } = data;

  if (!user_id && !user_type) {
    throw new Error("Missing required parameters: user_id or user_type.");
  }

  try {
    let locations;

    if (user_id) {
      // Fetch location for a specific user
      locations = await CurrentLocation.findOne({ where: { user_id } });
      if (!locations) {
        throw new Error(`Current location not found for user_id: ${user_id}.`);
      }
    } else if (user_type) {
      // Fetch all locations for the given user_type
      locations = await CurrentLocation.findAll({ where: { user_type } });
      if (!locations || locations.length === 0) {
        throw new Error(`No locations found for user_type: ${user_type}.`);
      }
    }

    console.log(locations);
    return locations;
  } catch (error) {
    console.error("Error in getCurrentLocation:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCurrentLocation",
      error_message: `getCurrentLocation service error - ${error.message}.`
    });
    throw error;
  }
};

const getNearbyUsers = async (data) => {
  const { latitude, longitude, radius, user_type } = data;
  const radiusInMeters = parseFloat(radius * 1000); // Convert kilometers to meters

  try {
    let nearbyUsers = await findNearbyUsers(
      parseFloat(latitude),
      parseFloat(longitude),
      radiusInMeters,
      user_type
    );

    // Fetch full user details using findById
    const userDetailsPromises = nearbyUsers.map(async (user) => {
      try {
        const fullUser = await userDOA.findById(user.id);
        console.log(user);
        return {
          id: user.user_id,
          name: `${fullUser.first_name} ${fullUser.last_name}`,
          mobile_number: `${fullUser.country_code} ${fullUser.mobile_number}`,
          latitude: user.current_lat,
          longitude: user.current_long,
          updated_at: user.updatedAt,
        };
      } catch (error) {
        console.warn(`Skipping user ID ${user.id}: ${error.message}`);
        return null; // Skip users that are not found
      }
    });

    const locations = (await Promise.all(userDetailsPromises)).filter(Boolean);
    return locations;
  } catch (error) {
    console.error("Error in getNearbyUsers:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNearbyUsers",
      error_message: `getNearbyUsers service error - ${error.message}.`
    });
    throw error;
  }
};

const getAllChauffeursWithDetails = async () => {
  try {
    // Fetch all chauffeur locations
    let chauffeurLocations = await findAllUserLocations();
    chauffeurLocations = [...new Map(chauffeurLocations.map(item => [item.user_id, item])).values()];

    // Fetch full user details and active rides
    const userDetailsPromises = chauffeurLocations.map(async (chauffeur) => {
      try {
        const fullUser = await userDOA.findById(chauffeur.user_id);

        // Filter only PD (role_id 3) or Chauffeur (role_id 4)
        if (![3, 4].includes(fullUser.role_id)) {
          return null; // Skips other users
        }

        // Determine user type
        const userType = fullUser.role_id === 3 ? "PD" : "Chauffeur";
        // Determine status
        const status = fullUser.status_id === 1 ? "Online" : fullUser.status_id === 2 ? "Offline" : "Unknown";
        // Fetch active ride for the chauffeur
        const activeRide = await getActiveRideForChauffeur(chauffeur.user_id);
        // Fetch last seen offline timestamp
        let lastSeenTimestamp = await getLastSeenOffline(chauffeur.user_id);
        const lastSeenUTC = lastSeenTimestamp ? new Date(lastSeenTimestamp).toISOString() : null;

        return {
          id: chauffeur.user_id,
          name: `${fullUser.first_name} ${fullUser.last_name}`,
          mobile_number: `${fullUser.country_code} ${fullUser.mobile_number}`,
          status: status,
          user_type: userType,
          latitude: chauffeur.current_lat,
          longitude: chauffeur.current_long,
          updated_at: chauffeur.updatedAt,
          active_ride: activeRide.length > 0,
          last_seen: lastSeenUTC,
        };
      } catch (error) {
        console.warn(`Skipping user ID ${chauffeur.user_id}: ${error.message}`);
        return null;
      }
    });

    const locations = (await Promise.all(userDetailsPromises)).filter(Boolean);
    return locations;
  } catch (error) {
    console.error("Error in getAllChauffeursWithDetails:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllChauffeursWithDetails",
      error_message: `getAllChauffeursWithDetails service error - ${error.message}.`
    });
    throw error;
  }
};


const getNearbyPds = async (chauffeurId) => {
  try {
    const currentLocation = await currentLocationDOA.findCurrentLocationByUserId(chauffeurId);
    if (!currentLocation) {
      throw new Error("Current location not found for chauffeur.");
    }
    const { current_lat, current_long } = currentLocation;
    const radius = process.env.NEARBY_PD_RADIUS;
    console.log("Radius: " + radius, "latitude: " + current_lat, "longitude: " + current_long);

    let nearbyUsers = await findNearbyUsers(
      parseFloat(current_lat),
      parseFloat(current_long),
      radius,
      "pd"
    );

    console.log("NearbyUsers: ", nearbyUsers);

    // Fetch full user details using findById
    const userDetailsPromises = nearbyUsers.map(async (user) => {
      try {
        const fullUser = await userDOA.findById(user.id);
        console.log(user);
        return {
          pd_id: user.user_id,
          pd_name: `${fullUser.first_name} ${fullUser.last_name}`,
          pd_current_lat: user.current_lat,
          pd_current_long: user.current_long,
          distance: user.distance.toFixed(2),
        };
      } catch (error) {
        console.warn(`Skipping user ID ${user.id}: ${error.message}`);
        return null;
      }
    });

    const locations = (await Promise.all(userDetailsPromises)).filter(Boolean);
    console.log("locations", locations);
    return locations;
  } catch (error) {
    console.error("Error in getNearbyPds:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNearbyPds",
      error_message: `getNearbyPds service error - ${error.message}.`
    });
    throw error;
  }
};

const toRad = (deg) => (deg * Math.PI) / 180;

const equirectangularDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; 
  const x =
    toRad(lon2 - lon1) *
    Math.cos((toRad(lat1) + toRad(lat2)) / 2);
  const y = toRad(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * R;
};

const getDistanceMetrics = async (user_id, start_time, end_time) => {
  const points = await getDriverLocations(user_id, start_time, end_time);

  if (points.length < 2) {
    throw Object.assign(
      new Error('Not enough GPS points for the requested period'),
      { statusCode: 422 }
    );
  }

  points.sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

  const filteredPoints = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lastKept = filteredPoints.at(-1);
    const current = points[i];

    const timeDiff = (new Date(current.date_time) - new Date(lastKept.date_time)) / 1000;

    if (timeDiff >= 300) {
      filteredPoints.push(current);
    }
  }

  if (filteredPoints.length < 2) {
    throw Object.assign(
      new Error('Not enough filtered points (5 min apart) for calculation'),
      { statusCode: 422 }
    );
  }

  let totalDistanceMeters = 0;
  let maxSpeed = 0;
  let validTimeSec = 0;

  for (let i = 1; i < filteredPoints.length; i++) {
    const p1 = filteredPoints[i - 1];
    const p2 = filteredPoints[i];

    const dist = equirectangularDistance(
      parseFloat(p1.latitude),
      parseFloat(p1.longitude),
      parseFloat(p2.latitude),
      parseFloat(p2.longitude)
    );

    const dt = (new Date(p2.date_time) - new Date(p1.date_time)) / 1000;
    const speed = (dist / dt) * 3.6; // km/h

    if (speed > 140) {
      console.log(`Skipping pair: Speed ${speed.toFixed(2)} km/h exceeds 140 km/h.`);
      continue;
    }

    totalDistanceMeters += dist;
    validTimeSec += dt;

    if (speed > maxSpeed) maxSpeed = speed;
  }

  if (totalDistanceMeters === 0) {
    throw Object.assign(
      new Error('No valid point pairs under speed threshold found.'),
      { statusCode: 422 }
    );
  }

  const totalDistanceKm = Math.round(totalDistanceMeters / 1000);
  const avgSpeed = Math.round(totalDistanceKm / (validTimeSec / 3600));
  const maxSpeedFormatted = Math.round(maxSpeed);

  const formatTime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days >= 1) {
      return `${days} days ${hours} hours ${minutes} mins ${secs} seconds`;
    } else {
      return `${hours} hours ${minutes} mins ${secs} seconds`;
    }
  };

  return {
    user_id,
    total_distance: `${totalDistanceKm} km`,
    total_time: formatTime(validTimeSec),
    average_speed: `${avgSpeed} km/h`,
    max_speed: `${maxSpeedFormatted} km/h`,
  };
};








module.exports = {
  createOrUpdateCurrentLocation,
  getCurrentLocation,
  getNearbyUsers,
  getAllChauffeursWithDetails,
  getNearbyPds,
  getDistanceMetrics
};
