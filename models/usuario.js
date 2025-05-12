const db = require('../config/db'); // Conexión a la base de datos
const bcrypt = require('bcrypt'); // Para comparar la contraseña

const Usuario = {
  // Crear un nuevo usuario
  create: async (usuarioData) => {
    const { nombre, correo, contrasena, tipo, permisoId, securityCode, estado } = usuarioData;

    // Encriptar la contraseña antes de guardarla
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(contrasena, saltRounds); // Encriptar la contraseña

    // Encriptar el securityCode antes de guardarlo
    const hashedSecurityCode = await bcrypt.hash(securityCode, saltRounds); // Encriptar el securityCode

    const queryText = `
      INSERT INTO usuarios (nombre, correo, contrasena, "securityCode", tipo, "permisoId", estado, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *;
    `;
    const values = [nombre, correo, hashedPassword, hashedSecurityCode, tipo, permisoId, estado];
    const result = await db.query(queryText, values);
    return result.rows[0]; // Devuelve el usuario creado
  },

  // Obtener todos los usuarios con paginación
  getAll: async (page, limit, offset) => {
    const queryText = `
      SELECT * FROM usuarios
      WHERE estado != 'archivado'
      LIMIT $1 OFFSET $2;
    `;
    const result = await db.query(queryText, [limit, offset]);

    // Obtener el total de registros para cálculo de páginas
    const countQuery = 'SELECT COUNT(*) FROM usuarios WHERE estado != \'archivado\';';
    const countResult = await db.query(countQuery);
    const total = Number(countResult.rows[0].count);
    const totalPages = total > 0 ? Math.ceil(Number(total) / Number(limit)) : 1;

    return {
      data: result.rows,
      total: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: totalPages
    };
  },

  // Obtener un usuario por su ID
  getById: async (id) => {
    const queryText = 'SELECT * FROM usuarios WHERE id = $1 AND estado != \'archivado\';';
    const result = await db.query(queryText, [id]);
    return result.rows[0]; // Devuelve el usuario encontrado
  },

  // Archivar un usuario (cambiar su estado a "archivado")
  archive: async (id) => {
    const queryText = 'UPDATE usuarios SET estado = \'archivado\' WHERE id = $1 RETURNING *;';
    const result = await db.query(queryText, [id]);
    return result.rows[0]; // Devuelve el usuario archivado
  },

  // desarchivar un usuario (cambiar su estado a "activo")
  desarchive: async (id) => {
    const queryText = 'UPDATE usuarios SET estado = \'activo\' WHERE id = $1 RETURNING *;';
    const result = await db.query(queryText, [id]);
    return result.rows[0]; // Devuelve el usuario activo
  },

  // Editar un usuario por su ID
  edit: async (id, usuarioData) => {
    const { nombre, correo, contrasena, securityCode, tipo, permisoId } = usuarioData;

    let queryText;
    let values;

    if (contrasena) {
      // Encriptar la nueva contraseña si se proporciona una
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(contrasena, saltRounds); // Encriptar la nueva contraseña

      if (securityCode) {
        // Encriptar el nuevo securityCode si se proporciona uno
        const hashedSecurityCode = await bcrypt.hash(securityCode, saltRounds); // Encriptar el securityCode

        queryText = `
          UPDATE usuarios 
          SET nombre = $1, correo = $2, contrasena = $3, "securityCode" = $4, tipo = $5, "permisoId" = $6, "updatedAt" = NOW()
          WHERE id = $7 RETURNING *;
        `;
        values = [nombre, correo, hashedPassword, hashedSecurityCode, tipo, permisoId, id];
      } else {
        queryText = `
          UPDATE usuarios 
          SET nombre = $1, correo = $2, contrasena = $3, tipo = $4, "permisoId" = $5, "updatedAt" = NOW()
          WHERE id = $6 RETURNING *;
        `;
        values = [nombre, correo, hashedPassword, tipo, permisoId, id];
      }
    } else {
      // Si no se proporciona nueva contraseña, solo actualizamos los demás campos
      if (securityCode) {
        // Encriptar el nuevo securityCode si se proporciona uno
        const hashedSecurityCode = await bcrypt.hash(securityCode, saltRounds); // Encriptar el securityCode

        queryText = `
          UPDATE usuarios 
          SET nombre = $1, correo = $2, "securityCode" = $3, tipo = $4, "permisoId" = $5, "updatedAt" = NOW()
          WHERE id = $6 RETURNING *;
        `;
        values = [nombre, correo, hashedSecurityCode, tipo, permisoId, id];
      } else {
        queryText = `
          UPDATE usuarios 
          SET nombre = $1, correo = $2, tipo = $3, "permisoId" = $4, "updatedAt" = NOW()
          WHERE id = $5 RETURNING *;
        `;
        values = [nombre, correo, tipo, permisoId, id];
      }
    }

    const result = await db.query(queryText, values);
    return result.rows[0]; // Devuelve el usuario actualizado
  },

  //Buscar usuarios por datos
  searchByData: async (searchTerm, page, limit, offset) => {
  
    const queryText = `
      SELECT * FROM usuarios
      WHERE (LOWER(nombre) ILIKE LOWER($1) OR LOWER(correo) ILIKE LOWER($1) OR LOWER(estado) ILIKE LOWER($1))
      ORDER BY id DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(queryText, [`%${searchTerm}%`, limit, offset]);
  
    const countQuery = `
      SELECT COUNT(*) FROM usuarios
      WHERE (LOWER(nombre) ILIKE LOWER($1) OR LOWER(correo) ILIKE LOWER($1) OR LOWER(estado) ILIKE LOWER($1));
    `;
    const countResult = await db.query(countQuery, [`%${searchTerm}%`]);
  
    const total = Number(countResult.rows[0].count);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
  
    return {
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages
    };
  },

  // Buscar usuarios por oficina a través de la ruta asignada
  getUsuariosByOficina: async (oficinaId, page, limit, offset) => {
    const queryText = `
      SELECT DISTINCT u.*
      FROM usuarios u
      JOIN usuariorutas ur ON u.id = ur."usuarioId"
      JOIN ruta r ON ur."rutaId" = r.id
      WHERE r."oficinaId" = $1 AND u.estado != 'archivado'
      LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(queryText, [oficinaId, limit, offset]);

    // Obtener el total de registros para cálculo de páginas
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM usuarios u
      JOIN usuariorutas ur ON u.id = ur."usuarioId"
      JOIN ruta r ON ur."rutaId" = r.id
      WHERE r."oficinaId" = $1 AND u.estado != 'archivado';
    `;
    const countResult = await db.query(countQuery, [oficinaId]);
    const total = Number(countResult.rows[0].total);

    return {
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  },

  // Obtener un usuario por su correo electrónico (u otro identificador único)
  getByEmail: async (email) => {
    try {
      const res = await db.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
      return res.rows[0]; // Retorna el primer usuario encontrado (debería ser único)
    } catch (error) {
      throw error;
    }
  },
  
  // Verificar que la contraseña es válida (comparando el hash)
  validatePassword: async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword); // Retorna true o false
  },
  
};

module.exports = Usuario;
