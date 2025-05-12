const db = require('../config/db');

const Reporte = {
  // Obtener reporte de estado de cuenta
  getEstadoCuenta : async (oficinaId, rutaId, desde, hasta) => {
    try {
      let values = [desde, hasta];
      let queryBase = `
        SELECT 
          mc.id,
          mc."createdAt",
          mc.monto,
          mc.tipo,
          mc.descripcion,
          u.nombre AS usuario_nombre,
          r.nombre AS ruta_nombre
        FROM movimientos_caja mc
        JOIN usuarios u ON mc."usuarioId" = u.id
        JOIN cajas c ON mc."cajaId" = c.id
        JOIN ruta r ON c."rutaId" = r.id
        WHERE mc."createdAt" BETWEEN $1 AND $2
      `;
  
      // Si hay rutaId, filtramos por esa ruta
      if (rutaId) {
        queryBase += ` AND r.id = $3`;
        values.push(Number(rutaId));
      } 
      // Si no hay rutaId pero hay oficinaId, filtramos por todas las rutas de esa oficina
      else if (oficinaId) {
        // Obtener rutas de la oficina
        const rutasResult = await db.query(
          'SELECT id FROM ruta WHERE "oficinaId" = $1',
          [Number(oficinaId)]
        );
        const rutaIds = rutasResult.rows.map(r => r.id);
  
        if (rutaIds.length === 0) {
          return []; // No hay rutas asociadas
        }
  
        // Generar lista de $ params dinámicos
        const placeholders = rutaIds.map((_, i) => `$${i + 3}`).join(', ');
        queryBase += ` AND r.id IN (${placeholders})`;
        values = values.concat(rutaIds);
      }
  
      queryBase += ` ORDER BY mc."createdAt" ASC`;
  
      const result = await db.query(queryBase, values);
      return result.rows;
  
    } catch (error) {
      console.error('Error en getEstadoCuenta:', error);
      throw error;
    }
  }   
};

module.exports = Reporte;