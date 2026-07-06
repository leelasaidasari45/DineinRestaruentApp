import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, TrendingUp, ShoppingBag, DollarSign, Calendar, BarChart3, Clock } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, isSameDay, startOfMonth, subMonths, endOfMonth } from 'date-fns';

function StatCard({ title, value, subtext, icon: Icon, colorClass }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:shadow-md transition-shadow min-w-[240px] flex-shrink-0 flex-1">
      <div className={`p-4 rounded-full ${colorClass} flex-shrink-0`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1 truncate">{subtext}</p>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurant) {
      fetchAnalyticsData();
    }
  }, [restaurant]);

  const fetchAnalyticsData = async () => {
    try {
      const today = new Date();
      // Fetch starting from the beginning of last month
      const startOfPastMonth = startOfMonth(subMonths(today, 1));
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', startOfPastMonth.toISOString());
        
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const today = new Date();
    
    // Date ranges
    const startOfThisMonth = startOfMonth(today);
    const startOfPastMonth = startOfMonth(subMonths(today, 1));
    const endOfPastMonth = endOfMonth(subMonths(today, 1));

    // Filter today's orders
    const todayOrders = orders.filter(o => isSameDay(new Date(o.created_at), today));
    const completedToday = todayOrders.filter(o => o.status === 'completed');
    
    // Today's total revenue (100% order value = 50% advance + 50% remaining)
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    // Today's advance collected (50%)
    const todayAdvance = todayOrders.reduce((sum, o) => sum + (o.advance_paid_amount || 0), 0);
    
    // Filter this month's orders
    const thisMonthOrders = orders.filter(o => {
      const date = new Date(o.created_at);
      return date >= startOfThisMonth;
    });
    const thisMonthTotal = thisMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Filter past month's orders
    const pastMonthOrders = orders.filter(o => {
      const date = new Date(o.created_at);
      return date >= startOfPastMonth && date <= endOfPastMonth;
    });
    const pastMonthTotal = pastMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const noShows = orders.filter(o => o.status === 'no_show').length;

    // Filter pending orders (confirmed, preparing, ready)
    const pendingOrders = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status));
    const confirmedCount = pendingOrders.filter(o => o.status === 'confirmed').length;
    const preparingCount = pendingOrders.filter(o => o.status === 'preparing').length;
    const readyCount = pendingOrders.filter(o => o.status === 'ready').length;

    // Build chart data (orders & revenue past 7 days)
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(today, 6 - i);
      const dayOrders = orders.filter(o => isSameDay(new Date(o.created_at), d));
      return {
        name: format(d, 'MMM dd'),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      };
    });

    return {
      todayCount: todayOrders.length,
      todayRevenue,
      todayAdvance,
      thisMonthTotal,
      pastMonthTotal,
      completedToday: completedToday.length,
      noShows,
      pendingCount: pendingOrders.length,
      pendingBreakdown: `Conf: ${confirmedCount} | Prep: ${preparingCount} | Ready: ${readyCount}`,
      chartData
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 bg-gray-50">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analytics Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Track your restaurant's performance</p>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 mb-8 no-scrollbar">
        <StatCard 
          title="Today's Orders" 
          value={stats.todayCount} 
          subtext={`Completed: ${stats.completedToday}`}
          icon={ShoppingBag} 
          colorClass="bg-blue-100 text-blue-600" 
        />
        <StatCard 
          title="Pending Orders" 
          value={stats.pendingCount} 
          subtext={stats.pendingBreakdown}
          icon={Clock} 
          colorClass="bg-yellow-100 text-yellow-600" 
        />
        <StatCard 
          title="Today's Total Revenue" 
          value={`₹${stats.todayRevenue}`} 
          subtext={`Advance: ₹${stats.todayAdvance}`}
          icon={DollarSign} 
          colorClass="bg-green-100 text-green-600" 
        />
        <StatCard 
          title="This Month Total" 
          value={`₹${stats.thisMonthTotal}`} 
          subtext={format(new Date(), 'MMMM yyyy')}
          icon={Calendar} 
          colorClass="bg-brand-100 text-brand-600" 
        />
        <StatCard 
          title="Past Month Total" 
          value={`₹${stats.pastMonthTotal}`} 
          subtext={format(subMonths(new Date(), 1), 'MMMM yyyy')}
          icon={BarChart3} 
          colorClass="bg-purple-100 text-purple-600" 
        />
      </div>

      <div className="space-y-8">
        {/* Orders Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Orders Past 7 Days</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Past 7 Days (₹)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
