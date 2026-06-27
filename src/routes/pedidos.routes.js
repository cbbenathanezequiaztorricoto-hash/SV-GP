// SV_GP/src/routes/pedidos.routes.js
const express = require('express');
const router = express.Router();
// ✅ db se importa UNA vez al cargar el módulo, no en cada request
const db = require('../backend/common/conexion');
const moduloPedidos = require('../backend/gestionPedidos/moduloGestionPedidos');

// ============================================================
// REGLA: Rutas estáticas SIEMPRE antes de rutas con parámetros
// ============================================================

// --- Rutas estáticas (sin parámetros) ---
router.get('/cocina',   moduloPedidos.obtenerCocina);
router.get('/mesas',    moduloPedidos.obtenerMesas);

// ✅ FIX PRINCIPAL: ruta movida arriba + db en scope correcto + error descriptivo
router.get('/tipos', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM TipoPedido');
        res.json(rows);
    } catch (error) {
        // ✅ Ahora expone el mensaje real para diagnóstico
        console.error('[/api/pedidos/tipos] Error SQL:', error.message);
        res.status(500).json({ error: error.message });
    }
});
// Nuevas rutas para cocina con filtro y delivery
router.get('/cocina/lista', moduloPedidos.obtenerPedidosCocinaConFiltro);
router.get('/delivery', moduloPedidos.obtenerPedidosDelivery);
router.put('/delivery/:id/entregar', moduloPedidos.entregarPedidoDelivery);


router.post('/cocina/despachar', moduloPedidos.despacharCocina);
router.post('/pos', moduloPedidos.registrarPedido);

// --- Rutas dinámicas (con :id) SIEMPRE al final ---
router.get('/',              moduloPedidos.listarPedidos);
router.get('/:id',           moduloPedidos.obtenerPedido);
router.put('/:id/completar', moduloPedidos.completarPedido);
router.put('/:id',           moduloPedidos.editarPedido);
router.delete('/:id',        moduloPedidos.cancelarPedido);

module.exports = router;