
const { RateType, Sequelize } = require('../dto');
const { addServerLog } = require("../services/serverLogsService");
const { Op, fn, col, where } = require('sequelize');

module.exports = {
  findByTypeNames: async (typeNames) => {
    try {
      return await RateType.findAll({
        where: { type_name: typeNames },
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByTypeNames",
        error_message: `findByTypeNames DAO error - ${error.message}.`,
      });
    throw error;
  }
  },

  getRideRateTypes: async () => {
    try {
      return await RateType.findAll({
        attributes: ['type_category', 'type_name', 'display_name', 'duration_hours']
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideRateTypes",
        error_message: `getRideRateTypes DAO error - ${error.message}.`,
      });
      throw error;
    }
  },
  createRideRateType: async (rateTypeInfo) => {
    try {
      const typeName = rateTypeInfo.type_name.toLowerCase();
      const rateTypeExisting = await RateType.findOne({
        where:
        {
          [Op.and]: [
            Sequelize.where(
              fn('LOWER', col('type_name')),
              'ilike',
              typeName)
          ]
        },
        attributes: ['id', 'type_name']
      });

      if (!rateTypeExisting) {
        const newRideRateType = await RateType.create({
          type_category: rateTypeInfo.type_category,
          type_name: rateTypeInfo.type_name,
          display_name: rateTypeInfo.display_name,
          duration_hours: rateTypeInfo.duration_hours
        });

        return newRideRateType.id;
      }
    } catch (error) {
      console.log(error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createRideRateType",
        error_message: `createRideRateType DAO error - ${error.message}.`,
      });
      throw error;
    }
  },
  updateRideRateType: async (rateTypeInfo) => {
    try {
      const typeName = rateTypeInfo.type_name.toLowerCase();

      const rateTypeExisting = await RateType.findOne({
        where:
        {
          [Op.and]: [
            Sequelize.where(
              fn('LOWER', col('type_name')),
              'ilike',
              typeName)
          ]
        },
        attributes: ['id', 'type_name']
      });

      if (rateTypeExisting) {
        return await rateTypeExisting.update({
          type_category: rateTypeInfo.type_category,
          type_name: rateTypeInfo.type_name,
          display_name: rateTypeInfo.display_name,
          duration_hours: rateTypeInfo.duration_hours
        })
      }

    } catch (error) {
      console.log(error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateRideRateType",
        error_message: `updateRideRateType DAO error - ${error.message}.`,
      });
      throw error;
    }
  }
};

