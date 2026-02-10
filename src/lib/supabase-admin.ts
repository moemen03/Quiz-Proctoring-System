import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Fallback is for build time or dev without env, but runtime should have it
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const getAuthClient = () => createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});
