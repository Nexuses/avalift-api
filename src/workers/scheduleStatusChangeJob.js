// cronMinute.js
require('dotenv').config();
const cron = require('node-cron');
const { fetchReviewPendingRides, autoUpdateReviewForRides } = require('../helpers/ridesHelper');

const schedule = process.env.CRON_SCHEDULE_STATUS_CHANGE;
console.log('CRON_SCHEDULE_STATUS_CHANGE', schedule);
const sourceStatus = "Review-Pending";
const applePayStatus = "Apple-Pay-Payment-Completed";

// // This runs every minute
cron.schedule(schedule, async () => {
    try {
        console.log(`Scheduled Status Change Job Started at ${new Date()}`);
        await executeStatusChangeTask();
        console.log(`Scheduled Status Change Job Completed at ${new Date()}`);
        return;
    } catch (error) {
        console.log(`Error occurred while processing review status changes ${error.message}`);
    }
});


async function executeStatusChangeTask() {
    //fetch the review pending Rides
    console.log('Fetching Review Pending Rides details');
    const reviewPendingRides = await fetchReviewPendingRides();
    console.log(`Length of Review Pending Rides fetched ${reviewPendingRides?.length}`);
    await Promise.all(reviewPendingRides.map(async (ride) => {
        //15 mts
        const cutofftime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        //check for the ride status whether it is matching with the source Status value
        if (ride.status.trim() === sourceStatus || ride.status.trim() === applePayStatus) {
            console.log(`Fetched Ride ${ride.ride_id} and Status is ${ride.status}`);

            Promise.all(ride.status_log.map(async (s) => {
                //check whether the status log status is matching with the source Status value
                if (s.status.trim() === sourceStatus || s.status.trim() === applePayStatus) {
                    console.log('ride status_log data', s);
                    //console.log('ride status is', ride.status.trim());
                    const reviewMinutes = Math.floor((new Date(cutofftime) - new Date(s.datetime)) / 60000);

                    console.log('Difference in Review Minutes', reviewMinutes);
                    if (reviewMinutes > 0) {
                        console.log(`Ride ${ride.ride_id} is eligible for auto update as it is more than 15 minutes old.`);
                        await autoUpdateReviewForRides(ride);
                    } else {
                        console.log(`Ride ${ride.ride_id} is not eligible for auto update as it is within the review time limit.`);
                    }
                } else {
                    console.log(`Ride ${ride.ride_id} is not eligible for auto update as it is within the review time limit.`);
                }
            }));
        }
    }));
}