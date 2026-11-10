import React from 'react';
import { CalendarRange } from 'lucide-react';
import { rangoDelMes } from '@/utils/conciliacion';

const FiltroRango = ({ rango, onCambiar }) => {
  const hoy = new Date();
  const esteMes = rangoDelMes(hoy);
  const mesAnterior = rangoDelMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const igual = (r) => r.desde === rango.desde && r.hasta === rango.hasta;
  const boton = (texto, r) => (
    <button
      type="button"
      onClick={() => onCambiar(r)}
      className={`px-2.5 py-1 rounded-md text-xs font-bold border ${igual(r) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
    >
      {texto}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 text-slate-500" />
      <span className="text-xs font-bold text-slate-600 uppercase">Fecha de la orden:</span>
      <input type="date" value={rango.desde} max={rango.hasta || undefined} onChange={e => onCambiar({ ...rango, desde: e.target.value })} className="border border-slate-300 rounded px-2 py-1 text-sm" />
      <span className="text-xs text-slate-500">al</span>
      <input type="date" value={rango.hasta} min={rango.desde || undefined} onChange={e => onCambiar({ ...rango, hasta: e.target.value })} className="border border-slate-300 rounded px-2 py-1 text-sm" />
      {boton('Este mes', esteMes)}
      {boton('Mes anterior', mesAnterior)}
    </div>
  );
};

export default FiltroRango;
