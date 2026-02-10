import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export const dynamic = 'force-dynamic';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    console.log('[API] Auth Header:', authHeader ? 'Present' : 'Missing');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    console.log('[API] Token:', token.substring(0, 10) + '...');

    // Auth
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
        console.error('[API] Auth Error:', error.message);
        return null;
    }
    if (!authUser) {
        console.log('[API] No Auth User found');
        return null;
    }

    // Profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

    if (profileError) {
        console.error('[API] Profile Error:', profileError.message);
    }

    return userProfile;
}

export async function GET(req: Request) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserMajor = user.major;

        let query = supabaseAdmin
            .from('quizzes')
            .select(`
        *,
        locations (*),
        assignments (
          *,
          users (name),
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
        const user = await getUser(req);
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
