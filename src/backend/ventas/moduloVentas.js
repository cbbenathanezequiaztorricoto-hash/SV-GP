// src/backend/ventas/moduloVentas.js
'use strict';
const db = require('../common/conexion');

const moduloVentas = {

    // ============================================================
    // CASO DE USO: GESTIONAR VENTA — Listar pedidos listos para cobro
    // ============================================================
    obtenerPedidosPendientesCobro: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT 
                    p.idPedido, p.fechaPedido, p.totalPedido,
                    tp.nombreTipo, m.numeroMesa,
                    p.nombreLlevar, p.referenciaLlevar,
                    (SELECT men.imagen_url 
                     FROM DetallePedido dp 
                     JOIN Menu men ON dp.idMenu = men.idMenu 
                     WHERE dp.idPedido = p.idPedido 
                     ORDER BY men.precioActual DESC LIMIT 1) AS imagenPrincipal,
                    (SELECT GROUP_CONCAT(CONCAT(dp.cantidad, 'x ', men.nombrePlato) SEPARATOR ', ')
                     FROM DetallePedido dp 
                     JOIN Menu men ON dp.idMenu = men.idMenu 
                     WHERE dp.idPedido = p.idPedido) AS detallesAgrupados
                FROM Pedido p
                JOIN TipoPedido tp ON p.idTipoPedido = tp.idTipoPedido
                LEFT JOIN Mesa m ON p.idMesa = m.idMesa
                WHERE p.estadoPedido = 'Entregado'
                ORDER BY p.fechaPedido ASC
            `);
            res.json(rows);
        } catch (error) {
            console.error('obtenerPedidosPendientesCobro:', error);
            res.status(500).json({ error: "Error al obtener pedidos listos para cobro" });
        }
    },

    obtenerMetodosPago: async (req, res) => {
        try {
            const [rows] = await db.query(
                'SELECT idMetodoPago, nombreMetodo, qr_url FROM MetodoPago ORDER BY idMetodoPago ASC'
            );
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: "Error al cargar métodos de pago" });
        }
    },

    // ============================================================
    // CASO DE USO: PROCESAR COBRO
    // Flujo: buscar/crear cliente → cambiar estado pedido → insertar Factura
    // ============================================================
    procesarCobro: async (req, res) => {
        const { idPedido } = req.params;
        const { idMetodoPago, nitCi, nombreCliente } = req.body;

        let conexion;
        try {
            conexion = await db.getConnection();
            await conexion.beginTransaction();

            // 1. Verificar pedido
            const [pedidos] = await conexion.query(
                'SELECT idPedido, estadoPedido, idMesa, totalPedido FROM Pedido WHERE idPedido = ?',
                [idPedido]
            );
            if (pedidos.length === 0) throw new Error("Pedido no encontrado.");
            if (pedidos[0].estadoPedido !== 'Entregado')
                throw new Error(`El pedido no está listo para cobro (estado: ${pedidos[0].estadoPedido}).`);

            const totalPedido = parseFloat(pedidos[0].totalPedido);

            // 2. Gestionar cliente (opcional)
            let idClienteFinal = null;
            if (nitCi && nitCi.trim()) {
                const nitLimpio = nitCi.trim();
                const [clienteExist] = await conexion.query(
                    'SELECT idCliente FROM Cliente WHERE nitCi = ?', [nitLimpio]
                );
                if (clienteExist.length > 0) {
                    idClienteFinal = clienteExist[0].idCliente;
                } else if (nombreCliente && nombreCliente.trim()) {
                    // Crear cliente nuevo — email generado para cumplir UNIQUE NOT NULL
                    const nombreLimpio  = nombreCliente.trim();
                    const emailGenerado = `${nitLimpio}@elrecuerdo.local`;
                    const [resCliente] = await conexion.query(
                        `INSERT INTO Cliente (primerNombre, primerApellido, email, nitCi)
                         VALUES (?, '', ?, ?)
                         ON DUPLICATE KEY UPDATE primerNombre = VALUES(primerNombre)`,
                        [nombreLimpio, emailGenerado, nitLimpio]
                    );
                    idClienteFinal = resCliente.insertId || clienteExist[0]?.idCliente;

                    // Vincular cliente al pedido
                    await conexion.query(
                        'UPDATE Pedido SET idCliente = ? WHERE idPedido = ?',
                        [idClienteFinal, idPedido]
                    );
                }
            }

            // 3. Cambiar estado pedido → Pagado
            await conexion.query(
                "UPDATE Pedido SET estadoPedido = 'Pagado' WHERE idPedido = ?", [idPedido]
            );

            // 4. Liberar mesa si aplica
            if (pedidos[0].idMesa) {
                await conexion.query(
                    "UPDATE Mesa SET estado = 'Libre' WHERE idMesa = ?", [pedidos[0].idMesa]
                );
            }

            // 5. Generar número de factura único: REC-YYYYMMDD-idPedido
            const fecha = new Date();
            const fechaStr = fecha.toISOString().slice(0, 10).replace(/-/g, '');
            const nroFactura = `REC-${fechaStr}-${idPedido}`;

            // 6. Insertar Factura
            const [resFactura] = await conexion.query(
                `INSERT INTO Factura (idPedido, idMetodoPago, nroFactura, montoTotal, estadoFactura)
                 VALUES (?, ?, ?, ?, 'Vigente')`,
                [idPedido, idMetodoPago, nroFactura, totalPedido]
            );

            await conexion.commit();
            res.json({
                exito: true,
                idFactura:   resFactura.insertId,
                nroFactura,
                totalPedido,
                mensaje: "Cobro procesado y factura generada exitosamente."
            });

        } catch (error) {
            if (conexion) await conexion.rollback();
            console.error('procesarCobro:', error);
            res.status(400).json({ exito: false, error: error.message });
        } finally {
            if (conexion) conexion.release();
        }
    },

    // ============================================================
    // CASO DE USO: CIERRE DE CAJA
    // Llama al stored procedure sp_CerrarCaja
    // ============================================================
obtenerResumenParaCierre: async (req, res) => {
    try {
        // Obtener fecha actual en formato YYYY-MM-DD usando la zona horaria del servidor
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const fechaHoy = `${year}-${month}-${day}`;

        //console.log('Fecha para cierre:', fechaHoy);

        const [rows] = await db.query(`
            SELECT 
                COALESCE(SUM(f.montoTotal), 0)  AS totalCalculado,
                COUNT(f.idFactura)               AS cantidadFacturas,
                COALESCE(SUM(CASE WHEN mp.nombreMetodo = 'Efectivo' THEN f.montoTotal ELSE 0 END), 0) AS totalEfectivo,
                COALESCE(SUM(CASE WHEN mp.nombreMetodo != 'Efectivo' THEN f.montoTotal ELSE 0 END), 0) AS totalDigital
            FROM Factura f
            JOIN MetodoPago mp ON f.idMetodoPago = mp.idMetodoPago
            WHERE DATE(f.fechaEmision) = ? AND f.estadoFactura = 'Vigente'
        `, [fechaHoy]);

        //console.log('✅ Resumen obtenido:', rows[0]);

        res.json({ ...rows[0], fecha: fechaHoy });
    } catch (error) {
        console.error('❌ Error en obtenerResumenParaCierre:', error);
        res.status(500).json({ error: "Error al obtener resumen de caja" });
    }
},

    ejecutarCierreCaja: async (req, res) => {
        const { montoReal } = req.body;
        const idUsuario = req.body.idEmpleado; // viene como idUsuario desde localStorage

        try {
            // Resolver idEmpleado real desde idUsuario
            const [empRows] = await db.query(
                'SELECT idEmpleado FROM Empleado WHERE idUsuario = ? LIMIT 1', [idUsuario]
            );
            if (empRows.length === 0)
                return res.status(400).json({ error: "Empleado no encontrado para este usuario." });

            const idEmpleado = empRows[0].idEmpleado;
            const fechaHoy   = new Date().toISOString().split('T')[0];

            await db.query(
                `CALL sp_CerrarCaja(?, ?, ?, @desfase)`,
                [idEmpleado, fechaHoy, montoReal]
            );
            const [result] = await db.query('SELECT @desfase AS desfase');
            const desfase = parseFloat(result[0].desfase);

            res.json({
                exito:    true,
                desfase,
                mensaje:  desfase === 0
                    ? "Caja cuadrada. Sin desfase."
                    : `Desfase de ${desfase.toFixed(2)} Bs. registrado.`
            });
        } catch (error) {
            console.error('ejecutarCierreCaja:', error);
            res.status(400).json({ error: error.message || "Error al ejecutar cierre de caja." });
        }
    },

    // ============================================================
    // REPORTE DIARIO (dashboard rápido)
    // ============================================================
    obtenerReporteDiario: async (req, res) => {
        try {
            const [ventas] = await db.query(`
                SELECT COALESCE(SUM(totalPedido), 0) AS ingresosTotales,
                       COUNT(idPedido)               AS totalPedidos
                FROM Pedido
                WHERE estadoPedido = 'Pagado' AND DATE(fechaPedido) = CURDATE()
            `);
            const [platoTop] = await db.query(`
                SELECT m.nombrePlato, SUM(dp.cantidad) AS cantidadVendida
                FROM DetallePedido dp
                JOIN Pedido p  ON dp.idPedido = p.idPedido
                JOIN Menu m    ON dp.idMenu   = m.idMenu
                WHERE p.estadoPedido = 'Pagado' AND DATE(p.fechaPedido) = CURDATE()
                GROUP BY m.idMenu
                ORDER BY cantidadVendida DESC
                LIMIT 1
            `);
            res.json({
                ingresosTotales:  ventas[0].ingresosTotales || 0,
                totalPedidos:     ventas[0].totalPedidos    || 0,
                platoMasVendido:  platoTop.length > 0 ? platoTop[0].nombrePlato : 'Sin datos hoy'
            });
        } catch (error) {
            console.error('obtenerReporteDiario:', error);
            res.status(500).json({ error: "Error al generar reporte diario" });
        }
    },

    // ============================================================
    // DESCARGA EXCEL
    // Genera reporte desde tablas reales: Factura, Pedido, DetallePedido, Menu
    // ============================================================

    descargarReporteExcel: async (req, res) => {
        try {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const fechaParam = req.query.fecha || new Date().toISOString().split('T')[0];
            const fechaHoy = fechaParam;
            //console.log('📅 Generando Excel para fecha:', fechaHoy)

            // ── HOJA 1: Ventas del día (desde vista `venta`) ──────────────────
            const sheetVentas = workbook.addWorksheet('Ventas del Día');
            const [ventas] = await db.query(`
                SELECT f.nroFactura,
                       COALESCE(f.fechaEmision, p.fechaPedido) AS fecha,
                       f.montoTotal AS total,
                       mp.nombreMetodo AS metodoPago,
                       CONCAT(e.primerNombre, ' ', e.primerApellido) AS mesero
                FROM Factura f
                JOIN MetodoPago mp ON f.idMetodoPago = mp.idMetodoPago
                LEFT JOIN Pedido p ON f.idPedido = p.idPedido
                LEFT JOIN Empleado e ON p.idEmpleado = e.idEmpleado
                WHERE DATE(f.fechaEmision) = ?
                  AND f.estadoFactura = 'Vigente'
                ORDER BY f.fechaEmision ASC
            `, [fechaHoy]);

            sheetVentas.columns = [
                { header: 'N° Factura',   key: 'nroFactura', width: 22 },
                { header: 'Fecha/Hora',   key: 'fecha',      width: 22 },
                { header: 'Total (Bs.)',  key: 'total',      width: 14 },
                { header: 'Método Pago',  key: 'metodoPago', width: 16 },
                { header: 'Atendido por', key: 'mesero',     width: 22 }
            ];

            // Estilo encabezado hoja 1
            const h1 = sheetVentas.getRow(1);
            h1.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
            h1.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
            h1.alignment = { horizontal: 'center' };

            let totalDia = 0;
            ventas.forEach(v => {
                sheetVentas.addRow({
                    nroFactura: v.nroFactura,
                    fecha:      new Date(v.fecha).toLocaleString('es-BO'),
                    total:      parseFloat(v.total),
                    metodoPago: v.metodoPago,
                    mesero:     v.mesero
                });
                totalDia += parseFloat(v.total);
            });

            sheetVentas.addRow({});
            const rowTotal = sheetVentas.addRow({ metodoPago: 'TOTAL DEL DÍA:', total: totalDia });
            rowTotal.font = { bold: true, size: 12 };
            rowTotal.getCell('total').numFmt = '#,##0.00';

            // ── HOJA 2: Productos más vendidos (vista `productomasvendido`) ────
            const sheetProductos = workbook.addWorksheet('Productos Más Vendidos');
            const [productos] = await db.query(`
                SELECT m.nombrePlato,
                       SUM(dp.cantidad) AS totalVendidos,
                       COALESCE(SUM(dp.cantidad * m.precioActual), 0) AS ingresoGenerado
                FROM DetallePedido dp
                JOIN Menu m ON dp.idMenu = m.idMenu
                JOIN Pedido p ON dp.idPedido = p.idPedido
                WHERE DATE(p.fechaPedido) = ?
                GROUP BY m.idMenu, m.nombrePlato
                ORDER BY totalVendidos DESC
                LIMIT 20
            `, [fechaHoy]);

            sheetProductos.columns = [
                { header: 'Plato',              key: 'nombrePlato',    width: 30 },
                { header: 'Unidades Vendidas',  key: 'totalVendidos',  width: 20 },
                { header: 'Ingreso Generado',   key: 'ingresoGenerado',width: 20 }
            ];

            const h2 = sheetProductos.getRow(1);
            h2.font   = { bold: true, color: { argb: 'FFFFFFFF' } };
            h2.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } };
            h2.alignment = { horizontal: 'center' };

            productos.forEach((p, i) => {
                const row = sheetProductos.addRow({
                    nombrePlato:     p.nombrePlato,
                    totalVendidos:   p.totalVendidos,
                    ingresoGenerado: parseFloat(p.ingresoGenerado)
                });
                // Resaltar el #1 más vendido
                if (i === 0) row.font = { bold: true, color: { argb: 'FFE74C3C' } };
            });

            // ── HOJA 3: Cierre de caja del día ───────────────────────────────
            const sheetCierre = workbook.addWorksheet('Cierre de Caja');
            const [cierre] = await db.query(`
                SELECT cc.fechaCierre, cc.montoCalculado, cc.montoReal, cc.desfase,
                    CONCAT(e.primerNombre, ' ', e.primerApellido) AS empleado
                FROM CierreCaja cc
                JOIN Empleado e ON cc.idEmpleado = e.idEmpleado
                WHERE cc.fechaCierre = ?
                ORDER BY cc.idCierre DESC LIMIT 1
            `, [fechaHoy]);

            sheetCierre.addRow(['CIERRE DE CAJA - ' + fechaHoy]).font = { bold: true, size: 14 };
            sheetCierre.addRow([]);
            if (cierre.length > 0) {
                const c = cierre[0];
                sheetCierre.addRow(['Ejecutado por:',   c.empleado]);
                sheetCierre.addRow(['Monto Sistema:',   parseFloat(c.montoCalculado).toFixed(2) + ' Bs.']);
                sheetCierre.addRow(['Monto Real:',      parseFloat(c.montoReal).toFixed(2) + ' Bs.']);
                const desfaseRow = sheetCierre.addRow(['Desfase:', parseFloat(c.desfase).toFixed(2) + ' Bs.']);
                desfaseRow.getCell(1).font = { bold: true };
                desfaseRow.getCell(2).font = {
                    bold: true,
                    color: { argb: parseFloat(c.desfase) === 0 ? 'FF27AE60' : 'FFE74C3C' }
                };
            } else {
                sheetCierre.addRow(['Sin cierre registrado para hoy.']);
            }

            // Ancho columnas hoja 3
            sheetCierre.getColumn(1).width = 22;
            sheetCierre.getColumn(2).width = 22;

            // Respuesta HTTP
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Reporte_ElRecuerdo_${fechaHoy}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('descargarReporteExcel:', error);
            res.status(500).json({ error: "Error al generar el reporte Excel." });
        }
    },

    // ============================================================
    // MODELOS MATEMÁTICOS (IO + Ecuaciones Diferenciales)
    // Movidos a administración — aquí solo proxy de datos crudos
    // ============================================================
    obtenerModelosMatematicos: async (req, res) => {
        try {
            // Ecuación diferencial: dS/dt = -tasa → días hasta agotamiento
            const [ingredientes] = await db.query(`
                SELECT i.idIngrediente, i.nombreIngrediente, i.stockActual, i.stockMinimo,
                       COALESCE(
                         (SELECT SUM(dp.cantidad * mi2.cantidadRequerida) / 7
                          FROM DetallePedido dp
                          JOIN MenuIngrediente mi2 ON dp.idMenu = mi2.idMenu
                          JOIN Pedido p ON dp.idPedido = p.idPedido
                          WHERE mi2.idIngrediente = i.idIngrediente
                            AND p.fechaPedido >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
                         0.01
                       ) AS tasaConsumo
                FROM Ingrediente i
            `);

            const predicciones = ingredientes.map(ing => {
                const dias = parseFloat(ing.stockActual) / parseFloat(ing.tasaConsumo);
                const alerta = parseFloat(ing.stockActual) <= parseFloat(ing.stockMinimo);
                return {
                    nombre:    ing.nombreIngrediente,
                    stockActual: parseFloat(ing.stockActual),
                    diasRestantes: dias > 9999 ? '∞' : dias.toFixed(1),
                    alerta
                };
            });

            // IO Simplex — maximizar ganancia dado stock actual
            const solver = require('javascript-lp-solver');
            const [platosConCosto] = await db.query(`
                SELECT m.idMenu, m.nombrePlato, m.precioActual,
                       COALESCE(SUM(i.precioActualCompra * mi.cantidadRequerida), 0) AS costoProduccion
                FROM Menu m
                LEFT JOIN MenuIngrediente mi ON m.idMenu = mi.idMenu
                LEFT JOIN Ingrediente i ON mi.idIngrediente = i.idIngrediente
                GROUP BY m.idMenu, m.nombrePlato, m.precioActual
                LIMIT 5
            `);

            let simplexMsg = 'Datos insuficientes para optimización';
            if (platosConCosto.length >= 2) {
                const constraints = {};
                const variables   = {};

                // Restricción de tiempo de producción (asumimos 8h = 480 min, ~10 min por plato)
                constraints['tiempo'] = { max: 480 };

                platosConCosto.forEach(p => {
                    const ganancia = parseFloat(p.precioActual) - parseFloat(p.costoProduccion);
                    const clave = p.nombrePlato.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                    variables[clave] = { ganancia: Math.max(ganancia, 0), tiempo: 10 };
                });

                const modelo = {
                    optimize:    'ganancia',
                    opType:      'max',
                    constraints,
                    variables
                };
                try {
                    const resultado = solver.Solve(modelo);
                    const items = Object.entries(resultado)
                        .filter(([k]) => k !== 'feasible' && k !== 'result' && k !== 'bounded')
                        .map(([k, v]) => `${Math.round(v)} ${k.replace(/_/g, ' ')}`)
                        .join(', ');
                    simplexMsg = items
                        ? `Combinación óptima: ${items} → Ganancia máx: ${resultado.result?.toFixed(2)} Bs.`
                        : 'Sin solución factible con los datos actuales';
                } catch {
                    simplexMsg = 'Error en cálculo de optimización';
                }
            }

            res.json({ predicciones, simplex: simplexMsg });
        } catch (error) {
            console.error('obtenerModelosMatematicos:', error);
            res.status(500).json({ error: "Error calculando modelos matemáticos." });
        }
    },

};

module.exports = moduloVentas;