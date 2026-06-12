ALTER TABLE custom_orders
  ADD COLUMN IF NOT EXISTS agreed_price numeric;

ALTER TABLE custom_orders
  ADD COLUMN IF NOT EXISTS price_set_by uuid REFERENCES profiles(id) ON DELETE SET NULL;