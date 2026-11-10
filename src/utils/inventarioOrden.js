import { supabase } from '../supabaseClient';

// Componentes que el catálogo enlaza con el inventario: [{ id, nombre, unidad, cantidad }] por cada unidad vendida.
export const componentesDe = (producto) => (Array.isArray(producto?.componentes) ? producto.componentes : [])
  .filter(c => c && c.id != null && Number(c.cantidad) > 0);

export const componentesDelCatalogo = (itemCatalogo) => (Array.isArray(itemCatalogo?.componentes_inventario) ? itemCatalogo.componentes_inventario : [])
  .filter(c => c && c.id != null && Number(c.cantidad) > 0)
  .map(c => ({ id: c.id, nombre: c.nombre, unidad: c.unidad || '', cantidad: Number(c.cantidad), ...(c.activo ? { activo: true } : {}) }));

// Los materiales activos (rollos, lonas, tóner) no se descuentan ni se reservan por venta: solo se muestran como referencia.
export const componentesQueDescuentan = (producto) => componentesDe(producto).filter(c => !c.activo);

const redondear = (n) => Math.round(n * 1000) / 1000;

export const materialesDeComponentes = (componentes, cantidadVendida) => {
  const veces = Number(cantidadVendida) || 0;
  return componentes.map(c => ({ id: c.id, nombre: c.nombre, unidad: c.unidad || '', cant_usada: redondear(Number(c.cantidad) * veces) }));
};

export const esVentaCorta = (order) => {
  const tipo = String(order?.tipoOrden || order?.tipo_trabajo || order?.tipoLetrero || '').toUpperCase();
  return tipo.includes('(VC)') || tipo === 'VC' || tipo === 'VENTA CORTA';
};

// Al guardar la orden: los materiales del catálogo quedan prellenados (borrador de Producción) y, por eso, reservados.
// No se toca un producto que Producción ya empezó, ya terminó o cuyos materiales ya editó a mano.
export const conMaterialesReservados = (producto) => {
  const componentes = componentesQueDescuentan(producto);
  if (!componentes.length) return producto;
  if (['EN_PROCESO', 'FINALIZADO'].includes(producto.estado_prod) || producto.inventario_descontado) return producto;
  if (producto.materiales_borrador && !producto.materiales_auto) return producto;
  return { ...producto, materiales_borrador: materialesDeComponentes(componentes, producto.cantidad), sin_materiales_borrador: false, materiales_auto: true };
};

export const ESTADOS_QUE_RESERVAN = ['VENTAS', 'PRODUCCION'];

// { idInventario: cantidad } que las órdenes abiertas tienen apartada y todavía no se descontó.
export const reservadoPorMaterial = (orders, excluirId) => {
  const reservado = {};
  (orders || []).forEach(o => {
    if (!ESTADOS_QUE_RESERVAN.includes(o.status)) return;
    if (excluirId != null && String(o.id) === String(excluirId)) return;
    (o.productos || []).forEach(p => {
      if (!p || p.estado_prod === 'FINALIZADO' || p.inventario_descontado || p.sin_materiales_borrador) return;
      (p.materiales_borrador || []).forEach(m => {
        const cant = Number(m.cant_usada) || 0;
        if (m.id == null || cant <= 0) return;
        reservado[m.id] = redondear((reservado[m.id] || 0) + cant);
      });
    });
  });
  return reservado;
};

// Estado de stock de una línea: cada componente con lo que se necesita y lo disponible (stock − reservado).
export const stockDeLinea = (producto, stockPorId, reservado) => {
  const componentes = componentesDe(producto);
  return componentes.map(c => {
    const fila = stockPorId[c.id];
    if (c.activo) return { id: c.id, nombre: fila?.nombre || c.nombre, unidad: fila?.unidad || c.unidad || '', necesita: null, disponible: fila ? Number(fila.cantidad) || 0 : null, estado: 'activo' };
    const necesita = redondear(Number(c.cantidad) * (Number(producto.cantidad) || 0));
    const disponible = fila ? redondear((Number(fila.cantidad) || 0) - (reservado[c.id] || 0)) : null;
    const estado = disponible === null ? 'desconocido' : disponible <= 0 ? 'agotado' : disponible < necesita ? 'insuficiente' : 'ok';
    return { id: c.id, nombre: fila?.nombre || c.nombre, unidad: fila?.unidad || c.unidad || '', necesita, disponible, estado };
  });
};

// Venta Corta: al cerrar la venta se descuenta del inventario lo que lleva cada producto (nunca dos veces).
// No bloquea la venta: si no alcanza, el stock queda en negativo y se avisa para cuadrar el inventario.
export const descontarVentaCorta = async (order, usuario) => {
  const productos = [...(order.productos || [])];
  const ref = String(order.orderNumber || order.order_number || order.id).padStart(7, '0');
  const negativos = [];
  let descontados = 0;
  for (let i = 0; i < productos.length; i++) {
    const p = productos[i];
    if (!p || p.inventario_descontado || p.sin_materiales_borrador) continue;
    const materiales = (p.materiales_borrador || []).filter(m => m.id != null && Number(m.cant_usada) > 0);
    if (!materiales.length) continue;
    for (const m of materiales) {
      const { data: fila, error } = await supabase.from('inventario').select('cantidad, nombre').eq('id', m.id).single();
      if (error) throw error;
      const nueva = redondear((Number(fila?.cantidad) || 0) - Number(m.cant_usada));
      const { error: errUpd } = await supabase.from('inventario').update({ cantidad: nueva }).eq('id', m.id);
      if (errUpd) throw errUpd;
      await supabase.from('historial_inventario').insert([{
        material_id: m.id, material_nombre: fila?.nombre || m.nombre, cantidad_cambio: -Number(m.cant_usada), cantidad_resultante: nueva,
        tipo: 'EGRESO', motivo: `Venta Directa - Orden #${ref}`, usuario: usuario || 'Sistema'
      }]);
      if (nueva < 0) negativos.push(`${fila?.nombre || m.nombre} (${nueva})`);
    }
    productos[i] = { ...p, materiales: materiales, sin_materiales: false, materiales_borrador: undefined, sin_materiales_borrador: undefined, inventario_descontado: true };
    descontados++;
  }
  return { productos, descontados, negativos };
};
