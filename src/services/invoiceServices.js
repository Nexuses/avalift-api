const invoiceDAO = require("../dao/invoiceDAO");
const ridesDAO = require("../dao/ridesDAO");
const paymentsDAO = require("../dao/paymentsDAO");
const { generateInvoicePDF, addWatermarkToInvoice } = require('../utils/generateInvoicePDF');
const PaymentsService = require('./paymentsService');
const organizationDAO = require("../dao/organizationDAO");
const bankDetailsDAO = require("../dao/bankDetailDAO");
const { addServerLog } = require("../services/serverLogsService");
const {sortAndPaginateRides} = require("./ridesAdminPanelService");

module.exports = {
  generateInvoice: async (organization_id, start_date, end_date) => {
    try {
      // Step 1: Fetch all rides for the given organization within the date range
      const rideIds = await ridesDAO.fetchRideIdsByOrganization(organization_id, start_date, end_date);

      if (!rideIds.length) {
        throw new Error("No rides found for the given organization and date range.");
      }
      
      // Step 2: Fetch total amount to be paid for these rides from Payments table
      const totalAmount = await invoiceDAO.getTotalAmountByRideIds(rideIds);
      console.log("Total Amount: ", totalAmount);
      // Step 3: Check if an invoice already exists for this date range
      const existingInvoice = await invoiceDAO.getInvoiceByDateRange(organization_id, start_date, end_date);
      if (existingInvoice) {
        throw new Error("An invoice has already been generated for this date range.");
      }

      // Step 4: Generate unique invoice ID
      const invoiceId = `INV-${organization_id}-${Date.now()}`;
      const organisation = await organizationDAO.findById(organization_id);
      const defaultAccount = await bankDetailsDAO.getDefaultBankAccount();
      const defaultAddress = await organizationDAO.findOrganizationByName("Avalift"); // need to be changed check with seeder data for name
      console.log("Address: ", defaultAddress);
      const pdfData = {
        invoice_number: invoiceId,
        organization_id,
        organization_name: organisation.name,
        organization_number: `${organisation.country_code} ${organisation.mobile_number}`,
        organization_address: organisation.address,
        totalAmount: totalAmount.totalAmount, 
        is_paid: false,
        ride_ids: rideIds, 
        payment_date: Date.now(),
        start_date,
        end_date,
        rideAmountMap: totalAmount.rideAmountMap,
        account_number: defaultAccount.account_number,
        iban: defaultAccount.iban,
        bank_name: defaultAccount.bank_name,
        branch_name: defaultAccount.branch_name,
        total_vat: totalAmount.totalVAT,
        subtotal: totalAmount.subtotal,
        address: defaultAddress.address,
        contact_number: `${defaultAddress.country_code} ${defaultAddress.mobile_number}`,
        contact_email: defaultAddress.email_id
      };

      const filePath = await generateInvoicePDF(pdfData);
      const organization = await organizationDAO.findById(organization_id);
      
      // Step 5: Save invoice details in Invoices table
      const invoiceData = {
        invoice_number: invoiceId,
        organization_id,
        organization_name: organization.name,
        ride_ids: rideIds,
        total_amount: totalAmount.totalAmount,
        invoice_file: filePath,
        is_paid: false,
        start_date,
        end_date,
      };

      await invoiceDAO.createInvoice(invoiceData);
      await invoiceDAO.markPaymentsAsInvoiced(rideIds, invoiceId);
      return invoiceData;
    } catch (error) {
      console.error("Error in invoice generation:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "generateInvoice",
        error_message: `generateInvoice service error - ${error.message}.`
      });
      throw error;
    }
  },

  invoicePayment: async (invoice_number, user_id) => {
    try {
      const invoice = await invoiceDAO.findInvoice(invoice_number);
      // Check if the invoice exists
      if (!invoice) {
        throw new Error(`Invoice with number ${invoice_number} not found`);
      }
      // Check if the invoice is already paid
      if (invoice.is_paid) {
        throw new Error(`Invoice ${invoice_number} is already paid.`);
      }
      const data = {
        customer_id: user_id,
        ride_ids: invoice.ride_ids,
        hand_over_amount: String(invoice.total_amount)
      };
      console.log(invoice.total_amount);
      // Mark invoice as paid and update payment timestamp
      invoice.is_paid = true;
      invoice.payment_date = new Date().toISOString();
      invoice.amount_paid = invoice.total_amount;
      console.log(invoice);
      await invoiceDAO.markPayment(invoice.ride_ids);
      await invoiceDAO.markRideAsCompleted(invoice.ride_ids);
      const paymentresult = await PaymentsService.orgPaymentByRidesUpdate(data);
      console.log(paymentresult);
      await addWatermarkToInvoice(invoice.invoice_file);
      // Save the updated invoice
      await invoice.save();

      return invoice;
    } catch (error) {
      console.error("Error processing invoice payment:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "invoicePayment",
        error_message: `invoicePayment service error - ${error.message}.`
      });
      throw error;
    }
  },

  getInvoices: async (page, limit, organization_id, is_paid) => {
    try {
      // Set default values if not provided
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 10;
      const offset = (page - 1) * limit;

      // Define the filter criteria
      const whereClause = {};
      if (organization_id) {
        whereClause.organization_id = organization_id;
      }
      if (is_paid !== undefined) {
        whereClause.is_paid = is_paid;
      }

      const invoices = await invoiceDAO.getInvoices(whereClause, offset, limit);
      return invoices;
    } catch (error) {
      console.error(`Error in getting invoice services: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getInvoices",
        error_message: `getInvoices service error - ${error.message}.`
      });
      throw new Error(`Error in getting invoice services ${error.message}`);
    }
  },

  getInvoicebyId: async (invoice_id) => {
    try {
      const invoice = await invoiceDAO.getInvoiceById(invoice_id);
      return invoice;
    } catch (error) {
      console.error(error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getInvoicebyId",
        error_message: `getInvoicebyId service error - ${error.message}.`
      });
      throw new Error(`Error in getting invoice services: ${error.message}`);
    }
  },

  getOrgRides: async (organization_id, start_date, end_date) => {
    try {
      const orgRides = await ridesDAO.orgRides(organization_id, start_date, end_date);
      return orgRides;
    } catch (error) {
      console.error(`Error fetching organizational ride: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getOrgRides",
        error_message: `getOrgRides service error - ${error.message}.`
      });
      throw new Error(`Error fetching organizational ride: ${error.message}`);
    }
  },

  getCreditedRides: async (start_date, end_date, chauffeur_id, pageNumber, pageSize, organization_id) => {
    try {
      const rides = await ridesDAO.getCreditedRides(start_date, end_date, chauffeur_id, organization_id);
      const rideIds = rides.map(ride => ride.ride_id);
      const revenue = await invoiceDAO.getAmountByRideIds(rideIds, chauffeur_id);
      const result = sortAndPaginateRides(rides, pageNumber, pageSize, 'order_date', 'desc');
      return { revenue, rides:result };
    } catch (error) {
      console.error(`Error in getting credited rides: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCreditedRides",
        error_message: `getCreditedRides service error - ${error.message}.`
      });
      throw error;
    }
  },
};
