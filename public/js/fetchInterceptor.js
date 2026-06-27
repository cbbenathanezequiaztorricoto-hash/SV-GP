// public/js/fetchInterceptor.js
// Interceptor global de fetch para agregar x-user-id automáticamente y manejar sesiones expiradas
(function() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
        const idUsuario = localStorage.getItem('idUsuario');
        
        // Solo agregar header si existe idUsuario (usuario logueado)
        if (idUsuario) {
            options.headers = {
                ...(options.headers || {}),
                'x-user-id': idUsuario
            };
        }
        
        try {
            const response = await originalFetch.call(this, url, options);
            
            // ✅ Detectar sesión expirada (401)
            if (response.status === 401) {
                console.log('⚠️ Sesión expirada, redirigiendo al login...');
                
                // Mostrar notificación elegante
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Sesión expirada',
                        text: 'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
                        timer: 10000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                } else {
                    alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
                }
                
                // Limpiar datos locales
                localStorage.clear();
                sessionStorage.clear();
                
                // Redirigir al login después de 2 segundos
                setTimeout(() => {
                    window.location.href = '/vistas/login.html';
                }, 2000);
                
                return response;
            }
            
            return response;
        } catch (error) {
            console.error('❌ Error en fetch:', error);
            throw error;
        }
    };
})();