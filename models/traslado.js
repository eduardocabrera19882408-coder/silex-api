// models/Traslado.js
const pool = require('../config/db');

const Traslado = {
  createClienteTrasladoMasivo: async (data) => {
    const {
      oficina_origen_id,
      ruta_origen_id,
      cliente_ids,
      oficina_destino_id,
      ruta_destino_id,
      motivo_traslado,
      user_create
    } = data;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Insertar registros en traslado_clientes
      const insertQuery = `
        INSERT INTO traslado_clientes (
          oficina_origen_id,
          ruta_origen_id,
          cliente_id,
          oficina_destino_id,
          ruta_destino_id,
          motivo_traslado,
          user_create,
          created_at,
          updated_at
        ) VALUES 
        ${cliente_ids.map((_, i) => `($1, $2, $${i + 3}, $${cliente_ids.length + 3}, $${cliente_ids.length + 4}, $${cliente_ids.length + 5}, $${cliente_ids.length + 6}, NOW(), NOW())`).join(',')}
        RETURNING *;
      `;

      const insertValues = [
        oficina_origen_id,
        ruta_origen_id,
        ...cliente_ids,
        oficina_destino_id,
        ruta_destino_id,
        motivo_traslado,
        user_create
      ];

      const insertResult = await client.query(insertQuery, insertValues);

      // 2. Actualizar el campo rutaId de los clientes trasladados
      const updateQuery = `
        UPDATE clientes
        SET "rutaId" = $1
        WHERE id = ANY($2::int[])
      `;

      await client.query(updateQuery, [ruta_destino_id, cliente_ids]);

      await client.query('COMMIT');

      return insertResult.rows;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en traslado masivo de clientes', error);
      throw error;
    } finally {
      client.release();
    }
  },
  getAllTraslados: async () => {
    const query = `
      SELECT 
        t.id,
        t.cliente_id,
        c.nombres AS cliente_nombre,
        t.oficina_origen_id,
        o1.nombre AS oficina_origen,
        t.ruta_origen_id,
        r1.nombre AS ruta_origen,
        t.oficina_destino_id,
        o2.nombre AS oficina_destino,
        t.ruta_destino_id,
        r2.nombre AS ruta_destino,
        t.motivo_traslado,
        t.user_create,
        u.nombre AS creado_por,
        t.created_at
      FROM traslado_clientes t
      LEFT JOIN clientes c ON c.id = t.cliente_id
      LEFT JOIN oficinas o1 ON o1.id = t.oficina_origen_id
      LEFT JOIN oficinas o2 ON o2.id = t.oficina_destino_id
      LEFT JOIN ruta r1 ON r1.id = t.ruta_origen_id
      LEFT JOIN ruta r2 ON r2.id = t.ruta_destino_id
      LEFT JOIN usuarios u ON u.id = t.user_create
      ORDER BY t.created_at DESC
    `;
  
    const result = await pool.query(query);
    return result.rows;
  }
};

module.exports = Traslado;