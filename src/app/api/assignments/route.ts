import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('assignments')
            .select(`
                *,
                quizzes (*),
                users (*),
                locations (*)
            `);

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

        // Check if admin? Or logic to allow assigning
        // Usually admins assign, but maybe authorized users too?
        // Legacy code checks for admin in some places but not strictly in api routes?
        // Let's assume admin for explicit assignment creation

        const body = await req.json();
        const { data, error } = await supabaseAdmin
            .from('assignments')
            .insert(body)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
