import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        const { error } = await supabaseAdmin
            .from('admin_notifications')
            .update({ read: true })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
