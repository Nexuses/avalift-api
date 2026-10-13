// src/helpers/sendSms.js
require('dotenv').config();
const config = require("../config/provider");
const axios = require("axios");
const { addServerLog } = require("../services/serverLogsService");

const sendSms = async (mobile_number, message) => {
  //Twilio Integration
  console.log(`Sending SMS to ${mobile_number}: ${message}`);
};

const sendSmsCountry = async (smsInfo, provider = config.defaultSmsProvider) => {
  if (provider === "smscountry") {

    const key = process.env.SMS_COUNTRY_KEY;
    const token = process.env.SMS_COUNTRY_TOKEN;
    const sendSMSUrl = `${process.env.SMS_COUNTRY_URL}/v0.1/Accounts/${key}/SMSes`;
    const senderId = process.env.SMS_COUNTRY_SENDER_ID;

    try {
      const payload = {
        Text: smsInfo.Text,
        Number: smsInfo.phoneNumber.replace(/\+/g, ""),
        SenderId: senderId,
        DRNotifyHttpMethod: "POST",
        Tool: "API",
      };
      let responseMessage;
      const combinedKey = `${key}:${token}`;
      await axios
        .post(sendSMSUrl, payload, {
          headers: {
            Authorization: `Basic ${Buffer.from(combinedKey).toString(
              "base64"
            )}`,
            "Content-Type": "application/json",
          },
        })
        .then(async (response) => {
          responseMessage = {
            errorMessage: "",
            statusCode: response.status,
            messageUUID: response.data.MessageUUID,
            phoneNumber: smsInfo.phoneNumber,
            messageStatus: response.data.Message,
            status: response.data.Success,
          };
        })
        .catch(async (error) => {
          if (error.response) {
            responseMessage = {
              errorMessage: error.response.data.Message,
              statusCode: error.response.status,
              messageUUID: error.response.data.MessageUUID,
              phoneNumber: smsInfo.phoneNumber,
              messageStatus: "",
              status: error.response.data.Success,
            };
          }
        });
      await addServerLog({
        log_level: "INFO",
        service_name: "sendSmsCountry",
        error_message: `send SMS country status for mobile ${smsInfo && smsInfo.phoneNumber
          } is ${responseMessage && responseMessage.status} - ${responseMessage && responseMessage.messageUUID
          }`,
      });
      return responseMessage;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "sendSmsCountry",
        error_message: `send SMS country failed for mobile ${smsInfo && smsInfo.phoneNumber
          } and error ${error.message}`,
      });
      throw error;
    }
  } else {
    await addServerLog({
      log_level: "ERROR",
      service_name: "sendSmsCountry",
      error_message: `SMS provider "${provider}" is not supported.`,
    });
    throw new Error(`SMS provider "${provider}" is not supported.`);
  }
}


module.exports = {
  sendSms,
  sendSmsCountry,
};
