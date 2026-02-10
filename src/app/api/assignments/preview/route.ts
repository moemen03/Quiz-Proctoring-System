import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        // We expect the full quiz object or enough data to preview
        // The service expects quiz data
        const preview = await AssignmentService.previewAssign(body);

        return NextResponse.json(preview);

    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
