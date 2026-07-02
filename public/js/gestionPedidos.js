// SV_GP/public/js/gestionPedidos.js
'use strict';

let menuGlobalPOS = [];
let carritoPOS    = [];
let pedidoModalDetalles = [];
let pedidoModalId = null;

// ============================================================
// INICIALIZACIÓN — llamada por navUnificada al entrar al módulo
// ============================================================
async function inicializarModuloPOS() {
    await cargarSelectsDinamicosPOS();
    await cargarMenuVisual();
}

async function cargarSelectsDinamicosPOS() {
    try {
        // Tipos de pedido
        const resTipos = await fetch('/api/pedidos/tipos');
        if (!resTipos.ok) throw new Error('tipos');
        const tipos = await resTipos.json();
        const selTipo = document.getElementById('pos-tipo-pedido');
        if (selTipo) selTipo.innerHTML = tipos.map(t =>
            `<option value="${t.idTipoPedido}">${t.nombreTipo}</option>`
        ).join('');
    } catch (e) {
        console.error("Error cargando selects dinámicos", e);
    }
}

// ============================================================
// REEMPLAZA cargarMenuVisual() en gestionPedidos.js
// Agrega filtro dinámico por categoría sin fetch extra
// ============================================================

async function cargarMenuVisual() {
    const grid = document.getElementById('pos-grid-productos');
    if (!grid) return;

    try {
        const response = await fetch('/api/admin/menu');
        if (!response.ok) throw new Error('Error menú');
        menuGlobalPOS = await response.json();

        if (menuGlobalPOS.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No hay productos en el menú.</p>';
            return;
        }

        // Extraer categorías
        const categoriasUnicas = [...new Map(
            menuGlobalPOS
                .filter(i => i.nombreCategoria)
                .map(i => [i.idCategoria, { id: i.idCategoria, nombre: i.nombreCategoria }])
        ).values()];

        grid.innerHTML = `
            <div id="pos-filtros-categoria" class="pos-filtros">
                <button type="button" class="btn-filtro-cat activo" data-cat="todos"
                    onclick="filtrarCategoriaPOS(this, 'todos')">Todos</button>
                ${categoriasUnicas.map(c => `
                <button type="button" class="btn-filtro-cat" data-cat="${c.id}"
                    onclick="filtrarCategoriaPOS(this, '${c.id}')">${c.nombre}</button>`).join('')}
            </div>
            
            <div id="pos-items-grid" class="pos-items-grid">
                ${menuGlobalPOS.map(item => `
                <button type="button" class="btn-producto" data-cat="${item.idCategoria}"
                    onclick="agregarAlCarritoPOS(${item.idMenu})">
                    <img src="${item.imagen_url || '../assets/logo.jpg'}" 
                         onerror="this.src='../assets/logo.jpg'" 
                         alt="${item.nombrePlato}">
                    <span class="prod-nombre">${item.nombrePlato}</span>
                    <span class="prod-precio">${parseFloat(item.precioActual).toFixed(2)} Bs.</span>
                </button>`).join('')}
            </div>`;
    } catch (error) {
        console.error("Error cargando menú visual", error);
        grid.innerHTML = '<p style="text-align:center;color:red;padding:20px;">Error al cargar productos.</p>';
    }
}

// ✅ Filtro de categoría — muestra/oculta botones del grid
function filtrarCategoriaPOS(boton, idCat) {
    document.querySelectorAll('#pos-filtros-categoria .btn-filtro-cat').forEach(btn => {
        const activo = btn === boton;
        btn.style.background    = activo ? 'var(--primary)' : 'transparent';
        btn.style.color         = activo ? 'white'          : 'var(--primary)';
    });
    document.querySelectorAll('#pos-items-grid .btn-producto').forEach(item => {
        item.style.display = (idCat === 'todos' || item.getAttribute('data-cat') == idCat)
            ? 'flex' : 'none';
    });
}

// ============================================================
// CARRITO
// ============================================================

