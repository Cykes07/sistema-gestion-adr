import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { componentesDe, reservadoPorMaterial, stockDeLinea } from '@/utils/inventarioOrden';

// Stock actual (de la base) de los materiales que usan los productos de la lista, y lo que otras órdenes ya reservaron.
export const useStockDeProductos = (productos, orders, excluirId) => {
  const ids = useMemo(() => {
    const set = new Set();
    (productos || []).forEach(p => componentesDe(p).forEach(c => set.add(c.id)));
    return [...set].sort((a, b) => String(a).localeCompare(String(b)));
  }, [productos]);
  const clave = ids.join(',');
  const [stockPorId, setStockPorId] = useState({});

  useEffect(() => {
    if (!ids.length) return;
    let vigente = true;
    supabase.from('inventario').select('id, nombre, cantidad, unidad').in('id', ids).then(({ data }) => {
      if (!vigente || !data) return;
      const encontrados = Object.fromEntries(data.map(f => [f.id, f]));
      setStockPorId(prev => ({ ...prev, ...Object.fromEntries(ids.map(id => [id, encontrados[id] || false])) }));
    });
    return () => { vigente = false; };
  }, [clave]);

  const reservado = useMemo(() => reservadoPorMaterial(orders, excluirId), [orders, excluirId]);
  return { stockPorId, reservado, hayEnlazados: ids.length > 0 };
};

const ESTILO = {
  ok: { icono: CheckCircle2, color: 'text-green-600', texto: 'text-green-700' },
  insuficiente: { icono: AlertTriangle, color: 'text-amber-500', texto: 'text-amber-700' },
  agotado: { icono: XCircle, color: 'text-red-500', texto: 'text-red-600' },
  desconocido: { icono: AlertTriangle, color: 'text-slate-400', texto: 'text-slate-500' },
};

const numero = (n) => Number.isInteger(n) ? n : Number(n).toFixed(2);
const unidadCorta = (u) => (u && u.trim() ? u.trim() : 'unid.');

const textoDisponible = (c) => {
  if (c.estado === 'desconocido') return 'No está en inventario';
  if (c.estado === 'agotado') return 'Sin stock';
  return `${numero(c.disponible)} disp.`;
};

const StockProducto = ({ producto, stockPorId, reservado }) => {
  const filas = stockDeLinea(producto, stockPorId, reservado);
  if (!filas.length) return null;

  const peor = filas.some(f => f.estado === 'agotado') ? 'agotado' : filas.some(f => f.estado === 'insuficiente' || f.estado === 'desconocido') ? 'insuficiente' : 'ok';
  const cargando = filas.some(f => stockPorId[f.id] === undefined);
  if (cargando) return <div className="text-[10px] text-slate-400 italic text-center">Consultando stock…</div>;

  if (filas.length === 1 && Number(componentesDe(producto)[0].cantidad) === 1) {
    const f = filas[0];
    const e = ESTILO[f.estado];
    const Icono = e.icono;
    const fondo = f.estado === 'ok' ? 'bg-green-50 border-green-200' : f.estado === 'agotado' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
    return (
      <div className={`inline-flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 ${fondo}`} title={f.nombre}>
        <span className={`flex items-center gap-1.5 text-xs font-bold ${e.texto}`}>
          <Icono className={`h-4 w-4 ${e.color}`} />
          {f.estado === 'ok' || f.estado === 'insuficiente' ? `${numero(f.disponible)} ${unidadCorta(f.unidad)} disp.` : textoDisponible(f)}
        </span>
        {f.estado === 'insuficiente' && <span className="text-[10px] font-bold text-amber-700">Faltan {numero(f.necesita - f.disponible)}</span>}
      </div>
    );
  }

  const borde = peor === 'ok' ? 'border-slate-200' : peor === 'agotado' ? 'border-red-200' : 'border-amber-200';
  return (
    <div className={`rounded-lg border bg-white shadow-sm overflow-hidden ${borde}`}>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-700">
        <Package className="h-3.5 w-3.5 text-blue-600" /> Componentes (Stock)
      </div>
      <div className="px-2 py-1 space-y-0.5">
        {filas.map(f => {
          const e = ESTILO[f.estado];
          const Icono = e.icono;
          return (
            <div key={f.id} className="flex items-center gap-1.5 text-[11px]" title={f.estado === 'insuficiente' ? `Necesita ${numero(f.necesita)}, hay ${numero(f.disponible)}` : f.nombre}>
              <Icono className={`h-3.5 w-3.5 shrink-0 ${e.color}`} />
              <span className="flex-1 min-w-0 truncate text-slate-700">{numero(f.necesita)}x {f.nombre}</span>
              <span className={`font-bold whitespace-nowrap ${e.texto}`}>{textoDisponible(f)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StockProducto;
