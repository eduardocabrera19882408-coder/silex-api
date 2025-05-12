const Usuario = require('../models/usuario');
const catchError = require('../utils/catchError');

// Crear un nuevo usuario
const createUsuario = catchError(async (req, res) => {
  console.log(req.user) //usuario logueado
    try {
        const usuario = await Usuario.create(req.body);
        return res.status(201).json({ data: usuario });
      } catch (err) {
        return res.status(500).json({ error : err.detail ? err.detail : err });
      }
});

// Obtener todos los usuarios con paginación
const getAllUsuarios = catchError(async (req, res) => {
  const { page, limit } = req.query;
  const offset = (page - 1) * parseInt(limit);

  try {
    const usuarios = await Usuario.getAll(page, limit, offset);
    return res.status(200).json(usuarios);
  }catch (err) {
    return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
  }
});

// Obtener un usuario por ID
const getUsuarioById = catchError(async (req, res) => {
    try{
        const usuario = await Usuario.getById(req.params.id);
        if (!usuario) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        return res.status(200).json(usuario);
    } catch(err){
        return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
    }
});

// Archivar un usuario
const archiveUsuario = catchError(async (req, res) => {
    try{
        const usuario = await Usuario.archive(req.params.id);
        if (!usuario) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        return res.status(200).json(usuario);
    } catch(err){
        return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
    }
});

// Desarchivar un usuario
const DesarchiveUsuario = catchError(async (req, res) => {
  try{
      const usuario = await Usuario.desarchive(req.params.id);
      if (!usuario) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      return res.status(200).json(usuario);
  } catch(err){
      return res.status(500).json({ error : err.detail ? err.detail : "Ocurrio un error" });
  }
});

// Editar un usuario por ID
const editUsuario = catchError(async (req, res) => {
    try {
        const usuario = await Usuario.edit(req.params.id, req.body);
        if (!usuario) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        return res.status(200).json(usuario);
    } catch(err){
        return res.status(500).json({ error : err.detail ? err.detail : err.code });
    }
});

// Buscar usuarios por sus datos
const searchUsuarios = catchError(async (req, res) => {
  const { searchTerm, page, limit } = req.query;
  const offset = (page - 1) * limit;
  try {
      const usuarios = await Usuario.searchByData(searchTerm, page, limit, offset);
      return res.status(200).json(usuarios);
  } catch(err){
    return res.status(500).json({ error : err.detail ? err.detail : "Ocurrió un error" });
  }
});

// Obtener usuarios por oficina con paginación
const getUsuariosByOficina = catchError(async (req, res) => {
  const { oficinaId } = req.params;
  const { page, limit } = req.query;
  const offset = (page - 1) * limit;
  try{
      const usuarios = await Usuario.getUsuariosByOficina(oficinaId, page, limit, offset);
      return res.status(200).json(usuarios);
  }catch(err){
    return res.status(500).json({ error : err.detail ? err.detail : err });
  }
});

module.exports = {
  createUsuario,
  getAllUsuarios,
  getUsuarioById,
  archiveUsuario,
  DesarchiveUsuario,
  editUsuario,
  searchUsuarios,
  getUsuariosByOficina
};
