import { retencionDe } from './conciliacion';

// Valor de una orden para comisiones y metas = Total a Pagar: Total Factura (ya con descuento e IVA) menos la retención,
// porque la retención no llega a caja (decisión del cliente, 22-nov). Antes se usaba el Total Factura.
export const montoComision = (o) => {
    let fin = o?.financials;
    if (typeof fin === 'string') { try { fin = JSON.parse(fin); } catch (e) { fin = {}; } }
    const total = parseFloat(fin?.total || 0) || 0;
    return Math.max(0, Math.round((total - retencionDe(o)) * 100) / 100);
};

export const esVentaACredito = (o) => {
    const esCredito = (v) => { const t = String(v || '').toLowerCase(); return t.includes('crédit') || t.includes('credit'); };
    const tieneFecha = (v) => String(v || '').trim() !== '';
    let fin = o?.financials;
    if (typeof fin === 'string') { try { fin = JSON.parse(fin); } catch (e) { fin = {}; } }
    return esCredito(o?.formaPagoAnticipo || o?.forma_pago_anticipo) || esCredito(o?.formaPagoSaldo || fin?.formaPagoSaldo)
        || tieneFecha(o?.creditoVenceAnticipo || o?.credito_vence_anticipo) || tieneFecha(o?.creditoVenceSaldo || fin?.creditoVenceSaldo);
};

// Regla normal: creada dentro del rango Y cerrada dentro del rango + margen de días.
export const finalizadaPropiaEnRango = (o, dateRange, margenDias) => {
    const fechaCreacion = o.created_at || o.createdAt;
    if (dateRange.start && new Date(fechaCreacion) < new Date(dateRange.start + 'T00:00:00')) return false;
    if (dateRange.end && new Date(fechaCreacion) > new Date(dateRange.end + 'T23:59:59')) return false;
    if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') return false;
    const fechaFinal = o.fecha_pago_saldo || o.updated_at || o.updatedAt;
    if (!fechaFinal) return false;
    if (dateRange.start && new Date(fechaFinal) < new Date(dateRange.start + 'T00:00:00')) return false;
    if (dateRange.end) {
        const limite = new Date(dateRange.end + 'T23:59:59');
        limite.setDate(limite.getDate() + margenDias);
        if (new Date(fechaFinal) > limite) return false;
    }
    return true;
};

export const ventanaCicloExtraCredito = (dateRange, margenDias) => {
    if (!dateRange?.start) return null;
    const inicio = new Date(dateRange.start + 'T00:00:00');
    if (isNaN(inicio.getTime())) return null;
    const conMargen = (d) => { const r = new Date(d); r.setDate(r.getDate() + margenDias); return r; };
    const creadasDesde = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1, 0, 0, 0);
    const creadasHasta = new Date(inicio.getFullYear(), inicio.getMonth(), 0, 23, 59, 59);
    let cobradasHasta = conMargen(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59));
    if (dateRange.end) {
        const limiteRango = conMargen(new Date(dateRange.end + 'T23:59:59'));
        if (limiteRango < cobradasHasta) cobradasHasta = limiteRango;
    }
    return { creadasDesde, creadasHasta, cobradasDespues: conMargen(creadasHasta), cobradasHasta };
};

export const creditoDelMesAnteriorEnRango = (o, dateRange, margenDias) => {
    const v = ventanaCicloExtraCredito(dateRange, margenDias);
    if (!v) return false;
    if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') return false;
    if (!esVentaACredito(o)) return false;
    const creada = new Date(o.created_at || o.createdAt);
    if (isNaN(creada.getTime()) || creada < v.creadasDesde || creada > v.creadasHasta) return false;
    const fechaFinal = o.fecha_pago_saldo || o.updated_at || o.updatedAt;
    if (!fechaFinal) return false;
    const cerrada = new Date(fechaFinal);
    if (isNaN(cerrada.getTime())) return false;
    return cerrada > v.cobradasDespues && cerrada <= v.cobradasHasta;
};

export const creditoDelMesAnteriorPendiente = (o, dateRange, margenDias, ahora = new Date()) => {
    const v = ventanaCicloExtraCredito(dateRange, margenDias);
    if (!v || ahora > v.cobradasHasta) return false;
    if (['FINALIZADA', 'ARCHIVADA', 'ANULADA'].includes(o.status)) return false;
    if (!esVentaACredito(o)) return false;
    const creada = new Date(o.created_at || o.createdAt);
    return !isNaN(creada.getTime()) && creada >= v.creadasDesde && creada <= v.creadasHasta;
};
// ===== FIN REGLAS DE COMISIÓN =====

// Rango de un mes completo ('YYYY-MM-DD'), igual que lo arma la pantalla de Estadísticas.
export const rangoDelMes = (fechaBase) => {
    const anio = fechaBase.getFullYear();
    const mes = fechaBase.getMonth();
    const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: f(new Date(anio, mes, 1)), end: f(new Date(anio, mes + 1, 0)) };
};

export const resumenVentasMes = (orders, dateRange, margenDias, pertenece = () => true, ahora = new Date()) => {
    const monto = montoComision;
    let totalSales = 0, propias = 0, carrySales = 0, carryCount = 0, carryPendiente = 0, carryPendienteCount = 0;
    (orders || []).forEach(o => {
        if (!pertenece(o)) return;
        const fechaCreacion = o.created_at || o.createdAt;
        const antes = dateRange.start && new Date(fechaCreacion) < new Date(dateRange.start + 'T00:00:00');
        const despues = dateRange.end && new Date(fechaCreacion) > new Date(dateRange.end + 'T23:59:59');
        if (!antes && !despues) totalSales += monto(o);
        if (finalizadaPropiaEnRango(o, dateRange, margenDias)) propias += monto(o);
        else if (creditoDelMesAnteriorEnRango(o, dateRange, margenDias)) { carrySales += monto(o); carryCount += 1; }
        else if (creditoDelMesAnteriorPendiente(o, dateRange, margenDias, ahora)) { carryPendiente += monto(o); carryPendienteCount += 1; }
    });
    const porcentaje = totalSales > 0 ? (propias / totalSales) * 100 : 0;
    const metaCiclo = totalSales + carrySales + carryPendiente;
    const cobradoCiclo = propias + carrySales;
    const ventana = ventanaCicloExtraCredito(dateRange, margenDias);
    return {
        totalSales, propias, carrySales, carryCount, porcentaje, falta: Math.max(0, totalSales - propias),
        carryPendiente, carryPendienteCount, metaCiclo, cobradoCiclo,
        porcentajeCiclo: metaCiclo > 0 ? (cobradoCiclo / metaCiclo) * 100 : 0,
        faltaCiclo: Math.max(0, metaCiclo - cobradoCiclo),
        limiteCreditosAnteriores: ventana ? ventana.cobradasHasta : null,
    };
};
