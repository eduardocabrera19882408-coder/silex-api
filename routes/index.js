const express = require('express');

// Importa todas las rutas de los modelos
const routerUsuarios = require('./usuarios.router');
const routerProductos = require('./productos.router');
const routerCreditos = require('./creditos.router');
const routerCaja = require('./caja.router');
const routerRutas = require('./rutas.router');
const routerClientes = require('./clientes.router');
const routerOficinas = require('./oficinas.router');
const routerReporte = require('./reportes.router');
const routerVehiculos = require('./vehiculos.router');
const routerPermisos = require('./permisos.router');
const routerAuth = require('./auth.router');
const routerTraslados = require('./traslados.router');
const routerConfig = require('./config.router');
// Agrega otras rutas de ser necesario

const router = express.Router();

// Agrupa las rutas bajo rutas principales
router.use('/login', routerAuth); //Ruta para manejar permisos
router.use('/usuarios', routerUsuarios);  // Ruta para manejar Usuarios
router.use('/productos', routerProductos);  // Ruta para manejar Productos
router.use('/creditos', routerCreditos);  // Ruta para manejar Créditos
router.use('/caja', routerCaja); //Ruta para manejar caja
router.use('/rutas', routerRutas);  // Ruta para manejar Productos en las Rutas
router.use('/clientes', routerClientes);  // Ruta para manejar Clientes
router.use('/oficinas', routerOficinas);  // Ruta para manejar Oficinas
router.use('/reportes', routerReporte);  // Ruta para manejar Configuración
router.use('/vehiculos', routerVehiculos);  // Ruta para manejar Vehiculos
router.use('/permisos', routerPermisos); //Ruta para manejar permisos
router.use('/traslado', routerTraslados);  // Ruta para manejar Pagos
router.use('/config', routerConfig);  // Ruta para manejar Configuración


// Si tienes más rutas, puedes seguir agregándolas de la misma forma
// router.use('/otraRuta', routerOtraRuta);

module.exports = router;

