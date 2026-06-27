// ==========================================
// ESTRUCTURA DE DATOS: COLA (QUEUE) - FIFO
// ==========================================
class ColaPedidos {
    constructor() {
        this.items = []; // Array que actuará como nuestra cola en memoria
    }

    // 1. ENQUEUE: Insertar un nuevo pedido al final de la cola
    enqueue(pedido) {
        this.items.push(pedido);
    }

    // 2. DEQUEUE: Sacar y despachar el pedido más antiguo (el primero)
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        const pedidoDespachado = this.items.shift();
        return pedidoDespachado;
    }

    // 3. REMOVE: Eliminar un pedido específico de la cola por idPedido
    remove(idPedido) {
        const index = this.items.findIndex(p => p.idPedido === parseInt(idPedido, 10));
        if (index === -1) return null;
        const pedidoEliminado = this.items.splice(index, 1)[0];
        return pedidoEliminado;
    }

    // 4. PEEK: Ver el siguiente pedido a preparar sin sacarlo de la cola
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0];
    }

    // 4. ISEMPTY: Verificar si la cocina está libre
    isEmpty() {
        return this.items.length === 0;
    }

    // Método extra para enviar toda la cola al frontend (monitor del cocinero)
    obtenerCola() {
        return this.items;
    }
}

// Exportamos la clase para usarla en nuestro servidor
module.exports = ColaPedidos;