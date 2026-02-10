import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, id')
            .eq('auth_id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 });

        if (profile.role !== 'admin') {
            const { data: schedule } = await supabaseAdmin
                .from('ta_schedules')
                .select('ta_id')
                .eq('id', id)
                .single();

            if (!schedule || schedule.ta_id !== profile.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { data, error } = await supabaseAdmin
            .from('ta_schedules')
            .update(body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, id')
            .eq('auth_id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 401 });

        if (profile.role !== 'admin') {
            const { data: schedule } = await supabaseAdmin
                .from('ta_schedules')
                .select('ta_id')
                .eq('id', id)
                .single();

            if (!schedule || schedule.ta_id !== profile.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const { error } = await supabaseAdmin
            .from('ta_schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
