import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

async function get_active_ai_config() {
  const api_ai = await prisma.tbl_api_ai.findFirst({
    where: {
      deleted_at: null,
    },
    orderBy: {
      updated_at: "desc",
    },
    select: {
      uuid: true,
      base_url: true,
      model: true,
      api_key: true,
    },
  });

  const prompt_rows = await prisma.tbl_prompt.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: {
      updated_at: "desc",
    },
    select: {
      uuid: true,
      name: true,
      prompt: true,
    },
  });

  return {
    api_ai,
    prompt_rows,
  };
}

export async function getAiApiSettings() {
  const { api_ai, prompt_rows } = await get_active_ai_config();

  return {
    api_ai: api_ai ? {
      uuid: api_ai.uuid,
      base_url: api_ai.base_url,
      model: api_ai.model,
    } : null,
    prompts: prompt_rows.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      prompt: item.prompt,
    }))
  };
}

export async function getAiRuntimeConfig(prompt_name) {
  const trimmed_prompt_name = String(prompt_name ?? "").trim();

  if (!trimmed_prompt_name) {
    throw new Error("Nama prompt wajib diisi.");
  }

  const { api_ai, prompt_rows } = await get_active_ai_config();
  const prompt_row = prompt_rows.find((item) => item.name === trimmed_prompt_name);

  if (!api_ai) {
    throw new Error("Konfigurasi AI API belum tersedia.");
  }

  if (!prompt_row?.prompt) {
    throw new Error("Prompt AI tidak ditemukan.");
  }

  return {
    api_ai,
    prompt: prompt_row.prompt,
  };
}

export async function saveApiAiSettings({
  base_url,
  model,
  api_key,
  prompts = [],
}) {
  const trimmed_base_url = String(base_url ?? "").trim();
  const trimmed_model = String(model ?? "").trim();
  const trimmed_api_key = String(api_key ?? "").trim();
  const normalized_prompts = prompts
    .map((prompt) => {
      if (typeof prompt === "string") {
        return {
          name: "",
          prompt,
        };
      }

      return {
        name: String(prompt?.name ?? "").trim(),
        prompt: String(prompt?.prompt ?? prompt?.value ?? "").trim(),
      };
    })
    .filter((item) => item.name && item.prompt);

  if (!trimmed_base_url) {
    throw new Error("Base URL wajib diisi.");
  }

  if (!trimmed_model) {
    throw new Error("Model wajib diisi.");
  }

  if (!normalized_prompts.length) {
    throw new Error("Minimal satu prompt wajib diisi.");
  }

  const { api_ai, prompt_rows } = await get_active_ai_config();
  const next_api_key = trimmed_api_key || api_ai?.api_key || "";

  if (!next_api_key) {
    throw new Error("API KEY wajib diisi.");
  }

  await prisma.$transaction(async (transaction) => {
    if (api_ai) {
      await transaction.tbl_api_ai.update({
        where: {
          uuid: api_ai.uuid,
        },
        data: {
          base_url: trimmed_base_url,
          model: trimmed_model,
          api_key: next_api_key,
        },
      });
    } else {
      await transaction.tbl_api_ai.create({
        data: {
          uuid: randomUUID(),
          base_url: trimmed_base_url,
          model: trimmed_model,
          api_key: next_api_key,
        },
      });
    }

    for (const prompt_item of normalized_prompts) {
      const existing_prompt = prompt_rows.find(
        (item) => item.name === prompt_item.name,
      );

      if (existing_prompt) {
        await transaction.tbl_prompt.update({
          where: {
            uuid: existing_prompt.uuid,
          },
          data: {
            prompt: prompt_item.prompt,
            deleted_at: null,
          },
        });
        continue;
      }

      await transaction.tbl_prompt.create({
        data: {
          uuid: randomUUID(),
          name: prompt_item.name,
          prompt: prompt_item.prompt,
        },
      });
    }
  });

  return {
    success: true,
    data: await getAiApiSettings(),
    message: "Pengaturan AI API berhasil disimpan.",
  };
}
