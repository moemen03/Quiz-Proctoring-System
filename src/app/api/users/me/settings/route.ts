import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
}

export async function GET(req: Request) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('day_off')
            .eq('auth_id', user.id)
            .single();

        return NextResponse.json(profile || { day_off: null });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
