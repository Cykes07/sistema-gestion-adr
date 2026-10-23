// 🔧 Configuración de la Empresa (23-oct): datos comerciales, logo, favicon, color del sistema y moneda.
// Se guarda en configuracion_global.empresa (jsonb, fila id = 1). Cualquier pantalla la lee con useEmpresa();
// lo que no se haya configurado usa los valores de ADR que antes estaban escritos a mano en cada pantalla.
import { useSyncExternalStore } from 'react';
import { supabase } from '../supabaseClient';

export const EMPRESA_POR_DEFECTO = {
    nombre: 'ADRCOMPANY SAS',
    ruc: '0993397285001',
    direccion: 'Av. Zenón Macías 306 y calle La Merced, General Villamil (Playas), Guayas, Ecuador',
    telefono: '098 265 7066 - 099 076 1566',
    correo: 'imprenta_milena@hotmail.com',
    redes: '@graficasadr',
    pieDocumentos: '',
    logo: '/logo.png',
    favicon: '',
    color: 'azul',
    moneda: 'USD',
};

export const MONEDAS = [
    { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
    { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
    { codigo: 'COP', nombre: 'Peso colombiano', simbolo: '$' },
    { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/' },
    { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$' },
    { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$' },
];

// Paletas de Tailwind (50 → 950). "azul" es el color original del sistema: con ese tema no se toca nada.
// Cada tema reemplaza las dos familias de color de marca que usa la app: blue (principal) e indigo (acentos).
const P = {
    blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
    indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'],
    red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'],
    rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519'],
    green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16'],
    emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'],
    negro: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#52525b', '#3f3f46', '#27272a', '#18181b', '#09090b', '#000000'],
    purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764'],
    violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'],
    orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'],
    amber: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03'],
};
export const TEMAS = [
    { id: 'azul', nombre: 'Azul (original)', principal: P.blue, acento: P.indigo },
    { id: 'rojo', nombre: 'Rojo', principal: P.red, acento: P.rose },
    { id: 'verde', nombre: 'Verde', principal: P.green, acento: P.emerald },
    { id: 'negro', nombre: 'Negro', principal: P.negro, acento: P.negro },
    { id: 'morado', nombre: 'Morado', principal: P.purple, acento: P.violet },
    { id: 'naranja', nombre: 'Naranja', principal: P.orange, acento: P.amber },
];
const TONOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const hexATriplete = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };
const hexAHsl = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
    }
    return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
};

// Pinta el sistema con el tema elegido (variables CSS que usan las clases blue-* / indigo-*, ver tailwind.config.js).
export const aplicarTema = (colorId) => {
    if (typeof document === 'undefined') return;
    const raiz = document.documentElement.style;
    const tema = TEMAS.find(t => t.id === colorId);
    if (!tema || tema.id === 'azul') {
        TONOS.forEach(t => { raiz.removeProperty(`--tema-blue-${t}`); raiz.removeProperty(`--tema-indigo-${t}`); });
        raiz.removeProperty('--primary'); raiz.removeProperty('--ring');
        return;
    }
    TONOS.forEach((t, i) => {
        raiz.setProperty(`--tema-blue-${t}`, hexATriplete(tema.principal[i]));
        raiz.setProperty(`--tema-indigo-${t}`, hexATriplete(tema.acento[i]));
    });
    raiz.setProperty('--primary', hexAHsl(tema.principal[6]));
    raiz.setProperty('--ring', hexAHsl(tema.principal[6]));
};

const aplicarPestana = (emp) => {
    if (typeof document === 'undefined') return;
    if (emp.nombre) document.title = emp.nombre;
    if (emp.favicon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.removeAttribute('type');
        link.href = emp.favicon;
    }
};

// Une lo guardado con los valores por defecto: un campo vacío del logo/nombre vuelve al de ADR.
export const completarEmpresa = (guardado) => {
    const g = guardado && typeof guardado === 'object' ? guardado : {};
    const out = { ...EMPRESA_POR_DEFECTO };
    Object.keys(EMPRESA_POR_DEFECTO).forEach(k => { if (g[k] !== undefined && g[k] !== null) out[k] = typeof g[k] === 'string' ? g[k] : out[k]; });
    if (!out.logo) out.logo = EMPRESA_POR_DEFECTO.logo;
    if (!out.nombre.trim()) out.nombre = EMPRESA_POR_DEFECTO.nombre;
    if (!MONEDAS.some(m => m.codigo === out.moneda)) out.moneda = 'USD';
    return out;
};

// ---- Almacén compartido (sin Provider: cualquier componente lo lee con useEmpresa) ----
const CLAVE_CACHE = 'empresaConfig';
const leerCache = () => { try { const c = localStorage.getItem(CLAVE_CACHE); return c ? JSON.parse(c) : null; } catch (e) { return null; } };
let guardado = leerCache() || {}; // lo último guardado (para volver atrás desde la vista previa)
let actual = completarEmpresa(guardado);
const suscriptores = new Set();
const suscribir = (fn) => { suscriptores.add(fn); return () => suscriptores.delete(fn); };
const publicar = (emp) => {
    actual = emp;
    aplicarTema(emp.color);
    aplicarPestana(emp);
    suscriptores.forEach(fn => fn());
};
aplicarTema(actual.color);
aplicarPestana(actual);

export const empresaActual = () => actual;
export const useEmpresa = () => useSyncExternalStore(suscribir, empresaActual);

// Para los formateadores de dinero que viven fuera de React (Intl.NumberFormat).
export const monedaActual = () => actual.moneda || 'USD';
export const simboloMoneda = () => (MONEDAS.find(m => m.codigo === monedaActual()) || MONEDAS[0]).simbolo;

// Se llama al abrir la app (también en la pantalla de inicio de sesión: la configuración es de lectura pública).
export const cargarEmpresa = async () => {
    try {
        const { data, error } = await supabase.from('configuracion_global').select('*').eq('id', 1).maybeSingle();
        if (error || !data) return actual;
        guardado = data.empresa && typeof data.empresa === 'object' ? data.empresa : {};
        const emp = completarEmpresa(guardado);
        try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(guardado)); } catch (e) { /* sin espacio: se usa sin caché */ }
        publicar(emp);
        return emp;
    } catch (e) {
        return actual;
    }
};

