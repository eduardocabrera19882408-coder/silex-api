const Cliente = require('../models/cliente');
const catchError = require('../utils/catchError');  // Asegúrate de tener esta función catchError
const db = require('../config/db'); // Importa la conexión a la base de datos
const verificarCI = require('../utils/identificarCI');

// Controlador para crear un cliente
const createCliente = catchError(async (req, res) => {
  const { identificacion, nombres, telefono, direccion, rutaId } = req.body;

  // Validaciones específicas por campo
  if (!nombres || !nombres.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  if (!telefono || !telefono.trim()) {
    return res.status(400).json({ error: 'El teléfono es obligatorio' });
  }

  if (!direccion || !direccion.trim()) {
    return res.status(400).json({ error: 'La dirección es obligatoria' });
  }

  if (!rutaId || !rutaId.toString().trim()) {
    return res.status(400).json({ error: 'La ruta es obligatoria' });
  }

  // Validar identificación
  const isValidIdentification = verificarCI(identificacion);

  if (isValidIdentification[1] === true) {
    try {
      const client = await Cliente.create(req.body, isValidIdentification, req.user.userId);
      return res.status(201).json({ data: client }); // 201 Created
    } catch (err) {
      // Verificar si es un error por identificación duplicada
      if (err.status === 409) {
        return res.status(409).json({ error: err.message }); // Conflicto
      }

      // Otros errores
      return res.status(500).json({ error: err.detail ? err.detail : err });
    }
  } else {
    return res.status(400).json({ error: 'La identificación no es válida' });
  }
});

// Controlador para obtener todos los clientes con paginación
const getAllClientes = catchError(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10; // Número máximo de clientes por página
    const page = parseInt(req.query.page) || 1;   // Página solicitada, por defecto la página 1
    const searchTerm = req.query.searchTerm || ''; // Filtro de búsqueda
    const oficinaId = req.query.oficina ? parseInt(req.query.oficina) : null; // Filtro de oficina
    const rutaId = req.query.ruta ? parseInt(req.query.ruta) : null; // Filtro de ruta

    // Calcular el offset basado en la página solicitada
    const offset = (page - 1) * limit;

    // userId desde el middleware de autenticación
    const userId = req.user?.userId || null;

    const clientes = await Cliente.getAll(limit, offset, searchTerm, oficinaId, rutaId, userId);

    return res.status(200).json(clientes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.detail || 'Ocurrió un error' });
  }
});

// Controlador para obtener un cliente por ID
const getClienteById = catchError(async (req, res) => {
  try {
    const cliente = await Cliente.getById(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    return res.status(200).json(cliente);
  } catch(err){
    return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
  }
});

// Controlador para archivar un cliente
const archiveCliente = catchError(async (req, res) => {
  try {
    const cliente = await Cliente.archive(req.params.id);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    return res.status(200).json(cliente);
  } catch(err){
    return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
  }
});

// Controlador para obtener clientes por ruta con paginación
const getClientesByRuta = catchError(async (req, res) => {
  const { rutaId } = req.params;
  const { page, limit, search } = req.query;  // Parámetros de consulta: page y pageSize
  const offset = (page - 1) * limit;  // Calcular el desplazamiento

  const clientes = await Cliente.getByRutaId(page, rutaId, limit, offset, search);  // Llamamos al método de paginación por ruta

  return res.status(200).json(clientes);
});

// Controlador para obtener clientes por oficina con paginación
const getClientesByOficina = catchError(async (req, res) => {
  const { oficinaId } = req.params;
  const { page, limit } = req.query;  // Parámetros de consulta: page y pageSize
  const offset = (page - 1) * limit;  // Calcular el desplazamiento

  const clientes = await Cliente.getClientesByOficinaId(oficinaId, page, limit, offset);  // Llamamos al método de paginación por oficina

  return res.status(200).json(clientes);
});

// Controlador para buscar clientes por datos con paginación
const searchClientes = catchError(async (req, res) => {
  const { query } = req.query; // Parámetro de búsqueda (nombre, teléfono, identificación, etc.)
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * parseInt(limit);

  if (!query) {
    return res.status(400).json({ message: 'Se requiere un término de búsqueda' });
  }

  const clientes = await Cliente.search(query, page, limit, offset);
  return res.status(200).json(clientes);
});

// Controlador para obtener clientes archivados con paginación
const getArchivedClientes = catchError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * parseInt(limit);

  const clientes = await Cliente.getArchivedClientes(page, limit, offset);
  return res.status(200).json(clientes);
});

// Controlador para editar clientes por id
const updateCliente = catchError(async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  try{
    const cliente = await Cliente.update(id, updatedData);
    if (!cliente) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    return res.status(200).json(cliente);
  } catch(err){
    return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
  }
});

module.exports = {
  createCliente,
  getAllClientes,
  getClienteById,
  archiveCliente,
  getClientesByRuta,
  getClientesByOficina,
  searchClientes,
  getArchivedClientes,
  updateCliente
};