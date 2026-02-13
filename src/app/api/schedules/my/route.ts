import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const profile = user;

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
