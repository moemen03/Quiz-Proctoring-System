import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function PUT(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { category } = body;

        let query = supabaseAdmin
            .from('admin_notifications')
            .update({ read: true })
            .eq('read', false);

        if (category === 'schedule') {
            query = query.eq('type', 'schedule_change');
        } else if (category === 'system') {
            query = query.neq('type', 'schedule_change');
        }

        const { error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
