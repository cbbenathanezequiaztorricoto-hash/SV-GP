'use strict';

let idPedidoSeleccionadoVenta = null;
let totalPedidoSeleccionadoVenta = 0;

// ============================================================
// INICIALIZACIÓN — llamada por navUnificada al entrar al sub-módulo
// ============================================================
function inicializarModuloVentas() {
    cargarPedidosParaCobro();
    cargarMetodosPagoVentas();
    cargarModelosMatematicos();

    const form = document.getElementById('formCobro');
    if (form && !form.dataset.handler) {
        form.addEventListener('submit', confirmarPagoEImprimir);
        form.dataset.handler = 'true';
    }

    const nitInput = document.getElementById('cobro-nit');
    if (nitInput && !nitInput.dataset.autofillHandler) {
        let timeoutId;
        nitInput.addEventListener('input', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => buscarClientePorNit(nitInput.value), 400);
        });
        nitInput.dataset.autofillHandler = 'true';
    }
}

function inicializarCierreCaja() {
    //console.log('🔄 inicializarCierreCaja ejecutándose');

    cargarResumenCierre();
}

// ============================================================
// GESTIONAR VENTA — listar pedidos entregados
// ============================================================
async function cargarPedidosParaCobro() {
    const tbody = document.getElementById('tablaCobrosCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res     = await fetch('/api/ventas/pendientes-cobro');
        const pedidos = await res.json();

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No hay comandas entregadas pendientes de cobro.</td></tr>';
            return;
        }
        //-=ROLES Y PERMISOS: editar/mostrar/ocultar botones según permisos del usuario=-
        const puedeCobrar = window.tienePermiso('sub-gestionar-ventas', 'editar') || window.tienePermiso('sub-gestionar-ventas', 'insertar');
        
        tbody.innerHTML = pedidos.map(p => {
            const imgHTML   = p.imagenPrincipal
                ? `<img src="${p.imagenPrincipal}" style="width:80px;height:65px;object-fit:cover;border-radius:6px;">`
                : `<span style="color:#999;font-size:12px;">Sin imagen</span>`;
            const ubicacion = p.numeroMesa
                ? `Mesa ${p.numeroMesa}`
                : (p.nombreLlevar || p.referenciaLlevar || p.nombreTipo);

            return `
            <tr>
                <td><strong>#${p.idPedido}</strong></td>
                <td style="text-align:center;">${imgHTML}</td>
                <td><span class="badge" style="background:var(--primary);color:white;">${ubicacion}</span></td>
                <td style="font-size:0.85rem;">${p.detallesAgrupados || '—'}</td>
                <td style="font-weight:bold;">${parseFloat(p.totalPedido).toFixed(2)} Bs.</td>
                <td>
                    ${puedeCobrar ? `<button class="btn-submit" style="background:var(--success);min-width:120px;"
                        onclick="abrirPanelPago(${p.idPedido}, ${p.totalPedido})">
                        Liquidar
                    </button> ` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error de conexión al cargar comandas.</td></tr>';
    }
}

async function cargarMetodosPagoVentas() {
    try {
        const res     = await fetch('/api/ventas/metodos-pago');
        const metodos = await res.json();
        const sel     = document.getElementById('idMetodoPagoCobro');
        if (!sel) return;
        sel.innerHTML = metodos.map(m =>
            `<option value="${m.idMetodoPago}" data-qr="${m.qr_url || ''}">${m.nombreMetodo}</option>`
        ).join('');
    } catch (err) {
        console.error("Error cargando métodos de pago", err);
    }
}

function abrirPanelPago(idPedido, total) {
    idPedidoSeleccionadoVenta    = idPedido;
    totalPedidoSeleccionadoVenta = parseFloat(total);

    const txtId    = document.getElementById('txtIdPedido');
    const txtTotal = document.getElementById('txtMontoTotal');
    const panel    = document.getElementById('panelProcesarPago');
    const inputRec = document.getElementById('montoRecibido');
    const txtCambio= document.getElementById('txtCambio');

    if (txtId)    txtId.innerText    = idPedido;
    if (txtTotal) txtTotal.innerText = totalPedidoSeleccionadoVenta.toFixed(2);
    if (inputRec) inputRec.value     = '';
    if (txtCambio)txtCambio.innerText= '0.00 Bs.';
    if (panel) {
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    }
}

function calcularCambio() {
    const recibido  = parseFloat(document.getElementById('montoRecibido').value) || 0;
    const cambio    = recibido - totalPedidoSeleccionadoVenta;
    const txtCambio = document.getElementById('txtCambio');
    if (!txtCambio) return;
    if (cambio >= 0) {
        txtCambio.innerText   = `${cambio.toFixed(2)} Bs.`;
        txtCambio.style.color = 'var(--success)';
    } else {
        txtCambio.innerText   = '0.00 Bs.';
        txtCambio.style.color = 'var(--text-light)';
    }
}

function cancelarCobro() {
    idPedidoSeleccionadoVenta = null;
    const panel = document.getElementById('panelProcesarPago');
    if (panel) panel.style.display = 'none';
}

async function confirmarPagoEImprimir(e) {
    e.preventDefault();

    const selMetodo   = document.getElementById('idMetodoPagoCobro');
    const idMetodoPago= selMetodo.value;
    const opt         = selMetodo.options[selMetodo.selectedIndex];
    const qrUrl       = opt ? opt.getAttribute('data-qr') : '';

    // ✅ Capturar datos opcionales del cliente
    const nitCi         = (document.getElementById('cobro-nit')?.value    || '').trim();
    const nombreCliente = (document.getElementById('cobro-nombre')?.value || '').trim();

    try {
        const response = await fetch(`/api/ventas/procesar-cobro/${idPedidoSeleccionadoVenta}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ idMetodoPago, nitCi, nombreCliente })
        });
        const data = await response.json();

        if (response.ok) {
            // Mostrar QR si aplica
            if (qrUrl) mostrarModalQRVentas(qrUrl, opt.text);

            imprimirTicket(
                idPedidoSeleccionadoVenta,
                data.nroFactura,
                totalPedidoSeleccionadoVenta,
                nombreCliente || 'Cliente',
                opt.text
            );

            // Limpiar campos de cliente
            const inputNit    = document.getElementById('cobro-nit');
            const inputNombre = document.getElementById('cobro-nombre');
            if (inputNit)    inputNit.value    = '';
            if (inputNombre) inputNombre.value = '';

            cancelarCobro();
            cargarPedidosParaCobro();
        } else {
            alert('❌ ' + (data.error || 'Error al cobrar'));
        }
    } catch {
        alert('Error de red procesando la venta.');
    }
}

