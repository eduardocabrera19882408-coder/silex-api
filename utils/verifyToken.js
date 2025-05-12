const jwt = require('jsonwebtoken');

// Middleware para verificar el token
const verifyToken = (req, res, next) => {
  // Extraer el token del encabezado Authorization: Bearer <token>
  const token = req.header('Authorization')?.split(' ')[1]; // Divide "Bearer <token>" y toma el segundo valor

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // Verificar y decodificar el token
  jwt.verify(token, process.env.TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    req.user = decoded;  // Almacenar la información del usuario decodificada en la solicitud
    next();  // Pasa a la siguiente función en el pipeline (el controlador, por ejemplo)
  });
};

module.exports = verifyToken