import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Plus, Save, Trash2, Loader2, X, DollarSign, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import ComponentesInventarioEditor from './ComponentesInventarioEditor';
import { useModulo } from '@/utils/empresa';

// Quién puede crear o corregir productos del catálogo (desde el Catálogo o desde el desglose de una orden).
export const puedeEditarCatalogo = (user) => user?.role === 'Administrador' || user?.role === 'Producción';

const formularioVacio = () => ({
    codigo: '', categoria: '', nombre: '', descripcion: '', observaciones: '',
    venta_minima: '0',
    precio_minimo: '',
    precios_escalonados: [{ cantidad: '0', precio: '', es_base: true }],
    tienePrecioDistribuidor: false,
    precios_distribuidor: [],
    es_por_metro: false,
    componentes_inventario: []
});

const formularioDesde = (item) => {
    let loadedTiers = item.precios_escalonados || [];
    if (!loadedTiers.some(t => Number(t.precio) === Number(item.precio))) {
         loadedTiers = [{ cantidad: item.venta_minima || 0, precio: item.precio || 0, es_base: true }, ...loadedTiers];
    } else {
         let foundBase = false;
         loadedTiers = loadedTiers.map(t => {
             if (!foundBase && Number(t.precio) === Number(item.precio)) {
                 foundBase = true;
                 return { ...t, es_base: true };
             }
             return { ...t, es_base: false };
         });
    }
    if (loadedTiers.length > 0 && !loadedTiers.some(t => t.es_base)) loadedTiers[0].es_base = true;

    let loadedDistTiers = item.precios_distribuidor || [];
    const hasDistribuidorConfig = Number(item.precio_distribuidor) > 0 || loadedDistTiers.length > 0;
    
    if (hasDistribuidorConfig) {
         if (!loadedDistTiers.some(t => Number(t.precio) === Number(item.precio_distribuidor))) {
              loadedDistTiers = [{ cantidad: item.venta_minima || 0, precio: item.precio_distribuidor || 0, es_base: true }, ...loadedDistTiers];
         } else {
              let foundDistBase = false;
              loadedDistTiers = loadedDistTiers.map(t => {
                  if (!foundDistBase && Number(t.precio) === Number(item.precio_distribuidor)) {
                      foundDistBase = true;
                      return { ...t, es_base: true };
                  }
                  return { ...t, es_base: false };
              });
         }
         if (loadedDistTiers.length > 0 && !loadedDistTiers.some(t => t.es_base)) loadedDistTiers[0].es_base = true;
    }

    return { 
        codigo: item.codigo || '', categoria: item.categoria || '', nombre: item.nombre, 
        descripcion: item.descripcion || '', observaciones: item.observaciones || '',
        venta_minima: item.venta_minima !== null && item.venta_minima !== undefined ? Math.floor(item.venta_minima) : 0, 
        precio_minimo: item.precio_minimo || '',
        precios_escalonados: loadedTiers,
        tienePrecioDistribuidor: hasDistribuidorConfig,
        precios_distribuidor: loadedDistTiers,
        es_por_metro: item.es_por_metro || false,
        componentes_inventario: Array.isArray(item.componentes_inventario) ? item.componentes_inventario : []
    };
};

