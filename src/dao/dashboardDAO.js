const { Payments, User, CustomerWalletLog, UserCommission, Status } = require("../dto");  // Import models
const { Op, fn, col, literal } = require("sequelize");
const { addServerLog } = require("../services/serverLogsService");
const ddbDocClient = require("./ddbClient");
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

async function fetchRevenueByChauffeur(user_id) {
  try {
    // Fetch revenue for each chauffeur from Payments
    const paymentResults = await Payments.findAll({
      attributes: [
        [fn("SUM", col("amount_to_be_paid")), "total_revenue"],
        [fn("SUM", col("discount_amount")),"total_discount"]
      ],
      where: {
        is_paid: true,
        chauffeur_id: String(user_id)
      },
      raw: true
    });

    const walletPayments = await CustomerWalletLog.findAll({
        attributes: [
            [fn("SUM",col("amount_to_be_paid")),"total_wallet_revenue"],
            [fn("SUM", col("discount_amount")),"total_wallet_discount"],
            [fn("SUM",col("adjusted_ride_amount")),"total_adjusted_ride_amount"]
        ],
        where: {
            is_paid:true,
            chauffeur_id:String(user_id)
        },
        raw: true
    });

    // Extract values safely
    const totalRevenue = parseFloat(paymentResults[0]?.total_revenue || 0);
    const totalDiscount = parseFloat(paymentResults[0]?.total_discount || 0);
    const totalWalletRevenue = parseFloat(walletPayments[0]?.total_wallet_revenue || 0);
    const totalWalletDiscount = parseFloat(walletPayments[0]?.total_wallet_discount || 0);
    const totalAdjustedRideAmount = parseFloat(walletPayments[0]?.total_adjusted_ride_amount || 0);

    // Calculate the total revenue
    const total = totalRevenue + totalWalletRevenue + totalDiscount + totalWalletDiscount - totalAdjustedRideAmount;

    return total.toFixed(2);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRevenueByChauffeur",
      error_message: `fetchRevenueByChauffeurDAOerror - ${error.message}.`
    });
    console.error("Error fetching revenue by chauffeur:", error);
    throw error;
  }
};

// async function fetchRevenue(rideIds, organizationId, start_date=null, end_date=null) {
//   try {
//     // console.log("fetchRevenue - start_date:", start_date, "end_date:", end_date);
//     let whereCondition = {};
//     let unpaidWhereCondition = {};

//     const transactionType = await Status.findOne({
//       attributes: ['id','name'],
//       where:{
//         name: 'Cancel-Ride-Penalty'
//       },
//       raw: true
//     });

//     if (organizationId !== "*") {
//       if (!rideIds || rideIds.length === 0) {

//         return 0; // No rides, so return 0 immediately
//       }
//        whereCondition = {
//         is_paid: true,
//         ride_id: { [Op.in]: rideIds }, 
//       };
      
//        unpaidWhereCondition = {
//           is_paid: false,
//           transaction_type_id: transactionType.id,
//           ride_id: { [Op.in]: rideIds },
//       }
//       if(start_date && end_date){
//         whereCondition.createdAt = { [Op.between]: [start_date, end_date] };
//         unpaidWhereCondition.createdAt = { [Op.between]: [start_date, end_date] };
//       };
//     }
//     else if(organizationId === '*'){
//       whereCondition = {
//         is_paid: true,
//       }
      
//        unpaidWhereCondition = {
//           is_paid: false,
//           transaction_type_id: transactionType.id,
//       }

//       if(start_date && end_date){
//         whereCondition.createdAt = { [Op.between]: [start_date, end_date] };
//         unpaidWhereCondition.createdAt = { [Op.between]: [start_date, end_date] };
//       };
//     }
//     // Fetch revenue for each chauffeur from Payments
//     const paymentResults = await Payments.findAll({
//       attributes: [
//         [fn("SUM", col("amount_to_be_paid")), "total_revenue"]
//       ],
//       where: whereCondition,
//       raw: true
//     });

//     const walletPayments = await CustomerWalletLog.findAll({
//         attributes: [
//             [fn("SUM",col("amount_to_be_paid")),"total_wallet_revenue"],
//             [fn("SUM",col("adjusted_ride_amount")),"total_adjusted_ride_amount"],
//             [fn("SUM",col("cancelation_charges")),"total_cancelation_charges"]
//         ],
//         where: whereCondition,
//         raw: true
//     });

    
//     // console.log('Transaction:',transactionType.id);
//     const cancellationCharges = await CustomerWalletLog.findAll({
//       attributes: [[fn("SUM", col("amount_to_be_paid")), "cancellation_charges"],
//       [fn("SUM", col("adjusted_ride_amount")), "total_adjusted_ride_amount"]],
//       where:unpaidWhereCondition,
//       raw: true
//     });

//     // Extract values safely
//     const totalRevenue = parseFloat(paymentResults[0]?.total_revenue || 0);
//     const totalWalletRevenue = parseFloat(walletPayments[0]?.total_wallet_revenue || 0);
//     const totalAdjustedRideAmount = parseFloat(walletPayments[0]?.total_adjusted_ride_amount || 0);
//     // const totalCancelationCharges = parseFloat(walletPayments[0]?.total_cancelation_charges || 0);
//     const totalCancellationCharges = parseFloat(cancellationCharges[0]?.cancellation_charges || 0);
//     const cancelledAdjustedRideAmount = parseFloat(cancellationCharges[0]?.total_adjusted_ride_amount || 0);
//     // Calculate the total revenue
//     const total = totalRevenue + totalWalletRevenue - totalAdjustedRideAmount +  totalCancellationCharges - cancelledAdjustedRideAmount;

