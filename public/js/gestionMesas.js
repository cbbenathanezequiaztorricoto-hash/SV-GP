'use strict';
let editandoMesa = false;
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    cargarMesas();
    configurarFormularioMesa();
    document.getElementById('nombreAdmin').innerText = username || 'Admin';
});

async function cargarMesas() {
    try {
        // CORRECCIÓN: Ruta exacta según server.js
        const respuesta = await fetch('/api/admin/mesas');
        if (!respuesta.ok) throw new Error('Error al obtener mesas.');
        
        const mesas = await respuesta.json();
        const tbody = document.getElementById('tablaMesasCuerpo');
        tbody.innerHTML = '';

        if (mesas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay mesas registradas.</td></tr>`;
            return;
        }

        mesas.forEach(mesa => {
            const tr = document.createElement('tr');
            let estadoClass = mesa.estado === 'Libre' ? 'badge estado-entregado' : 'badge estado-pendiente';
            
            tr.innerHTML = `
                <td><strong>Mesa ${mesa.numeroMesa}</strong></td>
                <td>${mesa.capacidad} Personas</td>
                <td><span class="${estadoClass}" style="background-color: ${mesa.estado === 'Libre' ? '#27ae60' : (mesa.estado === 'Ocupada' ? '#e74c3c' : '#f39c12')}; color: white;">${mesa.estado}</span></td>
                <td>
                    <button onclick="prepararEdicionMesa(${mesa.idMesa}, ${mesa.numeroMesa}, ${mesa.capacidad}, '${mesa.estado}')" class="btn-small" style="background-color: #3498db; color: white;">Modificar</button>
                    <button onclick="eliminarMesa(${mesa.idMesa})" class="btn-small btn-delete">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        document.getElementById('tablaMesasCuerpo').innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error al conectar con el servidor.</td></tr>`;
    }
}

function configurarFormularioMesa() {
    document.getElementById('formMesa').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idMesa = document.getElementById('idMesa').value;
        const payload = {
            numeroMesa: document.getElementById('numeroMesa').value,
            capacidad: document.getElementById('capacidad').value,
            estado: document.getElementById('estadoMesa').value
        };
        
        // CORRECCIÓN: Rutas exactas
        const url = idMesa ? `/api/admin/mesas/${idMesa}` : '/api/admin/mesas';
        const method = idMesa ? 'PUT' : 'POST';

        try {
            const respuesta = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const resultado = await respuesta.json();
            
            if (respuesta.ok) {
                mostrarAlerta(resultado.success || 'Operación realizada correctamente', true);
                resetearFormularioMesa();
                cargarMesas();
            } else {
                throw new Error(resultado.error || 'Error al guardar');
            }
        } catch (error) {
            mostrarAlerta(error.message, false);
        }
    });
}

function prepararEdicionMesa(id, numero, capacidad, estado) {
    document.getElementById('idMesa').value = id;
    document.getElementById('numeroMesa').value = numero;
    document.getElementById('capacidad').value = capacidad;
    document.getElementById('estadoMesa').value = estado;
    document.getElementById('formMesaTitulo').innerText = 'Modificar Mesa';
    document.getElementById('btnGuardarMesa').innerText = 'Actualizar Cambios';
    document.getElementById('btnCancelarEdicion').style.display = 'block';
}

function resetearFormularioMesa() {
    document.getElementById('idMesa').value = '';
    document.getElementById('formMesa').reset();
    document.getElementById('formMesaTitulo').innerText = 'Registrar Nueva Mesa';
    document.getElementById('btnGuardarMesa').innerText = 'Guardar Mesa';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
}

async function eliminarMesa(id) {
    if (!confirm('¿Está seguro de eliminar esta mesa?')) return;
    try {
        const respuesta = await fetch(`/api/admin/mesas/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarAlerta('Mesa removida con éxito', true);
            cargarMesas();
        } else {
            throw new Error('No se pudo eliminar la mesa.');
        }
    } catch (error) {
        mostrarAlerta(error.message, false);
    }
}

function mostrarAlerta(mensaje, esExito) {
    const contenedor = document.getElementById('mensajeStatus');
    contenedor.innerText = mensaje;
    contenedor.className = esExito ? 'alert-success' : 'alert-error';
    contenedor.style.display = 'block';
    setTimeout(() => { contenedor.style.display = 'none'; }, 4000);
}
