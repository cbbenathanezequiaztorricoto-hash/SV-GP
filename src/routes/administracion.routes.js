// src/routes/administracion.routes.js
const express = require('express');
const router = express.Router();
const moduloAdministracion = require('../backend/administracion/moduloAdministracion');
const { verificarSesion } = require('../backend/common/authMiddleware')
const upload = require('../backend/common/upload');
// === MENÚ ===
router.get('/menu',                                 moduloAdministracion.obtenerMenu);
// Cambiar POST y PUT para que acepten archivos
router.post('/menu', verificarSesion, upload.single('imagen'), moduloAdministracion.crearPlato);
router.put('/menu/:idMenu', verificarSesion, upload.single('imagen'), moduloAdministracion.actualizarPlato);
router.delete('/menu/:idMenu', verificarSesion,     moduloAdministracion.eliminarPlato);

// === CATEGORÍAS ===
router.get('/categorias',                           moduloAdministracion.obtenerCategorias);

// === CIERRE DE CAJA ===
router.get('/resumen-dia',                          moduloAdministracion.obtenerResumenDia);
router.post('/cierre-caja',      verificarSesion,   moduloAdministracion.ejecutarCierreCaja);

// === USUARIOS / PERSONAL ===
router.get('/rrhh/catalogos',                                    moduloAdministracion.obtenerRolesYPuestos);
router.get('/usuarios',                                          moduloAdministracion.listarUsuarios);
router.get('/usuarios/:idEmpleado',                              moduloAdministracion.obtenerUsuario);
router.post('/usuarios',                        verificarSesion, moduloAdministracion.crearUsuario);
router.put('/usuarios/:idEmpleado',             verificarSesion, moduloAdministracion.actualizarUsuario);
router.delete('/usuarios/:idEmpleado',          verificarSesion, moduloAdministracion.eliminarUsuario);       // Baja lógica
router.delete('/usuarios/:idEmpleado/eliminar', verificarSesion, moduloAdministracion.eliminarUsuarioTotal);  // ✅ Borrado físico
// Agregar esta ruta (después de las otras rutas de usuarios)
router.patch('/usuarios/:idEmpleado/estado', verificarSesion, moduloAdministracion.cambiarEstadoUsuario);

// === MESAS ===
router.get('/mesas',                              moduloAdministracion.obtenerMesas);
router.post('/mesas',            verificarSesion, moduloAdministracion.crearMesa);
router.put('/mesas/:idMesa',     verificarSesion, moduloAdministracion.actualizarMesa);
router.delete('/mesas/:idMesa',  verificarSesion, moduloAdministracion.eliminarMesa);

// === TURNOS DE LIMPIEZA ===
router.get('/areas-limpieza',                               moduloAdministracion.obtenerAreasLimpieza);
router.get('/empleados-activos',                            moduloAdministracion.obtenerEmpleadosActivos);
router.get('/turnos-limpieza',                              moduloAdministracion.obtenerTurnosLimpieza);
router.post('/turnos-limpieza',  verificarSesion, moduloAdministracion.crearTurnoLimpieza);
router.put('/turnos-limpieza/:idTurno',    verificarSesion, moduloAdministracion.actualizarTurnoLimpieza);
router.delete('/turnos-limpieza/:idTurno', verificarSesion, moduloAdministracion.eliminarTurnoLimpieza);

// === ROLES ✅ CRUD completo ===
router.get('/roles',                              moduloAdministracion.obtenerRoles);
router.post('/roles',            verificarSesion, moduloAdministracion.crearRol);
router.put('/roles/:idRol',      verificarSesion, moduloAdministracion.actualizarRol);
router.delete('/roles/:idRol',   verificarSesion, moduloAdministracion.eliminarRol);

// === MÉTODOS DE PAGO ✅ CRUD completo ===
router.get('/metodos-pago',                               moduloAdministracion.obtenerMetodosPago);
router.post('/metodos-pago',             verificarSesion, moduloAdministracion.crearMetodoPago);
router.put('/metodos-pago/:idMetodo',    verificarSesion, moduloAdministracion.actualizarMetodoPago);
router.delete('/metodos-pago/:idMetodo', verificarSesion, moduloAdministracion.eliminarMetodoPago);

