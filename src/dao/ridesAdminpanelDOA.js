const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const  ddbDocClient  = require("./ddbClient");
const { buildQueryForCustomer, buildQueryForChauffeur } = require("../helpers/searchHelper");
const userDOA = require("./userDAO");
const organizationDOA = require("./organizationDAO");
const {Payments,User, CustomerWalletLog, PaymentType, Status} = require('../dto');
const { Op, fn, col, literal, where } = require("sequelize"); 
const { addServerLog } = require("../services/serverLogsService");


const fetchRidesForChauffeurs = async (
  //ride_type,
  status,
  search_string,
  dateFilter,
  page,
  limit
) => {
  console.log("Fetching rides for chauffeurs with limit:", limit);

  try {
    let allRides = [];
    let lastEvaluatedKey = null;

    let params = buildQueryForChauffeur(
      //ride_type,
      status,
      search_string,
      dateFilter,
      null,
      null
    );

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      } else {
        delete params.ExclusiveStartKey;
      }

      const response = await ddbDocClient.send(new QueryCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;

      if (response.Items) {
        allRides = allRides.concat(response.Items);
      }
    } while (lastEvaluatedKey);

    console.log(`Total rides fetched for chauffeurs: ${allRides.length}`);

    // Process chauffeur IDs and details
    const chauffeurIds = [...new Set(allRides.map(ride => ride.chauffeur_id).filter(id => id))];
    const chauffeurs = await userDOA.fetchChauffeurDetails(chauffeurIds);
    allRides = allRides.map(ride => ({
      ...ride,
      chauffeur_name: chauffeurs[ride.chauffeur_id]?.name || "N/A",
      chauffeur_phone: chauffeurs[ride.chauffeur_id]?.phone || "N/A",
    }));

    // Sort and paginate rides
    allRides.sort((a, b) => parseInt(b.ride_id, 10) - parseInt(a.ride_id, 10));
    const totalPages = Math.ceil(allRides.length / limit);
    const paginatedRides = allRides.slice((page - 1) * limit, page * limit);

    console.log(`Returning page ${page} with ${paginatedRides.length} rides`);
    return {
      rides: paginatedRides,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesForChauffeurs",
      error_message: `fetchRidesForChauffeurs DAO error - ${error.message}.`
    });
    console.error("Error fetching rides for chauffeurs:", error);
    throw new Error("Failed to fetch rides.");
  }
};


const fetchRidesForCustomer = async (
  ride_type,
  status,
  search_string,
  dateFilter,
  page,
  limit,
  org_id,
  selected_org,
  rate_type
) => {
  //console.log("Fetching rides with limit:", limit);

  // Build the query using the updated helper that queries the GSI.
  let params = buildQueryForCustomer(
    ride_type,
    status,
    search_string,
    dateFilter,
    null,
    null,
    org_id,
    selected_org,
    rate_type
  );
  // Remove the Limit here to fetch all data for proper pagination later.
  delete params.Limit;

  try {
    let allRides = [];
    let lastEvaluatedKey = null;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      } else {
        delete params.ExclusiveStartKey;
      }

      const response = await ddbDocClient.send(new QueryCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;

      if (response.Items) {
        allRides = allRides.concat(response.Items);
      }
    } while (lastEvaluatedKey);

    //console.log(`Total rides fetched: ${allRides.length}`);

    // Process chauffeur IDs and details…
    const chauffeurIds = [
      ...new Set(allRides.map(ride => ride.chauffeur_id).filter(id => id))
    ];
    const chauffeurs = await userDOA.fetchChauffeurDetails(chauffeurIds);

    const organizationIds = [
      ...new Set(allRides.map(ride => ride.organisation_id).filter(id => id))
    ]
    const organizations = await organizationDOA.fetchOrganizationDetails(organizationIds);

    const customerIds = [
      ...new Set(allRides.map(ride => ride.customer_id).filter(id => id))
    ]
    const customers = await userDOA.fetchCustomerDetails(customerIds);

    //console.log("fetched customers:", customers);

    allRides = allRides.map(ride => ({
      ...ride,
      customer_name: customers[ride.customer_id]?.name || "N/A",
      chauffeur_name: chauffeurs[ride.chauffeur_id]?.name || "N/A",
      chauffeur_phone: chauffeurs[ride.chauffeur_id]?.phone || "N/A",
      organisation_name: organizations[ride.organisation_id]?.name || "N/A",
    }));

    // Sort and paginate rides.
    allRides.sort((a, b) => parseInt(b.ride_id, 10) - parseInt(a.ride_id, 10));
    //console.log("Sorted rides:", allRides.map(r => r.ride_id));
    const totalPages = Math.ceil(allRides.length / limit);
    const paginatedRides = allRides.slice((page - 1) * limit, page * limit);
    //console.log(`Returning page ${page} with ${paginatedRides.length} rides`);

    return {
      rides: paginatedRides,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesForCustomer",
      error_message: `fetchRidesForCustomer DAO error - ${error.message}.`
    });
    console.error("Error fetching rides:", error);
    throw new Error("Failed to fetch rides.");
  }
};



