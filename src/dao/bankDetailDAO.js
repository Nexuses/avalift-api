// src/dao/bankDetailDAO.js
const { BankDetail } = require('../dto');
const { Op } = require('sequelize');

module.exports = {
  create: async (data, transaction) => {
    return await BankDetail.create(data, { transaction });
  },

  findById: async (id) => {
    return await BankDetail.findOne({ where: { id } });
  },

  findByAccountNumber: async (account_number) => {
    return await BankDetail.findOne({ where: { account_number } });
  },

  updateById: async (id, updates, transaction) => {
    await BankDetail.update(updates, { where: { id }, transaction });
    return await BankDetail.findOne({ where: { id }, transaction });
  },

  softDeleteById: async (id) => {
    // this will set deletedAt to now
    const checkBankDetail = await BankDetail.findOne({ where: { id } });
    if (!checkBankDetail) {
      throw new Error('BankDetail not found');
    }
    const del_account_number = "deleted__" + id;
    await BankDetail.update({ account_number: del_account_number }, { where: { id } });
    return await BankDetail.destroy({ where: { id } });
  },

   unsetAllDefault: async (transaction) =>{
    return await BankDetail.update(
      { default: false },
      { where: { default: true }, transaction }
    );
  },
   geAllBankDetails: async()=>{
    return await BankDetail.findAll({
        order: [
            ['default', 'DESC'], 
            ['id', 'DESC'] 
          ]
   })
   },

   getDefaultBankDetail: async(transaction)=>{
    return await BankDetail.findOne({where:{default:true}, transaction})
   },

   getDefaultBankAccount: async()=>{
    return await BankDetail.findOne({where:{default:true}})
   },

   
 findAllOtherDefaults: async(currentId, transaction) => {
    return await BankDetail.findAll({
      where: {
        default: true,
        id: { [Op.ne]: currentId }
      },
      transaction
    });
  },
  
};
