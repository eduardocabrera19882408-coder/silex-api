const express = require("express");
const router = require('./routes');
const helmet = require('helmet');
const app = express();
require("dotenv").config();

const cors = require('cors');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Lista de orígenes permitidos
const allowedOrigins = ['http://localhost:5173', 'http://localhost:2222', 'http://192.168.0.109:2222'];
// const allowedOrigins = ['https://silex-app-cobradores.netlify.app','https://inspiring-hamster-44b57d.netlify.app'];
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como en curl o servidores internos)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('No permitido por CORS'));
    }
  },
  credentials: false // si usas cookies o auth headers
}));

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
  apis: ['./routes/*.js'],
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

// Middleware para procesar JSON
app.use(express.json());

// Todas las rutas
app.use('/api/v1', router)
// Ruta principal
app.get("/", (req, res) => {
  res.send("Sistema de Préstamos API");
});

module.exports = app