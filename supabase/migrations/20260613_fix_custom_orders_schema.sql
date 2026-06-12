-- Drop existing custom_orders and order_messages if they exist (SAFE: fresh setup)
DROP TABLE IF EXISTS public.order_messages CASCADE;
DROP TABLE IF EXISTS public.custom_orders CASCADE;

-- Create custom_orders table with proper schema
CREATE TABLE public.custom_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  initial_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  agreed_price NUMERIC(10, 2),
  price_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_messages table
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_custom_orders_user_id ON public.custom_orders(user_id);
CREATE INDEX idx_custom_orders_status ON public.custom_orders(status);
CREATE INDEX idx_custom_orders_updated_at ON public.custom_orders(updated_at);
CREATE INDEX idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX idx_order_messages_created_at ON public.order_messages(created_at);

-- Enable RLS (Row-Level Security) for better access control
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_orders
CREATE POLICY "Users can view their own orders" ON public.custom_orders
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Users can create orders" ON public.custom_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update orders" ON public.custom_orders
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- RLS Policies for order_messages
CREATE POLICY "Users can view messages for their orders or as admin" ON public.order_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.custom_orders co WHERE co.id = order_id AND co.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users and admins can insert messages" ON public.order_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM public.custom_orders co WHERE co.id = order_id AND co.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.custom_orders TO authenticated;
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
