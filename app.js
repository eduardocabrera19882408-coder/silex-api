const express = require("express");
const router = require('./routes');
const helmet = require('helmet');
const app = express();
require("dotenv").config();

const cors = require('cors');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Definir la configuración para Swagger (Documentación)
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Prestamos',
      version: '1.0.0',
      description: 'Documentación de la API de Prestamos',
    },
  },
  apis: ['./routes/*.js'], // Ruta a las rutas donde están los comentarios de Swagger
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Configurar la ruta para acceder a la documentación de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
//Fin de la documentación

// Aumenta el límite de tamaño del cuerpo de la solicitud
app.use(express.json({ limit: "10mb" })); // Aumenta el límite a 10MB
app.use(express.urlencoded({ limit: "10mb", extended: true })); 

app.use(helmet({
    crossOriginResourcePolicy: false,
}));
const allowedOrigins = ['https://autentic.ec', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Middleware para procesar JSON
app.use(express.json());

// Todas las rutas
app.use('/api/v1', router)
// Ruta principal
app.get("/", (req, res) => {
  res.send("Sistema de Préstamos API");
});

module.exports = app