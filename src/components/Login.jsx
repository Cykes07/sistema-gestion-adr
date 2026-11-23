import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, User, Lock, Eye, EyeOff, LogIn, Headphones, ShoppingCart, Settings, Package, BarChart3 } from 'lucide-react';
import { useEmpresa, moduloActivo } from '@/utils/empresa';

// Dominio con el que se crearon las cuentas. El que se ve junto al usuario sale de Configuración de la Empresa y es solo
// un texto guía: cambiarlo no cambia las cuentas.
const DOMINIO_INTERNO = "@graficasadr.com";

const FUNCIONES = [
  { id: 'ventas', icono: ShoppingCart, titulo: 'Ventas y Cotizaciones', texto: 'Gestiona pedidos de forma rápida y segura.' },
  { id: 'produccion', icono: Settings, titulo: 'Producción', texto: 'Control total de tus órdenes de trabajo.' },
  { id: 'inventario', icono: Package, titulo: 'Inventario', texto: 'Mantén el control de tus materiales.' },
  { id: 'reportes', icono: BarChart3, titulo: 'Reportes', texto: 'Toma mejores decisiones con datos en tiempo real.' },
];

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const empresa = useEmpresa();
  const conInventario = moduloActivo('inventario', empresa);
  const funciones = FUNCIONES.filter(f => f.id !== 'inventario' || conInventario);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const emailCompleto = `${username.trim().split('@')[0]}${DOMINIO_INTERNO}`;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailCompleto,
        password,
      });

      if (authError) throw authError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // Cuentas desactivadas (activo === false) no pueden entrar.
      if (profileData.activo === false) {
        await supabase.auth.signOut();
        toast({
          title: "Cuenta desactivada",
          description: "Esta cuenta ya no tiene acceso al sistema. Contacta al administrador.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      onLogin({
        id: profileData.id,
        name: profileData.full_name || username,
        role: profileData.role
      });

      toast({ title: "Bienvenido", description: `Hola, ${profileData.full_name}` });

    } catch (error) {
      console.error(error);
      toast({
        title: "Error de acceso",
        description: "Usuario o contraseña incorrectos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const campo = "flex items-center h-12 rounded-lg border border-slate-200 bg-slate-50 transition focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20";

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-50">
      {/* Panel izquierdo: foto de Configuración de la Empresa sobre el color oscuro del sistema */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden text-white px-14 xl:px-20 py-12" style={{ backgroundColor: 'rgb(var(--tema-menu))' }}>
        {empresa.loginFondo ? (
          <img src={empresa.loginFondo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-500/25 blur-3xl" />
            <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
          </>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgb(var(--tema-menu) / 0.97) 0%, rgb(var(--tema-menu) / 0.86) 50%, rgb(var(--tema-menu) / 0.5) 100%)' }} />

        <div className="relative">
          <img src={empresa.logo} alt={empresa.nombre} className="h-16 max-w-[280px] object-contain object-left brightness-0 invert" />
          <div className="mt-10 h-1 w-14 rounded-full bg-blue-500" />
          <h1 className="mt-8 text-5xl xl:text-6xl font-extrabold leading-[1.1] tracking-tight">
            Gestión inteligente<br />para tu <span className="text-blue-400">negocio</span>
          </h1>
          <p className="mt-6 text-lg xl:text-xl text-white/75 max-w-md">
            {conInventario ? 'Controla tus ventas, producción e inventario desde un solo lugar.' : 'Controla tus ventas y tu producción desde un solo lugar.'}
          </p>
          <ul className="mt-12 space-y-6">
            {funciones.map(f => {
              const Icono = f.icono;
              return (
                <li key={f.id} className="flex items-center gap-4">
                  <span className="h-12 w-12 shrink-0 rounded-xl border border-white/15 bg-white/10 flex items-center justify-center">
                    <Icono className="h-5 w-5 text-blue-300" />
                  </span>
                  <div>
                    <p className="font-semibold">{f.titulo}</p>
                    <p className="text-sm text-white/65">{f.texto}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative mt-12 pt-5 border-t border-white/15 text-sm text-white/60">
          Powered by <span className="font-semibold text-white">ADR Print System</span>
        </div>
      </aside>

      {/* Panel derecho: formulario */}
      <main className="min-w-0 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-10">
          <img src={empresa.logo} alt={empresa.nombre} className="h-24 w-auto max-w-full object-contain mx-auto mb-10" />

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700">Usuario</label>
              <div className={campo}>
                <User className="ml-3.5 h-5 w-5 text-slate-400 shrink-0" />
                <input
                  id="username"
                  type="text"
                  placeholder="Ej: juanperez"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="flex-1 min-w-0 h-full bg-transparent px-3 text-slate-800 placeholder:text-slate-400 outline-none"
                  required
                />
                {empresa.dominioUsuario && <span className="pr-3.5 text-sm text-slate-400 truncate max-w-[45%] pointer-events-none">{empresa.dominioUsuario}</span>}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">Contraseña</label>
              <div className={campo}>
                <Lock className="ml-3.5 h-5 w-5 text-slate-400 shrink-0" />
                <input
                  id="password"
                  type={verClave ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="flex-1 min-w-0 h-full bg-transparent px-3 text-slate-800 placeholder:text-slate-400 outline-none"
                  required
                />
                <button type="button" onClick={() => setVerClave(v => !v)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="mr-2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  {verClave ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-slate-500 text-center">
            <Headphones className="h-4 w-4 text-slate-400" />
            ¿Problemas para ingresar? <span className="font-semibold text-blue-700">Contacta a soporte técnico.</span>
          </div>
        </div>
        <p className="lg:hidden mt-6 text-xs text-slate-400">Powered by <span className="font-semibold">ADR Print System</span></p>
      </main>
    </div>
  );
};

export default Login;
