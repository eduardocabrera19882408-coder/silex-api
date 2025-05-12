const express = require('express');
const creditoController = require('../controllers/credito.controller');
const verifyToken = require('../utils/verifyToken');

const router = express.Router();

router.post('/', verifyToken, creditoController.createCredito);
router.get('/', verifyToken, creditoController.getAllCreditos);
router.get('/datadash', verifyToken, creditoController.getDataDash);
router.get("/creditos-impagos", verifyToken, creditoController.getCreditosImpagos);
router.get('/:id', verifyToken, creditoController.getCreditoById);
router.put('/:id', verifyToken, creditoController.updateCredito);
router.delete('/:id', verifyToken, creditoController.deleteCredito);

module.exports = router;
