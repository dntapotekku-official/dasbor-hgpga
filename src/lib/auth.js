import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export default async function getCurrentUser() {
  const cookie_store = await cookies();
  const raw_session = cookie_store.get("user_session")?.value;

  return raw_session ? JSON.parse(raw_session) : null;
}

export async function requireSession() {
  const user_session = await getCurrentUser();

  if (!user_session) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  return null;
}
