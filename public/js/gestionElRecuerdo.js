// SV_GP/public/js/gestionElRecuerdo.js
'use strict';
let idPlatoEnEdicion = null;

document.addEventListener('DOMContentLoaded', () => {
    const idRol = localStorage.getItem('idRol');
    const username = localStorage.getItem('username');
    if (!idRol) {
        window.location.href = '/';
        return;
    }

    const nombreElem = document.getElementById('nombreAdmin');
    if (nombreElem) nombreElem.innerText = username || 'Usuario';

    const fotoAdmin = document.getElementById('logoAdmin');
    if (fotoAdmin) {
        const fotoPerfil = localStorage.getItem('fotoPerfil');
        fotoAdmin.src = fotoPerfil ? fotoPerfil : '../assets/logo.jpg';
    }

    const isAdmin = parseInt(idRol) === 1;

    if (isAdmin) {
        cargarCategoriasFormulario();
        cargarCatalogoMenu();
        const formMenu = document.getElementById('formMenu');
        if (formMenu) formMenu.addEventListener('submit', registrarItemMenu);

        const formRol = document.getElementById('formRol');
        if (formRol) formRol.addEventListener('submit', guardarRol);

        const formMetodo = document.getElementById('formMetodoPago');
        if (formMetodo) formMetodo.addEventListener('submit', guardarMetodoPago);
    } else {
        const adminModule = document.getElementById('modulo-admin');
        if (adminModule) adminModule.classList.add('hide');
    }

    // Tema oscuro/claro
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const htmlElement = document.documentElement;

    function updateButton(isDark) {
        themeIcon.textContent = isDark ? '☀️' : '🌙';
    }

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);

    if (isDark) {
        htmlElement.setAttribute('data-theme', 'dark');
    }
    updateButton(isDark);

    themeToggle.addEventListener('click', () => {
        const currentIsDark = htmlElement.getAttribute('data-theme') === 'dark';
        if (currentIsDark) {
            htmlElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            updateButton(false);
        } else {
            htmlElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            updateButton(true);
        }
    });
});

// ============================================================
// SUB MÓDULO MENÚ
// ============================================================
function cargarCategoriasFormulario() {
    fetch('/api/admin/categorias')
        .then(res => { if (!res.ok) throw new Error('Error servidor'); return res.json(); })
        .then(categorias => {
            const sel = document.getElementById('idCategoria');
            if (!sel) return;
            sel.innerHTML = '<option value="">Seleccione una categoría...</option>';
            categorias.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.idCategoria;
                opt.textContent = cat.nombreCategoria;
                sel.appendChild(opt);
            });
        })
        .catch(err => console.error('Error al cargar categorías:', err));
}

function filtrarTabla() {
    const filtro = document.getElementById('filtroCategoria').value;
    document.querySelectorAll('#tablaMenu tbody tr').forEach(fila => {
        const cat = fila.getAttribute('data-categoria');
        if (!cat) return;
        fila.style.display = (filtro === 'todos' || cat === filtro) ? '' : 'none';
    });
}

async function cargarCatalogoMenu() {
    const tbody = document.querySelector('#tablaMenu tbody');
    try {
        const res = await fetch('/api/admin/menu');
        if (!res.ok) throw new Error('Error en la respuesta');
        const items = await res.json();
        tbody.innerHTML = '';

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay platos registrados.</td></tr>';
            return;
        }

        items.forEach(item => {
            const desc = item.descripcion
                ? (item.descripcion.length > 80 ? item.descripcion.substring(0, 77) + '...' : item.descripcion)
                : 'Sin descripción';
            const imgHtml = item.imagen_url
                ? `<img src="${item.imagen_url}" alt="${item.nombrePlato}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">`
                : `<span style="color:#aaa;font-size:12px;">Sin Foto</span>`;

            const tr = document.createElement('tr');
            tr.setAttribute('data-categoria', item.nombreCategoria || 'Sin categoría');
            tr.innerHTML = `
                <td style="text-align:center;vertical-align:middle;">${imgHtml}</td>
                <td><strong>${item.nombrePlato}</strong></td>
                <td><span class="badge">${item.nombreCategoria || 'Sin categoría'}</span></td>
                <td>${parseFloat(item.precioActual).toFixed(2)} Bs</td>
                <td><small title="${item.descripcion || ''}">${desc}</small></td>
                <td>
                    <button class="btn-add btn-sm" onclick="abrirGestorReceta(${item.idMenu}, '${item.nombrePlato.replace(/'/g, "\\'")}')" 
                            style="padding:4px 8px;font-size:0.8rem;">Receta</button>
                </td>
                <td>
                    <button style="background:#f39c12;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                        data-id="${item.idMenu}" data-nombre="${item.nombrePlato}"
                        data-cat="${item.idCategoria}" data-precio="${item.precioActual}"
                        data-desc="${item.descripcion || ''}" data-img="${item.imagen_url || ''}"
                        onclick="prepararEdicion(this)">Editar</button>
                    <button class="btn-delete" onclick="eliminarItemMenu(${item.idMenu})">Eliminar</button>
                </td>`;
            tbody.appendChild(tr);
        });
        filtrarTabla();
    } catch (err) {
        console.error("Error al cargar menú:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error al cargar el catálogo.</td></tr>';
    }
}

