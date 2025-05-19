const db = require('../config/db');

const Credito = {
  // Crear un crédito
  create : async (creditoData) => {
    const {
      monto, plazo_dias, frecuencia_pago,
      usuarioId, clienteId, productoId, rutaId
    } = creditoData;

    // 1️⃣ Validar configuración de la ruta
    const configQuery = `SELECT * FROM config_credits WHERE "rutaId" = $1;`;
    const configResult = await db.query(configQuery, [rutaId]);

    if (configResult.rows.length === 0) {
      return { error: "No hay configuración de crédito para la ruta seleccionada." };
    }

    const config = configResult.rows[0];

    // 2️⃣ Validaciones
    if (monto < config.monto_minimo) {
      return { error: `El monto mínimo para esta ruta es de ${config.monto_minimo}` };
    }

    if (monto > config.monto_maximo) {
      return { error: `El monto máximo para esta ruta es de ${config.monto_maximo}` };
    }

    if (plazo_dias < config.plazo_minimo || plazo_dias > config.plazo_maximo) {
      return { error: `El plazo debe estar entre ${config.plazo_minimo} y ${config.plazo_maximo} días.` };
    }

    if (!config.frecuencia_pago.includes(frecuencia_pago)) {
      return { error: `La frecuencia de pago '${frecuencia_pago}' no está permitida para esta ruta.` };
    }

    // 3️⃣ Verificar caja de la ruta
    const cajaQuery = `SELECT id, "saldoActual" FROM cajas WHERE "rutaId" = $1;`;
    const cajaResult = await db.query(cajaQuery, [rutaId]);

    if (cajaResult.rows.length === 0) {
      return { error: "La ruta no tiene una caja asignada." };
    }

    const cajaId = cajaResult.rows[0].id;
    const saldoDisponible = parseFloat(cajaResult.rows[0].saldoActual);

    console.log(saldoDisponible)

    if (saldoDisponible < monto) {
      return { error: "Saldo insuficiente en la caja para otorgar este crédito." };
    }

    // 4️⃣ Validar límite de créditos activos del cliente
    const creditosActivosQuery = `
      SELECT COUNT(*) AS total 
      FROM creditos 
      WHERE "clienteId" = $1 AND estado = 'impago';
    `;
    const creditosActivosResult = await db.query(creditosActivosQuery, [clienteId]);
    const creditosActivos = parseInt(creditosActivosResult.rows[0].total);

    if (creditosActivos >= config.max_credits) {
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
    const insertQuery = `
      INSERT INTO creditos (
        monto, plazo, frecuencia_pago, interes, monto_interes_generado,
        capital_pagado, interes_pagado, saldo_capital, saldo_interes,
        estado, "usuarioId", "clienteId", "productoId",
        "fechaVencimiento", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        'impago', $10, $11, $12,
        $13, NOW(), NOW()
      ) RETURNING *;
    `;

    const insertValues = [
      monto, plazo_dias, frecuencia_pago, interes, montoInteresGenerado,
      capitalPagado, interesPagado, saldoCapital, saldoInteres,
      usuarioId, clienteId, productoId,
      fechaVencimiento
    ];

    const result = await db.query(insertQuery, insertValues);
    const credito = result.rows[0];

    // 7️⃣ Actualizar saldo en caja
    const updateCajaQuery = `UPDATE cajas SET "saldoActual" = "saldoActual" - $1 WHERE "rutaId" = $2;`;
    await db.query(updateCajaQuery, [monto, rutaId]);

    // 8️⃣ Registrar movimiento de caja
    const movimientoQuery = `
      INSERT INTO movimientos_caja (
        "cajaId", tipo, monto, descripcion,
        saldo, saldo_anterior, category, "usuarioId",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, 'credito', $2, 'Desembolso de crédito',
        $3, $4, 'egreso', $5,
        NOW(), NOW()
      );
    `;

    const saldoAnterior = saldoDisponible;
    const saldoActual = saldoDisponible - monto;

    await db.query(movimientoQuery, [
      cajaId, monto, saldoActual, saldoAnterior, usuarioId
    ]);

    // 9️⃣ Generar cuotas respetando días no laborables
    await generarCuotas(credito.id, monto, interes, plazo_dias, frecuencia_pago);

    return credito;
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

  // modelo/Credito.js
  getDataDash: async (oficinaId, rutaId) => {
    try {
        // Consulta para obtener los créditos, cuotas impagas y pagos realizados hoy
        const queryText = `
          SELECT 
              COUNT(c.id) AS total,  -- Total de créditos impagos
              SUM(c.saldo_capital + c.saldo_interes) AS cartera,  -- Suma de saldo_capital + saldo_interes (cartera)
              SUM(COALESCE(p.monto, 0)) AS recaudacion,  -- Suma de los pagos realizados hoy (recaudación)
              COUNT(DISTINCT CASE
                WHEN q.estado = 'impago' AND q."fechaPago" < CURRENT_DATE THEN c.id 
              END) AS morosos,
              COUNT(DISTINCT CASE
                WHEN q.estado = 'impago' AND q."fechaPago" >= CURRENT_DATE THEN c.id 
              END) AS aldia,
              (
                SELECT COUNT(*) FROM (
                  SELECT c2.id
                  FROM creditos c2
                  LEFT JOIN cuotas q2 ON q2."creditoId" = c2.id
                  WHERE c2.estado = 'impago' AND q2.estado = 'impago'
                  GROUP BY c2.id
                  HAVING MAX(CASE 
                              WHEN q2."fechaPago" < CURRENT_DATE - INTERVAL '3 days' THEN 1 
                              ELSE 0 
                            END) = 0
                ) AS sub
              ) AS atrasados,
              (
                SELECT COUNT(*) FROM (
                  SELECT c2.id
                  FROM creditos c2
                  LEFT JOIN cuotas q2 ON q2."creditoId" = c2.id
                  WHERE c2.estado = 'impago' AND q2.estado = 'impago'
                  GROUP BY c2.id
                  HAVING MAX(CASE 
                              WHEN q2."fechaPago" < CURRENT_DATE - INTERVAL '5 days' THEN 1 
                              ELSE 0 
                            END) = 1
                ) AS sub
              ) AS alto_riesgo,
              COUNT(DISTINCT CASE 
                WHEN c."fechaVencimiento" < CURRENT_DATE THEN c.id  -- Créditos vencidos
              END) AS vencidos
          FROM 
              creditos c
          LEFT JOIN 
              cuotas q ON q."creditoId" = c.id AND q.estado = 'impago'  -- Incluir cuotas impagas
          LEFT JOIN 
              pagos p ON p."cuotaId" = q.id AND DATE(p."createdAt") = CURRENT_DATE  -- Pagos realizados hoy
          WHERE 
              c.estado = 'impago';  -- Filtrar créditos impagos
      `;


        const data = await db.query(queryText);

        // Organizar los resultados de acuerdo con la estructura que deseas
        let result = [];
        
        // Agrupar los datos por credito_id
        console.log(data.rowCount)
        return data.rows;
    } catch (error) {
        console.error("Error al obtener los datos:", error);
        throw error; // Lanza el error para manejarlo en la capa superior si es necesario
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
              'updatedAt', q."updatedAt"
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
              'cuotaId', pa."cuotaId",
              'createdAt', pa."createdAt",
              'updatedAt', pa."updatedAt"
            )
          ), '[]'::json)
          FROM pagos pa
          WHERE pa."cuotaId" IN (
            SELECT id FROM cuotas WHERE "creditoId" = c.id
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

  //Crear un pago
  createPago: async ({ creditoId, valor, metodoPago, userId }) => {
    const client = await db.connect();
  
    try {
      await client.query('BEGIN');
  
      // 1. Obtener datos del crédito (interés, usuario que lo creó, cliente)
      const creditoRes = await client.query(`
        SELECT interes, "usuarioId", "clienteId"
        FROM creditos
        WHERE id = $1
      `, [creditoId]);
  
      if (creditoRes.rowCount === 0) throw new Error("Crédito no encontrado");
  
      const { interes, usuarioId: creadorCreditoId, clienteId } = creditoRes.rows[0];
  
      // 2. Crear registro del pago principal
      const pagoRes = await client.query(`
        INSERT INTO pagos (
          monto, "user_created_id", "metodoPago", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id
      `, [valor, userId, metodoPago]);
  
      const pagoId = pagoRes.rows[0].id;
  
      // 3. Obtener cuotas pendientes del crédito
      const cuotasRes = await client.query(`
        SELECT id, monto, monto_pagado
        FROM cuotas
        WHERE "creditoId" = $1 AND estado = 'impago'
        ORDER BY "fechaPago" ASC
      `, [creditoId]);
  
      let montoRestante = valor;
      let totalCapitalPagado = 0;
      let totalInteresPagado = 0;
  
      for (const cuota of cuotasRes.rows) {
        if (montoRestante <= 0) break;
  
        const saldoCuota = cuota.monto - cuota.monto_pagado;
        const pagoAplicado = Math.min(saldoCuota, montoRestante);
  
        // 4. Insertar en pagos_cuotas
        await client.query(`
          INSERT INTO pagos_cuotas ("pagoId", "cuotaId", monto_abonado)
          VALUES ($1, $2, $3)
        `, [pagoId, cuota.id, pagoAplicado]);
  
        // 5. Actualizar la cuota
        await client.query(`
          UPDATE cuotas
          SET monto_pagado = monto_pagado + $1,
              estado = CASE WHEN monto_pagado + $1 >= monto THEN 'pagado' ELSE estado END,
              "updatedAt" = NOW()
          WHERE id = $2
        `, [pagoAplicado, cuota.id]);
  
        // 6. Calcular capital e interés reales
        const interesPago = pagoAplicado * (interes / 100);
        const capitalPago = pagoAplicado - interesPago;
  
        totalInteresPagado += interesPago;
        totalCapitalPagado += capitalPago;
  
        montoRestante -= pagoAplicado;
      }
  
      // 7. Actualizar el crédito
      await client.query(`
        UPDATE creditos
        SET 
          capital_pagado = capital_pagado + $1,
          interes_pagado = interes_pagado + $2,
          saldo_capital = saldo_capital - $1,
          saldo_interes = saldo_interes - $2,
          "updatedAt" = NOW()
        WHERE id = $3
      `, [totalCapitalPagado, totalInteresPagado, creditoId]);
  
      // 8. Obtener caja según la ruta del creador del crédito
      const cajaRes = await client.query(`
        SELECT c.id, c."saldoActual"
        FROM cajas c
        JOIN ruta r ON r.id = c."rutaId"
        WHERE r."userId" = $1
        LIMIT 1
      `, [creadorCreditoId]);
  
      if (cajaRes.rowCount === 0) throw new Error("Caja no encontrada");
  
      const cajaId = cajaRes.rows[0].id;
      const saldoAnterior = parseFloat(cajaRes.rows[0].saldoActual);
      const nuevoSaldo = saldoAnterior + parseFloat(valor);
  
      // 9. Actualizar saldo de caja
      await client.query(`
        UPDATE cajas
        SET "saldoActual" = $1
        WHERE id = $2
      `, [nuevoSaldo, cajaId]);
  
      // 10. Registrar movimiento en caja con los nuevos campos
      await client.query(`
        INSERT INTO movimientos_caja (
          "cajaId", descripcion, saldo, saldo_anterior, "createdAt", "updatedAt",
          monto, tipo, "usuarioId", category, "clienteId", "creditoId"
        ) VALUES (
          $1, 'Registro de pago de crédito', $2, $3, NOW(), NOW(),
          $4, 'abono', $5, 'ingreso', $6, $7
        )
      `, [
        cajaId, nuevoSaldo, saldoAnterior, valor,
        userId, clienteId, creditoId
      ]);
  
      await client.query('COMMIT');
  
      return { success: true, message: "Pago registrado correctamente", pagoId };
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      throw new Error("Error al registrar el pago");
    } finally {
      client.release();
    }
  }  
};

const generarCuotas = async (creditoId, monto, interes, plazo_dias, frecuencia_pago) => {
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

  const diasNoLaborablesQuery = `SELECT fecha FROM dias_no_laborables;`;
  const diasNoLaborablesResult = await db.query(diasNoLaborablesQuery);
  const diasNoLaborables = diasNoLaborablesResult.rows.map(row => row.fecha.toISOString().split('T')[0]);

  for (let i = 0; i < cantidadCuotas; i++) {
    fecha.setDate(fecha.getDate() + diasEntreCuotas);

    // ⏩ Avanzar si la fecha cae en día no laborable
    while (diasNoLaborables.includes(fecha.toISOString().split('T')[0])) {
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
};

module.exports = Credito;
