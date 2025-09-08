// db.js
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.PGUSER,      // en pg por defecto se usa PGUSER
  host: process.env.PGHOST,      // PGHOST
  database: process.env.PGDATABASE, // PGDATABASE
  password: process.env.PGPASSWORD, // PGPASSWORD
  port: process.env.PGPORT,      // PGPORT
  options: `-c search_path=${process.env.PGSCHEMA}` // evita error si no está definido
});


// Probar conexión
pool.connect()
  .then(client => {
    console.log('✅ Conexión a PostgreSQL exitosa');
    client.release();
  })
  .catch(err => {
    console.error('❌ Error de conexión a PostgreSQL:', err);
  });

// Exportar la conexión (pool) para usarla en los modelos
module.exports = pool;
