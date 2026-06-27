'use strict';
// ============================================================
// gestionCatalogos.js
// Gestiona: Categorías, Clientes, Puestos, Áreas de Limpieza,
//           Facturas, Recetas (MenuIngrediente)
// ============================================================

// ── UTILIDAD ─────────────────────────────────────────────────
function alertaCatalogo(idDiv, mensaje, tipo) {
    const div = document.getElementById(idDiv);
    if (!div) return;
    div.className = tipo === 'success' ? 'alert-success' : 'alert-error';
    div.textContent = (tipo === 'error' ? '❌ ' : '✅ ') + mensaje;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 4000);
}

// ============================================================
// CATEGORÍAS DE MENÚ
// ============================================================
async function cargarCategorias() {
    const tbody = document.getElementById('tablaCategoriasCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="td-cargando">Cargando...</td></tr>';
    try {
        const res  = await fetch('/api/admin/categorias');
        const cats = await res.json();
        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="td-vacio">No hay categorías registradas.</td></tr>';
        } else {
            tbody.innerHTML = cats.map(c => `
            <tr>
                <td>${c.idCategoria}</td>
                <td><strong>${c.nombreCategoria}</strong></td>
                <td class="td-acciones">
                    <button class="btn-editar" onclick="editarCategoria(${c.idCategoria},'${c.nombreCategoria.replace(/'/g,"\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarCategoria(${c.idCategoria})">Eliminar</button>
                </td>
            </tr>`).join('');
        }
        _regHandler('formCategoria', guardarCategoria);
    } catch { tbody.innerHTML = '<tr><td colspan="3" class="td-error">Error al cargar.</td></tr>'; }
}

function editarCategoria(id, nombre) {
    document.getElementById('idCategoriaEdit').value  = id;
    document.getElementById('nombreCategoria').value  = nombre;
    document.getElementById('btnGuardarCategoria').textContent  = 'Actualizar Categoría';
    document.getElementById('btnCancelarCategoria').style.display = 'inline-block';
}
function cancelarEdicionCategoria() {
    document.getElementById('formCategoria').reset();
    document.getElementById('idCategoriaEdit').value  = '';
    document.getElementById('btnGuardarCategoria').textContent  = 'Guardar Categoría';
    document.getElementById('btnCancelarCategoria').style.display = 'none';
    document.getElementById('msgCategorias').style.display = 'none';
}
async function guardarCategoria(e) {
    e.preventDefault();
    const idEdit = document.getElementById('idCategoriaEdit').value;
    const nombre = document.getElementById('nombreCategoria').value.trim();
    if (!nombre || nombre.length < 2)
        return alertaCatalogo('msgCategorias', 'El nombre debe tener al menos 2 caracteres.', 'error');
    try {
        const url    = idEdit ? `/api/admin/categorias/${idEdit}` : '/api/admin/categorias';
        const method = idEdit ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombreCategoria: nombre }) });
        const data   = await res.json();
        if (data.exito) { alertaCatalogo('msgCategorias', idEdit ? 'Categoría actualizada.' : 'Categoría creada.', 'success'); cancelarEdicionCategoria(); cargarCategorias(); }
        else alertaCatalogo('msgCategorias', data.error || 'Error.', 'error');
    } catch { alertaCatalogo('msgCategorias', 'Error de red.', 'error'); }
}
async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
        const res = await fetch(`/api/admin/categorias/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarCategorias();
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// CLIENTES
// ============================================================
async function cargarClientes() {
    const tbody  = document.getElementById('tablaClientesCuerpo');
    const buscar = document.getElementById('buscarCliente')?.value?.trim() || '';
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="td-cargando">Cargando...</td></tr>';
    try {
        const url  = buscar ? `/api/admin/clientes?buscar=${encodeURIComponent(buscar)}` : '/api/admin/clientes';
        const res  = await fetch(url);
        const data = await res.json();
        console.log('Clientes recibidos:', data);
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="td-vacio">No hay clientes registrados.</td></tr>';
        } else {
            tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.nitCi || '—'}</td>
                <td><strong>${c.primerNombre} ${c.primerApellido}</strong></td>
                <td>${c.email}</td>
                <td>${c.telefono || '—'}</td>
                <td>${c.fechaRegistro ? new Date(c.fechaRegistro).toLocaleDateString('es-BO') : '—'}</td>
                <td class="td-acciones">
                    <button class="btn-editar" onclick="editarCliente(${c.idCliente})">Editar</button>
                    <button class="btn-delete" onclick="eliminarCliente(${c.idCliente})">Eliminar</button>
                </td>
            </tr>`).join('');
        }
        _regHandler('formCliente', guardarCliente);
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="td-error">Error al cargar.</td></tr>'; }
}

