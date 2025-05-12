// controllers/configController.js
const Config = require('../models/config'); // Importar el modelo de configuración
const catchError = require('../utils/catchError');  // Para manejo de errores

// Función para obtener todas las categorías de egresos
const getAllCategories = catchError(async (req, res) => {
  let { page = 1, limit = 10, searchTerm = '' } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);
  const offset = (page - 1) * limit;

  const result = await Config.getAllCategories(offset, limit, searchTerm);

  return res.status(200).json({
    categorias: result.data,
    total: result.total,
    page,
    totalPages: Math.ceil(result.total / limit),
  });
});

// Función para obtener todas las categorías de ingresos
const getAllCategoriesIn = catchError(async (req, res) => {
  let { page = 1, limit = 10, searchTerm = '' } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);
  const offset = (page - 1) * limit;

  const result = await Config.getAllCategoriesIn(offset, limit, searchTerm);

  return res.status(200).json({
    categorias: result.data,
    total: result.total,
    page,
    totalPages: Math.ceil(result.total / limit),
  });
});

// Función para obtener la configuracion de las cajas
const getConfigCaja = catchError(async (req, res) => {
  const config = await Config.getConfigCaja();
  return res.status(200).json(config);
});

// Función para obtener la configuracion por defecto
const getConfigDefault = catchError(async (req, res) => {
  const config = await Config.getConfigDefault();
  return res.status(200).json(config);
});

// Función para editar la configuracion de las cajas
const updateConfigCaja = catchError(async (req, res) => {
  const timeClose = req.body.hora_cierre_caja
  const timeOpen = req.body.hora_apertura_caja
  const config = await Config.updateConfigCaja(timeClose, timeOpen);
  return res.status(200).json(config);
});

// Función para obtener una categoría de egreso por su ID
const getCategoryById = catchError(async (req, res) => {
  const { id } = req.params;
  const categoria = await Config.getCategoryById(id);

  if (!categoria) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.status(200).json(categoria);
});

// Función para crear una nueva categoría de egreso
const createCategory = catchError(async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
  }

  const categoria = await Config.createCategory(nombre);
  return res.status(201).json(categoria);
});

// Función para crear una nueva categoría de egreso
const createCategoryIn = catchError(async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
  }

  const categoria = await Config.createCategoryIn(nombre);
  return res.status(201).json(categoria);
});

// Función para actualizar una categoría de egreso
const updateCategory = catchError(async (req, res) => {
  const { id } = req.params;
  const { nombre, archivada } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
  }

  const categoria = await Config.updateCategory(id, nombre, archivada);

  if (!categoria) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.status(200).json(categoria);
});

// Función para actualizar una categoría de egreso
const updateCategoryIn = catchError(async (req, res) => {
  const { id } = req.params;
  const { nombre, archivada } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
  }

  const categoria = await Config.updateCategoryIn(id, nombre, archivada);

  if (!categoria) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.status(200).json(categoria);
});

// Función para archivar una categoría de egreso
const archiveCategory = catchError(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const categoria = await Config.archiveCategory(id, status);

  if (!categoria) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.status(200).json({ message: 'Categoría archivada correctamente' });
});

// Función para archivar una categoría de egreso
const archiveCategoryIn = catchError(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const categoria = await Config.archiveCategoryIn(id, status);

  if (!categoria) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  return res.status(200).json({ message: 'Categoría archivada correctamente' });
});

// Función para eliminar una categoría de egreso
const deleteCategory = catchError(async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRows = await Config.deleteCategory(id);

    if (deletedRows === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada o está asociada a un gasto' });
    }

    return res.status(204).json();
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

//Función para obtener la configuración de crédito por ruta
const getConfigByRutaId = catchError(async (req, res) => {
  const { rutaId } = req.params;
  const config = await Config.getByRutaId(rutaId);
  if (!config) return res.status(404).json({ message: 'Configuración no encontrada para esta ruta' });
  return res.status(200).json(config);
});

// Función para obtener la configuración de crédito por ruta con paginación
const getallRutasConfig = catchError(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search;

  // Obtener datos del modelo
  const config = await Config.getRutasConfig(page, limit, search);

  if (!config) return res.status(404).json({ message: 'Sin resultados' });

  return res.status(200).json({
    data: config.data,
    page,
    totalPages: config.totalPages,
    totalItems: config.totalItems
  });
});

// Función del controlador para actualizar la configuración de la ruta
const updateRutaConfig = catchError(async (req, res) => {
  const { rutaId } = req.params; // Ruta ID que se pasa en la URL
  const configData = req.body; // Datos que se pasan en el cuerpo de la solicitud

  // Llamar al modelo para actualizar la configuración de la ruta
  const updatedConfig = await Config.updateRutaConfig(rutaId, configData);

  if (!updatedConfig) {
    return res.status(404).json({ message: 'No se encontró la configuración de la ruta' });
  }

  return res.status(200).json(updatedConfig); // Retorna la configuración actualizada
});

// Función del controlador para actualizar la configuración por defecto
const updateConfigDefault = catchError(async (req, res) => {
  const configData = req.body; // Datos que se pasan en el cuerpo de la solicitud

  // Llamar al modelo para actualizar la configuración de la ruta
  const updatedConfig = await Config.updateConfigDefault(configData);

  if (!updatedConfig) {
    return res.status(404).json({ message: 'No se encontró la configuración por defecto' });
  }

  return res.status(200).json(updatedConfig); // Retorna la configuración actualizada
});

//Ingresar un dia no Laborable
const crearDiaNoLaborable = catchError(async (req, res) => {
  const { fecha, descripcion } = req.body;

  if (!fecha || !descripcion) {
    return res.status(400).json({ error: 'Fecha y descripción son obligatorias.' });
  }

  const result = await Config.createNoLaborable(fecha, descripcion);
  return res.status(201).json(result);
}); 

const getDiasNoLaborables = catchError(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const result = await Config.getAllNoLaborable(limit, offset);

  return res.status(200).json({
    data: result.data,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: page,
  });
});

const eliminarDiaNoLaborable = catchError(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID es obligatorio' });
  }

  const deleted = await Config.deleteNoLaborable(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Día no laborable no encontrado' });
  }

  return res.status(200).json({ message: 'Día no laborable eliminado correctamente' });
});


module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  deleteCategory,
  getConfigByRutaId,
  crearDiaNoLaborable,
  getDiasNoLaborables,
  eliminarDiaNoLaborable,
  getallRutasConfig,
  updateRutaConfig,
  getConfigCaja,
  updateConfigCaja,
  updateConfigDefault,
  getConfigDefault,
  updateCategoryIn,
  archiveCategoryIn,
  getAllCategoriesIn,
  createCategoryIn
};