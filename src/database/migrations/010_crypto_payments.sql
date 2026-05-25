-- =====================================================
-- 010_crypto_payments.sql
-- NOWPayments crypto checkout — track payment rail + invoice id
-- Applied to project xuwqhjgovdwiokubnjjd as migration "crypto_payment_columns".
-- Safe to re-run (idempotent).
-- =====================================================

-- proxy_orders: which rail paid for the order + the NOWPayments invoice id
alter table public.proxy_orders
  add column if not exists payment_method text not null default 'card',
  add column if not exists invoice_id text;

-- payment_history: mirror the same tracking columns on the ledger
alter table public.payment_history
  add column if not exists payment_method text not null default 'card',
  add column if not exists invoice_id text;

-- fast lookups when reconciling an inbound IPN callback to a local row
create index if not exists proxy_orders_invoice_idx on public.proxy_orders (invoice_id);
create index if not exists payment_history_invoice_idx on public.payment_history (invoice_id);

comment on column public.proxy_orders.payment_method is 'Payment rail: card | crypto';
comment on column public.proxy_orders.invoice_id is 'NOWPayments invoice id (crypto orders)';
comment on column public.payment_history.payment_method is 'Payment rail: card | crypto';
comment on column public.payment_history.invoice_id is 'NOWPayments invoice id (crypto payments)';
