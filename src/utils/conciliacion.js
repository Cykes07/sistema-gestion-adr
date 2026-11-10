// Reglas para conciliar con el contador: ventas con/sin factura y retenciones de un rango de fechas.

const dosDigitos = (n) => String(n).padStart(2, '0');
export const diaLocal = (d) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

export const rangoDelMes = (fecha = new Date()) => ({
  desde: diaLocal(new Date(fecha.getFullYear(), fecha.getMonth(), 1)),
  hasta: diaLocal(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)),
});

export const fechaDeOrden = (o) => {
  const f = o?.created_at || o?.createdAt;
  if (!f) return '';
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? String(f).slice(0, 10) : diaLocal(d);
};

export const enRango = (o, { desde, hasta }) => {
  const f = fechaDeOrden(o);
  return !!f && (!desde || f >= desde) && (!hasta || f <= hasta);
};

// Cuentan las órdenes válidas: activas, finalizadas o archivadas. No las anuladas ni los borradores.
export const ordenValida = (o) => !['ANULADA', 'BORRADOR'].includes(o?.status);

const fin = (o) => {
  if (!o?.financials) return {};
  if (typeof o.financials === 'string') { try { return JSON.parse(o.financials); } catch { return {}; } }
  return o.financials;
};

const num = (v) => Number(v) || 0;

export const conFactura = (o) => num(fin(o).iva) > 0;
export const retencionDe = (o) => num(o?.retencion) || num(fin(o).retencion);
export const porcentajeRetencionDe = (o) => {
  const p = num(fin(o).retentionPercent) || num(o?.retentionPercent);
  if (p > 0) return p;
  const base = baseImponibleDe(o);
  return base > 0 && retencionDe(o) > 0 ? Math.round((retencionDe(o) / base) * 10000) / 100 : 0;
};
export const baseImponibleDe = (o) => {
  const f = fin(o);
  return num(f.baseImponible) || num(f.subtotal) || Math.max(num(f.total) - num(f.iva), 0);
};
export const ivaDe = (o) => num(fin(o).iva);
export const totalFacturaDe = (o) => num(fin(o).total);
export const nroFacturaDe = (o) => o?.nro_factura || fin(o).nroFactura || o?.nroFactura || '';
export const numeroOrden = (o) => String(o?.orderNumber || o?.order_number || o?.id || '').padStart(7, '0');

export const sumar = (lista, fn) => Math.round(lista.reduce((s, o) => s + fn(o), 0) * 100) / 100;

export const resumenFacturacion = (orders) => ({
  cantidad: orders.length,
  base: sumar(orders, baseImponibleDe),
  iva: sumar(orders, ivaDe),
  total: sumar(orders, totalFacturaDe),
  retenciones: sumar(orders, retencionDe),
});
