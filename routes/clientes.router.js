const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/cliente.controller');
const verifyToken = require('../utils/verifyToken');

// Crear un cliente
router.post('/', verifyToken, clienteController.createCliente);

// Obtener todos los clientes
router.get('/', verifyToken, clienteController.getAllClientes);

// Buscar clientes por datos con paginación
router.get('/buscar', verifyToken, clienteController.searchClientes);

// Obtener clientes archivados con paginación
router.get('/archivados', verifyToken, clienteController.getArchivedClientes);

// Obtener un cliente por ID
router.get('/:id', verifyToken, clienteController.getClienteById);

// Editar un cliente
router.put('/:id', verifyToken, clienteController.updateCliente);

// Archivar un cliente
router.put('/:id/archive', verifyToken, clienteController.archiveCliente);

// Obtener clientes por ruta
router.get('/ruta/:rutaId', verifyToken, clienteController.getClientesByRuta);

// Obtener clientes por oficina
router.get('/oficina/:oficinaId', verifyToken, clienteController.getClientesByOficina);

module.exports = router;
