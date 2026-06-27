document.addEventListener('DOMContentLoaded', () => {
    // Toggle contraseña
    const toggleBtn = document.getElementById('togglePassword');
    const toggleText = document.getElementById('toggleText');
    const passwordField = document.getElementById('password');

    if (toggleBtn && passwordField) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = passwordField.type === 'password';
            passwordField.type = isHidden ? 'text' : 'password';
            toggleText.textContent = isHidden ? 'Ocultar' : 'Mostrar';
        });
    }

    // Formulario
    const form = document.getElementById('formLogin');
    const mensajeError = document.getElementById('mensajeError');
    const btnLogin = document.getElementById('btnLogin');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = passwordField.value;

        mensajeError.classList.remove('success', 'error', 'visible');
        mensajeError.innerText = '';

        if (!username) return mostrarError("El usuario es obligatorio", 'username');
        if (username.length < 3) return mostrarError("El usuario debe tener mínimo 3 caracteres", 'username');
        if (!password) return mostrarError("La contraseña es obligatoria", 'password');
        if (password.length < 4) return mostrarError("La contraseña debe tener mínimo 4 caracteres", 'password');

        btnLogin.disabled = true;
        btnLogin.textContent = "Ingresando...";

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.exito) {
                localStorage.setItem('idUsuario', data.idUsuario || '');
                localStorage.setItem('username', data.username || '');
                localStorage.setItem('idRol', data.idRol);
                localStorage.setItem('rolNombre', data.rolNombre || '');
                localStorage.setItem('permisos', JSON.stringify(data.permisos));
                if (data.fotoPerfil) {
                    localStorage.setItem('fotoPerfil', data.fotoPerfil);
                } else {
                    localStorage.removeItem('fotoPerfil');
                }

                if (document.getElementById('rememberMe').checked) {
                    localStorage.setItem('rememberedUsername', username);
                }

                mensajeError.classList.add('success', 'visible');
                mensajeError.innerText = "¡Inicio exitoso! Redirigiendo...";
                
                setTimeout(() => {
                    window.location.href = '/vistas/IGestionElRecuerdo.html';
                }, 800);
                
            } else {
                mensajeError.classList.add('error', 'visible');
                mensajeError.innerText = data.error || "Usuario o contraseña incorrectos. Verifica tus datos.";
            }
        } catch (err) {
            mensajeError.classList.add('error', 'visible');
            mensajeError.innerText = "Error de conexión con el servidor";
            console.error(err);
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = "Ingresar";
        }
    });

    function mostrarError(texto, inputId) {
        mensajeError.classList.add('error', 'visible');
        mensajeError.innerText = texto;
        const input = document.getElementById(inputId);
        if (input) {
            input.focus();
            input.classList.add('input-error');
            setTimeout(() => input.classList.remove('input-error'), 2500);
        }
    }

    // Recordar usuario
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
        document.getElementById('username').value = remembered;
        document.getElementById('rememberMe').checked = true;
    }
});