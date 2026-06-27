const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./backend/common/conexion');

// Importar Redis
const { redisClient, setEx, get, del } = require('./backend/common/redisClient');

const administracionRoutes = require('./routes/administracion.routes');
const pedidosRoutes = require('./routes/pedidos.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vistas/login.html'));
});

// ==========================================
// AUTENTICACIÓN
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(200).json({ exito: false, error: "Por favor, ingrese el usuario y la contraseña." });
    }

    try {
        // 1. Obtener usuario
        const [rows] = await db.query(`
            SELECT u.idUsuario, u.username, u.passwordHash, e.idRol, r.nombreRol AS rolNombre, e.fotoPerfil
            FROM Usuario u
            INNER JOIN Empleado e ON u.idUsuario = e.idUsuario
            INNER JOIN Rol r ON e.idRol = r.idRol
            WHERE u.username = ?
        `, [username]);

        if (rows.length === 0) {
            return res.status(200).json({ exito: false, error: "El usuario no existe." });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.passwordHash);

        if (!match) {
            return res.status(200).json({ exito: false, error: "Contraseña incorrecta." });
        } else {
            // Guardar sesión en Redis con expiración de 1 hora (3600 segundos)
            const sessionKey = `session:${user.idUsuario}`;
            const sessionData = JSON.stringify({
                idUsuario: user.idUsuario,
                username: user.username,
                idRol: user.idRol,
                rolNombre: user.rolNombre
            });

            try {
                await setEx(sessionKey, 3600, sessionData);
                console.log(`✅ Sesión guardada en Redis: ${sessionKey}`);
            } catch (err) {
                console.error('❌ Error al guardar sesión en Redis:', err);
                // No bloqueamos el login si Redis falla, pero registramos
            }
            // 2. Procesar foto de perfil (si existe)
            let fotoPerfil = null;
            if (user.fotoPerfil) {
                const buffer = Buffer.from(user.fotoPerfil);
                const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
                const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
                const mime = isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : 'image/jpeg');
                fotoPerfil = `data:${mime};base64,${buffer.toString('base64')}`;
            }

            // 3. Obtener permisos del rol
            const [permisosRows] = await db.query(
                `SELECT subModulo, ver, insertar, editar, eliminar
                FROM PermisoSubModulo
                WHERE idRol = ?`,
                [user.idRol]
            );

            // Construir objeto de permisos para el frontend
            const permisos = permisosRows.reduce((acc, p) => {
                acc[p.subModulo] = {
                    ver: p.ver === 1,
                    insertar: p.insertar === 1,
                    editar: p.editar === 1,
                    eliminar: p.eliminar === 1
                };
                return acc;
            }, {});

            // 4. Responder con todos los datos
            return res.status(200).json({
                exito: true,
                idUsuario: user.idUsuario,
                username: user.username,
                idRol: user.idRol,
                rolNombre: user.rolNombre,
                fotoPerfil,
                permisos
            });
        }
    } catch (error) {
        console.error("Error en /api/login:", error);
        return res.status(500).json({ exito: false, error: "Error crítico de servidor interno." });
    }
});
// ==========================================
// LOGOUT - Eliminar sesión de Redis
// ==========================================
app.post('/api/logout', async (req, res) => {
    const { idUsuario } = req.body;
    if (!idUsuario) {
        return res.status(400).json({ exito: false, error: "ID de usuario requerido." });
    }

    const sessionKey = `session:${idUsuario}`;
    try {
        await del(sessionKey);
        console.log(`✅ Sesión eliminada de Redis: ${sessionKey}`);
        res.json({ exito: true, mensaje: "Sesión cerrada correctamente." });
    } catch (err) {
        console.error('❌ Error al eliminar sesión en Redis:', err);
        res.status(500).json({ exito: false, error: "Error al cerrar sesión." });
    }
});
// ==========================================
// RUTAS DE LA API
// api
// ==========================================
app.use('/api/admin', administracionRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/ventas', require('./routes/ventas.routes'));
// En server.js, después de las importaciones
process.env.TZ = 'America/La_Paz';
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor maestro modular corriendo en: http://localhost:${PORT}`);
});