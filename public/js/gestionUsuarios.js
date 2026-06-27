'use strict';
// ============================================================
// MÓDULO USUARIOS
// ============================================================

async function cargarCatalogosRRHH() {
    try {
        const res = await fetch('/api/admin/rrhh/catalogos');
        if (!res.ok) throw new Error('Error servidor');
        const { roles, puestos } = await res.json();

        const selRol = document.getElementById('idRol');
        if (selRol) {
            selRol.innerHTML = '<option value="">Seleccione Rol...</option>';
            roles.forEach(r => selRol.innerHTML += `<option value="${r.idRol}">${r.nombreRol}</option>`);
        }

        const selPuesto = document.getElementById('idPuesto');
        if (selPuesto) {
            selPuesto.innerHTML = '<option value="">Seleccione Puesto...</option>';
            puestos.forEach(p => selPuesto.innerHTML += `<option value="${p.idPuesto}">${p.nombrePuesto}</option>`);
        }
    } catch (err) {
        console.error('Error al cargar roles/puestos:', err);
    }
}

async function cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuariosCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/admin/usuarios');
        if (!res.ok) throw new Error('Error servidor');
        const usuarios = await res.json();

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay usuarios registrados.</td></tr>';
            return;
        }

        // DEBUG: Verificar que todos los usuarios tengan idEmpleado
        console.log('Usuarios cargados:', usuarios);

        tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.ci}</td>
                <td><strong>${u.primerNombre} ${u.primerApellido}</strong></td>
                <td>
                    <small>${u.nombreRol || 'Sin rol'}</small><br>
                    <span style="color:#7f8c8d;font-size:11px;">${u.nombrePuesto || 'Sin puesto'}</span>
                </td>
                <td>${u.username}</td>
                <td>${u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('es-BO') : 'Nunca'}</td>
                <td>
                    <span class="badge" style="background:${u.estado === 'Activo' ? '#27ae60' : '#e74c3c'};color:white;">
                        ${u.estado}
                    </span>
                </td>
                <td style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button style="background:#2980b9;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                        onclick="editarUsuario(${u.idEmpleado})">Editar</button>
                    ${u.estado === 'Activo'
                        ? `<button style="background:#e67e22;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                            onclick="darDeBaja(${u.idEmpleado})">Dar de baja</button>`
                        : `<button style="background:#27ae60;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;"
                            onclick="reactivarUsuario(${u.idEmpleado})">Activar</button>`
                    }
                    <button class="btn-delete"
                        onclick="eliminarUsuarioTotal(${u.idEmpleado}, '${(u.primerNombre + ' ' + u.primerApellido).replace(/'/g, "\\'")}')">
                        Eliminar
                    </button>
                </td>
            </tr>`).join('');

        const form = document.getElementById('formUsuario');
        if (form && !form.dataset.handlerRegistrado) {
            form.addEventListener('submit', guardarUsuario);
            form.dataset.handlerRegistrado = 'true';
        }

        const fechaInput = document.getElementById('fechaContratacion');
        if (fechaInput && !fechaInput.value) fechaInput.valueAsDate = new Date();

    } catch (error) {
        console.error('Error cargando usuarios:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red;text-align:center;">Error al cargar usuarios.</td></tr>';
    }
}

// Reactivar usuario (cambiar estado a Activo)
async function reactivarUsuario(idEmpleado) {
    if (!confirm('¿Reactivar a este empleado? Volverá a estado Activo.')) return;
    try {
        const res = await fetch(`/api/admin/usuarios/${idEmpleado}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Activo' })
        });
        const resultado = await res.json();
        if (res.ok && resultado.exito) {
            cargarUsuarios();
        } else {
            alert('Error: ' + (resultado.error || 'No se pudo reactivar.'));
        }
    } catch (err) {
        console.error(err);
        alert('Error de red.');
    }
}

