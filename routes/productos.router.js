const express = require('express');
const router = express.Router();
const productoController = require('../controllers/producto.controller');
const verifyToken = require('../utils/verifyToken');

// Crear un producto con rutas
router.post('/', verifyToken, productoController.createProducto);

// Obtener todos los productos con paginación
router.get('/', verifyToken, productoController.getAllProductos);

//Obtener productos por ruta
router.get('/ruta/:rutaId', verifyToken, productoController.getProductosByRutaId);

// Ruta para buscar productos por nombre
router.get('/search', verifyToken, productoController.searchProductos);

// Obtener un producto por ID (incluye las rutas asociadas)
router.get('/:id', verifyToken, productoController.getProductoById);

// Editar un producto con rutas
router.put('/:id', verifyToken, productoController.updateProducto);

// Archivar un producto
router.put('/:id/archive', verifyToken, productoController.archiveProducto);

module.exports = router;