-- ============================================================
-- SQL Migration: Setup Dining Tables & Bookings Tables
-- Paste this script in your Supabase SQL Editor and click RUN.
-- ============================================================

-- 1. Create restaurant tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE, -- manual block by owner
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_table_per_restaurant UNIQUE (restaurant_id, table_number)
);

-- 2. Create junction table for orders and tables (supports booking multiple tables per order)
CREATE TABLE IF NOT EXISTS public.order_tables (
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  PRIMARY KEY (order_id, table_id)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tables ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Allow public read restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "Allow public read restaurant_tables" 
  ON public.restaurant_tables FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owners insert restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "Allow owners insert restaurant_tables" 
  ON public.restaurant_tables FOR INSERT WITH CHECK (auth.uid() = restaurant_id);

DROP POLICY IF EXISTS "Allow owners update restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "Allow owners update restaurant_tables" 
  ON public.restaurant_tables FOR UPDATE USING (auth.uid() = restaurant_id);

DROP POLICY IF EXISTS "Allow owners delete restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "Allow owners delete restaurant_tables" 
  ON public.restaurant_tables FOR DELETE USING (auth.uid() = restaurant_id);

DROP POLICY IF EXISTS "Allow public read order_tables" ON public.order_tables;
CREATE POLICY "Allow public read order_tables" 
  ON public.order_tables FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert order_tables" ON public.order_tables;
CREATE POLICY "Allow public insert order_tables" 
  ON public.order_tables FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owners delete order_tables" ON public.order_tables;
CREATE POLICY "Allow owners delete order_tables" 
  ON public.order_tables FOR DELETE USING (true);
