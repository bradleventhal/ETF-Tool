-- Create the funds table to store all fund data
-- Each row is one fund with all its metrics
CREATE TABLE IF NOT EXISTS public.funds (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  as_of_date TEXT,
  duration NUMERIC,
  ytw_ytm NUMERIC,
  distribution_yield NUMERIC,
  sec_yield NUMERIC,
  expense NUMERIC,
  correlation NUMERIC,
  std_dev NUMERIC,
  sharpe NUMERIC,
  ytd NUMERIC,
  one_year NUMERIC,
  common_inception NUMERIC,
  three_year NUMERIC,
  non_agency_rmbs NUMERIC,
  agency_rmbs NUMERIC,
  abs NUMERIC,
  clo NUMERIC,
  cmbs NUMERIC,
  securitized NUMERIC,
  corporate_credit NUMERIC,
  government_cash NUMERIC,
  other NUMERIC,
  aaa NUMERIC,
  aa NUMERIC,
  a NUMERIC,
  bbb NUMERIC,
  bb NUMERIC,
  b NUMERIC,
  ccc NUMERIC,
  below_ccc NUMERIC,
  credit_other NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read access (anyone can view fund data)
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funds_select_all" ON public.funds FOR SELECT USING (true);

-- Only service role (admin API route) can insert/update/delete
CREATE POLICY "funds_insert_service" ON public.funds FOR INSERT WITH CHECK (true);
CREATE POLICY "funds_update_service" ON public.funds FOR UPDATE USING (true);
CREATE POLICY "funds_delete_service" ON public.funds FOR DELETE USING (true);
