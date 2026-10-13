require("dotenv").config();
const userDAO = require("../dao/userDAO");
const admin = require("firebase-admin");
const notificationDOA = require("../dao/notificationDOA");


// Utility: split array into chunks
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function sendBulkNotification(title, message, userType) {
  try {
    console.log(`🔔 Fetching users...`);
    const users = (await userDAO.findAllIndividualUsersByRole(userType)) || [];

    if (users.length === 0) {
      console.log("⚠️ No users found to notify.");
      return { successCount: 0, failureCount: 0 };
    }

    const userIds = users.map((u) => u.id);
    const deviceMappings = await userDAO.findDeviceIdsForUsers(userIds);

    const tokens = deviceMappings
      .map((d) => d.device_id)
      .filter((token) => !!token);

    if (tokens.length === 0) {
      console.log("⚠️ No device tokens found.");
      return { successCount: 0, failureCount: 0 };
    }

    const tokenBatches = chunkArray(tokens, 500);
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < tokenBatches.length; i++) {
      const messagePayload = {
        notification: { title, body: message },
        tokens: tokenBatches[i],
      };

      const response = await admin.messaging().sendEachForMulticast(messagePayload);

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      // Optional: collect failed tokens for cleanup/logging
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `❌ Token ${tokenBatches[i][idx]} failed: ${resp.error.message}`
          );
        }
      });
    }

      await notificationDOA.saveBulkNotificationDetails(title, message, userType, totalSuccess, totalFailure);

    console.log(`🎉 Finished sending bulk notification: "${title}"`);
    return { successCount: totalSuccess, failureCount: totalFailure };

  } catch (error) {
    console.error(`⚠️ Error in bulk notification: ${error.message}`);
    return { successCount: 0, failureCount: 0, error: error.message };
  }
}


// Run once
// (async () => {
//   await sendBulkNotification(title, message, userType);
//   process.exit(0);
// })();

module.exports = {
  sendBulkNotification,
};
