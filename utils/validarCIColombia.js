function validarCedulaColombiana(cedula) {
    // Convertimos a string por si viene como número
    const cedulaStr = String(cedula).trim();
  
    // Verificar que sólo contiene dígitos
    if (!/^\d+$/.test(cedulaStr)) {
      return { valido: false, mensaje: "La cédula solo debe contener números." };
    }
  
    // Verificar longitud (usualmente entre 6 y 10 dígitos)
    if (cedulaStr.length < 6 || cedulaStr.length > 10) {
      return { valido: false, mensaje: "La cédula debe tener entre 6 y 10 dígitos." };
    }
  
    // Verificar que no comience con 0
    if (cedulaStr.startsWith("0")) {
      return { valido: false, mensaje: "La cédula no debe comenzar con 0." };
    }
  
    return { valido: true, mensaje: "Cédula válida." };
  }
module.exports = validarCedulaColombiana  