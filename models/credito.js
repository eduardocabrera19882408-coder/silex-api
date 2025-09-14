const db = require('../config/db');
const Caja = require('./caja');
const Cliente = require('./cliente');
const Config = require('./config');

const Credito = {
  // Crear un crédito
  create: async (creditoData) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const {
        monto, plazo_dias, frecuencia_pago,
        usuarioId, clienteId, productoId, rutaId
      } = creditoData;
  
      // 1️⃣ Validar configuración de la ruta
      const configQuery = `SELECT * FROM config_credits WHERE "rutaId" = $1;`;
      const configResult = await client.query(configQuery, [rutaId]);
      if (configResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: "No hay configuración de crédito para la ruta seleccionada." };
      }
  
      const config = configResult.rows[0];
  
      // 2️⃣ Validaciones
      if (monto < config.monto_minimo || monto > config.monto_maximo) {
        await client.query('ROLLBACK');
        return { error: `El monto debe estar entre ${config.monto_minimo} y ${config.monto_maximo}` };
      }
  
      if (plazo_dias < config.plazo_minimo || plazo_dias > config.plazo_maximo) {
        await client.query('ROLLBACK');
        return { error: `El plazo debe estar entre ${config.plazo_minimo} y ${config.plazo_maximo} días.` };
      }
  
      if (!config.frecuencia_pago.includes(frecuencia_pago)) {
        await client.query('ROLLBACK');
        return { error: `La frecuencia de pago '${frecuencia_pago}' no está permitida para esta ruta.` };
      }
  
      // 3️⃣ Caja de ruta
      const cajaResult = await client.query(`SELECT id, "saldoActual", estado FROM cajas WHERE "rutaId" = $1;`, [rutaId]);
      if (cajaResult.rows[0].estado === 'cerrada') {
        await client.query('ROLLBACK');
        return { error: "La caja está cerrada." };
      }
      console.log(cajaResult.rows[0])
      if (cajaResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: "La ruta no tiene una caja asignada." };
      }
  
      const cajaId = cajaResult.rows[0].id;
      const saldoDisponible = parseFloat(cajaResult.rows[0].saldoActual);
      if (saldoDisponible < monto) {
        await client.query('ROLLBACK');
        return { error: "Saldo insuficiente en la caja para otorgar este crédito." };
      }
  
      const cliente = await Cliente.getById(clienteId);
      if (!cliente?.id || cliente.updated == false) {
        await client.query('ROLLBACK');
        return { error: "El cliente no es válido o debe ser actualizado." };
      }
  
      const turno = await Caja.getTurnoById(cajaId);
      if (!turno?.id) {
        await client.query('ROLLBACK');
        return { error: "No tienes un turno activo." };
      }
  
      // 4️⃣ Créditos activos
      const creditosActivosResult = await client.query(`
        SELECT COUNT(*) AS total 
        FROM creditos 
        WHERE "clienteId" = $1 AND estado = 'impago';
      `, [clienteId]);
  
      const creditosActivos = parseInt(creditosActivosResult.rows[0].total);
      if (creditosActivos >= config.max_credits) {
        await client.query('ROLLBACK');
        return { error: "El cliente ya alcanzó el límite de créditos permitidos." };
      }
  
      // 5️⃣ Cálculos
      const interes = config.interes;
      const montoInteresGenerado = (monto * interes) / 100;
      const capitalPagado = 0;
      const interesPagado = 0;
      const saldoCapital = monto;
      const saldoInteres = montoInteresGenerado;
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + plazo_dias);
  
      // 6️⃣ Insertar crédito
      const insertCredito = await client.query(`
        INSERT INTO creditos (
          monto, plazo, frecuencia_pago, interes, monto_interes_generado,
          capital_pagado, interes_pagado, saldo_capital, saldo_interes,
          estado, "usuarioId", "clienteId", "productoId",
          "fechaVencimiento", turno_id, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          'impago', $10, $11, $12,
          $13, $14, NOW(), NOW()
        ) RETURNING *;
      `, [
        monto, plazo_dias, frecuencia_pago, interes, montoInteresGenerado,
        capitalPagado, interesPagado, saldoCapital, saldoInteres,
        usuarioId, clienteId, productoId,
        fechaVencimiento, turno.id
      ]);
  
      const credito = insertCredito.rows[0];
  
      // 7️⃣ Actualizar caja
      const saldoActual = saldoDisponible - monto;
      await client.query(`
        UPDATE cajas SET "saldoActual" = $1 WHERE id = $2;
      `, [saldoActual, cajaId]);
  
      // 8️⃣ Movimiento
      await client.query(`
        INSERT INTO movimientos_caja (
          "cajaId", tipo, monto, descripcion,
          saldo, saldo_anterior, category, "usuarioId", "clienteId", "creditoId", "turnoId",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, 'credito', $2, $3,
          $4, $5, 'egreso', $6, $7, $8, $9,
          NOW(), NOW()
        );
      `, [
        cajaId, monto, `Desembolso de crédito - (CL${cliente.id}: ${cliente?.nombres})`,
        saldoActual, saldoDisponible, usuarioId, clienteId, credito.id, turno.id
      ]);
  
      // 9️⃣ Cuotas
      const cuotaMonto = await Credito.generarCuotas(credito.id, monto, interes, plazo_dias, frecuencia_pago);
  
      await client.query('COMMIT');
      return {
        credito,
        cuotaMonto,
        location: cliente.coordenadasCobro
      };
  
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al crear crédito:', error);
      return { error: "Hubo un error al registrar el crédito." };
    } finally {
      client.release();
    }
  },  

  // modelo/Credito.js
  getAll: async (limit, offset, searchTerm = '', userId, oficinaId, rutaId) => {
    const search = `%${searchTerm}%`;
  
    // Comienza el WHERE para los filtros básicos de búsqueda
    let whereClause = `
      (c.estado ILIKE '${search}' OR
       c.frecuencia_pago ILIKE '${search}' OR
       r.nombre ILIKE '${search}')
    `;
    
    let joins = `
      LEFT JOIN clientes cl ON c."clienteId" = cl.id
      LEFT JOIN ruta r ON cl."rutaId" = r.id
    `;
  
    // Si se selecciona una ruta, filtra por esa ruta
    if (rutaId) {
      whereClause += ` AND cl."rutaId" = ${rutaId}`;
    } 
    // Si se selecciona una oficina, filtra por las rutas de esa oficina
    else if (oficinaId) {
      joins += ` LEFT JOIN oficinas o ON r."oficinaId" = o.id `;
      whereClause += ` AND o.id = ${oficinaId}`;
    } 
    // Si no se selecciona ni oficina ni ruta, filtra por las rutas de las oficinas del usuario
    else if (userId) {
      // Obtener las oficinas a las que el usuario está asignado
      const userOfficesQuery = `
        SELECT o.id AS oficina_id
        FROM usuariooficinas uo
        LEFT JOIN oficinas o ON uo."oficinaId" = o.id
        WHERE uo."usuarioId" = ${userId}
      `;
      
      const userOfficesRes = await db.query(userOfficesQuery);
      
      if (userOfficesRes.rows.length > 0) {
        // Si el usuario tiene oficinas asignadas, obtenemos las rutas asociadas a esas oficinas
        const officeIds = userOfficesRes.rows.map(row => row.oficina_id);
        
        joins += ` LEFT JOIN oficinas o ON r."oficinaId" = o.id `;
        whereClause += ` AND o.id IN (${officeIds.join(', ')})`;
      } else {
        // Si el usuario no tiene oficinas asignadas, no se muestran registros
        whereClause += ` AND 1=0`;  // Esto asegura que no se devuelvan resultados si el usuario no tiene oficinas.
      }
    }
  
    // Consulta para obtener los créditos
    const queryText = `
      SELECT 
        c.*,
        cl.id AS cliente_id,
        cl.nombres AS cliente_nombre,
        r.id AS ruta_id,
        r.nombre AS ruta_nombre
      FROM creditos c
      ${joins}
      WHERE ${whereClause}
      ORDER BY c."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  
    // Consulta para obtener el conteo total de créditos
    const countQuery = `
      SELECT COUNT(*) 
      FROM creditos c
      ${joins}
      WHERE ${whereClause};
    `;
  
    // Ejecutamos ambas consultas
    const [creditosRes, countRes] = await Promise.all([
      db.query(queryText),
      db.query(countQuery),
    ]);
  
    const totalCreditos = parseInt(countRes.rows[0].count, 10);
  
    // Mapeamos los resultados
    const creditos = creditosRes.rows.map(row => ({
      id: row.id,
      monto: row.monto,
      fechaVencimiento: row.fechaVencimiento,
      estado: row.estado,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      clienteId: row.clienteId,
      usuarioId: row.usuarioId,
      plazo: row.plazo,
      frecuencia_pago: row.frecuencia_pago,
      interes: row.interes,
      monto_interes_generado: row.monto_interes_generado,
      capital_pagado: row.capital_pagado,
      interes_pagado: row.interes_pagado,
      saldo_capital: row.saldo_capital,
      saldo_interes: row.saldo_interes,
      productoId: row.productoId,
      cliente: {
        id: row.cliente_id,
        nombres: row.cliente_nombre,
      },
      ruta: {
        id: row.ruta_id,
        nombre: row.ruta_nombre,
      }
    }));
  
    return { creditos, totalCreditos };
  },

  getDataDash: async (rutaId) => {
    if(rutaId === null){
      return []
    }
    try {
      const queryText = `
        WITH config AS (
          SELECT days_to_yellow, days_to_red FROM config_default LIMIT 1
        ),
        creditos_filtrados AS (
          SELECT 
            c.id,
            c.saldo_capital,
            c.saldo_interes,
            c."fechaVencimiento",
            cl."rutaId"
          FROM creditos c
          INNER JOIN clientes cl ON cl.id = c."clienteId"
          WHERE c.estado = 'impago' AND cl."rutaId" = $1
        ),
        max_dias_atraso AS (
          SELECT 
            q."creditoId",
            MAX(DATE_PART('day', CURRENT_DATE - q."fechaPago")) AS dias_atraso
          FROM cuotas q
          INNER JOIN creditos_filtrados cf ON cf.id = q."creditoId"
          WHERE q.estado = 'impago'
          GROUP BY q."creditoId"
        ),
        clasificacion_creditos AS (
          SELECT 
            cf.id AS credito_id,
            cf.saldo_capital,
            cf.saldo_interes,
            CASE
              WHEN COALESCE(mda.dias_atraso, 0) > cfg.days_to_red OR cf."fechaVencimiento" < CURRENT_DATE THEN 'vencido'
              WHEN COALESCE(mda.dias_atraso, 0) > cfg.days_to_yellow THEN 'alto_riesgo'
              WHEN COALESCE(mda.dias_atraso, 0) > 0 THEN 'atrasado'
              ELSE 'al_dia'
            END AS clasificacion
          FROM creditos_filtrados cf
          LEFT JOIN max_dias_atraso mda ON mda."creditoId" = cf.id
          CROSS JOIN config cfg
        ),
        caja_actual AS (
          SELECT id, "saldoActual"
          FROM cajas
          WHERE "rutaId" = $1
          LIMIT 1
        ),
        turno_activo AS (
          SELECT t.id AS turno_id
          FROM turnos t
          INNER JOIN caja_actual c ON c.id = t."caja_id"
          WHERE t."fecha_cierre" IS NULL
          LIMIT 1
        ),
        pagos_aprobados AS (
          SELECT COALESCE(SUM(p.monto), 0) AS recaudacion
          FROM pagos p
          INNER JOIN turno_activo t ON t.turno_id = p."turno_id"
          WHERE p.estado = 'aprobado'
        ),
        egresos_aprobados AS (
          SELECT COALESCE(SUM(e.monto), 0) AS gastos
          FROM egresos e
          INNER JOIN turno_activo t ON t.turno_id = e."turno_id"
          WHERE e.estado = 'aprobado'
        )
  
        SELECT 
          COUNT(*) AS total_impagos,
          COALESCE(SUM(saldo_capital + saldo_interes), 0) AS cartera,
  
          COUNT(*) FILTER (WHERE clasificacion = 'alto_riesgo') AS creditos_alto_riesgo,
          COUNT(*) FILTER (WHERE clasificacion = 'vencido') AS creditos_vencidos,
          COUNT(*) FILTER (WHERE clasificacion = 'atrasado') AS creditos_atrasados,
          COUNT(*) FILTER (WHERE clasificacion = 'al_dia') AS creditos_al_dia,
  
          SUM(saldo_capital + saldo_interes) FILTER (WHERE clasificacion = 'alto_riesgo') AS cartera_alto_riesgo,
          SUM(saldo_capital + saldo_interes) FILTER (WHERE clasificacion = 'vencido') AS cartera_vencidos,
          SUM(saldo_capital + saldo_interes) FILTER (WHERE clasificacion = 'atrasado') AS cartera_atrasados,
          SUM(saldo_capital + saldo_interes) FILTER (WHERE clasificacion = 'al_dia') AS cartera_al_dia,
  
          (SELECT "saldoActual" FROM caja_actual) AS saldo_caja,
          (SELECT turno_id FROM turno_activo) AS turno_id,
          (SELECT recaudacion FROM pagos_aprobados) AS recaudacion,
          (SELECT gastos FROM egresos_aprobados) AS gastos
        FROM clasificacion_creditos;
      `;
  
      const data = await db.query(queryText, [rutaId.id]);
      return data.rows[0];
    } catch (error) {
      console.error("Error al obtener los datos del dashboard:", error);
      throw error;
    }
  },  

  getDataDashBars: async (frecuencia, rutaId) => {
    if(rutaId === null){
      return []
    }
    try {
      const queryText = `
        WITH fechas AS (
          SELECT 
            CURRENT_DATE AS hoy,
            CASE 
              WHEN $1 = 'semanal' THEN CURRENT_DATE - INTERVAL '6 days'
              ELSE CURRENT_DATE
            END AS desde
        ),
        creditos_ruta AS (
          SELECT 
            DATE(c."createdAt") AS fecha,
            SUM(c.monto) AS total_creditos,
            SUM(c.monto_interes_generado) AS total_interes
          FROM creditos c
          JOIN clientes cl ON cl.id = c."clienteId"
          JOIN fechas f ON DATE(c."createdAt") BETWEEN f.desde AND f.hoy
          WHERE cl."rutaId" = $2
          GROUP BY DATE(c."createdAt")
        ),
        caja_ruta AS (
          SELECT id AS caja_id
          FROM cajas
          WHERE "rutaId" = $2
          LIMIT 1
        ),
        movimientos_filtrados AS (
          SELECT 
            DATE(mc."createdAt") AS fecha,
            mc.tipo,
            SUM(mc.monto) AS total
          FROM movimientos_caja mc
          JOIN caja_ruta cr ON cr.caja_id = mc."cajaId"
          JOIN fechas f ON DATE(mc."createdAt") BETWEEN f.desde AND f.hoy
          GROUP BY DATE(mc."createdAt"), mc.tipo
        ),
        dias AS (
          SELECT generate_series(f.desde, f.hoy, interval '1 day')::date AS fecha
          FROM fechas f
        ),
        resultados AS (
          SELECT 
            d.fecha,
            COALESCE(c.total_creditos, 0) AS total_creditos,
            COALESCE(c.total_interes, 0) AS total_interes,
            COALESCE(SUM(CASE WHEN m.tipo = 'abono' THEN m.total END), 0) AS recaudo,
            COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.total END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN m.tipo = 'gasto' THEN m.total END), 0) AS egresos
          FROM dias d
          LEFT JOIN creditos_ruta c ON c.fecha = d.fecha
          LEFT JOIN movimientos_filtrados m ON m.fecha = d.fecha
          GROUP BY d.fecha, c.total_creditos, c.total_interes
          ORDER BY d.fecha
        )
        SELECT * FROM resultados;
      `;
  
      const data = await db.query(queryText, [frecuencia, rutaId]);
  
      if (frecuencia === 'diario') {
        const hoyLocal = new Date();
        const hoyString = hoyLocal.toISOString().split('T')[0]; // "YYYY-MM-DD"
  
        const rowDiario = data.rows.find(row => {
          const rowDate = new Date(row.fecha).toISOString().split('T')[0];
          return rowDate === hoyString;
        });
  
        return [rowDiario || {
          fecha: new Date().toISOString(), // mantiene formato ISO completo
          total_creditos: 0,
          total_interes: 0,
          recaudo: 0,
          ingresos: 0,
          egresos: 0,
        }];
      }
  
      return data.rows;
  
    } catch (error) {
      console.error("Error al obtener los datos del dashboard:", error);
      throw error;
    }
  },   

  // Contar el total de créditos para la paginación
  countAll: async () => {
    const queryText = 'SELECT COUNT(*) FROM creditos;';
    const { rows } = await db.query(queryText);
    return parseInt(rows[0].count, 10);
  },

  // Obtener un crédito por ID con los pagos asociados
  getById: async (id) => {
    const queryText = `
      SELECT c.*, 
        COALESCE(json_agg(jsonb_build_object('id', p.id, 'monto', p.monto, 'fecha', p."createdAt")) FILTER (WHERE p.id IS NOT NULL), '[]') AS cuotas
      FROM creditos c
      LEFT JOIN pagos p ON c.id = p."creditoId"
      WHERE c.id = $1
      GROUP BY c.id;
    `;
    const { rows } = await db.query(queryText, [id]);
    return rows.length ? rows[0] : null;
  },

  getImpagosByUsuarioPaginado: async (usuarioId, limit, offset) => {
    const query = `
      SELECT 
        c.*,
        json_build_object(
          'id', cl.id,
          'nombres', cl.nombres,
          'telefono', cl.telefono,
          'direccion', cl.direccion,
          'coordenadasCasa', cl."coordenadasCasa",
          'coordenadasCobro', cl."coordenadasCobro",
          'identificacion', cl.identificacion,
          'rutaId', cl."rutaId",
          'fotos', (
            SELECT COALESCE(json_agg(foto.foto), '[]'::json)
            FROM fotoclientes foto
            WHERE foto."clienteId" = cl.id
          )
        ) AS cliente,
        json_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'precio', p.precio
        ) AS producto,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', q.id,
              'monto', q.monto,
              'fecha_pago', q."fechaPago",
              'estado', q.estado,
              'creditoId', q."creditoId",
              'createdAt', q."createdAt",
              'updatedAt', q."updatedAt",
              'monto_pagado', q."monto_pagado"
            )
          ), '[]'::json)
          FROM cuotas q
          WHERE q."creditoId" = c.id
        ) AS cuotas,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', pa.id,
              'monto', pa.monto,
              'fechaPago', pa."createdAt",
              'metodoPago', pa."metodoPago",
              'createdAt', pa."createdAt",
              'updatedAt', pa."updatedAt",
              'cuotas', (
                SELECT json_agg(
                  json_build_object(
                    'cuotaId', pc."cuotaId",
                    'monto_abonado', pc."monto_abonado",
                    'capital_pagado', pc."capital_pagado",
                    'interes_pagado', pc."interes_pagado",
                    'created_at', pc."created_at"
                  )
                )
                FROM pagos_cuotas pc
                WHERE pc."pagoId" = pa.id
              )
            )
          ), '[]'::json)
          FROM pagos pa
          WHERE pa.id IN (
            SELECT DISTINCT pc."pagoId"
            FROM cuotas q
            JOIN pagos_cuotas pc ON q.id = pc."cuotaId"
            WHERE q."creditoId" = c.id
          )
        ) AS pagos
      FROM creditos c
      JOIN clientes cl ON c."clienteId" = cl.id
      JOIN productos p ON c."productoId" = p.id
      WHERE c."usuarioId" = $1 AND c.estado = 'impago'
      ORDER BY c."createdAt" DESC
      LIMIT $2 OFFSET $3;
    `;
  
    const result = await db.query(query, [usuarioId, limit, offset]);
    return result.rows;
  },  

  //Contar los impagos por usuario
  countImpagosByUsuario : async (usuarioId) => {
    const query = `
      SELECT COUNT(*) AS total
      FROM creditos
      WHERE "usuarioId" = $1 AND estado = 'impago';
    `;
  
    const result = await db.query(query, [usuarioId]);
    return parseInt(result.rows[0].total);
  },

  // Actualizar un crédito
  update: async (id, updateData) => {
    const queryText = `
      UPDATE creditos 
      SET monto = $1, "fechaInicio" = $2, "fechaVencimiento" = $3, estado = $4, saldo = $5, "updatedAt" = NOW()
      WHERE id = $6 RETURNING *;
    `;
    const values = [
      updateData.monto,
      updateData.fechaInicio,
      updateData.fechaVencimiento,
      updateData.estado,
      updateData.saldo,
      id
    ];
    const { rows } = await db.query(queryText, values);
    return rows[0];
  },

  // Eliminar un crédito
  delete: async (id) => {
    const queryText = `DELETE FROM creditos WHERE id = $1 RETURNING *;`;
    const { rows } = await db.query(queryText, [id]);
    return rows.length ? rows[0] : null;
  },

  // Crear un pago
  createPago: async ({ creditoId, valor, metodoPago, userId, location }) => {
    const client = await db.connect();
  
    try {
      await client.query('BEGIN');
  
      const config = await Config.getConfigDefault();
  
      if (!config.id) return { error: 'No existe configuración de abonos' };
  
      const creditoRes = await client.query(`
        SELECT id, interes, "usuarioId", "clienteId", monto, monto_interes_generado, saldo_capital, saldo_interes
        FROM creditos
        WHERE id = $1
      `, [creditoId]);
  
      if (creditoRes.rowCount === 0) return { error: 'El crédito no existe' };
  
      const {
        interes,
        usuarioId: creadorCreditoId,
        clienteId,
        monto,
        monto_interes_generado,
        saldo_capital,
        saldo_interes
      } = creditoRes.rows[0];
  
      const totalDeudaInicial = parseFloat(monto + monto_interes_generado);
      const abonoMaximo = parseFloat((totalDeudaInicial * config.porcentaje_abono_maximo / 100).toFixed(2));
      const deudaActual = parseFloat(Number(saldo_capital) + Number(saldo_interes));
  
      if (valor > abonoMaximo) {
        return {
          error: `El abono no puede superar el ${config.porcentaje_abono_maximo}% del valor inicial de la deuda`
        };
      }
  
      if (valor > deudaActual.toFixed(2)) {
        return {
          error: `El abono no puede superar el valor adeudado: $ ${deudaActual.toFixed(2)}`
        };
      }
  
      const cajaRes = await client.query(`
        SELECT c.id, c."saldoActual", c.estado
        FROM cajas c
        JOIN ruta r ON r.id = c."rutaId"
        WHERE r."userId" = $1
        LIMIT 1
      `, [creadorCreditoId]);
  
      if (cajaRes.rowCount === 0) return { error: 'Caja no encontrada' };
      if (cajaRes.rows[0].estado === 'cerrada') {
        return { error: 'La caja está cerrada.' };
      }
      const turno = await Caja.getTurnoById(cajaRes.rows[0].id);
      if (!turno.id) return { error: 'No tienes un turno activo' };
  
      const tipoPago = valor <= 0 ? 'visita' : 'abono';
      const valorRedondeado = parseFloat(valor.toFixed(2));
  
      const pagoRes = await client.query(`
        INSERT INTO pagos (
          monto, "user_created_id", "metodoPago", "createdAt", "updatedAt", cordenadas,
          estado, turno_id, cliente_id, tipo
        ) VALUES ($1, $2, $3, NOW(), NOW(), $4, 'aprobado', $5, $6, $7)
        RETURNING id
      `, [valorRedondeado, userId, metodoPago, location, turno.id, clienteId, tipoPago]);
  
      const pagoId = pagoRes.rows[0].id;
  
      const cuotasRes = await client.query(`
        SELECT id, monto, monto_pagado
        FROM cuotas
        WHERE "creditoId" = $1 AND estado = 'impago'
        ORDER BY "fechaPago" ASC
      `, [creditoId]);
  
      const numCuotas = cuotasRes.rows.length;
  
      // Cálculo por cuota basado en capital e interés distribuidos
      const capitalCuota = parseFloat((monto / numCuotas).toFixed(2));
      const interesTotal = parseFloat(((monto * interes) / 100).toFixed(2));
      const interesCuota = parseFloat((interesTotal / numCuotas).toFixed(2));
      const montoCuota = capitalCuota + interesCuota;
  
      let montoRestante = valorRedondeado;
      let totalCapitalPagado = 0;
      let totalInteresPagado = 0;
  
      for (const cuota of cuotasRes.rows) {
        if (montoRestante <= 0) break;
  
        const saldoCuota = parseFloat((cuota.monto - cuota.monto_pagado).toFixed(2));
        const pagoAplicado = parseFloat(Math.min(saldoCuota, montoRestante).toFixed(2));
  
        const porcentajePago = parseFloat((pagoAplicado / montoCuota).toFixed(10));
        const capitalPago = parseFloat((capitalCuota * porcentajePago).toFixed(2));
        const interesPago = parseFloat((interesCuota * porcentajePago).toFixed(2));
  
        await client.query(`
          INSERT INTO pagos_cuotas ("pagoId", "cuotaId", monto_abonado, capital_pagado, interes_pagado)
          VALUES ($1, $2, $3, $4, $5)
        `, [pagoId, cuota.id, pagoAplicado, capitalPago, interesPago]);
  
        await client.query(`
          UPDATE cuotas
          SET monto_pagado = monto_pagado + $1,
              estado = CASE WHEN monto_pagado + $1 >= monto THEN 'pagado' ELSE estado END,
              "updatedAt" = NOW()
          WHERE id = $2
        `, [pagoAplicado, cuota.id]);
  
        totalCapitalPagado += capitalPago;
        totalInteresPagado += interesPago;
        montoRestante -= pagoAplicado;
      }
  
      const totalCapitalRedondeado = parseFloat(totalCapitalPagado.toFixed(2));
      const totalInteresRedondeado = parseFloat(totalInteresPagado.toFixed(2));
  
      let nuevoSaldoCapital = parseFloat((saldo_capital - totalCapitalRedondeado).toFixed(2));
      let nuevoSaldoInteres = parseFloat((saldo_interes - totalInteresRedondeado).toFixed(2));
  
      nuevoSaldoCapital = Math.max(0, nuevoSaldoCapital);
      nuevoSaldoInteres = Math.max(0, nuevoSaldoInteres);
  
      const estadoCredito = (nuevoSaldoCapital === 0 && nuevoSaldoInteres === 0) ? 'pagado' : 'impago';
  
      await client.query(`
        UPDATE creditos
        SET 
          capital_pagado = capital_pagado + $1,
          interes_pagado = interes_pagado + $2,
          saldo_capital = $3,
          saldo_interes = $4,
          estado = $5,
          "updatedAt" = NOW()
        WHERE id = $6
      `, [
        totalCapitalRedondeado,
        totalInteresRedondeado,
        nuevoSaldoCapital,
        nuevoSaldoInteres,
        estadoCredito,
        creditoId
      ]);
  
      const cajaId = cajaRes.rows[0].id;
      const saldoAnterior = parseFloat(cajaRes.rows[0].saldoActual);
      const nuevoSaldo = parseFloat((saldoAnterior + valorRedondeado).toFixed(2));
  
      await client.query(`
        UPDATE cajas
        SET "saldoActual" = $1
        WHERE id = $2
      `, [nuevoSaldo, cajaId]);
  
      const cliente = await Cliente.getNameById(clienteId);
      const descripcion = valorRedondeado <= 0 ? 'Registro de visita' : 'Registro de pago de crédito';
      const tipo = valorRedondeado <= 0 ? 'visita' : 'abono';
  
      await client.query(`
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "clienteId", "creditoId", "turnoId"
        ) VALUES (
          $1, '${descripcion} - (CR${creditoId}: ${cliente.nombres})', $2, $3, NOW(), NOW(),
          $4, '${tipo}', $5, 'ingreso', $6, $7, $8
        )
      `, [
        cajaId, nuevoSaldo, saldoAnterior, valorRedondeado,
        userId, clienteId, creditoId, turno.id
      ]);
  
      await client.query('COMMIT');
      return { success: true, message: "Pago registrado correctamente", pagoId };
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return { error: 'Error al registrar el pago' };
    } finally {
      client.release();
    }
  },
  
  generarCuotas: async (creditoId, monto, interes, plazo_dias, frecuencia_pago) => {
    const cuotas = [];
    const totalConInteres = monto + (monto * interes) / 100;
  
    let cantidadCuotas = 0;
    let diasEntreCuotas = 1;
  
    switch (frecuencia_pago) {
      case 'diario':
        diasEntreCuotas = 1;
        cantidadCuotas = plazo_dias;
        break;
      case 'semanal':
        diasEntreCuotas = 7;
        cantidadCuotas = Math.ceil(plazo_dias / 7);
        break;
      case 'quincenal':
        diasEntreCuotas = 15;
        cantidadCuotas = Math.ceil(plazo_dias / 15);
        break;
      case 'mensual':
        diasEntreCuotas = 30;
        cantidadCuotas = Math.ceil(plazo_dias / 30);
        break;
      default:
        throw new Error('Frecuencia de pago no válida');
    }
  
    const cuotaMonto = parseFloat((totalConInteres / cantidadCuotas).toFixed(2));
    let fecha = new Date();
  
    // Obtener días no laborables específicos
    const diasNoLaborablesQuery = `SELECT fecha FROM dias_no_laborables;`;
    const diasNoLaborablesResult = await db.query(diasNoLaborablesQuery);
    const diasNoLaborables = diasNoLaborablesResult.rows.map(row => row.fecha.toISOString().split('T')[0]);
  
    // Obtener configuración desde el modelo Config
    const config = await Config.getConfigDiasNoLaborables() || { excluir_sabados: false, excluir_domingos: false };
  
    for (let i = 0; i < cantidadCuotas; i++) {
      fecha.setDate(fecha.getDate() + diasEntreCuotas);
  
      while (
        diasNoLaborables.includes(fecha.toISOString().split('T')[0]) ||
        (config.excluir_sabados && fecha.getDay() === 6) || // sábado = 6
        (config.excluir_domingos && fecha.getDay() === 0)   // domingo = 0
      ) {
        fecha.setDate(fecha.getDate() + 1);
      }
  
      cuotas.push({
        creditoId,
        monto: cuotaMonto,
        fechaPago: new Date(fecha),
        metodoPago: null,
        estado: 'impago',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  
    // Guardar en la tabla cuotas
    const insertPromises = cuotas.map(cuota => {
      const query = `
        INSERT INTO cuotas 
        ("creditoId", monto, "fechaPago", estado, "createdAt", "updatedAt", "monto_pagado")
        VALUES ($1, $2, $3, $4, $5, $6, 0);
      `;
      const values = [
        cuota.creditoId,
        cuota.monto,
        cuota.fechaPago,
        cuota.estado,
        cuota.createdAt,
        cuota.updatedAt,
      ];
      return db.query(query, values);
    });
  
    await Promise.all(insertPromises);
    return cuotaMonto;
  }
};

module.exports = Credito;
