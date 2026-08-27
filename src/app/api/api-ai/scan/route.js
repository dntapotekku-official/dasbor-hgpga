import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth";
import { getAiApiSettings } from "@/services/apiAiService";
import { getProdukGofitku } from "@/services/produkGofitkuService";
import { scanNota } from "@/services/aiService";

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const { data_produk_gofitku } = await getProdukGofitku();
    const ai_settings = await getAiApiSettings();
    const images = Array.isArray(body?.images)
      ? body.images
      : body?.image && body?.mime_type
        ? [
            {
              id: body?.id ?? "1",
              image: body.image,
              mime_type: body.mime_type,
            },
          ]
        : [];

    const data = await scanNota({
      prompt_name: body?.prompt_name || ai_settings.prompts?.[0]?.name,
      images,
      prompt_variables: {
        product_list: data_produk_gofitku
          .map((item) => `- ${item.name}`)
          .join("\n"),
      },
    });

    return NextResponse.json({
      success: true,
      data,
      message: "Scan nota berhasil diproses.",
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
