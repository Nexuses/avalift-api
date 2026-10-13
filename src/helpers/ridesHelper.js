const ddbDocClient = require("../dao/ddbClient");
const { PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require("../services/serverLogsService");
const { v4: uuidv4 } = require("uuid");
const erpQueue = require("../queues/erpQueue");

//fetch review pending rides
const fetchReviewPendingRides = async () => {
  try {
    const statuses = ["Review-Pending", "Apple-Pay-Payment-Completed"];
    let allItems = [];

    for (const status of statuses) {
      const queryParams = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":statusValue": status
        }
      };

      const data = await ddbDocClient.send(new QueryCommand(queryParams));
      allItems = [...allItems, ...(data.Items || [])];
    }

    return allItems;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchReviewAndApplePayRides",
      error_message: `Helper error - ${error.message}.`
    });
    throw error;
  }
};


//update review pending status to completed - auto update
const autoUpdateReviewForRides = async (rideInfo) => {

     if (rideInfo.status?.trim() === 'Completed') {
        console.log(`Ride ${rideInfo.ride_id} already completed. Skipping.`);
        return;
    }

    let statusInfo = {};
    statusInfo.status_log = rideInfo.status_log;
    statusInfo.status_log.push({
        datetime: new Date().toISOString(),
        status: "Completed",
    });

    try {
        //auto complete the review-pending rides
        const PK = `${rideInfo.PK}`;
        const SK = `#${rideInfo.ride_id}`;
        const params = {
            TableName: "Rides",
            Key: { PK, SK },
            UpdateExpression: `SET #attrName = :statusVal,
                status_log = :statusLogVal`,
            ExpressionAttributeNames: {
                "#attrName": "status"
            },
            ExpressionAttributeValues: {
                ":statusVal": "Completed",
                ":statusLogVal": statusInfo.status_log
            },
            ReturnValues: "UPDATED_NEW"
        };

        const command = new UpdateCommand(params);
        const response = await ddbDocClient.send(command);
        console.log(`Rides response processed successfully for Ride Id ${rideInfo.ride_id}`);

        //if ride status changed to completed, add review record
        if (response.$metadata.httpStatusCode === 200) {
            const paramsNew = {
                TableName: "Reviews",
                Item: {
                    ride_id: `REVIEW#${rideInfo.ride_id}`,
                    reviewer_id: `${rideInfo.ride_id}#${rideInfo.customer_id}`,
                    comment: "auto completed",
                    rating: 0,
                    reviewee_id: `${rideInfo.chauffeur_id}`,
                    review_id: uuidv4(),
                    timestamp: new Date().toISOString()
                },
            };

            try {
                const command = new PutCommand(paramsNew);
                const result = await ddbDocClient.send(command);
                console.log(`Review response processed successfully for Ride id ${rideInfo.ride_id}`);
                if (result.$metadata.httpStatusCode === 200) {
                    console.log(`Auto Complete Record added successfully for Ride id ${rideInfo.ride_id}`);
                    await addServerLog({
                        log_level: "INFO",
                        error_message: `Record added successfully.`,
                    });
                }

            } catch (err) {
                console.error("Failed to add item:", err);
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "autoUpdateReviewForRides",
                    error_message: `autoUpdateReviewForRides Helper Review Record add error - ${err.message}.`
                });
            }
        } else {
            console.log(`Failed to process Rides status update for ride ${$metadata.httpStatusCode}`);
            await addServerLog({
                log_level: "ERROR",
                service_name: "autoUpdateReviewForRides",
                error_message: `autoUpdateReviewForRides Helper Rides Status update error - ${$metadata.httpStatusCode}.`
            });
        }
        // add erp sync job to queue
         await erpQueue.add(
            {
                rideId: rideInfo.ride_id,
                source: 'AUTO_REVIEW_CRON'
            },
            {
                jobId: `erp-${rideInfo.ride_id}`
            }
        );

        console.log(`ERP job queued for Ride ${rideInfo.ride_id}`);
    } catch (error) {
        console.log(`Rides failed to process Auto status update - ${error}`);
        await addServerLog({
            log_level: "ERROR",
            service_name: "autoUpdateReviewForRides",
            error_message: `autoUpdateReviewForRides Helper error - ${error.message}.`
        });
    }
}

//fetch review pending rides
const fetchAllRides = async () => {
    const queryParams = {
        TableName: "Rides",
        IndexName: "all_rides_pk-index",
        KeyConditionExpression: "all_rides_pk = :pk",
        //FilterExpression: "#ride_id = :ride_id",
        // ExpressionAttributeNames: {
        //     "#status": "status"
        // },
        ExpressionAttributeValues: {
            ":pk": "All Rides",
            //":ride_id": "0001065",
            // ":reviewPendingAlt": "Review-Pending "
        }
    };
    try {
        const data = await ddbDocClient
            .send(new QueryCommand(queryParams));
        return data.Items;
    } catch (error) {
        console.error("Error fetching rides:", error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "fetchAllRides",
            error_message: `fetchAllRides Helper error - ${error.message}.`
        });
        throw error;
    }
};


module.exports = {
    fetchReviewPendingRides,
    autoUpdateReviewForRides,
    fetchAllRides
};
