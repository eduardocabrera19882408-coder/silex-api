const app = require('./app')
const { createServer } = require('http')
const reabrirCajas = require('./services/reabrirCajasCron');
// const crypto = require('crypto');

const port = 3001
const servidor = createServer(app)
servidor.listen(port, ()=>{
    console.log('Server is running on port: ' + port)
    reabrirCajas(); // ⏰ Activa el cron al arrancar el servidor

    // Generar una clave secreta de 256 bits (32 bytes)
    // const secretKey = crypto.randomBytes(32).toString('hex');
    // console.log('Clave secreta:', secretKey);
})