import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        let token = cookieStore.get('access_token')?.value;
        const refreshToken = cookieStore.get('refresh_token')?.value;

        // Verify the token with Supabase
        let authUser = null;
        let authError = null;
        let newSession = null;

        if (token) {
            const { data, error } = await supabaseAdmin.auth.getUser(token);
            authUser = data.user;
            authError = error;
        }

        // If access token is missing or invalid, try to refresh if we have a refresh token
        if ((!token || authError) && refreshToken) {
            console.log('[Auth API] Access token missing or invalid, attempting refresh');
            const authClient = getAuthClient();
            const { data, error: refreshError } = await authClient.auth.refreshSession({ refresh_token: refreshToken });

            if (!refreshError && data.session) {
                console.log('[Auth API] Token refresh successful');
                authUser = data.user;
                token = data.session.access_token;
                newSession = data.session;
            } else {
                console.error('[Auth API] Token refresh failed:', refreshError);
            }
        }

        if (!authUser) {
            console.error('[Auth API] No authenticated user found');
            return NextResponse.json({ error: 'Unauthorized', details: authError?.message }, { status: 401 });
        }

        // Get user profile from public.users table
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            console.error('[Auth API] Profile not found for user:', authUser.id, profileError);
            return NextResponse.json({ error: 'User profile not found', details: profileError?.message }, { status: 401 });
        }

        const response = NextResponse.json({
            user: {
                id: userProfile.id,
                auth_id: authUser.id,
                email: userProfile.email,
                name: userProfile.name,
                role: userProfile.role,
                major: userProfile.major
            }
        });

        // If we refreshed the token, update cookies
        if (newSession) {
            response.cookies.set('access_token', newSession.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 1 week
            });

            if (newSession.refresh_token) {
                response.cookies.set('refresh_token', newSession.refresh_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 7 // 1 week
                });
            }
        }

        return response;

    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
    }
}
