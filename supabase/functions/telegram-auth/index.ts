import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function toUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(keyBytes: Uint8Array, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", key, toUint8Array(value));
}

function buildDataCheckString(params: URLSearchParams) {
  return Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

async function validateTelegramInitData(initData: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN 환경 변수가 비어 있습니다.");
  }

  const params = new URLSearchParams(String(initData || ""));
  const hash = params.get("hash");
  const userRaw = params.get("user");
  const authDate = Number(params.get("auth_date") || 0);

  if (!hash || !userRaw || !authDate) {
    throw new Error("Telegram initData에 필수 값이 없습니다.");
  }

  if (Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SECONDS) {
    throw new Error("Telegram initData가 만료되었습니다.");
  }

  const secretKey = new Uint8Array(await hmacSha256(toUint8Array("WebAppData"), TELEGRAM_BOT_TOKEN));
  const dataCheckString = buildDataCheckString(params);
  const expectedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (expectedHash !== hash) {
    throw new Error("Telegram initData 검증에 실패했습니다.");
  }

  const user = JSON.parse(userRaw);

  return {
    telegram_id: String(user.id),
    nickname: String(
      user.username ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      ""
    ).trim(),
    first_name: String(user.first_name || "").trim(),
    last_name: String(user.last_name || "").trim(),
    username: String(user.username || "").trim(),
    auth_date: authDate,
    verified: true,
  };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const initData = String(body?.init_data || "").trim();

    if (!initData) {
      return jsonResponse({ error: "init_data가 필요합니다." }, 400);
    }

    return jsonResponse(await validateTelegramInitData(initData));
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
