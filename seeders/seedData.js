require('dotenv').config();

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// DynamoDB Client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

// Data to seed
const seedData = [
  { brand: 'Toyota', model: 'Corolla' },
  { brand: 'Toyota', model: 'Camry' },
  { brand: 'Toyota', model: 'RAV4' },
  { brand: 'Honda', model: 'Civic' },
  { brand: 'Honda', model: 'Accord' },
  { brand: 'Honda', model: 'CR-V' },
  { brand: 'Ford', model: 'Focus' },
  { brand: 'Ford', model: 'Fusion' },
  { brand: 'Ford', model: 'Escape' },
  { brand: 'BMW', model: '3 Series' },
  { brand: 'BMW', model: 'X5' },
  { brand: 'BMW', model: '5 Series' },
  { brand: 'Mercedes', model: 'C-Class' },
  { brand: 'Mercedes', model: 'E-Class' },
  { brand: 'Mercedes', model: 'GLC' },
  { brand: 'Tesla', model: 'Model S' },
  { brand: 'Tesla', model: 'Model 3' },
  { brand: 'Tesla', model: 'Model X' },
  { brand: 'Nissan', model: 'Altima' },
  { brand: 'Nissan', model: 'Rogue' },
  { brand: 'Nissan', model: 'Sentra' },
  { brand: 'Chevrolet', model: 'Malibu' },
  { brand: 'Chevrolet', model: 'Equinox' },
  { brand: 'Chevrolet', model: 'Silverado' },
  { brand: 'Hyundai', model: 'Elantra' },
  { brand: 'Hyundai', model: 'Tucson' },
  { brand: 'Hyundai', model: 'Santa Fe' },
  { brand: 'Kia', model: 'Sportage' },
  { brand: 'Kia', model: 'Sorento' },
  { brand: 'Kia', model: 'Optima' },
];

// Function to chunk data into batches of 25
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Seed data into DynamoDB
const seedToDynamoDB = async () => {
  const chunks = chunkArray(seedData, 25); // Split data into chunks of 25
  for (const chunk of chunks) {
    const params = {
      RequestItems: {
        VehicleMaster: chunk.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    };

    try {
      console.log('Seeding chunk:', JSON.stringify(params, null, 2));
      const command = new BatchWriteCommand(params);
      const result = await client.send(command);
      console.log('Chunk seeded successfully:', result);
    } catch (error) {
      console.error('Error seeding chunk:', error.message);
    }
  }
};

// Execute the script
seedToDynamoDB();
