const express = require("express");
const router = express.Router();
const roleController = require('../controllers/adminController');
const authenticate = require('../middlewares/authMiddleware');
router.use(authenticate);

router.post('/roles-create', roleController.createRole);

router.post('/policies-create', roleController.createPolicy);

router.put('/:roleId/policies-add', roleController.associatePoliciesToRole);

router.delete('/:roleId/policies-delete', roleController.deassociatePoliciesFromRole);
    

module.exports = router;