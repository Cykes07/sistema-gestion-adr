import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, FileCheck, Mail, Plus, AlertTriangle, CheckCircle2, RefreshCw, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { monedaActual } from '@/utils/empresa';
import { llamarFacturacion, correoValido, CORREO_DE_RELLENO } from '@/utils/facturaElectronica';

const dinero = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: monedaActual() }).format(Number(n) || 0);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Datos del cliente que salen en la factura, tomados de su ficha (o de la orden si no tiene ficha).
const compradorInicial = (order, clients) => {
  const cliente = (clients || []).find(c => String(c.id) === String(order?.cliente_id));
  const correo = String(cliente?.email || '').trim();
  return {
    identificacion: String(cliente?.empresa || order?.ruc || '').trim(),
    razonSocial: String(cliente?.nombre || order?.cliente || order?.cliente_nombre || '').trim(),
    direccion: String(cliente?.direccion || '').trim(),
    telefono: String(cliente?.telefono || order?.cliente_telefono || '').trim(),
    correos: correo && correo.toLowerCase() !== CORREO_DE_RELLENO ? [correo] : [],
  };
};

const Campo = ({ etiqueta, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-bold text-slate-500 uppercase">{etiqueta}</span>
    {children}
  </label>
);
const estiloInput = "w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100";

// Ventana de confirmación antes de emitir la factura electrónica: el vendedor revisa y corrige los datos del cliente y los correos.
const EmitirFacturaModal = ({ order, clients, estado, onClose, onEmitida }) => {
  const inicial = useRef(compradorInicial(order, clients)).current;
  const [comprador, setComprador] = useState({ identificacion: inicial.identificacion, razonSocial: inicial.razonSocial, direccion: inicial.direccion, telefono: inicial.telefono });
  const [consumidorFinal, setConsumidorFinal] = useState(!inicial.identificacion);
  const [correos, setCorreos] = useState(inicial.correos);
  const [correoNuevo, setCorreoNuevo] = useState('');
  const [vista, setVista] = useState(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [problema, setProblema] = useState(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const enPruebas = estado?.ambiente !== 'PRODUCCIÓN';

  const datosEnvio = () => ({
    orden_id: order.id,
    comprador: consumidorFinal ? { tipoIdentificacion: '07' } : { ...comprador, identificacion: comprador.identificacion.trim() },
    correos,
  });

  // Vista previa calculada por el mismo servicio que emite: lo que se ve es lo que sale en la factura.
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      setCargandoVista(true);
      try {
        const v = await llamarFacturacion({ accion: 'previsualizar', ...datosEnvio() });
        if (vivo) { setVista(v); setProblema(null); }
      } catch (e) {
        if (vivo) { setVista(null); setProblema({ mensaje: e.message, errores: e.errores }); }
      } finally {
        if (vivo) setCargandoVista(false);
      }
    }, 600);
    return () => { vivo = false; clearTimeout(t); };
  }, [comprador, consumidorFinal, correos.join(',')]);

  const agregarCorreo = () => {
    const c = correoNuevo.trim().toLowerCase();
    if (!correoValido(c)) { setProblema({ mensaje: `"${correoNuevo}" no es un correo válido` }); return; }
    if (!correos.includes(c)) setCorreos([...correos, c]);
    setCorreoNuevo('');
  };

  const emitir = async () => {
    setEmitiendo(true);
    setProblema(null);
    try {
      const r = await llamarFacturacion({ accion: 'emitir', ...datosEnvio() });
      setResultado(r);
      if (r.estado === 'AUTORIZADO') onEmitida?.(r);
    } catch (e) {
      setProblema({ mensaje: e.message, errores: e.errores });
      if (e.facturaId) setResultado({ factura_id: e.facturaId, estado: 'EN PROCESO', mensajes: [] });
    } finally {
      setEmitiendo(false);
    }
  };

  const consultar = async () => {
    setEmitiendo(true);
    setProblema(null);
    try {
      const r = await llamarFacturacion({ accion: 'consultar', factura_id: resultado.factura_id });
      setResultado(r);
      if (r.estado === 'AUTORIZADO') onEmitida?.(r);
    } catch (e) {
      setProblema({ mensaje: e.message, errores: e.errores });
    } finally {
      setEmitiendo(false);
    }
  };

  const totales = vista?.totales;
  const iva = (totales?.impuestos || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const listoParaEmitir = !!vista && !cargandoVista && !emitiendo;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 print:hidden" onClick={() => !emitiendo && onClose()}>
      <div className="bg-white w-full max-w-3xl max-h-[95vh] flex flex-col rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2"><FileCheck className="h-5 w-5 text-emerald-400" /> Emitir factura electrónica · Orden #{String(order.order_number || order.id).padStart(7, '0')}</h3>
          <button onClick={onClose} disabled={emitiendo} className="p-1 rounded hover:bg-slate-700" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        {enPruebas && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-5 py-2 flex items-center gap-2 shrink-0">
            <FlaskConical className="h-4 w-4 shrink-0" /> <span><b>Modo PRUEBAS:</b> la factura va al ambiente de pruebas del SRI, no tiene validez y no se anota en la orden.</span>
          </div>
        )}

        <div className="p-5 overflow-y-auto space-y-5">
          {resultado ? (
            <div className={`rounded-lg border p-4 ${resultado.estado === 'AUTORIZADO' ? 'bg-emerald-50 border-emerald-300' : ['EN PROCESO', 'NO ENVIADA'].includes(resultado.estado) ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'}`}>
              {resultado.estado === 'AUTORIZADO' ? (
                <div className="space-y-1">
                  <p className="font-bold text-emerald-800 flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5" /> Factura {resultado.numero} autorizada por el SRI</p>
                  <p className="text-sm text-emerald-900">Autorización: <span className="font-mono break-all">{resultado.numeroAutorizacion}</span></p>
                  <p className="text-sm text-emerald-900">{enPruebas ? 'Era una prueba: la orden no cambia.' : 'El número de factura ya quedó escrito en la orden.'}</p>
                </div>
              ) : ['EN PROCESO', 'NO ENVIADA'].includes(resultado.estado) ? (
                <div className="space-y-2">
                  <p className="font-bold text-amber-800">{resultado.estado === 'NO ENVIADA' ? 'No hubo conexión con el SRI.' : 'El SRI todavía no responde.'} La factura {resultado.numero || ''} quedó guardada.</p>
                  <p className="text-sm text-amber-900">Espera un momento y presiona "Consultar de nuevo". No emitas otra factura para esta orden.</p>
                  <Button onClick={consultar} disabled={emitiendo} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    {emitiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Consultar de nuevo
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-bold text-red-800">El SRI no autorizó la factura ({resultado.estado}).</p>
                  {(resultado.mensajes || []).map((m, i) => <p key={i} className="text-sm text-red-900">• {m.mensaje}{m.informacionAdicional ? ` — ${m.informacionAdicional}` : ''}</p>)}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-700">Datos del cliente en la factura</h4>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={consumidorFinal} onChange={e => setConsumidorFinal(e.target.checked)} className="h-4 w-4" />
                    Consumidor final (hasta $50)
                  </label>
                </div>
                {!consumidorFinal && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo etiqueta="RUC / Cédula / Pasaporte">
                      <input className={estiloInput} value={comprador.identificacion} onChange={e => setComprador({ ...comprador, identificacion: e.target.value })} />
                    </Campo>
                    <Campo etiqueta="Razón social / Nombre">
                      <input className={estiloInput} value={comprador.razonSocial} onChange={e => setComprador({ ...comprador, razonSocial: e.target.value })} />
                    </Campo>
                    <Campo etiqueta="Dirección">
                      <input className={estiloInput} value={comprador.direccion} onChange={e => setComprador({ ...comprador, direccion: e.target.value })} />
                    </Campo>
                    <Campo etiqueta="Teléfono">
                      <input className={estiloInput} value={comprador.telefono} onChange={e => setComprador({ ...comprador, telefono: e.target.value })} />
                    </Campo>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-2"><Mail className="h-4 w-4" /> Correos a los que se envía la factura</h4>
                <div className="flex flex-wrap gap-2">
                  {correos.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-3 pr-1 py-1 text-sm">
                      {c}
                      <button onClick={() => setCorreos(correos.filter(x => x !== c))} className="p-0.5 rounded-full hover:bg-blue-100" aria-label={`Quitar ${c}`}><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ))}
                  {!correos.length && <span className="text-sm text-amber-700">Sin correo: la factura se emite igual, pero no se le envía al cliente.</span>}
                </div>
                <div className="flex gap-2">
                  <input className={estiloInput} type="email" placeholder="otro@correo.com" value={correoNuevo} onChange={e => setCorreoNuevo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarCorreo(); } }} />
                  <Button type="button" variant="outline" onClick={agregarCorreo} disabled={!correoNuevo.trim()} className="gap-1 shrink-0"><Plus className="h-4 w-4" /> Agregar</Button>
                </div>
                <p className="text-xs text-slate-400">Los correos quedan guardados con la factura. El envío automático del PDF por correo se activa en la siguiente etapa.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-2">Así saldrá la factura {cargandoVista && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}</h4>
                {vista && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr><th className="text-left px-3 py-2">Descripción</th><th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">P. Unit. (sin IVA)</th><th className="text-right px-3 py-2">Desc.</th><th className="text-right px-3 py-2">Subtotal</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vista.items.map((it, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{it.descripcion}</td>
                            <td className="px-3 py-2 text-right">{it.cantidad}</td>
                            <td className="px-3 py-2 text-right">{Number(it.precioUnitario).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{it.descuento ? Number(it.descuento).toFixed(2) : '—'}</td>
                            <td className="px-3 py-2 text-right">{dinero(r2(it.cantidad * it.precioUnitario - (it.descuento || 0)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-slate-50 px-3 py-2 space-y-0.5 text-right">
                      <p>Subtotal sin IVA: <b>{dinero(totales.totalSinImpuestos)}</b>{Number(totales.totalDescuento) > 0 && <span className="text-slate-500"> (descuento {dinero(totales.totalDescuento)})</span>}</p>
                      <p>IVA: <b>{dinero(iva)}</b></p>
                      <p className="text-base">Total factura: <b>{dinero(totales.importeTotal)}</b></p>
                      <p className="text-xs text-slate-500">Forma de pago: {vista.formaPago === '01' ? 'Efectivo (sin sistema financiero)' : 'Transferencia / tarjeta / otros con sistema financiero'}</p>
                    </div>
                  </div>
                )}
                {vista && Math.abs(vista.diferencia) >= 0.01 && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    Por el redondeo obligatorio del IVA, la factura sale por {dinero(totales.importeTotal)} y la orden es de {dinero(vista.totalOrden)} ({vista.diferencia > 0 ? '+' : ''}{dinero(vista.diferencia)}).</p>
                )}
              </div>
            </>
          )}

          {problema && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 text-sm space-y-1">
              <p className="font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {problema.mensaje}</p>
              {(problema.errores || []).map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
        </div>

        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={emitiendo} className="bg-white">{resultado ? 'Cerrar' : 'Cancelar'}</Button>
          {!resultado && (
            <Button onClick={emitir} disabled={!listoParaEmitir} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[200px]">
              {emitiendo ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando al SRI…</> : <><FileCheck className="h-4 w-4" /> Confirmar y emitir</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmitirFacturaModal;
