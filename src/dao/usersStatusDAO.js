const { User, Status } = require("../dto");
const ddbDocClient = require("./ddbClient");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getDate } = require("../utils/dateUtils");
const userDAO = require("./userDAO");
const { addServerLog } = require("../services/serverLogsService");

module.exports = {
  findUserByIdWithRole: async (userId) => {
    console.log(userId);
    try {
      return await User.findOne({
        where: { id: userId },
        include: ["role", "status"],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findUserByIdWithRole",
        error_message: `findUserByIdWithRole DAO error - ${error.message}.`,
      });
      throw new Error("Error finding user by id with role");
    }
  },

  findStatusByName: async (status_name) => {
    try{
    return await Status.findOne({ where: { name: status_name } });
    }
    catch(error){
      await addServerLog({
        log_level: "ERROR",
        service_name: "findStatusByName",
        error_message: `findStatusByName DAO error - ${error.message}.`,
      });
      throw new Error("Error finding status by name");
    }
  },

  updateUserStatus: async (userId, statusId) => {
    try {
    return await User.update(
      { status_id: statusId },
      { where: { id: userId } }
    );}
    catch(error){
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateUserStatus",
        error_message: `updateUserStatus DAO error - ${error.message}.`,
      });
      throw new Error("Error updating user status");
    }
  },

  // Function to create a new status
  createStatus: async (name) => {
    try {
      return await Status.create(name);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createStatus",
        error_message: `createStatus DAO error - ${error.message}.`,
      });
      throw new Error("Error creating status");
    }
  },

  logUserStatusChange: async (userId, status) => {
    try {
      const today = parseInt(
        new Date().toISOString().split("T")[0].replace(/-/g, ""),
        10
      );
      console.log(
        `Logging status change for user: ${userId}, Status: ${status}, Date: ${today}`
      );
      const now = Date.now(); // current epoch in ms
      const convertedUserId = userId.toString();
  
      // Fetch current record if exists
      let record;
      try {
        const result = await ddbDocClient.send(
          new GetCommand({
            TableName: "UserStatusLogs",
            Key: {
              user_id: convertedUserId,
              timestamp: today,
            },
          })
        );
        record = result.Item; // Might be undefined if it doesn't exist
      } catch (err) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "logUserStatusChange",
          error_message: `logUserStatusChange DAO error - ${err.message}.`,
        });
        console.error("Error getting record from DynamoDB:", err);
        throw err;
      }
  
      // If no record, initialize a new one
      if (!record) {
        record = {
          user_id: convertedUserId,
          timestamp: today,
          totalOnlineMinutes: 0,
          totalOfflineMinutes: 0,
          lastOnlineTimestamp: 0,
          lastOfflineTimestamp: now,
          currentStatus: "Offline",
        };
      }
  
      console.log("Creating or updating record:", record);
  
      // Utility function: returns the available minutes left in the day (max 1440 total)
      const availableMinutesLeft = () =>
        1440 - (record.totalOnlineMinutes + record.totalOfflineMinutes);
  
      // Helper: cap the new duration so that the sum does not exceed 1440
      const capDuration = (newDuration) => Math.min(newDuration, availableMinutesLeft());
  
      // Handling Online Status
      if (status === "Online") {
        if (record.currentStatus === "Online" && record.lastOnlineTimestamp) {
          // User is already online: update the current session
          const onlineDurationMs = now - record.lastOnlineTimestamp;
          let onlineDurationMinutes = Math.floor(onlineDurationMs / 60000);
          onlineDurationMinutes = capDuration(onlineDurationMinutes);
          record.totalOnlineMinutes += onlineDurationMinutes;
        } else {
          // Transitioning from Offline to Online:
          // Update offline duration if applicable
          if (record.lastOfflineTimestamp) {
            const lastOfflineDate = new Date(record.lastOfflineTimestamp)
              .toISOString()
              .split("T")[0];
            const currentDate = new Date(now).toISOString().split("T")[0];
            if (lastOfflineDate === currentDate) {
              const offlineDurationMs = now - record.lastOfflineTimestamp;
              let offlineDurationMinutes = Math.floor(offlineDurationMs / 60000);
              offlineDurationMinutes = capDuration(offlineDurationMinutes);
              record.totalOfflineMinutes += offlineDurationMinutes;
            }
            // If the offline timestamp isn't from today, we ignore past offline time.
          }
        }
        // Set new online timestamp and status
        record.lastOnlineTimestamp = now;
        record.currentStatus = "Online";
  
        try {
          await ddbDocClient.send(
            new PutCommand({
              TableName: "UserStatusLogs",
              Item: record,
            })
          );
        } catch (err) {
          await addServerLog({
            log_level: "ERROR",
            service_name: "logUserStatusChange",
            error_message: `logUserStatusChange DAO error - Error putting record to DynamoDB - ${err.message}.`,
          });
          console.error("Error putting record to DynamoDB:", err);
          throw err;
        }
        console.log(`User ${convertedUserId} is now ONLINE. Timestamp: ${now}`);
        return;
      }
  
      // Handling Offline Status (transition from online to offline)
      if (status === "Offline") {
        if (record.lastOnlineTimestamp) {
          const lastOnlineDate = new Date(record.lastOnlineTimestamp)
            .toISOString()
            .split("T")[0];
          const currentDate = new Date(now).toISOString().split("T")[0];
          if (lastOnlineDate === currentDate) {
            const onlineDurationMs = now - record.lastOnlineTimestamp;
            let onlineDurationMinutes = Math.floor(onlineDurationMs / 60000);
            onlineDurationMinutes = capDuration(onlineDurationMinutes);
            record.totalOnlineMinutes += onlineDurationMinutes;
          }
        }
        // Set new offline timestamp and status
        record.lastOfflineTimestamp = now;
        record.currentStatus = "Offline";
  
        try {
          await ddbDocClient.send(
            new PutCommand({
              TableName: "UserStatusLogs",
              Item: record,
            })
          );
        } catch (err) {
          await addServerLog({
            log_level: "ERROR",
            service_name: "logUserStatusChange",
            error_message: `logUserStatusChange DAO error - Error updating record in DynamoDB - ${err.message}.`,
          });
          console.error("Error updating record in DynamoDB:", err);
          throw err;
        }
        console.log(
          `User ${convertedUserId} is now OFFLINE. Accumulated usage: ${record.totalOnlineMinutes} minutes`
        );
        return;
      }
  
      throw new Error(
        `Invalid status: ${status}. Must be "Online" or "Offline".`
      );
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "logUserStatusChange",
        error_message: `logUserStatusChange DAO error - ${error.message}.`,
      });
      console.error("Error logging user status change:", error);
      throw error;
    }
  },
  
  
  

  getLastSeenOffline: async (userId) => {
    const convertedUserId = userId.toString();
    console.log(`Fetching last seen offline time for user: ${convertedUserId}`);

    // Convert today's date to YYYYMMDD format (integer)
    const today = parseInt(
      new Date().toISOString().split("T")[0].replace(/-/g, ""),
      10
    );

    const queryParams = {
      TableName: "UserStatusLogs",
      KeyConditionExpression: "user_id = :uid",
      FilterExpression: "#st = :offline",
      ExpressionAttributeNames: {
        "#st": "currentStatus", // Alias for reserved word "status"
      },
      ExpressionAttributeValues: {
        ":uid": convertedUserId,
        ":offline": "Offline", // Ensure case matches what's stored in DynamoDB
      },
      ScanIndexForward: false, // Get the most recent offline record first
      Limit: 1,
    };

    try {
      const queryResult = await ddbDocClient.send(
        new QueryCommand(queryParams)
      );
      console.log(
        "Query Result for Last Seen Offline:",
        JSON.stringify(queryResult, null, 2)
      );

      if (queryResult.Items && queryResult.Items.length > 0) {
        const lastOfflineRecord = queryResult.Items[0];
        console.log(
          `User ${convertedUserId} was last seen offline at: ${lastOfflineRecord.lastOfflineTimestamp}`
        );
        return lastOfflineRecord.lastOfflineTimestamp || null;
      } else {
        console.log(`No offline records found for user ${convertedUserId}`);
        return null;
      }
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getLastSeenOffline",
        error_message: `getLastSeenOffline DAO error - ${error.message}.`,
      })
      console.error(
        `Error fetching last seen offline for user ${convertedUserId}:`,
        error
      );
      throw error;
    }
  },

  getUserStatusByDate: async (dateUTC) => {
    try {
      console.log(`Fetching user status for date: ${dateUTC}`);
  
      // Convert "2025-03-17T00:00:00.000Z" -> "2025-03-17" -> 20250317
      const datePart = dateUTC.slice(0, 10);
      const dateNumber = parseInt(datePart.replace(/-/g, ""), 10);
      console.log(`Converted date "${datePart}" to numeric format: ${dateNumber}`);
  
      // Query for all users on this specific date
      const queryParams = {
        TableName: "UserStatusLogs",
        IndexName: "timestamp-index", // Ensure you have a GSI on "timestamp" if needed
        KeyConditionExpression: "#ts = :startOfDay",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: { ":startOfDay": dateNumber },
        ProjectionExpression: "user_id, totalOnlineMinutes, totalOfflineMinutes", // Fetch only required fields
      };
  
      const queryResult = await ddbDocClient.send(new QueryCommand(queryParams));
  
      if (!queryResult.Items || queryResult.Items.length === 0) {
        console.log(`No records found for date: ${dateNumber}`);
        return []; // Return empty array if no records
      }
  
      // Function to format minutes as "HH:MM"
      const formatDuration = (totalMinutes) => {
        if (!totalMinutes || totalMinutes <= 0) return "00:00";
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      };
  
      // Aggregate total minutes for each user
      const aggregatedData = queryResult.Items.map((item) => {
        const onlineMinutes = Math.min(item.totalOnlineMinutes || 0, 1440); // Cap at 24h
        const offlineMinutes = Math.min(item.totalOfflineMinutes || 0, 1440); // Cap at 24h
  
        return {
          user_id: item.user_id,
          date_utc: dateUTC, // Echo back the original UTC string
          online_duration: formatDuration(onlineMinutes), // Show in "HH:MM" format
          offline_duration: formatDuration(offlineMinutes),
        };
      });
  
      return aggregatedData;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getUserStatusByDate",
        error_message: `getUserStatusByDate DAO error - ${error.message}.`,
      });
      console.error("Error fetching user status by date:", error);
      throw error;
    }
  },

  getStatusesByName : async (names = []) => {
    return await Status.findAll({
      where: { name: names },
      attributes: ["id", "name"],
     
    });
  },

};