function agregarAlCarritoPOS(idMenu) {
    const plato = menuGlobalPOS.find(m => m.idMenu == idMenu);
    if (!plato) return;
    const existente = carritoPOS.find(i => i.idMenu == idMenu);
    if (existente) {
        existente.cantidad++;
    } else {
        carritoPOS.push({
            idMenu:   plato.idMenu,
            nombre:   plato.nombrePlato,
            precio:   parseFloat(plato.precioActual),
            cantidad: 1,
            notasExtra: null
        });
    }
    renderizarCarritoPOS();
}

function modificarCantidad(index, delta) {
    carritoPOS[index].cantidad += delta;
    if (carritoPOS[index].cantidad <= 0) carritoPOS.splice(index, 1);
    renderizarCarritoPOS();
}

function renderizarCarritoPOS() {
    const tbody = document.getElementById('cuerpo-carrito');
    const spanTotal = document.getElementById('pos-total-pagar');
    if (!tbody || !spanTotal) {
        console.warn('[renderizarCarritoPOS] Elementos del carrito no encontrados en DOM.');
        return;
    }

    let total = 0;

    if (carritoPOS.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px;">Toque un producto para añadir</td></tr>';
        spanTotal.innerText = '0.00';
        return;
    }

    tbody.innerHTML = carritoPOS.map((item, index) => {
        const sub = item.precio * item.cantidad;
        total += sub;
        return `
        <tr>
            <td style="width:90px;">
                <button style="border:none;background:#eee;border-radius:4px;padding:4px 8px;cursor:pointer;"
                    onclick="modificarCantidad(${index}, -1)">−</button>
                <span style="font-weight:bold;margin:0 5px;">${item.cantidad}</span>
                <button style="border:none;background:#eee;border-radius:4px;padding:4px 8px;cursor:pointer;"
                    onclick="modificarCantidad(${index}, 1)">+</button>
            </td>
            <td style="font-weight:bold;font-size:13px;">${item.nombre}</td>
            <td>${item.precio.toFixed(2)}</td>
            <td style="text-align:right;font-weight:bold;">${sub.toFixed(2)}</td>
            <td style="text-align:center;">
                <button onclick="modificarCantidad(${index}, -99)"
                    style="color:red;background:none;border:none;cursor:pointer;font-weight:bold;font-size:16px;">✕</button>
            </td>
        </tr>`;
    }).join('');

    spanTotal.innerText = total.toFixed(2);
}

function obtenerCategoriasMenu() {
    return [...new Map(
        menuGlobalPOS
            .filter(i => i.nombreCategoria)
            .map(i => [i.idCategoria, { id: i.idCategoria, nombre: i.nombreCategoria }])
    ).values()];
}

// ============================================================
// FUNCIONES PARA EL MODAL DE EDICIÓN DE PEDIDO
// ============================================================

function agregarAlPedidoModal(idMenu) {
    const plato = menuGlobalPOS.find(m => m.idMenu == idMenu);
    if (!plato) return;
    const existente = pedidoModalDetalles.find(i => i.idMenu == idMenu);
    if (existente) {
        existente.cantidad++;
    } else {
        pedidoModalDetalles.push({
            idMenu:   plato.idMenu,
            nombre:   plato.nombrePlato,
            precio:   parseFloat(plato.precioActual),
            cantidad: 1,
            notasExtra: null
        });
    }
    renderizarPedidoModalCarrito();
}

function cambiarCantidadPedidoModal(index, delta) {
    pedidoModalDetalles[index].cantidad += delta;
    if (pedidoModalDetalles[index].cantidad <= 0) {
        pedidoModalDetalles.splice(index, 1);
    }
    renderizarPedidoModalCarrito();
}

