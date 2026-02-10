import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');

        let query = supabaseAdmin.from('users').select('*');
        if (role) {
            query = query.eq('role', role);
        }

        const { data, error } = await query.order('name');

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