// Modal "Crear / Editar Producto" del catálogo. item = fila de catalogo_productos (o null para crear uno nuevo).
const ProductoCatalogoModal = ({ item = null, onClose, onSaved, capa = 'z-50' }) => {
  const { toast } = useToast();
  const conInventario = useModulo('inventario');
  const editingItem = item;
  const [formData, setFormData] = useState(() => (item ? formularioDesde(item) : formularioVacio()));
  const [saving, setSaving] = useState(false);

  const addTier = () => { 
      setFormData(prev => ({ 
          ...prev, 
          precios_escalonados: [...prev.precios_escalonados, { cantidad: '', precio: '', es_base: prev.precios_escalonados.length === 0 }] 
      })); 
  };
  const updateTier = (index, field, value) => {
      const newTiers = [...formData.precios_escalonados];
      newTiers[index][field] = value; 
      setFormData({ ...formData, precios_escalonados: newTiers });
  };
  const removeTier = (index) => { 
      setFormData({ ...formData, precios_escalonados: formData.precios_escalonados.filter((_, i) => i !== index) }); 
  };
  const setBasePublico = (index) => {
      setFormData(prev => ({
          ...prev,
          precios_escalonados: prev.precios_escalonados.map((t, i) => ({ ...t, es_base: i === index }))
      }));
  };

  const addDistTier = () => { 
      setFormData(prev => ({ 
          ...prev, 
          precios_distribuidor: [...prev.precios_distribuidor, { cantidad: '', precio: '', es_base: prev.precios_distribuidor.length === 0 }] 
      })); 
  };
  const updateDistTier = (index, field, value) => {
      const newTiers = [...formData.precios_distribuidor];
      newTiers[index][field] = value;
      setFormData({ ...formData, precios_distribuidor: newTiers });
  };
  const removeDistTier = (index) => { 
      setFormData({ ...formData, precios_distribuidor: formData.precios_distribuidor.filter((_, i) => i !== index) }); 
  };
  const setBaseDist = (index) => {
      setFormData(prev => ({
          ...prev,
          precios_distribuidor: prev.precios_distribuidor.map((t, i) => ({ ...t, es_base: i === index }))
      }));
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      
      const cleanedTiers = formData.precios_escalonados
          .map(t => ({ cantidad: parseInt(t.cantidad, 10), precio: Number(t.precio), es_base: t.es_base }))
          .filter(t => !isNaN(t.cantidad) && t.cantidad >= 0 && !isNaN(t.precio) && t.precio > 0);
          
      const cleanedDistTiers = formData.precios_distribuidor
          .map(t => ({ cantidad: parseInt(t.cantidad, 10), precio: Number(t.precio), es_base: t.es_base }))
          .filter(t => !isNaN(t.cantidad) && t.cantidad >= 0 && !isNaN(t.precio) && t.precio > 0);
          
      if (cleanedTiers.length === 0) {
          return toast({ title: "Atención", description: "Debe añadir al menos un precio público válido.", variant: "destructive" });
      }

      const baseTier = cleanedTiers.find(t => t.es_base) || cleanedTiers[0];
      const baseDistTier = cleanedDistTiers.find(t => t.es_base) || cleanedDistTiers[0];

      setSaving(true);
      try {
          const finalData = { 
              codigo: formData.codigo, categoria: formData.categoria, nombre: formData.nombre, 
              descripcion: formData.descripcion, observaciones: formData.observaciones,
              precio: baseTier.precio, 
              venta_minima: formData.venta_minima !== '' ? parseInt(formData.venta_minima, 10) : 0, 
              precio_minimo: formData.precio_minimo !== '' ? parseFloat(formData.precio_minimo) : 0, // 🔥 GUARDAMOS
              precios_escalonados: cleanedTiers.map(t => ({cantidad: t.cantidad, precio: t.precio})),
              precio_distribuidor: (formData.tienePrecioDistribuidor && baseDistTier) ? baseDistTier.precio : 0,
              precios_distribuidor: formData.tienePrecioDistribuidor ? cleanedDistTiers.map(t => ({cantidad: t.cantidad, precio: t.precio})) : [],
              es_por_metro: formData.es_por_metro,
              componentes_inventario: (formData.componentes_inventario || [])
                  .filter(c => Number(c.cantidad) > 0)
                  .map(c => ({ id: c.id, nombre: c.nombre, unidad: c.unidad || '', cantidad: Number(c.cantidad), ...(c.activo ? { activo: true } : {}) }))
          };

          if (editingItem) {
              const { error } = await supabase.from('catalogo_productos').update(finalData).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Producto modificado exitosamente." });
          } else {
              const { error } = await supabase.from('catalogo_productos').insert([finalData]);
              if (error) throw error;
              toast({ title: "Creado", description: "Nuevo producto añadido." });
          }
          onSaved && onSaved();
      } catch (error) {
          toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      } finally { setSaving(false); }
  };


  return (
    <div className={`fixed inset-0 bg-black/60 ${capa} flex items-center justify-center p-4`}>
        <div className="bg-white w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh] rounded-xl shadow-2xl">
            <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-purple-400" />{editingItem ? 'Editar Producto' : 'Crear Nuevo Producto'}</h3>
                <button onClick={() => onClose()} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">Información General</h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-3"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Código (Opcional)</label><Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: P001" className="bg-slate-50"/></div>
                        <div className="md:col-span-4"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label><Input value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: Letreros" className="bg-slate-50"/></div>
                        <div className="md:col-span-5"><label className="text-xs font-bold text-slate-800 uppercase mb-1 block">Nombre de Producto *</label><Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="font-semibold text-blue-900 border-blue-200" /></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción Técnica</label><textarea className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none h-20 resize-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Materiales, dimensiones, etc."/></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observaciones / Condiciones Especiales</label><textarea className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none h-20 resize-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Ej: No incluye instalación..." /></div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-4">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">Configuración de Precios</h4>
                        
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-md border border-red-100">
                                <label className="text-xs font-bold text-red-700 flex items-center gap-1"><ShieldAlert className="h-3 w-3"/> Cant. Mínima:</label>
                                <Input 
                                   type="number" step="1" min="0" value={formData.venta_minima} onChange={e => setFormData({...formData, venta_minima: e.target.value})} 
                                   onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                   className="border-red-300 font-bold text-center w-16 h-7 text-xs bg-white" 
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-md border border-orange-200">
                                <label className="text-xs font-bold text-orange-800 flex items-center gap-1"><DollarSign className="h-3 w-3"/> Precio Mín. ($):</label>
                                <Input 
                                   type="number" step="0.01" min="0" value={formData.precio_minimo} onChange={e => setFormData({...formData, precio_minimo: e.target.value})} 
                                   className="border-orange-300 font-bold text-center w-16 h-7 text-xs bg-white" placeholder="0.00"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-md border border-purple-200">
                                <label htmlFor="metro-switch" className="text-xs font-bold text-purple-800 cursor-pointer select-none">Se cobra por Metro</label>
                                <Switch id="metro-switch" checked={formData.es_por_metro} onCheckedChange={(c) => setFormData({...formData, es_por_metro: c})} />
                            </div>

                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
                                <label htmlFor="dist-switch" className="text-xs font-bold text-blue-800 cursor-pointer select-none">Tarifa Mayorista</label>
                                <Switch id="dist-switch" checked={formData.tienePrecioDistribuidor} onCheckedChange={(c) => setFormData({...formData, tienePrecioDistribuidor: c})} />
                            </div>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 ${formData.tienePrecioDistribuidor ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                        
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <DollarSign className="h-4 w-4 text-green-700"/>
                                <span className="text-xs font-bold text-green-800 uppercase">Lista de Precios (Público) *</span>
                            </div>
                            
                            <div className="space-y-2 mb-3">
                                {formData.precios_escalonados.map((tier, index) => (
                                    <div key={index} className={`flex items-center gap-2 p-2 rounded shadow-sm border ${tier.es_base ? 'bg-green-50 border-green-400' : 'bg-white border-slate-200'}`}>
                                        <label className="flex flex-col items-center justify-center cursor-pointer mr-1 px-1" title="Marcar como Precio Base">
                                            <input type="radio" name="base_publico" checked={tier.es_base || false} onChange={() => setBasePublico(index)} className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer" />
                                            <span className={`text-[8px] font-bold mt-1 ${tier.es_base ? 'text-green-700' : 'text-slate-400'}`}>BASE</span>
                                        </label>

                                        <span className="text-[10px] text-slate-500 font-bold w-9">Cant:</span>
                                        <Input 
                                           type="number" step="1" min="0" value={tier.cantidad} 
                                           onChange={e => updateTier(index, 'cantidad', e.target.value)} 
                                           onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                           className="h-9 text-sm font-bold w-16 text-center bg-white border-slate-300"
                                        />
                                        <span className="text-[10px] text-slate-500 font-bold">unds</span>
                                        
                                        <span className="text-[10px] text-green-700 font-bold ml-auto mr-1">Precio: $</span>
                                        <Input type="number" step="0.01" min="0" value={tier.precio} onChange={e => updateTier(index, 'precio', e.target.value)} className="h-9 text-sm border-green-300 bg-white font-bold text-green-700 w-20 text-right"/>
                                        <Button variant="ghost" size="icon" onClick={() => removeTier(index)} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full border-dashed border-slate-300 text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-800"><Plus className="h-4 w-4 mr-2" /> Añadir precio / escala</Button>
                        </div>

                        {formData.tienePrecioDistribuidor && (
                            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200 animate-in fade-in slide-in-from-right-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="h-4 w-4 text-blue-700"/>
                                    <span className="text-xs font-bold text-blue-800 uppercase">Lista de Precios (Mayorista)</span>
                                </div>
                                
                                <div className="space-y-2 mb-3">
                                    {formData.precios_distribuidor.map((tier, index) => (
                                        <div key={index} className={`flex items-center gap-2 p-2 rounded shadow-sm border ${tier.es_base ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'}`}>
                                            <label className="flex flex-col items-center justify-center cursor-pointer mr-1 px-1" title="Marcar como Precio Base">
                                                <input type="radio" name="base_dist" checked={tier.es_base || false} onChange={() => setBaseDist(index)} className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                                <span className={`text-[8px] font-bold mt-1 ${tier.es_base ? 'text-blue-700' : 'text-slate-400'}`}>BASE</span>
                                            </label>

                                            <span className="text-[10px] text-slate-500 font-bold w-9">Cant:</span>
                                            <Input 
                                               type="number" step="1" min="0" value={tier.cantidad} 
                                               onChange={e => updateDistTier(index, 'cantidad', e.target.value)} 
                                               onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                               className="h-9 text-sm font-bold w-16 text-center bg-white border-slate-300"
                                            />
                                            <span className="text-[10px] text-slate-500 font-bold">unds</span>
                                            
                                            <span className="text-[10px] text-blue-700 font-bold ml-auto mr-1">Precio: $</span>
                                            <Input type="number" step="0.01" min="0" value={tier.precio} onChange={e => updateDistTier(index, 'precio', e.target.value)} className="h-9 text-sm border-blue-300 bg-white font-bold text-blue-800 w-20 text-right"/>
                                            <Button variant="ghost" size="icon" onClick={() => removeDistTier(index)} className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addDistTier} className="w-full border-dashed border-blue-300 text-blue-700 bg-white hover:bg-blue-100 hover:border-blue-400"><Plus className="h-4 w-4 mr-2" /> Añadir precio / escala</Button>
                            </div>
                        )}
                    </div>
                </div>

                {conInventario && <ComponentesInventarioEditor
                    componentes={formData.componentes_inventario || []}
                    porMetro={formData.es_por_metro}
                    onChange={(componentes) => setFormData(prev => ({ ...prev, componentes_inventario: componentes }))}
                />}
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <Button variant="outline" onClick={() => onClose()} className="bg-white">Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white min-w-[160px] shadow-md text-base">{saving ? <Loader2 className="h-5 w-5 animate-spin mr-2"/> : <Save className="h-5 w-5 mr-2"/>} {editingItem ? 'Actualizar' : 'Guardar Producto'}</Button>
            </div>
        </div>
    </div>
  );
};

export default ProductoCatalogoModal;
