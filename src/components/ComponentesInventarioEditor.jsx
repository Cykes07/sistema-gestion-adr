import React, { useEffect, useRef, useState } from 'react';
import { Package, Search, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ComponentesInventarioEditor = ({ componentes = [], onChange, porMetro = false }) => {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const espera = useRef(null);

  useEffect(() => {
    if (espera.current) clearTimeout(espera.current);
    const texto = busqueda.trim();
    if (texto.length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    espera.current = setTimeout(async () => {
      const { data } = await supabase.from('inventario').select('id, nombre, cantidad, unidad, bodega').ilike('nombre', `%${texto}%`).order('nombre').limit(15);
      setResultados(data || []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(espera.current);
  }, [busqueda]);

  const agregar = (mat) => {
    if (!componentes.some(c => String(c.id) === String(mat.id))) {
      onChange([...componentes, { id: mat.id, nombre: mat.nombre, unidad: mat.unidad || '', cantidad: 1 }]);
    }
    setBusqueda('');
    setResultados([]);
  };

  const cambiarCantidad = (id, valor) => onChange(componentes.map(c => String(c.id) === String(id) ? { ...c, cantidad: valor } : c));
  const cambiarActivo = (id, activo) => onChange(componentes.map(c => String(c.id) === String(id) ? { ...c, activo } : c));
  const quitar = (id) => onChange(componentes.filter(c => String(c.id) !== String(id)));

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <div className="border-b border-slate-100 pb-2">
        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Package className="h-4 w-4 text-blue-600" /> Componentes de Inventario</h4>
        <p className="text-xs text-slate-500 mt-1">
          Lo que sale del inventario por cada {porMetro ? 'pieza' : 'unidad'} vendida. Un producto simple lleva un solo ítem; un kit lleva varios
          (ej. 1 identificador, 4 separadores, 3 plantas). Déjalo vacío si no usa inventario.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          <b>Material activo:</b> insumos que salen enteros a la máquina (rollo de vinil, lona, tóner). Se muestran como referencia, pero
          no se descuentan ni se cargan a Producción por cada venta.
        </p>
      </div>

      {componentes.length > 0 && (
        <div className="space-y-2">
          {componentes.map(c => (
            <div key={c.id} className={`flex flex-wrap items-center gap-2 p-2 rounded border ${c.activo ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50'}`}>
              <input
                type="number" min="0" step="any" value={c.cantidad}
                onChange={e => cambiarCantidad(c.id, e.target.value)}
                onWheel={e => e.currentTarget.blur()}
                className="w-20 h-8 border border-slate-300 rounded text-center text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-500">x</span>
              <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-800" title={c.nombre}>{c.nombre}</span>
              {c.unidad && <span className="text-[10px] text-slate-500 whitespace-nowrap">{c.unidad}</span>}
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none whitespace-nowrap" title="No descontar de inventario por orden de venta">
                <input type="checkbox" checked={!!c.activo} onChange={e => cambiarActivo(c.id, e.target.checked)} className="h-4 w-4 accent-amber-600" />
                Material activo <span className="font-normal text-slate-400">(no descontar por venta)</span>
              </label>
              <button type="button" onClick={() => quitar(c.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar material del inventario para enlazar..."
          className="w-full h-9 pl-8 pr-8 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
        {resultados.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-xl">
            {resultados.map(r => {
              const yaEsta = componentes.some(c => String(c.id) === String(r.id));
              return (
                <button
                  key={r.id} type="button" disabled={yaEsta} onClick={() => agregar(r)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border-b border-slate-50 hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800 truncate">{r.nombre}</span>
                    {r.bodega && <span className="block text-[10px] text-slate-400">{r.bodega}</span>}
                  </span>
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{yaEsta ? 'Ya enlazado' : `${Number(r.cantidad) || 0} ${r.unidad || ''}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentesInventarioEditor;
