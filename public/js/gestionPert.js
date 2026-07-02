// public/js/gestionPert.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Si tu sistema usa una inicialización global diferida, puedes invocarla desde cambiarModulo
    inicializarModuloPert();
});

async function inicializarModuloPert() {
    await cargarPlatosPert();
}

// Carga los platos directo de la base de datos para no tener nada estático
async function cargarPlatosPert() {
    const selectPlatos = document.getElementById('pert-plato-select');
    if (!selectPlatos) return;

    try {
        const res = await fetch('/api/admin/menu');
        const platos = await res.json();
        
        selectPlatos.innerHTML = '<option value="">-- Seleccionar Plato del Menú Actual --</option>';
        platos.forEach(plato => {
            const opt = document.createElement('option');
            opt.value = plato.idMenu;
            opt.textContent = `${plato.nombrePlato} (Precio: ${plato.precioActual} Bs.)`;
            selectPlatos.appendChild(opt);
        });
    } catch (err) {
        console.error("Error cargando catálogo dinámico para PERT:", err);
    }
}

async function procesarAnalisisPert(event) {
    event.preventDefault();

    const cantidadPlatos = document.getElementById('pert-cantidad').value;
    const tiempoCompromisoMinutos = document.getElementById('pert-compromiso').value;

    if (!cantidadPlatos || !tiempoCompromisoMinutos) {
        Swal.fire('Atención', 'Por favor, ingrese el volumen de platos y el tiempo de entrega objetivo.', 'warning');
        return;
    }

    // Construcción dinámica de la matriz de tiempos estimativos de las 5 tareas
    const payload = {
        cantidadPlatos: cantidadPlatos,
        tiempoCompromisoMinutos: tiempoCompromisoMinutos,
        tareas: {
            A: {
                a: document.getElementById('time-aA').value,
                m: document.getElementById('time-mA').value,
                b: document.getElementById('time-bA').value
            },
            B: {
                a: document.getElementById('time-aB').value,
                m: document.getElementById('time-mB').value,
                b: document.getElementById('time-bB').value
            },
            C: {
                a: document.getElementById('time-aC').value,
                m: document.getElementById('time-mC').value,
                b: document.getElementById('time-bC').value
            },
            D: {
                a: document.getElementById('time-aD').value,
                m: document.getElementById('time-mD').value,
                b: document.getElementById('time-bD').value
            },
            E: {
                a: document.getElementById('time-aE').value,
                m: document.getElementById('time-mE').value,
                b: document.getElementById('time-bE').value
            }
        }
    };

    try {
        const response = await fetch('/api/admin/pert-cpm/calcular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json();

        if (resultado.exito) {
            renderizarReportePert(resultado.datos);
        } else {
            Swal.fire('Error Analítico', resultado.error || 'No se pudo procesar la matriz.', 'error');
        }
    } catch (error) {
        Swal.fire('Error de Red', 'Falla de conexión con el servidor de optimización.', 'error');
    }
}

function renderizarReportePert(datos) {
    const contenedorResultados = document.getElementById('pert-resultados-box');
    
    // Inyección dinámica de resultados aplicando clases nativas de tu CSS
    contenedorResultados.innerHTML = `
        <div style="border-left: 5px solid var(--success); padding-left: 15px; margin-top:15px;">
            <p><strong>📦 Volumen del Pedido Evaluado:</strong> ${datos.cantidadPlatos} platos analizados.</p>
            <p><strong>⏱️ Duración de Ruta Crítica (Media):</strong> ${datos.horas}h ${datos.minutosRestantes}m (${datos.tiempoTotalMinutos} min de forma secuencial).</p>
            <p><strong>🎯 Tiempo Máximo Institucional:</strong> ${datos.tiempoCompromisoMinutos} min.</p>
            <p><strong>📉 Desviación Estándar del Sistema (σ):</strong> ${datos.desviacionEstandar} min.</p>
        </div>
        
        <div class="cards-grid" style="grid-template-columns: 1fr 1fr; margin-top: 20px; gap: 15px;">
            <div class="card" style="background: rgba(56, 161, 105, 0.1); border: 1px solid var(--success); text-align: center; padding: 20px;">
                <h3 style="color: var(--success); font-size: 1.5rem;">${datos.probabilidadExito}%</h3>
                <small style="color: var(--text);">Probabilidad de Éxito (A Tiempo)</small>
            </div>
            <div class="card" style="background: rgba(229, 62, 62, 0.1); border: 1px solid var(--danger); text-align: center; padding: 20px;">
                <h3 style="color: var(--danger); font-size: 1.5rem;">${datos.porcentajeErrorRiesgo}%</h3>
                <small style="color: var(--text);">Riesgo de Retraso (Margen de Error)</small>
            </div>
        </div>

        <div style="margin-top:20px;">
            <h4>🛣️ Ruta Crítica Identificada (CPM):</h4>
            <p style="letter-spacing: 1px; font-weight: bold; color: var(--primary-light);">
                ${datos.rutaCritica.join(' ➔ ')}
            </p>
        </div>

        <div class="table-responsive" style="margin-top: 15px;">
            <table>
                <thead>
                    <tr>
                        <th>Actividad</th>
                        <th>Tiempo Esperado Calculado (Te)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>A. Compra de Ingredientes</td><td>${datos.tiemposEsperados.A} min</td></tr>
                    <tr><td>B. Preparar y Picar Alimentos</td><td>${datos.tiemposEsperados.B} min</td></tr>
                    <tr><td>C. Precalentar Horno</td><td>${datos.tiemposEsperados.C} min</td></tr>
                    <tr><td>D. Horneado Total</td><td>${datos.tiemposEsperados.D} min</td></tr>
                    <tr><td>E. Empaque y Entrega</td><td>${datos.tiemposEsperados.E} min</td></tr>
                </tbody>
            </table>
        </div>
    `;
    
    contenedorResultados.style.display = 'block';
    Swal.fire('Cálculo Exitoso', 'La simulación PERT-CPM fue procesada con éxito.', 'success');
}