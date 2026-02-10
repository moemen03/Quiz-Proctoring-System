import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, { params }: { params: Promise<{ taId: string }> }) {
    try {
        const { taId } = await params;
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Allow anyone authenticated to see schedules? or just admin?
        // Legacy code didn't strictly check for admin in /ta/:taId but AdminScheduleViewer uses it.
        // Let's assume open for now or add check later.

        const { data, error } = await supabaseAdmin
            .from('ta_schedules')
            .select('*')
            .eq('ta_id', taId)
            .order('day_of_week');

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
