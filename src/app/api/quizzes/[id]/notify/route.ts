import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserProfileFromRequest(req);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: quizId } = await params;

        // 1. Fetch quiz details
        const { data: quiz, error: quizError } = await supabaseAdmin
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();

        if (quizError || !quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        // 2. Fetch assignments with proctor details
        const { data: assignments, error: assignmentsError } = await supabaseAdmin
            .from('assignments')
            .select(`
        id,
        users (
          email,
          name
        ),
        locations (
          name
        )
      `)
            .eq('quiz_id', quizId);

        if (assignmentsError) throw assignmentsError;

        if (!assignments || assignments.length === 0) {
            return NextResponse.json({ count: 0, message: 'No proctors assigned to this quiz.' });
        }

        // 3. Send emails
        let sentCount = 0;
        const emailPromises = assignments.map(async (assignment: any) => {
            const proctorEmail = assignment.users?.email;
            const proctorName = assignment.users?.name;
            const locationName = assignment.locations?.name || 'Assigned Location';

            if (!proctorEmail) return;

            const { error } = await resend.emails.send({
                from: 'Quiz Proctoring <onboarding@resend.dev>',
                to: [proctorEmail],
                subject: `New Proctoring Assignment: ${quiz.course_name}`,
                html: `
          <h1>Hello ${proctorName},</h1>
          <p>You have been assigned to proctor a new quiz.</p>
          <p><strong>Course:</strong> ${quiz.course_name}</p>
          <p><strong>Date:</strong> ${quiz.date}</p>
          <p><strong>Time:</strong> ${quiz.start_time}</p>
          <p><strong>Location:</strong> ${locationName}</p>
          <p>Please log in to the portal to view more details.</p>
        `,
            });

            if (!error) {
                // 4. Update notified_at
                await supabaseAdmin
                    .from('assignments')
                    .update({ notified_at: new Date().toISOString() })
                    .eq('id', assignment.id);
                sentCount++;
            } else {
                console.error(`Failed to send email to ${proctorEmail}:`, error);
            }
        });

        await Promise.all(emailPromises);

        return NextResponse.json({
            success: true,
            count: sentCount,
            total: assignments.length
        });

    } catch (error) {
        console.error('Error notifying proctors:', error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
