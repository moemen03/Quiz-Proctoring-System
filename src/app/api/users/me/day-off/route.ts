import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function PUT(req: Request) {
    try {
        const profile = await getUserProfileFromRequest(req);
        if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { day_off } = body;

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
