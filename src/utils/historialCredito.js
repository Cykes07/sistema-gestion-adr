// 🔧 Historial del crédito de una orden (23-oct, pedido del cliente: "que quede registro de que fue a crédito, hasta qué
// fecha, si cumplió o pasó a Impagas"). No se guarda nada nuevo: se reconstruye con lo que la orden ya guarda y nunca
// se borra: la fecha de vencimiento (financials.creditoVenceSaldo / credito_vence_anticipo), las prórrogas
// (financials.historialFechasCredito, las anota OrderForm) y los abonos con su fecha (botón "Cobrar").
// "Impagas" sigue la misma regla que WorkAreaList: el día del vencimiento todavía es crédito; desde el día siguiente, impaga.
import { esVentaACredito } from './comisiones';

const pad = (n) => String(n).padStart(2, '0');
const aDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Fecha local 'AAAA-MM-DD' de un texto de fecha (las fechas sin hora se toman tal cual, sin correr un día por la zona horaria)
export const diaLocal = (v) => {
    if (!v) return '';
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : aDia(d);
};
const sumarDias = (dia, n) => { const [y, m, d] = dia.split('-').map(Number); return aDia(new Date(y, m - 1, d + n)); };
const diasEntre = (desde, hasta) => {
    const [y1, m1, d1] = desde.split('-').map(Number), [y2, m2, d2] = hasta.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};
