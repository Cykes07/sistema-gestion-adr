export const precioSegunCatalogo = (qty, item, mayorista = false) => {
    if (mayorista) {
        const tiersDist = [...(item.precios_distribuidor || [])].sort((a, b) => b.cantidad - a.cantidad);
        const tierDist = tiersDist.find(t => qty >= t.cantidad);
        if (tierDist && Number(tierDist.precio) > 0) return Number(tierDist.precio);

        const baseDist = Number(item.precioDistribuidorBase || item.precio_distribuidor || 0);
        if (baseDist > 0) return baseDist;
    }
    const tiersNorm = [...(item.precios_escalonados || [])].sort((a, b) => b.cantidad - a.cantidad);
    const tierNorm = tiersNorm.find(t => qty >= t.cantidad);
    if (tierNorm && Number(tierNorm.precio) > 0) return Number(tierNorm.precio);
    return Number(item.precioBaseOriginal || item.precio || 0);
};

export const redondearAMedio = (num) => Math.ceil(num * 2) / 2;

const RE_MEDIDA = /\(\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*cm\s*\)/gi;
export const quitarMedidaDelTexto = (texto) => String(texto || '').replace(RE_MEDIDA, '').replace(/[ \t]{2,}/g, ' ').trim();

const numeroCorto = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export const medidaDelProducto = (item) => {
    if (!item?.es_por_metro) return null;
    const ancho = parseFloat(item.base);
    const alto = parseFloat(item.altura);
    if (!(ancho > 0) || !(alto > 0)) return null;
    return { ancho, alto, area: (ancho / 100) * (alto / 100), texto: `${numeroCorto(ancho)} × ${numeroCorto(alto)} cm` };
};

// Lo que costaría el producto con la tarifa de catálogo (misma fórmula que el formulario de la orden).
// null si no viene del catálogo (ítem manual) o le faltan datos.
export const referenciaCatalogo = (item, mayorista = false) => {
    if (!item || item.precioBaseOriginal === undefined) return null;
    const tieneTarifa = Number(item.precioBaseOriginal) > 0 || (item.precios_escalonados || []).length > 0
        || (mayorista && (Number(item.precioDistribuidorBase) > 0 || (item.precios_distribuidor || []).length > 0));
    if (!tieneTarifa) return null;
    const cantidad = parseFloat(item.cantidad) || 0;
    if (cantidad <= 0) return null;

    if (item.es_por_metro) {
        const medida = medidaDelProducto(item);
        if (!medida) return null;
        const unidad = precioSegunCatalogo(parseFloat((medida.area * cantidad).toFixed(2)), item, mayorista);
        const minimoCatalogo = Number(item.precio_minimo) > 0 ? Number(item.precio_minimo) : precioSegunCatalogo(1, item, mayorista);
        const minimo = item.precioMinimoManual !== undefined && item.precioMinimoManual !== '' ? parseFloat(item.precioMinimoManual) : minimoCatalogo;
        const porPieza = Math.max(medida.area * unidad, minimo || 0);
        const total = porPieza * cantidad;
        return { unidad, total: total > 0 ? redondearAMedio(total) : 0 };
    }
    const unidad = precioSegunCatalogo(cantidad, item, mayorista);
    return { unidad, total: Number((cantidad * unidad).toFixed(2)) };
};

// Escala por volumen (m² de área total o unidades) y la fila que aplica; null si el producto no tiene escala.
export const tarifasPorVolumen = (item, mayorista = false) => {
    if (!item) return null;
    const porMetro = !!item.es_por_metro;
    const baseDistribuidor = Number(item.precioDistribuidorBase || item.precio_distribuidor || 0);
    const usaDistribuidor = mayorista && ((item.precios_distribuidor || []).some(t => Number(t.precio) > 0) || baseDistribuidor > 0);
    const escalones = (usaDistribuidor ? item.precios_distribuidor : item.precios_escalonados) || [];
    const filas = escalones
        .map(t => ({ desde: Number(t.cantidad) || 0, precio: Number(t.precio) || 0 }))
        .filter(t => t.precio > 0)
        .sort((a, b) => a.desde - b.desde);
    if (filas.length === 0) return null;

    const base = (usaDistribuidor && baseDistribuidor > 0) ? baseDistribuidor : Number(item.precioBaseOriginal || 0);
    const desdeBase = porMetro ? 0 : 1;
    if (base > 0 && filas[0].desde > desdeBase) filas.unshift({ desde: desdeBase, precio: base });

    const cantidad = parseFloat(item.cantidad) || 0;
    const medida = porMetro ? medidaDelProducto(item) : null;
    const evaluado = porMetro ? (medida ? parseFloat((medida.area * cantidad).toFixed(2)) : 0) : cantidad;
    let activo = -1;
    filas.forEach((f, i) => { if (evaluado >= f.desde) activo = i; });
    return { porMetro, mayorista: usaDistribuidor, filas, activo, evaluado };
};
