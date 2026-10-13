// const AWS = require("aws-sdk");
const { PutObjectCommand,DeleteObjectCommand} = require("@aws-sdk/client-s3");
const s3 = require('../config/s3Client');
 require("dotenv").config();

// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });

const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await s3.send(command);
    const location = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    console.log("✅ Uploaded to S3:", location);
    return location;
  } catch (error) {
    console.error("❌ Error uploading to S3:", error);
    throw error;
  }
};

const deleteFromS3 = async (fileUrl) => {
  try {
    const key = fileUrl.split(`https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`)[1];
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });
    await s3.send(command);
    console.log(`✅ Deleted from S3: ${key}`);
  } catch (error) {
    console.error(`❌ Error deleting from S3: ${error}`);
    throw error;
  }
};

module.exports ={ uploadToS3,
  deleteFromS3,
};

