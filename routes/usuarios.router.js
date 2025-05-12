const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuario.controller');
const verifyToken = require('../utils/verifyToken');

// Crear un nuevo usuario
router.post('/', verifyToken, usuarioController.createUsuario);

// Obtener todos los usuarios con paginación
router.get('/', verifyToken, usuarioController.getAllUsuarios);

// Buscar usuarios por sus datos
router.get('/search', verifyToken, usuarioController.searchUsuarios);

// Obtener usuarios por oficina con paginación
router.get('/oficina/:oficinaId', verifyToken, usuarioController.getUsuariosByOficina);

// Obtener un usuario por ID
router.get('/:id', verifyToken, usuarioController.getUsuarioById);

// Archivar un usuario
router.put('/:id/archive', verifyToken, usuarioController.archiveUsuario);

// desarchivar un usuario
router.put('/:id/desarchive', verifyToken, usuarioController.DesarchiveUsuario);

// Editar un usuario por ID
router.put('/:id', verifyToken, usuarioController.editUsuario);

module.exports = router;