export const fechaCorta = (dia) => { if (!dia) return '-'; const [y, m, d] = dia.split('-'); return `${d}/${m}/${y}`; };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const dinero = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Devuelve null si la orden no fue a crédito. Si fue: { eventos, estado, vence, aproximada }.
// eventos: [{ fecha 'AAAA-MM-DD', tipo, titulo, detalle }] en orden; estado: { tipo, texto }.
export const historialDelCredito = (order, hoy = aDia(new Date())) => {
    if (!order || !esVentaACredito(order) || order.status === 'ANULADA') return null;
    let fin = order.financials || {};
    if (typeof fin === 'string') { try { fin = JSON.parse(fin); } catch (e) { fin = {}; } }

    const total = Number(fin.total) || 0;
    const anticipo = Number(order.anticipo) || 0;
    const retencion = Number(order.retencion || fin.retencion) || 0;
    const montoCredito = Math.max(total - anticipo - retencion, 0);
    const creada = diaLocal(order.created_at || order.createdAt) || hoy;
    const venceActual = diaLocal(fin.creditoVenceSaldo || order.creditoVenceSaldo || order.credito_vence_saldo
        || order.creditoVenceAnticipo || order.credito_vence_anticipo || fin.creditoVenceAnticipo);

    const prorrogas = (Array.isArray(fin.historialFechasCredito) ? fin.historialFechasCredito : [])
        .map(h => ({ de: diaLocal(h.fechaAnterior), a: diaLocal(h.nuevaFecha), cuando: diaLocal(h.fechaModificacion), por: h.modificadoPor || '' }))
        .filter(h => h.a && h.cuando)
        .sort((x, y) => x.cuando.localeCompare(y.cuando));
    const venceOriginal = (prorrogas[0] && prorrogas[0].de) || venceActual;

    const eventos = [];
    eventos.push({
        fecha: creada, tipo: 'inicio', orden: 0,
        titulo: `Venta a crédito, saldo de ${dinero(montoCredito)}`,
        detalle: venceOriginal ? `Fecha de vencimiento: ${fechaCorta(venceOriginal)}` : 'Sin fecha de vencimiento registrada',
    });

    // Cobros, en orden de fecha, con lo que quedaba pendiente después de cada uno
    const abonos = (Array.isArray(order.abonos) ? order.abonos : [])
        .map(a => ({ dia: diaLocal(a.fecha), monto: Number(a.monto) || 0, metodo: String(a.metodoPago || a.metodo_pago || '').split(' - Ref:')[0].trim(), cobrador: a.cobrador || '' }))
        .filter(a => a.dia)
        .sort((x, y) => x.dia.localeCompare(y.dia));
    let pendiente = montoCredito;
    let pagado = '';
    abonos.forEach(a => {
        pendiente -= a.monto;
        const quien = [a.metodo, a.cobrador && `cobró ${a.cobrador}`].filter(Boolean).join(', ');
        if (!pagado && pendiente <= 0.01) {
            pagado = a.dia;
            eventos.push({ fecha: a.dia, tipo: 'pagado', orden: 3, titulo: `Crédito pagado completo (último pago ${dinero(a.monto)})`, detalle: quien });
        } else if (!pagado) {
            eventos.push({ fecha: a.dia, tipo: 'abono', orden: 3, titulo: a.monto < 0 ? `Devolución de ${dinero(-a.monto)}` : `Abono de ${dinero(a.monto)}`, detalle: [quien, `quedaban ${dinero(Math.max(pendiente, 0))}`].filter(Boolean).join(' · ') });
        }
    });
    // Saldo en cero sin un cobro que lo explique (se cerró editando la orden): fecha aproximada
    let aproximada = false;
    if (!pagado && montoCredito > 0.01 && Number(fin.saldo) <= 0.01 && pendiente > 0.01 && ['FINALIZADA', 'ARCHIVADA', 'VERIFICACIÓN'].includes(order.status)) {
        pagado = diaLocal(order.fecha_pago_saldo || order.updated_at || order.updatedAt) || hoy;
        aproximada = true;
        eventos.push({ fecha: pagado, tipo: 'pagado', orden: 3, titulo: 'Crédito pagado completo', detalle: 'Fecha aproximada (última modificación de la orden)' });
    }
    if (!pagado && montoCredito <= 0.01) pagado = creada;

    // Tramos de vencimiento: el original y cada prórroga. Si un tramo vence sin pago, la orden pasa a Impagas al día siguiente.
    const tramos = [{ desde: creada, vence: venceOriginal }, ...prorrogas.map(h => ({ desde: h.cuando, vence: h.a, prorroga: h }))];
    const limite = pagado || hoy;
    tramos.forEach((tr, i) => {
        if (tr.prorroga) {
            const h = tr.prorroga;
            const estabaImpaga = h.de && h.de < h.cuando && (!pagado || pagado > h.de);
            eventos.push({ fecha: h.cuando, tipo: 'prorroga', orden: 1,
                titulo: `Prórroga: vencimiento cambiado${h.de ? ` del ${fechaCorta(h.de)}` : ''} al ${fechaCorta(h.a)}`,
                detalle: [h.por && `Por ${h.por}`, estabaImpaga && 'Salió de Impagas y volvió a Créditos'].filter(Boolean).join(' · ') || null });
        }
        if (!tr.vence || (pagado && pagado <= tr.desde)) return;
        const finTramo = i + 1 < tramos.length ? (tramos[i + 1].desde < limite ? tramos[i + 1].desde : limite) : limite;
        if (tr.vence < finTramo) {
            eventos.push({ fecha: sumarDias(tr.vence, 1), tipo: 'impaga', orden: 2, titulo: 'Venció sin pagar: pasó a Impagas', detalle: `Vencía el ${fechaCorta(tr.vence)}` });
        }
    });

    eventos.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.orden - y.orden);

    // Estado final
    let estado;
    if (pagado) {
        const atraso = venceActual ? diasEntre(venceActual, pagado) : 0;
        estado = atraso > 0
            ? { tipo: 'pagado_tarde', texto: `Pagado ${plural(atraso, 'día', 'días')} después del vencimiento` }
            : { tipo: 'pagado_a_tiempo', texto: 'Pagado a tiempo' };
    } else if (venceActual && hoy > venceActual) {
        estado = { tipo: 'impaga', texto: `Impaga: ${plural(diasEntre(venceActual, hoy), 'día', 'días')} de atraso` };
    } else if (venceActual) {
        const faltan = diasEntre(hoy, venceActual);
        estado = { tipo: 'vigente', texto: faltan === 0 ? 'Crédito vigente: vence hoy' : `Crédito vigente: vence en ${plural(faltan, 'día', 'días')}` };
    } else {
        estado = { tipo: 'vigente', texto: 'Crédito sin fecha de vencimiento' };
    }

    return { eventos, estado, vence: venceActual, aproximada };
};
