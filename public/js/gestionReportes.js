'use strict';
let reporteData = [];
// ============================================================
// MÓDULO REPORTES AVANZADOS
// ============================================================

async function cargarReportes() {
    await cargarSelectsReportes();
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);
    document.getElementById('reporte-desde').value = hace30.toISOString().split('T')[0];
    document.getElementById('reporte-hasta').value = hoy.toISOString().split('T')[0];
    await generarReporte();
}

async function cargarSelectsReportes() {
    try {
        // Clientes
        const resClientes = await fetch('/api/admin/clientes');
        const clientes = await resClientes.json();
        const selCliente = document.getElementById('reporte-cliente');
        if (selCliente) {
            selCliente.innerHTML = '<option value="">Todos los clientes</option>' +
                clientes.map(c => `<option value="${c.idCliente}">${c.primerNombre} ${c.primerApellido}</option>`).join('');
        }

        // Productos (menú)
        const resProductos = await fetch('/api/admin/menu');
        const productos = await resProductos.json();
        const selProducto = document.getElementById('reporte-producto');
        if (selProducto) {
            selProducto.innerHTML = '<option value="">Todos los productos</option>' +
                productos.map(p => `<option value="${p.idMenu}">${p.nombrePlato}</option>`).join('');
        }

        // Métodos de pago
        const resMetodos = await fetch('/api/admin/metodos-pago');
        const metodos = await resMetodos.json();
        const selMetodo = document.getElementById('reporte-metodo-pago');
        if (selMetodo) {
            selMetodo.innerHTML = '<option value="">Todos los métodos</option>' +
                metodos.map(m => `<option value="${m.idMetodoPago}">${m.nombreMetodo}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando selects reportes:', error);
    }
}

async function generarReporte() {
    const tbody = document.getElementById('tablaReportesCuerpo');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando...</td></tr>';

    const desde = document.getElementById('reporte-desde').value;
    const hasta = document.getElementById('reporte-hasta').value;
    const idCliente = document.getElementById('reporte-cliente').value;
    const idProducto = document.getElementById('reporte-producto').value;
    const idMetodoPago = document.getElementById('reporte-metodo-pago').value;

    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (idCliente) params.append('idCliente', idCliente);
    if (idProducto) params.append('idProducto', idProducto);
    if (idMetodoPago) params.append('idMetodoPago', idMetodoPago);

    try {
        const res = await fetch(`/api/admin/reportes/ventas?${params.toString()}`);
        if (!res.ok) throw new Error('Error servidor');
        const data = await res.json();
        reporteData = data;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No hay ventas para los filtros seleccionados.</td></tr>';
            document.getElementById('reporte-total-general').innerText = '0.00';
            return;
        }

        let totalGeneral = 0;
        tbody.innerHTML = data.map(row => {
            const total = parseFloat(row.montoTotal);
            totalGeneral += total;
            return `
            <tr>
                <td><strong>${row.nroFactura}</strong></td>
                <td>${new Date(row.fechaEmision).toLocaleString('es-BO')}</td>
                <td>${row.cliente || 'Sin cliente'}</td>
                <td>${row.ubicacion}</td>
                <td>${row.nombreMetodo}</td>
                <td>${row.empleado || '—'}</td>
                <td style="font-weight:bold;">${total.toFixed(2)} Bs.</td>
            </tr>`;
        }).join('');

        document.getElementById('reporte-total-general').innerText = totalGeneral.toFixed(2);
    } catch(error) {
        console.error('cargarReporteVentas:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red;text-align:center;">Error al cargar reporte.</td></tr>',error;
    }
}

async function descargarReporteExcelAvanzado() {
    const desde = document.getElementById('reporte-desde').value;
    const hasta = document.getElementById('reporte-hasta').value;
    const idCliente = document.getElementById('reporte-cliente').value;
    const idProducto = document.getElementById('reporte-producto').value;
    const idMetodoPago = document.getElementById('reporte-metodo-pago').value;

    const params = new URLSearchParams();
    if (desde) params.append('desde', desde);
    if (hasta) params.append('hasta', hasta);
    if (idCliente) params.append('idCliente', idCliente);
    if (idProducto) params.append('idProducto', idProducto);
    if (idMetodoPago) params.append('idMetodoPago', idMetodoPago);

    try {
        const res = await fetch(`/api/admin/reportes/excel-avanzado?${params.toString()}`);
        if (!res.ok) throw new Error('Error al generar Excel');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Ventas_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('descargarReporteExcelAvanzado:', error);
        alert('Error al descargar el reporte Excel.');
    }
}