const notificationQueue = require("./queues/notificationQueue");

async function checkQueueStatus() {
    try {
        const waiting = await notificationQueue.getWaiting();
        const active = await notificationQueue.getActive();
        const failed = await notificationQueue.getFailed();
        const completed = await notificationQueue.getCompleted();
        const delayed = await notificationQueue.getDelayed();
        const stalled = await notificationQueue.getJobs(["stalled"]);  // ✅ Correct method

        console.log("\n📌 Queue Status Check:");
        console.log(`🔵 Waiting Jobs: ${waiting.length}`);
        console.log(`🟡 Active Jobs: ${active.length}`);
        console.log(`🔴 Failed Jobs: ${failed.length}`);
        console.log(`✅ Completed Jobs: ${completed.length}`);
        console.log(`⏳ Delayed Jobs: ${delayed.length}`);
        console.log(`🚨 Stalled Jobs: ${stalled.length}\n`);

        if (failed.length > 0) {
            console.log("❌ Failed Jobs Details:");
            failed.forEach(job => {
                console.log(`- Job ID: ${job.id}, Error: ${job.failedReason}`);
            });
        }

        if (stalled.length > 0) {
            console.log("⚠️ Stalled Jobs Found! Consider restarting the worker.");
        }

        process.exit(0);
    } catch (error) {
        console.error("⚠️ Error checking queue status:", error);
        process.exit(1);
    }
}

checkQueueStatus();
