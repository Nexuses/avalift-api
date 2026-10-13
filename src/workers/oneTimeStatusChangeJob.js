// cronMinute.js
require('dotenv').config();
const cron = require('node-cron');
const { fetchReviewPendingRides, autoUpdateReviewForRides, fetchAllRides } = require('../helpers/ridesHelper');

const sourceStatus = "Review-Pending";

async function executeStatusChangeTask() {
    console.log('One Time Status Change Job Started');
    //fetch the review pending Rides
    console.log('Fetching All Rides details');
    const allRides = await fetchAllRides();
    console.log(`Length of All Rides fetched ${allRides?.length}`);
    // await Promise.all()


    await Promise.all(allRides.map(async (ride) => {
        console.log(`Fetched Ride ${ride.ride_id} and Status is ${ride.status}`);
        //check for the ride status whether it is matching with the source Status value
        if (ride.status.trim() === sourceStatus) {
            //Promise.all(ride.status_log.map(async (s) => {
            //check whether the status log status is matching with the source Status value
            //if (s.status.trim() === sourceStatus) {
            console.log(`Fetched Ride ${ride.ride_id} for Status Change`);
            //update the status to completed and add review record
            await autoUpdateReviewForRides(ride);
            console.log('Status change completed successfully.');
            //}
            //}));
        }
    }));
    console.log('One Time Status Change Job Completed');
};

executeStatusChangeTask();