-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'ta')) NOT NULL,
    major TEXT NOT NULL,
    auth_id UUID UNIQUE, -- Links to Supabase Auth
    max_assignments INTEGER DEFAULT 0,
    current_assignments INTEGER DEFAULT 0,
    day_off TEXT,
    total_workload_points NUMERIC DEFAULT 0,
    target_workload NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes Table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_name TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'upcoming',
    min_proctors INTEGER DEFAULT 1,
    major TEXT NOT NULL,
    weight NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    weight_multiplier NUMERIC DEFAULT 1
);

-- Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    ta_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'assigned',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TA Schedules Table
CREATE TABLE IF NOT EXISTS public.ta_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ta_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    slot_number INTEGER NOT NULL,
    course_name TEXT,
    course_type TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TA Excuses Table (Renamed from workload_excuses to match legacy)
CREATE TABLE IF NOT EXISTS public.ta_excuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ta_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    excuse_type TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- RLS Policies (Basic examples, refine as needed)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ta_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ta_excuses ENABLE ROW LEVEL SECURITY;

-- Allow public read access to users (for development ease, refine for prod)
CREATE POLICY "Public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public update users" ON public.users FOR UPDATE USING (true); -- CAREFUL

-- Policies for other tables similar...
-- For now, Service Role key bypasses RLS, so these policies are less critical for server-side logic but important for client-side if enabled.
-- Given we use Service Role for most operations in Next.js API routes (supabaseAdmin), RLS is bypassed.
-- But for client-side reads (if any), allow public read.

CREATE POLICY "Enable read access for all users" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ta_schedules FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ta_excuses FOR SELECT USING (true);
