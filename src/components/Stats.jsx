import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { isUserInList } from '@/utils/userMatch';
import { supabase } from '../supabaseClient';
import {
  ShoppingCart,
  Settings,
  PackageCheck,
  Calculator,
  CreditCard,
  AlertCircle,
  Users,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Flag,
  Archive,
  Banknote
} from 'lucide-react';

// Helper para obtener la fecha local exacta sin errores de zona horaria
const getLocalDate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// 🔥 Calculador Inteligente de Estados Contables (Idéntico a WorkAreaList) 🔥
// 🔧 CAMBIO: antes una orden solo podía tener UN estado (si estaba impaga, ocultaba
// que también le faltaba la retención). Ahora se calculan por separado, así que una
// orden con saldo pendiente Y retención sin subir aparece en AMBAS tarjetas.
const getOrderAccountingStatus = (o) => {
    const total = Number(o.financials?.total) || 0;
    const anticipo = Number(o.anticipo) || 0;
    const retencion = Number(o.retencion || o.financials?.retencion) || 0;
    const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
    const saldoFinalReal = total - anticipo - retencion - totalAbonado;

    const pSaldo = String(o.formaPagoSaldo || o.financials?.formaPagoSaldo || '').toLowerCase();
    const pAnticipo = String(o.formaPagoAnticipo || o.forma_pago_anticipo || '').toLowerCase();
    const isCredito = pSaldo.includes('crédit') || pSaldo.includes('credit') ||
                      pAnticipo.includes('crédit') || pAnticipo.includes('credit');

    const today = getLocalDate();
    const fechaVence = o.financials?.creditoVenceSaldo || o.creditoVenceSaldo || o.credito_vence_saldo || o.creditoVenceAnticipo || o.credito_vence_anticipo || o.financials?.creditoVenceAnticipo || '';

    const isVencido = isCredito && fechaVence && fechaVence < today;

    const isImpaga = saldoFinalReal > 0.01 && (!isCredito || isVencido);
    const isCreditoActivo = saldoFinalReal > 0.01 && isCredito && !isVencido;
    const isPorFinalizar = !isImpaga && !isCreditoActivo;

    return {
        isImpaga,
        isCreditoActivo,
        isPorFinalizar,
        // se mantiene 'status' (un solo valor) por compatibilidad con otras pantallas
        // que ya lo usan así (ej. WorkAreaList) — prioridad: impaga > retención > crédito
        status: isImpaga ? 'impagas' : isCreditoActivo ? 'creditos' : 'por_finalizar'
    };
};

const COLUMNAS_FLUJO = 'repeat(5, minmax(0, 1fr) 2rem) minmax(0, 1fr)';

