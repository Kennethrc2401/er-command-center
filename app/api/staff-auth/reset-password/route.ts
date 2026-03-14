import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function POST(request: Request) {
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      officeKey?: string;
      newPassword?: string;
    };

    const username = body.username?.trim();
    const officeKey = body.officeKey?.trim();
    const newPassword = body.newPassword?.trim();

    if (!username || !officeKey || !newPassword) {
      return NextResponse.json(
        { error: "Username, office key, and new password are required." },
        { status: 400 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.users.resetPasswordWithOfficeKey, {
      username,
      officeKey,
      newPassword,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
