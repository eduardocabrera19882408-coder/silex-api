// controllers/cajaController.js
const Caja = require('../models/caja'); // Importar el modelo de Caja
const PDFDocument = require('pdfkit');
const catchError = require('../utils/catchError');  // Para manejo de errores
const path = require('path');
const QRCode = require('qrcode');

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
const getTurno = catchError(async (req, res) => {
  const { id } = req.params;
  const caja = await Caja.getTurnoById(id);
  
  if (!caja) {
    return res.status(404).json({ message: 'No hay un turno activo' });
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

// Función para obtener una caja por su ID
const getCajaByRutaId = catchError(async (req, res) => {
  const { id } = req.params;
  const caja = await Caja.getByRutaId(id);
  
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
  const { userId } = req.user;
  const { cajaId } = req.body

  if (!userId || !cajaId === undefined) {
    return res.status(400).json({ message: 'Faltan datos necesarios.' });
  }

  const resultado = await Caja.cerrarCaja(cajaId, userId);
  return res.status(200).json({ success: true, ...resultado });
});

// Endpoint: cierre de caja
const bloquearCaja = catchError(async (req, res) => {
  const { cajaId, estado } = req.body;

  if (!cajaId === undefined) {
    return res.status(400).json({ message: 'Faltan datos necesarios.' });
  }

  const resultado = await Caja.bloquearCaja(cajaId, estado);
  return res.status(200).json({ success: true, ...resultado });
});

const abrirCaja = catchError(async (req, res) => {
  const { cajaId } = req.body;
  const { userId } = req.user;

  if (!cajaId === undefined) {
    return res.status(400).json({ message: 'Faltan datos necesarios.' });
  }

  const resultado = await Caja.abrirCaja(cajaId, userId);
  return res.status(200).json({ success: true, ...resultado });
});

const getMovimientosByTurno = catchError( async (req, res) => {
  try {
    const { turnoId, page = 1, limit = 10 } = req.query;

    if (!turnoId) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    const offset = (page - 1) * limit;

    const result = await Caja.getMovimientosByTurno(
      turnoId,
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
  const { descripcion, monto, gastoCategoryId, foto, turnoId } = req.body;
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

const crearEgresoAdm = catchError(async (req, res) => {
  const { descripcion, monto, gastoCategoryId, cajaId, turnoId } = req.body;
  const { userId } = req.user;

  if (!descripcion || !monto || !gastoCategoryId || !turnoId) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const egreso = await Caja.createEgresoAdm({
      descripcion,
      monto,
      cajaId,
      gastoCategoryId,
      aprovedId: userId,
      turnoId: turnoId
    });

    return res.status(201).json({ success: true, data: egreso });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const crearIngresoAdm = catchError(async (req, res) => {
  const { descripcion, monto, ingresoCategoryId, cajaId, turnoId } = req.body;
  const { userId } = req.user;

  if (!descripcion || !monto || !ingresoCategoryId || !turnoId) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const ingreso = await Caja.createIngresoAdm({
      descripcion,
      monto,
      cajaId,
      ingresoCategoryId,
      aprovedId: userId,
      turnoId : turnoId
    });

    return res.status(201).json({ success: true, data: ingreso });
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

const anularAbono = catchError(async (req, res) => {
  const { id, motivo } = req.body;
  const { userId } = req.user;

  try {
    const result = await Caja.anularPago(id, userId, motivo);
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

// Función para obtener los egresos listados por id de turno
const getEgresosByTurno = catchError(async (req, res) => {
  const { id } = req.params;
  const {page = 1 , limit = 10} = req.query;
  const offset = (page - 1) * limit;
  const result = await Caja.getEgresosByTurno(id, limit, offset);
  
  if (!result) {
    return res.status(404).json({ message: 'No hay egresos disponibles' });
  }

  return res.status(200).json({
    success: true,
    message: 'Egresos obtenidos correctamente',
    data: result.data,
    total: result.total,
    page: Number(page),
    totalPages: result.totalPages
  });
});

// Función para obtener los egresos listados por id de turno
const getAbonosByTurno = catchError(async (req, res) => {
  const { id } = req.params;
  const { limit = 10, page = 1 } = req.query
  const offset = (page - 1) * limit;
  const abonos = await Caja.getAbonosByTurno(id, limit, offset);
  
  if (!abonos) {
    return res.status(404).json({ message: 'No hay abonos disponibles' });
  }
  return res.status(200).json({
    success: true,
    message: 'Abonos obtenidos correctamente',
    data: abonos.data,
    total: abonos.total,
    page: Number(page),
    totalPages: abonos.totalPages
  });
});

const getValidAbonosByTurno = catchError(async (req, res) => {
  const { id } = req.params;
  const { limit = 10, page = 1 } = req.query
  const offset = (page - 1) * limit;
  const abonos = await Caja.getValidAbonosByTurno(id, limit, offset);
  
  if (!abonos) {
    return res.status(404).json({ message: 'No hay abonos disponibles' });
  }
  return res.status(200).json({
    success: true,
    message: 'Abonos obtenidos correctamente',
    data: abonos.data,
    total: abonos.total,
    page: Number(page),
    totalPages: abonos.totalPages
  });
});

// Función para obtener comprobante por id
const getComprobanteById = catchError(async (req, res) => {
  const { id } = req.params;
  const pago = await Caja.getComprobanteById(id);

  if (!pago) {
    return res.status(404).send('Comprobante no encontrado');
  }

  // 1. Contenido para el QR
  const qrData = `Comprobante #${pago.id}\nCliente: ${pago.nombre}\nMonto: $${pago.monto}\nMétodo: ${pago.metodoPago}\nFecha: ${new Date(pago.createdAt).toLocaleString()}`;

  // 2. Generar código QR en base64
  const qrImageDataUrl = await QRCode.toDataURL(qrData);

  const doc = new PDFDocument({
    size: [300, 400],
    margin: 20
  }); 

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Comprobante_pago_${id}_${pago.nombre}.pdf"`);

  doc.pipe(res);

  // Agrega logo (ruta absoluta y control de errores)
  try {
    const logoPath = path.join(__dirname, '../public/images/logo.png'); // Ajusta esta ruta
    const imageWidth = 150;
    const imageHeight = 30;
    const x = (doc.page.width - imageWidth) / 2;
    doc.image(logoPath, x, undefined, {
      width: imageWidth,
      height: imageHeight,
    });
    doc.moveDown();
  } catch (error) {
    console.error('No se pudo cargar el logo:', error.message);
    doc.moveDown(); // Asegura espacio si falla el logo
  }
  doc.moveDown();
  doc.fontSize(18).font('Helvetica-Bold').text('Comprobante de Pago', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12);
  doc.font('Helvetica-Bold').text('Número de comprobante:', { continued: true });
  doc.font('Helvetica').text(` ${pago.id}`);

  doc.font('Helvetica-Bold').text('Fecha:', { continued: true });
  doc.font('Helvetica').text(` ${new Date(pago.createdAt).toLocaleString()}`);

  doc.font('Helvetica-Bold').text('Cliente:', { continued: true });
  doc.font('Helvetica').text(` ${pago.nombre}`);

  doc.font('Helvetica-Bold').text('Monto:', { continued: true });
  doc.font('Helvetica').text(` $${pago.monto}`);

  doc.font('Helvetica-Bold').text('Método de pago:', { continued: true });
  doc.font('Helvetica').text(` ${pago.metodoPago}`);
  doc.moveDown();

  // 4. Insertar el QR (desde base64)
  const qrBuffer = Buffer.from(qrImageDataUrl.split(',')[1], 'base64');

  
  const imageWidth = 100;
  const imageHeight = 100;
  const x = (doc.page.width - imageWidth) / 2;

  doc.image(qrBuffer, x, undefined, {
    width: imageWidth,
    height: imageHeight,
  });

  // Pie de página en gris
  doc.fillColor('gray')
    .fontSize(10)
    .text('Gracias por su pago', 20, doc.page.height - 50, {
      align: 'center'
    })
    .text('Autentic', 20, doc.page.height - 35, {
      align: 'center'
    });

  doc.end();
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
  getTurno,
  updateCaja,
  deleteCaja,
  agregarSaldo,
  asignarSaldoAOficina,
  cerrarCaja,
  getCajaByUserId,
  getCajaByRutaId,
  getMovimientosByTurno,
  crearEgreso,
  crearEgresoAdm,
  crearIngresoAdm,
  aprobarEgreso,
  rechazarEgreso,
  listarEgresos,
  getEgresosByTurno,
  getEgresosDia,
  getAllEgresos,
  bloquearCaja,
  abrirCaja,
  getAbonosByTurno,
  anularAbono,
  getValidAbonosByTurno,
  getComprobanteById
};