async function editarCliente(id) {
    try {
        const res = await fetch(`/api/admin/clientes/${id}`);
        if (!res.ok) throw new Error('Cliente no encontrado');
        const c = await res.json();

        document.getElementById('idClienteEdit').value        = c.idCliente;
        document.getElementById('cliPrimerNombre').value      = c.primerNombre || '';
        document.getElementById('cliSegundoNombre').value     = c.segundoNombre || '';
        document.getElementById('cliPrimerApellido').value    = c.primerApellido || '';
        document.getElementById('cliSegundoApellido').value   = c.segundoApellido || '';
        document.getElementById('cliEmail').value             = c.email || '';
        document.getElementById('cliTelefono').value          = c.telefono || '';
        document.getElementById('cliNitCi').value             = c.nitCi || '';

        document.getElementById('btnGuardarCliente').textContent   = 'Actualizar Cliente';
        document.getElementById('btnCancelarCliente').style.display = 'inline-block';
        document.getElementById('formCliente').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error al editar cliente:', error);
        alert('Error al cargar datos del cliente.');
    }
}
function cancelarEdicionCliente() {
    document.getElementById('formCliente').reset();
    document.getElementById('idClienteEdit').value = '';
    document.getElementById('btnGuardarCliente').textContent     = 'Guardar Cliente';
    document.getElementById('btnCancelarCliente').style.display  = 'none';
    document.getElementById('msgClientes').style.display         = 'none';
}
async function guardarCliente(e) {
    e.preventDefault();
    const idEdit = document.getElementById('idClienteEdit').value;
    const payload = {
        primerNombre:    document.getElementById('cliPrimerNombre').value.trim(),
        segundoNombre:   document.getElementById('cliSegundoNombre').value.trim() || null,
        primerApellido:  document.getElementById('cliPrimerApellido').value.trim(),
        segundoApellido: document.getElementById('cliSegundoApellido').value.trim() || null,
        email:           document.getElementById('cliEmail').value.trim(),
        telefono:        document.getElementById('cliTelefono').value.trim() || null,
        nitCi:           document.getElementById('cliNitCi').value.trim() || null
    };
    if (!payload.primerNombre || payload.primerNombre.length < 2)
        return alertaCatalogo('msgClientes', 'El primer nombre es obligatorio.', 'error');
    if (!payload.primerApellido || payload.primerApellido.length < 2)
        return alertaCatalogo('msgClientes', 'El primer apellido es obligatorio.', 'error');
    if (!payload.email || !payload.email.includes('@'))
        return alertaCatalogo('msgClientes', 'El email debe ser válido.', 'error');
    try {
        const url    = idEdit ? `/api/admin/clientes/${idEdit}` : '/api/admin/clientes';
        const method = idEdit ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data   = await res.json();
        if (data.exito) { alertaCatalogo('msgClientes', idEdit ? 'Cliente actualizado.' : 'Cliente registrado.', 'success'); cancelarEdicionCliente(); cargarClientes(); }
        else alertaCatalogo('msgClientes', data.error || 'Error.', 'error');
    } catch { alertaCatalogo('msgClientes', 'Error de red.', 'error'); }
}
async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    try {
        const res  = await fetch(`/api/admin/clientes/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarClientes();
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// PUESTOS LABORALES
// ============================================================
async function cargarPuestos() {
    const tbody = document.getElementById('tablaPuestosCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="td-cargando">Cargando...</td></tr>';
    try {
        const res  = await fetch('/api/admin/puestos');
        const data = await res.json();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="td-vacio">No hay puestos registrados.</td></tr>';
        } else {
            tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.idPuesto}</td>
                <td><strong>${p.nombrePuesto}</strong></td>
                <td>${parseFloat(p.salarioBase).toFixed(2)} Bs.</td>
                <td class="td-acciones">
                    <button class="btn-editar" onclick="editarPuesto(${p.idPuesto},'${p.nombrePuesto.replace(/'/g,"\\'")}',${p.salarioBase})">Editar</button>
                    <button class="btn-delete" onclick="eliminarPuesto(${p.idPuesto})">Eliminar</button>
                </td>
            </tr>`).join('');
        }
        _regHandler('formPuesto', guardarPuesto);
    } catch { tbody.innerHTML = '<tr><td colspan="4" class="td-error">Error al cargar.</td></tr>'; }
}
function editarPuesto(id, nombre, salario) {
    document.getElementById('idPuestoEdit').value     = id;
    document.getElementById('nombrePuesto').value     = nombre;
    document.getElementById('salarioBase').value      = salario;
    document.getElementById('btnGuardarPuesto').textContent   = 'Actualizar Puesto';
    document.getElementById('btnCancelarPuesto').style.display = 'inline-block';
}
function cancelarEdicionPuesto() {
    document.getElementById('formPuesto').reset();
    document.getElementById('idPuestoEdit').value = '';
    document.getElementById('btnGuardarPuesto').textContent    = 'Guardar Puesto';
    document.getElementById('btnCancelarPuesto').style.display = 'none';
    document.getElementById('msgPuestos').style.display        = 'none';
}
async function guardarPuesto(e) {
    e.preventDefault();
    const idEdit   = document.getElementById('idPuestoEdit').value;
    const nombre   = document.getElementById('nombrePuesto').value.trim();
    const salario  = parseFloat(document.getElementById('salarioBase').value);
    if (!nombre || nombre.length < 2)
        return alertaCatalogo('msgPuestos', 'El nombre es obligatorio (mín. 2 caracteres).', 'error');
    if (isNaN(salario) || salario < 0)
        return alertaCatalogo('msgPuestos', 'El salario base debe ser un número positivo.', 'error');
    try {
        const url    = idEdit ? `/api/admin/puestos/${idEdit}` : '/api/admin/puestos';
        const method = idEdit ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombrePuesto: nombre, salarioBase: salario }) });
        const data   = await res.json();
        if (data.exito) { alertaCatalogo('msgPuestos', idEdit ? 'Puesto actualizado.' : 'Puesto creado.', 'success'); cancelarEdicionPuesto(); cargarPuestos(); }
        else alertaCatalogo('msgPuestos', data.error || 'Error.', 'error');
    } catch { alertaCatalogo('msgPuestos', 'Error de red.', 'error'); }
}
async function eliminarPuesto(id) {
    if (!confirm('¿Eliminar este puesto? Los empleados asignados no podrán ser eliminados mientras.')) return;
    try {
        const res  = await fetch(`/api/admin/puestos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarPuestos();
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// ÁREAS DE LIMPIEZA
// ============================================================
async function cargarAreasLimpieza() {
    const tbody = document.getElementById('tablaAreasCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="td-cargando">Cargando...</td></tr>';
    try {
        const res  = await fetch('/api/admin/areas-limpieza');
        const data = await res.json();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="td-vacio">No hay áreas registradas.</td></tr>';
        } else {
            tbody.innerHTML = data.map(a => `
            <tr>
                <td>${a.idArea}</td>
                <td><strong>${a.nombreArea}</strong></td>
                <td class="td-acciones">
                    <button class="btn-editar" onclick="editarArea(${a.idArea},'${a.nombreArea.replace(/'/g,"\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarArea(${a.idArea})">Eliminar</button>
                </td>
            </tr>`).join('');
        }
        _regHandler('formArea', guardarArea);
    } catch { tbody.innerHTML = '<tr><td colspan="3" class="td-error">Error al cargar.</td></tr>'; }
}
function editarArea(id, nombre) {
    document.getElementById('idAreaEdit').value     = id;
    document.getElementById('nombreArea').value     = nombre;
    document.getElementById('btnGuardarArea').textContent   = 'Actualizar Área';
    document.getElementById('btnCancelarArea').style.display = 'inline-block';
}
function cancelarEdicionArea() {
    document.getElementById('formArea').reset();
    document.getElementById('idAreaEdit').value = '';
    document.getElementById('btnGuardarArea').textContent    = 'Guardar Área';
    document.getElementById('btnCancelarArea').style.display = 'none';
    document.getElementById('msgAreas').style.display        = 'none';
}
async function guardarArea(e) {
    e.preventDefault();
    const idEdit = document.getElementById('idAreaEdit').value;
    const nombre = document.getElementById('nombreArea').value.trim();
    if (!nombre || nombre.length < 2)
        return alertaCatalogo('msgAreas', 'El nombre debe tener al menos 2 caracteres.', 'error');
    try {
        const url    = idEdit ? `/api/admin/areas-limpieza/${idEdit}` : '/api/admin/areas-limpieza';
        const method = idEdit ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombreArea: nombre }) });
        const data   = await res.json();
        if (data.exito) { alertaCatalogo('msgAreas', idEdit ? 'Área actualizada.' : 'Área creada.', 'success'); cancelarEdicionArea(); cargarAreasLimpieza(); }
        else alertaCatalogo('msgAreas', data.error || 'Error.', 'error');
    } catch { alertaCatalogo('msgAreas', 'Error de red.', 'error'); }
}
async function eliminarArea(id) {
    if (!confirm('¿Eliminar esta área?')) return;
    try {
        const res  = await fetch(`/api/admin/areas-limpieza/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarAreasLimpieza();
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

// ============================================================
// HISTORIAL DE FACTURAS
// ============================================================
async function cargarFacturas() {
    const tbody      = document.getElementById('tablaFacturasCuerpo');
    if (!tbody) return;
    tbody.innerHTML  = '<tr><td colspan="7" class="td-cargando">Cargando...</td></tr>';
    const desde      = document.getElementById('facturaDesde')?.value || '';
    const hasta      = document.getElementById('facturaHasta')?.value || '';
    const estado     = document.getElementById('facturaEstado')?.value || '';
    const metodo     = document.getElementById('facturaMetodo')?.value || '';
    const params     = new URLSearchParams();
    if (desde)  params.append('desde',  desde);
    if (hasta)  params.append('hasta',  hasta);
    if (estado) params.append('estado', estado);
    if (metodo) params.append('idMetodoPago', metodo);
    try {
        const res  = await fetch('/api/admin/facturas?' + params.toString());
        const data = await res.json();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="td-vacio">No hay facturas para los filtros seleccionados.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(f => {
            const vigente = f.estadoFactura === 'Vigente';
            return `
            <tr class="${vigente ? '' : 'fila-anulada'}">
                <td><strong>${f.nroFactura}</strong></td>
                <td>${new Date(f.fechaEmision).toLocaleString('es-BO')}</td>
                <td>${f.nombreCliente || 'Sin cliente'} ${f.nitCi ? `<small>(${f.nitCi})</small>` : ''}</td>
                <td>${f.ubicacion}</td>
                <td>${f.nombreMetodo}</td>
                <td><strong>${parseFloat(f.montoTotal).toFixed(2)} Bs.</strong></td>
                <td>
                    <span class="badge ${vigente ? 'badge-success' : 'badge-danger'}">${f.estadoFactura}</span>
                    ${vigente ? `<button class="btn-delete btn-sm" onclick="anularFactura(${f.idFactura})">Anular</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="7" class="td-error">Error al cargar.</td></tr>'; }
}

async function anularFactura(id) {
    if (!confirm('⚠️ ¿Anular esta factura? El pedido volverá a estado "Entregado" para ser cobrado nuevamente.')) return;
    try {
        const res  = await fetch(`/api/admin/facturas/${id}/anular`, { method: 'PUT' });
        const data = await res.json();
        if (data.exito) { alertaCatalogo('msgFacturas', data.mensaje, 'success'); cargarFacturas(); }
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

async function cargarMetodosPagoFiltro() {
    try {
        const res  = await fetch('/api/admin/metodos-pago');
        const data = await res.json();
        const sel  = document.getElementById('facturaMetodo');
        if (!sel) return;
        sel.innerHTML = '<option value="">Todos los métodos</option>' +
            data.map(m => `<option value="${m.idMetodoPago}">${m.nombreMetodo}</option>`).join('');
    } catch {}
}

function inicializarHistorialFacturas() {
    cargarMetodosPagoFiltro();
    cargarFacturas();
}

// ============================================================
// RECETAS — MenuIngrediente
// ============================================================
let _recetaMenuActual = null;

async function abrirGestorReceta(idMenu, nombrePlato) {
    _recetaMenuActual = idMenu;
    const titulo = document.getElementById('receta-titulo');
    if (titulo) titulo.textContent = `Receta: ${nombrePlato}`;

    const modal = document.getElementById('modalReceta');
    if (modal) modal.style.display = 'flex';

    await cargarReceta(idMenu);
    await _cargarSelectIngredientes();
}

function cerrarGestorReceta() {
    _recetaMenuActual = null;
    const modal = document.getElementById('modalReceta');
    if (modal) modal.style.display = 'none';
}

async function cargarReceta(idMenu) {
    const tbody   = document.getElementById('tablaRecetaCuerpo');
    const divCosto= document.getElementById('receta-costo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="td-cargando">Cargando...</td></tr>';
    try {
        const [resReceta, resCosto] = await Promise.all([
            fetch(`/api/admin/recetas/${idMenu}`),
            fetch(`/api/admin/recetas/${idMenu}/costo`)
        ]);
        const receta = await resReceta.json();
        const costo  = await resCosto.json();

        if (receta.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="td-vacio">Sin ingredientes en la receta.</td></tr>';
        } else {
            tbody.innerHTML = receta.map(r => `
            <tr>
                <td>${r.nombreIngrediente}</td>
                <td>${parseFloat(r.cantidadRequerida).toFixed(3)} ${r.unidadMedida}</td>
                <td>${parseFloat(r.costoLinea).toFixed(2)} Bs.</td>
                <td class="td-acciones">
                    <button class="btn-delete btn-sm" onclick="quitarIngredienteReceta(${r.idIngrediente})">Quitar</button>
                </td>
            </tr>`).join('');
        }

        if (divCosto && costo.nombrePlato) {
            divCosto.innerHTML = `
                <span>Precio venta: <strong>${parseFloat(costo.precioActual).toFixed(2)} Bs.</strong></span>
                <span>Costo producción: <strong>${parseFloat(costo.costoProduccion).toFixed(2)} Bs.</strong></span>
                <span class="${parseFloat(costo.gananciaEstimada) >= 0 ? 'texto-exito' : 'texto-error'}">
                    Ganancia estimada: <strong>${parseFloat(costo.gananciaEstimada).toFixed(2)} Bs.</strong>
                </span>`;
        }
    } catch { tbody.innerHTML = '<tr><td colspan="4" class="td-error">Error al cargar receta.</td></tr>'; }
}

async function _cargarSelectIngredientes() {
    const sel = document.getElementById('receta-ingrediente');
    if (!sel) return;
    try {
        const res  = await fetch('/api/admin/ingredientes');
        const data = await res.json();
        sel.innerHTML = '<option value="">Seleccione ingrediente...</option>' +
            data.map(i => `<option value="${i.idIngrediente}">${i.nombreIngrediente} (${i.unidadMedida})</option>`).join('');
    } catch {}
}

async function agregarIngredienteAReceta() {
    const idIngrediente    = document.getElementById('receta-ingrediente')?.value;
    const cantidadRequerida= parseFloat(document.getElementById('receta-cantidad')?.value);
    if (!idIngrediente)
        return alertaCatalogo('msgReceta', 'Seleccione un ingrediente.', 'error');
    if (isNaN(cantidadRequerida) || cantidadRequerida <= 0)
        return alertaCatalogo('msgReceta', 'La cantidad debe ser mayor a 0.', 'error');
    try {
        const res  = await fetch(`/api/admin/recetas/${_recetaMenuActual}`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ idIngrediente, cantidadRequerida })
        });
        const data = await res.json();
        if (data.exito) { alertaCatalogo('msgReceta', 'Ingrediente agregado.', 'success'); cargarReceta(_recetaMenuActual); }
        else alertaCatalogo('msgReceta', data.error || 'Error.', 'error');
    } catch { alertaCatalogo('msgReceta', 'Error de red.', 'error'); }
}

async function quitarIngredienteReceta(idIngrediente) {
    if (!confirm('¿Quitar este ingrediente de la receta?')) return;
    try {
        const res  = await fetch(`/api/admin/recetas/${_recetaMenuActual}/${idIngrediente}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.exito) cargarReceta(_recetaMenuActual);
        else alert('❌ ' + data.error);
    } catch (err) { alert('Error: ' + err.message); }
}

// ── Handler único por form ────────────────────────────────────
function _regHandler(formId, fn) {
    const form = document.getElementById(formId);
    if (form && !form.dataset.handler) { form.addEventListener('submit', fn); form.dataset.handler = 'true'; }
}