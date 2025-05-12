// controllers/trasladoController.js
const catchError = require('../utils/catchError');
const Traslado = require('../models/traslado');

const getTrasladosClientesPaginados = catchError(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
  
    const allTraslados = await Traslado.getAllTraslados();
  
    const total = allTraslados.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
  
    const paginated = allTraslados.slice(start, end);
  
    return res.status(200).json({
      data: paginated,
      total,
      page,
      limit,
      totalPages
    });
});

const createClienteTrasladoMasivo = catchError(async (req, res) => {
  const trasladoData = req.body;

  if (!Array.isArray(trasladoData.cliente_ids) || trasladoData.cliente_ids.length === 0) {
    return res.status(400).json({ message: 'Debe proporcionar al menos un cliente para trasladar.' });
  }

  const traslados = await Traslado.createClienteTrasladoMasivo(trasladoData);

  return res.status(201).json({ message: 'Traslados registrados exitosamente', traslados });
});

module.exports = {
    getTrasladosClientesPaginados,
    createClienteTrasladoMasivo
};