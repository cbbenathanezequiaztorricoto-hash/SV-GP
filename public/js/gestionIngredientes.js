'use strict';
// ============================================================
// MÓDULO INGREDIENTES — CRUD frontend con proveedor e historial
// ============================================================

async function cargarIngredientes() {
    const tbody = document.getElementById('tablaIngredientesCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/ingredientes');
        if (!res.ok) throw new Error('Error servidor');
        const items = await res.json();

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">No hay ingredientes registrados.</td></tr>';
            _registrarHandlerIngrediente();
            return;
        }

        tbody.innerHTML = items.map(i => {
            const bajoStock = parseFloat(i.stockActual) <= parseFloat(i.stockMinimo);
            const estadoBadge = bajoStock
                ? `<span class="badge" style="background:#e74c3c;color:white;">⚠ Stock bajo</span>`
                : `<span class="badge" style="background:#27ae60;color:white;">OK</span>`;

            return `
            <tr style="${bajoStock ? 'background:#fff5f5;' : ''}">
                <td><strong>${i.nombreIngrediente}</strong></td>
                <td>${i.unidadMedida}</td>
                <td style="font-weight:bold;${bajoStock ? 'color:#e74c3c;' : ''}">${parseFloat(i.stockActual).toFixed(2)}</td>
                <td>${parseFloat(i.stockMinimo).toFixed(2)}</td>
                <td>${parseFloat(i.precioActualCompra).toFixed(2)} Bs.</td>
                <td>${i.nombreProveedor || '—'}</td>
                <td>${estadoBadge}</td>
                <td>
                    <button class="btn-editar" onclick="prepararEdicionIngrediente(${i.idIngrediente}, '${i.nombreIngrediente.replace(/'/g,"\\'")}', '${i.unidadMedida}', ${i.stockActual}, ${i.stockMinimo}, ${i.precioActualCompra}, ${i.idProveedor || 'null'})">Editar</button>
                    <button class="btn-delete" onclick="eliminarIngrediente(${i.idIngrediente})">Eliminar</button>
                    <button class="btn-info" onclick="verHistorialPrecios(${i.idIngrediente})" style="background:#3498db;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Historial</button>
                </td>
            </tr>`;
        }).join('');

        _registrarHandlerIngrediente();
    } catch {
        tbody.innerHTML = '<tr><td colspan="8" style="color:red;text-align:center;">Error al cargar ingredientes.</td></tr>';
    }
}

function _registrarHandlerIngrediente() {
    const form = document.getElementById('formIngrediente');
    if (form && !form.dataset.handler) {
        form.addEventListener('submit', guardarIngrediente);
        form.dataset.handler = 'true';
    }
}