// Dar de baja (Inactivar)
async function darDeBaja(idEmpleado) {
    if (!confirm('¿Dar de baja a este empleado? Pasará a estado Inactivo.')) return;
    try {
        const res = await fetch(`/api/admin/usuarios/${idEmpleado}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Inactivo' })
        });
        const resultado = await res.json();
        if (res.ok && resultado.exito) {
            cargarUsuarios();
        } else {
            alert('Error: ' + (resultado.error || 'No se pudo procesar la baja.'));
        }
    } catch (err) {
        console.error(err);
        alert('Error de red.');
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const btn = document.querySelector('#password + button') || document.querySelector('#password').parentElement.querySelector('button');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (btn) btn.textContent = 'Ocultar';
    } else {
        passwordInput.type = 'password';
        if (btn) btn.textContent = 'Mostrar';
    }
}

async function guardarUsuario(e) {
    e.preventDefault();
    const statusDiv = document.getElementById('mensajeStatusUsuarios');

    const idEmpleado     = document.getElementById('idEmpleadoEdit').value;
    const primerNombre   = document.getElementById('primerNombre').value.trim();
    const primerApellido = document.getElementById('primerApellido').value.trim();
    const ci             = document.getElementById('ci').value.trim();
    const edad           = parseInt(document.getElementById('edad').value);
    const idRol          = document.getElementById('idRol').value;
    const idPuesto       = document.getElementById('idPuesto').value;
    const username       = document.getElementById('username').value.trim();
    const password       = document.getElementById('password').value;
    const fotoInput      = document.getElementById('fotoPerfil');

    if (!primerNombre || primerNombre.length < 2)
        return mostrarMensajeUsuario('El primer nombre es obligatorio (mín. 2 caracteres).', 'error');
    if (!primerApellido || primerApellido.length < 2)
        return mostrarMensajeUsuario('El primer apellido es obligatorio.', 'error');
    if (!ci || ci.length < 5)
        return mostrarMensajeUsuario('El CI debe tener al menos 5 caracteres.', 'error');
    if (isNaN(edad) || edad < 18)
        return mostrarMensajeUsuario('La edad mínima es 18 años.', 'error');
    if (!idRol)
        return mostrarMensajeUsuario('Debe seleccionar un rol.', 'error');
    if (!idPuesto)
        return mostrarMensajeUsuario('Debe seleccionar un puesto.', 'error');
    if (!username || username.length < 3)
        return mostrarMensajeUsuario('El usuario debe tener al menos 3 caracteres.', 'error');
    if (!idEmpleado && (!password || password.length < 6))
        return mostrarMensajeUsuario('La contraseña debe tener al menos 6 caracteres.', 'error');

    const file = fotoInput && fotoInput.files && fotoInput.files[0];
    const fotoPerfil = file ? await fileToBase64(file) : null;
    const modulosPermitidos = Array.from(document.querySelectorAll('input[name="modulosPermitidos"]:checked')).map(ch => ch.value);
    if (modulosPermitidos.length === 0) {
        return mostrarMensajeUsuario('Debe seleccionar al menos un módulo visible.', 'error');
    }

    const payload = {
        primerNombre,
        segundoNombre:   document.getElementById('segundoNombre').value.trim() || null,
        primerApellido,
        segundoApellido: document.getElementById('segundoApellido').value.trim() || null,
        ci, edad,
        fechaContratacion: document.getElementById('fechaContratacion').value,
        idRol, idPuesto, username,
        password: password || null,
        fotoPerfil,
        modulosPermitidos
    };

    const url = idEmpleado ? `/api/admin/usuarios/${idEmpleado}` : '/api/admin/usuarios';
    const method = idEmpleado ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resultado = await res.json();

        if (res.ok && resultado.exito) {
            mostrarMensajeUsuario(resultado.mensaje || 'Usuario guardado exitosamente.', 'success');
            resetearFormularioUsuario();
            cargarUsuarios();
        } else {
            mostrarMensajeUsuario(resultado.error || 'Error de servidor.', 'error');
        }
    } catch (error) {
        console.error(error);
        mostrarMensajeUsuario('Error de red: no se pudo conectar.', 'error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function editarUsuario(idEmpleado) {
    try {
        const res = await fetch(`/api/admin/usuarios/${idEmpleado}`);
        if (!res.ok) throw new Error('Usuario no encontrado');
        const usuario = await res.json();

        document.getElementById('idEmpleadoEdit').value = usuario.idEmpleado;
        document.getElementById('primerNombre').value = usuario.primerNombre || '';
        document.getElementById('segundoNombre').value = usuario.segundoNombre || '';
        document.getElementById('primerApellido').value = usuario.primerApellido || '';
        document.getElementById('segundoApellido').value = usuario.segundoApellido || '';
        document.getElementById('ci').value = usuario.ci || '';
        document.getElementById('edad').value = usuario.edad || '';
        const fecha = usuario.fechaContratacion ? new Date(usuario.fechaContratacion).toISOString().split('T')[0] : '';
        document.getElementById('fechaContratacion').value = fecha;
        document.getElementById('idRol').value = usuario.idRol || '';
        document.getElementById('idPuesto').value = usuario.idPuesto || '';
        document.getElementById('username').value = usuario.username || '';

        const passwordInput = document.getElementById('password');
        if (usuario.tienePassword) {
            passwordInput.placeholder = 'Dejar vacío para mantener la contraseña';
            passwordInput.required = false;
        } else {
            passwordInput.placeholder = 'Nueva contraseña (obligatorio)';
            passwordInput.required = true;
        }
        passwordInput.value = '';

        document.getElementById('btnGuardarUsuario').textContent = 'Actualizar Usuario';
        document.getElementById('btnCancelarEdicion').style.display = 'inline-block';
        mostrarMensajeUsuario('Modo edición activado. Cambie los campos y presione actualizar.', 'success');

    } catch (error) {
        console.error(error);
        alert('No se pudo cargar el usuario para editar.');
    }
}

function resetearFormularioUsuario() {
    const form = document.getElementById('formUsuario');
    if (form) form.reset();
    document.getElementById('idEmpleadoEdit').value = '';
    document.getElementById('btnGuardarUsuario').textContent = 'Registrar Personal';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
    document.getElementById('fechaContratacion').valueAsDate = new Date();
}

async function eliminarUsuarioTotal(idEmpleado, nombre) {
    if (!confirm(`⚠️ ADVERTENCIA: Esto eliminará permanentemente a "${nombre}" y sus credenciales de acceso. ¿Continuar?`)) return;
    try {
        const res = await fetch(`/api/admin/usuarios/${idEmpleado}/eliminar`, { method: 'DELETE' });
        const resultado = await res.json();
        if (resultado.exito) {
            cargarUsuarios();
        } else {
            alert('Error: ' + (resultado.error || 'No se pudo eliminar.'));
        }
    } catch (err) {
        alert('Error de red: ' + err.message);
    }
}

function mostrarMensajeUsuario(mensaje, tipo) {
    const div = document.getElementById('mensajeStatusUsuarios');
    if (!div) return;
    div.className = tipo === 'success' ? 'alert-success' : 'alert-error';
    div.innerText = (tipo === 'error' ? '❌ ' : '✅ ') + mensaje;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 4000);
}