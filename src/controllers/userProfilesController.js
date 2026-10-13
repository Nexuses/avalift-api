const userProfileService = require("../services/userProfilesService");
const Busboy = require("busboy");
require("dotenv").config();
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

/**
 * Controller to handle the creation of a user profile.
 * @param {object} req - The request object containing the user data.
 * @param {object} res - The response object used to send a response.
 */
const createUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { documents } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "User ID is missing.",
    });
  }

  // Validate the documents field
  if (!Array.isArray(documents)) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Documents should be an array of objects.",
    });
  }

  try {
    // Call service to create the profile
    const createdProfile = await userProfileService.createProfile(
      userId,
      documents
    );

    // Send response
    return res.status(201).json({
      success: true,
      status: 201,
      message: "User profile created successfully",
      data: createdProfile,
    });
  } catch (error) {
    console.error("Error in createUserProfile controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserProfile",
      error_message: `createUserProfile Controller error - ${error.message}.`,
    });
    return res.status(500).json({
      success: false,
      status: 500,
      error: error.message,
    });
  }
};

const uploadProfileImageController = (req, res) => {
  try {
    const userId = req.user.id;
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let fileMimeType = null;
    let fileName = null;

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      console.log("filename raw value:", filename);
      fileName = filename.filename;
      fileMimeType = filename.mimeType;
      console.log("fileName:", fileName);
      console.log("fileMimeType:", fileMimeType);

      const buffers = [];
      file.on("data", (data) => {
        buffers.push(data);
      });

      file.on("end", () => {
        fileBuffer = Buffer.concat(buffers);
      });
    });

    busboy.on("finish", async () => {
      if (!fileBuffer) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
      }

      try {
        // Call the service to handle the upload + DB update
        const response = await userProfileService.saveProfileImage({
          userId,
          fileBuffer,
          fileName,
          fileMimeType,
        });

        return res.status(200).json({
          success: true,
          status: 200,
          message: "Profile image uploaded successfully.",
          images: response.imageUrl,
          createdAt: response.createdAt,
        });
      } catch (error) {
        console.error("Error in uploadProfileImageController (inner):", error);
        await addServerLog({
          log_level: "ERROR",
          service_name: "uploadProfileImageController",
          error_message: `uploadProfileImageController inner error - ${error.message}.`,
        });
        return res.status(500).json({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    console.error("Error in uploadProfileImageController (outer):", error);
    addServerLog({
      log_level: "ERROR",
      service_name: "uploadProfileImageController",
      error_message: `uploadProfileImageController outer error - ${error.message}.`,
    });
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};

const removeProfileImageController = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await userProfileService.removeProfileImage({ userId });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Profile image removed successfully.",
      deletedImage: result.deletedImage,
    });
  } catch (error) {
    console.error("Error in removeProfileImageController:", error.message);

    // Custom error handling based on message
    if (error.message === "User not found.") {
      return res.status(404).json({
        status:404,
        success: false,
        message: "User not found.",
      });
    }

    if (error.message === "No profile image to remove.") {
      return res.status(400).json({
        status:400,
        success: false,
        message: "No profile image found to delete.",
      });
    }

    // Fallback for unknown errors
    await addServerLog({
      log_level: "ERROR",
      service_name: "removeProfileImageController",
      error_message: `removeProfileImageController error - ${error.message}`,
    });

    return res.status(500).json({
      status:500,
      success: false,
      message: "Internal Server Error.",
    });
  }
};



module.exports = {
  createUserProfile,
  uploadProfileImageController,
  removeProfileImageController
};
