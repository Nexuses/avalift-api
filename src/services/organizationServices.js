const organizationDAO = require("../dao/organizationDAO");
const { Op } = require("sequelize");
const adminValidator = require("../validators/adminValidator");
const bcrypt = require("bcryptjs");
const roleDAO = require("../dao/roleDAO");
const policyDAO = require("../dao/policyDAO");
const userDAO = require("../dao/userDAO");
const permissionDAO = require("../dao/permissionDAO");
const { addServerLog } = require("../services/serverLogsService");
const pricingDAO = require("../dao/pricingsDAO");
const ridesDAO = require("../dao/ridesDAO");
const {deleteFromS3} = require("../utils/s3Uploader");


module.exports = {
  createOrganization: async (data) => {
    try {
      //await adminValidator.adminOrganizationUserValidator(data);

      const existingOrganization =
        await organizationDAO.findByNameOrMobileOrEmail(
          data.name,
          data.country_code,
          data.mobile_number,
          data.email_id
        );

      if (existingOrganization) {
        if (existingOrganization.name === data.name) {
          const error = new Error("Organization name already exists");
          error.statusCode = 400;
          throw error;
        }
        if (
          existingOrganization.mobile_number === data.mobile_number &&
          existingOrganization.country_code === data.country_code
        ) {
          const error = new Error(
            "Mobile number with this country code already exists"
          );
          error.statusCode = 400;
          throw error;
        }
        if (existingOrganization.email_id === data.email_id) {
          const error = new Error("Email ID already exists");
          error.statusCode = 400;
          throw error;
        }
      }

      return await organizationDAO.createOrganization(data);
    } catch (error) {
      console.error(`Error in createOrganization service: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOrganization",
        error_message: `createOrganization service error - ${error.message}.`,
      });
      throw error;
    }
  },

  getAllOrganizations: async () => {
    try {
      return await organizationDAO.getAllOrganizations();
    } catch (error) {
      console.error(`Error in getAllOrganizations service: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllOrganizations",
        error_message: `getAllOrganizations service error - ${error.message}.`,
      });
      throw error;
    }
  },

  updateOrganization: async (id, data) => {
    try {
      await adminValidator.adminOrganizationUpdateValidator(data);

      const organization = await organizationDAO.getById(id);
      if (!organization) {
        throw new Error("Organization not found");
      }

      const existingOrganization =
        await organizationDAO.findByNameOrMobileOrEmail(
          data.name,
          data.country_code,
          data.mobile_number,
          data.email_id
        );

      if (
        existingOrganization &&
        existingOrganization.id !== parseInt(id, 10)
      ) {
        if (existingOrganization.name === data.name) {
          throw new Error("Organization name already exists");
        }
        if (
          existingOrganization.mobile_number === data.mobile_number &&
          existingOrganization.country_code === data.country_code
        ) {
          throw new Error(
            "Mobile number with this country code already exists"
          );
        }
        if (existingOrganization.email_id === data.email_id) {
          throw new Error("Email ID already exists");
        }
      }

       // ✅ If logo is being removed, delete old image from S3
      if (data.organization_logo === null && organization.organization_logo) {
        await deleteFromS3(organization.organization_logo); // Make sure this utility exists
      }

      await organizationDAO.updateOrganization(id, data);
      return await organizationDAO.getById(id);
    } catch (error) {
      console.error(`Error in updateOrganization service: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateOrganization",
        error_message: `updateOrganization service error - ${error.message}.`,
      });
      throw error;
    }
  },

  createOrganisationAdmin: async (adminData) => {
    try {
      const {
        email_id,
        mobile_number,
        first_name,
        last_name,
        country_code,
        password,
        organisationId,
      } = adminData;

      if (!organisationId) throw new Error("Organisation ID is required.");
      if (!email_id || !mobile_number || !country_code || !password) {
        throw new Error("Missing required user details.");
      }

      const organisation = await organizationDAO.findById(organisationId);
      if (!organisation) throw new Error("Organisation not found.");

      // Fetch Pricing Information
      let pricing;
      try {
        pricing = await pricingDAO.getPricingForOrg(organisationId, "AED");
        if (!Array.isArray(pricing)) {
          pricing = [];
        }
      } catch (pricingError) {
        console.error("Error fetching pricing: ", pricingError.message);
        const error = new Error("Prices has to be added before creating an organisation user.");
        error.statusCode = 500;
        throw error;
      }

      const orgNameSlug = organisation.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      const ROLE_NAME = `admin.${orgNameSlug}.normal`;

      let role = await roleDAO.findByName(ROLE_NAME);
    if (!role) {
      // 1) ensure the “allowed_organization” permission exists
      let allowedOrgPerm = await permissionDAO.findOne({
        name: "allowed_organization",
        value: organisation.id.toString(),
      });
      if (!allowedOrgPerm) {
        allowedOrgPerm = await permissionDAO.create({
          name: "allowed_organization",
          value: organisation.id.toString(),
        });
      }

      // 2) ensure your extra permissions exist
      const extraPermissionNames = [
        "orders.view",
        "orders.create",
        "orders.update",
        "users.view",
        "drivers.view",
        "organizations.viewUsers",
      ];
      const extraPermIds = [];
      for (const permName of extraPermissionNames) {
        let p = await permissionDAO.findByName(permName);
        if (!p) {
          p = await permissionDAO.create({ name: permName, value: null });
        }
        extraPermIds.push(p.id);
      }

      // 3) create or find the org‐scoped policy
      const newPolicyName = `organisation_${orgNameSlug}_policy`;
      let newPolicy = await policyDAO.findOne({ name: newPolicyName });
      if (!newPolicy) {
        // combine the allowedOrgPerm plus your extra perms
        const allPermIds = [
          allowedOrgPerm.id,
          ...extraPermIds,
        ];
        newPolicy = await policyDAO.createPolicy({
          name: newPolicyName,
          permissions: allPermIds,
        });
      }

      // 4) create the role, including whatever other “global” policy IDs you need
      const basePolicies = [15, 1, 17];  // ← whatever core policies you already had
      role = await roleDAO.createRole({
        name: ROLE_NAME,
        policies: [...basePolicies, newPolicy.id],
      });
    }

      const existingUser = await userDAO.findByEmailOrMobile({
        email_id,
        mobile_number,
        country_code,
      });
      if (existingUser) {
        const conflictError = new Error(
          "Email or Mobile Number already in use."
        );
        conflictError.name = "ConflictError";
        throw conflictError;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUserData = {
        email_id,
        mobile_number,
        country_code,
        first_name,
        last_name,
        password: hashedPassword,
        role: role.name,
        role_id: role.id,
        organisation_id: organisation.id,
      };

      return await userDAO.createOrgUser(newUserData);
    } catch (error) {
      console.error(
        `Error in createOrganisationAdmin service: ${error.message}`
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOrganisationAdmin",
        error_message: `createOrganisationAdmin service error - ${error.message}.`,
      });
      throw error;
    }
  },

  updateOrganisationAdmin: async (adminId, adminData) => {
    const {
      email_id,
      mobile_number,
      first_name,
      last_name,
      country_code,
      password,
    } = adminData;

    // Step 1: Find the existing user
    const existingUser = await userDAO.findById(adminId);

    if (!existingUser) {
      throw new Error("Admin user not found.");
    }

    // Step 2: If email/mobile changed, check uniqueness
    if (
      (email_id && email_id !== existingUser.email_id) ||
      (mobile_number && mobile_number !== existingUser.mobile_number)
    ) {
      const conflictUser = await userDAO.findByEmailOrMobile({
        email_id,
        mobile_number,
        country_code,
      });

      if (conflictUser && conflictUser.id !== existingUser.id) {
        const conflictError = new Error(
          "Email or Mobile Number already in use."
        );
        conflictError.name = "ConflictError";
        throw conflictError;
      }
    }

    // Step 4: Prepare update object
    const updateFields = {};

    if (email_id) updateFields.email_id = email_id;
    if (mobile_number) updateFields.mobile_number = mobile_number;
    if (country_code) updateFields.country_code = country_code;
    if (first_name) updateFields.first_name = first_name;
    if (last_name) updateFields.last_name = last_name;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updateFields.password = hashedPassword;
    }

    // Step 5: Update the user
    const updatedUser = await userDAO.updateOrgAdminUser(adminId, updateFields);

    return updatedUser;
  },

  getOrganisationUsers: async (data) => {
    try {
      const { orgnanisation_id } = data;
      if (!orgnanisation_id) {
        throw new Error("Can't find any organization for the user.");
      }
      return await organizationDAO.getUsersForOrganization(orgnanisation_id);
    } catch (error) {
      console.error(`Error in getOrganisationUsers service: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getOrganisationUsers",
        error_message: `getOrganisationUsers service error - ${error.message}.`,
      });
      throw error;
    }
  },
  deleteOrganizationService: async (organizationId) => {
    // Check if organization exists
    const organization = await organizationDAO.findById(organizationId);

    if (!organization) {
      throw new Error(`Organization with ID ${organizationId} not found`);
    }

    const hasUnpaidLogs = await organizationDAO.hasUnpaidCustomerWalletLogs(
      organizationId
    );
    if (hasUnpaidLogs) {
      throw new Error(
        "Cannot delete organization: There are unpaid wallet logs and invoices not created."
      );
    }

    // Check unpaid invoices
    const unpaidInvoice = await organizationDAO.hasUnpaidInvoices(
      organizationId
    );
    if (unpaidInvoice) {
      throw new Error("Cannot delete organization: Unpaid invoices exist.");
    }

    // Delete the organization
    const result = await organizationDAO.deleteOrganization(organizationId);

    if (result[0] === 0) {
      return {
        success: false,
        message: "Failed to delete organization or already deleted",
      };
    }

    return { success: true, message: "Organization deleted successfully" };
  },
  pendingPaymentAmount: async (organization_id) => {
    try{
      const rides = await ridesDAO.getRidesForOrganization(organization_id);
      const revenueBreakdown = await getRevenueBreakdownByPaymentMethod(rides);
      const totalRevenue = Object.values(revenueBreakdown).reduce((sum, value) => sum + value, 0);

      return totalRevenue;;
    }catch(error){
      console.error(`Error in pendingPaymentAmount service: ${error.message}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "pendingPaymentAmount",
        error_message: `pendingPaymentAmount service error - ${error.message}.`,
      });
      throw error;
    }
  },

  OrganizationStatus : async (organizationId, isActive) => {
    const [count, [updatedOrganization]] = await organizationDAO.updateOrganizationStatus(organizationId, isActive);
    
    if (count === 0) {
      throw new Error('Organization not found or update failed');
    }
  
    return updatedOrganization;
  },
};

async function getRevenueBreakdownByPaymentMethod(rides) {
  const breakdown = {};

  rides.forEach((ride) => {
    const finalAmount = ride?.final_price_calculation?.final_total_amount || 0;
    const previousBalance = ride?.final_price_calculation?.previous_balance || 0;
    const paymentMethod = ride?.paymentDetails?.payment_method || "Unknown";

    const netAmount = finalAmount - previousBalance;

    if (!breakdown[paymentMethod]) {
      breakdown[paymentMethod] = 0;
    }

    breakdown[paymentMethod] += netAmount;
  });

  return breakdown;
}
