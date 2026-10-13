const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { addServerLog } = require("./serverLogsService");

// Ensure the uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../uploads");
const CAR_IMAGE_DIR = path.join(UPLOADS_DIR, "carimage");
(async () => {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CAR_IMAGE_DIR, { recursive: true });
    console.log("Uploads directory ensured.");
  } catch (err) {
    console.error("Error ensuring uploads directory:", err);
    addServerLog({
      log_level: "ERROR",
      service_name: "uploadsDirectorySetup",
      error_message: `uploadsDirectorySetup error - ${err.message}.`
    }).catch((error) => console.error("Error logging server log:", error));
  }
})();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const carImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CAR_IMAGE_DIR); // Store car images separately
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Invalid file type. Only PNG, JPEG, and PDF are allowed.");
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
}).array("documents"); // Allow multiple files under the "documents" field

const uploadSingleFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
}).single("profileImage"); // For single profile image

const uploads = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
}).single("brand_image"); // Accept a single file under the field name "brand_image"

const uploadCarImages = multer({
  storage: carImageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("carImages", 4); // Allow up to 4 images

// Middleware function for brand image upload
const uploadBrandImageMiddleware = (req, res, next) => {
  uploads(req, res, (err) => {
    if (err) {
      console.error("Error during file upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadBrandImageMiddleware",
        error_message: `uploadBrandImageMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "Brand image upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Brand image is required." });
    }

    // Attach file path to the request for further processing
    req.brand_image = path.relative(process.cwd(), req.file.path);
    next();
  });
};

// Middleware to handle file uploads and format document details
const uploadDocumentsMiddleware = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Error during file upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadDocumentsMiddleware",
        error_message: `uploadDocumentsMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed.",
      });
    }

    try {
      // Format documents for both DynamoDB and response
      req.documentsPath = req.files.map((file) => ({
        name: file.originalname,
        path: path.join("uploads", path.basename(file.path)), // Save relative path
      }));

      req.documentDetails = await Promise.all(
        req.files.map(async (file) => {
          const fileBuffer = await fs.readFile(file.path);
          const base64Content = fileBuffer.toString("base64");
          return {
            name: file.originalname,
            value: base64Content, // Include Base64 for response
          };
        })
      );

      next(); // Proceed to the next middleware or controller
    } catch (error) {
      console.error("Error processing uploaded files:", error);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadDocumentsMiddleware",
        error_message: `uploadDocumentsMiddleware processing error - ${error.message}.`
      }).catch((err) => console.error("Error logging server log:", err));
      return res.status(500).json({
        success: false,
        message: "Error processing uploaded files.",
      });
    }
  });
};

const uploadProfileImageMiddleware =async (req, res, next) => {
  uploadSingleFile(req, res,async (err) => {
    if (err) {
      console.error("Error during profile image upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadProfileImageMiddleware",
        error_message: `uploadProfileImageMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "Profile image upload failed.",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No profile image uploaded.",
        });
      }

      if (req.profileImage) {
        await UserProfileDAO.updateUserProfile(
          userId,
          profileImage,
          updatedDocuments
        );
        console.log(`Profile image updated for user ${userId}`);
      }

      // Store only the relative path
      req.profileImage = {
        name: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
      };

      next();
    } catch (error) {
      console.error("Error processing profile image upload:", error);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadProfileImageMiddleware",
        error_message: `uploadProfileImageMiddleware processing error - ${error.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(500).json({
        success: false,
        message: "Error processing profile image upload.",
      });
    }
  });
};

// Middleware for car image uploads
const uploadCarImagesMiddleware = (req, res, next) => {
  uploadCarImages(req, res, (err) => {
    if (err) {
      console.error("Error during car images upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadCarImagesMiddleware",
        error_message: `uploadCarImagesMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "Car images upload failed.",
      });
    }
    try {
      if (!req.files || req.files.length === 0) {
        req.carImages = []; // Allow empty array when no images are uploaded
        return next(); // Proceed without error
      }
      req.carImages = req.files.map((file) => ({
        name: file.originalname,
        path: path.join("uploads/carimage", path.basename(file.path)),
      }));
      next();
    } catch (error) {
      console.error("Error processing car images upload:", error);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadCarImagesMiddleware",
        error_message: `uploadCarImagesMiddleware processing error - ${error.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(500).json({
        success: false,
        message: "Error processing car images upload.",
      });
    }
  });
};

const uploadImage = (folderName, fieldName, maxCount) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../uploads", folderName);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  }).array(fieldName, maxCount);
};

const uploadAfterRideImagesMiddleware = (req, res, next) => {
  uploadImage("afterRideImages", "afterRide", 10)(req, res, (err) => {
    if (err) {
      console.error("Error during after-ride image upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadAfterRideImagesMiddleware",
        error_message: `uploadAfterRideImagesMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "After-ride image upload failed.",
      });
    }

    if (!req.files || req.files.length < 6) {
      return res.status(400).json({
        success: false,
        message: "At least six after-ride images are required."
      });
    }

    // Attach file paths to the request for further processing
    req.afterRideImages = req.files.map((file) =>
      path.relative(process.cwd(), file.path)
    );

    next();
  });
};

const uploadBeforeRideImagesMiddleware = (req, res, next) => {
  uploadImage("beforeRideImages", "beforeRide", 10)(req, res, (err) => {
    if (err) {
      console.error("Error during before-ride image upload:", err);
      addServerLog({
        log_level: "ERROR",
        service_name: "uploadBeforeRideImagesMiddleware",
        error_message: `uploadBeforeRideImagesMiddleware error - ${err.message}.`
      }).catch((error) => console.error("Error logging server log:", error));
      return res.status(400).json({
        success: false,
        message: err.message || "Before-ride image upload failed.",
      });
    }

    // Attach file paths to the request for further processing
    req.beforeRideImages = req.files.map((file) =>
      path.relative(process.cwd(), file.path)
    );

    next();
  });
};

module.exports = { 
  uploadDocumentsMiddleware,
  uploadProfileImageMiddleware, 
  uploadBrandImageMiddleware,
  uploadCarImagesMiddleware, 
  uploadAfterRideImagesMiddleware, 
  uploadBeforeRideImagesMiddleware 
};
