import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function DELETE(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const profile = user; // user is already the profile from getUserProfileFromRequest

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const { error } = await supabaseAdmin
            .from('ta_schedules')
            .delete()
            .eq('ta_id', profile.id);

        if (error) throw error;

        await supabaseAdmin
            .from('users')
            .update({ last_schedule_update: new Date().toISOString() })
            .eq('id', profile.id);

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
