const UserService = require("../services/userService");
const userProfileService = require("../services/userProfilesService");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed
const {validateUserProfileUpdate} = require('../validators/userValidator');
const createUser = async (req, res, next) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error("Error in createUser controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUser",
      error_message: `createUser Controller error - ${error.message}.`
    });
    next(error);
  }
};

// const getUser = async (req, res, next) => {
//   try {
//     const user = await UserService.getUser(req.params.id);
//     res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     next(error);
//   }
// };

const updateUser = async (req, res, next) => {
  try {
    const user = await UserService.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Error in updateUser controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUser",
      error_message: `updateUser Controller error - ${error.message}.`
    });
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await UserService.deleteUser(req.user.id);
    res.status(200).json({
      success: true,
      status: 200,
      message: "User has been deleted successfully.",
      data: [],
    });
  } catch (error) {
    console.error("Error in deleteUser controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteUser",
      error_message: `deleteUser Controller error - ${error.message}.`
    });
    next(error);
  }
};

const listIndividualCustomers = async (req, res) => {
  try {
    const { search_string, page = 1, limit = 10 } = req.body; // Default page=1, limit=10

    const { users, totalCount } = await UserService.getIndividualCustomers(
      search_string,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      status: 200,
      data: users,
      totalCount, // Total number of customers
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      message: "Individual customers fetched successfully",
    });
  } catch (error) {
    console.error("Error in listIndividualCustomers controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "listIndividualCustomers",
      error_message: `listIndividualCustomers Controller error - ${error.message}.`
    });
    res.status(500).json({ success: false, status: 500, message: error.message });
  }
};

const listCorporateCustomers = async (req, res) => {
  try {
    const users = await UserService.getCorporateCustomers();
    res.status(200).json({
      success: true,
      status: 200,
      data: users,
      message: "Corporate customers fetched successfully",
    });
  } catch (error) {
    console.error("Error in listCorporateCustomers controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "listCorporateCustomers",
      error_message: `listCorporateCustomers Controller error - ${error.message}.`
    });
    res.status(500).json({ success: false, status: 500, message: error.message });
  }
};

const listAllChauffeurs = async (req, res) => {
  try {
    const chauffeurs = await UserService.getAllChauffeurs();
    console.log(chauffeurs);
    res.status(200).json({
      success: true,
      status: 200,
      data: chauffeurs,
      message: "Chauffeurs fetched successfully",
    });
  } catch (error) {
    console.error("Error in listAllChauffeurs controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "listAllChauffeurs",
      error_message: `listAllChauffeurs Controller error - ${error.message}.`
    });
    res.status(500).json({
      success: false,
      status: 500,
      message: "Error fetching chauffeurs",
    });
  }
};

const listAllPd = async (req, res) => {
  try {
    const pd = await UserService.getAllPd();
    res.status(200).json({
      success: true,
      status: 200,
      message: "PDs fetched successfully.",
      data: pd,
    });
  } catch (error) {
    console.error("Error in listAllPd controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "listAllPd",
      error_message: `listAllPd Controller error - ${error.message}.`
    });
    res.status(500).json({
      success: false,
      status: 500,
      message: "Error in fetching PDs.",
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("userId:", userId);
    const result = await UserService.getUserProfileData(userId);
    res.status(200).json({
      success: true,
      status: 200,
      data: result,
      message: "User profile fetched successfully",
    });
  } catch (error) {
    console.error("Error in getUserProfile controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getUserProfile",
      error_message: `getUserProfile Controller error - ${error.message}.`
    });
    res.status(400).json({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

const processUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profileImage = req.profileImage;
    console.log("Received Data:", { body: req.body, profileImage, userId });
    const result = await UserService.processUserProfile(userId, req.body, profileImage);
    if (!result) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found. No profile created.",
      });
    }
    res.status(200).json({
      success: true,
      status: 200,
      message: result.isNewProfile
        ? "User profile created successfully."
        : "User profile updated successfully.",
      data: result.profile,
    });
  } catch (error) {
    console.error("Error in processUserProfile controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "processUserProfile",
      error_message: `processUserProfile Controller error - ${error.message}.`
    });
    res.status(500).json({
      success: false,
      status: 500,
      message: `Error processing user profile: ${error.message}`,
    });
  }
};

const updateDeviceId = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from token
    const { device_id } = req.body;
    console.log(userId, device_id);
    if (!device_id) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "device_id is required",
      });
    }
    const updatedUser = await UserService.updateUserDeviceId(userId, device_id);
    res.status(200).json({
      success: true,
      status: 200,
      message: "device_id updated successfully",
    });
  } catch (error) {
    console.error("Error in updateDeviceId controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateDeviceId",
      error_message: `updateDeviceId Controller error - ${error.message}.`
    });
    res.status(500).json({
      success: false,
      status: 500,
      message: error.message,
    });
  }
};

const userDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const organisation_id = req.user.organization_id;
    let role = req.user.role[0];
    role = role.split(".")[0];
    const dashboard = await userProfileService.dashboardData(userId, role, organisation_id);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Dashboard details fetched successfully",
      data: dashboard,
    });
  } catch (error) {
    console.error("Error in userDashboard controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "userDashboard",
      error_message: `userDashboard Controller error - ${error.message}.`
    });
    res.status(500).json({
      success: false,
      status: 500,
      message: error.message,
    });
  }
};

const updateUserDetails = async (req, res) => {
  try {
    const userId  = req.user.id; // assuming user_id is from auth middleware
    
    await validateUserProfileUpdate(req.body);

    const { first_name, last_name, email_id } = req.body;

    

    const updatedUser = await UserService.updateProfileDetails(userId, {
      first_name,
      last_name,
      email_id
    });

    return res.status(200).json({
      status:200,
      success: true,
      message: 'User profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.isJoi) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: error.details[0].message,
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        status: 400,
        success: false,
        message: error.errors[0].message,
      });
    }
    if (error.message === 'Email already exists') {
      return res.status(400).json({ status:400,success: false, message: 'Email is already in use' });
    }
    return res.status(500).json({ status:500,success: false, message: 'Internal server error' });
  }
};

const markApplePayPayment = async(req, res) => {
  try {
    const userId = req.user.id;
    const result = await UserService.markApplePayPaymentFailed(userId, req.body);
    res.status(200).json({
      success: true,
      status: 200,
      apple_pay_payment_failed: result.apple_pay_payment_failed,
      message: "Apple pay payment marked successfully",
    });
  } catch (error) {
    console.error("Error in markApplePayPayment controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "markApplePayPayment",
      error_message: `markApplePayPayment Controller error - ${error.message}.`
    });
    res.status(400).json({
      success: false,
      status: 400,
      message: error.message,
    });
  }
}

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  listIndividualCustomers,
  listCorporateCustomers,
  listAllChauffeurs,
  listAllPd,
  getUserProfile,
  processUserProfile,
  updateDeviceId,
  userDashboard,
  updateUserDetails,
  markApplePayPayment
  
};
