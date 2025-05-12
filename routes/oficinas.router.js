const express = require('express');
const router = express.Router();
const oficinaController = require('../controllers/oficina.controller');
const verifyToken = require('../utils/verifyToken');

// Crear una oficina con rutas asociadas
router.post('/', verifyToken, oficinaController.createOficina);

// Obtener todas las oficinas con sus rutas
router.get('/', verifyToken, oficinaController.getAllOficinasByUser);

// Obtener todas las oficinas con sus rutas
router.get('/all', verifyToken, oficinaController.getAllOficinas);

// Buscar oficinas por nombre
router.get('/search', verifyToken, oficinaController.searchByName);

// Obtener una oficina por ID con rutas
router.get('/:id', verifyToken, oficinaController.getOficinaById);

// Editar una oficina y sus rutas
router.put('/:id', verifyToken, oficinaController.updateOficina);

// Eliminar una oficina
router.delete('/:id', verifyToken, oficinaController.deleteOficina);

module.exports = router;
