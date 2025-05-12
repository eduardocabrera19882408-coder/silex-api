const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reportes.controller');
const verifyToken = require('../utils/verifyToken');

// Crear un producto con rutas
router.get('/estado-cuenta', verifyToken, reporteController.getEstadoCuenta);

module.exports = router;