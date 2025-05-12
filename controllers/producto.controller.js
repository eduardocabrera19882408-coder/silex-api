const Producto = require('../models/producto');
const catchError = require('../utils/catchError');  // Manejador de errores

// Crear un producto
const createProducto = catchError(async (req, res) => {
  const { rutas, ...productoData } = req.body;  // Desestructurar rutas y el resto del producto
  const producto = await Producto.create(productoData, rutas);
  return res.status(201).json({ data: producto });
});

// Obtener todos los productos con paginación
const getAllProductos = catchError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * parseInt(limit);
  const productos = await Producto.getAll(page, limit, offset);
  return res.status(200).json(productos);
});

// Obtener un producto por ID
const getProductoById = catchError(async (req, res) => {
  const producto = await Producto.getById(req.params.id);
  if (!producto) return res.status(404).json({ message: 'Producto no encontrado' });
  return res.status(200).json(producto);
});

// Editar un producto
const updateProducto = catchError(async (req, res) => {
  const producto = await Producto.update(req.params.id, req.body);
  return res.status(200).json({ message: 'Producto actualizado', data: producto });
});

// Archivar un producto
const archiveProducto = catchError(async (req, res) => {
  const producto = await Producto.archive(req.params.id);
  return res.status(200).json({ message: 'Producto archivado', data: producto });
});

// Buscar productos por nombre y obtener sus rutas asociadas
const searchProductos = catchError(async (req, res) => {
  const { searchTerm = '', page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const productos = await Producto.searchByTerm(searchTerm, parseInt(page), parseInt(limit), offset);
    return res.status(200).json(productos);
  } catch (err) {
    return res.status(500).json({ error: err.detail ? err.detail : "Ocurrió un error" });
  }
});

// Obtener productos disponibles por ruta
const getProductosByRutaId = catchError(async (req, res) => {
  const { rutaId } = req.params;
  const productos = await Producto.getProductosByRutaId(rutaId);
  return res.status(200).json(productos);
});

module.exports = {
  createProducto,
  getAllProductos,
  getProductoById,
  updateProducto,
  archiveProducto,
  searchProductos,
  getProductosByRutaId
};