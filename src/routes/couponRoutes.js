const express = require('express');
const router = express.Router();
const {
  createCouponController,
  updateCouponController,
  deleteCouponController,
  getApplicableCoupons,
  getAllCouponsController,
  getCouponByIdController
} = require('../controllers/couponController');
const userGroupController = require('../controllers/userGroupController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize'); 

router.use(authenticate);

// Coupon routes
router.post('/create-coupons', authorize('coupons.create'), createCouponController); // Only users with 'coupons.create' permission can create coupons
router.put('/update-coupons/:id', authorize('coupons.update'), updateCouponController); // Only users with 'coupons.update' permission can update coupons
router.delete('/delete-coupons/:id', authorize('coupons.delete'), deleteCouponController); // Only users with 'coupons.delete' permission can delete coupons

// For Customer
router.get('/applicable', authorize('coupons.view'), getApplicableCoupons); // Only users with 'coupons.view' permission can view applicable coupons
router.get('/view-all', authorize('coupons.view'), getAllCouponsController); // Only users with 'coupons.view' permission can view all coupons
router.get('/:id', authorize('coupons.view'), getCouponByIdController); // Only users with 'coupons.view' permission can view a coupon by ID

// Group routes
router.post('/groups/add', authorize('userGroups.create'), userGroupController.createUserGroupController); // Only users with 'userGroups.create' permission can add a user group
router.get('/groups/view', authorize('userGroups.view'), userGroupController.getAllUserGroupsController); // Only users with 'userGroups.view' permission can view user groups
router.put('/groups/edit', authorize('userGroups.update'), userGroupController.updateUserGroupController); // Only users with 'userGroups.update' permission can update a user group
router.delete('/groups/delete', authorize('userGroups.delete'), userGroupController.deleteUserGroupController); // Only users with 'userGroups.delete' permission can delete a user group

// Membership routes
router.post('/groups/members/add', authorize('userGroups.addMember'), userGroupController.addUserToGroupController); // Only users with 'userGroups.addMember' permission can add members to a group
router.post('/groups/members/view', authorize('userGroups.viewMembers'), userGroupController.getMembersController); // Only users with 'userGroups.viewMembers' permission can view members of a group
router.put('/groups/members/edit', authorize('userGroups.updateMember'), userGroupController.updateMemberController); // Only users with 'userGroups.updateMember' permission can update a group member
router.delete('/groups/members/delete', authorize('userGroups.removeMember'), userGroupController.removeMemberController); // Only users with 'userGroups.removeMember' permission can remove a member from a group

module.exports = router;
