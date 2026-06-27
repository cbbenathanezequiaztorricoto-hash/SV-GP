// public/js/pestanias.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    // 1. Quitar la clase 'activo' de todos los enlaces de la barra lateral
    document.querySelectorAll('.side-link').forEach(link => {
        link.classList.remove('activo');
    });

    // 2. Activar la pestaña lateral correspondiente según la URL
    if (currentPath.includes('IGestionElRecuerdo.html') || currentPath.includes('admin.html')) {
        const sideMenu = document.getElementById('side-menu');
        if (sideMenu) sideMenu.classList.add('activo');
    } 
    else if (currentPath.includes('GestionUsuarios.html')) {
        const sideUsuarios = document.getElementById('side-usuarios');
        if (sideUsuarios) sideUsuarios.classList.add('activo');
    } 
    else if (currentPath.includes('GestionMesas.html')) {
        const sideMesas = document.getElementById('side-mesas');
        if (sideMesas) sideMesas.classList.add('activo');
    } 
    else if (currentPath.includes('GestionTurnos.html')) {
        const sideTurnos = document.getElementById('side-turnos');
        if (sideTurnos) sideTurnos.classList.add('activo');
    }
});