async function buscarClientePorNit(nit) {
    const nombreInput = document.getElementById('cobro-nombre');
    if (!nit || nit.trim().length < 3 || !nombreInput) return;
    try {
        const res = await fetch(
            `/api/admin/clientes?nit=${encodeURIComponent(nit.trim())}`,
        );
        if (!res.ok) return;
        const cliente = await res.json();
        if (cliente && cliente.primerNombre) {
            const nombres = [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido]
                .filter(Boolean)
                .join(' ');
            if (nombres) nombreInput.value = nombres;
        }
    } catch (error) {
        console.error('buscarClientePorNit:', error);
    }
}

// ============================================================
// MODAL QR en módulo ventas (reutiliza misma lógica que pedidos)
// ============================================================
function mostrarModalQRVentas(qrUrl, nombreMetodo) {
    let modal = document.getElementById('modal-qr-ventas');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-qr-ventas';
        modal.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.75);z-index:9999;
            display:flex;align-items:center;justify-content:center;`;
        modal.innerHTML = `
            <div style="background:white;border-radius:14px;padding:32px;text-align:center;
                        max-width:380px;width:92%;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
                <h3 id="qrv-titulo" style="margin:0 0 16px;color:#2c3e50;">Pago con QR</h3>
                <img id="qrv-img" src="" alt="QR"
                     style="width:270px;height:270px;object-fit:contain;
                            border:2px solid #eee;border-radius:10px;">
                <p style="margin:14px 0 0;color:#7f8c8d;font-size:13px;">
                    Muestre al cliente para escanear
                </p>
                <button onclick="cerrarModalQRVentas()"
                    style="margin-top:18px;background:#e74c3c;color:white;border:none;
                           padding:11px 32px;border-radius:8px;cursor:pointer;
                           font-size:15px;font-weight:bold;">
                    Cerrar
                </button>
            </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('qrv-titulo').innerText = `Pago: ${nombreMetodo}`;
    document.getElementById('qrv-img').src          = qrUrl;
    modal.style.display = 'flex';
}

