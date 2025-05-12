const express = require('express');
const router = express.Router();
const trasladoController = require('../controllers/traslado.controller');

router.get('/clientes', trasladoController.getTrasladosClientesPaginados);
router.post('/clientes', trasladoController.createClienteTrasladoMasivo);

module.exports = router;