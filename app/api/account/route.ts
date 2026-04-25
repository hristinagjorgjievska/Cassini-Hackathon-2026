import { NextRequest, NextResponse } from "next/server";
import { getAccountDashboard } from "@/lib/mockAccountDb";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId") ?? "demo-1";
  const data = await getAccountDashboard(accountId);

  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
