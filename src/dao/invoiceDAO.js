const { Invoice, OrganizationInvoice , Payments, CustomerWalletLog} = require("../dto"); // Sequelize Model for Invoices
const { Op, fn, col} = require('sequelize');
const { addServerLog } = require('../services/serverLogsService');
const ddbDocClient = require("./ddbClient");
const ridesDAO = require('../dao/ridesDAO');
const vehicleDAO = require('../dao/vehicleDAO');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  BatchWriteCommand
} = require("@aws-sdk/lib-dynamodb");


module.exports = {
  createInvoice: async (invoiceData) => {
    try{
    return await OrganizationInvoice.create(invoiceData);
    }
    catch (error) {
      console.error("Error creating invoice:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createInvoice",
        error_message: `createInvoice Controller error - ${error.message}.`
      });
      throw error;
    }
  },

  getInvoiceByDateRange: async (organization_id, start_date, end_date) => {
    try{
    return await OrganizationInvoice.findOne({
      where: {
        organization_id,
        start_date,
        end_date,
      },
    });
  }
  catch (error) {
    console.error("Error fetching invoice by date range:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getInvoiceByDateRange",
      error_message: `getInvoiceByDateRange Controller error - ${error.message}.`
    });
    throw error;
  }
  },

  getTotalAmountByRideIds: async (rideIds) => {
    try {
      const whereCondition = {
        is_paid: false,
        is_invoice_created: false,
        ride_id: { [Op.in]: rideIds },
      };
  
      // Fetch amount_to_be_paid from Payments
      const paymentResults = await Payments.findAll({
        attributes: ["ride_id", [fn("SUM", col("amount_to_be_paid")), "total_revenue"]],
        where: whereCondition,
        group: ["ride_id"],
        raw: true
      });
  
      // Fetch amount_to_be_paid from CustomerWalletLog
      const walletPayments = await CustomerWalletLog.findAll({
        attributes: ["ride_id", [fn("SUM", col("amount_to_be_paid")), "total_wallet_revenue"]],
        where: whereCondition,
        group: ["ride_id"],
        raw: true
      });
  
      // Fetch VAT from Payments
      const paymentVatResults = await Payments.findAll({
        attributes: ["ride_id", [fn("SUM", col("vat")), "total_vat"]],
        where: whereCondition,
        group: ["ride_id"],
        raw: true
      });
  
      // Fetch VAT from Wallet Logs
      const walletVatResults = await CustomerWalletLog.findAll({
        attributes: ["ride_id", [fn("SUM", col("vat")), "total_vat"]],
        where: whereCondition,
        group: ["ride_id"],
        raw: true
      });
  
      // Merge VAT from both sources
      const vatMap = {};
      paymentVatResults.forEach(({ ride_id, total_vat }) => {
        vatMap[ride_id] = parseFloat(total_vat || 0);
      });
      walletVatResults.forEach(({ ride_id, total_vat }) => {
        const vat = parseFloat(total_vat || 0);
        if (!vatMap[ride_id]) vatMap[ride_id] = 0;
        vatMap[ride_id] += vat;
      });
  
      const rideAmountMap = {};
  
      // Populate map from Payments
      paymentResults.forEach(({ ride_id, total_revenue }) => {
        const amount = parseFloat(total_revenue || 0);
        rideAmountMap[ride_id] = {
          amount,
          vat: vatMap[ride_id] || 0,
          pickup: null,
          drop: null,
          date: null,
          vehicle_id: null
        };
      });
  
      // Merge in Wallet payments
      walletPayments.forEach(({ ride_id, total_wallet_revenue }) => {
        const amount = parseFloat(total_wallet_revenue || 0);
        if (!rideAmountMap[ride_id]) {
          rideAmountMap[ride_id] = { amount: 0, vat: vatMap[ride_id] || 0, pickup: null, drop: null, date: null, vehicle_id: null };
        }
        rideAmountMap[ride_id].amount += amount;
      });
  
      // Fetch and merge ride details
      for (const rideId of rideIds) {
        const ride = await ridesDAO.getRideById(rideId);
        const vehicle = await vehicleDAO.getById(ride.vehicle_id);
        if (ride && rideAmountMap[rideId]) {
          rideAmountMap[rideId].pickup = ride.requested_pickup_point || "N/A";
          rideAmountMap[rideId].drop = ride.requested_drop_point || "N/A";
          rideAmountMap[rideId].date = ride.order_date ? new Date(ride.order_date).toLocaleDateString() : "N/A";
          rideAmountMap[rideId].vehicle_id = vehicle?.registration_no || "N/A";
        }
      }
  
      // Compute totals
      const totalAmount = Object.values(rideAmountMap).reduce((sum, ride) => sum + ride.amount, 0);
      const totalVAT = Object.values(rideAmountMap).reduce((sum, ride) => sum + ride.vat, 0);
      const subtotal = totalAmount - totalVAT;

      console.log("rideAmountMap: ", rideAmountMap);
      console.log("totalAmount: ", totalAmount);
      console.log("totalVAT: ", totalVAT);
      console.log("subtotal: ", subtotal);
  
      return {
        rideAmountMap,
        totalAmount,   // Includes VAT
        totalVAT,
        subtotal       // Excludes VAT
      };
  
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getTotalAmountByRideIds",
        error_message: `getTotalAmountByRideIds DAO error - ${error.message}.`
      });
      console.error("Error fetching ride payments:", error);
      throw error;
    }
  },
  

    markPaymentsAsInvoiced : async (rideIds, invoiceNumber) => {
      try {
        if (!rideIds || rideIds.length === 0) {
          console.warn("⚠️ No ride IDs provided for invoice update.");
          return;
        }
    
        const updatedRows = await CustomerWalletLog.update(
          {
            is_invoice_created: true,
            invoice_id: invoiceNumber,
          },
          {
            where: {
              ride_id: rideIds, // Update only the payments for these rides
            },
          }
        );
    
        console.log(`✅ Updated ${updatedRows[0]} payment records with invoice number ${invoiceNumber}`);
        return updatedRows;
      } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "markPaymentsAsInvoiced",
          error_message: `markPaymentsAsInvoiced DAO error - ${error.message}.`
        });
        console.error("Error updating payment records:", error);
        throw new Error("Failed to update payments with invoice details.");
      }
    },

    findInvoice: async (invoice_number) => {
      try {
        const result = await OrganizationInvoice.findOne({
          where: {
            invoice_number,
          },
        });
    
        return result || null; 
      } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "findInvoice",
          error_message: `findInvoice DAO error - ${error.message}.`
        })
        console.error("Error finding invoice:", error.message);
        throw error;
      }
    },

    markPayment: async (rideIds) => {
      if (!Array.isArray(rideIds) || rideIds.length === 0) {
        throw new Error("Invalid ride IDs provided for payment update.");
      }
    
      try {
        // Step 1: Fetch previous values before update
        const previousRecords = await CustomerWalletLog.findAll({
          where: { ride_id: { [Op.in]: rideIds } },
          raw: true, // Fetch as plain objects for easy logging
        });

       // Log each previous record before updating
        for (const record of previousRecords) {
          await addServerLog({
            log_level: "Payment changes",
            error_message: `Customer Wallet Log update for Ride ID: ${record.ride_id}`,
            metadata: {  // ✅ Now it's an object!
              previous_transaction_date: record.transaction_date.toISOString(),
              ride_id: record.ride_id,
              amount: record.amount_to_be_paid
            },
          });
        }
    
        console.log("Previous Records Before Update:", JSON.stringify(previousRecords, null, 2));
    
        // Step 2: Update records
        const result = await CustomerWalletLog.update(
          {
            is_paid: true,
            payment_status_id: 3,
            transaction_date: new Date(),
          },
          {
            where: { ride_id: { [Op.in]: rideIds } },
          }
        );
    
        console.log(`Payment status updated for ${result[0]} records.`);
    
        return result; // Returns affected row count
      } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "markPayment",
          error_message: `markPayment DAO error - ${error.message}.`
        });
        console.error("Error updating payment status:", error);
        throw new Error(`Error marking payment: ${error.message}`);
      }
    },    

    markRideAsCompleted : async (rideIds) => {
      try {
        const updatePromises = rideIds.map(async (ride_id) => {
          // Step 1: Query to get the primary key (PK) using the GSI
          const queryParams = {
            TableName: "Rides",
            IndexName: "ride_id_index",  // ✅ Querying using GSI
            KeyConditionExpression: "ride_id = :ride_id",
            ExpressionAttributeValues: {
              ":ride_id": ride_id
            }
          };
    
          const queryResult = await ddbDocClient.send(new QueryCommand(queryParams));
    
          if (!queryResult.Items || queryResult.Items.length === 0) {
            console.warn(`Ride with ride_id ${ride_id} not found.`);
            return;
          }
    
          // Step 2: Get the primary key from the result
          const rideItem = queryResult.Items[0];  // Assuming ride_id is unique
          const { PK, SK } = rideItem;  // Ensure these match your schema
    
          // Step 3: Update the ride status to "Completed"
          const updateParams = {
            TableName: "Rides",
            Key: { PK, SK },  // Use the primary key from the query result
            UpdateExpression: "SET #status = :completed",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":completed": "Completed" }
          };
    
          console.log(`Updating ride ${ride_id} -> Completed`);
          return ddbDocClient.send(new UpdateCommand(updateParams));
        });
    
        await Promise.all(updatePromises);
        console.log("All rides marked as completed successfully.");
      } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "markRideAsCompleted",
          error_message: `markRideAsCompleted DAO error - ${error.message}.`
        });
        console.error("Error marking rides as completed:", error);
        throw new Error(`Error marking rides as completed ${error.message}`);
      }
    },
    
    getInvoices: async(whereClause, offset, limit)=>{
      try{
      // Fetch invoices with pagination
    const invoices = await OrganizationInvoice.findAndCountAll({
      where: whereClause,
      offset,
      limit,
      order: [["createdAt", "DESC"]], // Sort invoices by latest created date
    });

    return invoices;
  }catch(error){
    await addServerLog({
      log_level: "ERROR",
      service_name: "getInvoices",
      error_message: `getInvoices DAO error - ${error.message}.`
    })
    console.error(`Error in getting invoice DAO ${error.message}`);
    throw new Error(`Error in getting invoice DAO ${error.message}`);
  }
    },

    getInvoiceById: async (invoice_id) => {
      try {
        const invoice = await OrganizationInvoice.findOne({
          where: { invoice_number: invoice_id },
          raw: true, // Return plain JSON instead of a Sequelize instance
        });
    
        if (!invoice) {
          throw new Error(`Invoice with ID ${invoice_id} not found.`);
        }
    
        return invoice;
      } catch (error) {
        console.error("Error in fetching invoice by ID:", error);
        await addServerLog({
          log_level: "ERROR",
          service_name: "getInvoiceById",
          error_message: `getInvoiceById DAO error - ${error.message}.`
        })
        throw new Error(`Error in fetching invoice by ID: ${error.message}`);
      }
    },
    getAmountByRideIds: async(rideIds, chauffeur_id)=>{
      console.log(rideIds);
      try {
        whereCondition = {
            is_paid: false,
            ride_id: { [Op.in]: rideIds }, 
        };

        if(chauffeur_id){
          whereCondition.chauffeur_id = String(chauffeur_id);
        }
    
        // Fetch wallet payments for each ride
        const walletResult = await CustomerWalletLog.findAll({
            attributes: ["ride_id", [fn("SUM", col("amount_to_be_paid")), "total_wallet_revenue"]],
            where: whereCondition,
            group: ["ride_id"],  // ✅ Group by ride_id to return individual ride amounts
            raw: true
        });
         // ✅ Extract & convert the total wallet revenue safely
        const totalWalletRevenue = parseFloat(walletResult?.[0]?.total_wallet_revenue || 0);

        return totalWalletRevenue

    } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "getAmountByRideIds",
          error_message: `getAmountByRideIds DAO error - ${error.message}.`
        })
        console.error("Error fetching ride payments:", error);
        throw error;
    }
  },
  };