// Vista previa en vivo desde el módulo (no guarda nada). Con null vuelve a lo guardado.
export const previsualizarEmpresa = (borrador) => publicar(completarEmpresa(borrador || guardado));

export const guardarEmpresa = async (datos, ivaPorcentaje) => {
    const limpio = {};
    Object.keys(EMPRESA_POR_DEFECTO).forEach(k => { limpio[k] = typeof datos[k] === 'string' ? datos[k].trim() : EMPRESA_POR_DEFECTO[k]; });
    const cambios = { empresa: limpio };
    if (ivaPorcentaje !== undefined && ivaPorcentaje !== '' && !Number.isNaN(Number(ivaPorcentaje))) cambios.iva_porcentaje = Number(ivaPorcentaje);
    const { data, error } = await supabase.from('configuracion_global').update(cambios).eq('id', 1).select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
        const { error: errInsert } = await supabase.from('configuracion_global').insert([{ id: 1, ...cambios }]);
        if (errInsert) throw errInsert;
    }
    guardado = limpio;
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(limpio)); } catch (e) { /* sin espacio: se usa sin caché */ }
    publicar(completarEmpresa(limpio));
};

// Achica la imagen en el navegador antes de guardarla (se guarda como texto dentro de la configuración).
export const imagenADataUrl = (archivo, anchoMax, altoMax) => new Promise((resolve, reject) => {
    if (!archivo || !String(archivo.type).startsWith('image/')) { reject(new Error('El archivo no es una imagen.')); return; }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
        img.onload = () => {
            const escala = Math.min(1, anchoMax / img.width, altoMax / img.height);
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.max(1, Math.round(img.width * escala));
            lienzo.height = Math.max(1, Math.round(img.height * escala));
            lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
            resolve(lienzo.toDataURL('image/png'));
        };
        img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
});
