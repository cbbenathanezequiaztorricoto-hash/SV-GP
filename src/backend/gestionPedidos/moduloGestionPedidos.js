// SV_GP/src/backend/gestionPedidos/moduloGestionPedidos.js
const db = require('../common/conexion');
const ColaPedidos = require('../common/ColaPedidos');

const colaCocina = new ColaPedidos();

const moduloGestionPedidos = {
    // LISTAR PEDIDOS (con detalles)
    listarPedidos: async (req, res) => {
        try {
            const [pedidos] = await db.query(`
                SELECT p.idPedido, p.fechaPedido, p.totalPedido, p.estadoPedido, 
                       t.nombreTipo, m.numeroMesa,
                       p.nombreLlevar, p.referenciaLlevar
                FROM Pedido p
                JOIN TipoPedido t ON p.idTipoPedido = t.idTipoPedido
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE p.estadoPedido NOT IN ('Cancelado', 'Pagado')
                ORDER BY p.fechaPedido DESC
            `);
            // Agregar detalles de cada pedido
            for (let pedido of pedidos) {
                const [detalles] = await db.query(`
                    SELECT m.nombrePlato, dp.cantidad, dp.notasExtra
                    FROM DetallePedido dp
                    JOIN Menu m ON dp.idMenu = m.idMenu
                    WHERE dp.idPedido = ?
                `, [pedido.idPedido]);
                pedido.detalles = detalles;
            }
            res.json(pedidos);
        } catch (error) {
            console.error("Error listarPedidos:", error);
            res.status(500).json({ error: "Error al consultar pedidos" });
        }
    },

    obtenerPedido: async (req, res) => {
        const { id } = req.params;
        try {
            const [rows] = await db.query(`
                SELECT p.idPedido, p.idTipoPedido, p.idMesa, p.nombreLlevar, p.referenciaLlevar,
                       p.totalPedido, p.estadoPedido, m.numeroMesa
                FROM Pedido p
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE p.idPedido = ?
            `, [id]);
            if (rows.length === 0) return res.status(404).json({ error: "Pedido no encontrado." });

            const pedido = rows[0];
            const [detalles] = await db.query(`
                SELECT dp.idMenu, m.nombrePlato, COALESCE(m.precioActual, 0) AS precio, dp.cantidad, dp.notasExtra
                FROM DetallePedido dp
                JOIN Menu m ON dp.idMenu = m.idMenu
                WHERE dp.idPedido = ?
            `, [id]);
            pedido.detalles = detalles;
            res.json(pedido);
        } catch (error) {
            console.error("Error obtenerPedido:", error);
            res.status(500).json({ error: "Error al obtener el pedido." });
        }
    },

    editarPedido: async (req, res) => {
        const { id } = req.params;
        const { idTipoPedido, numeroMesa, referenciaLlevar, nombreLlevar, direccion_entrega, gps_ubicacion, detalles } = req.body;

        if (!idTipoPedido) {
            return res.status(400).json({ error: "El tipo de pedido es obligatorio." });
        }
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ error: "El pedido debe contener al menos un artículo." });
        }

        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            const [pedidoRows] = await conexion.query(
                "SELECT idMesa, estadoPedido FROM Pedido WHERE idPedido = ? FOR UPDATE",
                [id]
            );
            if (pedidoRows.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ error: "Pedido no encontrado." });
            }

            const pedidoActual = pedidoRows[0];
            const estado = pedidoActual.estadoPedido;
            if (!['Pendiente', 'En Preparacion'].includes(estado)) {
                await conexion.rollback();
                return res.status(400).json({ error: `No se puede editar un pedido con estado ${estado}.` });
            }

            const esMesa = parseInt(idTipoPedido, 10) === 1;
            let idMesa = null;
            let nombreLlevarVal = null;
            let referenciaLlevarVal = null;
            let direccionEntregaVal = null;
            let gpsUbicacionVal = null;

            if (esMesa) {
                if (!numeroMesa) {
                    await conexion.rollback();
                    return res.status(400).json({ error: "Número de mesa obligatorio para pedidos de mesa." });
                }
                const [mesas] = await conexion.query(
                    "SELECT idMesa FROM Mesa WHERE numeroMesa = ? LIMIT 1",
                    [numeroMesa]
                );
                if (mesas.length === 0) {
                    await conexion.rollback();
                    return res.status(400).json({ error: "Mesa no encontrada." });
                }
                idMesa = mesas[0].idMesa;
            } else {
                if (!referenciaLlevar || !nombreLlevar) {
                    await conexion.rollback();
                    return res.status(400).json({ error: "Nombre y referencia son obligatorios para pedidos fuera de mesa." });
                }
                nombreLlevarVal = nombreLlevar;
                referenciaLlevarVal = referenciaLlevar;
                if (parseInt(idTipoPedido, 10) === 3) {
                    if (!direccion_entrega) {
                        await conexion.rollback();
                        return res.status(400).json({ error: "Dirección de entrega obligatoria para Delivery." });
                    }
                    direccionEntregaVal = direccion_entrega;
                    gpsUbicacionVal = gps_ubicacion || null;
                }
            }

            // Liberar mesa anterior si cambia
            if (pedidoActual.idMesa && pedidoActual.idMesa !== idMesa) {
                await conexion.query("UPDATE Mesa SET estado = 'Libre' WHERE idMesa = ?", [pedidoActual.idMesa]);
            }
            if (idMesa && pedidoActual.idMesa !== idMesa) {
                await conexion.query("UPDATE Mesa SET estado = 'Ocupada' WHERE idMesa = ?", [idMesa]);
            }

            // Actualizar pedido
            if (esMesa) {
                await conexion.query(
                    `UPDATE Pedido SET idTipoPedido = ?, idMesa = ?, nombreLlevar = NULL, referenciaLlevar = NULL,
                    direccion_entrega = NULL, gps_ubicacion = NULL
                    WHERE idPedido = ?`,
                    [idTipoPedido, idMesa, id]
                );
            } else {
                await conexion.query(
                    `UPDATE Pedido SET idTipoPedido = ?, idMesa = NULL, nombreLlevar = ?, referenciaLlevar = ?,
                    direccion_entrega = ?, gps_ubicacion = ?
                    WHERE idPedido = ?`,
                    [idTipoPedido, nombreLlevarVal, referenciaLlevarVal, direccionEntregaVal, gpsUbicacionVal, id]
                );
            }

            // Eliminar detalles antiguos
            await conexion.query("DELETE FROM DetallePedido WHERE idPedido = ?", [id]);

            let totalPedidoActualizado = 0;
            for (const item of detalles) {
                if (!item.idMenu || !item.cantidad || parseInt(item.cantidad, 10) <= 0) {
                    await conexion.rollback();
                    return res.status(400).json({ error: "Detalle inválido en el pedido." });
                }
                const [precioRows] = await conexion.query(
                    "SELECT COALESCE(precioActual, 0) AS precio FROM Menu WHERE idMenu = ? LIMIT 1",
                    [item.idMenu]
                );
                const precioReal = precioRows.length > 0 ? parseFloat(precioRows[0].precio || 0) : 0;
                totalPedidoActualizado += precioReal * parseInt(item.cantidad, 10);
                await conexion.query(
                    `INSERT INTO DetallePedido (idPedido, idMenu, cantidad, notasExtra)
                    VALUES (?, ?, ?, ?)`,
                    [id, item.idMenu, item.cantidad, item.notasExtra || null]
                );
            }
            await conexion.query("UPDATE Pedido SET totalPedido = ? WHERE idPedido = ?", [totalPedidoActualizado, id]);

            // Actualizar cola de cocina si existe
            const colaEntry = colaCocina.obtenerCola().find(p => p.idPedido === parseInt(id, 10));
            if (colaEntry) {
                colaEntry.detalles = detalles.map(item => ({
                    idMenu: item.idMenu,
                    nombrePlato: item.nombre || item.nombrePlato || '',
                    cantidad: item.cantidad,
                    notasExtra: item.notasExtra || null
                }));
                if (esMesa) {
                    colaEntry.numeroMesa = numeroMesa;
                    colaEntry.nombreLlevar = null;
                    colaEntry.referenciaLlevar = null;
                    colaEntry.direccion_entrega = null;
                    colaEntry.gps_ubicacion = null;
                } else {
                    colaEntry.numeroMesa = null;
                    colaEntry.nombreLlevar = nombreLlevarVal;
                    colaEntry.referenciaLlevar = referenciaLlevarVal;
                    colaEntry.direccion_entrega = direccionEntregaVal;
                    colaEntry.gps_ubicacion = gpsUbicacionVal;
                }
                colaEntry.totalPedido = totalPedidoActualizado;
            }

            await conexion.commit();
            res.json({ mensaje: "Pedido actualizado correctamente." });
        } catch (error) {
            if (conexion) await conexion.rollback().catch(() => {});
            console.error("Error editarPedido:", error);
            res.status(500).json({ error: "Error al editar el pedido." });
        } finally {
            if (conexion) conexion.release();
        }
    },

    // CANCELAR PEDIDO (ahora 'Cancelado' sí existe en ENUM)
    cancelarPedido: async (req, res) => {
        const { id } = req.params;
        try {
            // Verificar si el pedido existe y se puede cancelar
            const [pedido] = await db.query("SELECT estadoPedido, idMesa FROM Pedido WHERE idPedido = ?", [id]);
            if (pedido.length === 0) {
                return res.status(404).json({ error: "Pedido no encontrado" });
            }
            if (pedido[0].estadoPedido === 'Cancelado') {
                return res.status(400).json({ error: "El pedido ya está cancelado" });
            }
            // Liberar la mesa si estaba ocupada
            if (pedido[0].idMesa) {
                await db.query("UPDATE Mesa SET estado = 'Libre' WHERE idMesa = ?", [pedido[0].idMesa]);
            }
            await db.query("UPDATE Pedido SET estadoPedido = 'Cancelado' WHERE idPedido = ?", [id]);
            res.json({ mensaje: "Pedido cancelado exitosamente" });
        } catch (error) {
            console.error("Error cancelarPedido:", error);
            res.status(500).json({ error: "No se pudo cancelar el pedido" });
        }
    },

    // COMPLETAR PEDIDO (cambia a 'Entregado')
    completarPedido: async (req, res) => {
        const { id } = req.params;
        try {
            const [pedido] = await db.query("SELECT estadoPedido FROM Pedido WHERE idPedido = ?", [id]);
            if (pedido.length === 0) {
                return res.status(404).json({ error: "Pedido no encontrado" });
            }
            if (pedido[0].estadoPedido !== 'Pendiente' && pedido[0].estadoPedido !== 'En Preparacion') {
                return res.status(400).json({ error: "El pedido no se puede completar (estado actual: " + pedido[0].estadoPedido + ")" });
            }
            await db.query("UPDATE Pedido SET estadoPedido = 'Entregado' WHERE idPedido = ?", [id]);
            res.json({ mensaje: "Pedido marcado como Entregado" });
        } catch (error) {
            console.error("Error completarPedido:", error);
            res.status(500).json({ error: "Error al completar el pedido" });
        }
    },

    // Otros métodos (cola de cocina) se mantienen igual
    obtenerCocina: (req, res) => { 
        res.json(colaCocina.obtenerCola()); 
    },
    despacharCocina: async (req, res) => {
        const { idPedido } = req.body || {};

        if (!idPedido) {
            return res.status(400).json({ error: "Se requiere el ID del pedido." });
        }

        try {
            // Verificar que el pedido existe
            const [pedido] = await db.query(
                "SELECT estadoPedido FROM Pedido WHERE idPedido = ?",
                [idPedido]
            );
            if (pedido.length === 0) {
                return res.status(404).json({ error: "Pedido no encontrado." });
            }
            const estadoActual = pedido[0].estadoPedido;
            if (!['Pendiente', 'En Preparacion'].includes(estadoActual)) {
                return res.status(400).json({ error: `El pedido no se puede despachar (estado: ${estadoActual})` });
            }

            // Actualizar estado a 'Entregado'
            await db.query(
                "UPDATE Pedido SET estadoPedido = 'Entregado' WHERE idPedido = ?",
                [idPedido]
            );

            // Eliminar de la cola en memoria (si existe)
            colaCocina.remove(idPedido);

            res.json({ mensaje: `Pedido #${idPedido} marcado como listo.` });
        } catch (error) {
            console.error("Error en despacharCocina:", error);
            res.status(500).json({ error: "Error al procesar el pedido." });
        }
    },
    // Obtener mesas (solo las que están libres, o todas según necesidad)
    obtenerMesas: async (req, res) => {
        try {
            // Para pedidos nuevos, solo interesan mesas LIBRES
            const [mesas] = await db.query(
                "SELECT idMesa, numeroMesa, capacidad FROM Mesa WHERE estado = 'Libre' ORDER BY numeroMesa"
            );
            res.json(mesas);
        } catch (error) {
            console.error("Error al obtener mesas:", error);
            res.status(500).json({ error: "Error al cargar mesas" });
        }
    },
    registrarPedido: async (req, res) => {
        const { idTipoPedido, referencia, total, idEmpleado, direccion_entrega, gps_ubicacion, detalles } = req.body;

        if (!idTipoPedido || !referencia || !detalles || detalles.length === 0) {
            return res.status(400).json({ error: "Faltan datos obligatorios del pedido." });
        }

        let idEmpleadoReal = null;
        let conexion;

        try {
            // Resolver empleado
            if (idEmpleado) {
                const [empRows] = await db.query(
                    'SELECT idEmpleado FROM Empleado WHERE idUsuario = ? LIMIT 1',
                    [idEmpleado]
                );
                if (empRows.length > 0) idEmpleadoReal = empRows[0].idEmpleado;
            }

            // Procesar tipo de pedido
            const esMesa = String(idTipoPedido) === '1';
            let idMesa = null;
            let nombreLlevar = null;
            let referenciaLlevar = null;
            let direccionEntrega = null;
            let gpsUbicacion = null;

            if (esMesa) {
                // referencia es el número de mesa
                const [mesas] = await db.query(
                    "SELECT idMesa FROM Mesa WHERE numeroMesa = ? LIMIT 1",
                    [referencia]
                );
                if (mesas.length === 0) {
                    return res.status(400).json({ error: `Mesa N° ${referencia} no encontrada.` });
                }
                idMesa = mesas[0].idMesa;
            } else {
                // Para llevar o delivery: referencia es nombre del cliente
                nombreLlevar = referencia;
                referenciaLlevar = referencia;
                if (String(idTipoPedido) === '3') { // Delivery
                    direccionEntrega = direccion_entrega || null;
                    gpsUbicacion = gps_ubicacion || null;
                    if (!direccionEntrega) {
                        return res.status(400).json({ error: "Dirección de entrega requerida para Delivery." });
                    }
                }
            }

            const totalCalculado = detalles.reduce((sum, d) => 
                sum + (parseFloat(d.precio || 0) * parseInt(d.cantidad || 0)), 0
            );

            conexion = await db.getConnection();
            await conexion.beginTransaction();

            // Insertar Pedido
            const [resultPedido] = await conexion.query(
                `INSERT INTO Pedido 
                (idTipoPedido, idMesa, idCliente, nombreLlevar, referenciaLlevar, 
                totalPedido, estadoPedido, fechaPedido, idEmpleado,
                direccion_entrega, gps_ubicacion)
                VALUES (?, ?, NULL, ?, ?, ?, 'Pendiente', NOW(), ?, ?, ?)`,
                [idTipoPedido, idMesa, nombreLlevar, referenciaLlevar, totalCalculado, idEmpleadoReal, direccionEntrega, gpsUbicacion]
            );

            const idPedidoNuevo = resultPedido.insertId;

            // Insertar detalles
            for (const item of detalles) {
                await conexion.query(
                    `INSERT INTO DetallePedido 
                    (idPedido, idMenu, cantidad, notasExtra)
                    VALUES (?, ?, ?, ?)`,
                    [idPedidoNuevo, item.idMenu, item.cantidad, item.notasExtra || null]
                );
            }

            // Marcar mesa ocupada
            if (idMesa) {
                await conexion.query(
                    "UPDATE Mesa SET estado = 'Ocupada' WHERE idMesa = ?",
                    [idMesa]
                );
            }

            // Cargar datos para cola de cocina
            const [tipoRows] = await conexion.query(
                'SELECT nombreTipo FROM TipoPedido WHERE idTipoPedido = ? LIMIT 1',
                [idTipoPedido]
            );
            const nombreTipo = tipoRows.length > 0 ? tipoRows[0].nombreTipo : '';

            const [detallesRows] = await conexion.query(
                `SELECT m.nombrePlato, dp.cantidad, dp.notasExtra
                FROM DetallePedido dp
                JOIN Menu m ON dp.idMenu = m.idMenu
                WHERE dp.idPedido = ?`,
                [idPedidoNuevo]
            );

            const pedidoEnCola = {
                idPedido: idPedidoNuevo,
                idTipoPedido,
                nombreTipo,
                numeroMesa: esMesa ? referencia : null,
                nombreLlevar: esMesa ? null : referencia,
                referenciaLlevar: esMesa ? referencia : null,
                totalPedido: totalCalculado,
                estadoPedido: 'Pendiente',
                fechaPedido: new Date(),
                detalles: detallesRows
            };
            colaCocina.enqueue(pedidoEnCola);

            await conexion.commit();

            res.status(201).json({
                exito: true,
                idPedido: idPedidoNuevo,
                mensaje: `Pedido #${idPedidoNuevo} registrado correctamente.`
            });

        } catch (error) {
            if (conexion) await conexion.rollback().catch(() => {});
            console.error("❌ Error registrarPedido:", error);
            res.status(500).json({ 
                error: "Error interno al registrar el pedido.",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (conexion) conexion.release();
        }
    },
    // ============================================================
    // PEDIDOS DE COCINA CON FILTRO (desde BD)
    // ============================================================
    obtenerPedidosCocinaConFiltro: async (req, res) => {
        const { estado } = req.query;
        const estadosValidos = ['Pendiente', 'En Preparacion', 'Entregado'];
        const estadoFiltro = estadosValidos.includes(estado) ? estado : 'Pendiente';

        try {
            const [pedidos] = await db.query(`
                SELECT p.idPedido, p.fechaPedido, p.totalPedido, p.estadoPedido,
                    t.nombreTipo, m.numeroMesa,
                    p.nombreLlevar, p.referenciaLlevar,
                    p.direccion_entrega, p.gps_ubicacion
                FROM Pedido p
                JOIN TipoPedido t ON p.idTipoPedido = t.idTipoPedido
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE p.estadoPedido = ? 
                AND p.estadoPedido NOT IN ('Cancelado', 'Pagado')
                AND p.idTipoPedido != 3 -- Excluir Delivery (se maneja en otro módulo)
                ORDER BY p.fechaPedido DESC
            `, [estadoFiltro]);

            for (let pedido of pedidos) {
                const [detalles] = await db.query(`
                    SELECT m.nombrePlato, dp.cantidad, dp.notasExtra
                    FROM DetallePedido dp
                    JOIN Menu m ON dp.idMenu = m.idMenu
                    WHERE dp.idPedido = ?
                `, [pedido.idPedido]);
                pedido.detalles = detalles;
            }

            res.json(pedidos);
        } catch (error) {
            console.error("Error obtenerPedidosCocinaConFiltro:", error);
            res.status(500).json({ error: "Error al obtener pedidos de cocina" });
        }
    },

    // ============================================================
    // PEDIDOS DELIVERY
    // ============================================================
    obtenerPedidosDelivery: async (req, res) => {
        const { estado } = req.query;
        const estadosValidos = ['Pendiente', 'En Preparacion', 'Entregado', 'Pagado', 'Cancelado'];
        const estadoFiltro = estadosValidos.includes(estado) ? estado : 'Pendiente';

        try {
            const [pedidos] = await db.query(`
                SELECT p.idPedido, p.fechaPedido, p.totalPedido, p.estadoPedido,
                    p.nombreLlevar, p.referenciaLlevar,
                    p.direccion_entrega, p.gps_ubicacion
                FROM Pedido p
                WHERE p.idTipoPedido = 3
                AND p.estadoPedido = ?
                ORDER BY p.fechaPedido DESC
            `, [estadoFiltro]);

            for (let pedido of pedidos) {
                const [detalles] = await db.query(`
                    SELECT m.nombrePlato, dp.cantidad, dp.notasExtra
                    FROM DetallePedido dp
                    JOIN Menu m ON dp.idMenu = m.idMenu
                    WHERE dp.idPedido = ?
                `, [pedido.idPedido]);
                pedido.detalles = detalles;
            }

            res.json(pedidos);
        } catch (error) {
            console.error("Error obtenerPedidosDelivery:", error);
            res.status(500).json({ error: "Error al obtener pedidos delivery" });
        }
    },

    entregarPedidoDelivery: async (req, res) => {
        const { id } = req.params;
        try {
            const [pedido] = await db.query(
                "SELECT estadoPedido FROM Pedido WHERE idPedido = ? AND idTipoPedido = 3",
                [id]
            );
            if (pedido.length === 0) {
                return res.status(404).json({ error: "Pedido delivery no encontrado." });
            }
            if (pedido[0].estadoPedido === 'Entregado') {
                return res.status(400).json({ error: "El pedido ya fue entregado." });
            }
            await db.query("UPDATE Pedido SET estadoPedido = 'Entregado' WHERE idPedido = ?", [id]);
            res.json({ mensaje: `Pedido #${id} marcado como Entregado.` });
        } catch (error) {
            console.error("Error entregarPedidoDelivery:", error);
            res.status(500).json({ error: "Error al marcar pedido como entregado." });
        }
    }
};

module.exports = moduloGestionPedidos;