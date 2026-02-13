import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export async function POST(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        // We expect the full quiz object or enough data to preview
        // The service expects quiz data
        const preview = await AssignmentService.previewAssign(body);

        return NextResponse.json(preview);

    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
