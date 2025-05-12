const db = require('../config/db');

const Permiso = {
  // Crear un permiso con un array en descripcion
  create: async (permisoData) => {
    const queryText = `
      INSERT INTO permisos (nombre, descripcion, "createdAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW()) RETURNING *;
    `;
    // Aseguramos que descripcion esté en formato array
    const descripcion = Array.isArray(permisoData.descripcion) ? permisoData.descripcion : [permisoData.descripcion];
    const values = [permisoData.nombre, descripcion];
    const { rows } = await db.query(queryText, values);
    
    // Convertir descripcion a un array antes de devolverlo
    const permisoCreado = rows[0];
    permisoCreado.descripcion = Array.isArray(permisoCreado.descripcion) ? permisoCreado.descripcion : [permisoCreado.descripcion];

    return permisoCreado;
  },

  // Obtener todos los permisos
  getAll: async () => {
    const queryText = `SELECT * FROM permisos ORDER BY "createdAt" DESC;`;
    const { rows } = await db.query(queryText);

    // Aseguramos que descripcion esté como un array
    return rows.map((row) => ({
      ...row,
      descripcion: row.descripcion ? [row.descripcion] : [], // Convertir descripcion a array
    }));
  },

  // Obtener un permiso por ID
  getById: async (id) => {
    const queryText = `SELECT * FROM permisos WHERE id = $1;`;
    const { rows } = await db.query(queryText, [id]);
    if (rows.length === 0) return null;

    const permiso = rows[0];
    // Aseguramos que descripcion esté como un array
    permiso.descripcion = permiso.descripcion ? [permiso.descripcion] : [];

    return permiso;
  },

  // Obtener los usuarios con un permiso específico
  getUsuariosByPermiso: async (id) => {
    const queryText = `
      SELECT u.id, u.nombre, u.email 
      FROM usuarios u
      WHERE u."permisoId" = $1;
    `;
    const { rows } = await db.query(queryText, [id]);
    return rows;
  },

  // Actualizar un permiso
  update: async (id, updateData) => {
    const queryText = `
      UPDATE permisos 
      SET nombre = $1, descripcion = $2, "updatedAt" = NOW()
      WHERE id = $3 RETURNING *;
    `;
    // Aseguramos que descripcion esté en formato array
    const descripcion = Array.isArray(updateData.descripcion) ? updateData.descripcion : [updateData.descripcion];
    const values = [updateData.nombre, descripcion, id];
    const { rows } = await db.query(queryText, values);

    // Aseguramos que descripcion esté como un array al devolverlo
    const permiso = rows[0];
    permiso.descripcion = permiso.descripcion ? [permiso.descripcion] : [];

    return permiso;
  },

  // Eliminar un permiso (solo si no está asignado a usuarios)
  delete: async (id) => {
    // Verificar si hay usuarios con este permiso
    const checkQuery = `SELECT COUNT(*) FROM usuarios WHERE "permisoId" = $1;`;
    const checkResult = await db.query(checkQuery, [id]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      return { error: "No se puede eliminar el permiso porque está asignado a usuarios." };
    }

    const queryText = `DELETE FROM permisos WHERE id = $1 RETURNING *;`;
    const { rows } = await db.query(queryText, [id]);
    return rows.length ? rows[0] : null;
  }
};

module.exports = Permiso;