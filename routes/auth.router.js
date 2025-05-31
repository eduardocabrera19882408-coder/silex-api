const express = require('express');
const router = express.Router();
const { login, loginAdm } = require('../controllers/auth.controller'); // Importa el controlador de login

// Endpoint de login
router.post('/admin', loginAdm);
router.post('/user', login);

module.exports = router;