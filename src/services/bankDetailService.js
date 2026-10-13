// src/services/bankDetailService.js
const bankDetailDAO = require('../dao/bankDetailDAO');
const bankDetailsValidator = require('../validators/bankDetailsValidator');
const { sequelize } = require('../dto');

async function createBankDetail(data) {
    const t = await sequelize.transaction();
  
    try {
      const { error, value } = bankDetailsValidator.createBankDetailSchema.validate(data, { abortEarly: false });
      if (error) {
        const validationMessages = error.details.map(detail => detail.message).join(', ');
        throw Object.assign(new Error(`Validation error: ${validationMessages}`), { statusCode: 400 });
      }
  
      const { account_number, default: is_default } = value;

      //console.log("Account Number:", account_number);
  
      const existingBankDetail = await bankDetailDAO.findByAccountNumber(account_number);
      if (existingBankDetail) {
        throw Object.assign(new Error('BankDetail already exists'), { statusCode: 409 });
      }
  
      // Unset all existing default entries if new one is to be default
      if (is_default === true) {
        await bankDetailDAO.unsetAllDefault(t);
      }
  
      const created = await bankDetailDAO.create(value, t);
  
      await t.commit();
      return created;
  
    } catch (error) {
      await t.rollback();
      console.error('Transaction failed in createBankDetail:', error.message);
      throw error;
    }
  }

async function getBankDetailById(data) {
  const { id } = data;
  const record = await bankDetailDAO.findById(id);
  if (!record) throw Object.assign(new Error('BankDetail not found'), { statusCode: 404 });
  return record;
}

async function updateBankDetail(id, data) {
    const t = await sequelize.transaction();
  
    try {
      const { error, value } = bankDetailsValidator.updateBankDetailSchema.validate(data, { abortEarly: false });
      if (error) {
        const validationMessages = error.details.map(detail => detail.message).join(', ');
        throw Object.assign(new Error(`Validation error: ${validationMessages}`), { statusCode: 400 });
      }
  
      const bankDetail = await bankDetailDAO.findById(id);
      if (!bankDetail) {
        throw Object.assign(new Error('BankDetail not found'), { statusCode: 404 });
      }
  
      // Prevent duplicate account number
      if (value.account_number) {
        const existing = await bankDetailDAO.findByAccountNumber(value.account_number);
        if (existing && existing.id !== id) {
          throw Object.assign(new Error('BankDetail with this account number already exists'), { statusCode: 409 });
        }
      }
  
      // Enforce default uniqueness
      if (value.default === true) {
        await bankDetailDAO.unsetAllDefault(t);
        value.default = true; // explicitly set this one
      }
  
      if (value.default === false && bankDetail.default === true) {
        // This is the only default and it's being turned off
        const others = await bankDetailDAO.findAllOtherDefaults(id, t); // new DAO method
        if (others.length === 0) {
          throw Object.assign(new Error('At least one account must remain as default'), { statusCode: 400 });
        }
      }
  
      const updated = await bankDetailDAO.updateById(id, value, t);
      await t.commit();
      return updated;
  
    } catch (error) {
      await t.rollback();
      console.error('Transaction failed in updateBankDetail:', error.message);
      throw error;
    }
  }

async function deleteBankDetail(id) {
  // ensure exists
  const checkBankDetail = await bankDetailDAO.findById(id);
  if (!checkBankDetail) {
    throw Object.assign(new Error('BankDetail not found'), { statusCode: 404 });
  }
  if (checkBankDetail.default) {
    throw Object.assign(new Error('Cannot delete default BankDetail'), { statusCode: 400 });
  }

  await bankDetailDAO.softDeleteById(id);
  return { message: 'Deleted successfully' };
}

async function getAllBankDetails() {
    const record = await bankDetailDAO.geAllBankDetails();
    if (!record) throw Object.assign(new Error('BankDetails not found'), { statusCode: 404 });
    return record;
}

module.exports = {
  createBankDetail,
  getBankDetailById,
  updateBankDetail,
  deleteBankDetail,
  getAllBankDetails
};
