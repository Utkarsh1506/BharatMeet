import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "bharat-meet",
        timestamp: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const requestId = randomUUID();
    apiLogger.error({ error, requestId, url: req.url }, "Health check database query failed");
    return NextResponse.json(
      {
        status: "error",
        service: "bharat-meet",
        requestId,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
