'use strict';

// ============================================================
// MÓDULO PROVEEDORES — CRUD
// ============================================================

async function cargarProveedores() {
    const tbody = document.getElementById('tablaProveedoresCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/proveedores');
        if (!res.ok) throw new Error('Error servidor');
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No hay proveedores registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.idProveedor}</td>
                <td><strong>${p.nombreProveedor}</strong></td>
                <td>${p.contacto || '—'}</td>
                <td>${p.telefono || '—'}</td>
                <td>${p.email || '—'}</td>
                <td><span class="badge ${p.activo ? 'badge-success' : 'badge-danger'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn-editar" onclick="prepararEdicionProveedor(${p.idProveedor}, '${p.nombreProveedor.replace(/'/g,"\\'")}', '${p.contacto || ''}', '${p.telefono || ''}', '${p.email || ''}', '${p.direccion || ''}', ${p.activo})">Editar</button>
                    <button class="btn-delete" onclick="eliminarProveedor(${p.idProveedor})">${p.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
            </tr>
        `).join('');

        _registrarHandlerProveedor();
    } catch {
        tbody.innerHTML = '<tr><td colspan="7" style="color:red;text-align:center;">Error al cargar proveedores.</td></tr>';
    }
}

function _registrarHandlerProveedor() {
    const form = document.getElementById('formProveedor');
    if (form && !form.dataset.handler) {
        form.addEventListener('submit', guardarProveedor);
        form.dataset.handler = 'true';
    }
}

function prepararEdicionProveedor(id, nombre, contacto, telefono, email, direccion, activo) {
    document.getElementById('idProveedorEdit').value = id;
    document.getElementById('nombreProveedor').value = nombre;
    document.getElementById('contactoProveedor').value = contacto;
    document.getElementById('telefonoProveedor').value = telefono;
    document.getElementById('emailProveedor').value = email;
    document.getElementById('direccionProveedor').value = direccion;
    document.getElementById('activoProveedor').checked = activo === 1;
    document.getElementById('btnGuardarProveedor').innerText = 'Actualizar Proveedor';
    document.getElementById('btnCancelarProveedor').style.display = 'inline-block';
    document.getElementById('formProveedor').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicionProveedor() {
    document.getElementById('idProveedorEdit').value = '';
    document.getElementById('formProveedor').reset();
    document.getElementById('btnGuardarProveedor').innerText = 'Guardar Proveedor';
    document.getElementById('btnCancelarProveedor').style.display = 'none';
    document.getElementById('msgProveedores').style.display = 'none';
}

async function guardarProveedor() {
    // e.preventDefault();
    const statusDiv = document.getElementById('msgProveedores');
    const idEdit = document.getElementById('idProveedorEdit').value;
    const nombreProveedor = document.getElementById('nombreProveedor').value.trim();
    const contacto = document.getElementById('contactoProveedor').value.trim();
    const telefono = document.getElementById('telefonoProveedor').value.trim();
    const email = document.getElementById('emailProveedor').value.trim();
    const direccion = document.getElementById('direccionProveedor').value.trim();
    const activo = document.getElementById('activoProveedor').checked ? 1 : 0;

    if (!nombreProveedor || nombreProveedor.length < 2)
        return _alertProveedor(statusDiv, 'El nombre debe tener al menos 2 caracteres.', 'error');

    try {
        const url = idEdit ? `/api/admin/proveedores/${idEdit}` : '/api/admin/proveedores';
        const method = idEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreProveedor, contacto, telefono, email, direccion, activo })
        });
        const data = await res.json();
        if (data.exito) {
            _alertProveedor(statusDiv, idEdit ? 'Proveedor actualizado.' : 'Proveedor registrado.', 'success');
            cancelarEdicionProveedor();
            cargarProveedores();
        } else {
            _alertProveedor(statusDiv, data.error || 'Error al guardar.', 'error');
        }
    } catch {
        _alertProveedor(statusDiv, 'Error de red.', 'error');
    }
}

async function eliminarProveedor(id) {
    if (!confirm('¿Desactivar este proveedor? (Baja lógica)')) return;
    try {
        const res = await fetch(`/api/admin/proveedores/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarProveedores();
        else alert('❌ ' + data.error);
    } catch (err) {
        alert('Error de red: ' + err.message);
    }
}

function _alertProveedor(div, mensaje, tipo) {
    if (!div) return;
    div.className = tipo === 'success' ? 'alert-success' : 'alert-error';
    div.innerText = (tipo === 'error' ? '❌ ' : '✅ ') + mensaje;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 4000);
}