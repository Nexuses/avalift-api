const express = require("express");
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize'); // Import the authorization middleware
const organizationController = require("../controllers/organizationController");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
//router.use(authenticate);

// Create Organization - Only users with 'organizations.create' permission
router.post("/create-organization", authenticate, authorize('organizations.create'), upload.single("logo"), organizationController.createOrganization);


// Get All Organizations - Only users with 'organizations.view' permission
router.get("/all-organizations", authenticate, authorize('organizations.view'), organizationController.getAllOrganizations);

// Update Organization - Only users with 'organizations.update' permission
router.put("/:id", authenticate, authorize('organizations.update'), upload.single("logo"),  organizationController.updateOrganization);

// Create Organization Admin - Only users with 'organizations.createAdmin' permission
router.post('/create-org-admin', authenticate, authorize('organizations.createAdmin'), organizationController.createOrgAdmin);

// Update Organization Admin - Only users with 'organizations.updateAdmin' permission
router.put('/update-org-admin/:adminId', authenticate, authorize('organizations.updateAdmin'), organizationController.updateOrgAdmin);

// Get All Users in Organization - Only users with 'organizations.viewUsers' permission
router.post('/all-users-organizations', authenticate, authorize('organizations.viewUsers'), organizationController.getAllUsersOrganizations);

// DELETE Organization - Only users with 'organizations.delete' permission
router.delete('/delete-organization/:id', authenticate, authorize('organizations.delete'), organizationController.deleteOrganization);

// active,inactive status update 
router.patch('/organization-status', authenticate, organizationController.OrganizationStatusUpdate);


module.exports = router;