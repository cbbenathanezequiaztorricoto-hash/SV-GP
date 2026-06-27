// src/backend/common/conexion.js
const mysql = require('mysql2/promise');
require('dotenv').config();
// Usamos process.env para leer las variables que pondremos en Render
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "el_recuerdo",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Opcional: si tu DB externa soporta timezone, o usa UTC
    // timezone: 'Z' 
});

module.exports = db;