const getRideDetails = async(ride_id)=>{
  try{

    const params = {
      TableName: "Rides",
      IndexName: "ride_id_index",
      KeyConditionExpression: "ride_id = :ride_id",
      ExpressionAttributeValues: {
        ":ride_id": ride_id,
      },
    }
     
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    return response.Items.length ? response.Items : null;

  }catch(error){
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideDetails",
      error_message: `getRideDetails DAO error - ${error.message}.`
    });
    console.error('Error in getting ride details:',error.message);
    throw new Error('Database error: unable to fetch ride details');
  }
};

const fetchRideByStatus = async(data)=>{
  try{

    const params = {
      TableName: "Rides",
      IndexName: "status-index",  
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": data,
      },
    };

    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    return response.Items.length ? response.Items : null;
  }catch(error){
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRideByStatus",
      error_message: `fetchRideByStatus DAO error - ${error.message}.`
    });
    console.error('Error in getting ride details:',error.message);
    throw new Error('Database error: unable to fetch ride with status');
  }
}

const getRevenueReport = async (params) => {
  try {
    

    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    return response.Items.length ? response.Items : null;
    
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRevenueReport",
      error_message: `getRevenueReport DAO error - ${error.message}.`
    });
    console.error('Error in fetching all rides:', error);
    throw new Error(`Error in fetching rides: ${error.message}`);
  }
};

const fetchTotalRevenue =  async (startDate, endDate) => {
  try {
    const result = await Payments.findAll({
      attributes: [
        [fn("SUM", col("amount_to_be_paid")), "total_revenue"],
        [fn("SUM", col("discount_amount")), "total_discounts"],
        [fn("SUM", col("tip_amount")), "total_tips"],
        [fn("COUNT", col("id")), "total_transactions"]
      ],
      where: {
        is_paid: true,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

     // Fetch wallet payment data from CustomerWalletLog
     const walletResult = await CustomerWalletLog.findAll({
      attributes: [
        [fn("SUM", col("amount_to_be_paid")), "total_wallet_revenue"],
      ],
      where: {
        is_paid: true,
        transaction_date: { [Op.between]: [startDate, endDate] }
      },
      raw: true
    });

    return result?.dataValues || {};
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchTotalRevenue",
      error_message: `fetchTotalRevenue DAO error - ${error.message}.`
    });
    console.error("Error fetching total revenue:", error);
    throw new Error("Failed to fetch total revenue");
  }
};

/**
 * Fetch revenue grouped by payment method
 */
const fetchRevenueByPaymentMethod = async (chauffeur_id, startDate, endDate) => {
  try {
    const whereCondition = {
      is_paid: true,
      ...(startDate && endDate && { createdAt: { [Op.between]: [startDate, endDate] } }),
      ...(chauffeur_id && { chauffeur_id: String(chauffeur_id) }) // Convert to String
    };

    // ✅ Fetch revenue grouped by payment_type_id
    const results = await Payments.findAll({
      attributes: [
        "payment_type_id",  
        [fn("SUM", col("amount_to_be_paid")), "total_revenue"]
      ],
      where: whereCondition,
      group: "payment_type_id",
      raw: true
    });

    const paymentTypes = await PaymentType.findAll({
      attributes: ["id", "name"],
      raw: true
    })
    // console.log('results',results);
    // console.log('paymentTypes',paymentTypes);

    const mappedResults = results.map(result => {
      const matchedType = paymentTypes.find(type => type.id === result.payment_type_id);
      return {
        name: matchedType ? matchedType.name : 'Unknown',
        total_revenue: parseFloat(result.total_revenue)
      };
    });

    // ✅ Fetch wallet payment data separately
    const walletWhereCondition = { 
        is_paid: true,
        ...(startDate && endDate && { createdAt: { [Op.between]: [startDate, endDate] } }),
        ...(chauffeur_id && { chauffeur_id: String(chauffeur_id) }) // Convert to String
    };

    const walletResult = await CustomerWalletLog.findAll({
      attributes: [[fn("SUM", col("amount_to_be_paid")), "total_wallet_revenue"],
      [fn("SUM", col("cancelation_charges")), "total_cancellation_charges"],
      [fn("SUM", col("adjusted_ride_amount")), "total_adjusted_ride_amount"]],
      where: walletWhereCondition,
      raw: true
    });

    const transactionType = await Status.findOne({
      attributes: ['id','name'],
      where:{
        name: 'Cancel-Ride-Penalty'
      }
    });

    const unpaidWhereCondition = {
        is_paid: false,
        transaction_type_id: transactionType.id,
        ...(startDate && endDate && { createdAt: { [Op.between]: [startDate, endDate] } }),
        ...(chauffeur_id && { chauffeur_id: String(chauffeur_id) }) 
    }
    // console.log('Transaction:',transactionType.id);
    const cancellationCharges = await CustomerWalletLog.findAll({
      attributes: [[fn("SUM", col("cancelation_charges")), "unpaid_cancellation_charges"]],
      where:unpaidWhereCondition,
      raw: true
    });
    // ✅ Convert results into key-value pair (payment_type -> total_revenue)
    const revenueByMethod = {};

    results.forEach((row) => {
      const paymentTypeName = row["PaymentType.name"] || "Unknown";  // ✅ Handle NULL values
      revenueByMethod[paymentTypeName] = parseFloat(row.total_revenue || 0);  // Convert to float safely
    });

    const totalWalletRevenue = parseFloat(walletResult?.[0]?.total_wallet_revenue || 0);
    const totalCancellationCharges = parseFloat(walletResult?.[0]?.total_cancellation_charges || 0);
    const totalAdjustedRideAmount = parseFloat(walletResult?.[0]?.total_adjusted_ride_amount || 0);
    const unpaidCancellationCharges = parseFloat(cancellationCharges?.[0].unpaid_cancellation_charges || 0);
    const finalWalletRevenue = totalWalletRevenue - totalAdjustedRideAmount + Math.abs(unpaidCancellationCharges) - Math.abs(totalCancellationCharges);
   
    // ✅ Append Wallet to mapped results
    mappedResults.push({
      name: "Wallet",
      total_revenue: finalWalletRevenue
    });

    const revenueMap = mappedResults.reduce((acc, curr) => {
      acc[curr.name] = curr.total_revenue;
      return acc;
    }, {});

    return revenueMap;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRevenueByPaymentMethod",
      error_message: `fetchRevenueByPaymentMethod DAO error - ${error.message}.`
    });
    console.error("Error fetching revenue by payment method:", error);
    throw error;
  }
};


