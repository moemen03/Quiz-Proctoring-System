import { NextResponse } from "next/server";
import { supabaseAdmin, getUserProfileFromRequest } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const user = await getUserProfileFromRequest(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("ta_schedules")
      .select(
        `
                *,
                users (id, name, email)
            `
      )
      .order("day_of_week");

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const profile = await getUserProfileFromRequest(req);
    if (!profile)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // If admin, can set ta_id. If not, must be own id.
    let taId: string;

    if (profile.role === "admin") {
      if (!body.ta_id) {
        return NextResponse.json(
          { error: "Admin must specify ta_id" },
          { status: 400 }
        );
      }
      // Optional: Verify the target is actually a TA
      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", body.ta_id)
        .single();

      if (!targetUser || targetUser.role !== "ta") {
        return NextResponse.json(
          { error: "Target user is not a TA" },
          { status: 400 }
        );
      }
      taId = body.ta_id;
    } else {
      // TAs can only set their own schedule
      taId = profile.id;

      // Check current slot count
      const { count, error: countError } = await supabaseAdmin
        .from('ta_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('ta_id', taId);

      if (countError) throw countError;

      const currentSlots = count || 0;

      if (currentSlots >= 12) {
        return NextResponse.json(
          { error: "Maximum 12 slots allowed per week" },
          { status: 400 }
        );
      }

      if (currentSlots >= 10) {
        // Check for existing unread warning
        const { data: existingWarning } = await supabaseAdmin
          .from('admin_notifications')
          .select('id')
          .eq('type', 'schedule_warning')
          .eq('ta_id', taId)
          .eq('read', false)
          .single();

        const message = `TA ${profile.name} has added more than 10 slots to their schedule (${currentSlots + 1} slots).`;

        if (existingWarning) {
          // Update existing warning
          await supabaseAdmin
            .from('admin_notifications')
            .update({
              message,
              created_at: new Date().toISOString() // Bump to top
            })
            .eq('id', existingWarning.id);
        } else {
          // Create new warning
          await supabaseAdmin.from('admin_notifications').insert({
            type: 'schedule_warning',
            message,
            ta_id: taId,
          });
        }
      }
    }

    // Create schedule slot
    const { data, error } = await supabaseAdmin
      .from("ta_schedules")
      .insert({ ...body, ta_id: taId })
      .select()
      .single();

    if (error) throw error;

    // Notification for schedule change (if TA is updating their own schedule)
    if (profile.role !== 'admin') {
      await supabaseAdmin.from('admin_notifications').insert({
        type: 'schedule_change',
        message: `TA ${profile.name} added a slot on ${body.day_of_week} at Slot ${body.slot_number}.`,
        ta_id: taId,
      });
    }

    // Update last_schedule_update for the user
    await supabaseAdmin
      .from('users')
      .update({ last_schedule_update: new Date().toISOString() })
      .eq('id', taId);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
