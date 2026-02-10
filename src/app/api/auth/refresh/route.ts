import { NextResponse } from 'next/server';
import { getAuthClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { refresh_token } = await req.json();

        if (!refresh_token) {
            return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
        }

        const authClient = getAuthClient();
        const { data, error } = await authClient.auth.refreshSession({ refresh_token });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json({
            session: {
                access_token: data.session?.access_token,
                refresh_token: data.session?.refresh_token,
                expires_at: data.session?.expires_at
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
    }
}
