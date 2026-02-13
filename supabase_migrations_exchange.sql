-- Create exchange_requests table
CREATE TABLE IF NOT EXISTS public.exchange_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    original_ta_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    new_ta_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;

-- Allow TAs to see their own requests (or requests where they are the new TA)
CREATE POLICY "TAs can view own requests" ON public.exchange_requests
    FOR SELECT USING (
        auth.uid() IN (
            SELECT auth_id FROM public.users WHERE id = original_ta_id OR id = new_ta_id
        )
    );

-- Allow TAs to create requests for themselves
CREATE POLICY "TAs can create requests" ON public.exchange_requests
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT auth_id FROM public.users WHERE id = original_ta_id)
    );

-- Allow admins to view all requests
-- (Assuming admins have a way to be identified, or we trust service role for admin ops)
-- For now, let's allow public read for simplicity in development, or rely on service role
CREATE POLICY "Public read requests" ON public.exchange_requests FOR SELECT USING (true);