/**
 * Fetch revenue grouped by chauffeur
 */
const fetchRevenueByChauffeur = async (startDate = null, endDate = null) => {
  try {
    const whereCondition = { is_paid: true };
    const walletWhereCondition ={}
    // ✅ Apply date filter only if provided
    if (startDate && endDate) {
      whereCondition.createdAt = { [Op.between]: [startDate, endDate] };
      walletWhereCondition.createdAt = { [Op.between]: [startDate, endDate] };
    }

    // ✅ Fetch revenue by chauffeur from Payments
    const paymentResults = await Payments.findAll({
      attributes: [
        "chauffeur_id",
        [
          literal(`COALESCE(("User"."first_name" || ' ' || "User"."last_name"), 'Unknown')`),
          "chauffeur_name"
        ],
        [fn("SUM", col("amount_to_be_paid")), "total_revenue"],
        [fn("SUM", col("discount_amount")), "total_discount"]
      ],
      where: whereCondition,
      include: [
        {
          model: User, // ✅ Join Users table to fetch chauffeur name
          attributes: [],
          required: false
        },
        {
          model: PaymentType, // ✅ Join PaymentTypes table to get payment method
          attributes: ["name"],
          required: false
        }
      ],
      group: ["chauffeur_id", "User.first_name", "User.last_name", "PaymentType.name"],
      raw: true
    });

    const walletResults = await CustomerWalletLog.findAll({
      attributes: [
        "chauffeur_id",
        [
          literal(`COALESCE(("User"."first_name" || ' ' || "User"."last_name"), 'Unknown')`),
          "chauffeur_name"
        ],
        [fn("SUM", col("amount_to_be_paid")), "wallet_revenue"],
        [fn("SUM", col("discount_amount")), "wallet_discount"]
      ],
      where: walletWhereCondition,
      include: [
        {
          model: User,
          attributes: [],
          required: false
        }
      ],
      group: ["chauffeur_id", "User.first_name", "User.last_name"],
      raw: true
    });

    // ✅ Convert wallet revenue into a lookup object
    const walletRevenueMap = {};
    walletResults.forEach(({ chauffeur_id, chauffeur_name, wallet_revenue, wallet_discount }) => {
      walletRevenueMap[chauffeur_id] = {
        chauffeur_name: chauffeur_name,
        wallet_revenue: parseFloat(wallet_revenue || 0),
        wallet_discount: parseFloat(wallet_discount || 0)
      };
    });

    // ✅ Prepare the final revenue structure
    const revenueByChauffeur = {};

    paymentResults.forEach(({ chauffeur_id, chauffeur_name, "PaymentType.name": paymentMethod, total_revenue, total_discount }) => {
      if (!revenueByChauffeur[chauffeur_id]) {
        revenueByChauffeur[chauffeur_id] = {
          chauffeur_name: chauffeur_name,
          total_revenue: 0,
          total_discount: 0,
          payment_methods: {}
        };
      }

      // ✅ Add each payment method revenue
      revenueByChauffeur[chauffeur_id].payment_methods[paymentMethod] = parseFloat(total_revenue || 0);

      // ✅ Add total revenue
      revenueByChauffeur[chauffeur_id].total_revenue += parseFloat(total_revenue || 0) + parseFloat(total_discount || 0);
      revenueByChauffeur[chauffeur_id].total_discount += parseFloat(total_discount || 0);
    });

    // ✅ Add wallet revenue to the respective chauffeurs
    for (const chauffeur_id in walletRevenueMap) {
      if (!revenueByChauffeur[chauffeur_id]) {
        revenueByChauffeur[chauffeur_id] = {
          chauffeur_name: walletRevenueMap[chauffeur_id].chauffeur_name,
          total_revenue: 0,
          total_discount: 0,
          payment_methods: {}
        };
      }

      // ✅ Add Wallet revenue separately
      revenueByChauffeur[chauffeur_id].payment_methods["Wallet"] = walletRevenueMap[chauffeur_id].wallet_revenue;
      revenueByChauffeur[chauffeur_id].total_revenue += walletRevenueMap[chauffeur_id].wallet_revenue + parseFloat(walletRevenueMap[chauffeur_id].wallet_discount || 0);;
      revenueByChauffeur[chauffeur_id].total_discount += walletRevenueMap[chauffeur_id].wallet_discount;
    }

    return revenueByChauffeur;

  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRevenueByChauffeur",
      error_message: `fetchRevenueByChauffeur service error - ${error.message}.`
    });
    console.error("❌ Error fetching revenue by chauffeur:", error);
    throw new Error("Failed to fetch revenue by chauffeur");
  }
};

