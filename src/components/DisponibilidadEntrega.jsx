import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, Lock, CheckCircle2, CalendarDays, Info, X } from 'lucide-react';
import { listaDeHorarios, textoItems } from '@/utils/horariosEntrega';

const pasoDe = (orden) => orden.status === 'PRODUCCION'
  ? { texto: 'Producción', punto: 'bg-orange-400' }
  : { texto: 'Ventas / Diseño', punto: 'bg-blue-400' };

const fechaCorta = (fecha) => fecha ? fecha.split('-').reverse().join('/') : '';

const describirOcupado = (h) => h.ordenes.map(o => `${o.cliente_nombre || o.cliente || 'Sin cliente'} — ${o.tipo_trabajo || o.tipoLetrero || 'Sin título'}`).join('\n');

export const SelectorHoraEntrega = ({ value, onChange, horarios, disabled, permitirOcupadas = false, horaPropia = null }) => {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const lista = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    const elegida = lista.current?.querySelector('[data-elegida="true"]');
    if (elegida) elegida.scrollIntoView({ block: 'center' });
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const opciones = listaDeHorarios().includes(value)
    ? horarios
    : [{ hora: value, estado: 'libre', ordenes: [], items: 0 }, ...horarios];

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(a => !a)}
        className="border border-slate-300 rounded px-2 py-1 text-sm bg-white w-24 flex items-center justify-between gap-1 disabled:bg-slate-100 disabled:text-slate-500"
      >
        {value} <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
      {abierto && (
        <div ref={lista} className="absolute z-30 mt-1 w-40 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl py-1">
          {opciones.map(h => {
            const esPropia = h.hora === horaPropia;
            const bloqueada = !esPropia && (h.estado === 'pasada' || (h.estado === 'ocupada' && !permitirOcupadas));
            const elegida = h.hora === value;
            return (
              <button
                key={h.hora}
                type="button"
                data-elegida={elegida}
                disabled={bloqueada}
                title={h.estado === 'ocupada' ? `Ocupado:\n${describirOcupado(h)}` : undefined}
                onClick={() => { onChange(h.hora); setAbierto(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-sm text-left ${
                  h.estado === 'pasada' && !esPropia ? 'text-slate-400 cursor-not-allowed'
                  : h.estado === 'ocupada' && !esPropia ? `bg-slate-50 text-slate-400 ${bloqueada ? 'cursor-not-allowed' : 'hover:bg-red-50'}`
                  : elegida ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-blue-50'
                }`}
              >
                <span>{h.hora}</span>
                {h.estado === 'pasada' && !esPropia && <span className="flex items-center gap-1 text-[10px]"><Clock className="h-3 w-3" />(Pasada)</span>}
                {h.estado === 'ocupada' && !esPropia && <Lock className="h-3.5 w-3.5 text-slate-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PanelDisponibilidad = ({ fecha, horarios, horaElegida, onElegir, onCalendario, onCerrar }) => (
  <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={onCerrar}>
    <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
          <CalendarDays className="h-6 w-6 text-blue-600" /> Disponibilidad del Día ({fechaCorta(fecha)})
        </h3>
        <button type="button" onClick={onCerrar} className="p-1 rounded hover:bg-slate-100 text-slate-500"><X className="h-5 w-5" /></button>
      </div>

      <div className="mx-5 mt-4 flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2 text-xs">
        <Info className="h-4 w-4 shrink-0" /> Aquí puedes ver los horarios ocupados y disponibles para programar la fecha de entrega.
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
        {horarios.map(h => {
          const elegida = h.hora === horaElegida;
          return (
            <div key={h.hora} className="grid grid-cols-[52px_1fr] items-stretch gap-2">
              <span className={`text-sm pt-2 ${elegida ? 'font-black text-blue-700' : 'text-slate-500'}`}>{h.hora}</span>
              {h.estado === 'pasada' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-400 text-sm">
                  <Clock className="h-4 w-4" /> Hora pasada
                </div>
              )}
              {h.estado === 'libre' && (
                <button
                  type="button"
                  disabled={!onElegir}
                  onClick={() => onElegir && onElegir(h.hora)}
                  className={`group flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border text-sm font-bold text-left text-green-700 bg-green-50 ${elegida ? 'border-blue-400 ring-2 ring-blue-200' : 'border-green-200'} ${onElegir ? 'hover:bg-green-100' : ''}`}
                >
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Disponible</span>
                  {elegida
                    ? <span className="text-[10px] font-bold text-blue-700 uppercase">Hora elegida</span>
                    : onElegir && <span className="text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100">Elegir</span>}
                </button>
              )}
              {h.estado === 'ocupada' && (
                <div className="px-3 py-2 rounded-md border border-red-200 bg-red-50 space-y-1.5">
                  {h.ordenes.map(o => {
                    const paso = pasoDe(o);
                    return (
                      <div key={o.id} className="flex items-start gap-2">
                        <CalendarDays className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-red-700 truncate">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${paso.punto}`} />
                            {paso.texto}: {o.tipo_trabajo || o.tipoLetrero || 'Sin título'}
                          </p>
                          <p className="text-xs text-slate-600 truncate">Cliente: {o.cliente_nombre || o.cliente || '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs font-bold text-red-700 text-right">{textoItems(h.items)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Horario disponible</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-red-500" /> Horario ocupado</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> Hora pasada</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Ventas / Diseño</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Producción</span>
        </div>
        {onCalendario && (
          <button type="button" onClick={onCalendario} className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-blue-300 bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100">
            <CalendarDays className="h-4 w-4" /> Ir a Calendario Completo
          </button>
        )}
      </div>
    </div>
  </div>
);
