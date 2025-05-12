const cron = require('node-cron');
const pool = require('../config/db');

const programarCajasDinamico = () => {
  cron.schedule('* * * * *', async () => { // Se ejecuta cada minuto
    try {
      const now = new Date();
      const horas = now.toTimeString().slice(0, 5); // 'HH:MM'

      const result = await pool.query(`
        SELECT 
          to_char(hora_apertura_caja, 'HH24:MI') AS apertura,
          to_char(hora_cierre_caja, 'HH24:MI') AS cierre
        FROM config_caja 
        LIMIT 1
      `);

      const { apertura, cierre } = result.rows[0];

      if (horas === apertura) {
        await pool.query(`UPDATE cajas SET estado = 'abierta' WHERE estado = 'cerrada'`);
        console.log(`[CRON] Cajas abiertas a las ${horas}`);
      }

      if (horas === cierre) {
        await pool.query(`UPDATE cajas SET estado = 'cerrada' WHERE estado = 'abierta'`);
        console.log(`[CRON] Cajas cerradas a las ${horas}`);
      }

    } catch (err) {
      console.error('[CRON] Error en verificación dinámica de apertura/cierre:', err.message);
    }
  });

  console.log('[CRON] Programación dinámica de cajas activa (verifica cada minuto)');
};

module.exports = programarCajasDinamico;


