const express = require('express');
const router = express.Router();
const vehiculoController = require('../controllers/vehiculo.controller');
const verifyToken = require('../utils/verifyToken');

// Crear un vehículo
router.post('/', verifyToken, vehiculoController.createVehiculo);

// Obtener todos los vehículos paginados
router.get('/', verifyToken, vehiculoController.getAll);

// Obtener un vehículo por ID
router.get('/:id', verifyToken, vehiculoController.getVehiculoById);

// Editar un vehículo
router.put('/:id', verifyToken, vehiculoController.updateVehiculo);

// Eliminar un vehículo
router.delete('/:id', verifyToken, vehiculoController.deleteVehiculo);

module.exports = router;