// db.js
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'sistema_prestamos',
  password: 'C9p5aqh',
  port: 5432,
});

// Exportar la conexión (pool) para usarla en los modelos
module.exports = pool;
