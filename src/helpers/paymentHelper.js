require('dotenv').config();
const path = require('path');
const getCountryNameByCode = async (countryCode) => {
    const countryCodeMapping = {
        '+91': 'IN',
        '1': 'US',
        '44': 'GB',
        '+971': 'AE'
    };
    return countryCodeMapping[countryCode] || 'Unknown';
};

const getCardLogoUrl = async (card_type) => {
    //const folderPath = process.env.ASSETS_FOLDER_PATH;
    const folderPath = `${process.env.API_URL}/img/`;
    let logoUrl;
    if (card_type.toLowerCase().includes('visa')) {
        logoUrl = `${folderPath}visa.png`;
    }
    else if (card_type.toLowerCase().includes('amex')) {
        logoUrl = `${folderPath}amex.png`;
    }
    else if (card_type.toLowerCase().includes('mastercard')) {
        logoUrl = `${folderPath}mastercard.png`;
    }
    else if (card_type.toLowerCase().includes('unionpay')) {
        logoUrl = `${folderPath}unionpay.png`;
    }
    return logoUrl;
}

const getPaymentStatusName = async (name) => {
    const statusNameMapping = {
        'Wallet-Credit': 'Wallet',
        'Card-Debit': 'Card',
        'Wallet-Debit': 'Wallet',
        'Cash-Debit': 'Cash',
        'Cancel-Ride-Penality': 'Cancel-Ride-Penality'
    };
    return statusNameMapping[name] || 'Unknown';
};


const generateRandomAlphaNumericText = async (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let output = '';
    for (let i = 0; i < length; i++) {
        output += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return output;
}
module.exports = {
    getCountryNameByCode,
    getCardLogoUrl,
    getPaymentStatusName,
    generateRandomAlphaNumericText
};
