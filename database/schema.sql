CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS app_users(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),phone_e164 TEXT UNIQUE,email TEXT UNIQUE,preferred_language TEXT NOT NULL DEFAULT 'en' CHECK(preferred_language IN('en','te','hi','or')),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS bills(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,provider TEXT,billing_period TEXT,units_consumed NUMERIC(12,2) NOT NULL CHECK(units_consumed>=0),total_amount NUMERIC(12,2) NOT NULL CHECK(total_amount>=0),fixed_charges NUMERIC(12,2) NOT NULL DEFAULT 0,energy_charges NUMERIC(12,2) NOT NULL DEFAULT 0,taxes NUMERIC(12,2) NOT NULL DEFAULT 0,other_charges NUMERIC(12,2) NOT NULL DEFAULT 0,currency CHAR(3) NOT NULL DEFAULT 'INR',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bills_owner_created_idx ON bills(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS tariff_versions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),provider_code TEXT NOT NULL,state_code TEXT NOT NULL,category_code TEXT NOT NULL,effective_from DATE NOT NULL,effective_to DATE,tariff_json JSONB NOT NULL,source_reference TEXT NOT NULL,verified_by TEXT,verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK(effective_to IS NULL OR effective_to>=effective_from));
CREATE TABLE IF NOT EXISTS consent_records(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,policy_version TEXT NOT NULL,granted BOOLEAN NOT NULL,recorded_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Clerk identity mapping for authenticated customer accounts.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;
