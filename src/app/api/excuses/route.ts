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

        // Get profile to check major/role
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, major')
            .eq('auth_id', user.id)
            .single();

        let query = supabaseAdmin.from('ta_excuses').select('*');

        // If needed, filter by major (legacy code doesn't explicitly filter by major in excuses route, 
        // but it might be good practice if excuses are major-specific. 
        // Admin usually sees everything or filtered by their major?).
        // Legacy: `router.get('/', ...)` returns all.
        // Let's return all for now or filter if profile has major.

        const { data, error } = await query.order('start_date', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('auth_id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { data, error } = await supabaseAdmin
            .from('ta_excuses')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
