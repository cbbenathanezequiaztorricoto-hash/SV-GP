//NOTAS
//===========================================================================
//😯¿Qué es un middleware?
//Es una función que se ejecuta antes de que llegue a tu ruta. 
//Por ejemplo, cuando alguien intenta crear un plato en /api/admin/menu, 
// el middleware verifica si la sesión es válida en Redis. 
// Si no lo es, devuelve error y no se ejecuta la función de crear plato.
//===========================================================================
//😀¿Para qué sirve en tu proyecto?
//Para demostrar que Redis no solo guarda la sesión al login, 
//sino que también la consulta en cada petición importante. 
//Esto muestra que Redis está activo y protege las rutas.

// src/backend/common/authMiddleware.js
const { get, setEx } = require('./redisClient'); // ← Importar setEx también

async function verificarSesion(req, res, next) {
    const idUsuario = req.headers['x-user-id'];
    if (!idUsuario) {
        return res.status(401).json({ error: 'No autenticado: falta x-user-id' });
    }

    const sessionKey = `session:${idUsuario}`;
    try {
        const sessionData = await get(sessionKey);
        if (!sessionData) {
            return res.status(401).json({ error: 'Sesión expirada o inválida' });

        }

        // Si existe, adjuntar los datos del usuario a la request
        req.usuario = JSON.parse(sessionData);
        
        // ✅ Renovar el TTL (sesión deslizante)
        await setEx(sessionKey, 3600, sessionData); // ← Variables correctas
        
        next();
    } catch (err) {
        console.error('❌ Error verificando sesión en Redis:', err);
        // No bloquear completamente si Redis falla (opcional)
        // return res.status(500).json({ error: 'Error al verificar sesión' });
        // En desarrollo, podríamos dejar pasar para no bloquear todo:
        // Si estás en desarrollo y no quieres que falle, comenta la línea de arriba y descomenta esta:
        // next();
        // Pero para producción, es mejor bloquear:
        return res.status(500).json({ error: 'Error al verificar sesión' });
    }
}

module.exports = { verificarSesion };
// ¿Qué hace el middleware?
// - Lee el idUsuario del header x-user-id que el frontend debe enviar en cada request.
// - Busca en Redis la clave session:${idUsuario}.
// - Si existe, deja pasar; si no, devuelve 401 No autenticado.