const fetchRidesByDateRange = async (start_date, end_date, chauffeur_id, status) => {
  try {
    // ✅ Validate Dates
    if (!start_date || !end_date) {
      throw new Error("start_date and end_date are required.");
    }
    if (new Date(start_date) > new Date(end_date)) {
      throw new Error("start_date cannot be later than end_date.");
    }

    const allItems = [];
    let ExclusiveStartKey = undefined;

    do {
      // ✅ Query Parameters with optional pagination key
      const params = {
        TableName: "Rides",
        IndexName: "all_rides_pk-index",
        KeyConditionExpression: "all_rides_pk = :pk",
        FilterExpression: "#end_time BETWEEN :start AND :end",
        ExpressionAttributeNames: {
          "#end_time": "end_time"
        },
        ExpressionAttributeValues: {
          ":pk": "All Rides",
          ":start": start_date,
          ":end": end_date,
        },
        ExclusiveStartKey // will be undefined for the first query, and updated on each loop
      };

      if (chauffeur_id) {
        params.FilterExpression += " AND #chauffeur_id = :chauffeur_id";
        params.ExpressionAttributeNames["#chauffeur_id"] = "chauffeur_id";
        params.ExpressionAttributeValues[":chauffeur_id"] = chauffeur_id;
      }

      if (status) {
        params.FilterExpression += " AND #status IN (:completed, :cancelled, :reviewpending)";
        params.ExpressionAttributeNames["#status"] = "status";
        params.ExpressionAttributeValues[":completed"] = "Completed";
        //params.ExpressionAttributeValues[":review_pending"] = "Review-Pending";
        params.ExpressionAttributeValues[":cancelled"] = "Cancelled";
        params.ExpressionAttributeValues[":reviewpending"] = "Review-Pending";
      }

      const data = await ddbDocClient.send(new QueryCommand(params));

      if (data.Items) {
        allItems.push(...data.Items);
      }

      ExclusiveStartKey = data.LastEvaluatedKey;

    } while (ExclusiveStartKey); // keep querying while there's more data

    if (allItems.length === 0) {
      console.warn("No rides found for the given date range.");
    }

    return allItems;

  } catch (error) {
    console.error("Error fetching rides by date range:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesByDateRange",
      error_message: `fetchRidesByDateRange service error - ${error.message}.`
    });
    throw error;
  }
};




module.exports = { 
  fetchRidesForCustomer, 
  getRideDetails, 
  fetchRideByStatus, 
  getRevenueReport, 
  fetchRidesForChauffeurs, 
  fetchRevenueByChauffeur, 
  fetchRevenueByPaymentMethod, 
  fetchTotalRevenue,
  fetchRidesByDateRange
};
