const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.controller'); // Importa el controlador de login

// Endpoint de login
router.post('/', login);

module.exports = router;