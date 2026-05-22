const UsuarioModel = require('../models/usuario');
const PermisoModel = require('../models/permiso');
const RutaModel = require('../models/ruta');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const Usuario = UsuarioModel(req.db);
  const Permiso = PermisoModel(req.db);
  const Ruta = RutaModel(req.db);
  const { email, password, company } = req.body;
  const secretKey = process.env.TOKEN;

  try {

    const usuario = await Usuario.getByEmail(email);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Credenciales inválidas. (1)' });
    }

    if (!['administrador', 'administrador_oficina', 'cobrador'].includes(usuario.tipo)) {
      return res.status(404).json({ success: false, message: 'Credenciales inválidas. (2)' });
    }

    const isPasswordValid = await Usuario.validatePassword(password, usuario.contrasena);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas. (3)' });
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
    //Obtener la ruta asignada al usuario
    let ruta = null;
    if (usuario.tipo === 'cobrador') {
      ruta = await Ruta.getByUserId(usuario.id);
    }
    // 🎟 Generar el token con los permisos en el payload
    const token = jwt.sign(
      {
        userId: usuario.id,
        name: usuario.nombre,
        email: usuario.correo,
        role: usuario.tipo,
        status: usuario.estado,
        permisos: permisos,
        ruta: ruta,
        company: company,
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
    console.log(error)
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
};

module.exports = { login };