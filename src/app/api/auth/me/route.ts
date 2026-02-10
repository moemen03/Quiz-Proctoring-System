import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];

        // Verify the token with Supabase
        const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        // Get user profile from public.users table
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 401 });
        }

        return NextResponse.json({
            user: {
                id: userProfile.id,
                auth_id: authUser.id,
                email: userProfile.email,
                name: userProfile.name,
                role: userProfile.role,
                major: userProfile.major
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
    }
}
