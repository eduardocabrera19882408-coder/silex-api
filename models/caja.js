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

  // Obtener turno por su id de caja
  getTurnoById: async (id) => {
    try {
      const res = await pool.query('SELECT * FROM turnos WHERE caja_id = $1 AND fecha_cierre IS NULL', [id]);
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
  
  // Obtener una caja por su ID de ruta
  getByRutaId: async (id) => {
    try {
      const res = await pool.query(`
        SELECT 
          cajas.*, 
          ruta.nombre AS ruta_nombre -- Ajusta los campos según lo que necesites de la tabla ruta
        FROM cajas
        JOIN ruta ON cajas."rutaId" = ruta.id
        WHERE cajas."rutaId" = $1
      `, [id]);
  
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

  cerrarCaja: async (cajaId, userId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let montoFinal = 0
      const turnoActual = await client.query(
        `SELECT *
          FROM turnos
          WHERE "caja_id" = $1 AND fecha_cierre IS NULL
          ORDER BY fecha_cierre DESC
          LIMIT 1;
        `,
        [cajaId]
      );

      const caja = await client.query(
        `SELECT *
          FROM cajas
          WHERE id = $1
          LIMIT 1;
        `,
        [cajaId]
      );

      montoFinal = montoFinal + caja?.rows[0]?.saldoActual

      // 1️⃣ Cerrar caja de la ruta
      await client.query(
        `UPDATE cajas SET estado = 'cerrada', "updatedAt" = NOW() WHERE id = $1`,
        [cajaId]
      );
      //Cerrar el turno
      await client.query(
        `UPDATE turnos SET fecha_cierre = NOW(), monto_final = $1, observaciones_cierre = $2, usuario_close = $3 WHERE id = $4`,
        [montoFinal, 'observacion de cierre', userId, turnoActual.rows[0].id]
      );

      await client.query('COMMIT');

      return {
        message: 'Caja cerrada correctamente'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  bloquearCaja: async (cajaId, estado) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1️⃣ Bloquear caja de la ruta
      await client.query(
        `UPDATE cajas SET estado = $2, "updatedAt" = NOW() WHERE id = $1`,
        [cajaId, estado]
      );

      await client.query('COMMIT');

      return {
        message: 'Caja bloqueada correctamente'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  abrirCaja: async (cajaId, userId) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let montoInicial = 0
      const turnoAnterior = await client.query(
        `SELECT *
          FROM turnos
          WHERE "caja_id" = $1 AND fecha_cierre IS NOT NULL
          ORDER BY fecha_cierre DESC
          LIMIT 1;
        `,
        [cajaId]
      );

      montoInicial = montoInicial + turnoAnterior?.rows[0]?.monto_final

      // 1️⃣ Abrir caja de la ruta
      await client.query(
        `UPDATE cajas SET estado = 'abierta', "updatedAt" = NOW() WHERE id = $1`,
        [cajaId]
      );
      //Crear el turno
      await client.query(
        `INSERT INTO turnos (
          "caja_id", "usuario_open", "fecha_apertura", "monto_inicial", "observaciones_apertura"
        )
        VALUES ($1, $2, NOW(), $3, $4)
        RETURNING *;`,
        [cajaId, userId, montoInicial, 'observacion']
      );

      await client.query('COMMIT');

      return {
        message: 'Caja abierta correctamente'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getMovimientosByTurno: async (turnoId, limit, offset) => {
    const query = `
      SELECT * FROM movimientos_caja
      WHERE "turnoId" = $1
      ORDER BY "createdAt" DESC
      LIMIT $2 OFFSET $3;
    `;

    const values = [turnoId, limit, offset];
    const result = await pool.query(query, values);

    const countQuery = `
      SELECT COUNT(*) FROM movimientos_caja
      WHERE "turnoId" = $1
    `;
    const countResult = await pool.query(countQuery, [turnoId]);
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
          'SELECT hora_gastos FROM config_caja WHERE id=1 LIMIT 1'
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
        'SELECT id, "saldoActual", estado FROM cajas WHERE "rutaId"=$1 LIMIT 1',
        [ruta[0].id]
      );
  
      if (cajaResult.rowCount === 0) {
        throw new Error('No se encontró una caja asociada');
      }
  
      if (cajaResult.rows[0].estado === 'cerrada') {
        throw new Error('La caja está cerrada.');
      }

      const turno = await Caja.getTurnoById(cajaResult.rows[0].id)

      if (turno.rowCount === 0) {
        throw new Error('No no tienes un turno activo');
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
          "user_created_id", "user_aproved_id", foto, turno_id, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *;
      `;
      const egresoValues = [monto, descripcion, estado, cajaId, gastoCategoryId, userId, aprovedId, foto, turno.id];
      const egresoResult = await client.query(insertEgresoQuery, egresoValues);
      const egreso = egresoResult.rows[0];
  
      // ✅ Registrar movimiento si aprobado
      if (estado === 'aprobado') {
        const saldoAnterior = saldoActual;
        const nuevoSaldo = saldoAnterior - monto;
  
        const insertMovimientoCajaQuery = `
          INSERT INTO movimientos_caja (
            "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
            monto, tipo, "usuarioId", category, "turnoId"
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8, $9);
        `;
  
        const movimientoValues = [
          cajaId,
          descripcion,
          nuevoSaldo,
          saldoAnterior,
          monto,
          'gasto',
          userId,
          'egreso',
          turno.id
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

  createEgresoAdm: async ({ monto, descripcion, cajaId, aprovedId, gastoCategoryId, turnoId}) => {

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      // 🟡 Obtener la caja
      const cajaResult = await client.query(
        'SELECT id, "saldoActual", estado FROM cajas WHERE id = $1 LIMIT 1',
        [cajaId]
      );
  
      if (cajaResult.rowCount === 0) {
        throw new Error('La caja no existe');
      }
  
      if (cajaResult.rows[0].estado === 'cerrada') {
        throw new Error('La caja está cerrada.');
      }

      const saldoActual = parseFloat(cajaResult.rows[0].saldoActual);
  
      // 🧮 Verificar saldo si es aprobado
      if (monto > saldoActual) {
        throw new Error('Saldo insuficiente en caja para realizar el egreso');
      }
  
      // 🟢 Insertar egreso
      const insertEgresoQuery = `
        INSERT INTO egresos (
          monto, descripcion, estado, "cajaId", "gastoCategoryId",
          "user_created_id", "user_aproved_id", turno_id, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *;
      `;
      const egresoValues = [monto, descripcion, 'aprobado', cajaId, gastoCategoryId, aprovedId, aprovedId, turnoId];
      const egresoResult = await client.query(insertEgresoQuery, egresoValues);
      const egreso = egresoResult.rows[0];
  
      // ✅ Registrar movimiento
      const saldoAnterior = saldoActual;
      const nuevoSaldo = saldoAnterior - monto;

      const insertMovimientoCajaQuery = `
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "egresoId", "turnoId"
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8, $9, $10);
      `;

      const movimientoValues = [
        cajaId,
        descripcion,
        nuevoSaldo,
        saldoAnterior,
        monto,
        'gasto',
        aprovedId,
        'egreso',
        egreso.id,
        turnoId
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
  
      await client.query('COMMIT');
      return egreso;
  
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  createIngresoAdm: async ({ monto, descripcion, cajaId, aprovedId, ingresoCategoryId, turnoId}) => {

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      // 🟡 Obtener la caja
      const cajaResult = await client.query(
        'SELECT id, "saldoActual", estado FROM cajas WHERE id = $1 LIMIT 1',
        [cajaId]
      );
  
      if (cajaResult.rowCount === 0) {
        throw new Error('La caja no existe');
      }
  
      if (cajaResult.rows[0].estado === 'cerrada') {
        throw new Error('La caja está cerrada.');
      }

      const saldoActual = parseFloat(cajaResult.rows[0].saldoActual);
  
      // 🟢 Insertar ingreso
      const insertIngresoQuery = `
        INSERT INTO ingresos (
          monto, descripcion, estado, "cajaId", "ingresoCategoryId",
          "user_created_id", "user_aproved_id", turno_id, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *;
      `;
      const ingresoValues = [monto, descripcion, 'aprobado', cajaId, ingresoCategoryId, aprovedId, aprovedId, turnoId];
      const ingresoResult = await client.query(insertIngresoQuery, ingresoValues);
      const ingreso = ingresoResult.rows[0];
  
      // ✅ Registrar movimiento
      const saldoAnterior = saldoActual;
      const nuevoSaldo = (saldoAnterior + Number(monto));

      const insertMovimientoCajaQuery = `
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "ingresoId", "turnoId"
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8, $9, $10);
      `;

      const movimientoValues = [
        cajaId,
        descripcion,
        nuevoSaldo,
        saldoAnterior,
        monto,
        'ingreso',
        aprovedId,
        'ingreso',
        ingreso.id,
        turnoId
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
  
      await client.query('COMMIT');
      return ingreso;
  
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

      // 🟡 Obtener la caja
      const cajaResult = await client.query(
        'SELECT id, "saldoActual", estado FROM cajas WHERE id = $1 LIMIT 1',
        [egreso.cajaId]
      );
  
      if (cajaResult.rowCount === 0) {
        throw new Error('La caja no existe');
      }
  
      if (cajaResult.rows[0].estado === 'cerrada') {
        throw new Error('La caja está cerrada.');
      }

      const saldoActual = parseFloat(cajaResult.rows[0].saldoActual);
  
      // 🧮 Verificar saldo si es aprobado
      if (egreso.monto > saldoActual) {
        throw new Error('Saldo insuficiente en caja para realizar el egreso');
      }
  
      // Registrar movimiento en caja
      const saldoAnterior = saldoActual;
      const nuevoSaldo = saldoAnterior - egreso.monto;

      const insertMovimientoCajaQuery = `
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "egresoId", "turnoId"
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8, $9, $10);
      `;

      const movimientoValues = [
        egreso.cajaId,
        egreso.descripcion,
        nuevoSaldo,
        saldoAnterior,
        egreso.monto,
        'gasto',
        userId,
        'egreso',
        egreso.id,
        egreso.turno_id
      ];

      await client.query(insertMovimientoCajaQuery, movimientoValues);

      // 📉 Actualizar saldo
      const updateSaldoQuery = `
        UPDATE cajas
        SET "saldoActual" = $1,
            "updatedAt" = NOW()
        WHERE id = $2;
      `;
      await client.query(updateSaldoQuery, [nuevoSaldo, egreso.cajaId]);
  
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

  getEgresosByTurno: async (turnoId, limit, offset) => {
    try {
      const res = await pool.query(`
        SELECT 
          e.*, 
          cec.nombre AS categoria_nombre,
          uc.nombre AS usuario_creador_nombre,
          ur.nombre AS usuario_rechazo_nombre,
          ua.nombre AS usuario_aprobador_nombre
        FROM egresos e
        LEFT JOIN config_egresos_category cec ON e."gastoCategoryId" = cec.id
        LEFT JOIN usuarios uc ON e.user_created_id = uc.id
        LEFT JOIN usuarios ur ON e.user_rejected_id = ur.id
        LEFT JOIN usuarios ua ON e.user_aproved_id = ua.id
        WHERE e.turno_id = $1
        ORDER BY e."createdAt" DESC
        LIMIT $2 OFFSET $3
      `, [turnoId, limit, offset]);

      const countQuery = `
        SELECT COUNT(*) FROM egresos
        WHERE turno_id = $1
      `;
      const countResult = await pool.query(countQuery, [turnoId]);
      const total = Number(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);
  
      const egresos = res.rows.map(row => {
        let usuario_estado = null;
  
        if (row.estado === 'aprobado') {
          usuario_estado = {
            id: row.user_approved_id,
            nombre: row.usuario_aprobador_nombre
          };
        } else if (row.estado === 'rechazado') {
          usuario_estado = {
            id: row.user_rejected_id,
            nombre: row.usuario_rechazo_nombre
          };
        }
  
        return {
          id: row.id,
          monto: row.monto,
          descripcion: row.descripcion,
          estado: row.estado,
          fecha_creacion: row.createdAt,
          fecha_actualizacion: row.updatedAt,
          turno_id: row.turno_id,
          foto: row.foto,
          gastoCategoryId: row.gastoCategoryId,
          categoria: {
            id: row.gastoCategoryId,
            nombre: row.categoria_nombre
          },
          creado_por: {
            id: row.user_created_id,
            nombre: row.usuario_creador_nombre
          },
          usuario_estado
        };
      });
  
      return {
        data: egresos,
        total,
        totalPages
      };
    } catch (error) {
      throw error;
    }
  },
  
  getAbonosByTurno: async (turnoId, limit, offset) => {
    try {
      const result = await pool.query(`
        SELECT 
          p.*, 
          c.nombres AS nombre
        FROM pagos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.turno_id = $1 AND p.tipo = 'abono'
        ORDER BY p."createdAt" DESC
        LIMIT $2 OFFSET $3
      `, [turnoId, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) FROM pagos
      WHERE turno_id = $1 AND tipo = 'abono'
    `;
    const countResult = await pool.query(countQuery, [turnoId]);
    const total = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: result.rows,
      total,
      totalPages
    };

    } catch (error) {
      throw error;
    }
  },

  getValidAbonosByTurno: async (turnoId, limit, offset) => {
    try {
      const result = await pool.query(`
        SELECT 
          p.*, 
          c.nombres AS nombre
        FROM pagos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.turno_id = $1 AND p.tipo = 'abono' AND p.estado = 'aprobado'
        ORDER BY p."createdAt" DESC
        LIMIT $2 OFFSET $3
      `, [turnoId, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) FROM pagos
      WHERE turno_id = $1 AND tipo = 'abono' AND estado = 'aprobado'
    `;
    const countResult = await pool.query(countQuery, [turnoId]);
    const total = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: result.rows,
      total,
      totalPages
    };

    } catch (error) {
      throw error;
    }
  },

  anularPago: async (pagoId, userId, motivo) => {
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // 1. Obtener desglose del pago
      const pagoRes = await client.query(`
        SELECT p.monto, p.turno_id, p."user_created_id", p."cliente_id", c."creditoId",
               pc."cuotaId", pc.monto_abonado, pc.capital_pagado, pc.interes_pagado
        FROM pagos p
        JOIN pagos_cuotas pc ON pc."pagoId" = p.id
        JOIN cuotas c ON c.id = pc."cuotaId"
        WHERE p.id = $1
      `, [pagoId]);
  
      if (pagoRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { error: 'Pago no encontrado o no asociado a cuotas' };
      }
  
      let totalCapitalAjustar = 0;
      let totalInteresAjustar = 0;
      const cuotasMap = new Map();
      let clienteId = null;
      let creditoId = null;
      let turnoId = null;
      let montoPago = 0;
  
      for (const row of pagoRes.rows) {
        const cuotaId = row.cuotaId;
        const capitalPagado = parseFloat(row.capital_pagado || 0);
        const interesPagado = parseFloat(row.interes_pagado || 0);
        const montoAbonado = parseFloat(row.monto_abonado || 0);
  
        totalCapitalAjustar += capitalPagado;
        totalInteresAjustar += interesPagado;
        cuotasMap.set(cuotaId, (cuotasMap.get(cuotaId) || 0) + montoAbonado);
  
        clienteId = row.cliente_id;
        creditoId = row.creditoId;
        turnoId = row.turno_id;
        montoPago = parseFloat(row.monto || 0);
      }
  
      // 2. Revertir montos en cuotas
      for (const [cuotaId, montoAbonado] of cuotasMap.entries()) {
        await client.query(`
          UPDATE cuotas
          SET monto_pagado = monto_pagado - $1,
              estado = CASE WHEN monto_pagado - $1 < monto THEN 'impago' ELSE estado END,
              "updatedAt" = NOW()
          WHERE id = $2
        `, [montoAbonado, cuotaId]);
      }
  
      // 3. Actualizar crédito
      const creditoRes = await client.query(`
        SELECT saldo_capital, saldo_interes, capital_pagado, interes_pagado
        FROM creditos
        WHERE id = $1
      `, [creditoId]);
  
      if (creditoRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { error: 'Crédito no encontrado' };
      }
  
      const cr = creditoRes.rows[0];
      const nuevoSaldoCapital = Math.max(0, parseFloat(cr.saldo_capital) + totalCapitalAjustar);
      const nuevoSaldoInteres = Math.max(0, parseFloat(cr.saldo_interes) + totalInteresAjustar);
      const nuevoCapitalPagado = Math.max(0, parseFloat(cr.capital_pagado) - totalCapitalAjustar);
      const nuevoInteresPagado = Math.max(0, parseFloat(cr.interes_pagado) - totalInteresAjustar);
  
      const estadoCredito = (nuevoSaldoCapital > 0 || nuevoSaldoInteres > 0) ? 'impago' : 'pagado';
  
      await client.query(`
        UPDATE creditos
        SET saldo_capital = $1,
            saldo_interes = $2,
            capital_pagado = $3,
            interes_pagado = $4,
            estado = $5,
            "updatedAt" = NOW()
        WHERE id = $6
      `, [
        nuevoSaldoCapital,
        nuevoSaldoInteres,
        nuevoCapitalPagado,
        nuevoInteresPagado,
        estadoCredito,
        creditoId
      ]);
  
      // 4. Actualizar saldo en caja
      const cajaRes = await client.query(`
        SELECT c.id, c."saldoActual"
        FROM cajas c
        JOIN ruta r ON r.id = c."rutaId"
        WHERE r."userId" = $1
        LIMIT 1
      `, [pagoRes.rows[0].user_created_id]);
  
      if (cajaRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { error: 'Caja no encontrada' };
      }
  
      const cajaId = cajaRes.rows[0].id;
      const saldoAnterior = parseFloat(cajaRes.rows[0].saldoActual);
      const nuevoSaldo = saldoAnterior - montoPago;
  
      await client.query(`
        UPDATE cajas
        SET "saldoActual" = $1,
            "updatedAt" = NOW()
        WHERE id = $2
      `, [nuevoSaldo, cajaId]);
  
      // 5. Eliminar pagos_cuotas
      await client.query(`
        DELETE FROM pagos_cuotas
        WHERE "pagoId" = $1
      `, [pagoId]);
  
      // 6. Registrar movimiento de anulación
      await client.query(`
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "clienteId", "creditoId", "turnoId"
        ) VALUES (
          $1, $2, $3, $4, NOW(), NOW(),
          $5, 'anulacion', $6, 'egreso', $7, $8, $9
        )
      `, [
        cajaId,
        `Anulación de pago ID ${pagoId} - Motivo: ${motivo || 'No especificado'}`,
        nuevoSaldo,
        saldoAnterior,
        -montoPago,
        userId,
        clienteId,
        creditoId,
        turnoId
      ]);
  
      // 7. Marcar pago como anulado
      await client.query(`
        UPDATE pagos
        SET estado = 'anulado',
            user_null_id = $2,
            observacion = $3,
            "updatedAt" = NOW()
        WHERE id = $1
      `, [pagoId, userId, motivo]);
  
      await client.query('COMMIT');
      return { success: true, message: 'Pago anulado correctamente' };
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return { error: 'Error al anular el pago' };
    } finally {
      client.release();
    }
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
  },

  getComprobanteById: async (id) => {
    const pagoData = await pool.query(
      `SELECT 
        p.*, 
        c.nombres AS nombre
       FROM pagos p
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1 LIMIT 1`,
      [id]
    );
  
    if (pagoData.rowCount === 0) {
      return null;
    }
  
    return pagoData.rows[0]; // solo devuelves los datos
  }
  
  
};

module.exports = Caja;