module.exports = {
    defaultSmsProvider: process.env.DEFAULT_SMS_PROVIDER,
    sms: {
        smscountry: {
            url: process.env.SMS_COUNTRY_API_URL,
            authKey: process.env.SMS_COUNTRY_AUTH_KEY,
            senderId: process.env.SMS_COUNTRY_SENDER_ID,
            authToken: process.env.SMS_COUNTRY_AUTH_TOKEN
        },
    },
};