//     return total;
//   } catch (error) {
//     await addServerLog({
//       log_level: "ERROR",
//       service_name: "fetchRevenue",
//       error_message: `fetchRevenueDAOerror - ${error.message}.`
//     });
//     console.error("Error fetching revenue by chauffeur:", error);
//     throw new Error("Failed to fetch revenue by chauffeur");
//   }
// }

async function findCommissionDetails(start_date, end_date, user_id, user_type, page, limit) {
  try {
    // Build dynamic where clause
    const whereClause = {
      created_at: { [Op.between]: [start_date, end_date] }
    };

    if (user_id && user_id !== "") {
      whereClause.user_id = user_id;
    }

    if (user_type && user_type !== "") {
      whereClause.role_id = user_type.toLowerCase() === "chauffeur" ? 3 : 4;
    }

    // Calculate pagination offset
    const offset = (page - 1) * limit;

    // Fetch total summary (aggregated values)
    const summary = await UserCommission.findOne({
      attributes: [
        [fn("SUM", col("commission_amount")), "total_commission_amount"],
        [fn("COUNT", col("ride_id")), "total_rides"],
        ...(user_type?.toLowerCase() !== "pd" ? [[fn("SUM", col("ride_amount")), "total_ride_amount"]] : [])
      ],
      where: whereClause,
      raw: true
    });

    // Fetch paginated ride details with user data
    const details = await UserCommission.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "User",
          attributes: ["first_name", "last_name"]
        }
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
      raw: true,
      nest: true
    });

    // Calculate total pages
    const totalPages = Math.ceil(details.count / limit);

    // Return combined response
    return {
      totalRecords: details.count,
      totalPages,
      currentPage: page,
      limit,
      summary,
      details: details.rows
    };
  } catch (error) {
    console.error("Error in findCommission:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "findCommission",
      error_message: `findCommissionDAOerror - ${error.message}.`
    });
    throw error;
  }
}



  async function findDailyCommission( start_date, end_date, user_id) {
    try {
    const commission = await UserCommission.findAll({
      attributes: [
        [fn("SUM", col("commission_amount")), "total_commission_amount"],
      ],
      where: {
        created_at: { [Op.between]: [start_date, end_date] },
        user_id: user_id
      },
      raw: true // Ensures plain JSON response
    });
  
      // Extract and return total commission safely
      return parseFloat(commission[0]?.total_commission_amount || 0);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findDailyCommission",
        error_message: `findDailyCommissionDAOerror - ${error.message}.`
      });
      console.error("Error finding commission:", error);
      throw error;
    }
  }
  
  async function fetchRevenue(rideIds, organizationId, start_date=null, end_date=null){
    try{

      const formattedStartDate = start_date ? new Date(start_date).toISOString() : null;
      const formattedEndDate = end_date ? new Date(end_date).toISOString() : null;

      const allowedStatuses = ["Completed", "Cancelled", "Review-Pending"];
      let totalRevenue = 0;
      
      for (const status of allowedStatuses) {
        let lastKey = undefined;
  
        do {
        // Build dynamic expressions
        const ExpressionAttributeNames = {
          "#status": "status",
          ...(formattedStartDate && formattedEndDate && { "#order_date": "order_date" }),
         
        };
    

        const ExpressionAttributeValues = {
          ":statusValue": status,
          ...(formattedStartDate && formattedEndDate && {
            ":startDate": formattedStartDate,
            ":endDate": formattedEndDate,
          }),
        };

        const filterConditions = [];
        if (formattedStartDate && formattedEndDate) {
          filterConditions.push("#order_date BETWEEN :startDate AND :endDate");
        }
        

        const FilterExpression = filterConditions.length > 0 ? filterConditions.join(" AND ") : undefined;

        const params = {
          TableName: "Rides",
          IndexName: "status-index",
          KeyConditionExpression: "#status = :statusValue",
          ExpressionAttributeNames,
          ExpressionAttributeValues,
          ...(FilterExpression && { FilterExpression }),
          ExclusiveStartKey: lastKey,
        };

        const result = await ddbDocClient.send(new QueryCommand(params));

        if (result.Items) {
          for (const ride of result.Items) {
            if (rideIds && rideIds.length > 0 && !rideIds.includes(ride.ride_id)) {
              continue;
            }

            const calc = ride.final_price_calculation;

            if (calc) {
              try {
                const parsed = typeof calc === "string" ? JSON.parse(calc) : calc;
                const finalAmount = parseFloat(parsed.final_total_amount || 0);
                const previousBalance = parseFloat(parsed.previous_balance || 0);
                const amount = finalAmount - previousBalance;
                totalRevenue += amount;
              } catch (e) {
                console.warn(`Error parsing final_price_calculation for ride ${ride.ride_id}`);
              }
            }

          }
        }

        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
    }

    return totalRevenue;

    }catch(error){
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchRevenue",
        error_message: `fetchRevenueDAOerror - ${error.message}.`
      });
      console.error("Error fetching revenue by chauffeur:", error);
      throw error;

    }
  }

module.exports = {
    fetchRevenueByChauffeur,
    fetchRevenue,
    findDailyCommission,
    findCommissionDetails
}
