import { empresaActual } from '@/utils/empresa';

// Estados en los que la orden todavía carga trabajo al taller (los mismos del calendario).
export const ESTADOS_QUE_OCUPAN = ['VENTAS', 'PRODUCCION'];

const dosDigitos = (n) => String(n).padStart(2, '0');
const aMinutos = (hora) => { const [h, m] = String(hora).split(':').map(Number); return h * 60 + m; };
const aHora = (minutos) => `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;

export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;

// Horario de entregas de la empresa (Configuración de la Empresa).
export const horarioConfigurado = (empresa = empresaActual()) => ({
  inicio: empresa.horaInicioEntrega,
  fin: empresa.horaFinEntrega,
  intervalo: Number(empresa.intervaloEntrega),
});

export const listaDeHorarios = (horario = horarioConfigurado()) => {
  const lista = [];
  for (let m = aMinutos(horario.inicio); m <= aMinutos(horario.fin); m += horario.intervalo) lista.push(aHora(m));
  return lista;
};

// Hora de una fecha de entrega llevada al inicio de su franja. Sin hora o 00:00 (órdenes viejas) = hora de apertura.
export const franjaDe = (fechaEntrega, horario = horarioConfigurado()) => {
  if (!fechaEntrega || !String(fechaEntrega).includes('T')) return horario.inicio;
  const minutos = aMinutos(String(fechaEntrega).split('T')[1].slice(0, 5));
  const inicio = aMinutos(horario.inicio);
  if (!minutos || minutos < inicio) return horario.inicio;
  return aHora(inicio + Math.floor((minutos - inicio) / horario.intervalo) * horario.intervalo);
};

const productosReales = (orden) => (orden.productos || []).filter(p => String(p?.descripcion || p?.nombre || '').trim() !== '');

export const itemsDeProduccion = (orden) => productosReales(orden).length;

// Una orden deja de ocupar su horario en cuanto sale de producción (Por Retirar o más adelante), o cuando Producción ya
// terminó todos sus productos aunque todavía no la hayan pasado de paso.
export const ocupaHorario = (orden) => {
  if (!ESTADOS_QUE_OCUPAN.includes(orden?.status)) return false;
  if (orden.status !== 'PRODUCCION') return true;
  const productos = productosReales(orden);
  return !productos.length || productos.some(p => p.estado_prod !== 'FINALIZADO');
};

// { 'HH:MM': [órdenes] } de las entregas pendientes de ese día, sin contar la orden que se está editando.
export const ocupacionDelDia = (orders, fecha, excluirId, horario = horarioConfigurado()) => {
  const porFranja = {};
  if (!fecha) return porFranja;
  (orders || []).forEach(o => {
    if (!ocupaHorario(o)) return;
    if (excluirId && String(o.id) === String(excluirId)) return;
    const f = o.fechaEntrega || o.fecha_entrega;
    if (!f || String(f).split('T')[0] !== fecha) return;
    const franja = franjaDe(f, horario);
    (porFranja[franja] = porFranja[franja] || []).push(o);
  });
  return porFranja;
};

export const horaYaPaso = (fecha, hora, ahora = new Date()) => {
  if (!fecha) return false;
  const hoy = fechaLocal(ahora);
  if (fecha < hoy) return true;
  if (fecha > hoy) return false;
  return aMinutos(hora) < ahora.getHours() * 60 + ahora.getMinutes();
};

// Estado de cada horario del día: 'pasada' | 'ocupada' | 'libre'.
export const horariosDelDia = (orders, fecha, excluirId, ahora = new Date(), horario = horarioConfigurado()) => {
  const ocupacion = ocupacionDelDia(orders, fecha, excluirId, horario);
  return listaDeHorarios(horario).map(hora => {
    const ordenes = ocupacion[hora] || [];
    const estado = horaYaPaso(fecha, hora, ahora) ? 'pasada' : ordenes.length ? 'ocupada' : 'libre';
    return { hora, estado, ordenes, items: ordenes.reduce((s, o) => s + itemsDeProduccion(o), 0) };
  });
};

export const textoItems = (n) => `${n} ${n === 1 ? 'Ítem' : 'Ítems'} de Producción`;
