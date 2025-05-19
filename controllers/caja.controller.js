// controllers/cajaController.js
const Caja = require('../models/caja'); // Importar el modelo de Caja
const catchError = require('../utils/catchError');  // Para manejo de errores

// Función para obtener todas las cajas
const getAllCajas = catchError(async (req, res) => {
  const cajas = await Caja.getAll();
  return res.status(200).json(cajas);
});

// Función para obtener una caja por su ID
const getCajaById = catchError(async (req, res) => {
  const { id } = req.params;
  const caja = await Caja.getById(id);
  
  if (!caja) {
    return res.status(404).json({ message: 'Caja no encontrada' });
  }

  return res.status(200).json(caja);
});

// Función para obtener una caja por su ID
const getCajaByUserId = catchError(async (req, res) => {
  const { id } = req.params;
  const caja = await Caja.getByUserId(id);
  
  if (!caja) {
    return res.status(404).json({ message: 'Caja no encontrada' });
  }

  return res.status(200).json(caja);
});

// Función para actualizar el saldo de una caja
const updateCaja = catchError(async (req, res) => {
  const { id } = req.params;
  const { saldoActual } = req.body;

  const caja = await Caja.update(id, saldoActual);

  if (!caja) {
    return res.status(404).json({ message: 'Caja no encontrada' });
  }

  return res.status(200).json(caja);
});

// Función para eliminar una caja (en este caso, la marcamos como inactiva)
const deleteCaja = catchError(async (req, res) => {
  const { id } = req.params;

  const deletedRows = await Caja.delete(id);

  if (deletedRows === 0) {
    return res.status(404).json({ message: 'Caja no encontrada' });
  }

  return res.status(204).json();
}); 

// Función para agregar saldo a la caja de un usuario
const agregarSaldo = catchError(async (req, res) => {
  const { rutaId, monto, adminId } = req.body;
  try{
    // Llamar a la función del modelo para agregar saldo
    const resultado = await Caja.agregarSaldo(adminId, rutaId, monto);
  
    return res.status(200).json({
      message: resultado.message,
      nuevoSaldoUsuario: resultado.nuevoSaldoUsuario,
      nuevoSaldoAdmin: resultado.nuevoSaldoAdmin,
    });
  } catch(error){
    res.status(500).json({ success: false, message: error.message });
  }
});

// Asignar saldo a un administrador de oficina
const asignarSaldoAOficina = catchError(async (req, res) => {
  const { adminId, oficinaAdminId, monto } = req.body;

  try{
    const resultado = await Caja.asignarSaldoAOficina(adminId, oficinaAdminId, monto);
    return res.status(200).json({ message: resultado.message, saldoActual: resultado.nuevoSaldoOficina });
  }catch(error){
    res.status(500).json({ success: false, message: error.message });
  }

});

// Endpoint: cierre de caja
const cerrarCaja = catchError(async (req, res) => {
  const { adminOficinaId, cobradorId, montoDejar } = req.body;

  if (!adminOficinaId || !cobradorId || montoDejar === undefined) {
    return res.status(400).json({ message: 'Faltan datos necesarios.' });
  }

  const resultado = await Caja.cerrarCaja(adminOficinaId, cobradorId, montoDejar);
  return res.status(200).json({ success: true, ...resultado });
});

const getMovimientosByCajaAndFecha = catchError( async (req, res) => {
  try {
    const { cajaId, fechaInicio, fechaFin, page = 1, limit = 10 } = req.query;

    if (!cajaId || !fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    const offset = (page - 1) * limit;

    // 🔥 Asegurar rangos exactos en el timestamp
    const fechaInicioCompleta = `${fechaInicio} 00:00:00`;
    const fechaFinCompleta = `${fechaFin} 23:59:59`;

    const result = await Caja.getByCajaAndFecha(
      cajaId,
      fechaInicioCompleta,
      fechaFinCompleta,
      parseInt(limit),
      parseInt(offset)
    );

    return res.status(200).json({
      success: true,
      message: 'Movimientos obtenidos correctamente',
      data: result.data,
      total: result.total,
      page: Number(page),
      totalPages: result.totalPages
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Error del servidor', error: error.message });
  }
});

const crearEgreso = catchError(async (req, res) => {
  const { descripcion, monto, gastoCategoryId, foto } = req.body;
  const { role, userId } = req.user;

  if (!descripcion || !monto || !gastoCategoryId) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const egreso = await Caja.createEgreso({
      descripcion,
      monto,
      gastoCategoryId,
      userRole: role,
      userId: userId,
      foto: foto
    });

    return res.status(201).json({ success: true, data: egreso });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const aprobarEgreso = catchError(async (req, res) => {
  const { id } = req.params;
  const { role, userId } = req.user;

  if (!['administrador', 'administrador_oficina'].includes(role)) {
    return res.status(403).json({ error: 'No tienes permisos para aprobar egresos' });
  }

  try {
    const result = await Caja.aprobarEgreso(id, userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const rechazarEgreso = catchError(async (req, res) => {
  const { id } = req.params;
  const { role, userId } = req.user;

  if (!['administrador', 'administrador_oficina'].includes(role)) {
    return res.status(403).json({ error: 'No tienes permisos para rechazar egresos' });
  }

  try {
    const result = await Caja.rechazarEgreso(id, userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const listarEgresos = catchError(async (req, res) => {
  const cajaId = req.user.cajaId;

  const filtros = {
    desde: req.query.desde,
    hasta: req.query.hasta,
    estado: req.query.estado,
    gastoCategoryId: req.query.gastoCategoryId,
    cobrador: req.query.cobrador
  };

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const data = await Caja.listarEgresos(cajaId, filtros, page, limit);
  return res.status(200).json(data);
}); 

const getAllEgresos = catchError(async (req, res) => {
  const authUserId = req.user.userId; // Este es el usuario autenticado (quien hace la petición)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const oficinaId = req.query.oficinaId ? parseInt(req.query.oficinaId) : null;
  const rutaId = req.query.rutaId ? parseInt(req.query.rutaId) : null;
  const searchTerm = req.query.searchTerm || '';
  const fechaInicio = req.query.fechaInicio || '';
  const fechaFin = req.query.fechaFin || '';

  // Pasamos el ID del usuario autenticado para que el modelo resuelva sus oficinas y rutas
  const data = await Caja.getAllEgresos(offset, limit, authUserId, oficinaId, rutaId, searchTerm, fechaInicio, fechaFin);
  
  return res.status(200).json(data);
});

const getEgresosDia = catchError(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.limit) || 10;
  const search = req.query.search;

  const egresos = await Caja.getEgresosDia(req.user.userId, page, pageSize, search);
  return res.status(200).json(egresos);
});

module.exports = {
  getAllCajas,
  getCajaById,
  updateCaja,
  deleteCaja,
  agregarSaldo,
  asignarSaldoAOficina,
  cerrarCaja,
  getCajaByUserId,
  getMovimientosByCajaAndFecha,
  crearEgreso,
  aprobarEgreso,
  rechazarEgreso,
  listarEgresos,
  getEgresosDia,
  getAllEgresos
};
