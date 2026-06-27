const db = require('./conexion');

/**
 * Middleware para verificar si el usuario autenticado tiene permiso para
 * una operación específica sobre un submódulo.
 * Debe usarse después del middleware de autenticación (que debe dejar req.usuario con idRol).
 */
function verificarPermiso(subModulo, operacion) {
    return async (req, res, next) => {
        try {
            // Obtener el idRol del usuario autenticado (asumimos que está en req.usuario.idRol)
            const idRol = req.usuario?.idRol;
            if (!idRol) {
                return res.status(401).json({ error: 'No autenticado' });
            }

            // Consultar el permiso para este rol y submódulo
            const [rows] = await db.query(
                `SELECT ver, insertar, editar, eliminar 
                 FROM PermisoSubModulo 
                 WHERE idRol = ? AND subModulo = ?`,
                [idRol, subModulo]
            );

            if (rows.length === 0) {
                // Si no hay registro, se asume que no tiene ningún permiso
                return res.status(403).json({ error: 'Permiso denegado' });
            }

            const permiso = rows[0];
            let tienePermiso = false;
            switch (operacion) {
                case 'ver':      tienePermiso = permiso.ver === 1; break;
                case 'insertar': tienePermiso = permiso.insertar === 1; break;
                case 'editar':   tienePermiso = permiso.editar === 1; break;
                case 'eliminar': tienePermiso = permiso.eliminar === 1; break;
                default:         tienePermiso = false;
            }

            if (!tienePermiso) {
                return res.status(403).json({ error: `No tiene permiso para ${operacion} en ${subModulo}` });
            }

            next();
        } catch (error) {
            console.error('Error en middleware verificarPermiso:', error);
            res.status(500).json({ error: 'Error interno al verificar permisos' });
        }
    };
}

module.exports = { verificarPermiso };