-- =============================================
-- OKNews24 - Schema Supabase PostgreSQL
-- Copia e incolla nel SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/iencfxwfopjvwhuhmvsa/sql/new
-- =============================================

-- Profili utente (estende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  articles_read INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  subscription_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  enabled_feeds TEXT[] DEFAULT '{}',
  favorite_feed TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feed RSS
CREATE TABLE IF NOT EXISTS public.feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Articoli
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id TEXT UNIQUE NOT NULL,
  feed_id TEXT NOT NULL,
  feed_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  link TEXT UNIQUE NOT NULL,
  image_url TEXT,
  author TEXT,
  pub_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Articoli salvati
CREATE TABLE IF NOT EXISTS public.saved_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Abbonamenti
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT,
  stripe_session_id TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token push notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Reset password con codice (custom flow)
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe config cache
CREATE TABLE IF NOT EXISTS public.stripe_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,
  monthly_price_id TEXT,
  yearly_price_id TEXT,
  product_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_config ENABLE ROW LEVEL SECURITY;

-- Policies: service role bypass tutto (per il backend Python)
CREATE POLICY "service_role_profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_feeds" ON public.feeds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_articles" ON public.articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_saved" ON public.saved_articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_subs" ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_push" ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_resets" ON public.password_resets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_stripe" ON public.stripe_config FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Trigger: crea profilo automaticamente al signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, picture)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Indici per performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON public.articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON public.articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_link ON public.articles(link);
CREATE INDEX IF NOT EXISTS idx_saved_articles_user_id ON public.saved_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
