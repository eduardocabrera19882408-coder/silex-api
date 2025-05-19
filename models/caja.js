// models/caja.js
const pool = require('../config/db'); // Importar la conexión a la base de datos
const Ruta = require('./ruta'); // Importar el modelo de Caja

const Caja = {

  // Obtener todas las cajas
  getAll: async () => {
    try {
      const res = await pool.query('SELECT * FROM cajas');
      return res.rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener una caja por su ID
  getById: async (id) => {
    try {
      const res = await pool.query('SELECT * FROM cajas WHERE id = $1', [id]);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Obtener una caja por su ID de usuario
  getByUserId: async (id) => {
    try {
      const ruta = await Ruta.getByUserId(id);
      if(!ruta){
        throw new Error('No tienes una ruta asignada');
      }
      const res = await pool.query('SELECT * FROM cajas WHERE "rutaId" = $1', [ruta[0].id]);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Crear una nueva caja
  create: async (saldoActual, rutaId) => {
    try {
      const query = 'INSERT INTO cajas ("saldoActual", "rutaId", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW()) RETURNING *';
      const values = [saldoActual, rutaId];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Actualizar una caja
  update: async (id, saldoActual) => {
    try {
      const query = 'UPDATE cajas SET saldo_actual = $1 WHERE id = $2 RETURNING *';
      const values = [saldoActual, id];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Eliminar (desactivar) una caja
  delete: async (id) => {
    try {
      const query = 'DELETE FROM cajas WHERE id = $1';
      const values = [id];
      const res = await pool.query(query, values);
      return res.rowCount;  // Retorna la cantidad de filas eliminadas
    } catch (error) {
      throw error;
    }
  },
 
  // Agregar saldo a la caja de un usuario, verificando el permiso del administrador
  agregarSaldo: async (adminId, rutaId, monto) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1️⃣ Verificar que el administrador tiene el permiso para asignar saldo
      const permisoAdminQuery = `
      SELECT p.descripcion
      FROM permisos p
      JOIN usuarios u ON u."permisoId" = p.id
      WHERE u.id = $1 AND 'asign' = ANY(p.descripcion);
      `;
      const permisoAdminResult = await client.query(permisoAdminQuery, [adminId]);

      if (permisoAdminResult.rows.length === 0) {
      throw new Error('El usuario no tiene permiso para asignar saldo.');
      }

      // 2️⃣ Verificar que la caja de la ruta existe
      const cajaRes = await client.query(
        'SELECT id, "saldoActual" FROM cajas WHERE "rutaId" = $1',
        [rutaId]
      );

      if (cajaRes.rows.length === 0) {
        throw new Error('No se encontró la caja de la ruta.');
      }

      const caja = cajaRes.rows[0];
      const nuevoSaldo = parseFloat(caja.saldoActual) + parseFloat(monto);

      // 3️⃣ Actualizar el saldo de la caja del usuario
      await client.query(
        'UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
        [nuevoSaldo, caja.id]
      );

      // 4️⃣ Registrar el movimiento en la caja del usuario
      await client.query(
        `INSERT INTO movimientos_caja ("cajaId", tipo, monto, descripcion, saldo_anterior, saldo, "usuarioId", category, "createdAt", "updatedAt")
        VALUES ($1, 'ingreso', $2, 'Asignación de saldo', $3, $4, $5, $6, NOW(), NOW())`,
        [caja.id, monto, caja.saldoActual, nuevoSaldo, adminId, "ingreso"]
      );
      await client.query('COMMIT');
      return { message: 'Saldo agregado correctamente', nuevoSaldoUsuario: nuevoSaldo };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  cerrarCaja: async (adminOficinaId, cobradorId, montoDejar) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1️⃣ Obtener caja del cobrador
      const resCajaCobrador = await client.query(
        `SELECT id, "saldoActual", estado FROM cajas WHERE "usuarioId" = $1`,
        [cobradorId]
      );
      if (resCajaCobrador.rows.length === 0) throw new Error('Caja del cobrador no encontrada.');
      const cajaCobrador = resCajaCobrador.rows[0];
      if (cajaCobrador.estado === 'cerrada') throw new Error('La caja ya está cerrada.');

      const saldoAnteriorCobrador = parseFloat(cajaCobrador.saldoActual);
      const nuevoSaldoCobrador = parseFloat(montoDejar);
      const montoTransferido = saldoAnteriorCobrador - nuevoSaldoCobrador;

      // 2️⃣ Actualizar saldo del cobrador y cerrar caja
      await client.query(
        `UPDATE cajas SET "saldoActual" = $1, estado = 'cerrada', "updatedAt" = NOW() WHERE id = $2`,
        [nuevoSaldoCobrador, cajaCobrador.id]
      );

      // 3️⃣ Movimiento en caja del cobrador
      await client.query(
        `INSERT INTO movimientos_caja 
        ("cajaId", tipo, monto, descripcion, saldo_anterior, saldo, "usuarioId", "createdAt", "updatedAt")
        VALUES ($1, 'retiro', $2, 'Cierre de caja por administrador', $3, $4, $5, NOW(), NOW())`,
        [cajaCobrador.id, montoTransferido, saldoAnteriorCobrador, nuevoSaldoCobrador, adminOficinaId]
      );

      // 4️⃣ Obtener caja del administrador de oficina
      const resCajaAdmin = await client.query(
        `SELECT id, "saldoActual" FROM cajas WHERE "usuarioId" = $1`,
        [adminOficinaId]
      );
      if (resCajaAdmin.rows.length === 0) throw new Error('Caja del administrador no encontrada.');
      const cajaAdmin = resCajaAdmin.rows[0];
      const saldoAnteriorAdmin = parseFloat(cajaAdmin.saldoActual);
      const nuevoSaldoAdmin = saldoAnteriorAdmin + montoTransferido;

      // 5️⃣ Actualizar saldo en caja del administrador
      await client.query(
        `UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [nuevoSaldoAdmin, cajaAdmin.id]
      );

      // 6️⃣ Movimiento en caja del admin
      await client.query(
        `INSERT INTO movimientos_caja 
        ("cajaId", tipo, monto, descripcion, saldo_anterior, saldo, "usuarioId", "createdAt", "updatedAt")
        VALUES ($1, 'ingreso', $2, 'Cierre de caja del cobrador', $3, $4, $5, NOW(), NOW())`,
        [cajaAdmin.id, montoTransferido, saldoAnteriorAdmin, nuevoSaldoAdmin, adminOficinaId]
      );

      await client.query('COMMIT');

      return {
        message: 'Caja cerrada correctamente',
        saldoCobrador: nuevoSaldoCobrador,
        saldoAdmin: nuevoSaldoAdmin,
        transferido: montoTransferido
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getByCajaAndFecha: async (cajaId, fechaInicio, fechaFin, limit, offset) => {
    const query = `
      SELECT * FROM movimientos_caja
      WHERE "cajaId" = $1
      AND "createdAt" BETWEEN $2 AND $3
      ORDER BY "createdAt" DESC
      LIMIT $4 OFFSET $5;
    `;

    const values = [cajaId, fechaInicio, fechaFin, limit, offset];
    const result = await pool.query(query, values);

    const countQuery = `
      SELECT COUNT(*) FROM movimientos_caja
      WHERE "cajaId" = $1
      AND "createdAt" BETWEEN $2 AND $3;
    `;
    const countResult = await pool.query(countQuery, [cajaId, fechaInicio, fechaFin]);
    const total = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: result.rows,
      total,
      totalPages
    };
  },
 
  createEgreso: async ({ monto, descripcion, userId, gastoCategoryId, userRole, foto }) => {

    const estado = (userRole === 'administrador' || userRole === 'administrador_oficina') ? 'aprobado' : 'pendiente';
    const aprovedId = (userRole === 'administrador' || userRole === 'administrador_oficina') ? userId : 0

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ruta = await Ruta.getByUserId(userId);

      if(!ruta){
        throw new Error('No tienes una ruta asignada');
      }
  
      // 🔍 Validar hora máxima si es cobrador
      if (userRole === 'cobrador') {
        const configResult = await client.query(
          'SELECT hora_gastos FROM configuracion_gastos LIMIT 1'
        );
  
        if (configResult.rowCount === 0) {
          throw new Error('No se encontró la configuración de gastos');
        }
  
        const horaMaxima = configResult.rows[0].hora_gastos;
        const ahora = new Date();
        const horaActual = ahora.toTimeString().split(' ')[0]; // formato HH:MM:SS
  
        if (horaActual > horaMaxima) {
          throw new Error(`No se pueden registrar gastos después de las ${horaMaxima}`);
        }
      }
  
      // 🟡 Obtener la caja del usuario
      const cajaResult = await client.query(
        'SELECT id, "saldoActual", estado FROM cajas WHERE "rutaId" = $1 LIMIT 1',
        [ruta[0].id]
      );
  
      if (cajaResult.rowCount === 0) {
        throw new Error('No se encontró una caja asociada');
      }
  
      if (cajaResult.rows[0].estado === 'cerrada') {
        throw new Error('La caja está cerrada.');
      }
  
      const cajaId = cajaResult.rows[0].id;
      const saldoActual = parseFloat(cajaResult.rows[0].saldoActual);
  
      // 🧮 Verificar saldo si es aprobado
      if (estado === 'aprobado' && monto > saldoActual) {
        throw new Error('Saldo insuficiente en caja para realizar el egreso');
      }
  
      // 🟢 Insertar egreso
      const insertEgresoQuery = `
        INSERT INTO egresos (
          monto, descripcion, estado, "cajaId", "gastoCategoryId",
          "user_created_id", "user_aproved_id", foto, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *;
      `;
      const egresoValues = [monto, descripcion, estado, cajaId, gastoCategoryId, userId, aprovedId, foto];
      const egresoResult = await client.query(insertEgresoQuery, egresoValues);
      const egreso = egresoResult.rows[0];
  
      // ✅ Registrar movimiento si aprobado
      if (estado === 'aprobado') {
        const saldoAnterior = saldoActual;
        const nuevoSaldo = saldoAnterior - monto;
  
        const insertMovimientoCajaQuery = `
          INSERT INTO movimientos_caja (
            "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
            monto, tipo, "usuarioId", category
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8);
        `;
  
        const movimientoValues = [
          cajaId,
          descripcion,
          nuevoSaldo,
          saldoAnterior,
          monto,
          'gasto',
          userId,
          'egreso'
        ];
  
        await client.query(insertMovimientoCajaQuery, movimientoValues);
  
        // 📉 Actualizar saldo
        const updateSaldoQuery = `
          UPDATE cajas
          SET "saldoActual" = $1,
              "updatedAt" = NOW()
          WHERE id = $2;
        `;
        await client.query(updateSaldoQuery, [nuevoSaldo, cajaId]);
      }
  
      await client.query('COMMIT');
      return egreso;
  
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
       
  aprobarEgreso : async (egresoId, userId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      // Actualizar estado del egreso y registrar el usuario que aprobó
      const updateQuery = `
        UPDATE egresos
        SET estado = 'aprobado', "user_aproved_id" = $1, "updatedAt" = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      const result = await client.query(updateQuery, [userId, egresoId]);
      const egreso = result.rows[0];
  
      // Registrar movimiento en caja
      const insertMovimientoQuery = `
        INSERT INTO movimientos ("cajaId", tipo, monto, descripcion, origen, "createdAt", "updatedAt")
        VALUES ($1, 'egreso', $2, $3, 'egreso', NOW(), NOW());
      `;
      await client.query(insertMovimientoQuery, [egreso.cajaId, egreso.monto, egreso.descripcion]);
  
      await client.query('COMMIT');
      return egreso;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  rechazarEgreso : async (egresoId, adminId) => {
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // Verificamos que el egreso exista
      const { rows } = await client.query(`SELECT * FROM egresos WHERE id = $1`, [egresoId]);
      if (rows.length === 0) throw new Error('Egreso no encontrado');
      const egreso = rows[0];
  
      if (egreso.estado === 'aprobado') {
        throw new Error('No se puede rechazar un egreso ya aprobado');
      }
  
      if (egreso.estado === 'rechazado') {
        throw new Error('Este egreso ya fue rechazado');
      }
  
      // Actualizamos el estado a rechazado
      await client.query(`
        UPDATE egresos SET estado = 'rechazado', "user_rejected_id" = $2, "updatedAt" = NOW() WHERE id = $1
      `, [egresoId, adminId]);
  
      await client.query('COMMIT');
      return { egresoId, estado: 'rechazado' };
  
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  listarEgresos : async (cajaId, filtros, page = 1, limit = 10) => {
    const {
      desde,
      hasta,
      estado,
      gastoCategoryId,
      cobrador // user_created_id
    } = filtros;
  
    let conditions = [`e."cajaId" = $1`];
    let values = [cajaId];
    let index = 2;
  
    if (desde) {
      conditions.push(`e."createdAt" >= $${index++}`);
      values.push(desde);
    }
  
    if (hasta) {
      conditions.push(`e."createdAt" <= $${index++}`);
      values.push(hasta);
    }
  
    if (estado) {
      conditions.push(`e.estado = $${index++}`);
      values.push(estado);
    }
  
    if (gastoCategoryId) {
      conditions.push(`e."gastoCategoryId" = $${index++}`);
      values.push(gastoCategoryId);
    }
  
    if (cobrador) {
      conditions.push(`e."user_created_id" = $${index++}`);
      values.push(cobrador);
    }
  
    const offset = (page - 1) * limit;
  
    const query = `
      SELECT 
      e.id,
      e.monto,
      e.descripcion,
      e.estado,
      e."createdAt",
      e."updatedAt",
      e."cajaId",
      e."gastoCategoryId",
      gc.nombre AS categoria_nombre,
      uc.nombre AS creado_por,
      ua.nombre AS aprobado_por,
      ur.nombre AS rechazado_por
    FROM egresos e
    LEFT JOIN "gastoCategories" gc ON gc.id = e."gastoCategoryId"
    LEFT JOIN usuarios uc ON uc.id = e."user_created_id"
    LEFT JOIN usuarios ua ON ua.id = e."user_aproved_id"
    LEFT JOIN usuarios ur ON ur.id = e."user_rejected_id"
      WHERE ${conditions.join(' AND ')}
      ORDER BY e."createdAt" DESC
      LIMIT $${index++}
      OFFSET $${index++};
    `;
  
    values.push(limit, offset);
  
    const result = await pool.query(query, values);
  
    // Total count para frontend
    const countQuery = `
      SELECT COUNT(*) FROM egresos e
      WHERE ${conditions.join(' AND ')};
    `;
    const countResult = await pool.query(countQuery, values.slice(0, values.length - 2));
    const total = parseInt(countResult.rows[0].count);
  
    return {
      egresos: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }, 

  getAllEgresos: async (offset, limit, userId, oficinaId, rutaId, searchTerm = '') => {
    const search = `%${searchTerm}%`;
    let cajaUserIds = [];
  
    if (!oficinaId && !rutaId && userId) {
      const oficinasRes = await pool.query(`
        SELECT "oficinaId" FROM usuariooficinas WHERE "usuarioId" = ${userId}
      `);
      const oficinaIds = oficinasRes.rows.map(row => row.oficinaId);
      
      if (oficinaIds.length > 0) {
        const rutasRes = await pool.query(`
          SELECT "userId" FROM ruta WHERE "oficinaId" IN (${oficinaIds.join(',')})
        `);
        cajaUserIds = rutasRes.rows.map(row => row.userId);
      }
    }
  
    if (oficinaId) {
      const rutasRes = await pool.query(`
        SELECT "userId" FROM ruta WHERE "oficinaId" = ${oficinaId}
      `);
      cajaUserIds = rutasRes.rows.map(row => row.userId);
    }
  
    if (rutaId) {
      const rutaRes = await pool.query(`
        SELECT "userId" FROM ruta WHERE id = ${rutaId}
      `);
      if (rutaRes.rows.length > 0) {
        cajaUserIds = [rutaRes.rows[0].userId];
      } else {
        return { egresos: [], total: 0, totalPages: 0, currentPage: 1 };
      }
    }
  
    let whereClause = `(e.estado ILIKE '${search}' OR e.descripcion ILIKE '${search}')`;
  
    if (cajaUserIds.length > 0) {
      whereClause += ` AND c."usuarioId" IN (${cajaUserIds.join(',')})`;
    } else if (!oficinaId && !rutaId) {
      whereClause += ` AND false`;
    }
  
    const queryText = `
      SELECT 
        e.*, 
        c.id AS caja_id
      FROM egresos e
      LEFT JOIN cajas c ON e."cajaId" = c.id
      WHERE ${whereClause}
      ORDER BY e."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  
    const countQuery = `
      SELECT COUNT(*) 
      FROM egresos e
      LEFT JOIN cajas c ON e."cajaId" = c.id
      WHERE ${whereClause};
    `;
  
    const [egresosRes, countRes] = await Promise.all([
      pool.query(queryText),
      pool.query(countQuery),
    ]);
  
    const total = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);
  
    const egresos = egresosRes.rows.map(row => ({
      id: row.id,
      monto: row.monto,
      estado: row.estado,
      descripcion: row.descripcion,
      cajaId: row.caja_id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      usuarioId: row.usuarioId,
    }));
  
    return {
      egresos,
      total,
      totalPages,
      currentPage: Math.ceil(offset / limit) + 1,
    };
  },          

  getEgresosDia: async (userId, page = 1, pageSize = 10, search = '') => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      //Obtener la ruta asignada al usuario

      const ruta = await Ruta.getByUserId(userId);
      if(!ruta) {
        throw new Error('No tienes una ruta asignada');
      }

      // Obtener la caja de la ruta
      const caja = await client.query(
        'SELECT id FROM cajas WHERE "rutaId" = $1 LIMIT 1',
        [ruta[0].id]
      );
      const cajaId = caja.rows[0]?.id;
      if (!cajaId) throw new Error('Caja no encontrada');
  
      const offset = (page - 1) * pageSize;
  
      // Si hay un search, lo usamos. Si no, buscamos todos los egresos
      let totalRes, res;
      if (search.trim()) {
        const searchQuery = `%${search}%`;
  
        // Obtener total de registros con filtro de búsqueda
        totalRes = await client.query(
          `SELECT COUNT(*) FROM egresos 
           WHERE "cajaId" = $1 AND DATE("createdAt") = CURRENT_DATE
           AND LOWER(descripcion) LIKE LOWER($2)`,
          [cajaId, searchQuery]
        );
  
        // Obtener los egresos paginados con filtro de búsqueda
        res = await client.query(
          `SELECT * FROM egresos 
           WHERE "cajaId" = $1 AND DATE("createdAt") = CURRENT_DATE
           AND LOWER(descripcion) LIKE LOWER($2)
           ORDER BY "createdAt" DESC
           LIMIT $3 OFFSET $4`,
          [cajaId, searchQuery, pageSize, offset]
        );
      } else {
        // Si no hay búsqueda, obtenemos todos los registros
        totalRes = await client.query(
          `SELECT COUNT(*) FROM egresos 
           WHERE "cajaId" = $1 AND DATE("createdAt") = CURRENT_DATE`,
          [cajaId]
        );
  
        res = await client.query(
          `SELECT * FROM egresos 
           WHERE "cajaId" = $1 AND DATE("createdAt") = CURRENT_DATE
           ORDER BY "createdAt" DESC
           LIMIT $2 OFFSET $3`,
          [cajaId, pageSize, offset]
        );
      }
  
      const total = parseInt(totalRes.rows[0].count, 10);
  
      return {
        data: res.rows,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      };
  
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }  
  
};

module.exports = Caja;