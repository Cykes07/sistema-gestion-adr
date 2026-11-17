import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { isUserInList } from '@/utils/userMatch';
import { supabase } from '../supabaseClient';
import {
  ShoppingCart,
  Settings,
  PackageCheck,
  CreditCard,
  AlertCircle,
  Users,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Flag,
  Archive,
  Banknote,
  ShieldCheck,
  Layers,
  ChevronsDownUp,
  ChevronsUpDown,
  Zap
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

// 6 columnas de tarjeta y 5 de flecha (2rem). Las líneas del diagrama se ubican con el centro de cada tarjeta.
const COLUMNAS_FLUJO = 'repeat(5, minmax(0, 1fr) 2rem) minmax(0, 1fr)';
const ANCHO_TARJETA = '((100% - 10rem) / 6)';
const centro = (k) => `calc(${k} * (${ANCHO_TARJETA} + 2rem) + ${ANCHO_TARJETA} / 2)`;
const tramo = (desde, hasta) => ({ left: centro(desde), width: `calc(${hasta - desde} * (${ANCHO_TARJETA} + 2rem))` });

const CLAVE_COLAPSADO = 'inicioFlujoColapsado';
const leerColapsado = () => { try { return localStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { return false; } };

const TarjetaEtapa = ({ card, index, compacta = false }) => {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`${compacta ? 'p-3' : 'p-4'} h-full rounded-xl border ${card.borderColor} ${card.bgColor} shadow-sm hover:shadow-md transition-shadow flex flex-col`}
    >
      <div className={`flex justify-between items-start ${compacta ? '' : 'mb-2'}`}>
        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{card.title}</p>
          <h4 className={`${compacta ? 'text-xl' : 'text-2xl'} font-black ${card.textColor} mt-0.5`}>{card.value}</h4>
        </div>
        <div className={`${compacta ? 'p-1.5' : 'p-2'} rounded-lg bg-white bg-opacity-60 shrink-0 xl:hidden 2xl:block`}>
          <Icon className={`${compacta ? 'h-4 w-4' : 'h-5 w-5'} ${card.textColor}`} />
        </div>
      </div>

      {!compacta && card.breakdown && (
        <div className="mt-auto pt-3 space-y-1.5 border-t border-black/10">
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
    <motion.div className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      {onClick ? (
        <button type="button" onClick={onClick} title={accion.tooltip} className={`${clases} hover:shadow-md cursor-pointer`}>{contenido}</button>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </motion.div>
  );
};

const Flecha = () => (
  <div className="flex items-center justify-center">
    <ArrowRight className="h-5 w-5 text-slate-400" strokeWidth={2.5} />
  </div>
);

const Chip = ({ children, className }) => (
  <span className={`flex items-center gap-1 bg-white border rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm whitespace-nowrap ${className}`}>{children}</span>
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
  const [colapsado, setColapsado] = useState(leerColapsado);

  useEffect(() => {
      if (!isAdmin) return;
      const fetchStaff = async () => {
          const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Vendedor').order('full_name');
          if (data) setStaffList(data);
      };
      fetchStaff();
  }, [isAdmin]);

  const alternarColapsado = () => {
      setColapsado(c => {
          try { localStorage.setItem(CLAVE_COLAPSADO, c ? '0' : '1'); } catch { /* sin almacenamiento: solo dura la sesión */ }
          return !c;
      });
  };

  // 🔥 FILTRO DE USUARIO: Los vendedores solo ven SUS propias órdenes 🔥
  const visibleOrders = orders.filter(o => {
      // Si el Admin eligió un vendedor específico, solo se cuentan sus órdenes
      // (para calcular comisiones), sin importar el rol de quien está logueado.
      if (isAdmin && selectedVendedorId) {
          const selectedUser = staffList.find(u => u.id === selectedVendedorId);
          return isUserInList(o.vendedor_ids, o.vendedor, { id: selectedVendedorId, name: selectedUser?.full_name });
      }
      if (isAdmin) return true;
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

  const ventasOrders = visibleOrders.filter(o => o.status === 'VENTAS');
  const produccionOrders = visibleOrders.filter(o => o.status === 'PRODUCCION');
  const retirarOrders = visibleOrders.filter(o => o.status === 'VENTAS POR RETIRAR');
  // Verificación (antes "Por Cerrar"): pagos en VERIFICACIÓN (los de "Pagos por Verificar") y las de POR COBRAR ya saldadas.
  const verificacionOrders = visibleOrders.filter(o => o.status === 'VERIFICACIÓN' || (o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isPorFinalizar));
  const creditOrders = visibleOrders.filter(o => o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isCreditoActivo);
  const impagasOrders = visibleOrders.filter(o => o.status === 'POR COBRAR' && getOrderAccountingStatus(o).isImpaga);
  const totalActivas = ventasOrders.length + produccionOrders.length + retirarOrders.length + verificacionOrders.length + creditOrders.length + impagasOrders.length;

  const etapa = (title, lista, icon, textColor, bgColor, borderColor) => ({ title, value: lista.length, breakdown: getBreakdown(lista), icon, textColor, bgColor, borderColor });
  const ingresadas = etapa('Ingresadas', ventasOrders, ShoppingCart, 'text-blue-500', 'bg-blue-50', 'border-blue-100');
  const enProduccion = etapa('En Producción', produccionOrders, Settings, 'text-amber-500', 'bg-amber-50', 'border-amber-100');
  const porRetirar = etapa('Por Retirar', retirarOrders, PackageCheck, 'text-green-500', 'bg-green-50', 'border-green-100');
  const verificacion = etapa('Verificación', verificacionOrders, ShieldCheck, 'text-fuchsia-500', 'bg-fuchsia-50', 'border-fuchsia-100');
  const creditos = etapa('Créditos', creditOrders, CreditCard, 'text-pink-500', 'bg-pink-50', 'border-pink-100');
  const impagas = etapa('Impagas', impagasOrders, AlertCircle, 'text-red-500', 'bg-red-50', 'border-red-100');
  const activas = {
      title: 'Total de órdenes activas', value: totalActivas, icon: Layers,
      textColor: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200',
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
    <div className="flex items-center gap-2 min-w-0" title="Ver el flujo de toda la empresa o de un vendedor">
      <Users className="h-4 w-4 text-slate-500 shrink-0" />
      <select
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-full"
        value={selectedVendedorId}
        onChange={(e) => setSelectedVendedorId(e.target.value)}
      >
        <option value="">Toda la empresa</option>
        {staffList.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
      </select>
    </div>
  );

  const botonColapsar = (
    <button
      type="button"
      onClick={alternarColapsado}
      title={colapsado ? 'Mostrar el flujo de trabajo' : 'Minimizar el flujo de trabajo'}
      className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
    >
      {colapsado ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
    </button>
  );

  if (colapsado) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Flujo de trabajo</span>
        {selectorVendedor}
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {[ingresadas, enProduccion, porRetirar, verificacion, creditos, impagas].map(c => (
            <span key={c.title} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c.bgColor} ${c.borderColor} ${c.textColor}`}>
              {c.title} <span className="font-black">{c.value}</span>
            </span>
          ))}
        </div>
        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Activas: <span className="font-black text-base">{totalActivas}</span></span>
        {botonColapsar}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="hidden xl:grid" style={{ gridTemplateColumns: COLUMNAS_FLUJO }}>
        <div className="flex items-center min-w-0 pr-4" style={{ gridColumn: '1 / 4', gridRow: 1 }}>{selectorVendedor}</div>

        <div style={{ gridColumn: 5, gridRow: 1 }}><TarjetaEtapa card={creditos} index={6} compacta /></div>
        <div className="flex items-center justify-center" style={{ gridColumn: 6, gridRow: 1 }} title="Un crédito vencido pasa a Impagas; con una prórroga vuelve a Créditos">
          <ArrowLeftRight className="h-5 w-5 text-pink-500" strokeWidth={2.5} />
        </div>
        <div style={{ gridColumn: 7, gridRow: 1 }}><TarjetaEtapa card={impagas} index={7} compacta /></div>

        <div className="flex items-stretch gap-2 pl-4" style={{ gridColumn: '9 / 12', gridRow: 1 }}>
          <div className="flex-1 min-w-0"><TarjetaEtapa card={activas} index={8} compacta /></div>
          {botonColapsar}
        </div>

        {/* Con saldo / Pagada y la ruta de Venta Corta por arriba */}
        <div className="relative h-16" style={{ gridColumn: '1 / 12', gridRow: 2 }}>
          <div className="absolute top-0 bottom-0 w-0 border-l-2 border-pink-400 -translate-x-1/2" style={{ left: centro(2) }} title="Se entrega a crédito o con saldo pendiente" />
          <ArrowUp className="absolute -top-1 h-4 w-4 text-pink-500 -translate-x-1/2" strokeWidth={3} style={{ left: centro(2) }} />
          <div className="absolute top-3 -translate-x-1/2" style={{ left: centro(2) }}><Chip className="border-pink-200 text-pink-600">Con saldo</Chip></div>

          <div className="absolute top-0 bottom-0 w-0 border-l-2 border-pink-400 -translate-x-1/2" style={{ left: centro(3) }} title="Al cobrar el saldo, pasa a verificación" />
          <ArrowDown className="absolute -bottom-1 h-4 w-4 text-pink-500 -translate-x-1/2" strokeWidth={3} style={{ left: centro(3) }} />
          <div className="absolute top-3 -translate-x-1/2" style={{ left: centro(3) }}><Chip className="border-pink-200 text-pink-600">Pagada</Chip></div>

          <div title="Venta Corta: no pasa por Producción ni por Retirar; al cerrarla va a Verificación (pago no efectivo) o directo a Finalizar (efectivo)">
            <div className="absolute bottom-1 h-6 border-l-2 border-t-2 border-r-2 rounded-t-lg border-dashed border-violet-400" style={{ left: centro(0), width: `calc(3 * (${ANCHO_TARJETA} + 2rem) - 1rem)` }} />
            <div className="absolute -bottom-0.5 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-violet-500" style={{ left: `calc(${centro(3)} - 1rem - 7px)` }} />
            <div className="absolute bottom-[1.1rem] -translate-x-1/2" style={{ left: centro(1) }}><Chip className="border-violet-200 text-violet-600"><Zap className="h-3 w-3" /> Venta Corta</Chip></div>
          </div>
        </div>

        <div style={{ gridColumn: 1, gridRow: 3 }}><TarjetaEtapa card={ingresadas} index={0} /></div>
        <div style={{ gridColumn: 2, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 3, gridRow: 3 }}><TarjetaEtapa card={enProduccion} index={1} /></div>
        <div style={{ gridColumn: 4, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 5, gridRow: 3 }}><TarjetaEtapa card={porRetirar} index={2} /></div>
        <div style={{ gridColumn: 6, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 7, gridRow: 3 }}><TarjetaEtapa card={verificacion} index={3} /></div>
        <div style={{ gridColumn: 8, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 9, gridRow: 3 }}><TarjetaAccion accion={finalizar} index={4} onClick={alFinalizar} /></div>
        <div style={{ gridColumn: 10, gridRow: 3 }} className="flex"><Flecha /></div>
        <div style={{ gridColumn: 11, gridRow: 3 }}><TarjetaAccion accion={archivar} index={5} onClick={alArchivar} /></div>

        {/* Pago en efectivo: de Por Retirar (y de la Venta Corta) directo a Finalizar */}
        <div className="relative h-10" style={{ gridColumn: '1 / 12', gridRow: 4 }} title="Pagos en efectivo: no necesitan verificación, pasan directo a Finalizar">
          <div className={`absolute top-0 h-5 border-b-2 border-l-2 rounded-bl-xl border-dashed border-violet-400`} style={tramo(0, 2)} />
          <div className={`absolute top-0 h-5 border-b-2 border-l-2 border-r-2 rounded-b-xl border-dashed border-blue-400`} style={tramo(2, 4)} />
          <div className="absolute -top-0.5 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-blue-400" style={{ left: `calc(${centro(4)} - 5px)` }} />
          <div className="absolute top-2.5 -translate-x-1/2" style={{ left: centro(1) }}><Chip className="border-violet-200 text-violet-600"><Zap className="h-3 w-3" /> Venta Corta en efectivo</Chip></div>
          <div className="absolute top-2.5 -translate-x-1/2" style={{ left: centro(3) }}><Chip className="border-blue-200 text-blue-700"><Banknote className="h-3.5 w-3.5" /> Pago en Efectivo</Chip></div>
        </div>
      </div>

      <div className="xl:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {selectorVendedor || <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Flujo de trabajo</span>}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap">Órdenes activas: {totalActivas}</span>
            {botonColapsar}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[ingresadas, enProduccion, porRetirar, verificacion, creditos, impagas].map((card, i) => (
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
