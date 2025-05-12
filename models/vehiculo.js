const db = require('../config/db');

const Vehiculo = {
  // Crear un nuevo vehículo
  create: async ({ placa, userId, chasis, fotos = [] }) => {
    const queryVehiculo = `
      INSERT INTO vehiculos (placa, "userId", chasis)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(queryVehiculo, [placa, userId, chasis]);
    const vehiculo = rows[0];

    // Insertar fotos si hay
    if (fotos.length > 0) {
      const values = fotos.map((foto, i) => `($1, $${i + 2})`).join(', ');
      await db.query(
        `INSERT INTO vehiculos_fotos ("vehiculoId", foto) VALUES ${values};`,
        [vehiculo.id, ...fotos]
      );
    }

    return vehiculo;
  },

  // Obtener todos los vehículos paginados
    getAll: async (limit, offset, searchTerm) => {
        const whereConditions = [];
        const params = [];
        let paramIndex = 1;
    
        if (searchTerm) {
        whereConditions.push(`(
            LOWER(v.placa) LIKE LOWER($${paramIndex}) 
            OR LOWER(v.chasis) LIKE LOWER($${paramIndex})
        )`);
        params.push(`%${searchTerm}%`);
        paramIndex++;
        }
    
        const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
        const dataQuery = `
        SELECT 
            v.*, 
            u.nombre AS "responsableNombre",
            COALESCE(
            json_agg(vf.foto) FILTER (WHERE vf.foto IS NOT NULL), 
            '[]'
            ) AS fotos
        FROM vehiculos v
        LEFT JOIN usuarios u ON u.id = v."userId"
        LEFT JOIN vehiculos_fotos vf ON vf."vehiculoId" = v.id
        ${whereClause}
        GROUP BY v.id, u.nombre
        ORDER BY v.id DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex};
        `;
    
        params.push(limit, offset);
    
        const { rows } = await db.query(dataQuery, params);
    
        // Total count
        const countQuery = `SELECT COUNT(*) FROM vehiculos v ${whereClause};`;
        const countParams = params.slice(0, paramIndex - 2); // sin limit y offset
        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);
    
        return {
        data: rows,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
        };
    },  

  // Obtener un vehículo por ID
  getById: async (id) => {
    const query = `
      SELECT v.*, 
        COALESCE(
          json_agg(vf.foto) FILTER (WHERE vf.foto IS NOT NULL), 
          '[]'
        ) AS fotos
      FROM vehiculos v
      LEFT JOIN vehiculos_fotos vf ON vf."vehiculoId" = v.id
      WHERE v.id = $1
      GROUP BY v.id;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  // Actualizar un vehículo
    update: async (id, { placa, userId, chasis, fotosExistentes = [], nuevasFotos = [] }) => {
        const queryUpdate = `
        UPDATE vehiculos 
        SET placa = $1, "userId" = $2, chasis = $3
        WHERE id = $4 RETURNING *;
        `;
        const { rows } = await db.query(queryUpdate, [placa, userId, chasis, id]);
        const vehiculo = rows[0];

        // Borrar todas las fotos del vehículo
        await db.query(`DELETE FROM vehiculos_fotos WHERE "vehiculoId" = $1`, [id]);

        // Insertar las fotos que vienen desde el front (existentes + nuevas)
        const todasLasFotos = [...fotosExistentes, ...nuevasFotos];
        if (todasLasFotos.length > 0) {
        const values = todasLasFotos.map((_, i) => `($1, $${i + 2})`).join(', ');
        await db.query(
            `INSERT INTO vehiculos_fotos ("vehiculoId", foto) VALUES ${values}`,
            [id, ...todasLasFotos]
        );
        }
        return vehiculo;
    },  

  // Eliminar un vehículo
  delete: async (id) => {
    await db.query(`DELETE FROM vehiculos_fotos WHERE "vehiculoId" = $1;`, [id]);
    await db.query(`DELETE FROM vehiculos WHERE id = $1;`, [id]);
    return { message: 'Vehículo eliminado correctamente.' };
  },
};

module.exports = Vehiculo;