// === INGREDIENTES ===
router.get('/ingredientes',                                    moduloAdministracion.listarIngredientes);
router.post('/ingredientes',                  verificarSesion, moduloAdministracion.crearIngrediente);
router.put('/ingredientes/:idIngrediente',    verificarSesion, moduloAdministracion.actualizarIngrediente);
router.delete('/ingredientes/:idIngrediente', verificarSesion, moduloAdministracion.eliminarIngrediente);


// === CATEGORÍAS DE MENÚ — CRUD completo ===
router.post('/categorias',                    verificarSesion, moduloAdministracion.crearCategoria);
router.put('/categorias/:idCategoria',        verificarSesion, moduloAdministracion.actualizarCategoria);
router.delete('/categorias/:idCategoria',     verificarSesion, moduloAdministracion.eliminarCategoria);
 
// === CLIENTES — CRUD completo ===
router.get('/clientes',                                        moduloAdministracion.listarClientes);
router.post('/clientes',                      verificarSesion, moduloAdministracion.crearCliente);
// Obtener un cliente por ID
router.get('/clientes/:idCliente', moduloAdministracion.obtenerClientePorId);
router.put('/clientes/:idCliente',            verificarSesion, moduloAdministracion.actualizarCliente);
router.delete('/clientes/:idCliente',         verificarSesion, moduloAdministracion.eliminarCliente);
 
// === PUESTOS LABORALES — CRUD completo ===
router.get('/puestos',                                         moduloAdministracion.listarPuestos);
router.post('/puestos',                       verificarSesion, moduloAdministracion.crearPuesto);
router.put('/puestos/:idPuesto',              verificarSesion, moduloAdministracion.actualizarPuesto);
router.delete('/puestos/:idPuesto',           verificarSesion, moduloAdministracion.eliminarPuesto);
 
// === ÁREAS DE LIMPIEZA — CRUD completo ===
router.post('/areas-limpieza',                verificarSesion, moduloAdministracion.crearAreaLimpieza);
router.put('/areas-limpieza/:idArea',         verificarSesion, moduloAdministracion.actualizarAreaLimpieza);
router.delete('/areas-limpieza/:idArea',      verificarSesion, moduloAdministracion.eliminarAreaLimpieza);
 
// === FACTURAS — historial y anulación ===
router.get('/facturas',                                        moduloAdministracion.listarFacturas);
router.put('/facturas/:idFactura/anular',     verificarSesion, moduloAdministracion.anularFactura);
 
// === RECETAS — MenuIngrediente ===
router.get('/recetas/:idMenu',                                    moduloAdministracion.obtenerRecetasPlato);
router.get('/recetas/:idMenu/costo',                              moduloAdministracion.obtenerCostoPlato);
router.post('/recetas/:idMenu',                  verificarSesion, moduloAdministracion.agregarIngredienteReceta);
router.delete('/recetas/:idMenu/:idIngrediente', verificarSesion, moduloAdministracion.eliminarIngredienteReceta);
// === PERMISOS DE ROLES ===
router.get('/roles/:idRol/permisos',                  moduloAdministracion.obtenerPermisosRol);
router.put('/roles/:idRol/permisos', verificarSesion, moduloAdministracion.actualizarPermisosRol);
// === PROVEEDORES ===
router.get('/proveedores',                                       moduloAdministracion.listarProveedores);
router.post('/proveedores',                     verificarSesion, moduloAdministracion.crearProveedor);
router.put('/proveedores/:idProveedor',         verificarSesion, moduloAdministracion.actualizarProveedor);
router.delete('/proveedores/:idProveedor',      verificarSesion, moduloAdministracion.eliminarProveedor);

// === HISTORIAL DE PRECIOS DE INGREDIENTE ===
router.get('/ingredientes/:idIngrediente/historial-precios',     moduloAdministracion.obtenerHistorialPreciosIngrediente);
// Reportes avanzadoss
router.get('/reportes/ventas',                                   moduloAdministracion.obtenerReporteVentas);
router.get('/reportes/clientes',                                 moduloAdministracion.obtenerReporteClientes);
router.get('/reportes/productos',                                moduloAdministracion.obtenerReporteProductos);
router.get('/reportes/excel-avanzado',                           moduloAdministracion.descargarReporteExcelAvanzado);

module.exports = router;