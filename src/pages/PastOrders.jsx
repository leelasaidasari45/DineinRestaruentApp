import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Search, Calendar, Phone, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function PastOrders() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (restaurant) {
      fetchPastOrders();
    }
  }, [restaurant]);

  const fetchPastOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers:customer_id (name, phone),
          order_items (
            id,
            quantity,
            price_at_order,
            menu_items:menu_item_id (name)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['completed', 'no_show', 'cancelled'])
        .order('arrival_time', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load past orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.customers?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.order_code || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' ? true : order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="h-3 w-3" /> Completed</span>;
      case 'no_show':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><Calendar className="h-3 w-3" /> No-Show</span>;
      case 'cancelled':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit"><XCircle className="h-3 w-3" /> Cancelled</span>;
      default:
        return <span className="bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold px-2.5 py-1 rounded-full w-fit">{status}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Past Orders</h1>
        <p className="text-gray-500 text-sm mt-1">View history of all completed, cancelled, or no-show orders</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 bg-gray-50/50 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by customer or Order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full sm:w-44 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* List of Orders */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="h-full flex items-center justify-center flex-col text-gray-400 italic py-12">
              <p>No past orders found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm hover:shadow transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {order.customers?.name || 'Unknown Customer'}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="text-sm text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
                      <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {order.customers?.phone || 'No Phone'}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Arrived: {format(parseISO(order.arrival_time), 'PPp')}</span>
                      <span>ID: {order.order_code || `#${order.id.substring(0, 8)}`}</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items Ordered</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {order.order_items?.map((item, idx) => (
                          <span key={idx} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-2.5 py-1">
                            <span className="font-semibold text-brand-700">{item.quantity}x</span> {item.menu_items?.name || 'Item'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-center min-w-[120px] pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">Total Paid</span>
                    <span className="text-xl font-bold text-gray-900">₹{order.total_amount}</span>
                    <span className="text-xs text-gray-400 mt-1">Advance: ₹{order.advance_paid_amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
