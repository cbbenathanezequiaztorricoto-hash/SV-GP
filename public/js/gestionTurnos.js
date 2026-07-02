'use strict';

let editandoTurno = false;

// ============================================================
// CARGAR CATÁLOGOS (Áreas y Empleados)
// ============================================================
async function cargarCatalogos() {
    //console.log('🔍 Buscando selects...');
    // Usar querySelector para asegurar que obtenemos el SELECT correcto dentro del submódulo
    const selectArea = document.querySelector('#sub-turnos #idArea');
    const selectEmpleado = document.querySelector('#sub-turnos #idEmpleado');
    
    //console.log('📌 selectArea:', selectArea);
    //console.log('📌 selectEmpleado:', selectEmpleado);
    
    if (!selectArea || !selectEmpleado) {
        console.error('❌ No se encontraron los selects en el DOM');
        return;
    }

    try {
        // Cargar áreas
        const resAreas = await fetch('/api/admin/areas-limpieza');
        if (resAreas.ok) {
            const areas = await resAreas.json();
            //console.log('📋 Áreas recibidas:', areas);
            selectArea.innerHTML = '<option value="">Seleccione un área...</option>';
            areas.forEach(a => {
                selectArea.innerHTML += `<option value="${a.idArea}">${a.nombreArea}</option>`;
            });
            //console.log('✅ Select de áreas actualizado');
        }

        // Cargar empleados activos
        const resEmpleados = await fetch('/api/admin/empleados-activos');
        if (resEmpleados.ok) {
            const empleados = await resEmpleados.json();
            //console.log('👤 Empleados recibidos:', empleados);
            selectEmpleado.innerHTML = '<option value="">Seleccione un empleado...</option>';
            empleados.forEach(e => {
                selectEmpleado.innerHTML += `<option value="${e.idEmpleado}">${e.primerNombre} ${e.primerApellido} (${e.nombrePuesto})</option>`;
            });
            //console.log('✅ Select de empleados actualizado');
        }
    } catch (error) {
        console.error("❌ Error al cargar catálogos:", error);
    }
}

