// src/routes/index.js

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const vehicleRoutes = require('./vehicleRoutes');
const rideRoutes = require('./rideRoutes');
const ridesRoutes = require('./ridesRoutes')
const roleRoutes = require('./roleRoutes');
const adminRoutes = require('./adminRoutes');
const savedLocationRoutes = require('./savedLocationsRoutes');
const userProfileRoutes = require('./userProfilesRoutes');
const userstatusRoutes = require('./usersStatusRoutes');
const userlocationRoutes = require('./locationRoutes');
const locationRoutes = require('./locationRoutes');
const userRoutes = require('./userRoutes');
const paymentRoutes = require('./paymentRoutes');
const chauffeurRoutes = require('./chauffeurRoutes');
const couponRoutes = require('./couponRoutes');
const pdRoutes = require('./pdRoutes');
const organizationRoutes = require('./organizationRoutes');
const { or } = require('sequelize');


router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/rides', ridesRoutes);
router.use('/location', locationRoutes);
router.use('/chauffeur', chauffeurRoutes);
router.use('/user', userstatusRoutes);
router.use('/location', savedLocationRoutes);
router.use('/vehicle', vehicleRoutes);
router.use('/ride', rideRoutes);
router.use('/', userProfileRoutes);
router.use('/user', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/pd',pdRoutes);
router.use('/organization',organizationRoutes);
router.use('/roles',roleRoutes);

module.exports = router;
