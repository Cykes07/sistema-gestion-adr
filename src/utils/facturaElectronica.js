// Factura electrónica del SRI (por ahora solo ADR). El navegador habla con la función del servidor "factura-sri";
// nunca con el servicio de facturación directamente.
// En una empresa sin facturación (Carvajal, Demo) la base no tiene `sri_habilitado`: la consulta falla y el botón no aparece.
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export const CORREO_DE_RELLENO = 'sincorreo@gmail.com';

export const llamarFacturacion = async (cuerpo) => {
  const { data, error } = await supabase.functions.invoke('factura-sri', { body: cuerpo });
  if (error) {
    let detalle = null;
    try { detalle = await error.context.json(); } catch (e) { /* sin detalle */ }
    const err = new Error(detalle?.error || 'No se pudo conectar con la facturación electrónica. Intenta de nuevo.');
    err.errores = detalle?.errores || [];
    err.facturaId = detalle?.factura_id || null;
    throw err;
  }
  return data;
};

let pedido = null;
// Una sola consulta por sesión: null = no disponible; si no, { ambiente: 'PRUEBAS' | 'PRODUCCIÓN', firma, ... }.
export const estadoFacturacion = () => {
  if (!pedido) {
    pedido = supabase.rpc('sri_habilitado')
      .then(({ data, error }) => (!error && data === true ? llamarFacturacion({ accion: 'estado' }) : null))
      .catch(() => null);
  }
  return pedido;
};

export const useFacturacion = (activo = true) => {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    estadoFacturacion().then(e => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, [activo]);
  return estado;
};

export const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());
