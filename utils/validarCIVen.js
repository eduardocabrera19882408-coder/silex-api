function validarCIVen(cedula) {
    // Limpiamos espacios y pasamos a mayúsculas
    const cedulaStr = String(cedula).trim().toUpperCase();
  
    // Validar formato: Letra (V, E, P, J) seguida de 6 a 8 dígitos
    const regex = /^[VEPJ]{1}\d{6,8}$/;
  
    if (!regex.test(cedulaStr)) {
      return {
        valido: false,
        mensaje: "Formato inválido. Debe comenzar con V, E, P o J seguido de 6 a 8 dígitos."
      };
    }
  
    return { valido: true, mensaje: "Cédula válida." };
}

module.exports = validarCIVen