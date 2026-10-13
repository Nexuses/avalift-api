const { Vehicle, VehicleDetail, UserPlate } = require("../dto");
const ddbDocClient = require("./ddbClient");
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { User, Role, Policy, Permission, Organization } = require("../dto");
const { Op } = require("sequelize");
const { addServerLog } = require("../services/serverLogsService");
const { raw } = require("../validators/invoiceValidator");

module.exports = {
  findByVin: async (registration_no) => {
    console.log("Searching registration_no:", registration_no);
    return await Vehicle.findOne({ where: { registration_no } });
  },

  findByVinAndUser: async (registration_no, user_id) => {
    console.log("Searching registration_no:", registration_no, "user_id:", user_id);
    return await Vehicle.findOne({
      where: {
        registration_no,
        user_id, // <-- this filters by the same user
      },
    });
  },
  

  create: async (vehicleData) => {
    try {
      const { vehicleDetails, ...vehicleInfo } = vehicleData;

      console.log("Vehicle details:", vehicleDetails, vehicleInfo);

      const newVehicle = await Vehicle.create(vehicleInfo);

      if (vehicleDetails) {
        vehicleDetails.vehicle_id = newVehicle.id;
        await VehicleDetail.create(vehicleDetails);
      }

      return await Vehicle.findByPk(newVehicle.id, {
        include: [{ model: VehicleDetail, as: "vehicleDetail" }],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "VehicleDAO.create",
        error_message: `VehicleDAO.create error - ${error.message}.`,
      });
      console.error("VehicleDAO create error:", error);
      throw new Error("Database operation failed.");
    }
  },

findAllVehicles: async (organizationId, limit = 10, offset = 0, search) => {
  try {
    const hasSearch = !!(search && search.trim());
    const q = hasSearch ? search.trim() : null;
    const like = hasSearch ? { [Op.iLike]: `%${q}%` } : null;

    // -----------------------------------------
    // BASE WHERE (Vehicle table)
    // -----------------------------------------
    const baseWhere = {
      is_active: true,
    };

    // -----------------------------------------
    // GLOBAL SEARCH (matches ANY field)
    // NOTE:
    // - User has NO alias in your association, so use $User...$
    // - VehicleDetail alias IS "vehicleDetail", so use $vehicleDetail...$
    // -----------------------------------------
    const searchWhere = hasSearch
      ? {
          [Op.or]: [
            { registration_no: like },

            // User fields (no "as" used in include)
            { "$User.first_name$": like },
            { "$User.last_name$": like },
            ...(Number.isFinite(Number(q)) ? [{ "$User.id$": Number(q) }] : []),

            // VehicleDetail fields (aliased as "vehicleDetail")
            { "$vehicleDetail.make$": like },
            { "$vehicleDetail.model$": like },
          ],
        }
      : {};

    // -----------------------------------------
    // INCLUDE
    // IMPORTANT:
    // - User include must NOT specify "as"
    // - When searching across joined tables, set required: true
    //   so it becomes INNER JOIN and filters correctly.
    // -----------------------------------------
    const include = [
      {
        model: User,
        required: hasSearch, // filters when searching
        attributes: { exclude: ["password"] },
      },
      {
        model: VehicleDetail,
        as: "vehicleDetail",
        required: hasSearch, // filters when searching
      },
    ];

    // -----------------------------------------
    // GLOBAL ACCESS - ORGANIZATION = "*"
    // -----------------------------------------
    if (organizationId === "*") {
      const { count, rows } = await Vehicle.findAndCountAll({
        where: {
          ...baseWhere,
          ...searchWhere,
        },
        include,
        order: [["id", "DESC"]],
        limit,
        offset,
        distinct: true,
      });

      return {
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        vehicles: rows,
      };
    }

    // -----------------------------------------
    // Validate Organization
    // -----------------------------------------
    const organization = await Organization.findOne({ where: { id: organizationId } });
    if (!organization) throw new Error("Invalid Organization");

    // -----------------------------------------
    // Fetch Permissions (for this org)
    // -----------------------------------------
    const permissions = await Permission.findAll({
      where: { value: organizationId.toString() },
    });

    const permissionIds = permissions.map((p) => p.id);
    if (!permissionIds.length) return { totalCount: 0, totalPages: 0, vehicles: [] };

    // -----------------------------------------
    // Fetch Policies containing these permissions
    // -----------------------------------------
    const policies = await Policy.findAll({
      where: { permissions: { [Op.overlap]: permissionIds } },
    });

    const policyIds = policies.map((p) => p.id);
    if (!policyIds.length) return { totalCount: 0, totalPages: 0, vehicles: [] };

    // -----------------------------------------
    // Fetch Roles containing these policies
    // -----------------------------------------
    const roles = await Role.findAll({
      where: { policies: { [Op.overlap]: policyIds } },
    });

    const roleIds = roles.map((r) => r.id);
    if (!roleIds.length) return { totalCount: 0, totalPages: 0, vehicles: [] };

    // -----------------------------------------
    // Users with allowed roles
    // (only fetch ids - faster)
    // -----------------------------------------
    const users = await User.findAll({
      where: { role_id: { [Op.in]: roleIds } },
      attributes: ["id"],
    });

    const userIds = users.map((u) => u.id);
    if (!userIds.length) return { totalCount: 0, totalPages: 0, vehicles: [] };

    // -----------------------------------------
    // Fetch Vehicles for allowed users + search
    // -----------------------------------------
    const { count, rows } = await Vehicle.findAndCountAll({
      where: {
        user_id: { [Op.in]: userIds },
        ...baseWhere,
        ...searchWhere,
      },
      include,
      order: [["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return {
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      vehicles: rows,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "VehicleDAO.findAllVehicles",
      error_message: `VehicleDAO.findAllVehicles DAO error - ${error.message}.`,
    });
    console.error("DAO Error in findAllVehicles:", error);
    throw error;
  }
},

  // Fetch Vehicles for a Specific Customer
  findAllVehiclesOfUser: async (user_id) => {
    try {
      const vehicles = await Vehicle.findAll({
        where: { user_id, is_active: true },
        include: [
          {
            model: VehicleDetail,
            as: "vehicleDetail",
          },
        ],
        order: [["createdAt", "DESC"]], // Order by creation date
      });
      return vehicles;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "VehicleDAO.findAllVehiclesOfUser",
        error_message: `VehicleDAO.findAllVehiclesOfUser DAO error - ${error.message}.`,
      });
      console.error("DAO Error: Unable to fetch vehicles", error);
      throw new Error("Database Error: Unable to fetch vehicles");
    }
  },

  getById: async (id) => {
    return await Vehicle.findByPk(id);
  },

  // Update vehicle
  update: async (id, vehicleData) => {
    const vehicle = await Vehicle.findByPk(id);
    if (!vehicle) throw new Error("Vehicle not found");

    const { vehicleDetails, ...vehicleInfo } = vehicleData;
    await vehicle.update(vehicleInfo);

    if (vehicleDetails) {
      const detail = await VehicleDetail.findOne({ where: { vehicle_id: id } });
      if (detail) {
        await detail.update(vehicleDetails);
      } else {
        await VehicleDetail.create({ vehicle_id: id, ...vehicleDetails });
      }
    }

    return await Vehicle.findByPk(id, {
      include: [{ model: VehicleDetail, as: "vehicleDetail" }],
    });
  },

  // Delete Vehicle for customer
  delete: async (id) => {
    // Find vehicle by primary key
    const vehicle = await Vehicle.findByPk(id, {
      include: [{ model: VehicleDetail, as: "vehicleDetail" }],
    });

    if (!vehicle) throw new Error("Vehicle not found");

    // Soft delete: Update is_active and mask registration_no
    await vehicle.update({
      is_active: false,
      registration_no: `deleted-${vehicle.id}`, // Mask registration number
    });

    // If there is an associated VehicleDetail, clear its fields
    if (vehicle.vehicleDetail) {
      await vehicle.vehicleDetail.update({
        color: 'deleted',
        fuel_type: null,
        make: 'deleted',
        model: 'deleted',
        media_data: null,
      });
    }

    return { message: "Vehicle soft deleted successfully" };
  },

  getActiveRidesForVehicle: async (vehicleId) => {
    if (typeof vehicleId !== "string") {
      vehicleId = String(vehicleId);
    }
  
    // Define active statuses for each ride type
    const instantActiveStatuses = [
      "Requested",
      "Accepted",
      "Started",
      "Reached Customer",
      "Payment Initiated",
      "Review-Pending"
    ];
  
    const scheduledActiveStatuses = [
      "Accepted",
      "Started",
      "Reached Customer",
      "Payment Initiated",
      "Review-Pending"
    ];
  
    // Note: This query assumes that each ride item has a "ride_type" attribute.
    // The filter below checks:
    //  - For instant rides (ride_type = "instant"), the status must be in instantActiveStatuses.
    //  - For scheduled rides (ride_type = "scheduled"), the status must be in scheduledActiveStatuses.
    const params = {
      TableName: "Rides",
      IndexName: "vehicle_id_index",
      KeyConditionExpression: "#vehicle_id = :vehicleId",
      FilterExpression: "((#ride_type = :instant AND #status IN (:req, :acc, :sta, :reached, :pay, :review)) OR (#ride_type = :scheduled AND #status IN (:acc2, :sta2, :reached2, :pay2, :review2)))",
      ExpressionAttributeNames: {
        "#vehicle_id": "vehicle_id",
        "#status": "status",
        "#ride_type": "ride_type"
      },
      ExpressionAttributeValues: {
        ":vehicleId": vehicleId,
        // Instant ride statuses (includes "Requested")
        ":req": instantActiveStatuses[0],
        ":acc": instantActiveStatuses[1],
        ":sta": instantActiveStatuses[2],
        ":reached": instantActiveStatuses[3],
        ":pay": instantActiveStatuses[4],
        ":review": instantActiveStatuses[5],
        // Scheduled ride statuses (excludes "Requested")
        ":acc2": scheduledActiveStatuses[0],
        ":sta2": scheduledActiveStatuses[1],
        ":reached2": scheduledActiveStatuses[2],
        ":pay2": scheduledActiveStatuses[3],
        ":review2": scheduledActiveStatuses[4],
        // Ride type indicators
        ":instant": "instant",
        ":scheduled": "scheduled"
      }
    };
  
    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      
      // Process the returned rides to determine booking availability.
      // For example, if any instant ride (ride_type === "instant") with "Requested" exists, block a new booking.
      const activeRides = response.Items || [];
      const instantRideActive = activeRides.find(ride => ride.ride_type === "instant" && ride.status === "Requested");
  
      if (instantRideActive) {
        console.log("An active instant ride is already in progress. Blocking new booking.");
        // Handle blocking new booking as needed.
      } else {
        console.log("No blocking instant rides found. Allowing booking.");
        // Proceed to allow new ride booking.
      }
  
      return activeRides;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "VehicleDAO.getActiveRidesForVehicle",
        error_message: `VehicleDAO.getActiveRidesForVehicle DAO error - ${error.message}.`,
      });
      console.error("Error fetching active rides for vehicle:", error);
      return [];
    }
  },
  

  getOverlappingRidesForVehicle: async (vehicleId, newScheduledTime, estimatedTimeInMinutes) => {
    if (typeof vehicleId !== "string") {
      vehicleId = String(vehicleId);
    }

    const activeStatuses = [
      "Requested",
      "Accepted",
      "Started",
      "Reached Customer",
      "Payment Initiated",
      "Review-Pending"
    ];

    const params = {
      TableName: "Rides",
      IndexName: "vehicle_id_index",
      KeyConditionExpression: "#vehicle_id = :vehicleId",
      FilterExpression: "#status IN (:status1, :status2, :status3, :status4, :status5, :status6)",
      ExpressionAttributeNames: {
        "#vehicle_id": "vehicle_id",
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":vehicleId": vehicleId,
        ":status1": activeStatuses[0],
        ":status2": activeStatuses[1],
        ":status3": activeStatuses[2],
        ":status4": activeStatuses[3],
        ":status5": activeStatuses[4],
        ":status6": activeStatuses[5],
      }
    };

    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      const items = response.Items || [];

      const newTime = new Date(newScheduledTime);
      const windowStart = new Date(newTime.getTime() - 30 * 60 * 1000); // 30 minutes before starting
      const windowEnd = new Date(newTime.getTime() + (estimatedTimeInMinutes + 30) * 60 * 1000); // estimated ride duration + 30 minutes

      const overlappingRides = items.filter((ride) => {
        let rideStartTime, rideEndTime;

        if (ride.ride_type === "scheduled" && ride.scheduled_pickup) {
          rideStartTime = new Date(ride.scheduled_pickup);
        } else if (ride.ride_type === "instant" && ride.order_date) {
          rideStartTime = new Date(ride.order_date);
        } else {
          return false;
        }

        // Calculate estimated ride end time
        const rideEstimatedTime = ride.estimated_time_in_minutes || 0;
        rideEndTime = new Date(rideStartTime.getTime() + rideEstimatedTime * 60 * 1000);

        // Check if there is an overlap
        return !(rideEndTime < windowStart || rideStartTime > windowEnd);
      });

      return overlappingRides;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "VehicleDAO.getOverlappingRidesForVehicle",
        error_message: `VehicleDAO.getOverlappingRidesForVehicle DAO error - ${error.message}.`,
      });
      console.error("Error fetching overlapping rides for vehicle:", error);
      return [];
    }
  },

  findAllVehiclesOfOrganization: async (organizationId) => {
    try {
      // Global access: return all vehicles if the organizationId is "*"
      // if (organizationId === '*') {
      //   const { count, rows } = await Vehicle.findAndCountAll({
      //     where: { is_active: true },
      //     include: [
      //       { model: User, as: 'User' },
      //       { model: VehicleDetail, as: 'vehicleDetail' }
      //     ],
      //     order: [['id', 'DESC']],
      //     limit,
      //     offset
      //   });

      //   return {
      //     totalCount: count,
      //     totalPages: Math.ceil(count / limit),
      //     vehicles: rows
      //   };
      // }

      // 1. Validate the organization exists.
      const organization = await Organization.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new Error('Invalid Organization');
      }

      // 2. Get permissions that either explicitly match this organization id or are global.
      const permissions = await Permission.findAll({
        where: {
          value: organizationId.toString(),
        },
      });
      const permissionIds = permissions.map(p => p.id);
      if (permissionIds.length === 0) {
        return { vehicles: [] }; // No matching permissions found.
      }

      // 3. Get policies that include any of these permission IDs.
      const policies = await Policy.findAll({
        where: {
          permissions: {
            [Op.overlap]: permissionIds, // Using PostgreSQL array overlap operator.
          },
        },
      });
      const policyIds = policies.map(p => p.id);
      if (policyIds.length === 0) {
        return { vehicles: [] }; // No matching policies found.
      }

      // 4. Get roles that include any of these policy IDs.
      const roles = await Role.findAll({
        where: {
          policies: {
            [Op.overlap]: policyIds,
          },
        },
      });
      const roleIds = roles.map(r => r.id);
      if (roleIds.length === 0) {
        return {  vehicles: [] }; // No matching roles found.
      }

      // 5. Get users whose role_id is in the list of eligible roles.
      const users = await User.findAll({
        where: {
          role_id: {
            [Op.in]: roleIds,
          },
        },
        attributes: { exclude: ["password"] }
      });
      const userIds = users.map(u => u.id);
      if (userIds.length === 0) {
        return { vehicles: [] }; // No users found with the eligible roles.
      }

      // 6. Fetch vehicles for these users with pagination
      const { count, rows } = await Vehicle.findAndCountAll({
        where: {
          user_id: {
            [Op.in]: userIds,
          },
          is_active: true
        },
        include: [
          { model: User, as: 'User' },
          { model: VehicleDetail, as: 'vehicleDetail' },
        ],
        order: [['id', 'DESC']],
        //limit,
        //offset
      });

      return {
        //totalCount: count,
        //totalPages: Math.ceil(count / limit),
        vehicles: rows
      };

    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "VehicleDAO.findAllVehicles",
        error_message: `VehicleDAO.findAllVehicles DAO error - ${error.message}.`,
      });
      console.error("DAO Error in findAllVehicles:", error);
      throw error;
    }
  },
  getPlateFormats : async () => {
    try {
     //console.log("getPlateFormats");
      const results = await UserPlate.findAll({raw: true});
      //console.log("results",results);
      return results;
    } catch (error) {
     // console.log("Error fetching plate formats:", error);
      console.error("Error fetching plate formats:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPlateFormats",
        error_message: `Error fetching plate formats: ${error.message}`,
      });
      throw error;
    }
  },
  addNewRegion: async (data) => {
    try {
      const response = await UserPlate.create(data);
      return response;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "addNewRegion",
        error_message: `Error adding new region DAO: ${error.message}`,
      });
      console.error("Error adding new region DAO:", error);
      throw error;
    }
  },
  editRegion: async (data) => {
    try {
      const [affectedRows] = await UserPlate.update(data, {
        where: { emirate_name: data.emirate_name }
      });
  
      if (affectedRows === 0) {
        throw new Error(`No region found with emirate_name: ${data.emirate_name}`);
      }
  
      const result = await UserPlate.findOne({
        where: { emirate_name: data.emirate_name }
      });
  
      return result;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "editRegion",
        error_message: `Error editing region DAO: ${error.message}`,
      });
      console.error("Error editing region DAO:", error);
      throw error;
    }
  },
  getPlateCodeRegion: async () => {
    try {
      const results = await UserPlate.findAll({raw: true});
      return results;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPlateCodeRegion",
        error_message: `Error fetching plate code region dao: ${error.message}`,
      });
      console.error("Error fetching plate code region dao:", error);
      throw error;
    }
  },

