const catchError = require('../utils/catchError');
const Credito = require('../models/credito');

// Crear un nuevo crédito
const createCredito = catchError(async (req, res) => {
  const creditoData = req.body;

  // Llamar al método create del modelo para crear el crédito
  const credito = await Credito.create(creditoData);

  // Si hay un error, devolvemos una respuesta con un error y el código adecuado
  if (credito.error) {
    return res.status(400).json({ error: credito.error });
  }

  // Si todo salió bien, devolvemos el crédito creado con código 201
  return res.status(201).json(credito);
});

//Obtenemos los creditos paginados segun la eleccion de usuario
const getAllCreditos = catchError(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const searchTerm = req.query.searchTerm || '';
  const oficinaId = req.query.oficinaId || null;
  const rutaId = req.query.rutaId || null;
  const userId = req.user.userId; 

  // Consultamos los créditos con los filtros
  const { creditos, totalCreditos } = await Credito.getAll(limit, offset, searchTerm, userId, oficinaId, rutaId);
  
  const totalPages = Math.ceil(totalCreditos / limit);

  return res.status(200).json({
    creditos,
    page,
    limit,
    totalPages,
    totalCreditos,
  });
});

//Obtenemos los creditos paginados segun la eleccion de usuario
const getDataDash = catchError(async (req, res) => {
  const oficinaId = req.query.oficinaId || null;
  const rutaId = req.query.rutaId || null;
  const data = await Credito.getDataDash(oficinaId, rutaId);
  return res.status(200).json(data);
});

// Obtener un crédito por ID
const getCreditoById = catchError(async (req, res) => {
  const { id } = req.params;
  const credito = await Credito.getById(id);
  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" });
  return res.status(200).json(credito);
});

const getCreditosImpagos = catchError(async (req, res) => {
  const usuarioId = req.user.userId;
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  const [creditos, total] = await Promise.all([
    Credito.getImpagosByUsuarioPaginado(usuarioId, limit, offset),
    Credito.countImpagosByUsuario(usuarioId),
  ]);

  const totalPages = Math.ceil(total / limit);

  return res.json({
    data: creditos,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    }
  });
});

const createPago = catchError(async (req, res) => {
  const { cuotaId, monto } = req.body;
  const user_created_id = req.user.userId;

  if (!cuotaId || !monto) {
    return res.status(400).json({ error: "cuotaId y monto son requeridos" });
  }

  const pago = await Pago.create({ cuotaId, monto, user_created_id });

  return res.status(201).json({
    message: "Pago registrado correctamente",
    data: pago
  });
});

// Actualizar un crédito
const updateCredito = catchError(async (req, res) => {
  const { id } = req.params;
  const credito = await Credito.update(id, req.body);
  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" });
  return res.status(200).json(credito);
});

// Eliminar un crédito
const deleteCredito = catchError(async (req, res) => {
  const { id } = req.params;
  const credito = await Credito.delete(id);
  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" });
  return res.status(200).json({ message: "Crédito eliminado con éxito" });
});

module.exports = {
  createCredito,
  getAllCreditos,
  getCreditoById,
  updateCredito,
  deleteCredito,
  getCreditosImpagos,
  createPago,
  getDataDash
};