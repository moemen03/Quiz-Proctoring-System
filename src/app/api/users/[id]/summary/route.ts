import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Get user info
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (userError) throw userError;

        // Get all assignments for this TA
        const { data: assignments, error: assignError } = await supabaseAdmin
            .from('assignments')
            .select(`
                *,
                quizzes (*),
                locations (*)
            `)
            .eq('ta_id', id);

        if (assignError) throw assignError;

        // Get upcoming assignments
        const today = new Date().toISOString().split('T')[0];
        // Need to check if assignments.quizzes is not null/array? 
        // Supabase returns object if single relation, but here it's many-to-one (assignment belongs to quiz).
        // So `quizzes` is an object.

        const upcoming = assignments?.filter((a: any) => a.quizzes && a.quizzes.date >= today) || [];
        const completed = assignments?.filter((a: any) => a.quizzes && a.quizzes.date < today) || [];

        return NextResponse.json({
            user,
            total_assignments: assignments?.length || 0,
            upcoming_assignments: upcoming.length,
            completed_assignments: completed.length,
            assignments
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
