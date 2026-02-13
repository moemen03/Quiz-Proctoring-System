import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export async function GET(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
    try {
        const { quizId } = await params;
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get quiz first
        const { data: quiz, error: quizError } = await supabaseAdmin
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();

        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const suggestions = await AssignmentService.getRankedTAs(quiz);

        return NextResponse.json({
            suggestions,
            quizWeight: quiz.weight,
            sessionInfo: {
                date: quiz.date,
                time: quiz.start_time,
                weight: quiz.weight,
                course: quiz.course_name
            }
        });

    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
