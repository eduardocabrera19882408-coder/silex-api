const db = require('../config/db');

const Ruta = {
  // Crear una nueva ruta y asignarla al usuario en usuariorutas + crear config_credits
  create: async (rutaData) => { 
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1️⃣ Insertar la nueva ruta
      const queryText = `
        INSERT INTO ruta (nombre, "oficinaId", user_create, "userId", "createdAt", "updatedAt", "productoId") 
        VALUES ($1, $2, $3, $4, NOW(), NOW(), $5) 
        RETURNING *;
      `;
      const values = [rutaData.nombre, rutaData.oficinaId, rutaData.userCreate, rutaData.userId, rutaData.productoId];
      const rutaResult = await client.query(queryText, values);
      const ruta = rutaResult.rows[0];

      // 2️⃣ Insertar relación en usuariorutas
      const userRutaQuery = `
        INSERT INTO usuariorutas ("usuarioId", "rutaId", "createdAt", "updatedAt")
        VALUES ($1, $2, NOW(), NOW());
      `;
      await client.query(userRutaQuery, [rutaData.userId, ruta.id]);

      // 3️⃣ Crear configuración de crédito por defecto para la ruta
      const configQuery = `
        INSERT INTO config_credits (
          "rutaId", max_credits, interes, plazo_minimo, plazo_maximo,
          monto_minimo, monto_maximo, frecuencia_pago
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        );
      `;

      // Obtener configuracion por defecto
      const queryConfig = `
        SELECT * FROM config_default WHERE id = 1;
      `;
      const configResult = await client.query(queryConfig);
      const config = configResult.rows[0];
      const configValues = [
        ruta.id,
        config.max_credits,     // max_credits
        config.interes,         // interes
        config.plazo_minimo,    // plazo_minimo
        config.plazo_maximo,    // plazo_maximo
        config.monto_minimo,    // monto_minimo
        config.monto_maximo,    // monto_maximo
        config.frecuencia_pago  // frecuencia_pago por defecto como array ENUM
      ];

      await client.query(configQuery, configValues);

      await client.query('COMMIT');
      return ruta;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Obtener todas las rutas con paginación
  getAll: async (page, limit, offset) => {
    const queryText = `SELECT * FROM ruta LIMIT $1 OFFSET $2;`;
    const result = await db.query(queryText, [limit, offset]);

    // Obtener total de registros
    const countQuery = `SELECT COUNT(*) FROM ruta;`;
    const countResult = await db.query(countQuery);
    const total = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return { data: result.rows, total, page, limit, totalPages };
  },

  // Obtener una ruta por ID con los usuarios asignados
  getById: async (id) => {
    const queryText = `
      SELECT r.*, u.id AS "usuarioId", u.nombre AS "usuarioNombre"
      FROM ruta r
      LEFT JOIN usuariorutas ur ON r.id = ur."rutaId"
      LEFT JOIN usuarios u ON ur."usuarioId" = u.id
      WHERE r.id = $1;
    `;

    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) return null;

    // Estructurar los datos para agrupar los usuarios dentro de un array
    const ruta = {
      id: result.rows[0].id,
      nombre: result.rows[0].nombre,
      oficinaId: result.rows[0].oficinaId,
      createdAt: result.rows[0].createdAt,
      updatedAt: result.rows[0].updatedAt,
      usuario: [],
    };

    result.rows.forEach((row) => {
      if (row.usuarioId) {
        ruta.usuario.push({
          id: row.usuarioId,
          nombre: row.usuarioNombre,
        });
      }
    });

    return ruta;
  },

  // Editar una ruta y actualizar su relación con los usuarios
  update: async (id, updateData) => {
    try {
      // Iniciar transacción manualmente
      await db.query('BEGIN');

      // Actualizar la ruta
      const queryText = `
        UPDATE ruta
        SET nombre = $1, "oficinaId" = $2, "userId" = $4, "updatedAt" = NOW()
        WHERE id = $3 
        RETURNING *;
      `;
      const values = [updateData.nombre, updateData.oficinaId, id, updateData.userId];
      const rutaResult = await db.query(queryText, values);

      if (rutaResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return null; // Ruta no encontrada
      }

      // Eliminar relaciones antiguas en usuariorutas
      await db.query(`DELETE FROM usuariorutas WHERE "rutaId" = $1;`, [id]);

      // Insertar nuevas relaciones con usuarios
      if (updateData.userId) {
        const userIds = Array.isArray(updateData.userId) ? updateData.userId : [updateData.userId];

        for (const userId of userIds) {
          await db.query(
            `INSERT INTO usuariorutas ("usuarioId", "rutaId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW());`,
            [userId, id]
          );
        }
      }

      await db.query('COMMIT'); // Confirmar transacción
      return rutaResult.rows[0]; // Devolver la ruta actualizada
    } catch (error) {
      await db.query('ROLLBACK'); // Revertir cambios en caso de error
      throw error;
    }
  },

  // Verificar si hay clientes asociados a la ruta
  checkClientesAsociados: async (rutaId) => {
    const queryText = `SELECT COUNT(*) AS total FROM clientes WHERE "rutaId" = $1;`;
    const { rows } = await db.query(queryText, [rutaId]);
    return rows[0].total;
  },

  // Obtener rutas por oficina
  getByOficina: async (oficinaId, page, limit, offset) => {
    const queryText = `
        SELECT id, nombre, "createdAt", "updatedAt"
        FROM ruta
        WHERE "oficinaId" = $1
        ORDER BY "createdAt" DESC
        LIMIT $2 OFFSET $3;
    `;
    const { rows } = await db.query(queryText, [oficinaId, limit, offset]);

    // Obtener el total de rutas en la oficina
    const countQuery = `SELECT COUNT(*) AS total FROM ruta WHERE "oficinaId" = $1;`;
    const countResult = await db.query(countQuery, [oficinaId]);
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
        data: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
    };
  },

  // Buscar rutas por nombre con paginación, incluyendo usuario y oficina
  searchByName: async (searchTerm, page, limit, offset) => {
    const queryText = `
      SELECT 
        r.id, 
        r.nombre, 
        r."userId", 
        r."oficinaId", 
        r."createdAt", 
        r."updatedAt",

        -- Datos del usuario
        u.nombre AS "usuarioNombre",
        u.correo AS "usuarioCorreo",

        -- Datos de la oficina
        o.nombre AS "oficinaNombre"

      FROM ruta r
      LEFT JOIN usuarios u ON r."userId" = u.id
      LEFT JOIN oficinas o ON r."oficinaId" = o.id
      WHERE LOWER(r.nombre) LIKE LOWER($1)
      ORDER BY r."createdAt" DESC
      LIMIT $2 OFFSET $3;
    `;

    const { rows } = await db.query(queryText, [`%${searchTerm}%`, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM ruta 
      WHERE LOWER(nombre) LIKE LOWER($1);
    `;
    const countResult = await db.query(countQuery, [`%${searchTerm}%`]);
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        userId: row.userId,
        oficinaId: row.oficinaId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        usuario: {
          id: row.userId,
          nombre: row.usuarioNombre,
          correo: row.usuarioCorreo,
        },
        oficina: {
          id: row.oficinaId,
          nombre: row.oficinaNombre,
        },
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
    };
  },

  // Buscar rutas asignadas a un usuario, incluyendo la configuración de la ruta
  getByUsuario: async (usuarioId, page, limit, offset) => {
    const queryText = `
      SELECT 
        r.id, 
        r.nombre, 
        r."oficinaId", 
        r."createdAt", 
        r."updatedAt",
        cc."max_credits", 
        cc.interes, 
        cc."plazo_maximo", 
        cc."plazo_minimo", 
        cc."monto_maximo", 
        cc."monto_minimo", 
        cc."frecuencia_pago"
      FROM ruta r
      INNER JOIN usuariorutas ur ON r.id = ur."rutaId"
      LEFT JOIN config_credits cc ON cc."rutaId" = r.id
      WHERE ur."usuarioId" = $1
      ORDER BY r."createdAt" DESC
      LIMIT $2 OFFSET $3;
    `;

    const { rows } = await db.query(queryText, [usuarioId, limit, offset]);

    // Obtener el total de rutas asignadas al usuario
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ruta r
      INNER JOIN usuariorutas ur ON r.id = ur."rutaId"
      WHERE ur."usuarioId" = $1;
    `;
    const countResult = await db.query(countQuery, [usuarioId]);
    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        oficinaId: row.oficinaId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        config: {
          maxCredits: row.max_credits,
          interes: row.interes,
          plazoMaximo: row.plazo_maximo,
          plazoMinimo: row.plazo_minimo,
          montoMaximo: row.monto_maximo,
          montoMinimo: row.monto_minimo,
          frecuenciaPago: row.frecuencia_pago
        }
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    };
  },

  getRutaPorUsuarioId: async (usuarioId) => {
    const query = `
      SELECT 
        cl.nombres AS nombre,
        split_part(cl."coordenadasCobro", ',', 1)::float AS lat,
        split_part(cl."coordenadasCobro", ',', 2)::float AS lng,
        COALESCE(SUM(cuotas_hoy.monto), 0) AS cuota,
        MAX(cuotas_hoy."fechaPago")::date AS "fechaPago",
        COALESCE(SUM(atrasadas."cuotasAtrasadas"), 0) AS "cuotasAtrasadas"
      FROM clientes cl
      JOIN creditos cr ON cr."clienteId" = cl.id
      LEFT JOIN (
        SELECT 
          cu."creditoId",
          cu.monto,
          cu."fechaPago"
        FROM cuotas cu
        WHERE cu."fechaPago"::date = CURRENT_DATE
      ) cuotas_hoy ON cuotas_hoy."creditoId" = cr.id
      LEFT JOIN (
        SELECT 
          cu."creditoId",
          COUNT(*) AS "cuotasAtrasadas"
        FROM cuotas cu
        WHERE cu."fechaPago"::date < CURRENT_DATE 
          AND cu.estado != 'pagado'
          AND NOT EXISTS (
            SELECT 1 
            FROM pagos pa 
            WHERE pa."cuotaId" = cu.id 
              AND pa."createdAt"::date = CURRENT_DATE
          )
        GROUP BY cu."creditoId"
      ) atrasadas ON atrasadas."creditoId" = cr.id
      WHERE cr."usuarioId" = $1
      GROUP BY cl.id;
    `;
  
    const { rows } = await db.query(query, [usuarioId]);
  
    return rows.map(row => ({
      lat: row.lat,
      lng: row.lng,
      nombre: row.nombre,
      cuota: parseFloat(row.cuota),
      fechaPago: row.fechaPago,
      cuotasAtrasadas: parseInt(row.cuotasAtrasadas)
    }));
  },    

  // Eliminar una ruta y su relación en usuariorutas + eliminar configuración de crédito
  delete: async (id) => {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Verificar si hay clientes asociados a la ruta
      const checkClientes = await client.query(
        `SELECT id FROM clientes WHERE "rutaId" = $1;`, 
        [id]
      );

      if (checkClientes.rows.length > 0) {
        throw new Error('No se puede eliminar la ruta porque tiene clientes asociados.');
      }

      // Eliminar la relación en usuariorutas
      await client.query(`DELETE FROM usuariorutas WHERE "rutaId" = $1;`, [id]);

      // Eliminar configuración de créditos asociada a la ruta
      await client.query(`DELETE FROM config_credits WHERE "rutaId" = $1;`, [id]);

      // Eliminar la ruta
      const deleteQuery = `DELETE FROM ruta WHERE id = $1 RETURNING *;`;
      const result = await client.query(deleteQuery, [id]);

      if (result.rows.length === 0) {
        throw new Error('Ruta no encontrada.');
      }

      await client.query('COMMIT');
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = Ruta;