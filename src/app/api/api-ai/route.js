import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getAiApiSettings, saveApiAiSettings } from "@/services/apiAiService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getAiApiSettings();

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
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await saveApiAiSettings({
      base_url: body?.base_url,
      model: body?.model,
      api_key: body?.api_key,
      prompts: Array.isArray(body?.prompts)
        ? body.prompts
        : Array.isArray(body?.prompt)
          ? body.prompt
          : body?.prompt_name && body?.prompt_value
            ? [
                {
                  name: body.prompt_name,
                  prompt: body.prompt_value,
                },
              ]
            : [],
    });

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
