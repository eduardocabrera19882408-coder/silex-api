// models/config.js
const pool = require('../config/db'); // Importar la conexión a la base de datos
const Caja = require('../models/caja');
const Credito = require('../models/credito');
const Config = require('../models/config')
const { addDays, addWeeks, addMonths, format, parseISO } = require('date-fns');

const Backup = {
    importarTransacciones: async (transacciones) => {
        const client = await pool.connect();
    
        try {
          await client.query('BEGIN');
    
          // Orden cronológico por fecha y hora
          transacciones.forEach(t => {
            const fecha = new Date(`${t.fecha} ${t.hora}`);
            if (isNaN(fecha.getTime())) {
              const ahora = new Date();
              t.__fechaOrden = ahora;
              t.fecha = ahora.toISOString().slice(0, 10); // 'YYYY-MM-DD'
              t.hora = ahora.toTimeString().slice(0, 8);  // 'HH:MM:SS'
            } else {
              t.__fechaOrden = fecha;
            }
          });
          
          transacciones.sort((a, b) => a.__fechaOrden - b.__fechaOrden);
          
          for (const tx of transacciones) {
            const timestamp = new Date(`${tx.fecha}T${tx.hora}`);
          
            // Obtener la caja actualizada directamente desde la base de datos
            const { rows } = await client.query(`SELECT * FROM cajas WHERE "rutaId" = $1`, [tx.ruta]);
            const caja = rows[0];
          
            if (!caja) {
              throw new Error(`Caja no encontrada para la ruta ${tx.ruta}`);
            }
          
            const turnoResult = await client.query(`
              SELECT * FROM turnos WHERE caja_id = $1
            `, [caja.id]);
            
            const turno = turnoResult.rows[0];
            
            if (!turno) {
              throw new Error(`Turno no encontrado para la caja ${caja.id}`);
            }
          
            // Mantener el saldo en memoria para evitar inconsistencias
            let saldoActualCaja = parseFloat(caja.saldoActual);
          
            if (tx.tipo === 'CREDITO') {
              const clienteResult = await client.query(`
                INSERT INTO clientes (
                  codigo_cliente, identificacion, nombres, direccion, telefono,
                  "coordenadasCasa", "coordenadasCobro", estado, updated,
                  "createdAt", "updatedAt", nacionalidad, "rutaId", "userId_create", buro
                ) VALUES (
                  $1, $2, $3, $4, $5,
                  $6, $7, 'activo', false,
                  NOW(), NOW(), 'EC', $8, $9, $10
                )
                ON CONFLICT (codigo_cliente) DO NOTHING
                RETURNING id, nombres
              `, [
                tx.codigo_cliente,
                tx.documento || 0,
                tx.cliente,
                tx.direccion,
                tx.celular,
                `${tx.latitud},${tx.longitud}`,
                `${tx.latitud},${tx.longitud}`,
                tx.ruta,
                1,
                400
              ]);
          
              const cliente = clienteResult.rows[0] || (
                await client.query(`SELECT id, nombres FROM clientes WHERE codigo_cliente = $1`, [tx.codigo_cliente])
              ).rows[0];
          
              const clienteId = cliente.id;
              const clienteNombre = cliente.nombres;
          
              const monto = parseFloat(tx.valor_credito);
              const interes = parseFloat((tx.interes * 100).toFixed(2));
              const montoInteres = parseFloat(tx.total_credito) - monto;
          
              const fechaVencimiento = await Backup.calcularFechaVencimiento({
                forma_pago: tx.forma_pago,
                numero_cuotas: tx.numero_cuotas,
                fecha: tx.fecha
              });
          
              const frecuencia_pago = tx.forma_pago.toLowerCase();
              const diferenciaMs = new Date(fechaVencimiento).getTime() - new Date(tx.fecha).getTime();
              const plazo = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
              const estado = tx.estado === 'PAGADO' ? 'pagado' : 'impago';
          
              const creditoResult = await client.query(`
                INSERT INTO creditos ("clienteId", "usuarioId", monto, interes, "monto_interes_generado", "capital_pagado", "interes_pagado", "saldo_capital", "saldo_interes", plazo, "frecuencia_pago", estado, "productoId", "turno_id", "fechaVencimiento", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
                RETURNING id
              `, [
                clienteId,
                tx.usuario,
                monto,
                interes,
                montoInteres,
                monto,
                montoInteres,
                plazo,
                frecuencia_pago,
                estado,
                tx.producto,
                turno.id,
                fechaVencimiento,
                timestamp
              ]);
          
              const creditoId = creditoResult.rows[0].id;
          
              await Backup.generarCuotas(
                creditoId,
                monto,
                interes,
                plazo,
                frecuencia_pago,
                new Date(tx.fecha)
              );
          
              // Actualizar saldo de caja descontando el monto desembolsado
              const nuevoSaldoCaja = saldoActualCaja - monto;
          
              await client.query(`
                UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2
              `, [nuevoSaldoCaja, caja.id]);
          
              await client.query(`
                INSERT INTO movimientos_caja (
                  "cajaId", descripcion, saldo, "saldo_anterior", "createdAt", "updatedAt",
                  monto, tipo, "usuarioId", category, "clienteId", "creditoId", "turnoId"
                )
                VALUES ($1, $2, $3, $4, $5, $5, $6, 'credito', $7, 'egreso', $8, $9, $10)
              `, [
                caja.id,
                `Desembolso de crédito - (CL${clienteId}: ${clienteNombre})`,
                nuevoSaldoCaja,
                saldoActualCaja,
                timestamp,
                monto,
                tx.usuario,
                clienteId,
                creditoId,
                turno.id
              ]);
          
              // Actualizamos saldo en memoria para seguir con operaciones
              saldoActualCaja = nuevoSaldoCaja;
          
              const abono = parseFloat(tx.total_credito) - parseFloat(tx.saldo || 0);
          
              if (abono > 0) {
                const pagoResult = await client.query(`
                  INSERT INTO pagos (
                    cliente_id, monto, tipo, observacion, "createdAt", "updatedAt", turno_id, user_created_id, estado, "metodoPago"
                  )
                  VALUES ($1, $2, 'abono', $6, $3, $3, $4, $5, 'aprobado', 'Efectivo')
                  RETURNING id
                `, [
                  clienteId,
                  abono,
                  timestamp,
                  turno.id,
                  tx.usuario,
                  `Registro de pago de crédito - (${creditoId}: ${clienteNombre})`
                ]);
          
                const pagoId = pagoResult.rows[0].id;
          
                const cuotas = await client.query(`
                  SELECT id, monto, monto_pagado
                  FROM cuotas
                  WHERE "creditoId" = $1
                  ORDER BY "fechaPago" ASC
                `, [creditoId]);
          
                let restante = abono;
                let totalCapitalPagado = 0;
                let totalInteresPagado = 0;
          
                const credito = await client.query(`
                  SELECT monto, "monto_interes_generado"
                  FROM creditos
                  WHERE id = $1
                `, [creditoId]);
          
                const capitalOriginal = parseFloat(credito.rows[0].monto);
                const interesGenerado = parseFloat(credito.rows[0].monto_interes_generado);
                const totalDeuda = capitalOriginal + interesGenerado;
          
                for (const cuota of cuotas.rows) {
                  if (restante <= 0) break;
          
                  const cuotaId = cuota.id;
                  const montoCuota = parseFloat(cuota.monto);
                  const pagadoActual = parseFloat(cuota.monto_pagado || 0);
                  const saldoCuota = montoCuota - pagadoActual;
                  const montoAbonado = Math.min(restante, saldoCuota);
                  const nuevoMontoPagado = pagadoActual + montoAbonado;
                  const estadoCuota = nuevoMontoPagado >= montoCuota ? 'pagado' : 'impago';
          
                  const proporcion = montoAbonado / totalDeuda;
                  const capitalPagado = parseFloat((capitalOriginal * proporcion).toFixed(2));
                  const interesPagado = parseFloat((interesGenerado * proporcion).toFixed(2));
          
                  totalCapitalPagado += capitalPagado;
                  totalInteresPagado += interesPagado;
          
                  await client.query(`
                    INSERT INTO pagos_cuotas ("pagoId", "cuotaId", monto_abonado, created_at, capital_pagado, interes_pagado)
                    VALUES ($1, $2, $3, NOW(), $4, $5)
                  `, [
                    pagoId,
                    cuotaId,
                    montoAbonado,
                    capitalPagado,
                    interesPagado
                  ]);
          
                  await client.query(`
                    UPDATE cuotas
                    SET monto_pagado = $1, estado = $2, "updatedAt" = NOW()
                    WHERE id = $3
                  `, [nuevoMontoPagado, estadoCuota, cuotaId]);
          
                  restante -= montoAbonado;
                }
          
                const saldoCapital = capitalOriginal - totalCapitalPagado;
                const saldoInteres = interesGenerado - totalInteresPagado;
                const nuevoEstado = (saldoCapital <= 0 && saldoInteres <= 0) ? 'pagado' : 'impago';
          
                await client.query(`
                  UPDATE creditos
                  SET capital_pagado = $1,
                    interes_pagado = $2,
                    saldo_capital = $3,
                    saldo_interes = $4,
                    estado = $5,
                    "updatedAt" = NOW()
                  WHERE id = $6
                `, [
                  totalCapitalPagado,
                  totalInteresPagado,
                  saldoCapital,
                  saldoInteres,
                  nuevoEstado,
                  creditoId
                ]);
          
                // 💵 Actualizar saldo luego del abono
                const nuevoSaldoConPago = saldoActualCaja + abono;
          
                await client.query(`
                  UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2
                `, [nuevoSaldoConPago, caja.id]);
          
                await client.query(`
                  INSERT INTO movimientos_caja (
                    "cajaId", descripcion, saldo, "saldo_anterior", "createdAt", "updatedAt",
                    monto, tipo, "usuarioId", category, "clienteId", "creditoId", "turnoId"
                  )
                  VALUES ($1, $2, $3, $4, $5, $5, $6, 'abono', $7, 'ingreso', $8, $9, $10)
                `, [
                  caja.id,
                  `Registro de pago de crédito - ${creditoId}: ${clienteNombre}`,
                  nuevoSaldoConPago,
                  saldoActualCaja,
                  timestamp,
                  abono,
                  tx.usuario,
                  clienteId,
                  creditoId,
                  turno.id
                ]);
          
                saldoActualCaja = nuevoSaldoConPago;
              }
            } else if (tx.tipo === 'INGRESO') {
              const monto = parseFloat(tx.valor);
              // Insertar en ingresos
              await client.query(`
                INSERT INTO ingresos (
                  monto, descripcion, "createdAt", "updatedAt", estado,
                  user_created_id, "ingresoCategoryId", observacion, "cajaId", turno_id, user_aproved_id
                )
                VALUES (
                  $1, $2, $3, $3, 'aprobado',
                  $4, $5, $6, $7, $8, $9
                )
              `, [
                monto,
                tx.concepto,
                timestamp,
                tx.user_create,
                tx.categoria || null,
                tx.observacion,
                caja?.id || null,
                turno?.id || null,
                tx.user_auth
              ]);
              // Insertar en movimientos_caja si hay caja
              if (caja) {
                const nuevoSaldo = saldoActualCaja + monto;
                await client.query(`
                  UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2
                `, [nuevoSaldo, caja.id]);

                await client.query(`
                  INSERT INTO movimientos_caja (
                    "cajaId", descripcion, saldo, "saldo_anterior", "createdAt", "updatedAt",
                    monto, tipo, "usuarioId", category, "turnoId"
                  )
                  VALUES ($1, $2, $3, $4, $5, $5, $6, 'ingreso', $7, 'ingreso', $8)
                `, [
                  caja.id,
                  tx.concepto,
                  nuevoSaldo,
                  saldoActualCaja,
                  timestamp,
                  monto,
                  tx.user_create,
                  turno.id
                ]);
                saldoActualCaja = nuevoSaldo;
              }
            } else if (tx.tipo === 'EGRESO') {
              const monto = parseFloat(tx.valor);
              await client.query(`
                INSERT INTO egresos (
                  monto, descripcion, "createdAt", "updatedAt", estado,
                  user_created_id, "gastoCategoryId", observacion, "cajaId", turno_id, user_aproved_id
                )
                VALUES (
                  $1, $2, $3, $3, 'aprobado',
                  $4, $5, $6, $7, $8, $9
                )
              `, [
                monto,
                tx.concepto,
                timestamp,
                tx.user_create,
                tx.categoria || null,
                tx.observacion,
                caja?.id || null,
                turno?.id || null,
                tx.user_auth
              ]);
              if (caja) {
                const nuevoSaldo = saldoActualCaja - monto;
                await client.query(`
                  UPDATE cajas SET "saldoActual" = $1, "updatedAt" = NOW() WHERE id = $2
                `, [nuevoSaldo, caja.id]);

                await client.query(`
                  INSERT INTO movimientos_caja (
                    "cajaId", descripcion, saldo, "saldo_anterior", "createdAt", "updatedAt",
                    monto, tipo, "usuarioId", category, "turnoId"
                  )
                  VALUES ($1, $2, $3, $4, $5, $5, $6, 'egreso', $7, 'egreso', $8)
                `, [
                  caja.id,
                  tx.concepto,
                  nuevoSaldo,
                  saldoActualCaja,
                  timestamp,
                  monto,
                  tx.user_create,
                  turno.id
                ]);
                saldoActualCaja = nuevoSaldo;
              }
            }
          }
    
          await client.query('COMMIT');
          return { success: true };
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
    },
    calcularFechaVencimiento: async({ forma_pago, numero_cuotas, fecha })=> {
        const fechaInicio = parseISO(fecha);
        let fechaVencimiento;
      
        switch (forma_pago) {
          case 'DIARIO':
            fechaVencimiento = addDays(fechaInicio, numero_cuotas);
            break;
          case 'SEMANAL':
            fechaVencimiento = addWeeks(fechaInicio, numero_cuotas);
            break;
          case 'QUINCENAL':
            fechaVencimiento = addDays(fechaInicio, numero_cuotas * 15);
            break;
          case 'MENSUAL':
            fechaVencimiento = addMonths(fechaInicio, numero_cuotas);
            break;
          default:
            throw new Error(`Forma de pago no soportada: ${forma_pago}`);
        }
      
        return format(fechaVencimiento, 'yyyy-MM-dd');
    },
    generarCuotas: async (creditoId, monto, interes, plazo_dias, frecuencia_pago, fechaInicio) => {
        const cuotas = [];
        const totalConInteres = monto + (monto * interes) / 100;
      
        let cantidadCuotas = 0;
        let diasEntreCuotas = 1;
      
        switch (frecuencia_pago.toLowerCase()) {
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
      
        // Usar la fecha de inicio proporcionada
        let fecha = new Date(fechaInicio); // ✅ Asegúrate de que esté en formato válido (ISO recomendado)
      
        // Obtener días no laborables específicos
        const diasNoLaborablesQuery = `SELECT fecha FROM dias_no_laborables;`;
        const diasNoLaborablesResult = await pool.query(diasNoLaborablesQuery);
        const diasNoLaborables = diasNoLaborablesResult.rows.map(row => row.fecha.toISOString().split('T')[0]);
      
        // Obtener configuración desde el modelo Config
        const config = await Config.getConfigDiasNoLaborables() || { excluir_sabados: false, excluir_domingos: false };
      
        for (let i = 0; i < cantidadCuotas; i++) {
          // Avanza según frecuencia
          fecha.setDate(fecha.getDate() + diasEntreCuotas);
      
          // Saltar días no laborables o fines de semana si están configurados
          while (
            diasNoLaborables.includes(fecha.toISOString().split('T')[0]) ||
            (config.excluir_sabados && fecha.getDay() === 6) || // sábado
            (config.excluir_domingos && fecha.getDay() === 0)   // domingo
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
      
        // Insertar cuotas en base de datos
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
          return pool.query(query, values);
        });
      
        await Promise.all(insertPromises);
        return cuotaMonto;
    }
      
};

module.exports = Backup;