import { NextResponse } from "next/server";

import { requireMenuAccess, requireSession } from "@/lib/auth";
import { getWebsiteUrls, saveWebsiteUrls } from "@/services/websiteUrlService";

export const GET = async (request) => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const { searchParams } = new URL(request.url);
    const keys = searchParams.getAll("key");
    const data = await getWebsiteUrls(keys);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-website-url");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await saveWebsiteUrls(body?.items);

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};
