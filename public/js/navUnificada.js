//SV_GP/public/js/navUnificada.js
'use strict';

// ============================================================
// PERMISOS DEL USUARIO
// ============================================================
function obtenerPermisos() {
    try {
        return JSON.parse(localStorage.getItem('permisos')) || {};
    } catch {
        return {};
    }
}

function tienePermiso(subModulo, operacion) {
    const permisos = obtenerPermisos();
    //console.log('tienePermiso -> subModulo:', subModulo, 'operacion:', operacion, 'permisos:', permisos);
    const permiso = permisos[subModulo];
    if (!permiso) return false;
    switch (operacion) {
        case 'ver':      return permiso.ver === true;
        case 'insertar': return permiso.insertar === true;
        case 'editar':   return permiso.editar === true;
        case 'eliminar': return permiso.eliminar === true;
        default:         return false;
    }
}
window.tienePermiso = tienePermiso; // para uso global

// ============================================================
// CONFIGURACIÓN DE NAVEGACIÓN (sin rolesAllowed)
// ============================================================
const configNav = {
    'modulo-admin': [
        { id: 'sub-menu',          label: 'Menú' },
        { id: 'sub-usuarios',      label: 'Usuarios' },
        { id: 'sub-mesas',         label: 'Mesas' },
        { id: 'sub-turnos',        label: 'Turnos de Limpieza' },
        { id: 'sub-roles',         label: 'Roles' },
        { id: 'sub-pagos',         label: 'Métodos de Pago' },
        { id: 'sub-ingredientes',  label: 'Ingredientes' },
        { id: 'sub-proveedores',   label: 'Proveedores' },
        { id: 'sub-categorias',    label: 'Categorías Menú' },
        { id: 'sub-clientes',      label: 'Clientes' },
        { id: 'sub-puestos',       label: 'Puestos' },
        { id: 'sub-areas',         label: 'Áreas' },
        { id: 'sub-facturas',      label: 'Facturas' },
        { id: 'sub-reportes',      label: 'Reportes' },
        { id: 'card-modelos-matematicos', label: 'Optimización' },
        { id: 'sub-cierre-caja',   label: 'Cierre caja' }
        
    ],
    'modulo-pedidos': [
        { id: 'sub-gestion-pedidos', label: 'Gestionar Pedidos' },
        { id: 'sub-cocina-monitor',  label: 'Consultar Estado Pedidos' },
        { id: 'sub-delivery',        label: 'Pedidos para Delivery' }
    ],
    'modulo-ventas': [
        { id: 'sub-gestionar-ventas',     label: 'Gestionar Venta' }
    ]
};

// ============================================================
// MAPA: función a ejecutar al entrar a cada sub-módulo
// ============================================================
const onEntrarSubModulo = {
    'sub-menu':              () => { if (typeof cargarCatalogoMenu      === 'function') cargarCatalogoMenu(); },
    'sub-usuarios':          () => {
        if (typeof cargarCatalogosRRHH === 'function') cargarCatalogosRRHH();
        if (typeof cargarUsuarios      === 'function') cargarUsuarios();
    },
    'sub-mesas':             () => { if (typeof cargarMesas             === 'function') cargarMesas(); },
    'sub-turnos': () => {
        if (typeof cargarCatalogos === 'function') cargarCatalogos();
        if (typeof cargarTurnos === 'function') cargarTurnos();
    },
    'sub-roles':             () => { if (typeof cargarRoles             === 'function') cargarRoles(); },
    'sub-pagos':             () => { if (typeof cargarMetodosPagoAdmin  === 'function') cargarMetodosPagoAdmin(); },
    'sub-ingredientes': () => {
        if (typeof cargarIngredientes === 'function') cargarIngredientes();
        if (typeof cargarSelectProveedores === 'function') cargarSelectProveedores();
    },
    'sub-cierre-caja':       () => {
        if (typeof inicializarCierreCaja  === 'function') inicializarCierreCaja(); 
    },
    'sub-categorias':        () => { if (typeof cargarCategorias === 'function') cargarCategorias(); },
    'sub-clientes':          () => { if (typeof cargarClientes === 'function') cargarClientes(); },
    'sub-puestos':           () => { if (typeof cargarPuestos === 'function') cargarPuestos(); },
    'sub-areas':             () => { if (typeof cargarAreasLimpieza === 'function') cargarAreasLimpieza(); },
    'sub-facturas':          () => { if (typeof inicializarHistorialFacturas === 'function') inicializarHistorialFacturas(); },
    'sub-gestion-pedidos':   () => { if (typeof inicializarModuloPOS   === 'function') inicializarModuloPOS(); },
    'sub-delivery': () => {
        if (typeof cargarDelivery === 'function') cargarDelivery();
    },
    'sub-cocina-monitor':    () => { if (typeof cargarMonitorCocina    === 'function') cargarMonitorCocina(); },
    'sub-gestionar-ventas':  () => {
        if (typeof cargarPedidosParaCobro  === 'function') cargarPedidosParaCobro();
        if (typeof cargarMetodosPagoVentas === 'function') cargarMetodosPagoVentas();
        if (typeof inicializarModuloVentas === 'function') inicializarModuloVentas();
    },
    'sub-ventas-reportes':       () => { if (typeof cargarReportesDiarios     === 'function') cargarReportesDiarios(); },
    'sub-proveedores': () => {
        if (typeof cargarProveedores === 'function') cargarProveedores();
    },
    'sub-reportes': () => {
        if (typeof cargarReportes === 'function') cargarReportes();
    },
    'card-modelos-matematicos':  () => { if (typeof cargarModelosMatematicos  === 'function') cargarModelosMatematicos(); }
};

