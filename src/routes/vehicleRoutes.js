const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const vehicleMasterController = require('../controllers/vehicleMasterController');
const authenticate = require("../middlewares/authMiddleware");
const authorize = require('../middlewares/authorize');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(authenticate);

// Define routes with permissions
router.post('/create-vehicles', authenticate, authorize('vehicles.create'), upload.array("media_data", 1), vehicleController.createVehicle);
router.put('/update-vehicle/:id', authenticate, authorize('vehicles.update'), upload.array("media_data", 1), vehicleController.updateVehicle);
router.delete('/:id', authenticate, authorize('vehicles.delete'), vehicleController.deleteVehicle);

router.get('/models/:brand', authenticate, authorize('vehicles.view'), vehicleMasterController.getModelsByBrand);
router.get('/brands', authenticate, authorize('vehicles.view'), vehicleMasterController.getAllBrands);
router.post("/add-model", authenticate, authorize('vehicles.create'), vehicleMasterController.addModelToBrand);
router.post('/vehicles/:page/:limit', authenticate, authorize('vehicles.view'), vehicleController.getAllVehicles);
router.get('/get-vehicles', authenticate, vehicleController.getAllVehiclesOfUser);
router.post('/brand', authenticate, authorize('vehicles.create'), vehicleMasterController.createBrand);
router.get("/all-brands-models", authenticate, authorize('vehicles.view'), vehicleMasterController.listBrandsAndModels);

router.post('/get-vehicle-by-id/:customer_id', authenticate, authorize('vehicles.view'), vehicleController.getVehiclesbyId);
router.get("/get-all-vehicle-by-organisation-id/:organization_id", authenticate, authorize('vehicles.view'), vehicleController.getVehiclesByOrganizationId);

router.put('/update-brand', authenticate, authorize('vehicles.update'), vehicleMasterController.updateBrand);
router.put('/update-model', authenticate, authorize('vehicles.update'), vehicleMasterController.updateModel);

router.delete("/brand/delete-brand", authenticate, vehicleMasterController.deleteBrand);
router.delete("/admin/delete-model", authenticate, vehicleMasterController.deleteModelFromBrand);

module.exports = router;
