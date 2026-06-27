// src/backend/common/redisClient.js
const redis = require('redis');
require('dotenv').config();

// Obtener URL desde variable de entorno
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Crear cliente Redis
const redisClient = redis.createClient({
    url: REDIS_URL
});

// Manejo de eventos
redisClient.on('error', (err) => {
    console.error('❌ Error en Redis:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Conexión a Redis Cloud establecida');
});

redisClient.on('ready', () => {
    console.log('✅ Redis listo para usar');
});

// Función para conectar (se ejecuta al importar)
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('❌ Error al conectar a Redis:', err);
    }
})();

// Helper: set con expiración (en segundos)
async function setEx(key, seconds, value) {
    try {
        await redisClient.set(key, value, { EX: seconds });
        return true;
    } catch (err) {
        console.error(`❌ Error al setear ${key}:`, err);
        throw err;
    }
}

// Helper: get
async function get(key) {
    try {
        return await redisClient.get(key);
    } catch (err) {
        console.error(`❌ Error al obtener ${key}:`, err);
        throw err;
    }
}

// Helper: del
async function del(key) {
    try {
        await redisClient.del(key);
        return true;
    } catch (err) {
        console.error(`❌ Error al eliminar ${key}:`, err);
        throw err;
    }
}

// Exportar cliente y helpers
module.exports = {
    redisClient,
    setEx,
    get,
    del
};