const db = require('../config/db');

const Producto = {
  // Crear un producto con rutas asignadas
  create: async (productoData) => {
    // Crear el producto primero
    const queryText = `
      INSERT INTO productos (nombre, precio, stock, estado, "createdAt", "updatedAt") 
      VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id;
    `;
    const values = [productoData.nombre, productoData.precio, productoData.stock, "activo"];
    const result = await db.query(queryText, values);
    const productoId = result.rows[0].id;

    // Devolver el producto
    return Producto.getById(productoId);
  },

  // Obtener todos los productos con las rutas asignadas
  getAll: async (page, limit, offset) => {
    const queryText = `SELECT * FROM productos ORDER BY id LIMIT $1 OFFSET $2;`;
    const result = await db.query(queryText, [parseInt(limit), parseInt(offset)]);
    console.log(result)

    // Obtener el total de productos
    const countQuery = `SELECT COUNT(*) AS total FROM productos;`;
    const countRows = await db.query(countQuery);
    console.log(countRows)
    const total = Number(countRows.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return { data: result.rows, total, page: parseInt(page), limit: parseInt(limit), totalPages };
  },

  // Obtener un producto por ID con rutas asociadas
  getById: async (id) => {
    const queryText = `SELECT * FROM productos WHERE id = $1;`;

    const { rows } = await db.query(queryText, [id]);

    if (rows.length === 0) return null;

    // Organizar la estructura del producto con rutas en un array
    const producto = {
      id: rows[0].id,
      nombre: rows[0].nombre,
      precio: rows[0].precio,
      stock: rows[0].stock,
      estado: rows[0].estado,
      createdAt: rows[0].createdAt,
      updatedAt: rows[0].updatedAt,
    };

    return producto;
  },

  // Editar un producto por id
  update: async (id, updateData) => {
    const queryText = `
      UPDATE productos
      SET nombre = $1, precio = $2, stock = $3, "updatedAt" = NOW()
      WHERE id = $4;
    `;
    const values = [updateData.nombre, updateData.precio, updateData.stock, id];
    await db.query(queryText, values);
    const producto = await Producto.getById(id);
    console.log(producto)
    return producto;
  },

  // Archivar un producto
  archive: async (id) => {
    const queryText = `UPDATE productos SET estado = 'archivado' WHERE id = $1;`;
    await db.query(queryText, [id]);
    return { id, estado: 'archivado' };
  },

  // Buscar productos por nombre con rutas asociadas
  searchByTerm: async (searchTerm, page, limit, offset) => {
    const queryText = `
      SELECT *
      FROM productos
      WHERE nombre ILIKE $1
      ORDER BY id DESC
      LIMIT $2 OFFSET $3;
    `;

    const { rows } = await db.query(queryText, [`%${searchTerm}%`, limit, offset]);

    // Obtener total de productos encontrados
    const countQuery = `SELECT COUNT(*) FROM productos WHERE nombre ILIKE $1;`;
    const countResult = await db.query(countQuery, [`%${searchTerm}%`]);

    const total = Number(countResult.rows[0].count);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return {
      data: rows,
      total: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: totalPages
    };
  },

  getProductosByRutaId: async (rutaId) => {
    const queryText = `
      SELECT p.*
      FROM productos p
      WHERE p.id = ANY (
        SELECT UNNEST(r."productoId")
        FROM ruta r
        WHERE r.id = $1
      )
      AND p.estado = 'activo'
      AND p.stock > 0
    `;
  
    const result = await db.query(queryText, [rutaId]);
    return result.rows;
  }
};

module.exports = Producto;