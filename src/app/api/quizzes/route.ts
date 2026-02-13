import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserMajor = user.major;

        let query = supabaseAdmin
            .from('quizzes')
            .select(`
        *,
        locations (*),
        assignments (
          *,
          users (name, email),
          locations (name)
        )
      `)
            .order('date', { ascending: true });

        if (currentUserMajor) {
            query = query.eq('major', currentUserMajor);
        }

        const { data, error } = await query;

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

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can create quizzes' }, { status: 403 });
        }

        const body = await req.json();
        const { locations, ...quizData } = body;
        const currentUserMajor = user.major;

        if (!currentUserMajor) {
            return NextResponse.json({ error: 'User major not found. Cannot create quiz.' }, { status: 400 });
        }

        // Create quiz with user's major
        const { data: quiz, error: quizError } = await supabaseAdmin
            .from('quizzes')
            .insert({ ...quizData, major: currentUserMajor })
            .select()
            .single();

        if (quizError) throw quizError;

        // Create locations
        if (locations && locations.length > 0) {
            const locationsWithQuizId = locations.map((loc: any) => ({
                ...loc,
                quiz_id: quiz.id
            }));

            const { error: locError } = await supabaseAdmin
                .from('locations')
                .insert(locationsWithQuizId);

            if (locError) throw locError;

            // Auto-assign proctors
            try {
                const newAssignments = await AssignmentService.autoAssign(quiz.id);
                (quiz as any).assignments = newAssignments;
            } catch (assignError) {
                console.error('Auto-assignment failed:', assignError);
            }
        }

        return NextResponse.json(quiz, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
