import React from 'react';
import { medidaDelProducto } from '@/utils/preciosProducto';

// Medida de la pieza, área de cada una y metraje total del lote (área × cantidad).
const MedidaProducto = ({ producto }) => {
  const medida = medidaDelProducto(producto);
  if (!medida) return null;
  const cantidad = parseFloat(producto.cantidad) || 0;
  return (
    <>
      <div className="font-bold text-slate-900">{medida.texto}</div>
      <div className="text-xs text-slate-500">{medida.area.toFixed(2)} m² c/u</div>
      {cantidad > 0 && (
        <div className="mt-1 inline-block rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-xs font-bold text-purple-700">
          {(medida.area * cantidad).toFixed(2)} m² total
        </div>
      )}
    </>
  );
};

export default MedidaProducto;
