const UserDAO = require('../dao/usersStatusDAO');
const ridesDAO = require('../dao/ridesDAO');
const chauffeurRidesDAO = require('../dao/chauffeurRidesDAO');
const { addServerLog } = require("../services/serverLogsService");
const usersStatusDAO = require("../dao/usersStatusDAO");

// Function to update the user's status
const updateUserStatus = async (userId, status_name) => {
  try {
    // Fetch the user with role and status
    const user = await UserDAO.findUserByIdWithRole(userId);
    if (!user) {
      throw new Error("User not found");
    }
   console.log(user);

   if(status_name==="Offline"){
   if (user.role_id === 4) {  // Chauffeur role
      if ((await ridesDAO.getActiveInstantRideForChauffeur(userId)).length) {
        throw Object.assign(new Error("Chauffeur has an active ride."), { status: 400 });
      }
    }

    if (user.role_id === 3) {  // PD role
      if ((await chauffeurRidesDAO.checkPendingRideForPD(userId)).length) {
        throw Object.assign(new Error("PD has pending rides."), { status: 400 });
      }
    }
  }
    // Find the status ID for the given status name
    const status = await UserDAO.findStatusByName(status_name);
    if (!status) {
      throw new Error("Invalid status name");
    }
    // Update the user's status
    const result = await UserDAO.updateUserStatus(userId, status.id);
    if (result[0] === 0) {
      throw new Error("Failed to update user status");
    }
    return { message: "Status updated successfully" };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUserStatus",
      error_message: `updateUserStatus failed: ${error.message}`,
    });
    throw error;
  }
};

const createStatus = async (name) => {
  try {
    const newStatus = await UserDAO.createStatus(name);
    return newStatus;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createStatus",
      error_message: `createStatus failed: ${error.message}`,
    });
    throw new Error('Error in status service: ' + error.message);
  }
};

const getAdminStatuses = async () => {
    const requiredStatuses = ["Requested", "Started","On-The-Way", "Accepted", "Completed", "Cancelled"];
    const statuses = await usersStatusDAO.getStatusesByName(requiredStatuses);

  if (!statuses || statuses.length === 0) {
    const error = new Error("No statuses found.");
    error.statusCode = 404;
    throw error;
  }

  // Sort statuses in the required order
  const sortedStatuses = requiredStatuses.map((name) =>
    statuses.find((status) => status.name === name)
  ).filter(Boolean); // remove undefined if any not found

  return sortedStatuses;
  };

module.exports = {
  createStatus,
  updateUserStatus,
  getAdminStatuses
};
