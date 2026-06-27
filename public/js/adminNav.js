// public/js/adminNav.js

'use strict';

/**
 * Gestiona la barra de navegación del panel de administración
 */
function inicializarNavAdmin() {
    const currentPath = window.location.pathname;

    // Remover clase active de todos los enlaces
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Activar según la página actual
    if (currentPath.includes('IGestionElRecuerdo.html') || currentPath.includes('admin.html')) {
        const menuLink = document.getElementById('nav-menu');
        if (menuLink) menuLink.classList.add('active');
    } 
    else if (currentPath.includes('IGestionPedido.html')) {
        const pedidosLink = document.getElementById('nav-pedidos');
        if (pedidosLink) pedidosLink.classList.add('active');
    } 
    else if (currentPath.includes('IVentas.html')) {
        const ventasLink = document.getElementById('nav-ventas');
        if (ventasLink) ventasLink.classList.add('active');
    }
}

// Ejecutar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', inicializarNavAdmin);