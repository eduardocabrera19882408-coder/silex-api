const express = require('express');
const router = express.Router();
const rutaController = require('../controllers/ruta.controller');
const verifyToken = require('../utils/verifyToken');

// Crear una nueva ruta
router.post('/', verifyToken, rutaController.createRuta);

// Obtener todas las rutas con paginación
router.get('/', verifyToken, rutaController.getAllRutas);

// Endpoint para obtener rutas por oficina con paginación
router.get('/oficina/:oficinaId', verifyToken, rutaController.getRutasByOficina);

// Endpoint para buscar rutas por nombre
router.get('/search', verifyToken, rutaController.searchRutasByName);

// Endpoint para obtener rutas por usuario
router.get('/usuario/:usuarioId', verifyToken, rutaController.getRutasByUsuario);

// GET /api/cobradores/:id/ruta
router.get('/:id/ruta', rutaController.getRutaDelCobrador);

// Obtener una ruta por ID
router.get('/:id', verifyToken, rutaController.getRutaById);

// Editar una ruta
router.put('/:id', verifyToken, rutaController.updateRuta);

// Eliminar una ruta
router.delete('/:id', verifyToken, rutaController.deleteRuta);

module.exports = router;