const validarCIVen = require('./validarCIVen')
const validarCedulaColombiana = require('./validarCIColombia')
const validarCIEcuador = require('./validarCIEcuador')

function identificarCedula(cedula) {
    // Validación Ecuador
    if (cedula.length === 10 && validarCIEcuador(cedula)) {
      return ["Ecuador", true];
    }
  
    // Validación Colombia
    const resultadoColombia = validarCedulaColombiana(cedula);
    if (resultadoColombia.valido) {
      return ["Colombia", true];
    }
  
    // Validación Venezuela
    const resultadoVenezuela = validarCIVen(cedula);
    if (resultadoVenezuela.valido) {
      return ["Venezuela", true];
    }
  
    // Si no es de ninguno
    return ["Desconocida", false];
}

module.exports = identificarCedula