// ============================================================
// CONTROL DE ACCESO
// ============================================================
function moduloTienePermiso(moduloId) {
    const subModulos = configNav[moduloId] || [];
    return subModulos.some(sub => tienePermiso(sub.id, 'ver'));
}

function aplicarRestriccionesNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        const onclick = link.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]+)['"]/);
        const target = match ? match[1] : null;
        if (!target) return;
        const visible = moduloTienePermiso(target);
        link.classList.toggle('hide', !visible);
        const moduloElem = document.getElementById(target);
        if (moduloElem) moduloElem.classList.toggle('hide', !visible);
    });
}

// ============================================================
// NAVEGACIÓN PRINCIPAL
// ============================================================
function cambiarModulo(moduloId, elemento) {
    if (!moduloTienePermiso(moduloId)) return;

    document.querySelectorAll('.modulo-activo, .modulo-oculto').forEach(mod => {
        mod.classList.remove('modulo-activo');
        mod.classList.add('modulo-oculto');
    });

    const moduloSel = document.getElementById(moduloId);
    if (moduloSel) {
        moduloSel.classList.remove('modulo-oculto');
        moduloSel.classList.add('modulo-activo');
    }

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (elemento) elemento.classList.add('active');

    actualizarSidebar(moduloId);
    localStorage.setItem('moduloActivo', moduloId);
}

function actualizarSidebar(moduloId) {
    const sidebar = document.getElementById('sidebar');
    const subModulos = (configNav[moduloId] || []).filter(sub => tienePermiso(sub.id, 'ver'));

    sidebar.innerHTML = subModulos.map((sub, i) => `
        <a href="#" class="side-link ${i === 0 ? 'activo' : ''}"
           onclick="cambiarSubModulo('${sub.id}', this)">
            ${sub.label}
        </a>`).join('');

    if (subModulos.length > 0) {
        cambiarSubModulo(subModulos[0].id, sidebar.querySelector('.side-link'));
    }
}

function cambiarSubModulo(subModuloId, elemento) {
    if (!tienePermiso(subModuloId, 'ver')) {
        console.warn('Acceso denegado: no tiene permiso de ver en', subModuloId);
        return;
    }

    const moduloActual = document.querySelector('.modulo-activo');
    if (moduloActual) {
        moduloActual.querySelectorAll('.sub-modulo').forEach(sub => sub.classList.remove('activo'));
    }

    const subSel = document.getElementById(subModuloId);
    if (subSel) subSel.classList.add('activo');

    if (elemento) {
        elemento.parentElement.querySelectorAll('.side-link').forEach(l => l.classList.remove('activo'));
        elemento.classList.add('activo');
    }

    if (onEntrarSubModulo[subModuloId]) {
        onEntrarSubModulo[subModuloId]();
    }
}

// ============================================================
// INICIO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const idUsuario = localStorage.getItem('idUsuario');
    const permisos = obtenerPermisos();

    // Si no hay sesión o no hay permisos, redirigir al login
    if (!idUsuario || Object.keys(permisos).length === 0) {
        window.location.href = '/';
        return;
    }

    // Aplicar restricciones visuales (ocultar módulos sin acceso)
    aplicarRestriccionesNav();

    // Determinar primer módulo visible (con al menos un submódulo con permiso de ver)
    const modulosVisibles = Object.keys(configNav).filter(modId => moduloTienePermiso(modId));
    let moduloInicial = localStorage.getItem('moduloActivo') || modulosVisibles[0] || 'modulo-admin';

    // Si el módulo guardado no es visible, usar el primero visible
    if (!modulosVisibles.includes(moduloInicial)) {
        moduloInicial = modulosVisibles[0] || 'modulo-admin';
    }

    const navLink = document.querySelector(`.nav-link[onclick*="${moduloInicial}"]`);
    if (navLink && !navLink.classList.contains('hide')) {
        cambiarModulo(moduloInicial, navLink);
    } else {
        // Fallback: primer link visible
        const primerLink = document.querySelector('.nav-link:not(.hide)');
        if (primerLink) primerLink.click();
    }
});