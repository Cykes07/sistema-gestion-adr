// Hora y estilo de los movimientos de caja de un día (Libro Diario General y Reporte Diario del vendedor).

export const diaLocalDe = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Un momento solo sirve como hora del movimiento si cae el mismo día que se está mirando.
export const momentoDelDia = (v, dia) => (v && diaLocalDe(v) === dia ? new Date(v).toISOString() : null);

// Abonos: la fecha la elige el vendedor (hora fija 12:00), pero el `id` es Date.now() del momento en que se registró en
// AbonosModal: esa es la hora real, si el abono se registró el mismo día de su fecha.
export const momentoDelAbono = (abono) => {
  const id = Number(abono?.id);
  if (!Number.isFinite(id) || id < 1577836800000 || id > Date.now() + 86400000) return null;
  return momentoDelDia(id, diaLocalDe(abono.fecha));
};

// Quién tiene el dinero de una orden: el último que cobró (anticipo, abonos, saldo); si no hay registro, el vendedor.
export const quienCobroLaOrden = (orden, abonos = orden?.abonos) => {
  const pagos = [];
  if (Number(orden?.anticipo) > 0 && (orden.recibido_por_anticipo || orden.recibido_por_anticipo_id)) pagos.push({ nombre: orden.recibido_por_anticipo, id: orden.recibido_por_anticipo_id });
  (abonos || []).forEach(a => { if (Number(a?.monto) > 0 && (a.cobrador || a.cobrador_id)) pagos.push({ nombre: a.cobrador, id: a.cobrador_id }); });
  if (orden?.recibido_por_saldo || orden?.recibido_por_saldo_id) pagos.push({ nombre: orden.recibido_por_saldo, id: orden.recibido_por_saldo_id });
  if (pagos.length) return pagos[pagos.length - 1];
  const idVendedor = Array.isArray(orden?.vendedor_ids) ? orden.vendedor_ids[0] : null;
  return orden?.vendedor || idVendedor ? { nombre: orden?.vendedor, id: idVendedor } : null;
};

// De qué caja sale/entra un abono. Las devoluciones automáticas viejas quedaban a nombre de quien editó la orden (a veces el
// Admin) y no salían en la caja de quien devolvió el dinero; esas se cuentan en la caja de quien cobró la orden.
// Las nuevas ya nacen con esa persona (caja_confirmada) y si se reasignan se respeta lo elegido.
export const responsableDeAbono = (orden, abono) => {
  const devolucionVieja = Number(abono?.monto) < 0 && !abono?.caja_confirmada && /devoluci/i.test(String(abono?.nota || ''));
  if (devolucionVieja) {
    const quien = quienCobroLaOrden(orden);
    if (quien) return quien;
  }
  return { nombre: abono?.cobrador, id: abono?.cobrador_id };
};

export const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

// Primero los que tienen hora (de la más temprana a la más tarde); los sin hora al final, en el orden en que llegaron.
export const ordenarPorMomento = (lista) => lista
  .map((tx, i) => ({ tx, i }))
  .sort((a, b) => (a.tx.momento && b.tx.momento ? a.tx.momento.localeCompare(b.tx.momento) : a.tx.momento ? -1 : b.tx.momento ? 1 : 0) || a.i - b.i)
  .map(({ tx }) => tx);

const esEfectivo = (metodo) => String(metodo || 'efectivo').toLowerCase().includes('efectivo');

export const claseMetodo = (metodo) => (esEfectivo(metodo)
  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : 'bg-purple-50 text-purple-700 border border-purple-200');

export const claseNota = (nota) => {
  const n = String(nota || '').toUpperCase();
  if (n.includes('ANULADO') || n.includes('DEBE')) return 'bg-red-50 text-red-700 border border-red-200';
  if (n.includes('PDTE') || n.includes('CRÉDITO') || n.includes('CREDITO')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (n.includes('ABONO')) return 'bg-emerald-50/60 text-emerald-600 border border-emerald-100';
  if (n.includes('DEVOLUCI')) return 'bg-red-50 text-red-700 border border-red-200';
  if (n.includes('EGRESO')) return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (n) return 'bg-green-100 text-green-800 border border-green-200';
  return 'text-slate-400';
};
