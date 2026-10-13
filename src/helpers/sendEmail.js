// src/helpers/sendEmail.js

const nodemailer = require('nodemailer');

const sendEmail = async (email, subject, text) => {
  // Configure transporter with your email service
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASS, // Your email password or app-specific password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    text: text,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
