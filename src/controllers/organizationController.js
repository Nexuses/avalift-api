const organizationService = require("../services/organizationServices");
const { adminOrganizationAdminUpdateValidator,adminOrganizationUserValidator } = require('../validators/adminValidator');
const { uploadToS3 } = require("../utils/s3Uploader");
const path = require("path");
const { addServerLog } = require("../services/serverLogsService");
const adminRideServices = require("../services/adminRideServices");


const createOrgAdmin = async (req, res) => {
  try {
    const newUser = await organizationService.createOrganisationAdmin(req.body);
    res.status(201).json({
      success: true,
      status: 201,
      message: "Organisation admin created successfully.",
      data: newUser,
    });
  } catch (error) {
    console.error("Error creating organisation admin:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createOrgAdmin",
      error_message: `createOrgAdmin Controller error - ${error.message}.`
    });
    res.status(error.statusCode || 400).json({
      success: false,
      status: error.statusCode || 400,
      error: error.message,
    });
  }
};


const updateOrgAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    await adminOrganizationAdminUpdateValidator(req.body);
    const updatedUser = await organizationService.updateOrganisationAdmin(adminId, req.body);

    res.status(200).json({
      success: true,
      status: 200,
      message: "Organisation admin updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating organisation admin:", error);
    res.status(error.statusCode || 400).json({
      success: false,
      status: error.statusCode || 400,
      error: error.message,
    });
  }
};



const createOrganization = async (req, res) => {

  try {
    const { name, address, country_code, mobile_number, email_id} = req.body;
    let logoUrl = null;

    if (req.file) {
      // const ext = path.extname(req.file.originalname);
      // const fileName = `organization-logos/${Date.now()}-${name}${ext}`;
      const ext = path.extname(req.file.originalname) || '.png';
      const originalName = req.file.originalname.replace(/\s+/g, '_');
      const sanitizedName = name.replace(/\s+/g, '_');
      const fileName = `organization-logos/${Date.now()}-${sanitizedName}-${originalName}`;
      logoUrl = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);
    }

    await adminOrganizationUserValidator({
      name,
      address,
      country_code,
      mobile_number,
      email_id,
      organization_logo: logoUrl,
    });


    const organization = await organizationService.createOrganization({ name, address, country_code, mobile_number,email_id, organization_logo: logoUrl,});
    return res.status(201).json({
      success: true,
      status: 201,
      data: organization,
      message: "Organization created successfully",
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createOrganization",
      error_message: `createOrganization Controller error - ${error.message}.`
    });
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Internal server error",
    });
   }
  };

const getAllOrganizations = async (req, res) => {
    try {
      const organizations = await organizationService.getAllOrganizations();
      return res.status(200).json({
        success: true,
        status: 200,
        data: organizations,
        message: "Organizations fetched successfully",
      });
    } catch (error) {
      console.error("Error fetching organizations:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error",
      });
    }
  };
  // To update Organization by ID
  const updateOrganization = async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      // 🧠 Map "logo" → "organization_logo" to pass Joi validation
      if (data.logo) {
        data.organization_logo = data.logo;
        delete data.logo;
      }

      // ✅ If file exists, upload to S3 and attach URL to update payload
      if (req.file) {
        const timestamp = Date.now();
        const sanitizedFileName = req.file.originalname.replace(/\s+/g, '_').replace(/[^\w.\-()]/g, '');
        const fileName = `organization-logos/${id}.${sanitizedFileName}`;
        const fileUrl = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);
        data.organization_logo = fileUrl;
      }

      if (
        data.organization_logo === 'null' ||data.organization_logo === '[null]' ||data.organization_logo === '') {
        data.organization_logo = null;
      }


      const updatedOrganization = await organizationService.updateOrganization(id, data);
      
      return res.status(200).json({
        success: true,
        status: 200,
        data: updatedOrganization,
        message: "Organization updated successfully",
      });
    } catch (error) {
      console.error("Error updating organization:", error);

      if (error.message === "Organization name already exists" || error.message === "Mobile number with this country code already exists" || error.message === "Email ID already exists" || error.message === "Organization not found") {
        return res.status(400).json({
          success: false,
          status: 400,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error",
      });
    }
  };
  
  const getAllUsersOrganizations = async (req, res) => {
    try {
      const organizations = await organizationService.getOrganisationUsers(req.body);
      return res.status(200).json({
        success: true,
        status: 200,
        data: organizations,
        message: "Organizations fetched successfully",
      });
    } catch (error) {
      console.error("Error fetching organizations:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error",
      });
    }
  };

  const deleteOrganization = async (req, res) => {
    try {
        const organizationId = req.params.id;

        const result = await  organizationService. deleteOrganizationService(organizationId);


        return res.status(200).json({success:true,status:200, message: result.message });
    } catch (error) {
        console.error('Error deleting organization:', error);
        
        if (error.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            status: 404,
            message: error.message,
          });
        }
    
        if (error.message.includes('unpaid wallet logs')) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: error.message,
          });
        }
    
        if (error.message.includes('Unpaid invoices exist')) {
          return res.status(400).json({
            success: false,
            status: 400,
            message: error.message,
          });
        }
  
        return res.status(500).json({success:false,status:500, message: 'Internal server error' });
    }
};

const adminCreateOrganizationScheduledRide = async (req, res) => {
  try {
    const { user_id } = req.params;
    const org_id = req.user.organization_id;
    const rideResponse = await adminRideServices.scheduleOrgRide(req.body, user_id, org_id);
    res.status(201).json({
      success: true,
      status: 200,
      message: `scheduled ride created successfully for customer ${user_id}.`,
      rideResponse,
    });
  } catch (error) {
    console.error("Error creating ride:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "adminCreateRide",
      error_message: `adminCreateRide Controller error - ${error.message}.`
    });
    res.status(error.statusCode || 400).json({
      success: false,
      status: error.statusCode || 400,
      details: error.details || [],
      error: error.message,
    });
  }
}

const pendingPaymentAmount = async (req, res) => {
  try {
    const  organization_id  = req.user.organization_id;
    const amount = await organizationService.pendingPaymentAmount(organization_id);
    return res.status(200).json({
      success: true,
      status: 200,
      pending_amount: amount,
      message: "Pending payment amount fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching pending payment amount:", error);
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Internal server error",
    });
  }
};

const OrganizationStatusUpdate = async (req, res) => {
  const { organization_id, is_active } = req.body;

  try {
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success:false,status:400,message: 'is_active must be a boolean' });
    }

    const result = await organizationService.OrganizationStatus(organization_id, is_active);
    res.status(200).json({success:true,status:200,
      message: `Organization has been ${is_active ? 'enabled' : 'disabled'} successfully`,
      organization: result,
    });
  } catch (error) {
    console.error('Error in toggleOrganization:', error.message);
    res.status(500).json({ success:false,status:500,message: 'Internal server error', error: error.message });
  }
};


  module.exports = {
    createOrganization,
    getAllOrganizations,
    updateOrganization,
    createOrgAdmin,
    getAllUsersOrganizations,
    deleteOrganization,
    updateOrgAdmin,
    adminCreateOrganizationScheduledRide,
    pendingPaymentAmount,
    OrganizationStatusUpdate
  };

  