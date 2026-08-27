import { getAiRuntimeConfig } from "@/services/apiAiService";

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

  const rendered_prompt = Object.entries(prompt_variables).reduce(
    (result, [key, value]) => {
      return result.replaceAll(`{{${key}}}`, String(value ?? ""));
    },
    prompt,
  );

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
    const error_text = await result.text();

    throw new Error(`AI request gagal (${result.status}): ${error_text}`);
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
