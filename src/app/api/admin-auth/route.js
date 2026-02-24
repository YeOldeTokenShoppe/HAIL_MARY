import { NextResponse } from "next/server";

export async function POST(req) {
  const { password } = await req.json();
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct || password !== correct) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
