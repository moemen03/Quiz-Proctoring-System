import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (user.role !== 'admin') {
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
