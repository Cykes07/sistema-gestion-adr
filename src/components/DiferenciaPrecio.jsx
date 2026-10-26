import React from 'react';
import { simboloMoneda } from '@/utils/empresa';

const DiferenciaPrecio = ({ diferencia, className = '' }) => {
  if (!Number.isFinite(diferencia) || Math.abs(diferencia) < 0.005) return null;
  const sube = diferencia > 0;
  return (
    <span
      title={sube ? 'Por encima del precio de catálogo' : 'Por debajo del precio de catálogo'}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap ${sube ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} ${className}`}
    >
      {sube ? '↑ +' : '↓ -'}{simboloMoneda()}{Math.abs(diferencia).toFixed(2)}
    </span>
  );
};

export default DiferenciaPrecio;
