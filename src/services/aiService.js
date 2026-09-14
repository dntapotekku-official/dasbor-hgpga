import { getAiRuntimeConfig } from "@/services/apiAiService";

const allowed_image_mime_types = new Set(["image/jpeg", "image/png", "image/webp"]);
const max_image_count = 5;
const max_image_base64_length = 11 * 1024 * 1024;
const max_total_image_base64_length = 28 * 1024 * 1024;

export async function scanNota({
  prompt_name,
  images = [],
  prompt_variables = {},
}) {
  const trimmed_prompt_name = String(prompt_name ?? "").trim();

  if (!trimmed_prompt_name) {
    throw new Error("Nama prompt wajib diisi.");
  }

  const { api_ai, prompt } = await getAiRuntimeConfig(trimmed_prompt_name);

  const rendered_prompt_template = Object.entries(prompt_variables).reduce(
    (result, [key, value]) => {
      return result.replaceAll(`{{${key}}}`, String(value ?? ""));
    },
    prompt,
  );
  const rendered_prompt = rendered_prompt_template;

  const normalized_images = images
    .map((item, index) => ({
      id: String(item?.id ?? index + 1),
      image: String(item?.image ?? "").trim(),
      mime_type: String(item?.mime_type ?? "").trim(),
    }))
    .filter((item) => item.image && item.mime_type);

  if (!normalized_images.length) {
    throw new Error("Minimal satu gambar wajib diisi.");
  }

  if (normalized_images.length > max_image_count) {
    throw new Error(`Maksimal ${max_image_count} gambar dalam satu permintaan.`);
  }

  if (normalized_images.some((item) => !allowed_image_mime_types.has(item.mime_type))) {
    throw new Error("Format gambar yang didukung hanya JPEG, PNG, dan WebP.");
  }

  if (normalized_images.some((item) => item.image.length > max_image_base64_length)) {
    throw new Error("Ukuran setiap gambar maksimal 8 MB.");
  }

  const total_image_length = normalized_images.reduce(
    (total, item) => total + item.image.length,
    0,
  );

  if (total_image_length > max_total_image_base64_length) {
    throw new Error("Total ukuran gambar maksimal 20 MB.");
  }

  const result = await fetch(api_ai.base_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_ai.api_key}`,
    },
    body: JSON.stringify({
      model: api_ai.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: rendered_prompt,
            },
            ...normalized_images.map((image_item) => ({
              type: "image_url",
              image_url: {
                url: `data:${image_item.mime_type};base64,${image_item.image}`,
              },
            })),
          ],
        },
      ],
    }),
  });

  if (!result.ok) {
    throw new Error(`AI request gagal (${result.status}).`);
  }

  const payload = await result.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Respons AI kosong.");
  }

  const normalized_content = String(content ?? "").trim().startsWith("```")
    ? String(content ?? "")
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    : String(content ?? "").trim();

  try {
    return JSON.parse(normalized_content);
  } catch {
    return {
      raw_content: normalized_content,
    };
  }
}
