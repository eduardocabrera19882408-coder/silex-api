const express = require('express');
const router = express.Router();
const CajaController = require('../controllers/caja.controller');
const verifyToken = require('../utils/verifyToken');

// Ruta para obtener los egresos (endpoint administracion)
router.get('/allegresos', verifyToken, CajaController.getAllEgresos);
// Ruta para agregar saldo a la caja de un usuario
router.post('/addsaldo', verifyToken, CajaController.agregarSaldo);
// Ruta para asignar saldo a administrador de oficina
router.post('/asignar-saldo-oficina', verifyToken, CajaController.asignarSaldoAOficina);
// Ruta para registrar egreso
router.post('/egreso', verifyToken, CajaController.crearEgreso);
// Ruta para obtener egresos del dia por usuario
router.get('/egresos-dia', verifyToken, CajaController.getEgresosDia);
//Ruta para aprobar ingreso
router.put('/aprobar/:id', verifyToken, CajaController.aprobarEgreso);
//Ruta para rechazar un egreso
router.put('/rechazar/:id', verifyToken, CajaController.rechazarEgreso);
//Ruta para cerrar caja
router.post('/cerrar-caja', verifyToken, CajaController.cerrarCaja);
// Ruta para obtener movimientos por caja id
router.get('/movimientos', verifyToken, CajaController.getMovimientosByCajaAndFecha);
// Ruta para obtener caja por id
router.get('/user/:id', verifyToken, CajaController.getCajaByUserId);
// Ruta para obtener caja por id
router.get('/:id', verifyToken, CajaController.getCajaById);

module.exports = router;