import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
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

        const { error } = await supabaseAdmin
            .from('ta_excuses')
            .update({ status: 'revoked' })
            .eq('id', id);

        if (error) throw error;
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
