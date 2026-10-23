import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Building2, Image as ImageIcon, Palette, Percent, Save, Loader2, Upload, RotateCcw, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EMPRESA_POR_DEFECTO, MONEDAS, TEMAS, completarEmpresa, guardarEmpresa, previsualizarEmpresa, imagenADataUrl } from '@/utils/empresa';

// 🔧 NUEVO (23-oct): módulo "Configuración de la Empresa" (solo Administrador).
// Todo lo de aquí se guarda en configuracion_global (fila id = 1): los datos de la empresa en la columna `empresa` (jsonb)
// y el IVA en `iva_porcentaje` (la misma columna que ya usaban las órdenes y cotizaciones).
const CAMPOS = [
    { clave: 'nombre', etiqueta: 'Nombre comercial / Razón social', placeholder: 'Ej: ADRCOMPANY SAS' },
    { clave: 'ruc', etiqueta: 'RUC / RIT', placeholder: 'Ej: 0993397285001' },
    { clave: 'direccion', etiqueta: 'Dirección', placeholder: 'Calle, número, ciudad, provincia' },
    { clave: 'telefono', etiqueta: 'Teléfono(s)', placeholder: 'Ej: 098 265 7066 - 099 076 1566' },
    { clave: 'correo', etiqueta: 'Correo', placeholder: 'Ej: ventas@empresa.com' },
    { clave: 'redes', etiqueta: 'Redes sociales / Página web', placeholder: 'Ej: @graficasadr' },
];

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
            const dataUrl = clave === 'favicon' ? await imagenADataUrl(archivo, 64, 64) : await imagenADataUrl(archivo, 800, 400);
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
                                {form.logo !== EMPRESA_POR_DEFECTO.logo && (
                                    <Button type="button" variant="ghost" onClick={() => cambiar('logo', EMPRESA_POR_DEFECTO.logo)} className="gap-2 text-slate-500"><RotateCcw className="h-4 w-4" /> Usar el logo original</Button>
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
                        <CardDescription>Cambia botones principales, menú y destacados. Se ve al instante; se confirma con "Guardar cambios".</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {TEMAS.map(tema => {
                                const activo = form.color === tema.id;
                                return (
                                    <button key={tema.id} type="button" onClick={() => cambiar('color', tema.id)} aria-pressed={activo}
                                        className={`flex items-center gap-3 rounded-lg border-2 px-3 py-3 text-left transition ${activo ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                                        <span className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: tema.principal[6] }}>
                                            {activo && <Check className="h-4 w-4 text-white" />}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700">{tema.nombre}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-400 mt-4">Los colores de aviso (rojo para errores, verde para pagos, ámbar para pendientes) no cambian.</p>
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

                            {/* Vista previa del encabezado impreso */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Así se verá el encabezado de una cotización</p>
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
            </div>
        </div>
    );
};

export default ConfiguracionEmpresa;
