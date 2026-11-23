import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Building2, Image as ImageIcon, Palette, Percent, Save, Loader2, Upload, RotateCcw, Check, AlertTriangle, Clock, Blocks, Package, TrendingUp, LogIn, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EMPRESA_POR_DEFECTO, MONEDAS, TEMAS, INTERVALOS_ENTREGA, MODULOS, completarEmpresa, guardarEmpresa, previsualizarEmpresa, imagenADataUrl, normalizarDominio, moduloEnPlan, esLogoDeTexto, esInstanciaADR } from '@/utils/empresa';

const ICONO_MODULO = { inventario: Package, comisiones: TrendingUp };
import { listaDeHorarios } from '@/utils/horariosEntrega';

// 🔧 NUEVO (23-oct): módulo "Configuración de la Empresa" (solo Administrador).
// Todo lo de aquí se guarda en configuracion_global (fila id = 1): los datos de la empresa en la columna `empresa` (jsonb)
// y el IVA en `iva_porcentaje` (la misma columna que ya usaban las órdenes y cotizaciones).
const CAMPOS = [
    { clave: 'nombre', etiqueta: 'Nombre comercial / Razón social', placeholder: 'Ej: MI IMPRENTA S.A.S.' },
    { clave: 'ruc', etiqueta: 'RUC / RIT', placeholder: 'Ej: 0990000000001' },
    { clave: 'direccion', etiqueta: 'Dirección', placeholder: 'Calle, número, ciudad, provincia' },
    { clave: 'telefono', etiqueta: 'Teléfono(s)', placeholder: 'Ej: 098 265 7066 - 099 076 1566' },
    { clave: 'correo', etiqueta: 'Correo', placeholder: 'Ej: ventas@empresa.com' },
    { clave: 'redes', etiqueta: 'Redes sociales / Página web', placeholder: 'Ej: @miimprenta' },
];

