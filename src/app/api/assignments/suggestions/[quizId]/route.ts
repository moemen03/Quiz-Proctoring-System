import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export async function GET(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
    try {
        const { quizId } = await params;
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify user (could be middleware, but doing inline for now)
        const token = authHeader.split(' ')[1];
        const { error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
