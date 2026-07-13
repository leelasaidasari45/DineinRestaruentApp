import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { Clock, Phone, Loader2, ArrowRight, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COLUMNS = [
  { id: 'confirmed', title: 'Confirmed' },
  { id: 'preparing', title: 'Preparing' },
  { id: 'ready', title: 'Ready' },
  { id: 'completed', title: 'Completed' },
];

function OrderCardContent({ order, onMove, nextAction, isUrgent, timeColor, isOverdue, minutesUntilArrival, arrivalTime }) {
  const action = nextAction;
  return (
    <div className={`bg-white rounded-lg shadow-sm border ${isUrgent ? 'border-red-400' : 'border-gray-200'} p-4 mb-3 hover:shadow-md transition-shadow relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-bold text-gray-900 text-lg">
            {order.customers?.name || 'Unknown Customer'}
          </h4>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {order.customers?.phone || 'No phone'}
          </p>
        </div>
        {order.status === 'completed' ? (
          <div className="text-xs font-bold px-2 py-1 rounded-md border text-green-700 bg-green-50 border-green-200 font-sans">
            Completed
          </div>
        ) : (
          <div className={`text-xs font-bold px-2 py-1 rounded-md border flex items-center gap-1 font-sans ${timeColor}`}>
            <Clock className="h-3 w-3" />
            {isOverdue ? `Overdue by ${Math.abs(minutesUntilArrival)}m` : `In ${minutesUntilArrival}m`}
          </div>
        )}
      </div>
      
      <div className="text-sm text-gray-500 mb-2">
        Due: {format(arrivalTime, 'h:mm a')}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
        {order.order_items?.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-gray-800">
              <span className="font-semibold">{item.quantity}x</span> {item.menu_items?.name || 'Item'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
          {order.order_code || `ID: #${order.id.substring(0,6)}`}
        </span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${order.payment_status === 'paid' || order.advance_paid_amount > 0 ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
          {order.advance_paid_amount > 0 ? `₹${order.advance_paid_amount} Advance` : 'Pending'}
        </span>
      </div>

      {action && (
        <button
          onPointerDown={(e) => e.stopPropagation()} // Crucial to prevent dnd-kit from starting a drag
          onClick={(e) => {
            e.stopPropagation();
            onMove(order.id, action.target);
          }}
          className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer ${action.color}`}
        >
          {action.label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function OrderCard({ order, onMove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const arrivalTime = parseISO(order.arrival_time);
  const minutesUntilArrival = differenceInMinutes(arrivalTime, new Date());
  
  // Urgency logic: <= 10 mins and still in 'confirmed'
  const isUrgent = order.status === 'confirmed' && minutesUntilArrival <= 10 && minutesUntilArrival > -60;
  const isOverdue = minutesUntilArrival < 0;

  let timeColor = 'text-green-600 bg-green-50 border-green-200';
  if (isUrgent) timeColor = 'text-red-600 bg-red-50 border-red-200 animate-pulse';
  else if (isOverdue) timeColor = 'text-red-800 bg-red-100 border-red-300';
  else if (minutesUntilArrival <= 20) timeColor = 'text-amber-600 bg-amber-50 border-amber-200';

  const getNextStatusAction = (status) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Start Preparing', target: 'preparing', color: 'bg-brand-600 hover:bg-brand-700 text-white' };
      case 'preparing':
        return { label: 'Mark Ready', target: 'ready', color: 'bg-green-600 hover:bg-green-700 text-white' };
      case 'ready':
        return { label: 'Complete Order', target: 'completed', color: 'bg-blue-600 hover:bg-blue-700 text-white' };
      default:
        return null;
    }
  };

  const action = getNextStatusAction(order.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="outline-none cursor-grab active:cursor-grabbing mb-3"
    >
      <OrderCardContent
        order={order}
        onMove={onMove}
        nextAction={action}
        isUrgent={isUrgent}
        timeColor={timeColor}
        isOverdue={isOverdue}
        minutesUntilArrival={minutesUntilArrival}
        arrivalTime={arrivalTime}
      />
    </div>
  );
}

function Column({ title, id, orders, onMove, isMobile }) {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 ${isMobile ? 'w-full' : 'min-w-[300px]'} bg-gray-100/50 rounded-xl flex flex-col border border-gray-200/50 overflow-hidden`}
    >
      <div className="p-3 border-b border-gray-200 bg-white/50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <span className="bg-white border border-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto">
        <SortableContext id={id} items={orders.map(o => o.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {orders.map(order => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <OrderCard order={order} onMove={onMove} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
        {orders.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-gray-400 italic py-8">
            No orders
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveOrders() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeTab, setActiveTab] = useState('confirmed');

  // Dining Tables layout state
  const [tables, setTables] = useState([]);
  const [orderTablesLink, setOrderTablesLink] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchTables = async () => {
    if (!restaurant) return;
    try {
      // 1. Fetch tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('table_number', { ascending: true });

      if (tablesError) throw tablesError;

      // 2. Fetch active order links
      const { data: linkData, error: linkError } = await supabase
        .from('order_tables')
        .select(`
          order_id,
          table_id,
          orders:order_id (
            id,
            status,
            customers:customer_id (name, phone),
            arrival_time
          )
        `);

      if (linkError) throw linkError;

      setTables(tablesData || []);
      // Filter out links for completed/inactive orders
      const activeLinks = (linkData || []).filter(link => 
        link.orders && ['confirmed', 'preparing', 'ready'].includes(link.orders.status)
      );
      setOrderTablesLink(activeLinks);
    } catch (err) {
      console.error('Error fetching tables/links:', err);
    }
  };

  useEffect(() => {
    if (restaurant) {
      fetchOrders();
      fetchTables();
      
      // Setup Realtime subscription for orders
      const channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            const newResId = payload.new?.restaurant_id;
            const oldResId = payload.old?.restaurant_id;
            if (newResId === restaurant.id || oldResId === restaurant.id || payload.eventType === 'DELETE') {
              handleRealtimeEvent(payload);
              // Also refresh table-order linkages if statuses change
              fetchTables();
            }
          }
        )
        .subscribe();

      // Setup Realtime subscription for restaurant tables & orders mapping
      const tablesChannel = supabase.channel('tables-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'restaurant_tables' },
          () => {
            fetchTables();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'order_tables' },
          () => {
            fetchTables();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(tablesChannel);
      };
    }
  }, [restaurant]);

  const fetchOrders = async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers:customer_id (name, phone),
          order_items (
            id,
            quantity,
            menu_item_id,
            notes,
            menu_items:menu_item_id (name)
          )
        `)
        .eq('restaurant_id', restaurant.id)
        .in('status', ['confirmed', 'preparing', 'ready', 'completed'])
        .or(`status.neq.completed,arrival_time.gte.${startOfToday.toISOString()}`)
        .order('arrival_time', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      toast.error('Failed to load orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeEvent = async (payload) => {
    if (payload.eventType === 'INSERT') {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers:customer_id (name, phone),
          order_items (
            id,
            quantity,
            menu_item_id,
            notes,
            menu_items:menu_item_id (name)
          )
        `)
        .eq('id', payload.new.id)
        .single();
        
      if (!error && data) {
        setOrders(prev => [...prev, data]);
        toast('New Order Received!', {
          description: `Order from ${data.customers?.name}`,
          icon: '🔔',
          duration: 5000,
        });
        try {
          const audio = new Audio('/bell.mp3');
          audio.play().catch(e => console.log('Audio play blocked:', e));
        } catch(e){}
      }
    } else if (payload.eventType === 'UPDATE') {
      setOrders(prev => prev.map(o => (o.id === payload.new.id ? { ...o, ...payload.new } : o)));
    } else if (payload.eventType === 'DELETE') {
      setOrders(prev => prev.filter(o => o.id !== payload.old.id));
    }
  };

  const moveOrder = async (orderId, newStatus) => {
    const previousOrders = [...orders];
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      await supabase
        .from('order_status_log')
        .insert({
          order_id: orderId,
          status: newStatus
        });

      toast.success(`Order moved to ${newStatus}`);
      
      // Also refresh tables after manual order status move (so tables release when orders complete)
      fetchTables();
    } catch (err) {
      setOrders(previousOrders);
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const getTableStatus = (table) => {
    if (table.is_blocked) {
      return { status: 'blocked', order: null };
    }
    const activeLink = orderTablesLink.find(link => link.table_id === table.id);
    if (activeLink) {
      return { status: 'booked', order: activeLink.orders };
    }
    return { status: 'available', order: null };
  };

  const toggleTableBlock = async (tableId, currentBlockedStatus) => {
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ is_blocked: !currentBlockedStatus })
        .eq('id', tableId);
      if (error) throw error;
      toast.success(`Table ${currentBlockedStatus ? 'unblocked' : 'blocked'}`);
      fetchTables();
    } catch (err) {
      toast.error('Failed to update table: ' + err.message);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id;
    let newStatus = over.id;
    
    const overOrder = orders.find(o => o.id === over.id);
    if (overOrder) {
      newStatus = overOrder.status;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === newStatus || !COLUMNS.find(c => c.id === newStatus)) {
      return;
    }

    await moveOrder(orderId, newStatus);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const getOrdersByStatus = (status) => {
    return orders.filter(o => o.status === status);
  };

  const activeOrder = activeId ? orders.find(o => o.id === activeId) : null;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Live Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage incoming pre-orders in real-time</p>
        </div>
      </div>

      {/* Mobile Tab Selector */}
      <div className="md:hidden flex bg-gray-200/60 p-1 rounded-lg mb-4 gap-1">
        {COLUMNS.map(col => {
          const count = getOrdersByStatus(col.id).length;
          const isActive = activeTab === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                isActive 
                  ? 'bg-white text-brand-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {col.title} ({count})
            </button>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Desktop Kanban Board (hidden on mobile) */}
        <div className="hidden md:flex flex-1 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              orders={getOrdersByStatus(col.id)}
              onMove={moveOrder}
            />
          ))}
        </div>

        {/* Mobile Single Column View (hidden on desktop) */}
        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          {COLUMNS.filter(col => col.id === activeTab).map(col => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              orders={getOrdersByStatus(col.id)}
              onMove={moveOrder}
              isMobile={true}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOrder ? (
            <div className="w-[320px] select-none opacity-90 pointer-events-none rotate-1 shadow-lg">
              <OrderCardContent
                order={activeOrder}
                onMove={() => {}}
                nextAction={null}
                isUrgent={activeOrder.status === 'confirmed' && differenceInMinutes(parseISO(activeOrder.arrival_time), new Date()) <= 10 && differenceInMinutes(parseISO(activeOrder.arrival_time), new Date()) > -60}
                timeColor="text-gray-500 bg-gray-50 border-gray-200"
                isOverdue={differenceInMinutes(parseISO(activeOrder.arrival_time), new Date()) < 0}
                minutesUntilArrival={differenceInMinutes(parseISO(activeOrder.arrival_time), new Date())}
                arrivalTime={parseISO(activeOrder.arrival_time)}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dining Tables Layout & Live Status */}
      <div className="mt-6 border-t border-gray-200 pt-4 flex-shrink-0 bg-white rounded-xl border p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Dining Layout & Table Bookings</h3>
            <p className="text-xs text-gray-500">Real-time status of walk-ins and active app pre-orders</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500"></span> Available</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> App Booked</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500"></span> Offline Blocked</span>
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400 italic">
            No tables configured. Add dining tables in settings to track live bookings.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
            {tables.map(table => {
              const { status, order } = getTableStatus(table);
              return (
                <div 
                  key={table.id}
                  className={`p-3 rounded-xl border text-center relative transition-all duration-200 shadow-sm ${
                    status === 'available' ? 'bg-green-50/40 border-green-200 hover:border-green-300' :
                    status === 'booked' ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300' :
                    'bg-red-50/40 border-red-200 hover:border-red-300'
                  }`}
                >
                  <h4 className="font-bold text-gray-800 text-sm">{table.table_number}</h4>
                  <p className="text-[10px] text-gray-500 flex items-center justify-center gap-0.5 mt-0.5">
                    <Users className="h-2.5 w-2.5 text-brand-500" />
                    {table.capacity} seats
                  </p>

                  {/* Status Text & Actions */}
                  <div className="mt-2.5">
                    {status === 'available' ? (
                      <button
                        onClick={() => toggleTableBlock(table.id, false)}
                        className="w-full py-1 px-2 rounded-md bg-white border border-gray-200 text-[10px] font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                      >
                        Block Table
                      </button>
                    ) : status === 'blocked' ? (
                      <button
                        onClick={() => toggleTableBlock(table.id, true)}
                        className="w-full py-1 px-2 rounded-md bg-red-600 border border-transparent text-[10px] font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        Unblock
                      </button>
                    ) : (
                      <div className="text-[9px] font-bold text-amber-800 bg-amber-100/60 py-1 px-1.5 rounded-md truncate" title={`Order by ${order.customers?.name}`}>
                        👤 {order.customers?.name || 'Customer'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
