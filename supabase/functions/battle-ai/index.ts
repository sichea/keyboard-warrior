import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function parseCharacterProfile(description: string | undefined) {
  const source = String(description ?? "");
  const settingsMatch = source.match(/설정:\s*([^\n]+)/);
  const skillsMatch = source.match(/스킬:\s*([^\n]+)/);
  const settings = settingsMatch?.[1]?.trim() ?? source.trim();
  const skills = (skillsMatch?.[1] ?? "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    settings,
    skills,
    raw: source,
  };
}

function buildPrompt(characterA: Record<string, unknown>, characterB: Record<string, unknown>) {
  const profileA = parseCharacterProfile(String(characterA.description ?? ""));
  const profileB = parseCharacterProfile(String(characterB.description ?? ""));

  return `
너는 텍스트 배틀 게임의 엄격한 심판이다.
목표는 "누가 이겼는지"보다 "왜 이겼는지"를 인과적으로 설명하는 것이다.

규칙:
1. 두 캐릭터의 설정과 스킬만 근거로 판단한다.
2. 외부 세계관, 임의의 밈, 편향을 추가하지 않는다.
3. 승자는 반드시 한 명만 선택한다.
4. reasoning에는 승리 원인과 패배 원인을 직접적으로 설명한다.
5. battle_story는 초반, 중반, 결정타가 이어지는 자연스러운 전투 서사로 작성한다.
6. key_factors에는 승패를 가른 핵심 요소를 짧은 문구 2~4개로 넣는다.
7. confidence는 0부터 100 사이 정수다.
8. 출력은 JSON만 반환한다.

캐릭터 A:
- id: ${String(characterA.id ?? "")}
- name: ${String(characterA.name ?? "")}
- settings: ${profileA.settings}
- skills: ${profileA.skills.join(", ") || "없음"}
- raw_description: ${profileA.raw || "없음"}

캐릭터 B:
- id: ${String(characterB.id ?? "")}
- name: ${String(characterB.name ?? "")}
- settings: ${profileB.settings}
- skills: ${profileB.skills.join(", ") || "없음"}
- raw_description: ${profileB.raw || "없음"}
`.trim();
}

function extractJsonText(value: string) {
  const source = String(value ?? "").trim();

  if (!source) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return source;
}

function normalizeDecisionPayload(payload: Record<string, unknown>) {
  return {
    winner_id: String(payload.winner_id ?? ""),
    winner_name: String(payload.winner_name ?? ""),
    reasoning: String(payload.reasoning ?? ""),
    battle_story: String(payload.battle_story ?? payload.story ?? ""),
    confidence: Number(payload.confidence ?? 0),
    key_factors: Array.isArray(payload.key_factors) ? payload.key_factors.map(String) : [],
  };
}

async function callGemini(characterA: Record<string, unknown>, characterB: Record<string, unknown>) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경 변수가 비어 있습니다.");
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(characterA, characterB) }],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        required: ["winner_id", "winner_name", "reasoning", "battle_story", "confidence", "key_factors"],
        properties: {
          winner_id: { type: "string" },
          winner_name: { type: "string" },
          reasoning: { type: "string" },
          battle_story: { type: "string" },
          confidence: { type: "integer" },
          key_factors: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini 응답에서 JSON 텍스트를 찾지 못했습니다.");
  }

  const parsed = JSON.parse(extractJsonText(text));
  const normalized = normalizeDecisionPayload(parsed);

  if (!normalized.winner_id && !normalized.winner_name) {
    throw new Error("Gemini 응답에 승자 정보가 없습니다.");
  }

  if (!normalized.reasoning) {
    throw new Error("Gemini 응답에 판정 근거가 없습니다.");
  }

  return normalized;
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
    const characterA = body?.character_a;
    const characterB = body?.character_b;

    if (!characterA?.id || !characterB?.id) {
      return jsonResponse({ error: "character_a와 character_b가 필요합니다." }, 400);
    }

    const result = await callGemini(characterA, characterB);

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
