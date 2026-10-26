import React from 'react';
import { simboloMoneda } from '@/utils/empresa';
import { tarifasPorVolumen } from '@/utils/preciosProducto';

const numero = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

const TarifasVolumen = ({ item, mayorista = false }) => {
  const tarifas = tarifasPorVolumen(item, mayorista);
  if (!tarifas) return null;
  const unidad = (desde) => (tarifas.porMetro ? 'm²' : desde === 1 ? 'und' : 'unds');
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 text-[10px] text-left overflow-hidden shadow-sm">
      <div className="px-2 py-1 font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
        💡 Tarifas ({tarifas.porMetro ? '$/m²' : 'unds'}){tarifas.mayorista ? ' · mayorista' : ''}
      </div>
      {tarifas.filas.map((fila, i) => (
        <div key={i} className={`flex justify-between gap-2 px-2 py-0.5 ${i === tarifas.activo ? 'bg-green-100 text-green-800 font-bold' : 'text-slate-600'}`}>
          <span className="whitespace-nowrap">≥ {numero(fila.desde)} {unidad(fila.desde)}</span>
          <span>{simboloMoneda()}{fila.precio.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default TarifasVolumen;
