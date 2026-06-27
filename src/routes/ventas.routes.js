// src/routes/ventas.routes.js
const express = require('express');
const router  = express.Router();
const moduloVentas = require('../backend/ventas/moduloVentas');

// Gestionar Venta
router.get('/pendientes-cobro',            moduloVentas.obtenerPedidosPendientesCobro);
router.get('/metodos-pago',                moduloVentas.obtenerMetodosPago);
router.put('/procesar-cobro/:idPedido',    moduloVentas.procesarCobro);

// Cierre de Caja
router.get('/resumen-cierre',              moduloVentas.obtenerResumenParaCierre);
router.post('/cierre-caja',               moduloVentas.ejecutarCierreCaja);

// Reportes
router.get('/reporte-diario',              moduloVentas.obtenerReporteDiario);
router.get('/reporte/excel', moduloVentas.descargarReporteExcel);
// Ya está, pero asegúrate de que acepte query params.

// Modelos matemáticos (IO + Ecuaciones Diferenciales)
router.get('/modelos',                     moduloVentas.obtenerModelosMatematicos);



module.exports = router;