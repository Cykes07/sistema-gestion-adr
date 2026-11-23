import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X, Upload, Download, FileText, DollarSign, ShieldAlert, Filter, ArrowUpDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import ProductoCatalogoModal, { puedeEditarCatalogo } from './ProductoCatalogoModal';
import { useModulo } from '@/utils/empresa';

const CatalogPanel = ({ user }) => {
  const { toast } = useToast();
  const conInventario = useModulo('inventario');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const fileInputRef = useRef(null);
  
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });

  const canEditCatalog = puedeEditarCatalogo(user);
  const isReadOnly = !canEditCatalog; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  useEffect(() => { fetchCatalog(activeSearchTerm); }, [activeSearchTerm]);

  const fetchCatalog = async (searchTerm = '') => {
    setLoading(true);
    try {
      let query = supabase.from('catalogo_productos').select('*');
      if (searchTerm) query = query.or(`nombre.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`);
      query = query.limit(1000); 

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el catálogo", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSearchKeyDown = (e) => { if (e.key === 'Enter') setActiveSearchTerm(searchInput); };

  const uniqueCategories = React.useMemo(() => {
      const categories = items.map(item => item.categoria).filter(Boolean);
      return [...new Set(categories)].sort();
  }, [items]);

  const toggleCategory = (cat) => {
      setSelectedCategories(prev => 
          prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
  };

  const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const processedItems = React.useMemo(() => {
      let filtered = items.filter(item => {
          if (selectedCategories.length === 0) return true;
          return selectedCategories.includes(item.categoria);
      });

      filtered.sort((a, b) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];

          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          if (typeof aVal === 'number' && typeof bVal === 'number') {
              return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }

          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();

          if (sortConfig.direction === 'asc') {
              return aStr.localeCompare(bStr);
          }
          return bStr.localeCompare(aStr);
      });

      return filtered;
  }, [items, selectedCategories, sortConfig]);

  const SortableHeader = ({ label, sortKey, align = 'left', width }) => (
      <th 
          className={`px-4 py-3 font-semibold cursor-pointer hover:bg-slate-700 transition-colors select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`} 
          onClick={() => requestSort(sortKey)}
      >
          <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
              {label}
              <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'text-purple-400 font-bold' : 'text-slate-400'}`} />
          </div>
      </th>
  );

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return;
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
      if (isReadOnly || !confirm("¿Seguro que deseas eliminar este producto?")) return;
      try {
          await supabase.from('catalogo_productos').delete().eq('id', id);
          toast({ title: "Eliminado", description: "Producto borrado." });
          fetchCatalog(activeSearchTerm);
      } catch (error) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleExportCSV = () => {
      let csvContent = "\uFEFF"; 
      
      const grouped = items.reduce((acc, item) => {
          const cat = item.categoria || 'General';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
      }, {});

      let maxTiers = 1;
      let maxDistTiers = 1;
      items.forEach(item => {
          if (item.precios_escalonados && item.precios_escalonados.length > maxTiers) maxTiers = item.precios_escalonados.length;
          if (item.precios_distribuidor && item.precios_distribuidor.length > maxDistTiers) maxDistTiers = item.precios_distribuidor.length;
      });

      for (const [cat, catItems] of Object.entries(grouped)) {
          csvContent += `"CATEGORÍA: ${cat}"\n`;
          
          let headers = ['ID', 'CÓDIGO PRODUCTO', 'NOMBRE DE PRODUCTO', 'DESCRIPCIÓN', 'OBSERVACIONES', 'POR METRO', 'PRECIO MÍNIMO ($)'];
          for (let i = 0; i < maxTiers; i++) {
              headers.push('CANT');
              headers.push('PRECIO PÚBLICO');
          }
          for (let i = 0; i < maxDistTiers; i++) {
              headers.push('CANT DIST');
              headers.push('PRECIO MAYORISTA');
          }
          csvContent += headers.map(h => `"${h}"`).join(';') + '\n';

          catItems.forEach(item => {
              let row = [
                  item.id || '',
                  item.codigo || '',
                  item.nombre || '',
                  item.descripcion || '',
                  item.observaciones || '',
                  item.es_por_metro ? 'SI' : 'NO',
                  item.precio_minimo !== undefined && item.precio_minimo !== null ? item.precio_minimo : ''
              ];
              
              const tiers = item.precios_escalonados || [];
              for (let i = 0; i < maxTiers; i++) {
                  if (i < tiers.length) {
                      row.push(tiers[i].cantidad !== undefined ? tiers[i].cantidad : '');
                      row.push(tiers[i].precio !== undefined ? tiers[i].precio : '');
                  } else {
                      row.push(''); row.push('');
                  }
              }

              const distTiers = item.precios_distribuidor || [];
              for (let i = 0; i < maxDistTiers; i++) {
                  if (i < distTiers.length) {
                      row.push(distTiers[i].cantidad !== undefined ? distTiers[i].cantidad : '');
                      row.push(distTiers[i].precio !== undefined ? distTiers[i].precio : '');
                  } else {
                      row.push(''); row.push('');
                  }
              }
              
              csvContent += row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';') + '\n';
          });
          csvContent += '\n';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Plantilla_Catalogo_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleCSVUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingCSV(true);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target.result;
              const firstLine = text.split('\n')[0] || '';
              const delimiter = firstLine.includes(';') ? ';' : ',';
              const lines = []; let currentRow = []; let currentVal = ''; let inQuotes = false;
              
              for (let i = 0; i < text.length; i++) {
                  const char = text[i]; const nextChar = text[i+1];
                  if (char === '"') { if (inQuotes && nextChar === '"') { currentVal += '"'; i++; } else { inQuotes = !inQuotes; } } 
                  else if (char === delimiter && !inQuotes) { currentRow.push(currentVal.trim()); currentVal = ''; } 
                  else if ((char === '\n' || char === '\r') && !inQuotes) { if (char === '\r' && nextChar === '\n') i++; currentRow.push(currentVal.trim()); lines.push(currentRow); currentRow = []; currentVal = ''; } 
                  else { currentVal += char; }
              }
              if (currentRow.length > 0 || currentVal !== '') { currentRow.push(currentVal.trim()); lines.push(currentRow); }

              let currentCategory = 'General';
              let idxId = -1, idxNombre = -1, idxCodigo = -1, idxDesc = -1, idxObs = -1, idxMetro = -1, idxPrecioMin = -1;
              let cantIndexes = []; let cantDistIndexes = [];
              const productsToInsert = [];

              for (let i = 0; i < lines.length; i++) {
                  const row = lines[i];
                  if (!row || row.length === 0 || (row.length === 1 && row[0] === '')) continue;
                  
                  const possibleCategory = row.find(cell => cell && (cell.toUpperCase().includes('CATEGORÍA:') || cell.toUpperCase().includes('CATEGORIA:')));
                  if (possibleCategory) { currentCategory = possibleCategory.replace(/CATEGORÍA:/gi, '').replace(/CATEGORIA:/gi, '').replace(/"/g, '').trim(); continue; }

                  if (row.some(cell => cell && cell.toUpperCase().includes('NOMBRE DE PRODUCTO'))) {
                      idxId = row.findIndex(c => c && c.toUpperCase() === 'ID');
                      idxNombre = row.findIndex(c => c && c.toUpperCase().includes('NOMBRE DE PRODUCTO'));
                      idxCodigo = row.findIndex(c => c && c.toUpperCase().includes('PRODUCTO') && !c.toUpperCase().includes('NOMBRE'));
                      idxDesc = row.findIndex(c => c && c.toUpperCase().includes('DESCRIPCI'));
                      idxObs = row.findIndex(c => c && c.toUpperCase().includes('OBSERVACIONES'));
                      idxMetro = row.findIndex(c => c && c.toUpperCase().includes('METRO'));
                      idxPrecioMin = row.findIndex(c => c && c.toUpperCase().includes('PRECIO MÍNIMO'));
                      cantIndexes = []; cantDistIndexes = [];
                      row.forEach((col, index) => { 
                          if (col) {
                              const colName = col.toUpperCase().trim();
                              if (colName === 'CANT' || colName === 'CANT.') cantIndexes.push(index);
                              else if (colName === 'CANT DIST' || colName === 'CANT DIST.' || colName.includes('CANT MAYORISTA')) cantDistIndexes.push(index);
                          }
                      });
                      continue;
                  }

                  if (idxNombre !== -1 && row[idxNombre]) {
                      const nombre = row[idxNombre];
                      if (!nombre || nombre.trim() === '' || nombre.toUpperCase().includes('NOMBRE DE PRODUCTO')) continue;
                      
                      const esMetro = idxMetro !== -1 && row[idxMetro] && row[idxMetro].toUpperCase().includes('SI');
                      const precioMinimoVal = idxPrecioMin !== -1 && row[idxPrecioMin] ? parseFloat(String(row[idxPrecioMin]).replace(/\$/g, '').replace(/,/g, '.')) : 0;

                      let precios_escalonados = [];
                      cantIndexes.forEach(cantIdx => {
                          let cantStr = row[cantIdx] ? String(row[cantIdx]).trim() : '';
                          let cantVal = parseInt(cantStr.replace(/,/g, '').replace(/[^0-9]/g, ''), 10);
                          if (isNaN(cantVal) || cantVal < 0) cantVal = 0; 
                          
                          const rawPrecio = row[cantIdx + 1] ? String(row[cantIdx + 1]) : '';
                          const precioLimpio = rawPrecio.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.').trim();
                          const precioVal = Number(precioLimpio);

                          if (precioVal >= 0 && !precios_escalonados.some(p => p.cantidad === cantVal)) {
                              precios_escalonados.push({ cantidad: cantVal, precio: precioVal, es_base: false });
                          }
                      });
                      precios_escalonados.sort((a,b) => a.cantidad - b.cantidad);
                      if (precios_escalonados.length > 0) precios_escalonados[0].es_base = true;
                      
                      const basePrecio = precios_escalonados.length > 0 ? precios_escalonados[0].precio : 0;
                      const baseMinima = precios_escalonados.length > 0 ? precios_escalonados[0].cantidad : 0;

                      let precios_distribuidor = [];
                      cantDistIndexes.forEach(cantIdx => {
                          let cantStr = row[cantIdx] ? String(row[cantIdx]).trim() : '';
                          let cantVal = parseInt(cantStr.replace(/,/g, '').replace(/[^0-9]/g, ''), 10);
                          if (isNaN(cantVal) || cantVal < 0) cantVal = 0; 
                          
                          const rawPrecio = row[cantIdx + 1] ? String(row[cantIdx + 1]) : '';
                          const precioLimpio = rawPrecio.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.').trim();
                          const precioVal = Number(precioLimpio);

                          if (precioVal >= 0 && !precios_distribuidor.some(p => p.cantidad === cantVal)) {
                              precios_distribuidor.push({ cantidad: cantVal, precio: precioVal, es_base: false });
                          }
                      });
                      precios_distribuidor.sort((a,b) => a.cantidad - b.cantidad);
                      if (precios_distribuidor.length > 0) precios_distribuidor[0].es_base = true;
                      
                      const basePrecioDist = precios_distribuidor.length > 0 ? precios_distribuidor[0].precio : 0;

                      let productData = {
                          codigo: idxCodigo !== -1 ? row[idxCodigo] : null,
                          categoria: currentCategory,
                          nombre,
                          descripcion: idxDesc !== -1 ? row[idxDesc] : null,
                          observaciones: idxObs !== -1 ? row[idxObs] : null,
                          precio: basePrecio,
                          venta_minima: baseMinima,
                          precios_escalonados: precios_escalonados.map(t => ({cantidad: t.cantidad, precio: t.precio})),
                          precio_distribuidor: basePrecioDist,
                          precios_distribuidor: precios_distribuidor.map(t => ({cantidad: t.cantidad, precio: t.precio})),
                          es_por_metro: esMetro,
                          precio_minimo: !isNaN(precioMinimoVal) ? precioMinimoVal : 0
                      };

                      if (idxId !== -1 && row[idxId] && row[idxId].trim() !== '') {
                          productData.id = row[idxId].trim();
                      }

                      productsToInsert.push(productData);
                  }
              }

              if (productsToInsert.length > 0) {
                  const chunkSize = 50;
                  for (let i = 0; i < productsToInsert.length; i += chunkSize) {
                      const chunk = productsToInsert.slice(i, i + chunkSize);
                      const { error } = await supabase.from('catalogo_productos').upsert(chunk, { onConflict: 'id' });
                      if (error) throw error;
                  }
                  toast({ title: "✅ Sincronización Exitosa", description: `Se guardaron o actualizaron ${productsToInsert.length} productos sin errores.` });
                  fetchCatalog(activeSearchTerm);
              } else {
                  toast({ title: "Atención", description: "No se encontraron productos para importar. Verifica el formato.", variant: "destructive" });
              }
          } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } 
          finally { setUploadingCSV(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-6 w-6 text-purple-600" /> Catálogo de Precios</h2>
                <p className="text-slate-500">Consulta y administra productos con precios únicos, por volumen y tarifas de distribuidor.</p>
            </div>
            {!isReadOnly && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={handleExportCSV} className="border-green-200 text-green-700 hover:bg-green-50 shadow-sm">
                        <Download className="h-4 w-4 mr-2" /> Descargar CSV
                    </Button>
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="outline" onClick={() => fileInputRef.current.click()} disabled={uploadingCSV} className="border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm">
                        {uploadingCSV ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />} Cargar CSV Múltiple
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-6 shadow-sm">
                        <Plus className="h-4 w-4" /> Nuevo Producto
                    </Button>
                </div>
            )}
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                    <div className="relative w-full max-w-md flex items-center gap-2">
                        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Buscar código, nombre..." className="pl-9 bg-white" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown}/></div>
                        <Button variant="secondary" onClick={() => setActiveSearchTerm(searchInput)}>Buscar</Button>
                    </div>
                    <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => fetchCatalog(activeSearchTerm)} disabled={loading}><RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button></div>
                </div>

                {uniqueCategories.length > 0 && (
                    <div className="px-4 pb-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-slate-500 flex items-center mr-1"><Filter className="h-3 w-3 mr-1"/> Filtros:</span>
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all duration-200 ${
                                    selectedCategories.includes(cat)
                                        ? 'bg-purple-600 text-white border border-purple-700 shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                        {selectedCategories.length > 0 && (
                            <button
                                onClick={() => setSelectedCategories([])}
                                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors ml-auto border border-transparent hover:border-red-200"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <SortableHeader label="Código" sortKey="codigo" width="w-24" />
                                <SortableHeader label="Categoría / Producto" sortKey="nombre" />
                                <SortableHeader label="V. Mín / P. Mín" sortKey="venta_minima" align="center" width="w-28" />
                                <SortableHeader label="Precios Público" sortKey="precio" align="right" width="w-48" />
                                <SortableHeader label="Precios Distribuidor" sortKey="precio_distribuidor" align="right" width="w-48" />
                                {!isReadOnly && <th className="px-4 py-3 font-semibold text-center w-24">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {loading ? <tr><td colSpan="6" className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando...</td></tr>
                            : processedItems.length === 0 ? <tr><td colSpan="6" className="text-center py-10 text-slate-500">No se encontraron productos con estos filtros.</td></tr>
                            : processedItems.map(item => (
                                    <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500 align-top">{item.codigo || '-'}</td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="text-[10px] font-bold text-purple-600 mb-0.5 uppercase tracking-wider">{item.categoria}</div>
                                            <div className="font-bold text-slate-800 uppercase">{item.nombre}</div>
                                            {item.es_por_metro && <span className="text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded mt-1 inline-block uppercase">SE COBRA POR METRO</span>}
                                            <div className="mt-1 space-y-1">
                                               {item.descripcion && <div className="text-xs text-slate-700 line-clamp-2" title={item.descripcion}><span className="font-semibold text-slate-500">Desc:</span> {item.descripcion}</div>}
                                               {item.observaciones && <div className="text-[10px] text-slate-500 line-clamp-2" title={item.observaciones}><span className="font-semibold text-slate-400">Obs:</span> {item.observaciones}</div>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-center">
                                            <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 block">{item.venta_minima !== null && item.venta_minima !== undefined ? Math.floor(item.venta_minima) : 0} unds</span>
                                            {Number(item.precio_minimo) > 0 && (
                                                <span className="font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 block mt-1">Mín: ${Number(item.precio_minimo).toFixed(2)}</span>
                                            )}
                                        </td>
                                        
                                        <td className="px-4 py-3 text-right align-top bg-slate-50/50">
                                            <div className="font-bold text-green-700 mb-1 border-b border-slate-200 pb-1">Base: ${Number(item.precio).toFixed(2)}</div>
                                            {item.precios_escalonados && item.precios_escalonados.length > 0 && (
                                                <div className="space-y-1 text-[10px] rounded mt-1">
                                                    {item.precios_escalonados.sort((a,b) => a.cantidad - b.cantidad).map((tier, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-slate-600 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                            <span className="font-medium">≥ {tier.cantidad}</span>
                                                            <span className="font-bold text-slate-800">${Number(tier.precio).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td className="px-4 py-3 text-right align-top bg-blue-50/30 border-l border-slate-100">
                                            {Number(item.precio_distribuidor) > 0 || (item.precios_distribuidor && item.precios_distribuidor.length > 0) ? (
                                                <>
                                                    <div className="font-bold text-blue-700 mb-1 border-b border-blue-100 pb-1">Base: ${Number(item.precio_distribuidor).toFixed(2)}</div>
                                                    {item.precios_distribuidor && item.precios_distribuidor.length > 0 && (
                                                        <div className="space-y-1 text-[10px] rounded mt-1">
                                                            {item.precios_distribuidor.sort((a,b) => a.cantidad - b.cantidad).map((tier, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-blue-800 border-b border-blue-100 pb-1 last:border-0 last:pb-0">
                                                                    <span className="font-medium">≥ {tier.cantidad}</span>
                                                                    <span className="font-bold">${Number(tier.precio).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No aplica</span>
                                            )}
                                        </td>

                                        {!isReadOnly && (
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(item)} className="h-7 w-7 text-blue-600"><Edit2 className="h-3 w-3" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDelete(item.id)} className="h-7 w-7 text-red-600"><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {isModalOpen && !isReadOnly && (
            <ProductoCatalogoModal
                key={editingItem?.id || 'nuevo'}
                item={editingItem}
                onClose={() => setIsModalOpen(false)}
                onSaved={() => { setIsModalOpen(false); fetchCatalog(activeSearchTerm); }}
            />
        )}
    </div>
  );
};

export default CatalogPanel;