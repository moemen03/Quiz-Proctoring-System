import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
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
    const user = await getUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get profile to check role
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role, id")
      .eq("auth_id", user.id)
      .single();

    if (!profile)
      return NextResponse.json({ error: "Profile not found" }, { status: 401 });

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
    }

    const { data, error } = await supabaseAdmin
      .from("ta_schedules")
      .insert({ ...body, ta_id: taId })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
