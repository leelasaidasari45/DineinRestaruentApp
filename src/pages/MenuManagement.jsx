import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Loader2, Search } from 'lucide-react';

export default function MenuManagement() {
  const { restaurant } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [vegFilter, setVegFilter] = useState('all'); // 'all', 'veg', 'non-veg'
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    photo_url: '',
    is_veg: true,
    is_available: true
  });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  // AI Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerImageFiles, setScannerImageFiles] = useState([]);
  const [scannedItems, setScannedItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scannerStep, setScannerStep] = useState(1);
  const [scanProgressMessage, setScanProgressMessage] = useState('');

  useEffect(() => {
    if (restaurant) {
      fetchMenuItems();
    }
  }, [restaurant]);

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('category')
        .order('name');
        
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      toast.error('Failed to load menu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, field, currentValue) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ [field]: !currentValue })
        .eq('id', id);
        
      if (error) throw error;
      
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, [field]: !currentValue } : item
      ));
      toast.success('Updated successfully');
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success('Item deleted');
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all menu items? This action is permanent and cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', restaurant.id);
        
      if (error) throw error;
      
      setItems([]);
      toast.success('All menu items deleted successfully');
    } catch (err) {
      toast.error('Failed to delete all items: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        price: item.price,
        photo_url: item.photo_url || '',
        is_veg: item.is_veg,
        is_available: item.is_available
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: '',
        price: '',
        photo_url: '',
        is_veg: true,
        is_available: true
      });
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const openScannerModal = () => {
    setIsScannerOpen(true);
    setScannerStep(1);
    setScannerImageFiles([]);
    setScannedItems([]);
    setScanProgressMessage('');
  };

  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleScanMenu = async (e) => {
    e.preventDefault();
    if (scannerImageFiles.length === 0) {
      toast.error('Please upload at least one menu image.');
      return;
    }
    setScanning(true);
    const allExtractedItems = [];
    
    try {
      // 1. Fetch the shared API key from the database configuration
      const { data: configData, error: configError } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();

      if (configError) {
        throw new Error('Failed to load API config: ' + configError.message);
      }

      const apiKey = configData.value;

      // 2. Loop and scan pages directly from client side
      for (let i = 0; i < scannerImageFiles.length; i++) {
        const file = scannerImageFiles[i];
        setScanProgressMessage(`Scanning page ${i + 1} of ${scannerImageFiles.length}...`);
        
        const base64 = await getBase64(file);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Analyze this menu card image and extract all food items. For each item, extract the name, category (e.g. Starter, Main Course, Biryani, Soups, Dessert, Beverage, Tiffin, Bread), price (numeric value only, omit currency symbols), and whether it is vegetarian (true/false) based on standard ingredients or indicators (like green dot/red dot). Return the result as a raw JSON array of objects with the keys: name, category, price, is_veg. Return ONLY the raw JSON array. Do not include markdown code block formatting (like ```json ... ```) or any other conversational text.'
                  },
                  {
                    inlineData: {
                      mimeType: file.type || 'image/jpeg',
                      data: base64
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `API call returned status ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
          const text = data.candidates[0].content.parts[0].text;
          const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);

          if (Array.isArray(parsed)) {
            allExtractedItems.push(...parsed);
          } else {
            console.warn(`AI response for page ${i + 1} was not a valid array.`);
          }
        } else {
          throw new Error(`AI response structure invalid for page ${i + 1}.`);
        }
      }

      if (allExtractedItems.length > 0) {
        const itemsWithIds = allExtractedItems.map((item, idx) => ({
          id: `scan-${Date.now()}-${idx}`,
          name: item.name || '',
          category: item.category || 'Main Course',
          price: parseFloat(item.price) || 0,
          is_veg: item.is_veg !== false,
          selected: true
        }));
        setScannedItems(itemsWithIds);
        setScannerStep(2);
        toast.success(`Successfully scanned ${scannerImageFiles.length} pages and parsed ${allExtractedItems.length} items!`);
      } else {
        throw new Error('No items could be parsed from the uploaded images.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Scanning failed: ' + err.message);
    } finally {
      setScanning(false);
      setScanProgressMessage('');
    }
  };

  const handleImportScannedItems = async () => {
    const selectedItems = scannedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('No items selected for import.');
      return;
    }

    setSaving(true);
    try {
      const payload = selectedItems.map(item => ({
        name: item.name,
        category: item.category,
        price: item.price,
        is_veg: item.is_veg,
        is_available: true,
        restaurant_id: restaurant.id
      }));

      const { error } = await supabase
        .from('menu_items')
        .insert(payload);

      if (error) throw error;

      toast.success(`Successfully imported ${selectedItems.length} menu items!`);
      setIsScannerOpen(false);
      fetchMenuItems();
    } catch (err) {
      toast.error('Failed to import items: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateScannedItemField = (id, field, value) => {
    setScannedItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalPhotoUrl = formData.photo_url;

      if (imageFile) {
        try {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `menu-${restaurant.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('restaurants')
            .upload(fileName, imageFile, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('restaurants')
              .getPublicUrl(fileName);
            finalPhotoUrl = publicUrl;
          } else {
            console.warn('Storage upload failed, falling back to base64:', uploadError);
            finalPhotoUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(imageFile);
            });
          }
        } catch (uploadErr) {
          console.error('Failed to upload image:', uploadErr);
          // Try base64 fallback directly
          finalPhotoUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(imageFile);
          });
        }
      }

      const payload = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        photo_url: finalPhotoUrl,
        is_veg: formData.is_veg,
        is_available: formData.is_available,
        restaurant_id: restaurant.id
      };

      if (editingItem) {
        const { error } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase
          .from('menu_items')
          .insert([payload]);
        if (error) throw error;
        toast.success('Item added');
      }
      
      setIsModalOpen(false);
      fetchMenuItems(); // Refresh list
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const categories = ['All', ...new Set(items.map(item => item.category).filter(Boolean))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesVeg = vegFilter === 'all' || 
      (vegFilter === 'veg' && item.is_veg) || 
      (vegFilter === 'non-veg' && !item.is_veg);
    return matchesSearch && matchesCategory && matchesVeg;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedItems).sort();

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your restaurant offerings</p>
        </div>
        <div className="flex gap-3">
          {items.length > 0 && (
            <button 
              onClick={handleDeleteAll}
              className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </button>
          )}
          <button 
            onClick={() => openScannerModal()}
            className="bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <span>✨ AI Scanner</span>
          </button>
          <button 
            onClick={() => openModal()}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col gap-3 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
              />
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 self-start sm:self-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => setVegFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  vegFilter === 'all' 
                    ? 'bg-white text-gray-900 shadow-sm font-bold' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('veg')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  vegFilter === 'veg' 
                    ? 'bg-white text-green-700 shadow-sm font-bold' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-green-600"></span> Veg
              </button>
              <button
                type="button"
                onClick={() => setVegFilter('non-veg')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  vegFilter === 'non-veg' 
                    ? 'bg-white text-red-700 shadow-sm font-bold' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-600"></span> Non-Veg
              </button>
            </div>
          </div>
          
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedCategory === cat 
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm' 
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex items-center justify-center flex-col text-gray-500">
              <p>No menu items found.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedCategories.map((categoryName, idx) => (
                <div key={categoryName} className="space-y-4">
                  {idx > 0 && <hr className="border-t border-gray-300 my-8" />}
                  <h2 className="text-base font-bold text-gray-800 border-b border-gray-300 pb-2 flex items-center gap-2">
                    <span className="bg-brand-100 text-brand-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {groupedItems[categoryName].length}
                    </span>
                    {categoryName}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupedItems[categoryName].map(item => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-3 w-3 rounded-sm border ${item.is_veg ? 'border-green-600 bg-green-100' : 'border-red-600 bg-red-100'} flex-shrink-0`}>
                                <span className={`block w-1.5 h-1.5 m-auto mt-[2px] rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`}></span>
                              </span>
                              <h3 className="font-semibold text-gray-900 break-words whitespace-normal text-sm sm:text-base flex-1" title={item.name}>{item.name}</h3>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-lg font-bold text-gray-900 mb-4">
                          ₹{item.price}
                        </div>

                        <div className="mt-auto space-y-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Available</span>
                            <button 
                              onClick={() => handleToggle(item.id, 'is_available', item.is_available)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${item.is_available ? 'bg-brand-500' : 'bg-gray-200'}`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.is_available ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => openModal(item)}
                              className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 rounded text-sm font-medium transition-colors border border-gray-200 flex justify-center items-center gap-1"
                            >
                              <Edit2 className="h-3 w-3" /> Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded text-sm font-medium transition-colors border border-red-200 flex justify-center items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)}></div>

            <div className="relative inline-block w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                {editingItem ? 'Edit Menu Item' : 'Add New Item'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                      placeholder="e.g. Starters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Upload Item Image {!editingItem && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    required={!editingItem}
                    onChange={(e) => setImageFile(e.target.files[0])}
                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 border border-gray-300 rounded-md py-1.5 px-3"
                  />
                  {editingItem && formData.photo_url && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={formData.photo_url} alt="Current" className="h-10 w-10 object-cover rounded-md border" />
                      <span className="text-xs text-gray-500">Current Image preview</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_veg}
                      onChange={(e) => setFormData({...formData, is_veg: e.target.checked})}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">Vegetarian</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_available}
                      onChange={(e) => setFormData({...formData, is_available: e.target.checked})}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">Available</span>
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-brand-600 border border-transparent rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AI Menu Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => !scanning && setIsScannerOpen(false)}></div>

            <div className={`relative inline-block w-full ${scannerStep === 1 ? 'max-w-md' : 'max-w-4xl'} p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl`}>
              <h3 className="text-lg font-bold leading-6 text-gray-900 mb-2 flex items-center gap-2">
                <span>✨ AI Menu Card Scanner</span>
                {scannerStep === 2 && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full border border-brand-200">
                    Step 2: Review & Import
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                {scannerStep === 1 
                  ? 'Upload an image of your physical menu, and Zuno\'s AI agent will automatically extract all names, prices, categories, and vegetarian classifications.'
                  : 'Review the extracted items below. You can edit names, prices, and categories, or toggle vegetarian status before bulk-adding them to your live menu.'
                }
              </p>

              {scannerStep === 1 ? (
                <form onSubmit={handleScanMenu} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 hover:border-brand-500 rounded-xl p-8 text-center transition-colors bg-gray-50/50">
                    <input
                      type="file"
                      id="scanner-image-upload"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        setScannerImageFiles(prev => [...prev, ...files]);
                      }}
                    />
                    <label htmlFor="scanner-image-upload" className="cursor-pointer block space-y-3">
                      <div className="mx-auto h-12 w-12 text-gray-400 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-200">
                        📁
                      </div>
                      <div className="text-sm font-semibold text-gray-700">
                        Select or drag menu images
                      </div>
                      <p className="text-xs text-gray-500">Supports uploading multiple pages (PNG, JPG, JPEG)</p>
                    </label>
                  </div>

                  {/* Selected files list */}
                  {scannerImageFiles.length > 0 && (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Selected Files ({scannerImageFiles.length})
                      </div>
                      {scannerImageFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-gray-400">📄</span>
                            <span className="font-medium text-gray-700 truncate" title={file.name}>{file.name}</span>
                            <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setScannerImageFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {scanning && (
                    <div className="flex flex-col items-center justify-center p-6 bg-brand-50/50 border border-brand-100 rounded-xl space-y-3 animate-pulse">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                      <div className="text-sm font-bold text-brand-800">
                        {scanProgressMessage || 'Scanning Menu Card...'}
                      </div>
                      <p className="text-xs text-brand-600 text-center">Reading text, matching prices, and categorizing dishes. Scanning multiple pages sequentially.</p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={scanning}
                      onClick={() => setIsScannerOpen(false)}
                      className="bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={scanning || scannerImageFiles.length === 0}
                      className="bg-brand-600 border border-transparent rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
                    >
                      {scanning ? 'Reading Menu...' : 'Scan with AI'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm max-h-[400px]">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                            Include
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Item Name
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                            Category
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                            Price (₹)
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                            Veg?
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm">
                        {scannedItems.map((item) => (
                          <tr key={item.id} className={item.selected ? 'bg-white' : 'bg-gray-50/50 opacity-60'}>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => updateScannedItemField(item.id, 'selected', e.target.checked)}
                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4 animate-none"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                required
                                value={item.name}
                                disabled={!item.selected}
                                onChange={(e) => updateScannedItemField(item.id, 'name', e.target.value)}
                                className="block w-full border border-gray-300 rounded-md py-1.5 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-xs"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                required
                                value={item.category}
                                disabled={!item.selected}
                                onChange={(e) => updateScannedItemField(item.id, 'category', e.target.value)}
                                className="block w-full border border-gray-300 rounded-md py-1.5 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-xs"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={item.price}
                                disabled={!item.selected}
                                onChange={(e) => updateScannedItemField(item.id, 'price', e.target.value)}
                                className="block w-full border border-gray-300 rounded-md py-1.5 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-xs"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={!item.selected}
                                onClick={() => updateScannedItemField(item.id, 'is_veg', !item.is_veg)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                                  item.is_veg 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : 'bg-red-50 border-red-200 text-red-700'
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                {item.is_veg ? 'Veg' : 'Non-Veg'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-500 pt-2">
                    <div>
                      Selected: <span className="font-bold text-gray-700">{scannedItems.filter(i => i.selected).length}</span> / {scannedItems.length} items
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setScannedItems(prev => prev.map(i => ({ ...i, selected: true })))}
                        className="text-brand-600 hover:text-brand-700 font-semibold cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setScannedItems(prev => prev.map(i => ({ ...i, selected: false })))}
                        className="text-gray-500 hover:text-gray-600 font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setScannerStep(1)}
                      className="bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 inline-flex justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={saving || scannedItems.filter(i => i.selected).length === 0}
                      onClick={handleImportScannedItems}
                      className="bg-brand-600 border border-transparent rounded-md shadow-sm px-5 py-2 inline-flex justify-center text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Import Selected Items
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