/**
 * Returns true if the vehicle with `vehicleId` is active and assigned to a user
 * who has access to the given organization, false otherwise.
 */
isVehicleInOrganization: async (organizationId, vehicleId) => {
  try {
    // 1. Make sure the org exists
    const organization = await Organization.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new Error('Invalid Organization');
    }

    // 2. Find all permissions for this org
    const permissions = await Permission.findAll({
      where: { value: organizationId.toString() },
    });
    const permissionIds = permissions.map(p => p.id);
    if (permissionIds.length === 0) {
      return false;
    }

    // 3. Find policies that include any of those permissions
    const policies = await Policy.findAll({
      where: { permissions: { [Op.overlap]: permissionIds } },
    });
    const policyIds = policies.map(p => p.id);
    if (policyIds.length === 0) {
      return false;
    }

    // 4. Find roles that include any of those policies
    const roles = await Role.findAll({
      where: { policies: { [Op.overlap]: policyIds } },
    });
    const roleIds = roles.map(r => r.id);
    if (roleIds.length === 0) {
      return false;
    }

    // 5. Find users in those roles
    const users = await User.findAll({
      where: { role_id: { [Op.in]: roleIds } },
      attributes: ['id'],
    });
    const userIds = users.map(u => u.id);
    if (userIds.length === 0) {
      return false;
    }

    // 6. Finally, check for an active vehicle record matching both vehicleId and one of those users
    const count = await Vehicle.count({
      where: {
        id: vehicleId,
        user_id: { [Op.in]: userIds },
        is_active: true,
      },
    });

    return count > 0;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "VehicleDAO.isVehicleInOrganization",
      error_message: `VehicleDAO.isVehicleInOrganization DAO error - ${error.message}.`,
    });
    console.error("DAO Error in isVehicleInOrganization:", error);
    throw error;
  }
},

};
