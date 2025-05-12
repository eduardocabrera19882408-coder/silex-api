const db = require('../config/db');

const Oficina = {
  //Crear una nueva oficina
  create: async (oficinaData) => {
    // Insertar la oficina
    const queryText = `
      INSERT INTO oficinas (nombre, direccion, telefono, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *;
    `;
    const values = [oficinaData.nombre, oficinaData.direccion, oficinaData.telefono];
    const { rows } = await db.query(queryText, values);
    const oficina = rows[0];
  
    // Insertar relación en usuariooficinas si hay un userId
    if (oficinaData.userId) {
      await db.query(
        `INSERT INTO usuariooficinas ("usuarioId", "oficinaId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW());`,
        [oficinaData.userId, oficina.id]
      );
    }
  
    return oficina;
  },

  // Obtener todas las oficinas con rutas y usuarios para admin
  getAllOficinas: async (page, limit, offset, role, userId) => {
    const params = [limit, offset];

    const queryText = `
      SELECT 
        o.*, 
        r.id AS "rutaId", 
        r.nombre AS "rutaNombre"
      FROM oficinas o
      LEFT JOIN ruta r ON o.id = r."oficinaId"
      ORDER BY o."createdAt" DESC
      LIMIT $1 OFFSET $2;
    `;

    const { rows } = await db.query(queryText, params);

    const oficinasMap = {};

    rows.forEach((row) => {
      if (!oficinasMap[row.id]) {
        oficinasMap[row.id] = {
          id: row.id,
          nombre: row.nombre,
          direccion: row.direccion,
          telefono: row.telefono,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          rutas: [],
        };
      }

      if (row.rutaId && !oficinasMap[row.id].rutas.some(r => r.id === row.rutaId)) {
        oficinasMap[row.id].rutas.push({
          id: row.rutaId,
          nombre: row.rutaNombre,
        });
      }
    });

    const resultRows = Object.values(oficinasMap);

    // Contar total de oficinas
    let countQuery = `SELECT COUNT(*) AS total FROM oficinas`;
    const countResult = await db.query(countQuery);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      data: resultRows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
    };
  },

  // Obtener todas las oficinas con rutas y usuarios usando solo LEFT JOIN
  getAll: async (page, limit, offset, role, userId) => {
    let whereClause = '';
    const params = [limit, offset];

    // Solo limitar si el rol es administrador_oficina
    if (role === 'administrador_oficina') {
      whereClause = `
        WHERE o.id IN (
          SELECT "oficinaId"
          FROM usuariooficinas
          WHERE "usuarioId" = $3
        )
      `;
      params.push(userId);
    }

    const queryText = `
      SELECT o.*, 
            r.id AS "rutaId", 
            r.nombre AS "rutaNombre",
            u.id AS "usuarioId", 
            u.nombre AS "usuarioNombre"
      FROM oficinas o
      LEFT JOIN ruta r ON o.id = r."oficinaId"
      LEFT JOIN usuariooficinas uo ON o.id = uo."oficinaId"
      LEFT JOIN usuarios u ON uo."usuarioId" = u.id
      ${whereClause}
      ORDER BY o."createdAt" DESC
      LIMIT $1 OFFSET $2;
    `;

    const { rows } = await db.query(queryText, params);

    const oficinasMap = {};

    rows.forEach((row) => {
      if (!oficinasMap[row.id]) {
        oficinasMap[row.id] = {
          id: row.id,
          nombre: row.nombre,
          direccion: row.direccion,
          telefono: row.telefono,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          rutas: [],
          usuarios: [],
        };
      }

      if (row.rutaId && !oficinasMap[row.id].rutas.some(r => r.id === row.rutaId)) {
        oficinasMap[row.id].rutas.push({
          id: row.rutaId,
          nombre: row.rutaNombre,
        });
      }

      if (row.usuarioId && !oficinasMap[row.id].usuarios.some(u => u.id === row.usuarioId)) {
        oficinasMap[row.id].usuarios.push({
          id: row.usuarioId,
          nombre: row.usuarioNombre,
        });
      }
    });

    const resultRows = Object.values(oficinasMap);

    // Contar total según el rol
    let countQuery = `SELECT COUNT(*) AS total FROM oficinas`;
    let countParams = [];

    if (role === 'administrador_oficina') {
      countQuery = `
        SELECT COUNT(DISTINCT o.id) AS total
        FROM oficinas o
        JOIN usuariooficinas uo ON o.id = uo."oficinaId"
        WHERE uo."usuarioId" = $1
      `;
      countParams = [userId];
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      data: resultRows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
    };
  },

  // Obtener una oficina por ID con rutas y usuarios asignados
  getById: async (id) => {
    const queryText = `
      SELECT o.*, 
            r.id AS "rutaId", r.nombre AS "rutaNombre", 
            u.id AS "usuarioId", u.nombre AS "usuarioNombre"
      FROM oficinas o
      LEFT JOIN ruta r ON o.id = r."oficinaId"
      LEFT JOIN usuariooficinas uo ON o.id = uo."oficinaId"
      LEFT JOIN usuarios u ON uo."usuarioId" = u.id
      WHERE o.id = $1;
    `;

    const { rows } = await db.query(queryText, [id]);

    // Si no hay resultados, devolver null
    if (rows.length === 0) return null;

    console.log(rows)

    // Estructurando los datos para devolver rutas y usuarios
    const oficina = {
      id: rows[0].id,
      nombre: rows[0].nombre,
      direccion: rows[0].direccion,
      telefono: rows[0].telefono,
      createdAt: rows[0].createdAt,
      updatedAt: rows[0].updatedAt,
      rutas: [],
      usuarios: [],
    };

    // Agregar las rutas al objeto oficina
    rows.forEach(row => {
      if (row.rutaId) {
        oficina.rutas.push({
          id: row.rutaId,
          nombre: row.rutaNombre,
        });
      }
    });

    //Agregar usuario al objeto oficina
    if (rows[0].usuarioId) {
      oficina.usuarios.push({
        id: rows[0].usuarioId,
        nombre: rows[0].usuarioNombre,
      });
    }

    return oficina;
  },

  update: async (id, updateData) => {
    // Actualizar la oficina
    const queryText = `
      UPDATE oficinas 
      SET nombre = $1, direccion = $2, telefono = $3, "updatedAt" = NOW()
      WHERE id = $4 RETURNING *;
    `;
    const values = [updateData.nombre, updateData.direccion, updateData.telefono, id];
    const { rows } = await db.query(queryText, values);
    const oficina = rows[0];
  
    // Eliminar relación previa en usuariooficinas
    await db.query(`DELETE FROM usuariooficinas WHERE "oficinaId" = $1;`, [id]);
  
    // Insertar nueva relación si hay un userId
    if (updateData.userId) {
      await db.query(
        `INSERT INTO usuariooficinas ("usuarioId", "oficinaId","createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW());`,
        [updateData.userId, id]
      );
    }
  
    return oficina;
  },  

  // Verificar si la oficina tiene rutas asociadas
  hasRutas: async (id) => {
    const query = `SELECT COUNT(*) AS total FROM ruta WHERE "oficinaId" = $1;`;
    const result = await db.query(query, [id]);
    return parseInt(result.rows[0].total) > 0;
  },

  // Eliminar relaciones de la oficina en usuariooficinas
  removeUserRelations: async (id) => {
    const query = `DELETE FROM usuariooficinas WHERE "oficinaId" = $1;`;
    await db.query(query, [id]);
  },

  // Buscar oficinas por nombre con rutas y usuarios
  searchByName: async (searchTerm, page, limit, offset) => {
    const queryText = `
      SELECT o.*, 
        json_agg(DISTINCT jsonb_build_object('id', r.id, 'nombre', r.nombre)) AS rutas,
        json_agg(DISTINCT jsonb_build_object('id', u.id, 'nombre', u.nombre)) AS usuarios
      FROM oficinas o
      LEFT JOIN ruta r ON o.id = r."oficinaId"
      LEFT JOIN usuariooficinas uo ON o.id = uo."oficinaId"
      LEFT JOIN usuarios u ON uo."usuarioId" = u.id
      WHERE o.nombre ILIKE $1
      GROUP BY o.id
      ORDER BY o."createdAt" DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await db.query(queryText, [`%${searchTerm}%`, limit, offset]);

    // Obtener total de oficinas encontradas
    const countQuery = `SELECT COUNT(*) FROM oficinas WHERE nombre ILIKE $1;`;
    const countResult = await db.query(countQuery, [`%${searchTerm}%`]);

    const total = Number(countResult.rows[0].count);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return {
      data: result.rows,
      total: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: totalPages
    };
  },

  // Eliminar una oficina (solo si no tiene rutas)
  delete: async (id) => {
    // Verificar si la oficina tiene rutas
    const hasRutas = await Oficina.hasRutas(id);
    if (hasRutas) {
      throw new Error("No se puede eliminar la oficina porque tiene rutas asociadas.");
    }

    // Eliminar relaciones con usuarios
    await Oficina.removeUserRelations(id);

    // Eliminar la oficina
    const query = `DELETE FROM oficinas WHERE id = $1;`;
    await db.query(query, [id]);

    return { message: "Oficina eliminada correctamente." };
  }
};

module.exports = Oficina;