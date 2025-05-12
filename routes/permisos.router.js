const express = require('express');
const router = express.Router();
const permisoController = require('../controllers/permiso.controller');
const verifyToken = require('../utils/verifyToken');

router.post('/', verifyToken, permisoController.create);
router.get('/', verifyToken, permisoController.getAll);
router.get('/:id', verifyToken, permisoController.getById);
router.get('/:id/usuarios', verifyToken, permisoController.getUsuariosByPermiso);
router.put('/:id', verifyToken, permisoController.update);
router.delete('/:id', verifyToken, permisoController.delete);

module.exports = router;