// ============================================================
// CARGAR TABLA DE TURNOS
// ============================================================
async function cargarTurnos() {
    const tbody = document.getElementById('tablaTurnosCuerpo');
    if (!tbody) {
        console.error('❌ No se encontró el tbody de turnos');
        return;
    }
    
    try {
        const respuesta = await fetch('/api/admin/turnos-limpieza');
        if (!respuesta.ok) throw new Error('Error al obtener turnos');
        
        const turnos = await respuesta.json();
        //console.log('📋 Turnos recibidos:', turnos);
        tbody.innerHTML = '';

        if (turnos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay turnos registrados.</td></tr>`;
            return;
        }

        turnos.forEach(t => {
            const spanEstado = t.completado 
                ? '<span class="badge estado-entregado" style="background:#27ae60;">Completado</span>' 
                : '<span class="badge estado-pendiente" style="background:#f39c12;">Pendiente</span>';
            const horarioStr = `${t.horaInicio.substring(0,5)} - ${t.horaFin.substring(0,5)}`;
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${t.diaSemana}</strong></td>
                    <td>${horarioStr}</td>
                    <td><span class="badge" style="background:#34495e;">${t.nombreArea}</span></td>
                    <td>${t.empleado}</td>
                    <td>${spanEstado}</td>
                    <td>
                        <button class="btn-submit" onclick="prepararEdicionTurno(${t.idTurno}, ${t.idEmpleado}, ${t.idArea}, '${t.diaSemana}', '${t.horaInicio}', '${t.horaFin}', '${t.observaciones || ''}')">Editar</button>
                        ${!t.completado ? `<button class="btn-submit" style="background:var(--success);" onclick="completarTurno(${t.idTurno})">Completar</button>` : ''}
                        <button class="btn-delete" onclick="eliminarTurno(${t.idTurno})">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("❌ Error cargando turnos:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error de conexión con el servidor.</td></tr>`;
    }
}

// ============================================================
// CRUD
// ============================================================
async function guardarTurno(e) {
    e.preventDefault();
    const payload = {
        idEmpleado: document.getElementById('idEmpleado').value,
        idArea: document.getElementById('idArea').value,
        diaSemana: document.getElementById('diaSemana').value,
        horaInicio: document.getElementById('horaInicio').value,
        horaFin: document.getElementById('horaFin').value,
        observaciones: document.getElementById('observaciones').value.trim()
    };

    if (!payload.idEmpleado) return mostrarMensaje('Seleccione un empleado.', 'error');
    if (!payload.idArea) return mostrarMensaje('Seleccione un área.', 'error');
    if (!payload.diaSemana) return mostrarMensaje('Seleccione un día.', 'error');
    if (!payload.horaInicio || !payload.horaFin) return mostrarMensaje('Ingrese hora de inicio y fin.', 'error');
    if (payload.horaInicio >= payload.horaFin) return mostrarMensaje('La hora de inicio debe ser menor a la hora de fin.', 'error');

    const idTurno = document.getElementById('idTurno').value;
    const url = editandoTurno ? `/api/admin/turnos-limpieza/${idTurno}` : '/api/admin/turnos-limpieza';
    const method = editandoTurno ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || 'Ocurrió un error');

        mostrarMensaje(resultado.mensaje || 'Operación exitosa.', 'success');
        cancelarEdicion();
        cargarTurnos();
    } catch (error) {
        mostrarMensaje(error.message, 'error');
    }
}
function prepararEdicionTurno(idTurno, idEmpleado, idArea, diaSemana, horaInicio, horaFin, observaciones) {
    editandoTurno = true;
    document.getElementById('idTurno').value = idTurno;
    document.getElementById('formTurnoTitulo').innerText = 'Modificar Turno';
    document.getElementById('idEmpleado').value = idEmpleado;
    document.getElementById('idArea').value = idArea;
    document.getElementById('diaSemana').value = diaSemana;
    document.getElementById('horaInicio').value = horaInicio.substring(0,5);
    document.getElementById('horaFin').value = horaFin.substring(0,5);
    document.getElementById('observaciones').value = observaciones;
    
    document.getElementById('btnGuardarTurno').innerText = 'Actualizar Cambios';
    document.getElementById('btnCancelarEdicion').style.display = 'block';
}
function cancelarEdicion() {
    editandoTurno = false;
    document.getElementById('formTurno').reset();
    document.getElementById('idTurno').value = '';
    document.getElementById('formTurnoTitulo').innerText = 'Asignar Turno de Limpieza';
    document.getElementById('btnGuardarTurno').innerText = 'Guardar Turno';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
}
async function eliminarTurno(id) {
    if (!confirm('¿Está seguro de eliminar este turno?')) return;
    try {
        const respuesta = await fetch(`/api/admin/turnos-limpieza/${id}`, { method: 'DELETE' });
        if (respuesta.ok) {
            mostrarMensaje('Turno eliminado con éxito', 'success');
            cargarTurnos();
        } else {
            throw new Error('No se pudo eliminar el turno.');
        }
    } catch (error) {
        mostrarMensaje(error.message, 'error');
    }
}
async function completarTurno(idTurno) {
    if (!confirm('¿Marcar este turno como completado?')) return;
    try {
        const res = await fetch(`/api/admin/turnos-limpieza/${idTurno}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completado: 1 })
        });
        const data = await res.json();
        if (res.ok && data.exito) {
            cargarTurnos();
        } else {
            alert('Error: ' + (data.error || 'No se pudo completar.'));
        }
    } catch (error) {
        console.error(error);
        alert('Error de red.');
    }
}
// ============================================================
// MOSTRAR MENSAJE
// ============================================================
function mostrarMensaje(mensaje, tipo) {
    const contenedor = document.getElementById('mensajeStatus');
    contenedor.innerText = mensaje;
    contenedor.className = tipo === 'success' ? 'alert-success' : 'alert-error';
    contenedor.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { contenedor.style.display = 'none'; }, 4000);
}

// ============================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const nombreAdmin = document.getElementById('nombreAdmin');
    if (nombreAdmin) nombreAdmin.innerText = username || 'Admin';

    const form = document.getElementById('formTurno');
    if (form) form.addEventListener('submit', guardarTurno);
});