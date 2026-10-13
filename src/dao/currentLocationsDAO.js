const { sequelize,CurrentLocation } = require("../dto");
const {addServerLog} = require("../services/serverLogsService");


const findNearbyUsers = async (latitude, longitude, radius, user_type) => {
  try {
    const query = `
      SELECT
        cl.id,
        cl.user_id,
        cl.user_type,
        cl.current_lat,
        cl.current_long,
        u.is_active,
        u.status_id,
        ST_Distance(cl.location, ST_MakePoint(:longitude, :latitude)::GEOGRAPHY) / 1000 AS distance
      FROM "Currentlocations" cl
      JOIN "Users" u ON cl.user_id = u.id
      WHERE
        cl.user_type = :user_type AND
        u.is_active = TRUE AND
        u.status_id = 1 AND
        u.user_availability = TRUE AND
        ST_DWithin(
          cl.location,
          ST_MakePoint(:longitude, :latitude)::GEOGRAPHY,
          :radius
        )
      ORDER BY distance ASC;
    `;

    const locations = await sequelize.query(query, {
      replacements: { latitude, longitude, radius, user_type },
      type: sequelize.QueryTypes.SELECT,
    });

    return locations;
  } catch (error) {
    console.error("Error querying nearby users:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "findNearbyUsers",
      error_message: `findNearbyUsers DAO error - ${error.message}.`,
    })
    throw error;
  }
};

const findCurrentLocationByUserId = async (userId) => {
  try {
    return await CurrentLocation.findOne({
      where: { user_id: userId },
      attributes: ["current_lat", "current_long"],
    });
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "findCurrentLocationByUserId",
      error_message: `findCurrentLocationByUserId DAO error - ${error.message}.`,
    })
    console.error("Error finding current location:", error);
    throw error;
  }
};

const findAllUserLocations = async () => {
  try {
    return await CurrentLocation.findAll({
      //where: { user_type: "chauffeur" },
      attributes: ["user_id", "current_lat", "current_long", "updatedAt"],
    });
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "findAllUserLocations",
      error_message: `findAllUserLocations DAO error - ${error.message}.`,
    })
    console.error("Error finding chauffeur locations:", error);
    throw error;
  }
};

module.exports = { findNearbyUsers, findCurrentLocationByUserId, findAllUserLocations };