function renderizarPedidoModalCarrito() {
    const carritoCont = document.getElementById('pedido-modal-carrito');
    if (!carritoCont) return;

    const totalPedido = pedidoModalDetalles.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

    if (pedidoModalDetalles.length === 0) {
        carritoCont.innerHTML = '<p style="color:#999;text-align:center;">No hay ítems en el pedido. Agregue productos desde el menú.</p>';
    } else {
        carritoCont.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h4 style="margin:0;">Carrito del pedido</h4>
                <span style="font-size:0.95rem;color:#666;">Total: ${totalPedido.toFixed(2)} Bs.</span>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="text-align:left;color:#555;font-size:0.95rem;">
                        <th>Cant.</th>
                        <th>Producto</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${pedidoModalDetalles.map((item, index) => `
                        <tr style="border-top:1px solid #eee;">
                            <td style="padding:8px 4px;">${item.cantidad}</td>
                            <td style="padding:8px 4px;">${item.nombre}</td>
                            <td style="padding:8px 4px;">${item.precio.toFixed(2)}</td>
                            <td style="padding:8px 4px;">${(item.precio * item.cantidad).toFixed(2)}</td>
                            <td style="padding:8px 4px;text-align:right;">
                                <button type="button" style="border:none;background:transparent;color:#e74c3c;cursor:pointer;font-size:1.1rem;" onclick="cambiarCantidadPedidoModal(${index}, -1)">−</button>
                                <button type="button" style="border:none;background:transparent;color:#2ecc71;cursor:pointer;font-size:1.1rem;" onclick="cambiarCantidadPedidoModal(${index}, 1)">+</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    }

    const totalSpan = document.getElementById('editar-total-pedido');
    if (totalSpan) {
        totalSpan.innerText = `${totalPedido.toFixed(2)} Bs.`;
    }
}

function renderizarPedidoModalMenu() {
    const menuCont = document.getElementById('pedido-modal-menu');
    if (!menuCont) return;

    if (menuGlobalPOS.length === 0) {
        menuCont.innerHTML = '<p style="color:#999;text-align:center;">El menú no está cargado. Recargue la página o vuelva a entrar al módulo.</p>';
        return;
    }

    const categorias = obtenerCategoriasMenu();
    const botones = [`
        <button type="button" class="btn-filtro-cat activo" data-cat="todos" onclick="filtrarPedidoModalCategoria(this, 'todos')">Todos</button>`,
        ...categorias.map(c => `
            <button type="button" class="btn-filtro-cat" data-cat="${c.id}" onclick="filtrarPedidoModalCategoria(this, '${c.id}')">${c.nombre}</button>`)
    ].join('');

    menuCont.innerHTML = `
        <div id="pedido-modal-filtros" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            ${botones}
        </div>
        <div id="pedido-modal-items" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;max-height:280px;overflow:auto;"></div>`;

    const itemsCont = document.getElementById('pedido-modal-items');
    itemsCont.innerHTML = menuGlobalPOS.map(item => `
        <button type="button" class="btn-producto" data-cat="${item.idCategoria}" onclick="agregarAlPedidoModal(${item.idMenu})"
            style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:10px;border:1px solid #ddd;border-radius:10px;background:#fff;cursor:pointer;">
            <span style="font-size:0.95rem;font-weight:bold;">${item.nombrePlato}</span>
            <span style="font-size:0.85rem;color:#666;">${parseFloat(item.precioActual).toFixed(2)} Bs.</span>
        </button>`).join('');
}

function filtrarPedidoModalCategoria(boton, idCat) {
    document.querySelectorAll('#pedido-modal-filtros .btn-filtro-cat').forEach(btn => {
        const activo = btn === boton;
        btn.style.background = activo ? 'var(--primary)' : 'transparent';
        btn.style.color = activo ? 'white' : 'var(--primary)';
    });
    document.querySelectorAll('#pedido-modal-items .btn-producto').forEach(item => {
        item.style.display = (idCat === 'todos' || item.getAttribute('data-cat') == idCat) ? 'flex' : 'none';
    });
}

// ============================================================
// TOGGLE REFERENCIA Y MAPS
// ============================================================
function toggleReferencia() {
    const sel = document.getElementById('pos-tipo-pedido');
    const refText = document.getElementById('pos-referencia');
    const mesaSelect = document.getElementById('pos-mesa');
    const mesaGroup = document.getElementById('pos-mesa-group');
    const refTextGroup = document.getElementById('pos-ref-text-group');
    const dirGroup = document.getElementById('pos-direccion-group');
    const mapsBtn = document.getElementById('btn-maps');

    if (!sel) return;

    const tipo = sel.value;
    // Ocultar todo
    mesaGroup.style.display = 'none';
    refTextGroup.style.display = 'none';
    if (dirGroup) dirGroup.style.display = 'none';
    if (mapsBtn) mapsBtn.style.display = 'none';

    if (tipo === '1') { // Mesa
        mesaGroup.style.display = 'block';
        cargarMesasSelect(); // solo llena el select del POS (id 'pos-mesa')
    } else if (tipo === '2') { // Para Llevar
        refTextGroup.style.display = 'block';
        refText.placeholder = 'Nombre de quien retira';
    } else if (tipo === '3') { // Delivery
        refTextGroup.style.display = 'block';
        refText.placeholder = 'Nombre del destinatario';
        if (dirGroup) dirGroup.style.display = 'block';
        if (mapsBtn) mapsBtn.style.display = 'inline-block';
    }
}

async function cargarMesasSelect(selectId = 'pos-mesa') {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const res = await fetch('/api/pedidos/mesas');
        const mesas = await res.json();
        select.innerHTML = '<option value="">Seleccione mesa...</option>';
        mesas.forEach(m => {
            select.innerHTML += `<option value="${m.numeroMesa}">Mesa ${m.numeroMesa} (Cap: ${m.capacidad})</option>`;
        });
    } catch (error) {
        console.error('Error cargando mesas:', error);
        select.innerHTML = '<option value="">Error al cargar mesas</option>';
    }
}

function abrirMaps() {
    const direccion = document.getElementById('pos-direccion').value.trim();
    if (!direccion) {
        alert('Ingrese la dirección antes de buscar en Maps.');
        return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
    const gpsInput = document.getElementById('pos-gps');
    if (gpsInput) {
        gpsInput.value = url;
    }
}

// ============================================================
// PROCESAR PEDIDO — llamado al confirmar pedido en POS
// ============================================================

async function registrarPedido() {
    if (carritoPOS.length === 0) return alert("Añada productos a la orden.");

    const idTipoPedido = document.getElementById('pos-tipo-pedido').value;
    let referencia = '';

    if (idTipoPedido === '1') {
        referencia = document.getElementById('pos-mesa').value;
        if (!referencia) return alert('Seleccione una mesa.');
    } else {
        referencia = document.getElementById('pos-referencia').value.trim();
        if (!referencia) return alert('Ingrese el nombre del cliente.');
    }

    const direccion = document.getElementById('pos-direccion')?.value.trim() || null;
    const gps = document.getElementById('pos-gps')?.value.trim() || null;

    if (idTipoPedido == 3 && !direccion) return alert("Para Delivery, ingrese la dirección.");

    const total = parseFloat(document.getElementById('pos-total-pagar').innerText) || 0;

    const payload = {
        idTipoPedido,
        referencia,
        total,
        idEmpleado: localStorage.getItem('idUsuario') || 1,
        direccion_entrega: direccion,
        gps_ubicacion: gps,
        detalles: carritoPOS.map(i => ({
            idMenu:     i.idMenu,
            cantidad:   i.cantidad,
            precio:     i.precio,
            notasExtra: i.notasExtra || null
        }))
    };

    try {
        const response = await fetch('/api/pedidos/pos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            carritoPOS = [];
            renderizarCarritoPOS();
            document.getElementById('pos-referencia').value = '';
            document.getElementById('pos-direccion').value = '';
            document.getElementById('pos-gps').value = '';
            document.getElementById('pos-mesa').value = '';
            alert(`✅ Pedido #${data.idPedido} creado y enviado a cocina.`);
        } else {
            alert('❌ ' + (data.error || 'Error al procesar la orden.'));
        }
    } catch (error) {
        console.error("Error: ", error);
        alert('Error al registrar el pedido.');
    }
}

// ============================================================
// PEDIDOS DELIVERY
// ============================================================

async function cargarDelivery() {
    const tbody = document.getElementById('tablaDeliveryCuerpo');
    if (!tbody) return;
    const estadoFiltro = document.getElementById('filtro-delivery-estado')?.value || 'Pendiente';
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Cargando...</td></tr>';

    try {
        const res = await fetch(`/api/pedidos/delivery?estado=${estadoFiltro}`);
        if (!res.ok) throw new Error('Error al cargar delivery');
        const pedidos = await res.json();

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">No hay pedidos Delivery en este estado.</td></tr>';
            return;
        }

        const puedeEditar = window.tienePermiso('sub-delivery', 'editar') || window.tienePermiso('sub-delivery', 'insertar');
        const puedeMarcarEntregado = window.tienePermiso('sub-delivery', 'editar');

        tbody.innerHTML = pedidos.map(p => {
            const items = Array.isArray(p.detalles)
                ? p.detalles.map(d => `${d.cantidad}x ${d.nombrePlato}`).join('<br>')
                : 'Sin detalle';
            const enlaceMap = p.gps_ubicacion ? `<a href="${p.gps_ubicacion}" target="_blank">📍 Ver en Maps</a>` : (p.direccion_entrega ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_entrega)}" target="_blank">📍 Ver en Maps</a>` : 'Sin ubicación');

            const estadoBadge = p.estadoPedido === 'Pendiente' ? '#f39c12' :
                               p.estadoPedido === 'En Preparacion' ? '#3498db' :
                               p.estadoPedido === 'Entregado' ? '#27ae60' : '#95a5a6';

            return `
            <tr>
                <td><strong>#${p.idPedido}</strong></td>
                <td>${p.nombreLlevar || p.referenciaLlevar || '—'}</td>
                <td>${p.direccion_entrega || '—'}</td>
                <td>${enlaceMap}</td>
                <td>${items}</td>
                <td>${parseFloat(p.totalPedido).toFixed(2)} Bs.</td>
                <td><span class="badge" style="background:${estadoBadge};color:white;">${p.estadoPedido}</span></td>
                <td>
                    ${puedeMarcarEntregado && p.estadoPedido !== 'Entregado' && p.estadoPedido !== 'Pagado' && p.estadoPedido !== 'Cancelado' ? `<button class="btn-submit btn-sm" onclick="marcarEntregadoDelivery(${p.idPedido})">Marcar Entregado</button>` : ''}
                    ${puedeEditar && p.estadoPedido !== 'Entregado' && p.estadoPedido !== 'Pagado' && p.estadoPedido !== 'Cancelado' ? `<button class="btn-editar btn-sm" onclick="abrirEditorPedido(${p.idPedido})">Editar</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error cargando delivery:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="color:red;text-align:center;">Error al cargar pedidos delivery.</td></tr>';
    }
}

async function marcarEntregadoDelivery(idPedido) {
    if (!confirm('¿Marcar este pedido como entregado?')) return;
    try {
        const res = await fetch(`/api/pedidos/delivery/${idPedido}/entregar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.mensaje || 'Pedido marcado como entregado.');
            cargarDelivery();
        } else {
            alert('❌ ' + (data.error || 'Error al marcar entregado.'));
        }
    } catch (error) {
        console.error('Error marcarEntregadoDelivery:', error);
        alert('Error de red.');
    }
}

// ============================================================
// MONITOR COCINA
// ============================================================

async function cargarMonitorCocina() {
    const tbody = document.getElementById('tablaCocinaCuerpo');
    if (!tbody) return;
    const estadoFiltro = document.getElementById('filtro-cocina-estado')?.value || 'Pendiente';
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        const response = await fetch(`/api/pedidos/cocina/lista?estado=${estadoFiltro}`);
        if (!response.ok) throw new Error('Error al cargar pedidos de cocina');
        const pedidos = await response.json();

        if (pedidos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay pedidos con estado "${estadoFiltro}".</td></tr>`;
            return;
        }

        const puedeEditar = window.tienePermiso('sub-cocina-monitor', 'editar') || window.tienePermiso('sub-cocina-monitor', 'insertar');
        const puedeMarcarListo = window.tienePermiso('sub-cocina-monitor', 'editar');
        const puedeCancelar = window.tienePermiso('sub-cocina-monitor', 'eliminar');

        tbody.innerHTML = pedidos.map(p => {
            const ref = p.numeroMesa ? `Mesa ${p.numeroMesa}` : `Ref: ${p.referenciaLlevar || p.nombreLlevar || 'S/N'}`;
            const items = Array.isArray(p.detalles)
                ? p.detalles.map(d => `${d.cantidad}x ${d.nombrePlato}`).join('<br>')
                : 'Sin detalle';
            return `
            <tr>
                <td><strong style="font-size:1.2rem;">#${p.idPedido}</strong></td>
                <td>${p.nombreTipo || ''}<br>
                    <small style="color:var(--accent);font-weight:bold;">${ref}</small></td>
                <td>${items}</td>
                <td>${new Date(p.fechaPedido).toLocaleTimeString()}</td>
                <td style="display:flex;flex-direction:column;gap:8px;">
                    ${puedeEditar && p.estadoPedido !== 'Entregado' ? `<button class="btn-submit" style="background:var(--primary);min-width:120px;" onclick="abrirEditorPedido(${p.idPedido})">Editar pedido</button>` : ''}
                    ${puedeMarcarListo && p.estadoPedido === 'Pendiente' ? `<button class="btn-submit" style="background:var(--success);min-width:120px;" onclick="marcarListoCocina(${p.idPedido})">Marcar Listo</button>` : ''}
                    ${puedeCancelar && (p.estadoPedido === 'Pendiente' || p.estadoPedido === 'En Preparacion') ? `<button class="btn-delete" style="background:#e74c3c;min-width:120px;" onclick="cancelarPedido(${p.idPedido})">Cancelar pedido</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error cargando cocina:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;text-align:center;">Error cargando cocina.</td></tr>';
    }
}

async function marcarListoCocina(idPedido) {
    if (!confirm('¿El pedido está listo para entregar?')) return;
    try {
        const res = await fetch('/api/pedidos/cocina/despachar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idPedido })
        });
        const data = await res.json();
        if (!res.ok) {
            return alert('Error al actualizar el pedido: ' + (data.error || 'Solicitud fallida.'));
        }
        alert(data.mensaje || 'Pedido marcado como listo.');
        cargarMonitorCocina();
    } catch (err) {
        console.error('Error en marcarListoCocina:', err);
        alert('Error al actualizar el pedido.');
    }
}

async function cancelarPedido(idPedido) {
    if (!confirm('¿Cancelar el pedido? Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetch(`/api/pedidos/${idPedido}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert(data.mensaje || 'Pedido cancelado.');
            cargarMonitorCocina();
        } else {
            alert(data.error || 'No se pudo cancelar el pedido.');
        }
    } catch (err) {
        console.error(err);
        alert('Error de red al cancelar el pedido.');
    }
}

// ============================================================
// EDITOR DE PEDIDO (MODAL)
// ============================================================

async function abrirEditorPedido(idPedido) {
    try {
        const res = await fetch(`/api/pedidos/${idPedido}`);
        if (!res.ok) throw new Error('No se encontró el pedido.');
        const pedido = await res.json();
        pedidoModalId = pedido.idPedido;
        pedidoModalDetalles = Array.isArray(pedido.detalles)
            ? pedido.detalles.map(d => ({
                idMenu: d.idMenu,
                nombre: d.nombrePlato,
                precio: parseFloat(d.precio || d.precioActual || 0),
                cantidad: d.cantidad,
                notasExtra: d.notasExtra || ''
            }))
            : [];

        if (menuGlobalPOS.length === 0) {
            const menuRes = await fetch('/api/admin/menu');
            if (menuRes.ok) menuGlobalPOS = await menuRes.json();
        }

        mostrarModalEditarPedido(pedido);
    } catch (error) {
        console.error(error);
        alert('No se pudo cargar el pedido para editar.');
    }
}

function mostrarModalEditarPedido(pedido) {
    let modal = document.getElementById('modal-editar-pedido');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-editar-pedido';
        modal.className = 'modal-editar-pedido';
        modal.innerHTML = `
            <div class="modal-contenido">
                <div class="modal-header">
                    <h3>Editar Pedido #${pedido.idPedido}</h3>
                    <button type="button" class="btn-delete" onclick="cerrarModalEditarPedido()">✕</button>
                </div>
                <div class="modal-grid">
                    <div class="columna-izquierda">
                        <div class="form-group">
                            <label for="editar-tipo-pedido">Tipo de Pedido</label>
                            <select id="editar-tipo-pedido" class="form-group"></select>
                        </div>
                        <div class="form-group" id="editar-mesa-group">
                            <label for="editar-numero-mesa">Número de Mesa</label>
                            <select id="editar-numero-mesa" class="form-group">
                                <option value="">Cargando mesas...</option>
                            </select>
                        </div>
                        <div class="form-group" id="editar-llevar-group" style="display:none;">
                            <label for="editar-nombre-llevar">Nombre / Referencia</label>
                            <input type="text" id="editar-nombre-llevar" placeholder="Nombre o referencia">
                        </div>
                        <div class="form-group" id="editar-referencia-llevar-group" style="display:none;">
                            <label for="editar-referencia-llevar">Referencia para llevar</label>
                            <input type="text" id="editar-referencia-llevar" placeholder="Lugar de referencia">
                        </div>
                        <div class="form-group" id="editar-direccion-group" style="display:none;">
                            <label for="editar-direccion">Dirección de entrega</label>
                            <input type="text" id="editar-direccion" placeholder="Calle, número, zona">
                        </div>
                        <div class="form-group" id="editar-gps-group" style="display:none;">
                            <label for="editar-gps">Enlace GPS</label>
                            <input type="text" id="editar-gps" placeholder="https://maps.google.com/...">
                        </div>
                        <div style="padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--bg);">
                            <p style="margin:0 0 6px;font-weight:700;">Total actual</p>
                            <p id="editar-total-pedido" style="margin:0;font-size:1.05rem;color:var(--primary);"></p>
                        </div>
                    </div>
                    <div class="columna-derecha">
                        <div class="carrito-container">
                            <h4>Pedido actual</h4>
                            <div id="pedido-modal-carrito"></div>
                        </div>
                        <div class="menu-container">
                            <h4>Agregar productos por categoría</h4>
                            <div id="pedido-modal-menu"></div>
                        </div>
                    </div>
                </div>
                <div class="acciones-modal">
                    <button type="button" class="btn-delete" onclick="cerrarModalEditarPedido()">Cancelar</button>
                    <button type="button" class="btn-submit" onclick="guardarEdicionPedido(${pedido.idPedido})">Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.querySelector('h3').innerText = `Editar Pedido #${pedido.idPedido}`;
    }

    const selectTipo = modal.querySelector('#editar-tipo-pedido');
    selectTipo.innerHTML = `
        <option value="1">Mesa</option>
        <option value="2">Para llevar</option>
        <option value="3">Delivery</option>
    `;
    selectTipo.value = pedido.idTipoPedido || '1';

    // Cargar mesas en el select del modal
    cargarMesasSelect('editar-numero-mesa');

    const mesaGrp = modal.querySelector('#editar-mesa-group');
    const llevarNameGrp = modal.querySelector('#editar-llevar-group');
    const llevarRefGrp = modal.querySelector('#editar-referencia-llevar-group');
    const dirGroup = modal.querySelector('#editar-direccion-group');
    const gpsGroup = modal.querySelector('#editar-gps-group');

    const numeroMesaInput = modal.querySelector('#editar-numero-mesa');
    const nombreLlevarInput = modal.querySelector('#editar-nombre-llevar');
    const referenciaLlevarInput = modal.querySelector('#editar-referencia-llevar');
    const direccionInput = modal.querySelector('#editar-direccion');
    const gpsInput = modal.querySelector('#editar-gps');

    // Asignar valores actuales (si el select ya está cargado, se seleccionará el valor correspondiente)
    if (numeroMesaInput) {
        numeroMesaInput.value = pedido.numeroMesa || '';
    }
    nombreLlevarInput.value = pedido.nombreLlevar || pedido.referenciaLlevar || '';
    referenciaLlevarInput.value = pedido.referenciaLlevar || '';
    if (direccionInput) direccionInput.value = pedido.direccion_entrega || '';
    if (gpsInput) gpsInput.value = pedido.gps_ubicacion || '';

    function actualizarCampos() {
        const tipo = selectTipo.value;
        const esMesa = tipo === '1';
        const esDelivery = tipo === '3';

        mesaGrp.style.display = esMesa ? 'block' : 'none';
        llevarNameGrp.style.display = (esMesa || esDelivery) ? 'none' : 'block';
        llevarRefGrp.style.display = (esMesa || esDelivery) ? 'none' : 'block';
        if (dirGroup) dirGroup.style.display = esDelivery ? 'block' : 'none';
        if (gpsGroup) gpsGroup.style.display = esDelivery ? 'block' : 'none';
    }

    selectTipo.addEventListener('change', actualizarCampos);
    actualizarCampos();

    renderizarPedidoModalCarrito();
    renderizarPedidoModalMenu();
    modal.style.display = 'flex';
}

function cerrarModalEditarPedido() {
    const modal = document.getElementById('modal-editar-pedido');
    if (modal) modal.style.display = 'none';
}

async function guardarEdicionPedido(idPedido) {
    const modal = document.getElementById('modal-editar-pedido');
    if (!modal) return;
    const idTipoPedido = modal.querySelector('#editar-tipo-pedido').value;
    const numeroMesa = modal.querySelector('#editar-numero-mesa').value.trim();
    const nombreLlevar = modal.querySelector('#editar-nombre-llevar').value.trim();
    const referenciaLlevar = modal.querySelector('#editar-referencia-llevar').value.trim();
    const direccionEntrega = modal.querySelector('#editar-direccion')?.value.trim() || null;
    const gpsUbicacion = modal.querySelector('#editar-gps')?.value.trim() || null;

    if (!idTipoPedido) return alert('Seleccione un tipo de pedido.');
    if (idTipoPedido === '1' && !numeroMesa) return alert('Ingrese el número de mesa.');
    if (idTipoPedido !== '1' && (!nombreLlevar || !referenciaLlevar)) return alert('Complete nombre y referencia para llevar.');
    if (idTipoPedido === '3' && !direccionEntrega) return alert('Ingrese la dirección para Delivery.');
    if (!pedidoModalDetalles || pedidoModalDetalles.length === 0) return alert('El pedido debe contener al menos un artículo.');

    try {
        const res = await fetch(`/api/pedidos/${idPedido}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idTipoPedido,
                numeroMesa,
                nombreLlevar,
                referenciaLlevar,
                direccion_entrega: direccionEntrega,
                gps_ubicacion: gpsUbicacion,
                detalles: pedidoModalDetalles.map(item => ({
                    idMenu: item.idMenu,
                    cantidad: item.cantidad,
                    notasExtra: item.notasExtra || null
                }))
            })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.mensaje || 'Pedido actualizado.');
            cerrarModalEditarPedido();
            // Recargar el monitor actual según el submódulo activo
            const subActivo = document.querySelector('.sub-modulo.activo');
            if (subActivo) {
                if (subActivo.id === 'sub-cocina-monitor') cargarMonitorCocina();
                else if (subActivo.id === 'sub-delivery') cargarDelivery();
            }
        } else {
            alert(data.error || 'No se pudo actualizar el pedido.');
        }
    } catch (error) {
        console.error(error);
        alert('Error de red al actualizar el pedido.');
    }
}