function cerrarModalQRVentas() {
    const modal = document.getElementById('modal-qr-ventas');
    if (modal) modal.style.display = 'none';
}

// ============================================================
// IMPRESIÓN DE TICKET
// ============================================================
function imprimirTicket(idPedido, nroFactura, total, nombreCliente, metodoPago) {
    const fecha  = new Date().toLocaleString('es-BO');
    const cajero = localStorage.getItem('username') || 'Administrador';

    const win = window.open('', '', 'width=420,height=620');
    win.document.write(`
        <html>
        <head>
            <style>
                body { font-family: monospace; font-size: 13px; margin: 0; padding: 12px; width: 300px; }
                .center { text-align: center; }
                .bold   { font-weight: bold; }
                .divider{ border-top: 1px dashed #333; margin: 12px 0; }
                table   { width: 100%; border-collapse: collapse; }
                td      { padding: 4px 0; vertical-align: top; }
                .right  { text-align: right; }
            </style>
        </head>
        <body>
            <div class="center">
                <p class="bold" style="font-size:16px;margin:0;">RESTAURANTE EL RECUERDO</p>
                <p style="margin:2px 0;font-size:11px;">Av. Simón Bolívar camino a Sipe Sipe</p>
                <p style="margin:2px 0;font-size:11px;">Tel: 4381720</p>
            </div>
            <div class="divider"></div>
            <table>
                <tr><td>Factura N°:</td>   <td class="right bold">${nroFactura || '—'}</td></tr>
                <tr><td>Pedido:</td>        <td class="right">#${idPedido}</td></tr>
                <tr><td>Fecha:</td>         <td class="right">${fecha}</td></tr>
                <tr><td>Cliente:</td>       <td class="right">${nombreCliente}</td></tr>
                <tr><td>Atendido por:</td>  <td class="right">${cajero}</td></tr>
                <tr><td>Método pago:</td>   <td class="right">${metodoPago}</td></tr>
            </table>
            <div class="divider"></div>
            <table>
                <tr>
                    <td class="bold" style="font-size:15px;">TOTAL PAGADO:</td>
                    <td class="right bold" style="font-size:15px;">${total.toFixed(2)} Bs.</td>
                </tr>
            </table>
            <div class="divider"></div>
            <p class="center bold">¡Gracias por su visita!</p>
        </body>
        </html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 700);
}

// ============================================================
// CIERRE DE CAJA
// ============================================================
async function cargarResumenCierre() {
    //console.log('📡 Entrando a cargarResumenCierre');
    try {
        //console.log('🔍 Haciendo fetch a /api/ventas/resumen-cierre');
        const res = await fetch('/api/ventas/resumen-cierre');
        //console.log('✅ Respuesta recibida, status:', res.status);
        if (!res.ok) {
            const text = await res.text();
            console.error('❌ Error en resumen de cierre:', text);
            return;
        }
        const data = await res.json();
        //console.log('📊 Datos recibidos:', data);

        const el = id => document.getElementById(id);
        if (el('cierre-total-calculado')) {
            el('cierre-total-calculado').innerText = `${parseFloat(data.totalCalculado || 0).toFixed(2)} Bs.`;
        }
        if (el('cierre-cantidad')) {
            el('cierre-cantidad').innerText = data.cantidadFacturas || 0;
        }
        if (el('cierre-efectivo')) {
            el('cierre-efectivo').innerText = `${parseFloat(data.totalEfectivo || 0).toFixed(2)} Bs.`;
        }
        if (el('cierre-digital')) {
            el('cierre-digital').innerText = `${parseFloat(data.totalDigital || 0).toFixed(2)} Bs.`;
        }
    } catch (err) {
        console.error('❌ Error en cargarResumenCierre:', err);
    }
}

async function ejecutarCierreCaja() {
    const inputReal = document.getElementById('cierre-monto-real');
    if (!inputReal || !inputReal.value) return alert('Ingrese el monto real contado.');
    const montoReal = parseFloat(inputReal.value);
    if (isNaN(montoReal) || montoReal < 0) return alert('Monto inválido.');

    if (!confirm(`¿Cerrar caja con Bs. ${montoReal.toFixed(2)} en efectivo real?`)) return;

    try {
        const res = await fetch('/api/ventas/cierre-caja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                montoReal,
                idEmpleado: localStorage.getItem('idUsuario')
            })
        });
        const data = await res.json();
        if (res.ok) {
            // Mostrar mensaje...
            await cargarResumenCierre();
            // Obtener la fecha del resumen (o usar hoy)
            const fechaResumen = document.getElementById('cierre-total-calculado')?.dataset?.fecha || new Date().toISOString().split('T')[0];
            await descargarReporteExcel(fechaResumen);
        }
    } catch {
        alert('Error de red al ejecutar cierre de caja.');
    }
}

// Modificar descargarReporteExcel para aceptar fecha
async function descargarReporteExcel(fecha) {
    try {
        const url = fecha ? `/api/ventas/reporte/excel?fecha=${fecha}` : '/api/ventas/reporte/excel';
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.error('Error generando Excel:', text);
            return alert('No se pudo generar el reporte Excel. Revise el servidor.');
        }
        const blob = await res.blob();
        const urlBlob = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_ElRecuerdo_${fecha || new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(urlBlob);
    } catch (err) {
        console.error('descargarReporteExcel:', err);
        alert('Error al descargar el reporte Excel.');
    }
}

async function cargarModelosMatematicos() {
    const divPredicciones = document.getElementById('modelos-predicciones');
    const divSimplex      = document.getElementById('modelos-simplex');
    if (!divPredicciones) return;
 
    divPredicciones.innerHTML = '<p style="color:var(--text-light);">Calculando modelos...</p>';
    if (divSimplex) divSimplex.innerHTML = '';
 
    try {
        const res  = await fetch('/api/ventas/modelos');
        if (!res.ok) throw new Error('Error servidor');
        const data = await res.json();
 
        // ── ECUACIONES DIFERENCIALES: predicción de stock ────────────────
        if (data.predicciones && data.predicciones.length > 0) {
            const filasEDO = data.predicciones.map(p => {
                const color  = p.alerta ? '#e74c3c' : '#27ae60';
                const icono  = p.alerta ? '⚠️' : '✅';
                const dias   = p.diasRestantes === '∞' ? 'Sin consumo registrado' : `${p.diasRestantes} días`;
                return `
                <tr style="${p.alerta ? 'background:#fff5f5;' : ''}">
                    <td>${icono} <strong>${p.nombre}</strong></td>
                    <td>${p.stockActual.toFixed(2)}</td>
                    <td style="color:${color};font-weight:bold;">${dias}</td>
                    <td>
                        <span class="badge" style="background:${color};color:white;">
                            ${p.alerta ? 'Stock Bajo' : 'OK'}
                        </span>
                    </td>
                </tr>`;
            }).join('');
 
            divPredicciones.innerHTML = `
                <h4 style="margin:0 0 8px;">Ecuaciones Diferenciales — Predicción de Agotamiento</h4>
                <p style="color:var(--text-light);font-size:13px;margin:0 0 10px;">
                    Modelo: dS/dt = −tasa · dt → S(t) = S₀ − tasa × t
                </p>
                <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Ingrediente</th>
                            <th>Stock Actual</th>
                            <th>Días Estimados</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>${filasEDO}</tbody>
                </table>
                </div>`;
        } else {
            divPredicciones.innerHTML = '<p style="color:#999;">No hay ingredientes registrados para calcular.</p>';
        }
 
        // ── IO SIMPLEX: combinación óptima de producción ─────────────────
        if (divSimplex) {
            divSimplex.innerHTML = `
                <h4 style="margin:12px 0 8px;">Investigación Operativa - Optimización con Simplex</h4>
                <p style="color:var(--text-light);font-size:13px;margin:0 0 10px;">
                    Maximiza ganancia diaria sujeta a tiempo de producción (480 min/día).
                </p>
                <div class="card" style="border-left:4px solid #27ae60;">
                    <p style="margin:0;font-size:15px;">${data.simplex || 'Sin datos suficientes.'}</p>
                </div>`;
        }
 
    } catch (err) {
        console.error('cargarModelosMatematicos:', err);
        divPredicciones.innerHTML = '<p style="color:red;">Error al calcular los modelos matemáticos.</p>';
    }
}