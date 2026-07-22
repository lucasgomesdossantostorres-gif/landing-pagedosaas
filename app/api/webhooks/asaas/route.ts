import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "asaas-webhook",
  });
}

export async function POST() {
  return NextResponse.json({
    received: true,
  });
}