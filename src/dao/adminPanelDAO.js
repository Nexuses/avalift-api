const { User,Role } = require("../dto");
const { Op } = require("sequelize");
const { addServerLog } = require("../services/serverLogsService");
const { last } = require("pdf-lib");
require('dotenv').config();

const fetchDeviceIds = async () => {
  try {
    const users = await User.findAll({
      where: {
        role_id: {
        [Op.in]: [
          process.env.SUPER_ADMIN_ID,
          process.env.ADMIN_ID,
          process.env.OPERATOR_ID,
        ],
      },
        is_active: true,
        status_id: process.env.ACTIVE_STATUS_ID,
      },
      attributes: ["id", "device_id"],
    });

    return users.length > 0
      ? users.map(user => ({ user_id: user.id, device_id: user.device_id }))
      : [];
  } catch (error) {
    console.error("Error fetching device IDs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchDeviceIds",
      error_message: `fetchDeviceIds DAO error - ${error.message}.`
    });
    throw new Error("Failed to fetch device IDs");
  }
};

const getZiezzuAdmins = async () => {
  try {
    const roleNames = [
      'admin.zeizzu.super',
      'admin.zeizzu.normal',
      'admin.zeizzu.operator'
    ];

    // Get role IDs for ziezzu admin roles
    const roles = await Role.findAll({
      where: {
        name: {
          [Op.in]: roleNames
        }
      },
      attributes: ['id']
    });

    const roleIds = roles.map(role => role.id);

    // Get users with those role IDs
    const admins = await User.findAll({
      where: {
        role_id: {
          [Op.in]: roleIds
        }
      },
      attributes: ['id', 'first_name','last_name', 'email_id', 'role_id','device_id'],
    });

    return admins;

  } catch (error) {
    console.error('Error fetching avalift admins:', error);
    throw error;
  }
};

module.exports = { fetchDeviceIds,getZiezzuAdmins };