async function cargarSelectProveedores() {
    const sel = document.getElementById('idProveedor');
    if (!sel) return;
    try {
        const res = await fetch('/api/admin/proveedores');
        const data = await res.json();
        sel.innerHTML = '<option value="">Sin proveedor</option>' +
            data.filter(p => p.activo).map(p =>
                `<option value="${p.idProveedor}">${p.nombreProveedor}</option>`
            ).join('');
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

function prepararEdicionIngrediente(id, nombre, unidad, stock, stockMin, precio, idProveedor) {
    document.getElementById('idIngredienteEdit').value   = id;
    document.getElementById('nombreIngrediente').value   = nombre;
    document.getElementById('unidadMedida').value        = unidad;
    document.getElementById('stockActual').value         = stock;
    document.getElementById('stockMinimo').value         = stockMin;
    document.getElementById('precioActualCompra').value  = precio;
    document.getElementById('idProveedor').value         = idProveedor || '';

    document.getElementById('formIngredienteTitulo').innerText     = 'Editar Ingrediente';
    document.getElementById('btnGuardarIngrediente').innerText      = 'Actualizar Ingrediente';
    document.getElementById('btnCancelarIngrediente').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionIngrediente() {
    document.getElementById('idIngredienteEdit').value              = '';
    document.getElementById('formIngrediente').reset();
    document.getElementById('formIngredienteTitulo').innerText      = 'Registrar Ingrediente';
    document.getElementById('btnGuardarIngrediente').innerText      = 'Guardar Ingrediente';
    document.getElementById('btnCancelarIngrediente').style.display = 'none';
    document.getElementById('mensajeStatusIngredientes').style.display = 'none';
}

async function guardarIngrediente(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('mensajeStatusIngredientes');

    const idEdit             = document.getElementById('idIngredienteEdit').value;
    const nombreIngrediente  = document.getElementById('nombreIngrediente').value.trim();
    const unidadMedida       = document.getElementById('unidadMedida').value;
    const stockActual        = parseFloat(document.getElementById('stockActual').value);
    const stockMinimo        = parseFloat(document.getElementById('stockMinimo').value);
    const precioActualCompra = parseFloat(document.getElementById('precioActualCompra').value);
    const idProveedor        = document.getElementById('idProveedor').value || null;

    if (!nombreIngrediente || nombreIngrediente.length < 2)
        return _alertIngrediente(statusDiv, 'El nombre debe tener al menos 2 caracteres.', 'error');
    if (isNaN(stockActual) || stockActual < 0)
        return _alertIngrediente(statusDiv, 'El stock actual debe ser un número positivo.', 'error');
    if (isNaN(stockMinimo) || stockMinimo < 0)
        return _alertIngrediente(statusDiv, 'El stock mínimo debe ser un número positivo.', 'error');
    if (isNaN(precioActualCompra) || precioActualCompra <= 0)
        return _alertIngrediente(statusDiv, 'El precio de compra debe ser mayor a 0.', 'error');

    try {
        const url    = idEdit ? `/api/admin/ingredientes/${idEdit}` : '/api/admin/ingredientes';
        const method = idEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreIngrediente, unidadMedida, stockActual, stockMinimo, precioActualCompra, idProveedor })
        });
        const data = await res.json();

        if (data.exito) {
            _alertIngrediente(statusDiv, idEdit ? 'Ingrediente actualizado.' : 'Ingrediente registrado.', 'success');
            cancelarEdicionIngrediente();
            cargarIngredientes();
        } else {
            _alertIngrediente(statusDiv, data.error || 'Error al guardar.', 'error');
        }
    } catch {
        _alertIngrediente(statusDiv, 'Error de red.', 'error');
    }
}

async function eliminarIngrediente(idIngrediente) {
    if (!confirm('¿Eliminar este ingrediente? Si está vinculado a platos del menú, la operación fallará.')) return;
    try {
        const res  = await fetch(`/api/admin/ingredientes/${idIngrediente}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarIngredientes();
        else alert('❌ ' + data.error);
    } catch (err) {
        alert('Error de red: ' + err.message);
    }
}

async function verHistorialPrecios(idIngrediente) {
    const modal = document.getElementById('modalHistorialPrecios');
    const tbody = document.getElementById('tablaHistorialPreciosCuerpo');
    if (!modal || !tbody) return;

    modal.style.display = 'flex';
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando...</td></tr>';

    try {
        const res = await fetch(`/api/admin/ingredientes/${idIngrediente}/historial-precios`);
        if (!res.ok) throw new Error('Error al obtener historial');
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999;">Sin historial de precios.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${parseFloat(row.precioUnitario).toFixed(2)} Bs.</td>
                <td>${new Date(row.fechaInicio).toLocaleString('es-BO')}</td>
                <td>${row.fechaFin ? new Date(row.fechaFin).toLocaleString('es-BO') : 'Vigente'}</td>
            </tr>
        `).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="3" style="color:red;text-align:center;">Error al cargar historial.</td></tr>';
    }
}

function cerrarHistorialPrecios() {
    document.getElementById('modalHistorialPrecios').style.display = 'none';
}

function _alertIngrediente(div, mensaje, tipo) {
    if (!div) return;
    div.className    = tipo === 'success' ? 'alert-success' : 'alert-error';
    div.innerText    = (tipo === 'error' ? '❌ ' : '✅ ') + mensaje;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 4000);
}

// Cargar proveedores al entrar al submódulo (se llama desde onEntrarSubModulo)
if (typeof cargarSelectProveedores === 'function') {
    // Se llamará desde navUnificada al entrar a sub-ingredientes
}