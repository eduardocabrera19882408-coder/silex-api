const cron = require('node-cron');
const pool = require('../config/db');
const Caja = require('../models/caja');

const programarCajasDinamico = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const horas = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date());

      const fechaHoy = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      const diaSemana = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        weekday: 'long'
      }).format(new Date()).toLowerCase();

      const userId = 1; // Usuario del sistema

      // 🛑 1️⃣ Verificar configuración de días no laborables
      const configNoLaborable = await pool.query(`
        SELECT excluir_sabados, excluir_domingos
        FROM config_dias_no_laborables
        LIMIT 1
      `);
      const { excluir_sabados, excluir_domingos } = configNoLaborable.rows[0];

      // 🛑 2️⃣ Verificar si la fecha actual está en la tabla dias_no_laborables
      const diaNoLaborable = await pool.query(`
        SELECT 1 FROM dias_no_laborables
        WHERE DATE(fecha) = CURRENT_DATE
        LIMIT 1
      `);

      // 🛑 3️⃣ Evaluar si hoy se debe excluir
      const esSabado = diaSemana.includes('sábado');
      const esDomingo = diaSemana.includes('domingo');

      if (
        (excluir_sabados && esSabado) ||
        (excluir_domingos && esDomingo) ||
        diaNoLaborable.rowCount > 0
      ) {
        console.log(`[CRON][${horas}] Día no laborable (${fechaHoy}) → no se ejecuta apertura/cierre de cajas.`);
        return; // 🚫 Salimos antes de procesar cajas
      }

      // 🔁 Tu código original desde aquí sin cambios
      const config = await pool.query(`
        SELECT 
          to_char(hora_apertura_caja, 'HH24:MI') AS apertura,
          to_char(hora_cierre_caja, 'HH24:MI') AS cierre
        FROM config_caja 
        LIMIT 1
      `);

      const { apertura, cierre } = config.rows[0];
      const cajas = await pool.query(`SELECT id, estado FROM cajas`);
      const totalCajas = cajas.rowCount;

      // 🔢 Contadores
      let abiertas = 0;
      let yaAbiertas = 0;
      let cerradas = 0;
      let sinCambios = 0;

      for (const { id: cajaId, estado } of cajas.rows) {
        if (horas === apertura && estado === 'cerrada') {
          const resultado = await Caja.abrirCaja(cajaId, userId, true);
          if (resultado.success) {
            abiertas++;
            console.log(`[CRON][${horas}] Caja ${cajaId} abierta automáticamente: ${resultado.message}`);
          } else {
            yaAbiertas++;
            console.log(`[CRON][${horas}] Caja ${cajaId} NO se abrió: ${resultado.message}`);
          }
        } else if (horas === cierre && estado === 'abierta') {
          await pool.query(`
            UPDATE cajas SET estado = 'cerrada', "updatedAt" = NOW()
            WHERE id = $1
          `, [cajaId]);
          cerradas++;
          console.log(`[CRON][${horas}] Caja ${cajaId} cerrada automáticamente (estado actualizado)`);
        } else {
          sinCambios++;
          console.log(`[CRON][${horas}] Caja ${cajaId} sin cambios (estado actual: ${estado})`);
        }
      }

      console.log(`[CRON][${horas}] RESUMEN → Total cajas: ${totalCajas} | Aberturas: ${abiertas} | Saltadas (turno abierto): ${yaAbiertas} | Cierres: ${cerradas} | Sin cambios: ${sinCambios}`);

    } catch (err) {
      console.error('[CRON] Error en ejecución dinámica:', err.message);
    }
  });

  console.log('[CRON] Programación dinámica de cajas activa (verifica cada minuto)');
};

module.exports = programarCajasDinamico;