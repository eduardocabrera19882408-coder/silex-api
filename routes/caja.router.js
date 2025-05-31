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
// Ruta para registrar egreso Adm
router.post('/egreso-out', verifyToken, CajaController.crearEgresoAdm);
// Ruta para registrar ingreso Adm
router.post('/ingreso', verifyToken, CajaController.crearIngresoAdm);
// Ruta para obtener egresos del dia por usuario
router.get('/egresos-dia', verifyToken, CajaController.getEgresosDia);
//Obtener egresos por turno
router.get('/egresos-turno/:id', verifyToken, CajaController.getEgresosByTurno);
//Obtener comprobante por id
router.get('/comprobante/:id', verifyToken, CajaController.getComprobanteById);
//Obtener abonos por turno
router.get('/abonos-turno/:id', verifyToken, CajaController.getAbonosByTurno);
//Obtener abonos validos por turno
router.get('/abonosValid-turno/:id', verifyToken, CajaController.getValidAbonosByTurno);
//Ruta para aprobar egreso
router.put('/aprobar-egreso/:id', verifyToken, CajaController.aprobarEgreso);
//Ruta para rechazar un egreso
router.put('/rechazar-egreso/:id', verifyToken, CajaController.rechazarEgreso);
//Ruta para anular un abono
router.post('/anular-abono', verifyToken, CajaController.anularAbono);
//Ruta para cerrar caja
router.post('/cerrar-caja', verifyToken, CajaController.cerrarCaja);
//Ruta para cerrar caja
router.post('/bloquear-caja', verifyToken, CajaController.bloquearCaja);
//Ruta para abrir caja
router.post('/abrir-caja', verifyToken, CajaController.abrirCaja);
//Ruta para obtener turno por id de caja
router.get('/turno/:id', verifyToken, CajaController.getTurno);
// Ruta para obtener movimientos por caja id
router.get('/movimientos', verifyToken, CajaController.getMovimientosByTurno);
// Ruta para obtener caja por id de usuario
router.get('/user/:id', verifyToken, CajaController.getCajaByUserId);
// Ruta para obtener caja por id de ruta
router.get('/ruta/:id', verifyToken, CajaController.getCajaByRutaId);
// Ruta para obtener caja por id
router.get('/:id', verifyToken, CajaController.getCajaById);

module.exports = router;