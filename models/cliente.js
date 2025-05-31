const db = require('../config/db'); // Importa la conexión a la base de datos

// Definir las consultas SQL
const Cliente = {
  create: async (clienteData, nacionalidad, userId) => {
    const {
      nombres,
      telefono,
      direccion,
      coordenadasCasa,
      coordenadasCobro,
      identificacion,
      rutaId,
      fotos
    } = clienteData;
  
    const client = await db.connect();
    try {
      await client.query('BEGIN');
  
      // 0️⃣ Verificar si la identificación ya existe
      const checkIdentificacionQuery = `
        SELECT id FROM clientes WHERE identificacion = $1;
      `;
      const checkResult = await client.query(checkIdentificacionQuery, [identificacion]);
  
      if (checkResult.rows.length > 0) {
        throw { code: 'IDENTIFICACION_DUPLICADA', message: 'Ya existe un cliente con esa identificación' };
      }
  
      // 1️⃣ Insertar el cliente
      const insertClienteQuery = `
        INSERT INTO clientes (nombres, telefono, direccion, "coordenadasCasa", "coordenadasCobro", identificacion, estado, "rutaId", nacionalidad, "userId_create", buro, updated, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7, $8, $9, 400, true, NOW(), NOW())
        RETURNING id;
      `;
      const clienteValues = [nombres, telefono, direccion, coordenadasCasa, coordenadasCobro, identificacion, rutaId, nacionalidad[0], userId];
      const result = await client.query(insertClienteQuery, clienteValues);
      const clienteId = result.rows[0].id;
  
      // 2️⃣ Insertar las fotos en la tabla fotoclientes
      if (Array.isArray(fotos) && fotos.length > 0) {
        const insertFotoQuery = `
          INSERT INTO fotoclientes ("clienteId", foto, "createdAt", "updatedAt")
          VALUES ($1, $2, NOW(), NOW());
        `;
  
        for (const foto of fotos) {
          await client.query(insertFotoQuery, [clienteId, foto]);
        }
      }
  
      await client.query('COMMIT');
      return { id: clienteId };
  
    } catch (error) {
      await client.query('ROLLBACK');
  
      // Manejar error personalizado
      if (error.code === 'IDENTIFICACION_DUPLICADA') {
        throw { status: 409, message: error.message }; // 409 Conflict
      }
  
      throw error;
    } finally {
      client.release();
    }
  },

  update: async (id, updatedData) => {
    const fields = Object.keys(updatedData);
    const values = Object.values(updatedData);
  
    if (fields.length === 0) {
      throw new Error('No hay datos para actualizar');
    }
  
    const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
  
    const queryText = `
      UPDATE clientes
      SET ${setClause}
      WHERE id = $${fields.length + 1}
      RETURNING *;
    `;
  
    const result = await db.query(queryText, [...values, id]);
    return result.rows[0];
  },  

  // Obtener todos los registros con filtro de búsqueda y paginación
  getAll: async (limit, offset, searchTerm = '', oficinaId = null, rutaId = null, userId = null) => {
    const hasSearch = searchTerm.trim() !== '';

    let queryText = `
      SELECT 
        c.id, c.nombres, c.identificacion, c.nacionalidad, c.estado, c.telefono, c.direccion, 
        c."coordenadasCasa", c."coordenadasCobro", c.buro,
        r.id AS ruta_id, r.nombre AS ruta_nombre
      FROM clientes c
      LEFT JOIN ruta r ON c."rutaId" = r.id
    `;
 
    let params = [];
    let filters = [];

    // Filtro de búsqueda
    if (hasSearch) {
      filters.push(`(
        LOWER(c.nombres) ILIKE LOWER('%' || $${params.length + 1} || '%') OR
        LOWER(c.identificacion) ILIKE LOWER('%' || $${params.length + 1} || '%') OR
        LOWER(c.nacionalidad) ILIKE LOWER('%' || $${params.length + 1} || '%') OR
        LOWER(c.estado) ILIKE LOWER('%' || $${params.length + 1} || '%') OR
        LOWER(c.telefono) ILIKE LOWER('%' || $${params.length + 1} || '%')
      )`);
      params.push(searchTerm);
    }

    // Filtro por oficina
    if (oficinaId) {
      filters.push(`r."oficinaId" = $${params.length + 1}`);
      params.push(oficinaId);
    } else if (userId) {
      // Si no se seleccionó oficina, obtener oficinas asociadas al usuario
      const userOficinasResult = await db.query(`
        SELECT "oficinaId" FROM usuariooficinas WHERE "usuarioId" = $1
      `, [userId]);

      const oficinaIds = userOficinasResult.rows.map(row => row.oficinaId);

      if (oficinaIds.length > 0) {
        const oficinaPlaceholders = oficinaIds.map((_, i) => `$${params.length + i + 1}`).join(',');
        filters.push(`r."oficinaId" IN (${oficinaPlaceholders})`);
        params.push(...oficinaIds);
      } else {
        // Si no tiene oficinas asignadas, devolver vacío
        return {
          data: [],
          total: 0,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: 0
        };
      }
    }

    // Filtro por ruta
    if (rutaId) {
      filters.push(`c."rutaId" = $${params.length + 1}`);
      params.push(rutaId);
    }

    // WHERE final
    if (filters.length) {
      queryText += ' WHERE ' + filters.join(' AND ');
    }

    // Paginación
    queryText += `
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    // Ejecutar consulta principal
    const result = await db.query(queryText, params);

    // Conteo total sin paginación
    const countQueryText = `
      SELECT COUNT(*) FROM clientes c
      LEFT JOIN ruta r ON c."rutaId" = r.id
      ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''}
    `;
    const countResult = await db.query(countQueryText, params.slice(0, -2));

    const total = Number(countResult.rows[0].count);

    return {
      data: result.rows.map(({ ruta_id, ruta_nombre, ...cliente }) => ({
        ...cliente,
        ruta: ruta_id ? { id: ruta_id, nombre: ruta_nombre } : null
      })),
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },      

  // Obtener un cliente por su ID
  getById: async (id) => {
    // 1. Obtener cliente
    const clienteQuery = 'SELECT * FROM clientes WHERE id = $1;';
    const clienteResult = await db.query(clienteQuery, [id]);
    const cliente = clienteResult.rows[0];
  
    if (!cliente) return null;
  
    // 2. Obtener fotos
    const fotosQuery = 'SELECT foto FROM fotoclientes WHERE "clienteId" = $1;';
    const fotosResult = await db.query(fotosQuery, [id]);
    cliente.fotos = fotosResult.rows.map(row => row.foto);
  
    // 3. Obtener créditos
    const creditosQuery = 'SELECT * FROM creditos WHERE "clienteId" = $1;';
    const creditosResult = await db.query(creditosQuery, [id]);
    const creditos = creditosResult.rows;
  
    // 4. Para cada crédito, obtener cuotas y pagos
    for (let credito of creditos) {
      // Cuotas del crédito
      const cuotasQuery = 'SELECT * FROM cuotas WHERE "creditoId" = $1;';
      const cuotasResult = await db.query(cuotasQuery, [credito.id]);
      const cuotas = cuotasResult.rows;
  
      // Pagos de cada cuota
      for (let cuota of cuotas) {
        const pagosQuery = 'SELECT * FROM pagos_cuotas WHERE "cuotaId" = $1;';
        const pagosResult = await db.query(pagosQuery, [cuota.id]);
        cuota.pagos = pagosResult.rows;
      }
  
      credito.cuotas = cuotas;
    }
  
    // 5. Adjuntar créditos al cliente
    cliente.creditos = creditos;
  
    return cliente;
  },  

   // Obtener un cliente por su ID
   getNameById: async (id) => {
    // 1. Obtener cliente
    const clienteQuery = 'SELECT nombres FROM clientes WHERE id = $1;';
    const clienteResult = await db.query(clienteQuery, [id]);
    const cliente = clienteResult.rows[0];
  
    if (!cliente) return null;
  
    return cliente;
  },  

  // Archivar un cliente (cambiar su estado a "archivado")
  archive: async (id) => {
    const queryText = 'UPDATE clientes SET estado = \'archivado\' WHERE id = $1 RETURNING *;';
    const result = await db.query(queryText, [id]);
    return result.rows[0]; // Devuelve el cliente archivado
  },
 
  // Obtener clientes por ruta con paginación y búsqueda solo por nombre
  getByRutaId: async (page, rutaId, limit, offset, search) => {
    const searchFilter = search ? `%${search}%` : null;
  
    let queryText = `
      SELECT * FROM clientes
      WHERE "rutaId" = $1 AND estado != 'archivado'
    `;
    let queryParams = [rutaId];
  
    if (search) {
      queryText += ` AND nombres ILIKE $2`;
      queryParams.push(searchFilter);
    }
  
    queryText += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
  
    // Ejecutar la consulta de resultados
    const result = await db.query(queryText, queryParams);
  
    // Consulta para contar los registros totales
    let countQuery = `
      SELECT COUNT(*) FROM clientes
      WHERE "rutaId" = $1 AND estado != 'archivado'
    `;
    let countParams = [rutaId];
  
    if (search) {
      countQuery += ` AND nombres ILIKE $2`;
      countParams.push(searchFilter);
    }
  
    const countResult = await db.query(countQuery, countParams);
    const total = Number(countResult.rows[0].count);
  
    return {
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  },

  // Obtener todos los clientes de una oficina específica con paginación
  getClientesByOficinaId: async (oficinaId = 1, page, limit, offset) => {
    const queryText = `
      SELECT c.* 
      FROM clientes c
      JOIN ruta r ON r.id = c."rutaId"
      JOIN oficinas o ON o.id = r."oficinaId"
      WHERE o.id = $1 AND c.estado != 'archivado'
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(queryText, [oficinaId, limit, offset]);

    // Obtener el total de registros para cálculo de páginas
    const countQuery = `
      SELECT COUNT(*) 
      FROM clientes c
      JOIN ruta r ON r.id = c."rutaId"
      JOIN oficinas o ON o.id = r."oficinaId"
      WHERE o.id = $1 AND c.estado != 'archivado';
    `;
    const countResult = await db.query(countQuery, [oficinaId]);
    const total = Number(countResult.rows[0].count);

    return {
      data: result.rows,
      total,
      page : Number(page),
      limit : Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  },

  // 🔹 Buscar clientes por datos con paginación
  search: async (query, page, limit, offset) => {
    const searchQuery = `
      SELECT * FROM clientes 
      WHERE (LOWER(nombres) LIKE LOWER($1) 
        OR LOWER(telefono) LIKE LOWER($1) 
        OR LOWER(identificacion) LIKE LOWER($1)) 
      AND estado != 'archivado'
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(searchQuery, [`%${query}%`, limit, offset]);

    // Total de registros
    const countQuery = `
      SELECT COUNT(*) FROM clientes 
      WHERE (LOWER(nombres) LIKE LOWER($1) 
        OR LOWER(telefono) LIKE LOWER($1) 
        OR LOWER(identificacion) LIKE LOWER($1)) 
      AND estado != 'archivado';
    `;
    const countResult = await db.query(countQuery, [`%${query}%`]);
    const total = Number(countResult.rows[0].count);

    return {
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  // 🔹 Obtener clientes archivados con paginación
  getArchivedClientes: async (page, limit, offset) => {
    const queryText = `SELECT * FROM clientes WHERE estado = 'archivado' LIMIT $1 OFFSET $2;`;
    const result = await db.query(queryText, [limit, offset]);

    // Total de registros
    const countQuery = `SELECT COUNT(*) FROM clientes WHERE estado = 'archivado';`;
    const countResult = await db.query(countQuery);
    const total = Number(countResult.rows[0].count);

    return {
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    };
  },
};

module.exports = Cliente;