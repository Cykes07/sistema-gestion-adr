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
  if (n.includes('EGRESO')) return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (n) return 'bg-green-100 text-green-800 border border-green-200';
  return 'text-slate-400';
};
