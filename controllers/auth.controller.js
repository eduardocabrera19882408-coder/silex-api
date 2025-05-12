const Usuario = require('../models/usuario');
const Permiso = require('../models/permiso')
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { email, password } = req.body;
  const secretKey = process.env.TOKEN;

  try {
    const usuario = await Usuario.getByEmail(email);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const isPasswordValid = await Usuario.validatePassword(password, usuario.contrasena);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    // ✅ Obtener permisos desde la tabla permisos
    let permisos = [];
    if (usuario.permisoId) {
      const permisosDescripcion = await Permiso.getById(usuario.permisoId);
      // Asegurarse que es un array válido (puede estar como string si viene así desde DB)
      if (typeof permisosDescripcion.descripcion[0] === 'string') {
        permisos = JSON.parse(permisosDescripcion.descripcion[0]);
      } else if (Array.isArray(permisosDescripcion.descripcion[0])) {
        permisos = permisosDescripcion.descripcion[0];
      }
    }
    // 🎟 Generar el token con los permisos en el payload
    const token = jwt.sign(
      {
        userId: usuario.id,
        name: usuario.nombre,
        email: usuario.correo,
        role: usuario.tipo,
        status: usuario.estado,
        permisos: permisos, // <- acá agregamos los permisos al payload
      },
      secretKey,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
};

module.exports = { login };