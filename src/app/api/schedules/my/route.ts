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

        // Get profile id from auth id
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const { data, error } = await supabaseAdmin
            .from('ta_schedules')
            .select('*')
            .eq('ta_id', profile.id)
            .order('day_of_week');

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
