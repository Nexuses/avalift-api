const reviewService = require("../services/userReviewService");
const reviewValidator = require("../validators/userReviewValidator");
const { addServerLog } = require("../services/serverLogsService"); 

module.exports = {
  // Add a new review
  addReview: async (req, res) => {
    try {
      const reviewer_id = req.user.id;
      // Validate request payload
      const reviewData = await reviewValidator.validateReview(req.body);

      // Convert reviewer_id and reviewee_id to strings
      reviewData.reviewer_id = reviewer_id.toString();
      reviewData.reviewee_id = reviewData.reviewee_id.toString();

      // Call service to add review
      await reviewService.addReview(reviewData);

      res.status(201).json({
        success: true,
        status: 201,
        message: "Review added successfully",
        data: [],
      });
    } catch (error) {
      console.error("Error in addReview controller:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addReview",
        error_message: `addReview Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to add review",
        error: error.message,
      });
    }
  },
};