const dosDigitos = (n) => String(n).padStart(2, '0');
const fechaEjemplo = () => { const d = new Date(); return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}`; };
// Clave de acceso de muestra con el mismo armado del SRI (49 dígitos): fecha, tipo 01, RUC, ambiente, serie, secuencial, código y emisión.
const claveDeEjemplo = (ruc) => {
    const d = new Date();
    const rucDigitos = String(ruc || '').replace(/\D/g, '').padStart(13, '0').slice(-13);
    return `${dosDigitos(d.getDate())}${dosDigitos(d.getMonth() + 1)}${d.getFullYear()}01${rucDigitos}20010010000000011234567810`;
};
const ETIQUETA_VISTA = "text-xs font-bold uppercase tracking-wider text-slate-400 mb-2";

const ConfiguracionEmpresa = () => {
    const { toast } = useToast();
    const [form, setForm] = useState(completarEmpresa(null));
    const [iva, setIva] = useState(15);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [faltaColumna, setFaltaColumna] = useState(false);
    const [hayCambios, setHayCambios] = useState(false);
    const hayCambiosRef = useRef(false);
    const inputLogo = useRef(null);
    const inputFavicon = useRef(null);
    const inputFondo = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.from('configuracion_global').select('*').eq('id', 1).maybeSingle();
                if (error) throw error;
                if (data) {
                    setFaltaColumna(!Object.prototype.hasOwnProperty.call(data, 'empresa'));
                    setForm(completarEmpresa(data.empresa));
                    if (data.iva_porcentaje !== undefined && data.iva_porcentaje !== null) setIva(data.iva_porcentaje);
                }
            } catch (e) {
                console.error(e);
                toast({ title: 'Error', description: 'No se pudo cargar la configuración de la empresa.', variant: 'destructive' });
            } finally {
                setCargando(false);
            }
        })();
        // Si sale de la pantalla sin guardar, el sistema vuelve a lo que estaba guardado (la vista previa no queda pegada).
        return () => { if (hayCambiosRef.current) previsualizarEmpresa(null); };
    }, []);

    const cambiar = (clave, valor) => {
        const nuevo = { ...form, [clave]: valor };
        setForm(nuevo);
        setHayCambios(true);
        hayCambiosRef.current = true;
        // El color, el logo y el nombre se ven al instante en el menú; se confirman con "Guardar cambios".
        if (clave === 'color' || clave === 'logo' || clave === 'favicon' || clave === 'nombre') previsualizarEmpresa(nuevo);
    };

    const subirImagen = async (e, clave) => {
        const archivo = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!archivo) return;
        try {
            const dataUrl = clave === 'favicon' ? await imagenADataUrl(archivo, 64, 64)
                : clave === 'loginFondo' ? await imagenADataUrl(archivo, 1600, 1100, 'image/jpeg')
                : await imagenADataUrl(archivo, 800, 400);
            if (dataUrl.length > 1500000) {
                toast({ title: 'Imagen muy pesada', description: 'Use una imagen más liviana (PNG o JPG de menos de 1 MB).', variant: 'destructive' });
                return;
            }
            cambiar(clave, dataUrl);
        } catch (err) {
            toast({ title: 'Imagen no válida', description: err.message, variant: 'destructive' });
        }
    };

    const guardar = async () => {
        if (!String(form.nombre || '').trim()) { toast({ title: 'Falta el nombre', description: 'El nombre comercial es obligatorio.', variant: 'destructive' }); return; }
        const ivaNum = Number(iva);
        if (Number.isNaN(ivaNum) || ivaNum < 0 || ivaNum > 100) { toast({ title: 'IVA no válido', description: 'Escriba un porcentaje entre 0 y 100.', variant: 'destructive' }); return; }
        if (!form.horaInicioEntrega || !form.horaFinEntrega || form.horaFinEntrega <= form.horaInicioEntrega) { toast({ title: 'Horario de entregas no válido', description: 'La hora de cierre debe ser después de la hora de apertura.', variant: 'destructive' }); return; }
        setGuardando(true);
        try {
            await guardarEmpresa(form, ivaNum);
            setHayCambios(false);
            hayCambiosRef.current = false;
            toast({ title: '✅ Configuración guardada', description: 'Los cambios ya se ven en el sistema y en los documentos impresos.' });
        } catch (e) {
            console.error(e);
            const sinColumna = String(e?.message || '').includes('empresa');
            toast({ title: 'No se pudo guardar', description: sinColumna ? 'Falta el ajuste de la base de datos para este módulo. Avise al soporte técnico.' : 'Revise su conexión e intente otra vez.', variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    if (cargando) return <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;

    const moneda = MONEDAS.find(m => m.codigo === form.moneda) || MONEDAS[0];

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in space-y-8 p-4 pb-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Configuración de la Empresa</h2>
                    <p className="text-slate-500">Logo, datos comerciales, colores del sistema, IVA y moneda. Se aplican en todo el sistema y en los documentos impresos.</p>
                </div>
                <Button onClick={guardar} disabled={guardando || faltaColumna} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[170px] h-11">
                    {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Guardar cambios</>}
                </Button>
            </div>

            {faltaColumna && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-4 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>Este módulo todavía no está activado en la base de datos. Puede revisar las opciones, pero no se guardarán hasta que el soporte técnico haga el ajuste.</span>
                </div>
            )}
            {hayCambios && !faltaColumna && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 text-sm font-medium">Hay cambios sin guardar. Lo que ve en el menú es una vista previa.</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. LOGO Y FAVICON */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><ImageIcon className="h-5 w-5" /> Logo y favicon</CardTitle>
                        <CardDescription>El logo sale en el inicio de sesión, el menú y los documentos impresos. El favicon es el ícono de la pestaña del navegador.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-40 h-24 border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-white p-2 shrink-0">
                                <img src={form.logo} alt="Logo de la empresa" className="max-h-full max-w-full object-contain" />
                            </div>
                            <div className="space-y-2">
                                <input ref={inputLogo} type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e, 'logo')} />
                                <Button type="button" variant="outline" onClick={() => inputLogo.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Subir logo</Button>
                                {form.logo !== EMPRESA_POR_DEFECTO.logo && !esLogoDeTexto(form.logo) && (
                                    <Button type="button" variant="ghost" onClick={() => cambiar('logo', EMPRESA_POR_DEFECTO.logo)} className="gap-2 text-slate-500"><RotateCcw className="h-4 w-4" /> {esInstanciaADR ? 'Usar el logo original' : 'Quitar logo'}</Button>
                                )}
                                <p className="text-xs text-slate-400">PNG con fondo transparente se ve mejor.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-white shrink-0">
                                {form.favicon ? <img src={form.favicon} alt="Favicon" className="h-8 w-8 object-contain" /> : <span className="text-[10px] text-slate-400 text-center leading-tight">Sin<br />favicon</span>}
                            </div>
                            <div className="space-y-2">
                                <input ref={inputFavicon} type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e, 'favicon')} />
                                <Button type="button" variant="outline" onClick={() => inputFavicon.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Subir favicon</Button>
                                {form.favicon && <Button type="button" variant="ghost" onClick={() => cambiar('favicon', '')} className="gap-2 text-slate-500"><RotateCcw className="h-4 w-4" /> Quitar</Button>}
                                <p className="text-xs text-slate-400">Imagen cuadrada (se ajusta a 64×64).</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. TEMA DE COLORES */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><Palette className="h-5 w-5" /> Color del sistema</CardTitle>
                        <CardDescription>Cambia el fondo del menú lateral (en el tono oscuro del color), los botones principales y los destacados. Se ve al instante; se confirma con "Guardar cambios".</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {TEMAS.map(tema => {
                                const activo = form.color === tema.id;
                                return (
                                    <button key={tema.id} type="button" onClick={() => cambiar('color', tema.id)} aria-pressed={activo}
                                        className={`flex items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition ${activo ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                                        <span className="flex -space-x-2 shrink-0">
                                            <span className="h-8 w-8 rounded-full border-2 border-white" style={{ backgroundColor: tema.menu }} title="Menú lateral" />
                                            <span className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: tema.principal[6] }}>
                                                {activo && <Check className="h-4 w-4 text-white" />}
                                            </span>
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700">{tema.nombre}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-400 mt-4">Los colores de aviso (rojo para errores, verde para pagos, ámbar para pendientes) no cambian.</p>
                    </CardContent>
                </Card>

                {/* INICIO DE SESIÓN */}
                <Card className="border-slate-200 shadow-md lg:col-span-2">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><LogIn className="h-5 w-5" /> Pantalla de inicio de sesión</CardTitle>
                        <CardDescription>La foto del panel izquierdo y el dominio que se ve junto al usuario. Los botones y detalles toman el color del sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Foto de fondo (panel izquierdo)</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-40 h-24 rounded-lg overflow-hidden border border-slate-300 shrink-0 flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--tema-menu))' }}>
                                            {form.loginFondo ? <img src={form.loginFondo} alt="Foto de fondo del inicio de sesión" className="h-full w-full object-cover" /> : <span className="text-[10px] text-white/70 text-center px-2 leading-tight">Sin foto: se usa el color del sistema</span>}
                                        </div>
                                        <div className="space-y-2">
                                            <input ref={inputFondo} type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e, 'loginFondo')} />
                                            <Button type="button" variant="outline" onClick={() => inputFondo.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Subir foto</Button>
                                            {form.loginFondo && <Button type="button" variant="ghost" onClick={() => cambiar('loginFondo', '')} className="gap-2 text-slate-500"><RotateCcw className="h-4 w-4" /> Quitar</Button>}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">Foto horizontal (por ejemplo 1600 × 1000). Se oscurece con el color del sistema para que el texto se lea bien.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Dominio de usuario</label>
                                    <Input value={form.dominioUsuario} placeholder="Ej: @miempresa.com" maxLength={60} onChange={(e) => cambiar('dominioUsuario', e.target.value)} />
                                    <p className="text-xs text-slate-400">Es el texto guía que se ve junto al usuario al iniciar sesión. No cambia las cuentas: cada persona sigue entrando con su mismo usuario y contraseña. Vacío = no se muestra.</p>
                                </div>
                            </div>

                            <div>
                                <p className={ETIQUETA_VISTA}>Así se verá el inicio de sesión</p>
                                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-sm grid grid-cols-2 aspect-[16/10] bg-slate-50">
                                    <div className="relative overflow-hidden text-white p-4 flex flex-col justify-between" style={{ backgroundColor: 'rgb(var(--tema-menu))' }}>
                                        {form.loginFondo && <img src={form.loginFondo} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                                        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgb(var(--tema-menu) / 0.97) 0%, rgb(var(--tema-menu) / 0.86) 50%, rgb(var(--tema-menu) / 0.5) 100%)' }} />
                                        <div className="relative">
                                            <img src={form.logo} alt="" className="h-6 max-w-[110px] object-contain object-left brightness-0 invert" />
                                            <div className="mt-3 h-0.5 w-6 rounded-full bg-blue-500" />
                                            <p className="mt-3 text-[15px] font-extrabold leading-tight">Gestión inteligente<br />para tu <span className="text-blue-400">negocio</span></p>
                                        </div>
                                        <p className="relative text-[8px] text-white/60 border-t border-white/15 pt-1.5">Powered by <span className="font-semibold text-white">ADR Print System</span></p>
                                    </div>
                                    <div className="flex items-center justify-center p-3">
                                        <div className="w-full bg-white rounded-lg shadow border border-slate-100 p-3 space-y-2">
                                            <img src={form.logo} alt="" className="h-7 max-w-full object-contain mx-auto mb-1" />
                                            <div className="h-6 rounded border border-slate-200 bg-slate-50 flex items-center gap-1 px-1.5 text-[8px] text-slate-400">
                                                <User className="h-3 w-3 shrink-0" /><span className="flex-1 truncate">juanperez</span><span className="truncate">{normalizarDominio(form.dominioUsuario)}</span>
                                            </div>
                                            <div className="h-6 rounded border border-slate-200 bg-slate-50 flex items-center gap-1 px-1.5 text-[8px] text-slate-400"><Lock className="h-3 w-3 shrink-0" />••••••••</div>
                                            <div className="h-6 rounded bg-blue-600 text-white text-[8px] font-semibold flex items-center justify-center">Iniciar Sesión</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. DATOS COMERCIALES Y FISCALES */}
                <Card className="border-slate-200 shadow-md lg:col-span-2">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><Building2 className="h-5 w-5" /> Datos comerciales y fiscales</CardTitle>
                        <CardDescription>Salen en las cotizaciones, las órdenes de producción, el Libro Diario y los reportes de inventario impresos.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                {CAMPOS.map(c => (
                                    <div key={c.clave} className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">{c.etiqueta}</label>
                                        <Input value={form[c.clave]} placeholder={c.placeholder} maxLength={200} onChange={(e) => cambiar(c.clave, e.target.value)} />
                                    </div>
                                ))}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Términos y condiciones (pie de página de los documentos)</label>
                                    <textarea value={form.pieDocumentos} maxLength={600} rows={4} onChange={(e) => cambiar('pieDocumentos', e.target.value)}
                                        placeholder="Ej: Los trabajos no retirados en 30 días no tienen reclamo. Precios incluyen diseño básico."
                                        className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                                    <p className="text-xs text-slate-400">Opcional. Si lo deja vacío, los documentos se imprimen como siempre.</p>
                                </div>
                            </div>

                            {/* Vista previa de los documentos impresos */}
                            <div className="space-y-6">
                            <div>
                                <p className={ETIQUETA_VISTA}>Así se verá el encabezado de una cotización</p>
                                <div className="border border-slate-300 rounded-lg bg-white p-4 shadow-sm">
                                    <div className="grid grid-cols-[1fr_2fr] gap-4 items-center text-[11px] text-black">
                                        <div className="flex items-center justify-center"><img src={form.logo} alt="Logo" className="max-h-[80px] max-w-full object-contain" /></div>
                                        <div className="border border-black rounded-xl p-3 text-center">
                                            <div className="font-bold text-[14px] uppercase tracking-wider mb-1 break-words">{form.nombre || '—'}</div>
                                            <div className="leading-tight text-slate-800 uppercase break-words">{form.direccion}</div>
                                            <div className="leading-tight text-slate-800 mb-2 break-words">
                                                {form.telefono && <><span className="font-bold">Tel:</span> {form.telefono}</>}
                                                {form.telefono && form.correo && <> &nbsp;|&nbsp; </>}
                                                {form.correo && <><span className="font-bold">Email:</span> {form.correo}</>}
                                            </div>
                                            <div className="border-t border-black pt-2 flex justify-around items-center gap-2">
                                                <span><span className="font-bold">R.U.C.:</span> {form.ruc}</span>
                                                <span className="font-black tracking-widest">PROFORMA</span>
                                            </div>
                                        </div>
                                    </div>
                                    {form.pieDocumentos && <p className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-600 whitespace-pre-line">{form.pieDocumentos}</p>}
                                </div>
                            </div>

                            <div>
                                <p className={ETIQUETA_VISTA}>Así se verá el encabezado de una orden de producción</p>
                                <div className="border border-slate-300 rounded-lg bg-white p-4 shadow-sm text-black">
                                    <div className="flex justify-between items-start gap-4 border-b-2 border-black pb-3">
                                        <div className="w-1/2 min-w-0">
                                            <img src={form.logo} alt="Logo" className="w-32 max-h-16 object-contain object-left mb-2" />
                                            <div className="text-[9px] text-slate-700 leading-tight font-medium break-words">
                                                <p className="font-bold text-black text-[10px] mb-0.5">RUC: {form.ruc}</p>
                                                {form.direccion && <p>📍 {form.direccion}</p>}
                                                {form.telefono && <p>📞 Tel: {form.telefono}</p>}
                                                {form.redes && <p>🌐 Redes: {form.redes}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right w-1/2">
                                            <p className="text-[13px] font-black tracking-widest uppercase text-slate-900">Orden de Producción</p>
                                            <p className="text-[12px] font-bold text-slate-800">N° ORDEN: 0000201</p>
                                            <p className="text-[9px] font-bold text-slate-700 mt-1">FECHA INGRESO: {fechaEjemplo()}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 border-2 border-black rounded-md p-2 bg-gray-50 grid grid-cols-2 gap-2 text-[9px]">
                                        <span><span className="font-bold">CLIENTE:</span> <span className="font-black uppercase">Cliente de ejemplo</span></span>
                                        <span><span className="font-bold">RUC/C.I.:</span> CONSUMIDOR FINAL</span>
                                    </div>
                                    {form.pieDocumentos && <p className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-600 whitespace-pre-line">{form.pieDocumentos}</p>}
                                </div>
                            </div>

                            <div>
                                <p className={ETIQUETA_VISTA}>Así se verá la factura electrónica (RIDE)</p>
                                {(() => {
                                    const clave = claveDeEjemplo(form.ruc);
                                    const pIva = Number(iva) || 0;
                                    const base = 24;
                                    const montoIva = Math.round(base * pIva) / 100;
                                    return (
                                        <div className="border border-slate-300 rounded-lg bg-white p-4 shadow-sm text-black text-[9px] leading-tight">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-2 min-w-0">
                                                    <div className="h-16 flex items-center justify-center"><img src={form.logo} alt="Logo" className="max-h-full max-w-full object-contain" /></div>
                                                    <div className="border border-black rounded-md p-2 space-y-1 flex-1 break-words">
                                                        <p className="font-bold text-[11px] uppercase">{form.nombre || '—'}</p>
                                                        {form.direccion && <p><span className="font-bold">Dirección Matriz:</span> {form.direccion}</p>}
                                                        {form.telefono && <p><span className="font-bold">Teléfono:</span> {form.telefono}</p>}
                                                        {form.correo && <p><span className="font-bold">Correo:</span> {form.correo}</p>}
                                                    </div>
                                                </div>
                                                <div className="border border-black rounded-md p-2 space-y-1 min-w-0">
                                                    <p className="text-[11px]"><span className="font-bold">R.U.C.:</span> {form.ruc}</p>
                                                    <p className="text-[14px] font-black tracking-widest">FACTURA</p>
                                                    <p><span className="font-bold">No.</span> 001-001-000000001</p>
                                                    <p className="font-bold">NÚMERO DE AUTORIZACIÓN</p>
                                                    <p className="font-mono text-[8px] break-all">{clave}</p>
                                                    <p><span className="font-bold">AMBIENTE:</span> PRODUCCIÓN</p>
                                                    <p><span className="font-bold">EMISIÓN:</span> NORMAL</p>
                                                    <p className="font-bold">CLAVE DE ACCESO</p>
                                                    <div className="h-8 w-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 3px, #000 3px 4px, transparent 4px 7px, #000 7px 8px, transparent 8px 10px)' }} />
                                                    <p className="font-mono text-[8px] break-all text-center">{clave}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 border border-black rounded-md p-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                                                <p><span className="font-bold">Razón Social / Nombres y Apellidos:</span> CLIENTE DE EJEMPLO</p>
                                                <p><span className="font-bold">Identificación:</span> 9999999999999</p>
                                                <p><span className="font-bold">Fecha de Emisión:</span> {fechaEjemplo()}</p>
                                            </div>
                                            <table className="mt-2 w-full border-collapse">
                                                <thead><tr className="bg-gray-100">{['Cant.', 'Descripción', 'P. Unitario', 'Total'].map(t => <th key={t} className="border border-black px-1 py-0.5 text-left font-bold">{t}</th>)}</tr></thead>
                                                <tbody><tr><td className="border border-black px-1 py-0.5">1</td><td className="border border-black px-1 py-0.5">LONA 2 × 1 M</td><td className="border border-black px-1 py-0.5 text-right">{base.toFixed(2)}</td><td className="border border-black px-1 py-0.5 text-right">{base.toFixed(2)}</td></tr></tbody>
                                            </table>
                                            <div className="mt-2 ml-auto w-1/2">
                                                {[[`SUBTOTAL ${pIva}%`, base], [`IVA ${pIva}%`, montoIva], ['VALOR TOTAL', base + montoIva]].map(([t, v]) => (
                                                    <div key={t} className="flex justify-between border border-black border-t-0 first:border-t px-1 py-0.5"><span className="font-bold">{t}</span><span>{v.toFixed(2)}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <p className="text-[10px] text-slate-400 mt-1">Ejemplo con datos ficticios. La factura electrónica está en desarrollo: el diseño final puede cambiar un poco.</p>
                            </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. PARÁMETROS GENERALES */}
                <Card className="border-slate-200 shadow-md lg:col-span-2">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><Percent className="h-5 w-5" /> Parámetros generales</CardTitle>
                        <CardDescription>El IVA se aplica a las órdenes y cotizaciones NUEVAS; las ya creadas conservan el IVA con que se hicieron.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Porcentaje de IVA (%)</label>
                                <Input type="number" min="0" max="100" step="any" value={iva} onChange={(e) => { setIva(e.target.value); setHayCambios(true); }} onWheel={(e) => e.currentTarget.blur()} className="text-lg font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Moneda predeterminada</label>
                                <select value={form.moneda} onChange={(e) => cambiar('moneda', e.target.value)} className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    {MONEDAS.map(m => <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.nombre} ({m.simbolo})</option>)}
                                </select>
                                <p className="text-xs text-slate-400">Ejemplo: {new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda.codigo }).format(1250.5)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. HORARIO DE ENTREGAS */}
                <Card className="border-slate-200 shadow-md lg:col-span-2">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><Clock className="h-5 w-5" /> Horario de entregas</CardTitle>
                        <CardDescription>Las horas que se ofrecen al elegir la fecha de entrega de una orden y en "Ver Disponibilidad". Las órdenes ya creadas conservan su hora.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Primera entrega del día</label>
                                <Input type="time" value={form.horaInicioEntrega} onChange={(e) => cambiar('horaInicioEntrega', e.target.value)} className="text-lg font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Última entrega del día</label>
                                <Input type="time" value={form.horaFinEntrega} onChange={(e) => cambiar('horaFinEntrega', e.target.value)} className="text-lg font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Cada cuánto</label>
                                <select value={form.intervaloEntrega} onChange={(e) => cambiar('intervaloEntrega', e.target.value)} className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                    {INTERVALOS_ENTREGA.map(i => <option key={i} value={i}>{i === '60' ? 'Cada hora' : `Cada ${i} minutos`}</option>)}
                                </select>
                            </div>
                        </div>
                        {form.horaInicioEntrega && form.horaFinEntrega && form.horaFinEntrega > form.horaInicioEntrega ? (() => {
                            const horas = listaDeHorarios({ inicio: form.horaInicioEntrega, fin: form.horaFinEntrega, intervalo: Number(form.intervaloEntrega) });
                            return <p className="text-xs text-slate-500">Se ofrecerán {horas.length} horarios: {horas[0]}, {horas[1]}{horas.length > 3 ? ' … ' : ', '}{horas[horas.length - 1]}.</p>;
                        })() : (
                            <p className="text-xs font-bold text-red-600">La última entrega debe ser después de la primera.</p>
                        )}
                    </CardContent>
                </Card>

                {/* 6. MÓDULOS DEL SISTEMA */}
                <Card className="border-slate-200 shadow-md lg:col-span-2">
                    <CardHeader className="bg-slate-50 pb-4">
                        <CardTitle className="flex items-center gap-2 text-slate-800"><Blocks className="h-5 w-5" /> Módulos del Sistema</CardTitle>
                        <CardDescription>Enciende solo lo que tu negocio usa. Apagar un módulo no borra nada: sus datos quedan guardados y vuelven a verse al encenderlo.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MODULOS.map(m => {
                            const Icono = ICONO_MODULO[m.id] || Blocks;
                            if (!moduloEnPlan(m.id)) return (
                                <div key={m.id} className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 flex gap-4 items-start">
                                    <div className="p-2.5 rounded-lg shrink-0 bg-slate-200 text-slate-400"><Icono className="h-5 w-5" /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-bold text-slate-500">{m.nombre}</p>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 shrink-0"><Lock className="h-3 w-3" /> No incluido</span>
                                        </div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5 text-slate-400">Disponible en un plan superior</p>
                                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.descripcion}</p>
                                        <p className="text-xs text-slate-600 mt-2 font-medium">Para activarlo, contacta a ADR Print System.</p>
                                    </div>
                                </div>
                            );
                            const activo = form[m.campo] !== 'no';
                            return (
                                <div key={m.id} className={`rounded-xl border-2 p-4 flex gap-4 items-start transition-colors ${activo ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className={`p-2.5 rounded-lg shrink-0 ${activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}><Icono className="h-5 w-5" /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-bold text-slate-800">{m.nombre}</p>
                                            <button
                                                type="button" role="switch" aria-checked={activo} aria-label={`${activo ? 'Apagar' : 'Encender'} ${m.nombre}`}
                                                onClick={() => cambiar(m.campo, activo ? 'no' : 'si')}
                                                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? 'bg-green-500' : 'bg-slate-300'}`}
                                            >
                                                <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
                                            </button>
                                        </div>
                                        <p className={`text-[11px] font-bold uppercase tracking-wide mt-0.5 ${activo ? 'text-green-700' : 'text-slate-500'}`}>{activo ? 'Encendido' : 'Apagado'}</p>
                                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.descripcion}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ConfiguracionEmpresa;
