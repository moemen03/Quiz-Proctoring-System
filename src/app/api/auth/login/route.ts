import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const authClient = getAuthClient();
        const { data, error } = await authClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        // Get user profile using ADMIN client (bypasses RLS)
        let { data: profile } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', data.user?.id)
            .single();

        // Auto-create profile if it doesn't exist
        if (!profile && data.user) {
            const userName = data.user.user_metadata?.name ||
                data.user.email?.split('@')[0] ||
                'User';
            const userMajor = data.user.user_metadata?.major || 'CS'; // Default to CS

            const { data: newProfile, error: createError } = await supabaseAdmin
                .from('users')
                .insert({
                    auth_id: data.user.id,
                    email: data.user.email,
                    name: userName,
                    role: 'ta',
                    major: userMajor
                })
                .select()
                .single();

            if (createError) {
                console.error('Failed to create user profile:', createError);
                return NextResponse.json({ error: `Failed to create user profile: ${createError.message}` }, { status: 500 });
            }

            profile = newProfile;
        }

        return NextResponse.json({
            user: {
                id: profile?.id,
                email: data.user?.email,
                name: profile?.name,
                role: profile?.role,
                major: profile?.major
            },
            session: {
                access_token: data.session?.access_token,
                refresh_token: data.session?.refresh_token,
                expires_at: data.session?.expires_at
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
