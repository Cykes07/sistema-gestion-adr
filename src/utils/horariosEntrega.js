export const HORARIOS_ENTREGA = [];
for (let h = 8; h <= 18; h++) {
  const hora = String(h).padStart(2, '0');
  HORARIOS_ENTREGA.push(`${hora}:00`);
  if (h < 18) HORARIOS_ENTREGA.push(`${hora}:30`);
}

// Estados en los que la orden todavía carga trabajo al taller (los mismos del calendario).
export const ESTADOS_QUE_OCUPAN = ['VENTAS', 'PRODUCCION'];

const dosDigitos = (n) => String(n).padStart(2, '0');

export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

// Hora de una fecha de entrega llevada a su media hora. Sin hora o 00:00 (órdenes viejas) = 08:00.
export const franjaDe = (fechaEntrega) => {
  if (!fechaEntrega || !String(fechaEntrega).includes('T')) return '08:00';
  const [h, m] = String(fechaEntrega).split('T')[1].slice(0, 5).split(':').map(Number);
  if (!h && !m) return '08:00';
  return `${dosDigitos(h)}:${m < 30 ? '00' : '30'}`;
};

export const itemsDeProduccion = (orden) =>
  (orden.productos || []).filter(p => String(p?.descripcion || p?.nombre || '').trim() !== '').length;

// { 'HH:MM': [órdenes] } de las entregas pendientes de ese día, sin contar la orden que se está editando.
export const ocupacionDelDia = (orders, fecha, excluirId) => {
  const porFranja = {};
  if (!fecha) return porFranja;
  (orders || []).forEach(o => {
    if (!ESTADOS_QUE_OCUPAN.includes(o.status)) return;
    if (excluirId && String(o.id) === String(excluirId)) return;
    const f = o.fechaEntrega || o.fecha_entrega;
    if (!f || String(f).split('T')[0] !== fecha) return;
    const franja = franjaDe(f);
    (porFranja[franja] = porFranja[franja] || []).push(o);
  });
  return porFranja;
};

export const horaYaPaso = (fecha, hora, ahora = new Date()) => {
  if (!fecha) return false;
  const hoy = fechaLocal(ahora);
  if (fecha < hoy) return true;
  if (fecha > hoy) return false;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m < ahora.getHours() * 60 + ahora.getMinutes();
};

// Estado de cada horario del día: 'pasada' | 'ocupada' | 'libre'.
export const horariosDelDia = (orders, fecha, excluirId, ahora = new Date()) => {
  const ocupacion = ocupacionDelDia(orders, fecha, excluirId);
  return HORARIOS_ENTREGA.map(hora => {
    const ordenes = ocupacion[hora] || [];
    const estado = horaYaPaso(fecha, hora, ahora) ? 'pasada' : ordenes.length ? 'ocupada' : 'libre';
    return { hora, estado, ordenes, items: ordenes.reduce((s, o) => s + itemsDeProduccion(o), 0) };
  });
};

export const textoItems = (n) => `${n} ${n === 1 ? 'Ítem' : 'Ítems'} de Producción`;
