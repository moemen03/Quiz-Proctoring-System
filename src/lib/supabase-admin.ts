import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

// Helper to get user from request, prioritizing cookies (HttpOnly) over headers (stale localStorage)
export async function getUserFromRequest(req: Request) {
    // 1. Try to get token from cookies (Source of Truth for web client)
    const cookieStore = await cookies();
    let token = cookieStore.get('access_token')?.value;

    // 2. Fallback to Authorization header (for API clients or if cookies fail)
    if (!token) {
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return null;
    return user;
}

/**
 * Gets the consolidated user profile from a request, 
 * prioritizing cookies for web client sessions.
 */
export async function getUserProfileFromRequest(req: Request) {
    const authUser = await getUserFromRequest(req);
    if (!authUser) return null;

    const { data: profile, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

    if (error || !profile) {
        console.error('[Auth] Profile fetch error:', error?.message);
        return null;
    }

    return profile;
}
