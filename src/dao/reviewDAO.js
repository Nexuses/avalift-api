const ddbDocClient = require("./ddbClient");
const { PutCommand, QueryCommand ,ScanCommand} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  findReview: async (ride_id, reviewer_id) => {
    console.log(
      `Finding review for ride_id: ${ride_id}, reviewer_id: ${reviewer_id}- DAO`
    );

    const params = {
      TableName: "Reviews",
      KeyConditionExpression:
        "ride_id = :ride_id AND reviewer_id = :reviewer_id",
      ExpressionAttributeValues: {
        ":ride_id": `REVIEW#${ride_id}`, 
        ":reviewer_id": `${ride_id}#${reviewer_id}`, 
      },
    };

    try {
      const data = await ddbDocClient.send(new QueryCommand(params));
      return data.Items.length > 0 ? data.Items[0] : null;
    } catch (error) {
      console.error("Error fetching review:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "findReview",
        error_message: `findReview DAO error - ${error.message}.`,
      });
      throw new Error("Database error: Unable to fetch review.");
    }
  },

  addReview: async ({ ride_id, reviewer_id, reviewee_id, rating, comment }) => {
    const review_id = uuidv4();

    const params = {
      TableName: "Reviews",
      Item: {
        ride_id: `REVIEW#${ride_id}`,
        reviewer_id: `${ride_id}#${reviewer_id.toString()}`,
        review_id,
        reviewee_id: reviewee_id.toString(),
        rating,
        comment: comment === null ? null : comment,
        timestamp: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(reviewer_id)", // Prevents duplicate reviews
    };

    try {
      await ddbDocClient.send(new PutCommand(params));
      console.log(`Review added successfully for ride: ${ride_id}, reviewer: ${reviewer_id}`);
      return params.Item;
    } catch (error) {
      console.error("Error adding review:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addReview",
        error_message: `addReview DAO error - ${error.message}.`,
      });
      if (error.name === "ConditionalCheckFailedException") {
        throw new Error(`Review by reviewer "${reviewer_id}" for ride "${ride_id}" already exists.`);
      }
      throw new Error(`Failed to add review: ${error.message}`);
    }
  },

  getAverageRating: async (revieweeId) => {
    const roundToNearestHalf = (num) => (Math.round(num * 2) / 2).toString();
    const convertedId = revieweeId.toString();

    const params = {
      TableName: "Reviews", 
      IndexName: "reviewee_id_index", 
      KeyConditionExpression: "reviewee_id = :revieweeId",
      ExpressionAttributeValues: {
        ":revieweeId": convertedId
      }
    };

    try {
      const result = await ddbDocClient.send(new QueryCommand(params));
      const reviews = result.Items;

      if (!reviews || reviews.length === 0) {
        return "0"; // No ratings found
      }

      const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      const averageRating = totalRating / reviews.length;
      console.log("average rating", averageRating);
      console.log("total rating", totalRating);

      return roundToNearestHalf(averageRating);
    } catch (error) {
      console.error("Error fetching ratings:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAverageRating",
        error_message: `getAverageRating DAO error - ${error.message}.`,
      });
      throw new Error("Could not fetch ratings");
    }
  },

  
getReviewsByChauffeurId: async (chauffeurId) => {
  const params = {
    TableName: "Reviews",
    IndexName: "reviewee_id_index",
    KeyConditionExpression: "reviewee_id = :rid",
    ExpressionAttributeValues: {
      ":rid": chauffeurId, // ✅ Just value, no { S: ... } because you're using DocumentClient
    },
    ScanIndexForward: false, // Sort descending
  };

  try {
    const command = new QueryCommand(params); // ✅ This is correct now
    const data = await ddbDocClient.send(command);
    return data.Items || [];
  } catch (error) {
    throw new Error(`DynamoDB query failed: ${error.message}`);
  }
}
};
