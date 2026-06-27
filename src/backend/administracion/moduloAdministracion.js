// src/backend/administracion/moduloAdministracion.js
const upload = require('../common/upload');
const db = require('../common/conexion');
const bcrypt = require('bcrypt');

const moduloAdministracion = {

    // ============================================================
    // CASO DE USO: GESTIONAR MENÚ
    // ============================================================
    crearPlato: async (req, res) => {
        const { nombrePlato, precioActual, idCategoria, descripcion } = req.body;
        
        // Validaciones básicas
        if (!nombrePlato || !precioActual || !idCategoria) {
            return res.status(400).json({ exito: false, error: "Faltan campos obligatorios (*)" });
        }
        if (nombrePlato.length > 100) {
            return res.status(400).json({ exito: false, error: "El nombre no puede superar 100 caracteres." });
        }
        if (descripcion && descripcion.length > 500) {
            return res.status(400).json({ exito: false, error: "La descripción no puede superar 500 caracteres." });
        }

        // Construir URL de la imagen si se subió
        let imagen_url = null;
        if (req.file) {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            imagen_url = `${baseUrl}/uploads/menu/${req.file.filename}`;
        }

        try {
            const [result] = await db.query(
                `INSERT INTO Menu (idCategoria, nombrePlato, descripcion, precioActual, imagen_url) 
                VALUES (?, ?, ?, ?, ?)`,
                [idCategoria, nombrePlato, descripcion || null, precioActual, imagen_url]
            );
            res.status(200).json({ exito: true, idMenu: result.insertId, mensaje: `Plato registrado con ID: ${result.insertId}` });
        } catch (error) {
            console.error("Error al crear plato:", error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ exito: false, error: "Ya existe un plato con ese nombre." });
            }
            res.status(500).json({ exito: false, error: "Error interno al guardar el plato" });
        }
    },
    obtenerMenu: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT m.idMenu, m.nombrePlato, m.precioActual, m.descripcion, m.idCategoria, m.imagen_url,
                       COALESCE(c.nombreCategoria, 'Sin categoría') AS nombreCategoria
                FROM Menu m
                LEFT JOIN CategoriaMenu c ON m.idCategoria = c.idCategoria
                ORDER BY m.idMenu DESC
            `);
            res.json(rows);
        } catch (error) {
            console.error("Error al obtener menú:", error);
            res.status(500).json({ error: "Error al consultar la base de datos" });
        }
    },

    actualizarPlato: async (req, res) => {
        const { idMenu } = req.params;
        const { nombrePlato, precioActual, idCategoria, descripcion } = req.body;

        // Validaciones básicas
        if (!nombrePlato || !precioActual || !idCategoria) {
            return res.status(400).json({ exito: false, error: "Faltan campos obligatorios (*)" });
        }

        try {
            // Obtener la imagen actual para conservarla si no se sube nueva
            const [current] = await db.query("SELECT imagen_url FROM Menu WHERE idMenu = ?", [idMenu]);
            let imagen_url = current.length > 0 ? current[0].imagen_url : null;

            // Si se subió nueva imagen, actualizar ruta
            if (req.file) {
                const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
                imagen_url = `${baseUrl}/uploads/menu/${req.file.filename}`;
            }

            const [result] = await db.query(
                `UPDATE Menu SET idCategoria=?, nombrePlato=?, descripcion=?, precioActual=?, imagen_url=? 
                WHERE idMenu=?`,
                [idCategoria, nombrePlato, descripcion || null, precioActual, imagen_url, idMenu]
            );
            if (result.affectedRows > 0) {
                res.json({ exito: true, mensaje: "Producto actualizado correctamente." });
            } else {
                res.status(404).json({ exito: false, error: "Ítem no encontrado." });
            }
        } catch (error) {
            console.error("Error al actualizar plato:", error);
            res.status(500).json({ exito: false, error: "Error interno al actualizar" });
        }
    },
    // ✅ Baja lógica primero; si tiene FK devuelve mensaje claro al usuario
    eliminarPlato: async (req, res) => {
        const { idMenu } = req.params;
        try {
            await db.query('DELETE FROM Menu WHERE idMenu = ?', [idMenu]);
            res.json({ exito: true, mensaje: "Producto eliminado correctamente." });
        } catch (error) {
            console.error("Error al eliminar plato:", error);
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: el plato ya está registrado en comandas históricas. Considere desactivarlo en su lugar." });
            res.status(500).json({ exito: false, error: "No se pudo eliminar el producto" });
        }
    },

    obtenerCategorias: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idCategoria, nombreCategoria FROM CategoriaMenu');
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: "Error al consultar categorías" });
        }
    },

    // ============================================================
    // CASO DE USO: CIERRE DE CAJA
    // ============================================================

    obtenerResumenDia: async (req, res) => {
        try {
            const fechaHoy = new Date().toISOString().split('T')[0];
            const [rows] = await db.query(`
                SELECT COALESCE(SUM(montoTotal), 0) AS totalCalculado
                FROM Factura f
                JOIN Pedido p ON f.idPedido = p.idPedido
                WHERE DATE(f.fechaEmision) = ? AND f.estadoFactura = 'Vigente'
            `, [fechaHoy]);
            res.json({ totalCalculado: rows[0].totalCalculado, fecha: fechaHoy });
        } catch (error) {
            res.status(500).json({ error: "Error interno al consultar resumen diario" });
        }
    },

    ejecutarCierreCaja: async (req, res) => {
        const { idEmpleado, fecha, montoReal } = req.body;
        try {
            await db.query(`CALL sp_CerrarCaja(?, ?, ?, @desfase)`, [idEmpleado, fecha, montoReal]);
            const [rows] = await db.query(`SELECT @desfase AS resultadoDesfase`);
            res.json({ mensaje: "Cierre de caja exitoso.", desfase: rows[0].resultadoDesfase });
        } catch (error) {
            res.status(400).json({ error: error.message || "Error al ejecutar el cierre" });
        }
    },

    // ============================================================
    // CLIENTES
    // ============================================================

    obtenerClientePorId: async (req, res) => {
        const { idCliente } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT idCliente, primerNombre, segundoNombre, primerApellido, segundoApellido,
                    email, telefono, nitCi, fechaRegistro
                FROM Cliente
                WHERE idCliente = ?
            `, [idCliente]);
            if (rows.length === 0) {
                return res.status(404).json({ error: "Cliente no encontrado." });
            }
            res.json(rows[0]);
        } catch (error) {
            console.error('obtenerClientePorId:', error);
            res.status(500).json({ error: "Error al obtener el cliente." });
        }
    },

    // ============================================================
    // CASO DE USO: GESTIONAR USUARIOS
    // ============================================================

    obtenerRolesYPuestos: async (req, res) => {
        try {
            const [roles]   = await db.query('SELECT idRol, nombreRol FROM Rol');
            const [puestos] = await db.query('SELECT idPuesto, nombrePuesto FROM Puesto');
            res.json({ roles, puestos });
        } catch (error) {
            res.status(500).json({ error: "Error al cargar catálogos de RRHH" });
        }
    },

    listarUsuarios: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT e.idEmpleado, e.ci, e.primerNombre, e.primerApellido, e.estado,
                       u.username, u.ultimoLogin, r.nombreRol, p.nombrePuesto,
                       CASE WHEN e.fotoPerfil IS NOT NULL THEN 1 ELSE 0 END AS tieneFotoPerfil
                FROM Empleado e
                JOIN Usuario u ON e.idUsuario = u.idUsuario
                JOIN Rol r     ON e.idRol = r.idRol
                JOIN Puesto p  ON e.idPuesto = p.idPuesto
                ORDER BY e.primerNombre ASC
            `);
            res.json(rows);
        } catch (error) {
            console.error("Error en listarUsuarios:", error);
            res.status(500).json({ error: "Error al obtener la lista de personal" });
        }
    },

    obtenerUsuario: async (req, res) => {
        const { idEmpleado } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT e.idEmpleado, e.ci, e.primerNombre, e.segundoNombre, e.primerApellido, e.segundoApellido, passwordHash,
                       e.edad, e.fechaContratacion, e.estado, e.idRol, e.idPuesto,
                       u.username,
                       CASE WHEN e.fotoPerfil IS NOT NULL THEN TO_BASE64(e.fotoPerfil) ELSE NULL END AS fotoPerfil,
                       CASE WHEN u.passwordHash IS NOT NULL THEN 1 ELSE 0 END AS tienePassword
                FROM Empleado e
                JOIN Usuario u ON e.idUsuario = u.idUsuario
                WHERE e.idEmpleado = ?
            `, [idEmpleado]);
            if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado." });
            res.json(rows[0]);
        } catch (error) {
            console.error("Error en obtenerUsuario:", error);
            res.status(500).json({ error: "Error al obtener el usuario." });
        }
    },

    actualizarUsuario: async (req, res) => {
        const { idEmpleado } = req.params;
        const { primerNombre, segundoNombre, primerApellido, segundoApellido,
                ci, edad, fechaContratacion, idPuesto, idRol, username, password, fotoPerfil, estado } = req.body;

        // Validaciones existentes (no las modificamos)
        if (!primerNombre || primerNombre.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer nombre es obligatorio (mínimo 2 caracteres)." });
        if (!primerApellido || primerApellido.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer apellido es obligatorio." });
        if (!ci || ci.trim().length < 5)
            return res.status(400).json({ exito: false, error: "El CI debe tener al menos 5 caracteres." });
        if (!fechaContratacion)
            return res.status(400).json({ exito: false, error: "La fecha de contratación es obligatoria." });
        if (!idPuesto)
            return res.status(400).json({ exito: false, error: "El puesto es obligatorio." });
        if (!idRol)
            return res.status(400).json({ exito: false, error: "El rol es obligatorio." });
        if (!username || username.trim().length < 3)
            return res.status(400).json({ exito: false, error: "El nombre de usuario debe tener al menos 3 caracteres." });

        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            // Obtener idUsuario actual
            const [empleadoRows] = await conexion.query('SELECT idUsuario, ci FROM Empleado WHERE idEmpleado = ?', [idEmpleado]);
            if (empleadoRows.length === 0) throw new Error("Empleado no encontrado.");

            const { idUsuario, ci: ciActual } = empleadoRows[0];
            if (ci.trim() !== (ciActual || '').toString()) {
                const [ciExist] = await conexion.query('SELECT idEmpleado FROM Empleado WHERE ci = ? AND idEmpleado != ?', [ci.trim(), idEmpleado]);
                if (ciExist.length > 0) throw new Error("El Carnet de Identidad ya está registrado.");
            }

            const [userExist] = await conexion.query('SELECT idUsuario FROM Usuario WHERE username = ? AND idUsuario != ?', [username.trim(), idUsuario]);
            if (userExist.length > 0) throw new Error("El username ya está en uso.");

            if (password && password.length > 0) {
                const hash = await bcrypt.hash(password, 10);
                await conexion.query('UPDATE Usuario SET username = ?, passwordHash = ? WHERE idUsuario = ?', [username.trim(), hash, idUsuario]);
            } else {
                await conexion.query('UPDATE Usuario SET username = ? WHERE idUsuario = ?', [username.trim(), idUsuario]);
            }

            const fotoBuffer = fotoPerfil ? Buffer.from(fotoPerfil, 'base64') : null;
            // ✅ NUEVO: agregamos estado al SET
            await conexion.query(
                `UPDATE Empleado SET 
                    primerNombre = ?, segundoNombre = ?, primerApellido = ?, segundoApellido = ?,
                    ci = ?, fechaContratacion = ?, idPuesto = ?, idRol = ?, edad = ?,
                    estado = COALESCE(?, estado),  -- <--- Actualiza estado si se envía
                    fotoPerfil = CASE WHEN ? IS NOT NULL THEN ? ELSE fotoPerfil END
                WHERE idEmpleado = ?`,
                [primerNombre.trim(), segundoNombre?.trim() || null, primerApellido.trim(), segundoApellido?.trim() || null,
                ci.trim(), fechaContratacion, idPuesto, idRol, edad,
                estado, // <--- nuevo campo
                fotoBuffer, fotoBuffer, idEmpleado]
            );

            await conexion.commit();
            res.json({ exito: true, mensaje: "Usuario actualizado correctamente." });
        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error("Error actualizarUsuario:", error);
            let message = error.message || "Error al actualizar el usuario.";
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.sqlMessage && error.sqlMessage.includes('username')) {
                    message = 'El username ya está en uso.';
                } else if (error.sqlMessage && error.sqlMessage.includes('ci')) {
                    message = 'El CI ya está registrado.';
                }
            }
            res.status(400).json({ exito: false, error: message });
        } finally {
            if (conexion) conexion.release();
        }
    },

    crearUsuario: async (req, res) => {
        const { primerNombre, segundoNombre, primerApellido, segundoApellido,
                ci, edad, fechaContratacion, idPuesto, idRol, username, password, fotoPerfil } = req.body;
        if (!primerNombre || primerNombre.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer nombre es obligatorio (mínimo 2 caracteres)." });
        if (!primerApellido || primerApellido.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer apellido es obligatorio." });
        if (!ci || ci.trim().length < 5)
            return res.status(400).json({ exito: false, error: "El CI debe tener al menos 5 caracteres." });
        if (!fechaContratacion)
            return res.status(400).json({ exito: false, error: "La fecha de contratación es obligatoria." });
        if (!idPuesto)
            return res.status(400).json({ exito: false, error: "El puesto es obligatorio." });
        if (!idRol)
            return res.status(400).json({ exito: false, error: "El rol es obligatorio." });
        if (!username || username.trim().length < 3)
            return res.status(400).json({ exito: false, error: "El nombre de usuario debe tener al menos 3 caracteres." });
        if (!password || password.length < 6)
            return res.status(400).json({ exito: false, error: "La contraseña debe tener al menos 6 caracteres." });

        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            const [userExist] = await conexion.query('SELECT idUsuario FROM Usuario WHERE username = ?', [username]);
            if (userExist.length > 0) throw new Error("El username ya está en uso.");

            const [ciExist] = await conexion.query('SELECT idEmpleado FROM Empleado WHERE ci = ?', [ci]);
            if (ciExist.length > 0) throw new Error("El Carnet de Identidad ya está registrado.");

            const hash = await bcrypt.hash(password, 10);
            const [resUsuario] = await conexion.query(
                'INSERT INTO Usuario (username, passwordHash) VALUES (?, ?)', [username, hash]
            );

            const fotoBuffer = fotoPerfil ? Buffer.from(fotoPerfil, 'base64') : null;
            await conexion.query(
                `INSERT INTO Empleado (idUsuario, primerNombre, segundoNombre, primerApellido, segundoApellido,
                 ci, fechaContratacion, estado, idPuesto, idRol, edad, fotoPerfil)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo', ?, ?, ?, ?)`,
                [resUsuario.insertId, primerNombre.trim(), segundoNombre?.trim() || null, primerApellido.trim(),
                 segundoApellido?.trim() || null, ci.trim(), fechaContratacion, idPuesto, idRol, edad, fotoBuffer]
            );
            await conexion.commit();
            res.status(201).json({ exito: true, mensaje: "Personal registrado correctamente." });
        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error("Error crearUsuario:", error);
            let message = error.message || "Error al registrar.";
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.sqlMessage && error.sqlMessage.includes('username')) {
                    message = 'El username ya está en uso.';
                } else if (error.sqlMessage && error.sqlMessage.includes('ci')) {
                    message = 'El CI ya está registrado.';
                }
            }
            res.status(400).json({ exito: false, error: message });
        } finally {
            if (conexion) conexion.release();
        }
    },

    // Baja lógica: cambia estado a Inactivo
    eliminarUsuario: async (req, res) => {
        const { idEmpleado } = req.params;
        try {
            await db.query("UPDATE Empleado SET estado = 'Inactivo' WHERE idEmpleado = ?", [idEmpleado]);
            res.json({ exito: true, mensaje: "Empleado dado de baja exitosamente." });
        } catch (error) {
            res.status(500).json({ exito: false, error: "Error al cambiar el estado del empleado." });
        }
    },

    // ✅ Eliminación física: borra Usuario y Empleado en transacción
    eliminarUsuarioTotal: async (req, res) => {
        const { idEmpleado } = req.params;
        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            // Obtener idUsuario vinculado
            const [rows] = await conexion.query(
                'SELECT idUsuario FROM Empleado WHERE idEmpleado = ?', [idEmpleado]
            );
            if (rows.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ exito: false, error: "Empleado no encontrado." });
            }
            const idUsuario = rows[0].idUsuario;

            // Borrar Empleado primero (FK), luego Usuario
            await conexion.query('DELETE FROM Empleado WHERE idEmpleado = ?', [idEmpleado]);
            await conexion.query('DELETE FROM Usuario WHERE idUsuario = ?', [idUsuario]);

            await conexion.commit();
            res.json({ exito: true, mensaje: "Usuario eliminado permanentemente." });
        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error("Error eliminarUsuarioTotal:", error);
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: el empleado tiene pedidos o turnos registrados. Use 'Dar de baja' en su lugar." });
            res.status(500).json({ exito: false, error: "Error interno al eliminar." });
        } finally {
            if (conexion) conexion.release();
        }
    },

    // ============================================================
    // CASO DE USO: GESTIONAR MESAS
    // ============================================================

    obtenerMesas: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idMesa, numeroMesa, capacidad, estado FROM Mesa ORDER BY numeroMesa ASC');
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener mesas" }); }
    },
    crearMesa: async (req, res) => {
        const { numeroMesa, capacidad, estado } = req.body;
        try {
            await db.query('INSERT INTO Mesa (numeroMesa, capacidad, estado) VALUES (?, ?, ?)', [numeroMesa, capacidad, estado]);
            res.json({ exito: true, mensaje: 'Mesa registrada correctamente' });
        } catch (error) { res.status(400).json({ error: "Error al crear mesa" }); }
    },
    actualizarMesa: async (req, res) => {
        const { idMesa } = req.params;
        const { numeroMesa, capacidad, estado } = req.body;
        try {
            await db.query('UPDATE Mesa SET numeroMesa=?, capacidad=?, estado=? WHERE idMesa=?', [numeroMesa, capacidad, estado, idMesa]);
            res.json({ exito: true, mensaje: 'Mesa actualizada correctamente' });
        } catch (error) { res.status(400).json({ error: "Error al actualizar mesa" }); }
    },
    eliminarMesa: async (req, res) => {
        try {
            await db.query('DELETE FROM Mesa WHERE idMesa = ?', [req.params.idMesa]);
            res.json({ exito: true, mensaje: 'Mesa eliminada' });
        } catch (error) { res.status(400).json({ error: "No se puede eliminar la mesa por dependencias" }); }
    },

    // ============================================================
    // CASO DE USO: TURNOS DE LIMPIEZA
    // ============================================================

    obtenerAreasLimpieza: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idArea, nombreArea FROM AreaLimpieza');
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al cargar áreas" }); }
    },
    obtenerEmpleadosActivos: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT e.idEmpleado, e.primerNombre, e.primerApellido, p.nombrePuesto
                FROM Empleado e
                JOIN Puesto p ON e.idPuesto = p.idPuesto
                WHERE e.estado = 'Activo'
            `);
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al cargar empleados" }); }
    },
    obtenerTurnosLimpieza: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT t.idTurno, t.idEmpleado, t.idArea, t.diaSemana, t.horaInicio, t.horaFin,
                       t.completado, t.observaciones,
                       CONCAT(e.primerNombre, ' ', e.primerApellido) AS empleado,
                       a.nombreArea
                FROM TurnoLimpieza t
                JOIN Empleado e    ON t.idEmpleado = e.idEmpleado
                JOIN AreaLimpieza a ON t.idArea = a.idArea
                ORDER BY t.diaSemana, t.horaInicio
            `);
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener turnos" }); }
    },
    crearTurnoLimpieza: async (req, res) => {
        const { idEmpleado, idArea, diaSemana, horaInicio, horaFin, observaciones } = req.body;
        try {
            await db.query(
                'INSERT INTO TurnoLimpieza (idEmpleado, idArea, diaSemana, horaInicio, horaFin, completado, observaciones) VALUES (?, ?, ?, ?, ?, FALSE, ?)',
                [idEmpleado, idArea, diaSemana, horaInicio, horaFin, observaciones || null]
            );
            res.json({ exito: true, mensaje: "Turno asignado correctamente" });
        } catch (error) { res.status(400).json({ error: "Error al guardar el turno" }); }
    },
    actualizarTurnoLimpieza: async (req, res) => {
        const { idTurno } = req.params;
        const { idEmpleado, idArea, diaSemana, horaInicio, horaFin, observaciones } = req.body;
        try {
            await db.query(
                'UPDATE TurnoLimpieza SET idEmpleado=?, idArea=?, diaSemana=?, horaInicio=?, horaFin=?, observaciones=? WHERE idTurno=?',
                [idEmpleado, idArea, diaSemana, horaInicio, horaFin, observaciones || null, idTurno]
            );
            res.json({ exito: true, mensaje: "Turno actualizado" });
        } catch (error) { res.status(400).json({ error: "Error al actualizar turno" }); }
    },
    eliminarTurnoLimpieza: async (req, res) => {
        try {
            await db.query('DELETE FROM TurnoLimpieza WHERE idTurno = ?', [req.params.idTurno]);
            res.json({ exito: true, mensaje: "Turno eliminado" });
        } catch (error) { res.status(500).json({ error: "Error al eliminar turno" }); }
    },

    // ============================================================
    // ✅ CASO DE USO: GESTIONAR ROLES (CRUD completo)
    // ============================================================

    obtenerRoles: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idRol, nombreRol FROM Rol ORDER BY idRol ASC');
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener roles" }); }
    },
    crearRol: async (req, res) => {
        const { nombreRol } = req.body;
        if (!nombreRol || nombreRol.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del rol es obligatorio." });
        try {
            const [result] = await db.query('INSERT INTO Rol (nombreRol) VALUES (?)', [nombreRol.trim()]);
            res.status(201).json({ exito: true, idRol: result.insertId, mensaje: "Rol creado correctamente." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un rol con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear el rol." });
        }
    },
    actualizarRol: async (req, res) => {
        const { idRol } = req.params;
        const { nombreRol } = req.body;
        if (!nombreRol || nombreRol.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del rol es obligatorio." });
        try {
            const [result] = await db.query('UPDATE Rol SET nombreRol = ? WHERE idRol = ?', [nombreRol.trim(), idRol]);
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Rol no encontrado." });
            res.json({ exito: true, mensaje: "Rol actualizado correctamente." });
        } catch (error) { res.status(500).json({ exito: false, error: "Error al actualizar el rol." }); }
    },
    eliminarRol: async (req, res) => {
        const { idRol } = req.params;
        try {
            await db.query('DELETE FROM Rol WHERE idRol = ?', [idRol]);
            res.json({ exito: true, mensaje: "Rol eliminado correctamente." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: hay usuarios asignados a este rol." });
            res.status(500).json({ exito: false, error: "Error al eliminar el rol." });
        }
    },

    // ============================================================
    // ✅ CASO DE USO: GESTIONAR MÉTODOS DE PAGO (CRUD completo)
    // ============================================================

    obtenerMetodosPago: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idMetodoPago, nombreMetodo, qr_url FROM MetodoPago ORDER BY idMetodoPago ASC');
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener métodos de pago" }); }
    },
    crearMetodoPago: async (req, res) => {
        const { nombreMetodo, qrUrl } = req.body;
        if (!nombreMetodo || nombreMetodo.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del método es obligatorio." });
        try {
            const [result] = await db.query(
                'INSERT INTO MetodoPago (nombreMetodo, qr_url) VALUES (?, ?)',
                [nombreMetodo.trim(), qrUrl || null]
            );
            res.status(201).json({ exito: true, idMetodoPago: result.insertId, mensaje: "Método de pago creado." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un método con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear el método de pago." });
        }
    },
    actualizarMetodoPago: async (req, res) => {
        const { idMetodo } = req.params;
        const { nombreMetodo, qrUrl } = req.body;
        if (!nombreMetodo || nombreMetodo.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del método es obligatorio." });
        try {
            const [result] = await db.query(
                'UPDATE MetodoPago SET nombreMetodo = ?, qr_url = ? WHERE idMetodoPago = ?',
                [nombreMetodo.trim(), qrUrl || null, idMetodo]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Método de pago no encontrado." });
            res.json({ exito: true, mensaje: "Método de pago actualizado." });
        } catch (error) { res.status(500).json({ exito: false, error: "Error al actualizar." }); }
    },
    eliminarMetodoPago: async (req, res) => {
        const { idMetodo } = req.params;
        try {
            await db.query('DELETE FROM MetodoPago WHERE idMetodoPago = ?', [idMetodo]);
            res.json({ exito: true, mensaje: "Método de pago eliminado." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: hay facturas registradas con este método." });
            res.status(500).json({ exito: false, error: "Error al eliminar." });
        }
    },
    // === CRUD INGREDIENTES ===
    listarIngredientes: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT i.idIngrediente, i.nombreIngrediente, i.unidadMedida,
                    i.stockActual, i.stockMinimo, i.precioActualCompra,
                    p.nombreProveedor
                FROM Ingrediente i
                LEFT JOIN Proveedor p ON i.idProveedor = p.idProveedor
                ORDER BY i.nombreIngrediente ASC
            `);
            res.json(rows);
        } catch (error) {
            console.error('listarIngredientes:', error);
            res.status(500).json({ error: "Error al obtener ingredientes" });
        }
    },
    crearIngrediente: async (req, res) => {
        const { nombreIngrediente, unidadMedida, stockActual, stockMinimo, precioActualCompra } = req.body;
        if (!nombreIngrediente || !unidadMedida || precioActualCompra === undefined)
            return res.status(400).json({ exito: false, error: "Faltan campos obligatorios." });
        try {
            const [result] = await db.query(
                `INSERT INTO Ingrediente (nombreIngrediente, unidadMedida, stockActual, stockMinimo, precioActualCompra)
                 VALUES (?, ?, ?, ?, ?)`,
                [nombreIngrediente.trim(), unidadMedida, stockActual || 0, stockMinimo, precioActualCompra]
            );
            // Insertar precio inicial en historial
            await db.query(
                `INSERT INTO PrecioHistoricoIngrediente (idIngrediente, precioUnitario, fechaInicio)
                 VALUES (?, ?, NOW())`,
                [result.insertId, precioActualCompra]
            );
            res.status(201).json({ exito: true, idIngrediente: result.insertId, mensaje: "Ingrediente creado." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un ingrediente con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear ingrediente." });
        }
    },
 
    actualizarIngrediente: async (req, res) => {
        const { idIngrediente } = req.params;
        const { nombreIngrediente, unidadMedida, stockActual, stockMinimo, precioActualCompra } = req.body;
        if (!nombreIngrediente || !unidadMedida)
            return res.status(400).json({ exito: false, error: "Faltan campos obligatorios." });
        try {
            // El trigger tr_historial_precio_ingrediente registra automáticamente el cambio de precio
            const [result] = await db.query(
                `UPDATE Ingrediente
                 SET nombreIngrediente=?, unidadMedida=?, stockActual=?, stockMinimo=?, precioActualCompra=?
                 WHERE idIngrediente=?`,
                [nombreIngrediente.trim(), unidadMedida, stockActual, stockMinimo, precioActualCompra, idIngrediente]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Ingrediente no encontrado." });
            res.json({ exito: true, mensaje: "Ingrediente actualizado. Historial de precio registrado automáticamente." });
        } catch (error) {
            console.error('actualizarIngrediente:', error);
            res.status(500).json({ exito: false, error: "Error al actualizar ingrediente." });
        }
    },
 
    eliminarIngrediente: async (req, res) => {
        const { idIngrediente } = req.params;
        try {
            await db.query('DELETE FROM Ingrediente WHERE idIngrediente = ?', [idIngrediente]);
            res.json({ exito: true, mensaje: "Ingrediente eliminado." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({
                    exito: false,
                    error: "No se puede eliminar: el ingrediente está vinculado a platos del menú."
                });
            res.status(500).json({ exito: false, error: "Error al eliminar ingrediente." });
        }
    },
    // ============================================================
    // CRUD CATEGORÍAS DE MENÚ
    // ============================================================
    crearCategoria: async (req, res) => {
        const { nombreCategoria } = req.body;
        if (!nombreCategoria || nombreCategoria.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre debe tener al menos 2 caracteres." });
        try {
            const [result] = await db.query(
                'INSERT INTO CategoriaMenu (nombreCategoria) VALUES (?)', [nombreCategoria.trim()]
            );
            res.status(201).json({ exito: true, idCategoria: result.insertId, mensaje: "Categoría creada." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe una categoría con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear categoría." });
        }
    },
    actualizarCategoria: async (req, res) => {
        const { idCategoria } = req.params;
        const { nombreCategoria } = req.body;
        if (!nombreCategoria || nombreCategoria.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre debe tener al menos 2 caracteres." });
        try {
            const [result] = await db.query(
                'UPDATE CategoriaMenu SET nombreCategoria = ? WHERE idCategoria = ?',
                [nombreCategoria.trim(), idCategoria]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Categoría no encontrada." });
            res.json({ exito: true, mensaje: "Categoría actualizada." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe una categoría con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al actualizar." });
        }
    },
    eliminarCategoria: async (req, res) => {
        const { idCategoria } = req.params;
        try {
            await db.query('DELETE FROM CategoriaMenu WHERE idCategoria = ?', [idCategoria]);
            res.json({ exito: true, mensaje: "Categoría eliminada." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: hay platos del menú con esta categoría." });
            res.status(500).json({ exito: false, error: "Error al eliminar." });
        }
    },
 
    // ============================================================
    // CRUD CLIENTES
    // ============================================================
    listarClientes: async (req, res) => {
        try {
            const { buscar } = req.query;
            let sql = `SELECT idCliente, primerNombre, segundoNombre, primerApellido,
                              segundoApellido, email, telefono, nitCi, fechaRegistro
                       FROM Cliente`;
            const params = [];
            if (buscar && buscar.trim()) {
                sql += ` WHERE nitCi LIKE ? OR primerNombre LIKE ? OR primerApellido LIKE ? OR email LIKE ?`;
                const like = `%${buscar.trim()}%`;
                params.push(like, like, like, like);
            }
            sql += ' ORDER BY primerNombre ASC';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('listarClientes:', error);
            res.status(500).json({ error: "Error al obtener clientes." });
        }
    },
    crearCliente: async (req, res) => {
        const { primerNombre, segundoNombre, primerApellido, segundoApellido,
                email, telefono, nitCi } = req.body;
        if (!primerNombre || primerNombre.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer nombre es obligatorio (mín. 2 caracteres)." });
        if (!primerApellido || primerApellido.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer apellido es obligatorio." });
        if (!email || !email.includes('@'))
            return res.status(400).json({ exito: false, error: "El email es obligatorio y debe ser válido." });
        try {
            const [result] = await db.query(
                `INSERT INTO Cliente (primerNombre, segundoNombre, primerApellido, segundoApellido, email, telefono, nitCi)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [primerNombre.trim(), segundoNombre?.trim() || null, primerApellido.trim(),
                 segundoApellido?.trim() || null, email.trim(), telefono?.trim() || null, nitCi?.trim() || null]
            );
            res.status(201).json({ exito: true, idCliente: result.insertId, mensaje: "Cliente registrado." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                const campo = error.sqlMessage?.includes('email') ? 'email' : 'NIT/CI';
                return res.status(400).json({ exito: false, error: `Ya existe un cliente con ese ${campo}.` });
            }
            res.status(500).json({ exito: false, error: "Error al crear cliente." });
        }
    },
    actualizarCliente: async (req, res) => {
        const { idCliente } = req.params;
        const { primerNombre, segundoNombre, primerApellido, segundoApellido,
                email, telefono, nitCi } = req.body;
        if (!primerNombre || primerNombre.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El primer nombre es obligatorio." });
        if (!email || !email.includes('@'))
            return res.status(400).json({ exito: false, error: "El email es obligatorio y debe ser válido." });
        try {
            const [result] = await db.query(
                `UPDATE Cliente SET primerNombre=?, segundoNombre=?, primerApellido=?,
                 segundoApellido=?, email=?, telefono=?, nitCi=? WHERE idCliente=?`,
                [primerNombre.trim(), segundoNombre?.trim() || null, primerApellido.trim(),
                 segundoApellido?.trim() || null, email.trim(), telefono?.trim() || null,
                 nitCi?.trim() || null, idCliente]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Cliente no encontrado." });
            res.json({ exito: true, mensaje: "Cliente actualizado." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                const campo = error.sqlMessage?.includes('email') ? 'email' : 'NIT/CI';
                return res.status(400).json({ exito: false, error: `Ya existe un cliente con ese ${campo}.` });
            }
            res.status(500).json({ exito: false, error: "Error al actualizar cliente." });
        }
    },
    eliminarCliente: async (req, res) => {
        const { idCliente } = req.params;
        try {
            await db.query('DELETE FROM Cliente WHERE idCliente = ?', [idCliente]);
            res.json({ exito: true, mensaje: "Cliente eliminado." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: el cliente tiene pedidos registrados." });
            res.status(500).json({ exito: false, error: "Error al eliminar cliente." });
        }
    },
 
    // ============================================================
    // CRUD PUESTOS LABORALES
    // ============================================================
    listarPuestos: async (req, res) => {
        try {
            const [rows] = await db.query('SELECT idPuesto, nombrePuesto, salarioBase FROM Puesto ORDER BY nombrePuesto ASC');
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener puestos." }); }
    },
    crearPuesto: async (req, res) => {
        const { nombrePuesto, salarioBase } = req.body;
        if (!nombrePuesto || nombrePuesto.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del puesto es obligatorio (mín. 2 caracteres)." });
        if (!salarioBase || isNaN(salarioBase) || parseFloat(salarioBase) < 0)
            return res.status(400).json({ exito: false, error: "El salario base debe ser un número positivo." });
        try {
            const [result] = await db.query(
                'INSERT INTO Puesto (nombrePuesto, salarioBase) VALUES (?, ?)',
                [nombrePuesto.trim(), parseFloat(salarioBase)]
            );
            res.status(201).json({ exito: true, idPuesto: result.insertId, mensaje: "Puesto creado." });
        } catch (error) {
            res.status(500).json({ exito: false, error: "Error al crear puesto." });
        }
    },
    actualizarPuesto: async (req, res) => {
        const { idPuesto } = req.params;
        const { nombrePuesto, salarioBase } = req.body;
        if (!nombrePuesto || nombrePuesto.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del puesto es obligatorio." });
        if (!salarioBase || isNaN(salarioBase) || parseFloat(salarioBase) < 0)
            return res.status(400).json({ exito: false, error: "El salario base debe ser un número positivo." });
        try {
            const [result] = await db.query(
                'UPDATE Puesto SET nombrePuesto = ?, salarioBase = ? WHERE idPuesto = ?',
                [nombrePuesto.trim(), parseFloat(salarioBase), idPuesto]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Puesto no encontrado." });
            res.json({ exito: true, mensaje: "Puesto actualizado." });
        } catch (error) { res.status(500).json({ exito: false, error: "Error al actualizar puesto." }); }
    },
    eliminarPuesto: async (req, res) => {
        const { idPuesto } = req.params;
        try {
            await db.query('DELETE FROM Puesto WHERE idPuesto = ?', [idPuesto]);
            res.json({ exito: true, mensaje: "Puesto eliminado." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: hay empleados asignados a este puesto." });
            res.status(500).json({ exito: false, error: "Error al eliminar puesto." });
        }
    },
 
    // ============================================================
    // CRUD ÁREAS DE LIMPIEZA
    // ============================================================
    crearAreaLimpieza: async (req, res) => {
        const { nombreArea } = req.body;
        if (!nombreArea || nombreArea.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del área es obligatorio (mín. 2 caracteres)." });
        try {
            const [result] = await db.query(
                'INSERT INTO AreaLimpieza (nombreArea) VALUES (?)', [nombreArea.trim()]
            );
            res.status(201).json({ exito: true, idArea: result.insertId, mensaje: "Área creada." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un área con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear área." });
        }
    },
    actualizarAreaLimpieza: async (req, res) => {
        const { idArea } = req.params;
        const { nombreArea } = req.body;
        if (!nombreArea || nombreArea.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre es obligatorio." });
        try {
            const [result] = await db.query(
                'UPDATE AreaLimpieza SET nombreArea = ? WHERE idArea = ?', [nombreArea.trim(), idArea]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Área no encontrada." });
            res.json({ exito: true, mensaje: "Área actualizada." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un área con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al actualizar." });
        }
    },
    eliminarAreaLimpieza: async (req, res) => {
        const { idArea } = req.params;
        try {
            await db.query('DELETE FROM AreaLimpieza WHERE idArea = ?', [idArea]);
            res.json({ exito: true, mensaje: "Área eliminada." });
        } catch (error) {
            if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2')
                return res.status(400).json({ exito: false, error: "No se puede eliminar: hay turnos asignados a esta área." });
            res.status(500).json({ exito: false, error: "Error al eliminar área." });
        }
    },
 
    // ============================================================
    // FACTURAS — historial y anulación
    // ============================================================
    listarFacturas: async (req, res) => {
        try {
            const { desde, hasta, estado, idMetodoPago } = req.query;
            let sql = `
                SELECT f.idFactura, f.nroFactura, f.fechaEmision, f.montoTotal, f.estadoFactura,
                       mp.nombreMetodo, tp.nombreTipo,
                       COALESCE(m.numeroMesa, p.nombreLlevar, 'S/N') AS ubicacion,
                       CONCAT(c.primerNombre, ' ', c.primerApellido) AS nombreCliente,
                       c.nitCi
                FROM Factura f
                JOIN MetodoPago mp  ON f.idMetodoPago = mp.idMetodoPago
                JOIN Pedido p       ON f.idPedido = p.idPedido
                JOIN TipoPedido tp  ON p.idTipoPedido = tp.idTipoPedido
                LEFT JOIN Mesa m    ON p.idMesa = m.idMesa
                LEFT JOIN Cliente c ON p.idCliente = c.idCliente
                WHERE 1=1`;
            const params = [];
            if (desde)        { sql += ' AND DATE(f.fechaEmision) >= ?'; params.push(desde); }
            if (hasta)        { sql += ' AND DATE(f.fechaEmision) <= ?'; params.push(hasta); }
            if (estado)       { sql += ' AND f.estadoFactura = ?';       params.push(estado); }
            if (idMetodoPago) { sql += ' AND f.idMetodoPago = ?';        params.push(idMetodoPago); }
            sql += ' ORDER BY f.fechaEmision DESC LIMIT 200';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('listarFacturas:', error);
            res.status(500).json({ error: "Error al obtener facturas." });
        }
    },
    anularFactura: async (req, res) => {
        const { idFactura } = req.params;
        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();
 
            const [rows] = await conexion.query(
                'SELECT idPedido, estadoFactura FROM Factura WHERE idFactura = ?', [idFactura]
            );
            if (rows.length === 0) throw new Error("Factura no encontrada.");
            if (rows[0].estadoFactura === 'Anulada') throw new Error("La factura ya está anulada.");
 
            await conexion.query(
                "UPDATE Factura SET estadoFactura = 'Anulada' WHERE idFactura = ?", [idFactura]
            );
            // Revertir pedido a Entregado para que pueda recobrarse
            await conexion.query(
                "UPDATE Pedido SET estadoPedido = 'Entregado' WHERE idPedido = ?", [rows[0].idPedido]
            );
            await conexion.commit();
            res.json({ exito: true, mensaje: "Factura anulada. El pedido volvió a estado Entregado para recobrarse." });
        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error('anularFactura:', error);
            res.status(400).json({ exito: false, error: error.message });
        } finally {
            if (conexion) conexion.release();
        }
    },
 
    // ============================================================
    // RECETAS — MenuIngrediente CRUD
    // ============================================================
    obtenerRecetasPlato: async (req, res) => {
        const { idMenu } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT mi.idMenu, mi.idIngrediente, mi.cantidadRequerida,
                       i.nombreIngrediente, i.unidadMedida, i.stockActual,
                       ROUND(mi.cantidadRequerida * i.precioActualCompra, 2) AS costoLinea
                FROM MenuIngrediente mi
                JOIN Ingrediente i ON mi.idIngrediente = i.idIngrediente
                WHERE mi.idMenu = ?
                ORDER BY i.nombreIngrediente ASC
            `, [idMenu]);
            res.json(rows);
        } catch (error) { res.status(500).json({ error: "Error al obtener receta." }); }
    },
    agregarIngredienteReceta: async (req, res) => {
        const { idMenu } = req.params;
        const { idIngrediente, cantidadRequerida } = req.body;
        if (!idIngrediente)
            return res.status(400).json({ exito: false, error: "Seleccione un ingrediente." });
        if (!cantidadRequerida || isNaN(cantidadRequerida) || parseFloat(cantidadRequerida) <= 0)
            return res.status(400).json({ exito: false, error: "La cantidad debe ser mayor a 0." });
        try {
            await db.query(
                `INSERT INTO MenuIngrediente (idMenu, idIngrediente, cantidadRequerida)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE cantidadRequerida = VALUES(cantidadRequerida)`,
                [idMenu, idIngrediente, parseFloat(cantidadRequerida)]
            );
            res.status(201).json({ exito: true, mensaje: "Ingrediente agregado a la receta." });
        } catch (error) {
            res.status(500).json({ exito: false, error: "Error al agregar ingrediente." });
        }
    },
    eliminarIngredienteReceta: async (req, res) => {
        const { idMenu, idIngrediente } = req.params;
        try {
            await db.query(
                'DELETE FROM MenuIngrediente WHERE idMenu = ? AND idIngrediente = ?',
                [idMenu, idIngrediente]
            );
            res.json({ exito: true, mensaje: "Ingrediente eliminado de la receta." });
        } catch (error) { res.status(500).json({ exito: false, error: "Error al eliminar." }); }
    },
    obtenerCostoPlato: async (req, res) => {
        const { idMenu } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT m.nombrePlato, m.precioActual,
                       COALESCE(SUM(mi.cantidadRequerida * i.precioActualCompra), 0) AS costoProduccion,
                       m.precioActual - COALESCE(SUM(mi.cantidadRequerida * i.precioActualCompra), 0) AS gananciaEstimada
                FROM Menu m
                LEFT JOIN MenuIngrediente mi ON m.idMenu = mi.idMenu
                LEFT JOIN Ingrediente i      ON mi.idIngrediente = i.idIngrediente
                WHERE m.idMenu = ?
                GROUP BY m.idMenu, m.nombrePlato, m.precioActual
            `, [idMenu]);
            res.json(rows[0] || {});
        } catch (error) { res.status(500).json({ error: "Error al calcular costo." }); }
    },
    // ============================================================
    // GESTIÓN DE PERMISOS POR ROL
    // ============================================================

    // Obtener permisos de un rol específico
    obtenerPermisosRol: async (req, res) => {
        const { idRol } = req.params;
        try {
            const [rows] = await db.query(
                `SELECT subModulo, ver, insertar, editar, eliminar 
                FROM PermisoSubModulo 
                WHERE idRol = ?`,
                [idRol]
            );
            // Si no hay registros, devolvemos un objeto vacío (todos los permisos en false)
            const permisos = {};
            // Lista de todos los submódulos conocidos (para asegurar que estén presentes)
            const todosSubModulos = [
                'sub-menu', 'sub-usuarios', 'sub-mesas', 'sub-turnos', 'sub-roles', 'sub-pagos',
                'sub-ingredientes', 'sub-categorias', 'sub-clientes', 'sub-puestos',
                'sub-areas', 'sub-facturas', 'sub-cierre-caja', 'sub-gestion-pedidos',
                'sub-cocina-monitor', 'sub-gestionar-ventas', 'card-modelos-matematicos'
            ];
            // Inicializar todos en false
            todosSubModulos.forEach(sm => {
                permisos[sm] = { ver: false, insertar: false, editar: false, eliminar: false };
            });
            // Sobrescribir con los que existen
            rows.forEach(row => {
                permisos[row.subModulo] = {
                    ver: row.ver === 1,
                    insertar: row.insertar === 1,
                    editar: row.editar === 1,
                    eliminar: row.eliminar === 1
                };
            });
            res.json({ idRol, permisos });
        } catch (error) {
            console.error('obtenerPermisosRol:', error);
            res.status(500).json({ error: 'Error al obtener permisos del rol' });
        }
    },

    // Actualizar permisos de un rol (se espera un objeto con la estructura permisos)
    actualizarPermisosRol: async (req, res) => {
        const { idRol } = req.params;
        const { permisos } = req.body; // { subModulo: { ver, insertar, editar, eliminar }, ... }

        if (!permisos || typeof permisos !== 'object') {
            return res.status(400).json({ exito: false, error: 'Estructura de permisos inválida' });
        }

        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            // Eliminar todos los permisos anteriores para este rol
            await conexion.query('DELETE FROM PermisoSubModulo WHERE idRol = ?', [idRol]);

            // Insertar los nuevos
            const entries = Object.entries(permisos);
            for (const [subModulo, ops] of entries) {
                const { ver, insertar, editar, eliminar } = ops;
                // Solo insertar si al menos un permiso es true (opcional)
                if (ver || insertar || editar || eliminar) {
                    await conexion.query(
                        `INSERT INTO PermisoSubModulo (idRol, subModulo, ver, insertar, editar, eliminar)
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [idRol, subModulo, ver ? 1 : 0, insertar ? 1 : 0, editar ? 1 : 0, eliminar ? 1 : 0]
                    );
                }
            }

            await conexion.commit();
            res.json({ exito: true, mensaje: 'Permisos actualizados correctamente' });
        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error('actualizarPermisosRol:', error);
            res.status(500).json({ exito: false, error: 'Error al actualizar permisos' });
        } finally {
            if (conexion) conexion.release();
        }
    },
    // ============================================================
    // CRUD PROVEEDORES
    // ============================================================

    listarProveedores: async (req, res) => {
        try {
            const [rows] = await db.query(
                `SELECT idProveedor, nombreProveedor, contacto, telefono, email, direccion, activo, fechaRegistro
                FROM Proveedor
                ORDER BY nombreProveedor ASC`
            );
            res.json(rows);
        } catch (error) {
            console.error('listarProveedores:', error);
            res.status(500).json({ error: "Error al obtener proveedores" });
        }
    },

    crearProveedor: async (req, res) => {
        const { nombreProveedor, contacto, telefono, email, direccion } = req.body;
        if (!nombreProveedor || nombreProveedor.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre del proveedor es obligatorio (mín. 2 caracteres)." });

        try {
            const [result] = await db.query(
                `INSERT INTO Proveedor (nombreProveedor, contacto, telefono, email, direccion, activo)
                VALUES (?, ?, ?, ?, ?, 1)`,
                [nombreProveedor.trim(), contacto?.trim() || null, telefono?.trim() || null,
                email?.trim() || null, direccion?.trim() || null]
            );
            res.status(201).json({ exito: true, idProveedor: result.insertId, mensaje: "Proveedor creado correctamente." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un proveedor con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al crear proveedor." });
        }
    },

    actualizarProveedor: async (req, res) => {
        const { idProveedor } = req.params;
        const { nombreProveedor, contacto, telefono, email, direccion, activo } = req.body;
        if (!nombreProveedor || nombreProveedor.trim().length < 2)
            return res.status(400).json({ exito: false, error: "El nombre es obligatorio." });

        try {
            const [result] = await db.query(
                `UPDATE Proveedor SET nombreProveedor=?, contacto=?, telefono=?, email=?, direccion=?, activo=?
                WHERE idProveedor=?`,
                [nombreProveedor.trim(), contacto?.trim() || null, telefono?.trim() || null,
                email?.trim() || null, direccion?.trim() || null, activo !== undefined ? activo : 1, idProveedor]
            );
            if (result.affectedRows === 0)
                return res.status(404).json({ exito: false, error: "Proveedor no encontrado." });
            res.json({ exito: true, mensaje: "Proveedor actualizado." });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ exito: false, error: "Ya existe un proveedor con ese nombre." });
            res.status(500).json({ exito: false, error: "Error al actualizar proveedor." });
        }
    },

    eliminarProveedor: async (req, res) => {
        const { idProveedor } = req.params;
        try {
            // Baja lógica: desactivar
            await db.query('UPDATE Proveedor SET activo = 0 WHERE idProveedor = ?', [idProveedor]);
            res.json({ exito: true, mensaje: "Proveedor desactivado (baja lógica)." });
        } catch (error) {
            res.status(500).json({ exito: false, error: "Error al eliminar proveedor." });
        }
    },

    obtenerHistorialPreciosIngrediente: async (req, res) => {
        const { idIngrediente } = req.params;
        try {
            const [rows] = await db.query(
                `SELECT precioUnitario, fechaInicio, fechaFin
                FROM PrecioHistoricoIngrediente
                WHERE idIngrediente = ?
                ORDER BY fechaInicio DESC`,
                [idIngrediente]
            );
            res.json(rows);
        } catch (error) {
            console.error('obtenerHistorialPreciosIngrediente:', error);
            res.status(500).json({ error: "Error al obtener historial de precios." });
        }
    },
    // ============================================================
    // REPORTES AVANZADOS
    // ============================================================

    obtenerReporteVentas: async (req, res) => {
        try {
            const { desde, hasta, idCliente, idProducto, idMetodoPago } = req.query;
            let sql = `
                SELECT f.nroFactura, f.fechaEmision, f.montoTotal, f.estadoFactura,
                    mp.nombreMetodo, CONCAT(c.primerNombre, ' ', c.primerApellido) AS cliente,
                    CONCAT(e.primerNombre, ' ', e.primerApellido) AS empleado,
                    COALESCE(m.numeroMesa, p.nombreLlevar, 'S/N') AS ubicacion
                FROM Factura f
                JOIN Pedido p ON f.idPedido = p.idPedido
                JOIN MetodoPago mp ON f.idMetodoPago = mp.idMetodoPago
                LEFT JOIN Cliente c ON p.idCliente = c.idCliente
                LEFT JOIN Empleado e ON p.idEmpleado = e.idEmpleado
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE f.estadoFactura = 'Vigente'
            `;
            const params = [];

            if (desde) { sql += ' AND DATE(f.fechaEmision) >= ?'; params.push(desde); }
            if (hasta) { sql += ' AND DATE(f.fechaEmision) <= ?'; params.push(hasta); }
            if (idCliente) { sql += ' AND p.idCliente = ?'; params.push(idCliente); }
            if (idMetodoPago) { sql += ' AND f.idMetodoPago = ?'; params.push(idMetodoPago); }
            if (idProducto) {
                sql += ` AND EXISTS (
                    SELECT 1 FROM DetallePedido dp WHERE dp.idPedido = p.idPedido AND dp.idMenu = ?
                )`;
                params.push(idProducto);
            }

            sql += ' ORDER BY f.fechaEmision DESC LIMIT 500';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('obtenerReporteVentas:', error);
            res.status(500).json({ error: "Error al generar reporte de ventas." });
        }
    },

    obtenerReporteClientes: async (req, res) => {
        try {
            const { desde, hasta } = req.query;
            let sql = `
                SELECT c.idCliente, CONCAT(c.primerNombre, ' ', c.primerApellido) AS cliente,
                    COUNT(f.idFactura) AS compras,
                    COALESCE(SUM(f.montoTotal), 0) AS totalGastado
                FROM Cliente c
                LEFT JOIN Pedido p ON c.idCliente = p.idCliente
                LEFT JOIN Factura f ON p.idPedido = f.idPedido AND f.estadoFactura = 'Vigente'
                WHERE 1=1
            `;
            const params = [];
            if (desde) { sql += ' AND DATE(f.fechaEmision) >= ?'; params.push(desde); }
            if (hasta) { sql += ' AND DATE(f.fechaEmision) <= ?'; params.push(hasta); }
            sql += ' GROUP BY c.idCliente ORDER BY totalGastado DESC';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('obtenerReporteClientes:', error);
            res.status(500).json({ error: "Error al generar reporte de clientes." });
        }
    },

    obtenerReporteProductos: async (req, res) => {
        try {
            const { desde, hasta } = req.query;
            let sql = `
                SELECT men.nombrePlato AS producto,
                    SUM(dp.cantidad) AS cantidadVendida,
                    COALESCE(SUM(dp.cantidad * men.precioActual), 0) AS ingresoGenerado
                FROM DetallePedido dp
                JOIN Pedido p ON dp.idPedido = p.idPedido
                JOIN Menu men ON dp.idMenu = men.idMenu
                WHERE p.estadoPedido = 'Pagado'
            `;
            const params = [];
            if (desde) { sql += ' AND DATE(p.fechaPedido) >= ?'; params.push(desde); }
            if (hasta) { sql += ' AND DATE(p.fechaPedido) <= ?'; params.push(hasta); }
            sql += ' GROUP BY men.idMenu ORDER BY cantidadVendida DESC LIMIT 20';
            const [rows] = await db.query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('obtenerReporteProductos:', error);
            res.status(500).json({ error: "Error al generar reporte de productos." });
        }
    },

    descargarReporteExcelAvanzado: async (req, res) => {
        try {
            const { desde, hasta, idCliente, idProducto, idMetodoPago } = req.query;
            let sql = `
                SELECT f.nroFactura, f.fechaEmision, f.montoTotal, mp.nombreMetodo,
                    CONCAT(c.primerNombre, ' ', c.primerApellido) AS cliente,
                    CONCAT(e.primerNombre, ' ', e.primerApellido) AS empleado,
                    COALESCE(m.numeroMesa, p.nombreLlevar, 'S/N') AS ubicacion
                FROM Factura f
                JOIN Pedido p ON f.idPedido = p.idPedido
                JOIN MetodoPago mp ON f.idMetodoPago = mp.idMetodoPago
                LEFT JOIN Cliente c ON p.idCliente = c.idCliente
                LEFT JOIN Empleado e ON p.idEmpleado = e.idEmpleado
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE f.estadoFactura = 'Vigente'
            `;
            const params = [];
            if (desde) { sql += ' AND DATE(f.fechaEmision) >= ?'; params.push(desde); }
            if (hasta) { sql += ' AND DATE(f.fechaEmision) <= ?'; params.push(hasta); }
            if (idCliente) { sql += ' AND p.idCliente = ?'; params.push(idCliente); }
            if (idMetodoPago) { sql += ' AND f.idMetodoPago = ?'; params.push(idMetodoPago); }
            if (idProducto) {
                sql += ` AND EXISTS (
                    SELECT 1 FROM DetallePedido dp WHERE dp.idPedido = p.idPedido AND dp.idMenu = ?
                )`;
                params.push(idProducto);
            }
            sql += ' ORDER BY f.fechaEmision DESC';
            const [rows] = await db.query(sql, params);

            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Reporte Ventas');

            sheet.columns = [
                { header: 'N° Factura', key: 'nroFactura', width: 22 },
                { header: 'Fecha', key: 'fecha', width: 22 },
                { header: 'Cliente', key: 'cliente', width: 25 },
                { header: 'Ubicación', key: 'ubicacion', width: 20 },
                { header: 'Método Pago', key: 'metodo', width: 16 },
                { header: 'Empleado', key: 'empleado', width: 22 },
                { header: 'Total (Bs.)', key: 'total', width: 14 }
            ];

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
            headerRow.alignment = { horizontal: 'center' };

            let totalGeneral = 0;
            rows.forEach(row => {
                const total = parseFloat(row.montoTotal);
                totalGeneral += total;
                sheet.addRow({
                    nroFactura: row.nroFactura,
                    fecha: new Date(row.fechaEmision).toLocaleString('es-BO'),
                    cliente: row.cliente || 'Sin cliente',
                    ubicacion: row.ubicacion,
                    metodo: row.nombreMetodo,
                    empleado: row.empleado || '—',
                    total: total
                });
            });

            sheet.addRow({});
            const totalRow = sheet.addRow({ nroFactura: 'TOTAL GENERAL:', total: totalGeneral });
            totalRow.font = { bold: true, size: 12 };
            totalRow.getCell('total').numFmt = '#,##0.00';

            const nombreArchivo = `Reporte_Ventas_${new Date().toISOString().slice(0,10)}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${nombreArchivo}`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('descargarReporteExcelAvanzado:', error);
            res.status(500).json({ error: "Error al generar el reporte Excel." });
        }
    },
    cambiarEstadoUsuario: async (req, res) => {
    const { idEmpleado } = req.params;
    const { estado } = req.body;

    if (!estado) {
        return res.status(400).json({ exito: false, error: "El estado es obligatorio." });
    }

    // Validar que el estado sea válido
    const estadosValidos = ['Activo', 'Inactivo', 'Licencia'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ exito: false, error: "Estado no válido." });
    }

    try {
        const [result] = await db.query(
            "UPDATE Empleado SET estado = ? WHERE idEmpleado = ?",
            [estado, idEmpleado]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ exito: false, error: "Empleado no encontrado." });
        }
        res.json({ exito: true, mensaje: `Estado actualizado a ${estado}.` });
    } catch (error) {
        console.error("Error cambiarEstadoUsuario:", error);
        res.status(500).json({ exito: false, error: "Error al cambiar el estado." });
    }
},
};
module.exports = moduloAdministracion;