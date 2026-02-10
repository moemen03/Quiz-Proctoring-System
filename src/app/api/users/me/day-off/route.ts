import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
}

export async function PUT(req: Request) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { day_off } = body;

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('auth_id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        if (profile.role !== 'ta') {
            return NextResponse.json({ error: 'Only TAs can set days off' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ day_off })
            .eq('id', profile.id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
