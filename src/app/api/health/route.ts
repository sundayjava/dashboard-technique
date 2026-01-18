import { NextResponse } from "next/server";
import { HTTP_STATUS } from "@/constants";

/**
 * Example API Route - Health Check
 * GET /api/health
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        success: true,
        message: "API is healthy",
        timestamp: new Date().toISOString(),
      },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "API health check failed",
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