function prepararEdicion(boton) {
    idPlatoEnEdicion = boton.getAttribute('data-id');
    document.getElementById('nombrePlato').value = boton.getAttribute('data-nombre');
    document.getElementById('idCategoria').value = boton.getAttribute('data-cat');
    document.getElementById('precioActual').value = boton.getAttribute('data-precio');
    document.getElementById('descripcion').value = boton.getAttribute('data-desc');
    
    // Mostrar imagen actual si existe
    const imgSrc = boton.getAttribute('data-img');
    const preview = document.getElementById('preview-plato-img');
    if (imgSrc && imgSrc !== 'null' && imgSrc !== '') {
        preview.src = imgSrc;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    
    const btn = document.querySelector('#formMenu .btn-submit');
    btn.innerText = 'Actualizar Producto';
    btn.style.backgroundColor = '#f39c12';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function registrarItemMenu(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('mensajeStatus');

    const nombrePlato = document.getElementById('nombrePlato').value.trim();
    const idCategoria = document.getElementById('idCategoria').value;
    const precioActual = parseFloat(document.getElementById('precioActual').value);

    if (!nombrePlato || nombrePlato.length < 2) {
        return mostrarAlerta(statusDiv, 'El nombre del ítem debe tener al menos 2 caracteres.', 'error');
    }
    if (!idCategoria) {
        return mostrarAlerta(statusDiv, 'Debe seleccionar una categoría.', 'error');
    }
    if (isNaN(precioActual) || precioActual <= 0) {
        return mostrarAlerta(statusDiv, 'El precio debe ser un número mayor a 0.', 'error');
    }

    const descripcion = document.getElementById('descripcion').value.trim();
    const imagenInput = document.getElementById('imagenPlato');
    const imagenFile = imagenInput.files && imagenInput.files[0] ? imagenInput.files[0] : null;

    // Crear FormData
    const formData = new FormData();
    formData.append('nombrePlato', nombrePlato);
    formData.append('idCategoria', idCategoria);
    formData.append('precioActual', precioActual);
    formData.append('descripcion', descripcion);
    if (imagenFile) {
        formData.append('imagen', imagenFile); // ⬅️ El nombre 'imagen' lo usaremos en el backend
    }

    statusDiv.style.display = 'none';
    try {
        const url = idPlatoEnEdicion ? `/api/admin/menu/${idPlatoEnEdicion}` : '/api/admin/menu';
        const method = idPlatoEnEdicion ? 'PUT' : 'POST';

        // ✅ IMPORTANTE: NO establezcas Content-Type, fetch lo hará automáticamente con boundary
        const res = await fetch(url, {
            method,
            body: formData // ⬅️ Enviamos FormData
        });
        const resultado = await res.json();

        if (resultado.exito) {
            mostrarAlerta(statusDiv, idPlatoEnEdicion ? '¡Producto actualizado!' : '¡Producto guardado!', 'success');
            document.getElementById('formMenu').reset();
            document.getElementById('preview-plato-img').style.display = 'none';
            idPlatoEnEdicion = null;
            const btn = document.querySelector('#formMenu .btn-submit');
            btn.innerText = 'Guardar en Menú';
            btn.style.backgroundColor = 'var(--primary)';
            cargarCatalogoMenu();
        } else {
            mostrarAlerta(statusDiv, resultado.error || 'Error al procesar.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(statusDiv, 'Error de red: no se pudo conectar con el servidor.', 'error');
    }
}

function previewImagePlato(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById('preview-plato-img');
        img.src = e.target.result;
        img.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function eliminarItemMenu(idMenu) {
    if (!confirm('¿Eliminar este ítem? Puede afectar comandas históricas.')) return;
    try {
        const res = await fetch(`/api/admin/menu/${idMenu}`, { method: 'DELETE' });
        const resultado = await res.json();
        if (resultado.exito) cargarCatalogoMenu();
        else alert('Error: ' + resultado.error);
    } catch (err) {
        alert('No se pudo eliminar. ' + err.message);
    }
}

// ============================================================
// SUB MÓDULO ROLES
// ============================================================
const SUB_MODULOS = [
    { id: 'sub-menu', label: 'Menú' },
    { id: 'sub-usuarios', label: 'Usuarios' },
    { id: 'sub-mesas', label: 'Mesas' },
    { id: 'sub-turnos', label: 'Turnos Limpieza' },
    { id: 'sub-roles', label: 'Roles' },
    { id: 'sub-pagos', label: 'Métodos Pago' },
    { id: 'sub-ingredientes', label: 'Ingredientes' },
    { id: 'sub-proveedores', label: 'Proveedores' },
    { id: 'sub-categorias', label: 'Categorías' },
    { id: 'sub-clientes', label: 'Clientes' },
    { id: 'sub-puestos', label: 'Puestos' },
    { id: 'sub-areas', label: 'Áreas' },
    { id: 'sub-facturas', label: 'Facturas' },
    { id: 'sub-reportes', label: 'Reportes' },
    { id: 'sub-pert', label: 'Modelo Pert' },
    { id: 'sub-cierre-caja', label: 'Cierre Caja' },
    { id: 'sub-gestion-pedidos', label: 'Gestionar Pedidos' },
    { id: 'sub-cocina-monitor', label: 'Monitor Cocina' },
    { id: 'sub-delivery', label: 'Pedidos para Delivery' },
    { id: 'sub-gestionar-ventas', label: 'Gestionar Venta' },
    { id: 'card-modelos-matematicos', label: 'Optimización' }
];
async function cargarPermisosRol(idRol) {
    try {
        const res = await fetch(`/api/admin/roles/${idRol}/permisos`);
        if (!res.ok) throw new Error('Error al obtener permisos');
        const data = await res.json();
        return data.permisos; // objeto { subModulo: { ver, insertar, editar, eliminar } }
    } catch (error) {
        console.error('cargarPermisosRol:', error);
        return null;
    }
}
async function guardarPermisosRol(idRol, permisos) {
    try {
        const res = await fetch(`/api/admin/roles/${idRol}/permisos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permisos })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar permisos');
        return data;
    } catch (error) {
        console.error('guardarPermisosRol:', error);
        throw error;
    }
}
async function cargarRoles() {
    const tbody = document.getElementById('tablaRolesCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/roles');
        if (!res.ok) throw new Error('Error servidor');
        const roles = await res.json();

        if (roles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay roles registrados.</td></tr>';
            return;
        }
        tbody.innerHTML = roles.map(r => `
            <tr>
                <td>${r.idRol}</td>
                <td>${r.nombreRol}</td>
                <td>
                    <button style="background:#f39c12;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                        onclick="prepararEdicionRol(${r.idRol}, '${r.nombreRol.replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarRol(${r.idRol})">Eliminar</button>
                </td>
            </tr>`).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="3" style="color:red;text-align:center;">Error al cargar roles.</td></tr>';
    }
}

// Modificar la función prepararEdicionRol para mostrar el panel de permisos
function prepararEdicionRol(id, nombre) {
    document.getElementById('idRolEdit').value = id;
    document.getElementById('nombreRol').value = nombre;
    document.getElementById('btnGuardarRol').innerText = 'Actualizar Rol';
    document.getElementById('btnCancelarRol').style.display = 'block';
    
    // Cargar permisos y mostrar panel
    const panel = document.getElementById('panel-permisos');
    panel.style.display = 'block';
    cargarPermisosRol(id).then(permisos => {
        renderizarPermisos(permisos);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderizarPermisos(permisos) {
    const grid = document.getElementById('permisos-grid');
    if (!grid) return;
    grid.innerHTML = SUB_MODULOS.map(sm => {
        const p = permisos[sm.id] || { ver: false, insertar: false, editar: false, eliminar: false };
        return `
        <div style="border:1px solid #ddd;padding:8px;border-radius:6px;">
            <strong>${sm.label}</strong>
            <label style="display:block;font-weight:400;">
                <input type="checkbox" data-sub="${sm.id}" data-op="ver" ${p.ver ? 'checked' : ''}> Ver
            </label>
            <label style="display:block;font-weight:400;">
                <input type="checkbox" data-sub="${sm.id}" data-op="insertar" ${p.insertar ? 'checked' : ''}> Insertar
            </label>
            <label style="display:block;font-weight:400;">
                <input type="checkbox" data-sub="${sm.id}" data-op="editar" ${p.editar ? 'checked' : ''}> Editar
            </label>
            <label style="display:block;font-weight:400;">
                <input type="checkbox" data-sub="${sm.id}" data-op="eliminar" ${p.eliminar ? 'checked' : ''}> Eliminar
            </label>
        </div>`;
    }).join('');
}
// Cancelar edición: ocultar panel de permisos
function cancelarEdicionRol() {
    document.getElementById('idRolEdit').value = '';
    document.getElementById('nombreRol').value = '';
    document.getElementById('btnGuardarRol').innerText = 'Guardar Rol';
    document.getElementById('btnCancelarRol').style.display = 'none';
    document.getElementById('panel-permisos').style.display = 'none';
    document.getElementById('mensajeStatusRoles').style.display = 'none';
}

// Modificar guardarRol para que también guarde los permisos
async function guardarRol(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('mensajeStatusRoles');
    const idRolEdit = document.getElementById('idRolEdit').value;
    const nombreRol = document.getElementById('nombreRol').value.trim();

    if (!nombreRol || nombreRol.length < 2) {
        return mostrarAlerta(statusDiv, 'El nombre del rol debe tener al menos 2 caracteres.', 'error');
    }

    try {
        // Guardar o actualizar rol
        const url = idRolEdit ? `/api/admin/roles/${idRolEdit}` : '/api/admin/roles';
        const method = idRolEdit ? 'PUT' : 'POST';
        const resRol = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreRol })
        });
        const dataRol = await resRol.json();
        if (!dataRol.exito) throw new Error(dataRol.error);

        // Si es nuevo rol, obtener el id generado
        let idRol = idRolEdit || dataRol.idRol;

        // Guardar permisos
        const checkboxes = document.querySelectorAll('#permisos-grid input[type="checkbox"]');
        const permisos = {};
        checkboxes.forEach(cb => {
            const sub = cb.dataset.sub;
            const op = cb.dataset.op;
            if (!permisos[sub]) permisos[sub] = { ver: false, insertar: false, editar: false, eliminar: false };
            permisos[sub][op] = cb.checked;
        });

        await guardarPermisosRol(idRol, permisos);

        mostrarAlerta(statusDiv, idRolEdit ? 'Permisos actualizados. Los usuarios con este rol deberán cerrar sesión y volver a iniciar para ver los cambios.' : 'Rol y permisos creados.', 'success');
        
        cancelarEdicionRol();
        cargarRoles();
    } catch (error) {
        mostrarAlerta(statusDiv, error.message || 'Error al guardar.', 'error');
    }
}


async function eliminarRol(idRol) {
    if (!confirm('¿Eliminar este rol? Los usuarios con este rol podrían verse afectados.')) return;
    try {
        const res = await fetch(`/api/admin/roles/${idRol}`, { method: 'DELETE' });
        const resultado = await res.json();
        if (resultado.exito) cargarRoles();
        else alert('Error: ' + resultado.error);
    } catch (err) {
        alert('No se pudo eliminar. ' + err.message);
    }
}

// ============================================================
// MÓDULO MÉTODOS DE PAGO (Admin)
// ============================================================

async function cargarMetodosPagoAdmin() {
    const tbody = document.getElementById('tablaMetodosCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/metodos-pago');
        if (!res.ok) throw new Error('Error servidor');
        const metodos = await res.json();

        if (metodos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay métodos registrados.</td></tr>';
            return;
        }
        tbody.innerHTML = metodos.map(m => {
            const qrHtml = m.qr_url
                ? `<img src="${m.qr_url}" alt="QR" style="width:40px;height:40px;object-fit:contain;">`
                : '<span style="color:#aaa;font-size:12px;">Sin QR</span>';
            return `
            <tr>
                <td>${m.idMetodoPago}</td>
                <td>${m.nombreMetodo}</td>
                <td style="text-align:center;">${qrHtml}</td>
                <td>
                    <button style="background:#f39c12;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                        onclick="prepararEdicionMetodo(${m.idMetodoPago}, '${m.nombreMetodo.replace(/'/g, "\\'")}', '${(m.qr_url || '').replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarMetodoPago(${m.idMetodoPago})">Eliminar</button>
                </td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="4" style="color:red;text-align:center;">Error al cargar métodos.</td></tr>';
    }
}

function prepararEdicionMetodo(id, nombre, qrUrl) {
    document.getElementById('idMetodoPagoEdit').value  = id;
    document.getElementById('nombreMetodoPago').value  = nombre;
    document.getElementById('qrUrl').value             = qrUrl;
    document.getElementById('btnGuardarMetodo').innerText = 'Actualizar Método';
    document.getElementById('btnCancelarMetodo').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionMetodo() {
    document.getElementById('idMetodoPagoEdit').value  = '';
    document.getElementById('nombreMetodoPago').value  = '';
    document.getElementById('qrUrl').value             = '';
    document.getElementById('btnGuardarMetodo').innerText = 'Guardar Método';
    document.getElementById('btnCancelarMetodo').style.display = 'none';
    document.getElementById('mensajeStatusPagos').style.display = 'none';
}

async function guardarMetodoPago(e) {
    e.preventDefault();
    const statusDiv      = document.getElementById('mensajeStatusPagos');
    const idEdit         = document.getElementById('idMetodoPagoEdit').value;
    const nombreMetodo   = document.getElementById('nombreMetodoPago').value.trim();
    const qrUrl          = document.getElementById('qrUrl').value.trim() || null;

    // ✅ Validación
    if (!nombreMetodo || nombreMetodo.length < 2) {
        return mostrarAlerta(statusDiv, 'El nombre del método debe tener al menos 2 caracteres.', 'error');
    }

    try {
        const url    = idEdit ? `/api/admin/metodos-pago/${idEdit}` : '/api/admin/metodos-pago';
        const method = idEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreMetodo, qrUrl })
        });
        const resultado = await res.json();
        if (resultado.exito) {
            mostrarAlerta(statusDiv, idEdit ? 'Método actualizado.' : 'Método creado.', 'success');
            cancelarEdicionMetodo();
            cargarMetodosPagoAdmin();
        } else {
            mostrarAlerta(statusDiv, resultado.error || 'Error al guardar.', 'error');
        }
    } catch {
        mostrarAlerta(statusDiv, 'Error de red.', 'error');
    }
}

async function eliminarMetodoPago(idMetodoPago) {
    if (!confirm('¿Eliminar este método de pago?')) return;
    try {
        const res = await fetch(`/api/admin/metodos-pago/${idMetodoPago}`, { method: 'DELETE' });
        const resultado = await res.json();
        if (resultado.exito) cargarMetodosPagoAdmin();
        else alert('Error: ' + resultado.error);
    } catch (err) {
        alert('No se pudo eliminar. ' + err.message);
    }
}

// ============================================================
// UTILIDAD COMPARTIDA
// ============================================================

function mostrarAlerta(div, mensaje, tipo) {
    if (!div) return;
    div.className = tipo === 'success' ? 'alert-success' : 'alert-error';
    div.innerText = (tipo === 'error' ? '❌ ' : '✅ ') + mensaje;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 4000);
}

// En gestionElRecuerdo.js
async function cerrarSesion() {
    const idUsuario = localStorage.getItem('idUsuario');
    if (idUsuario) {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idUsuario })
            });
            console.log('✅ Sesión eliminada del servidor');
        } catch (err) {
            console.error('❌ Error al cerrar sesión en servidor:', err);
        }
    }
    localStorage.clear();
    window.location.href = '/';
}