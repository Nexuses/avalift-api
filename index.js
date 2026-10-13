require('dotenv').config(); // Load environment variables first!

const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./src/routes');
const errorHandler = require('./src/middlewares/errorHandler');
const { sequelize } = require('./src/dto');  // This requires DB config
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors'); // Import CORS package
const logger = require('./src/helpers/logger');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5050;

// Security Middleware
app.use(helmet());

// Enable CORS and allow all origins
app.use(cors());

// Rate Limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests from this IP, please try again after 15 minutes',
// });
// app.use(limiter);

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api`,
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Logging Middleware
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api', routes);
//entry point
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, './src/assets', 'index.html');
  res.sendFile(filePath);
});

app.get('/delete-instructions', (req, res) => {
  const filePath = path.join(__dirname, './src/assets', 'deleteInstructions.html');
  res.sendFile(filePath);
});

app.use('/img', express.static(path.join(__dirname, './src/assets')));
app.use('/uploads', express.static('src/uploads', {
  setHeaders: (res, path) => {
      if (path.endsWith('.jpg')) {
          res.set('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
          res.set('Content-Type', 'image/png');
      }
  }
}));

// Error Handling Middleware
app.use(errorHandler);

// Start Server after DB connection
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connected...');
    return sequelize.sync({ alter: true }); // Sync models to DB
  })
  .then(() => {
    console.log('Database synchronized...');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });
