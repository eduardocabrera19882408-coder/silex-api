const Oficina = require('../models/oficina');
const catchError = require('../utils/catchError');

// Crear una oficina con rutas asociadas
const createOficina = catchError(async (req, res) => {
  const { nombre, direccion, telefono, userId } = req.body;
  const oficina = await Oficina.create({ nombre, direccion, telefono, userId });
  return res.status(201).json({ data: oficina });
});

// Obtener todas las oficinas con sus rutas
const getAllOficinas = catchError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * parseInt(limit);

  const { role } = req.user;

  // Validar rol
  if (role !== 'administrador' && role !== 'administrador_oficina') {
    return res.status(403).json({ message: 'No tiene permisos para acceder a esta información.' });
  }

  const oficinas = await Oficina.getAllOficinas(page, limit, offset, role);

  return res.status(200).json({ data: oficinas });
});

// Obtener todas las oficinas con sus rutas
const getAllOficinasByUser = catchError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * parseInt(limit);

  const { userId, role } = req.user;

  // Validar rol
  if (role !== 'administrador' && role !== 'administrador_oficina') {
    return res.status(403).json({ message: 'No tiene permisos para acceder a esta información.' });
  }

  const oficinas = await Oficina.getAll(page, limit, offset, role, userId);

  return res.status(200).json({ data: oficinas });
});

// Obtener una oficina por ID con rutas
const getOficinaById = catchError(async (req, res) => {
  const oficina = await Oficina.getById(req.params.id);
  if (!oficina) return res.status(404).json({ message: 'Oficina no encontrada' });
  return res.status(200).json({ data: oficina });
});

// Actualizar una oficina y sus rutas
const updateOficina = catchError(async (req, res) => {
  const oficina = await Oficina.update(req.params.id, req.body);
  return res.status(200).json({ message: 'Oficina actualizada', data: oficina });
});

//Buscar oficina por nombre
const searchByName = catchError(async (req, res) => {
    const { searchTerm, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * parseInt(limit);

    const oficinas = await Oficina.searchByName(searchTerm, page, limit, offset);
    
    return res.status(200).json(oficinas);
});

const deleteOficina = catchError(async (req, res) => {
    const { id } = req.params;

    // Verificar si hay rutas asociadas
    const tieneRutas = await Oficina.hasRutas(id);
    if (tieneRutas) {
        return res.status(400).json({ 
            error: "No se puede eliminar la oficina porque tiene rutas asociadas." 
        });
    }

    // Eliminar relaciones en usuariooficinas
    await Oficina.removeUserRelations(id);

    // Eliminar la oficina
    const result = await Oficina.delete(id);
    return res.status(200).json(result);
});

module.exports = {
  createOficina,
  getAllOficinas,
  getAllOficinasByUser,
  getOficinaById,
  updateOficina,
  deleteOficina,
  searchByName
};