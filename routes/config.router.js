// routes/configRouter.js
const express = require('express');
const router = express.Router();
const ConfigController = require('../controllers/config.controller');
const verifyToken = require('../utils/verifyToken'); // Asumimos que tienes este middleware para validar el token

// Obtener configuración de crédito por ruta
router.get('/rutas', verifyToken, ConfigController.getallRutasConfig);

// Obtener configuración de crédito por ruta
router.get('/ruta/:rutaId', verifyToken, ConfigController.getConfigByRutaId);

// Obtener configuración de crédito por ruta
router.get('/caja', verifyToken, ConfigController.getConfigCaja);

//Obtener la config por defecto
router.get('/default', ConfigController.getConfigDefault);

// Obtener configuración de crédito por ruta
router.put('/caja', verifyToken, ConfigController.updateConfigCaja);

//Editar la config de la ruta
router.put('/ruta/:rutaId', ConfigController.updateRutaConfig);

//Editar la config por defecto
router.put('/default', ConfigController.updateConfigDefault);

// Ruta para obtener todas las categorías de egresos
router.get('/gasto-categories', verifyToken, ConfigController.getAllCategories);

// Ruta para obtener todas las categorías de ingresos
router.get('/ingreso-categories', verifyToken, ConfigController.getAllCategoriesIn);

// POST /dias-no-laborables
router.post('/nolaborable', verifyToken, ConfigController.crearDiaNoLaborable);

// GET /dias-no-laborables
router.get('/nolaborable', verifyToken, ConfigController.getDiasNoLaborables);

//Eliminar dia no laborable
router.delete('/nolaborable/:id', ConfigController.eliminarDiaNoLaborable);

// Ruta para obtener una categoría de egreso por su ID
router.get('/gasto-categories/:id', verifyToken, ConfigController.getCategoryById);

// Ruta para crear una nueva categoría de egreso
router.post('/gasto-categories', verifyToken, ConfigController.createCategory);

// Ruta para crear una nueva categoría de ingreso
router.post('/ingreso-categories', verifyToken, ConfigController.createCategoryIn);

// Ruta para actualizar una categoría de egreso
router.put('/gasto-categories/:id', verifyToken, ConfigController.updateCategory);

// Ruta para actualizar una categoría de ingreso
router.put('/ingreso-categories/:id', verifyToken, ConfigController.updateCategoryIn);

// Ruta para archivar una categoría de egreso
router.put('/gasto-categories/:id/archive', verifyToken, ConfigController.archiveCategory);

// Ruta para archivar una categoría de ingreso
router.put('/ingreso-categories/:id/archive', verifyToken, ConfigController.archiveCategoryIn);

// Ruta para eliminar una categoría de egreso
router.delete('/gasto-categories/:id', verifyToken, ConfigController.deleteCategory);

module.exports = router;