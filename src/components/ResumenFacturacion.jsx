import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FiltroRango from './FiltroRango';
import { monedaActual } from '@/utils/empresa';
import { descargarExcel } from '@/utils/exportarExcel';
import { baseImponibleDe, fechaDeOrden, ivaDe, nroFacturaDe, numeroOrden, resumenFacturacion, retencionDe, totalFacturaDe } from '@/utils/conciliacion';

const formato = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: monedaActual() }).format(n || 0);

const Tarjeta = ({ titulo, valor, destacada }) => (
  <div className={`rounded-lg border px-4 py-2.5 ${destacada ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
    <p className={`font-black ${destacada ? 'text-xl text-blue-700' : 'text-lg text-slate-800'}`}>{valor}</p>
  </div>
);

// Totales del rango para conciliar con el contador. "ordenes" ya viene filtrado (válidas, del rango y del tipo de factura).
const ResumenFacturacion = ({ ordenes, conFactura, rango, onCambiarRango, rucDe }) => {
  const r = resumenFacturacion(ordenes);
  const exportar = () => {
    const columnas = [
      { titulo: '# Orden', valor: numeroOrden, ancho: 11 },
      { titulo: 'Fecha', valor: fechaDeOrden, ancho: 12 },
      { titulo: 'Cliente', valor: o => o.cliente_nombre || o.cliente || '', ancho: 40 },
      { titulo: 'RUC / CI', valor: rucDe, ancho: 16 },
      ...(conFactura ? [{ titulo: 'Nº Factura', valor: nroFacturaDe, ancho: 18 }] : []),
      { titulo: 'Estado', valor: o => o.status, ancho: 16 },
      { titulo: 'Base Imponible', valor: baseImponibleDe, tipo: 'numero' },
      { titulo: 'IVA', valor: ivaDe, tipo: 'numero' },
      { titulo: 'Total', valor: totalFacturaDe, tipo: 'numero' },
      ...(conFactura ? [{ titulo: 'Retención', valor: retencionDe, tipo: 'numero' }] : []),
    ];
    descargarExcel(`Ventas ${conFactura ? 'con' : 'sin'} factura ${rango.desde} a ${rango.hasta}`, {
      hoja: conFactura ? 'Con factura' : 'Sin factura',
      titulo: `Ventas ${conFactura ? 'con' : 'sin'} factura del ${rango.desde} al ${rango.hasta} (sin anuladas)`,
      columnas,
      filas: ordenes,
      totales: { '# Orden': 'TOTAL', 'Base Imponible': r.base, IVA: r.iva, Total: r.total, Retención: r.retenciones },
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <FiltroRango rango={rango} onCambiar={onCambiarRango} />
        <Button type="button" variant="outline" size="sm" onClick={exportar} disabled={!ordenes.length} className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
          <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
        </Button>
      </div>
      <div className={`grid grid-cols-2 ${conFactura ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
        <Tarjeta titulo="Órdenes" valor={r.cantidad} />
        <Tarjeta titulo="Base imponible" valor={formato(r.base)} />
        <Tarjeta titulo="IVA" valor={formato(r.iva)} />
        <Tarjeta titulo={conFactura ? 'Total facturado' : 'Total vendido'} valor={formato(r.total)} destacada />
        {conFactura && <Tarjeta titulo="Retenciones" valor={formato(r.retenciones)} />}
      </div>
      <p className="text-[11px] text-slate-400">No incluye órdenes anuladas. Sí incluye las archivadas.</p>
    </div>
  );
};

export default ResumenFacturacion;
