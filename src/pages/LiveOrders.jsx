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
import { Clock, Phone, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COLUMNS = [
  { id: 'confirmed', title: 'Confirmed' },
  { id: 'preparing', title: 'Preparing' },
  { id: 'ready', title: 'Ready' },
  { id: 'completed', title: 'Completed' },
];

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
      className={`bg-white rounded-lg shadow-sm border ${isUrgent ? 'border-red-400' : 'border-gray-200'} p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative overflow-hidden`}
    >
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
          <div className="text-xs font-bold px-2 py-1 rounded-md border text-green-700 bg-green-50 border-green-200">
            Completed
          </div>
        ) : (
          <div className={`text-xs font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${timeColor}`}>
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
        <span className="text-xs font-medium text-gray-500">ID: #{order.id.substring(0,6)}</span>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (restaurant) {
      fetchOrders();
      
      // Setup Realtime subscription
      const channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            // Only process events belonging to this restaurant (safe check; RLS also filters this automatically)
            const newResId = payload.new?.restaurant_id;
            const oldResId = payload.old?.restaurant_id;
            if (newResId === restaurant.id || oldResId === restaurant.id || payload.eventType === 'DELETE') {
              handleRealtimeEvent(payload);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
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
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (updateError) throw updateError;

      await supabase
        .from('order_status_log')
        .insert({
          order_id: orderId,
          status: newStatus
        });

      toast.success(`Order moved to ${newStatus}`);
    } catch (err) {
      setOrders(previousOrders);
      toast.error('Failed to update status: ' + err.message);
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
          {activeOrder ? <OrderCard order={activeOrder} onMove={moveOrder} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
