import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Receipt, Paperclip, Loader2, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';
import FiltroRango from './FiltroRango';
import { monedaActual } from '@/utils/empresa';
import { descargarExcel } from '@/utils/exportarExcel';
import { enRango, fechaDeOrden, nroFacturaDe, numeroOrden, porcentajeRetencionDe, rangoDelMes, retencionDe, sumar, totalFacturaDe } from '@/utils/conciliacion';

const formato = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: monedaActual() }).format(n || 0);
const esPdf = (url) => /^data:application\/pdf/i.test(url) || /\.pdf($|\?)/i.test(url);

const VisorComprobantes = ({ orden, archivos, cargando, onCerrar }) => createPortal(
  <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onCerrar}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-bold text-slate-800">Comprobante de retención — Orden #{numeroOrden(orden)}</h3>
        <button type="button" onClick={onCerrar} className="p-1 rounded hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50">
        {cargando && <div className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>}
        {!cargando && !archivos.length && <p className="text-center py-10 text-slate-500">Esta orden no tiene comprobante de retención adjunto.</p>}
        {!cargando && archivos.map((url, i) => esPdf(url) ? (
          <div key={i} className="space-y-2">
            <iframe src={url} title={`Comprobante ${i + 1}`} className="w-full h-[70vh] bg-white border rounded" />
            {/^https?:/.test(url) && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 font-bold"><ExternalLink className="h-4 w-4" /> Abrir PDF</a>}
          </div>
        ) : (
          <img key={i} src={url} alt={`Comprobante ${i + 1}`} className="max-w-full mx-auto rounded border bg-white" />
        ))}
      </div>
    </div>
  </div>,
  document.body
);

// Órdenes con retención (ya vienen sin anuladas), filtradas por la fecha de la orden.
const ReporteRetenciones = ({ orders, rucDe, onViewOrder }) => {
  const [rango, setRango] = useState(() => rangoDelMes());
  const [visor, setVisor] = useState(null);

  const filas = useMemo(
    () => orders.filter(o => enRango(o, rango)).sort((a, b) => fechaDeOrden(a).localeCompare(fechaDeOrden(b)) || numeroOrden(a).localeCompare(numeroOrden(b))),
    [orders, rango]
  );
  const totalRetenido = sumar(filas, retencionDe);
  const totalFacturado = sumar(filas, totalFacturaDe);

  const verComprobante = async (orden) => {
    setVisor({ orden, archivos: [], cargando: true });
    let archivos = [];
    try {
      const { data } = await supabase.from('ordenes').select('comprobantes').eq('id', orden.id).single();
      const lista = data?.comprobantes && !Array.isArray(data.comprobantes) ? data.comprobantes.retencion || [] : [];
      archivos = lista.map(x => (typeof x === 'string' ? x : x?.url)).filter(Boolean);
    } catch { archivos = []; }
    setVisor(v => (v && v.orden.id === orden.id ? { ...v, archivos, cargando: false } : v));
  };

  const exportar = () => descargarExcel(`Retenciones ${rango.desde} a ${rango.hasta}`, {
    hoja: 'Retenciones',
    titulo: `Retenciones del ${rango.desde} al ${rango.hasta} (sin anuladas)`,
    columnas: [
      { titulo: '# Orden', valor: numeroOrden, ancho: 11 },
      { titulo: 'Fecha', valor: fechaDeOrden, ancho: 12 },
      { titulo: 'Cliente', valor: o => o.cliente_nombre || o.cliente || '', ancho: 40 },
      { titulo: 'RUC', valor: rucDe, ancho: 16 },
      { titulo: 'Nº Factura', valor: nroFacturaDe, ancho: 18 },
      { titulo: 'Total Factura', valor: totalFacturaDe, tipo: 'numero' },
      { titulo: '% Retención', valor: porcentajeRetencionDe, tipo: 'numero', ancho: 12 },
      { titulo: 'Monto Retenido', valor: retencionDe, tipo: 'numero', ancho: 16 },
    ],
    filas,
    totales: { '# Orden': 'TOTAL', 'Total Factura': totalFacturado, 'Monto Retenido': totalRetenido },
  });

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Receipt className="h-5 w-5 text-amber-600" /> Órdenes con Retención</h2>
          <p className="text-sm text-slate-500">Para conciliar cada mes con el contador. No incluye órdenes anuladas.</p>
        </div>
        <Button type="button" variant="outline" onClick={exportar} disabled={!filas.length} className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
          <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FiltroRango rango={rango} onCambiar={setRango} />
        <div className="flex gap-3">
          <div className="rounded-lg border bg-slate-50 border-slate-200 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Órdenes</p>
            <p className="text-lg font-black text-slate-800">{filas.length}</p>
          </div>
          <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Total retenido</p>
            <p className="text-xl font-black text-amber-700">{formato(totalRetenido)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left"># Orden</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">RUC</th>
              <th className="px-3 py-2 text-left">Nº Factura</th>
              <th className="px-3 py-2 text-right">Total Factura</th>
              <th className="px-3 py-2 text-right">% Retención</th>
              <th className="px-3 py-2 text-right">Monto Retenido</th>
              <th className="px-3 py-2 text-center">Comprobante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono font-bold">
                  <button type="button" onClick={() => onViewOrder && onViewOrder(o)} className="text-blue-700 hover:underline">{numeroOrden(o)}</button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fechaDeOrden(o)}</td>
                <td className="px-3 py-2 uppercase">{o.cliente_nombre || o.cliente}</td>
                <td className="px-3 py-2 font-mono text-xs">{rucDe(o) || '—'}</td>
                <td className="px-3 py-2 text-xs">{nroFacturaDe(o) || <span className="text-amber-600 font-bold">Sin número</span>}</td>
                <td className="px-3 py-2 text-right">{formato(totalFacturaDe(o))}</td>
                <td className="px-3 py-2 text-right">{porcentajeRetencionDe(o) ? `${porcentajeRetencionDe(o)}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-bold text-amber-700">{formato(retencionDe(o))}</td>
                <td className="px-3 py-2 text-center">
                  <button type="button" onClick={() => verComprobante(o)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100">
                    <Paperclip className="h-3.5 w-3.5" /> Ver
                  </button>
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr><td colSpan="9" className="px-3 py-10 text-center text-slate-400">No hay órdenes con retención en estas fechas.</td></tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="bg-slate-50 font-bold text-slate-800">
              <tr>
                <td colSpan="5" className="px-3 py-2 text-right">TOTAL</td>
                <td className="px-3 py-2 text-right">{formato(totalFacturado)}</td>
                <td></td>
                <td className="px-3 py-2 text-right text-amber-700">{formato(totalRetenido)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {visor && <VisorComprobantes {...visor} onCerrar={() => setVisor(null)} />}
    </div>
  );
};

export default ReporteRetenciones;
