import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';

export default function Settings() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    cuisine_tags: '',
    address: '',
    photo_url: '',
    avg_prep_time_minutes: 15,
    is_open: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || '',
        cuisine_tags: Array.isArray(restaurant.cuisine_tags) 
          ? restaurant.cuisine_tags.join(', ') 
          : (restaurant.cuisine_tags || ''),
        address: restaurant.address || '',
        photo_url: restaurant.photo_url || '',
        avg_prep_time_minutes: restaurant.avg_prep_time_minutes || 15,
        is_open: restaurant.is_open !== false // default true unless explicitly false
      });
    }
  }, [restaurant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedCuisineTags = typeof formData.cuisine_tags === 'string'
        ? formData.cuisine_tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from('restaurants')
        .update({
          cuisine_tags: parsedCuisineTags,
          address: formData.address,
          photo_url: formData.photo_url,
          avg_prep_time_minutes: parseInt(formData.avg_prep_time_minutes),
          is_open: formData.is_open
        })
        .eq('id', restaurant.id);
        
      if (error) throw error;
      if (refreshRestaurant) await refreshRestaurant();
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Restaurant Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your public profile and preferences</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center gap-4 bg-gray-50/50">
            <div className="h-16 w-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center overflow-hidden">
              {formData.photo_url ? (
                <img src={formData.photo_url} alt="Restaurant" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-8 w-8" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">{formData.name || 'Your Restaurant'}</h3>
              <p className="text-sm text-gray-500">Update your details below</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Restaurant Name</label>
                <input
                  type="text"
                  disabled
                  value={formData.name}
                  className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm bg-gray-100 cursor-not-allowed text-gray-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cuisine Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.cuisine_tags}
                  onChange={(e) => setFormData({...formData, cuisine_tags: e.target.value})}
                  placeholder="Italian, Pizza, Fast Food"
                  className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Avg Prep Time (minutes)</label>
                <input
                  type="number"
                  required
                  min="5"
                  value={formData.avg_prep_time_minutes}
                  onChange={(e) => setFormData({...formData, avg_prep_time_minutes: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  rows="3"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Photo URL</label>
                <input
                  type="url"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({...formData, photo_url: e.target.value})}
                  placeholder="https://..."
                  className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Restaurant Status</h4>
                <p className="text-sm text-gray-500">Toggle to temporarily close ordering</p>
              </div>
              <button 
                type="button"
                onClick={() => setFormData({...formData, is_open: !formData.is_open})}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.is_open ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.is_open ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-600 border border-transparent rounded-md shadow-sm px-6 py-2 inline-flex justify-center text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
