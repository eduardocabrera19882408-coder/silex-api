// models/config.js
const pool = require('../config/db'); // Importar la conexión a la base de datos

const Config = {
  // Obtener todas las categorías de egresos
  getAllCategories: async (offset, limit, searchTerm) => {
    try {
      let query = `SELECT * FROM config_egresos_category`;
      let countQuery = `SELECT COUNT(*) FROM config_egresos_category`;
      const params = [];
  
      if (searchTerm) {
        query += ` WHERE nombre ILIKE $1`;
        countQuery += ` WHERE nombre ILIKE $1`;
        params.push(`%${searchTerm}%`);
      }
  
      // Agrega paginación
      query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
  
      const data = await pool.query(query, params);
      const total = await pool.query(countQuery, searchTerm ? [params[0]] : []);
  
      return {
        data: data.rows,
        total: parseInt(total.rows[0].count, 10),
      };
    } catch (error) {
      throw error;
    }
  },

  // Obtener todas las categorías de ingresos
  getAllCategoriesIn: async (offset, limit, searchTerm) => {
    try {
      let query = `SELECT * FROM config_ingresos_category`;
      let countQuery = `SELECT COUNT(*) FROM config_ingresos_category`;
      const params = [];
  
      if (searchTerm) {
        query += ` WHERE nombre ILIKE $1`;
        countQuery += ` WHERE nombre ILIKE $1`;
        params.push(`%${searchTerm}%`);
      }
  
      // Agrega paginación
      query += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
  
      const data = await pool.query(query, params);
      const total = await pool.query(countQuery, searchTerm ? [params[0]] : []);
  
      return {
        data: data.rows,
        total: parseInt(total.rows[0].count, 10),
      };
    } catch (error) {
      throw error;
    }
  },

  // Obtener todas las categorías de egresos
  getConfigCaja: async () => {
    try {
      const res = await pool.query('SELECT * FROM config_caja WHERE id = 1');
      return res.rows;
    } catch (error) {
      throw error;
    }
  },

   // Actualizar una categoría de egreso
   updateConfigCaja: async (timeClose, timeOpen) => {
    try {
      const query = 'UPDATE config_Caja SET hora_cierre_caja = $1, hora_apertura_caja = $2 WHERE id = 1 RETURNING *';
      const values = [timeClose, timeOpen];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Obtener una categoría de egreso por su ID
  getCategoryById: async (id) => {
    try {
      const res = await pool.query('SELECT * FROM config_egresos_category WHERE id = $1', [id]);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Crear una nueva categoría de egreso
  createCategory: async (nombre) => {
    try { 
      const query = 'INSERT INTO config_egresos_category (nombre, "createdAt", "updatedAt", archivada) VALUES ($1, NOW(), NOW(), FALSE) RETURNING *';
      const values = [nombre];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Crear una nueva categoría de ingreso
  createCategoryIn: async (nombre) => {
    try { 
      const query = 'INSERT INTO config_ingresos_category (nombre, "createdAt", "updatedAt", archivada) VALUES ($1, NOW(), NOW(), FALSE) RETURNING *';
      const values = [nombre];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Actualizar una categoría de egreso
  updateCategory: async (id, nombre, archivada) => {
    try {
      const query = 'UPDATE config_egresos_category SET nombre = $1, archivada = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *';
      const values = [nombre, archivada, id];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Actualizar una categoría de ingreso
  updateCategoryIn: async (id, nombre, archivada) => {
    try {
      const query = 'UPDATE config_ingresos_category SET nombre = $1, archivada = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *';
      const values = [nombre, archivada, id];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Archivar una categoría de egreso
  archiveCategory: async (id, status) => {
    try {
      const query = 'UPDATE config_egresos_category SET archivada = $2, "updatedAt" = NOW() WHERE id = $1 RETURNING *';
      const values = [id, status];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Archivar una categoría de ingreso
  archiveCategoryIn: async (id, status) => {
    try {
      const query = 'UPDATE config_ingresos_category SET archivada = $2, "updatedAt" = NOW() WHERE id = $1 RETURNING *';
      const values = [id, status];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Eliminar una categoría de egreso (solo si no está asociada a un gasto)
  deleteCategory: async (id) => {
    try {
      // Verificar si la categoría está asociada a algún gasto
      const checkGastosQuery = 'SELECT * FROM egresos WHERE "gastoCategoryId" = $1';
      const checkRes = await pool.query(checkGastosQuery, [id]);

      if (checkRes.rows.length > 0) {
        throw new Error('No se puede eliminar la categoría. Está asociada a uno o más egresos.');
      }

      const query = 'DELETE FROM config_egresos_category WHERE id = $1';
      const values = [id];
      const res = await pool.query(query, values);
      return res; // Retorna la cantidad de filas eliminadas
    } catch (error) {
      throw error;
    }
  },

  // Obtener la configuración de crédito por rutaId
  getByRutaId: async (rutaId) => {
    const queryText = `
      SELECT * FROM config_credits 
      WHERE "rutaId" = $1;
    `;
    const result = await pool.query(queryText, [rutaId]);
    return result.rows[0];
  },

  // Obtener la configuración de crédito por rutaId
  getConfigDefault: async () => {
    const queryText = `
      SELECT * FROM config_default 
      WHERE id = 1;
    `;
    const result = await pool.query(queryText);
    return result.rows[0];
  },

  // Obtener todas las rutas con su configuración de crédito
  getRutasConfig: async (page, limit, search) => {
    const offset = (page - 1) * limit;
  
    // Contar total con o sin filtro
    let countQuery = 'SELECT COUNT(*) FROM ruta';
    let countParams = [];
    if (search) {
      countQuery += ' WHERE nombre ILIKE $1';
      countParams = [`%${search}%`];
    }
    const countResult = await pool.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);
  
    // Construir la consulta principal
    let queryText = `
      SELECT 
        r.id AS ruta_id,
        r.nombre AS ruta_nombre,
        c.monto_minimo,
        c.monto_maximo,
        c.plazo_minimo,
        c.plazo_maximo,
        c.interes,
        c.max_credits,
        c.frecuencia_pago
      FROM ruta r
      LEFT JOIN config_credits c ON r.id = c."rutaId"
    `;
    const queryParams = [limit, offset];
    if (search) {
      queryText += ` WHERE r.nombre ILIKE $3`;
      queryParams.push(`%${search}%`);
    }
  
    queryText += `
      ORDER BY r.nombre ASC
      LIMIT $1 OFFSET $2
    `;
  
    const result = await pool.query(queryText, queryParams);
  
    return {
      data: result.rows,
      totalItems,
      totalPages
    };
  },  

  // Función para actualizar la configuración de crédito de una ruta
  updateRutaConfig: async (rutaId, configData) => {
    const queryText = `
      UPDATE config_credits
      SET 
        monto_minimo = $1,
        monto_maximo = $2,
        plazo_minimo = $3,
        plazo_maximo = $4,
        interes = $5,
        max_credits = $6,
        frecuencia_pago = $7
      WHERE "rutaId" = $8
      RETURNING *; -- Retorna el registro actualizado
    `;

    const values = [
      configData.monto_minimo,
      configData.monto_maximo,
      configData.plazo_minimo,
      configData.plazo_maximo,
      configData.interes,
      configData.max_credits,
      configData.frecuencia_pago.split(','),
      rutaId
    ];

    try {
      const result = await pool.query(queryText, values);
      return result.rows[0];  // Retorna la fila actualizada
    } catch (err) {
      console.error('Error al actualizar configuración de ruta', err);
      throw err;  // Lanza el error para ser manejado más arriba
    }
  },

  // Función para actualizar la configuración de crédito de una ruta
  updateConfigDefault: async (configData) => {
    const queryText = `
      UPDATE config_default
      SET 
        monto_minimo = $1,
        monto_maximo = $2,
        plazo_minimo = $3,
        plazo_maximo = $4,
        interes = $5,
        max_credits = $6,
        frecuencia_pago = $7,
        days_to_yellow = $8,
        days_to_red = $9,
        porcentaje_abono_maximo = $10,
        porcentaje_minimo_novacion = $11
      WHERE id = 1
      RETURNING *; -- Retorna el registro actualizado
    `;

    const values = [
      configData.monto_minimo,
      configData.monto_maximo,
      configData.plazo_minimo,
      configData.plazo_maximo,
      configData.interes,
      configData.max_credits,
      configData.frecuencia_pago,
      configData.days_to_yellow,
      configData.days_to_red,
      configData.porcentaje_abono_maximo,
      configData.porcentaje_minimo_novacion
    ];

    try {
      const result = await pool.query(queryText, values);
      return result.rows[0];  // Retorna la fila actualizada
    } catch (err) {
      console.error('Error al actualizar configuración por defecto', err);
      throw err;  // Lanza el error para ser manejado más arriba
    }
  },

  //Ingresar un dia no laborable
  createNoLaborable: async (fecha, descripcion) => {
    const query = `
      INSERT INTO dias_no_laborables (fecha, descripcion, "createdAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW())
      RETURNING *;
    `;
    const result = await pool.query(query, [fecha, descripcion]);
    return result.rows[0];
  },

  //Obtener todos los dias no laborales
  getAllNoLaborable: async (limit, offset) => {
    const query = `
      SELECT * FROM dias_no_laborables
      ORDER BY fecha ASC
      LIMIT $1 OFFSET $2;
    `;
    const countQuery = `SELECT COUNT(*) FROM dias_no_laborables;`;
  
    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery),
    ]);
  
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);
  
    return {
      data: result.rows,
      total,
      totalPages,
    };
  },  

  // Eliminar un día no laborable por ID
  deleteNoLaborable: async (id) => {
    const query = `DELETE FROM dias_no_laborables WHERE id = $1 RETURNING *;`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = Config;