const TarjetaEtapa = ({ card, index, compacta = false }) => {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`${compacta ? 'p-3' : 'p-4'} h-full rounded-xl border ${card.borderColor} ${card.bgColor} shadow-sm hover:shadow-md transition-shadow flex flex-col`}
    >
      <div className={`flex justify-between items-start ${compacta ? 'mb-1' : 'mb-2'}`}>
        <div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{card.title}</p>
          <h4 className={`${compacta ? 'text-xl' : 'text-2xl'} font-black ${card.textColor} mt-1`}>{card.value}</h4>
        </div>
        <div className={`${compacta ? 'p-1.5' : 'p-2'} rounded-lg bg-white bg-opacity-60 shrink-0`}>
          <Icon className={`${compacta ? 'h-4 w-4' : 'h-5 w-5'} ${card.textColor}`} />
        </div>
      </div>

      {card.breakdown && (
        <div className={`mt-auto ${compacta ? 'pt-2 space-y-1' : 'pt-3 space-y-1.5'} border-t border-black/10`}>
          {card.breakdown.length > 0 ? (
            card.breakdown.map(b => (
              <div key={b.name} className="flex justify-between items-center text-[10px] text-slate-600">
                <span className="truncate pr-2 font-medium" title={b.name}>{b.name}</span>
                <span className={`font-bold bg-white px-1.5 py-0.5 rounded shadow-sm ${card.textColor}`}>{b.count}</span>
              </div>
            ))
          ) : (
            <div className="text-[10px] text-slate-400 italic text-center">Sin órdenes</div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const TarjetaAccion = ({ accion, index, onClick }) => {
  const Icon = accion.icon;
  const clases = `w-full h-full p-4 rounded-xl border-2 ${accion.borderColor} ${accion.bgColor} shadow-sm flex flex-col items-center justify-center text-center gap-2 transition-shadow`;
  const contenido = (
    <>
      <Icon className={`h-7 w-7 ${accion.textColor}`} />
      <div>
        <p className={`text-sm font-black uppercase tracking-wide ${accion.textColor}`}>{accion.title}</p>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{accion.subtitle}</p>
      </div>
    </>
  );
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
      {onClick ? (
        <button type="button" onClick={onClick} title={accion.tooltip} className={`${clases} hover:shadow-md cursor-pointer`}>{contenido}</button>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </motion.div>
  );
};

const Flecha = ({ icon: Icon = ArrowRight, className = 'text-slate-400' }) => (
  <div className="flex items-center justify-center">
    <Icon className={`h-5 w-5 ${className}`} strokeWidth={2.5} />
  </div>
);

const Stats = ({ orders, user, vendedorSeleccionado, onCambiarVendedor, onIrA }) => {
  // 🔥 REGLA DE SEGURIDAD: Producción NO ve las estadísticas del Dashboard 🔥
  if (user?.role === 'Producción') {
    return null;
  }

  const isAdmin = user?.role === 'Administrador';

  // 🔧 NUEVO: filtro "ver solo este vendedor" — para cuadrar comisiones sin tener
  // que sumar a mano el desglose de cada tarjeta.
  const [staffList, setStaffList] = useState([]);
  const [selectedVendedorInterno, setSelectedVendedorInterno] = useState('');
  // 🔧 Si el Inicio maneja el vendedor elegido (para filtrar TAMBIÉN la tabla de órdenes), se usa ese; si no, el propio.
  const selectedVendedorId = vendedorSeleccionado !== undefined ? vendedorSeleccionado : selectedVendedorInterno;
  const setSelectedVendedorId = onCambiarVendedor || setSelectedVendedorInterno;

  useEffect(() => {
      if (!isAdmin) return;
      const fetchStaff = async () => {
          const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Vendedor').order('full_name');
          if (data) setStaffList(data);
      };
      fetchStaff();
  }, [isAdmin]);

  // 🔥 FILTRO DE USUARIO: Los vendedores solo ven SUS propias órdenes 🔥
  const visibleOrders = orders.filter(o => {
      // Si el Admin eligió un vendedor específico, solo se cuentan sus órdenes
      // (para calcular comisiones), sin importar el rol de quien está logueado.
      if (isAdmin && selectedVendedorId) {
          const selectedUser = staffList.find(u => u.id === selectedVendedorId);
          return isUserInList(o.vendedor_ids, o.vendedor, { id: selectedVendedorId, name: selectedUser?.full_name });
      }
      // Admin y Contabilidad ven el global de la empresa
      if (isAdmin || user?.role === 'Contabilidad') return true;
      // Los vendedores solo ven las órdenes donde estén asignados
      return isUserInList(o.vendedor_ids, o.vendedor, user);
  });

  // Función para obtener el desglose por vendedor (Solo para Admin, y solo si no
  // filtró a un vendedor específico — si ya filtró, sería información repetida)
  const getBreakdown = (filteredOrders) => {
    if (!isAdmin || selectedVendedorId) return null;
    const bd = {};
    filteredOrders.forEach(o => {
      const v = o.vendedor || 'Sin asignar';
      bd[v] = (bd[v] || 0) + 1;
    });
    return Object.entries(bd)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Clasificación de las órdenes VISIBLES
  const ventasOrders = visibleOrders.filter(o => o.status === 'VENTAS');
  const produccionOrders = visibleOrders.filter(o => o.status === 'PRODUCCION');
  const retirarOrders = visibleOrders.filter(o => o.status === 'VENTAS POR RETIRAR');
  // "Por Cerrar" (antes "Contabilidad"): órdenes esperando el cierre — pagos en VERIFICACIÓN
  // (los mismos de "Pagos por Verificar") y las de POR COBRAR que ya quedaron saldadas.
  const porCerrarOrders = visibleOrders.filter(o => o.status === 'VERIFICACIÓN' || (o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isPorFinalizar));

  // 🔥 CRÉDITOS, RETENCIONES E IMPAGAS — ahora independientes entre sí 🔥
  const creditOrders = visibleOrders.filter(o => o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isCreditoActivo);
  const impagasOrders = visibleOrders.filter(o => o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isImpaga);

  const ingresadas = {
      title: 'Ingresadas',
      value: ventasOrders.length,
      breakdown: getBreakdown(ventasOrders),
      icon: ShoppingCart,
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100'
  };
  const enProduccion = {
      title: 'En Producción',
      value: produccionOrders.length,
      breakdown: getBreakdown(produccionOrders),
      icon: Settings,
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100'
  };
  const porRetirar = {
      title: 'Por Retirar',
      value: retirarOrders.length,
      breakdown: getBreakdown(retirarOrders),
      icon: PackageCheck,
      textColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100'
  };
  const porCerrar = {
      title: 'Por Cerrar',
      value: porCerrarOrders.length,
      breakdown: getBreakdown(porCerrarOrders),
      icon: Calculator,
      textColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100'
  };
  const creditos = {
      title: 'Créditos',
      value: creditOrders.length,
      breakdown: getBreakdown(creditOrders),
      icon: CreditCard,
      textColor: 'text-pink-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-100'
  };
  const impagas = {
      title: 'Impagas',
      value: impagasOrders.length,
      breakdown: getBreakdown(impagasOrders),
      icon: AlertCircle,
      textColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100'
  };
  const finalizar = {
      title: 'Finalizar',
      subtitle: 'Cerrar jornada y verificar pagos',
      tooltip: 'Ir al Centro de Notificaciones',
      icon: Flag,
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50/60',
      borderColor: 'border-blue-300'
  };
  const archivar = {
      title: 'Archivar',
      subtitle: 'Mover a histórico',
      tooltip: 'Ver órdenes archivadas',
      icon: Archive,
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50/60',
      borderColor: 'border-emerald-300'
  };

  const irA = isAdmin && onIrA ? onIrA : null;
  const alFinalizar = irA ? () => irA('notificaciones') : undefined;
  const alArchivar = irA ? () => irA('ordenes-archivadas') : undefined;

  const selectorVendedor = isAdmin && (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide whitespace-nowrap">Comisiones — Ver:</span>
      </div>
      <select
        className="border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-full"
        value={selectedVendedorId}
        onChange={(e) => setSelectedVendedorId(e.target.value)}
      >
        <option value="">Todos (vista global de la empresa)</option>
        {staffList.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
      </select>
    </div>
  );

  const totalOrdenes = isAdmin && (
    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full whitespace-nowrap">
      {selectedVendedorId
        ? `Total de órdenes de ${staffList.find(u => u.id === selectedVendedorId)?.full_name || ''}: ${visibleOrders.length}`
        : `Total de órdenes: ${visibleOrders.length}`}
    </span>
  );

  const etiqueta = (texto, clase = 'text-pink-500') => (
    <span className={`text-[9px] font-bold uppercase tracking-wide ${clase} whitespace-nowrap`}>{texto}</span>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="hidden xl:grid gap-y-1" style={{ gridTemplateColumns: COLUMNAS_FLUJO }}>
        <div className="flex items-start min-w-0 pr-4" style={{ gridColumn: '1 / 4', gridRow: 1 }}>{selectorVendedor}</div>

        <div style={{ gridColumn: 5, gridRow: 1 }}><TarjetaEtapa card={creditos} index={6} compacta /></div>
        <div className="flex flex-col items-center justify-center gap-1" style={{ gridColumn: 6, gridRow: 1 }} title="Un crédito vencido pasa a Impagas; con una prórroga vuelve a Créditos">
          <ArrowLeftRight className="h-5 w-5 text-pink-500" strokeWidth={2.5} />
        </div>
        <div style={{ gridColumn: 7, gridRow: 1 }}><TarjetaEtapa card={impagas} index={7} compacta /></div>

        <div className="flex items-start justify-end" style={{ gridColumn: '9 / 12', gridRow: 1 }}>{totalOrdenes}</div>

        <div className="flex items-center justify-center gap-1.5 py-1" style={{ gridColumn: 5, gridRow: 2 }} title="Se entrega a crédito o con saldo pendiente">
          <ArrowUp className="h-5 w-5 text-pink-500" strokeWidth={2.5} />{etiqueta('Con saldo')}
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1" style={{ gridColumn: 7, gridRow: 2 }} title="Al cobrar el saldo, pasa a verificación de pagos">
          <ArrowDown className="h-5 w-5 text-pink-500" strokeWidth={2.5} />{etiqueta('Pagada')}
        </div>

        <div style={{ gridColumn: 1, gridRow: 3 }}><TarjetaEtapa card={ingresadas} index={0} /></div>
        <div style={{ gridColumn: 2, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 3, gridRow: 3 }}><TarjetaEtapa card={enProduccion} index={1} /></div>
        <div style={{ gridColumn: 4, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 5, gridRow: 3 }}><TarjetaEtapa card={porRetirar} index={2} /></div>
        <div style={{ gridColumn: 6, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 7, gridRow: 3 }}><TarjetaEtapa card={porCerrar} index={3} /></div>
        <div style={{ gridColumn: 8, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 9, gridRow: 3 }}><TarjetaAccion accion={finalizar} index={4} onClick={alFinalizar} /></div>
        <div style={{ gridColumn: 10, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 11, gridRow: 3 }}><TarjetaAccion accion={archivar} index={5} onClick={alArchivar} /></div>

        <div className="relative h-9" style={{ gridColumn: '5 / 10', gridRow: 4 }} title="Pagos en efectivo: no necesitan verificación, pasan directo a Finalizar">
          <div className="absolute top-0 h-5 border-2 border-t-0 border-dashed border-blue-400 rounded-b-xl" style={{ left: 'calc((100% - 4rem) / 6)', right: 'calc((100% - 4rem) / 6)' }} />
          <div className="absolute -top-0.5 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-blue-400" style={{ right: 'calc((100% - 4rem) / 6 - 5px)' }} />
          <div className="absolute left-1/2 -translate-x-1/2 top-2.5 flex items-center gap-1.5 bg-white border border-blue-200 text-blue-700 rounded-full px-3 py-0.5 text-[11px] font-bold shadow-sm whitespace-nowrap">
            <Banknote className="h-3.5 w-3.5" /> Pago en Efectivo
          </div>
        </div>
      </div>

      <div className="xl:hidden space-y-3">
        {isAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {selectorVendedor}
            {totalOrdenes}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[ingresadas, enProduccion, porRetirar, porCerrar, creditos, impagas].map((card, i) => (
            <TarjetaEtapa key={card.title} card={card} index={i} />
          ))}
          <TarjetaAccion accion={finalizar} index={6} onClick={alFinalizar} />
          <TarjetaAccion accion={archivar} index={7} onClick={alArchivar} />
        </div>
      </div>
    </div>
  );
};

export default Stats;
