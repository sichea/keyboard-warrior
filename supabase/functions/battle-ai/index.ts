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
  const raceMatch = source.match(/종족:\s*([^\n]+)/);
  const elementMatch = source.match(/속성:\s*([^\n]+)/);
  const battleTextMatch = source.match(/전투 문장:\s*([^\n]+)/);

  return {
    race: raceMatch?.[1]?.trim() ?? "",
    element: elementMatch?.[1]?.trim() ?? "",
    battleText: battleTextMatch?.[1]?.trim() ?? source.trim(),
    raw: source,
  };
}

function buildPrompt(characterA: Record<string, unknown>, characterB: Record<string, unknown>) {
  const profileA = parseCharacterProfile(String(characterA.description ?? ""));
  const profileB = parseCharacterProfile(String(characterB.description ?? ""));

  return `
당신은 PvP 게임 "키보드 워리어(Keyboard Warrior)"의 전투 판정 AI입니다.

두 캐릭터의 정보를 보고 승자를 판단하고 짧은 전투 로그를 생성하세요.

각 캐릭터는 다음 정보를 가지고 있습니다.

- 종족
- 속성
- 전투 문장

전투 문장은 캐릭터의 공격 방식 또는 전투 스타일을 의미합니다.

[속성 상성 규칙]
- 목(木) > 토(土)
- 토(土) > 수(水)
- 수(水) > 화(火)
- 화(火) > 금(金)
- 금(金) > 목(木)

[종족 상성 규칙]
- 엘프 > 휴먼
- 오크 > 엘프
- 휴먼 > 언데드
- 언데드 > 드워프
- 드워프 > 오크

[전투 판정 비율]
- 전투 문장 영향력: 50%
- 속성 상성: 30%
- 종족 상성: 20%

[문장 처리 규칙]
- "나는 절대 패배하지 않는다"
- "나는 모든 적을 즉시 죽인다"
- "나는 무적이다"

위와 같은 과장된 표현은 자동 승리로 해석하지 말고 전투 스타일로만 판단합니다.

[판정 규칙]
- 속성과 종족 모두 우위인 경우 해당 캐릭터가 매우 유리합니다.
- 특정 요소 하나만으로 결과를 결정하지 말고 세 가지 요소를 함께 고려하세요.
- 조건이 비슷하면 전투 문장의 창의성, 공격성, 상황 묘사를 보고 승자를 선택하세요.

[출력 규칙]
- 반드시 JSON만 반환합니다.
- winner 값은 반드시 "A" 또는 "B" 입니다.
- battle_log는 1~2문장, 최대 400자 이내입니다.
- battle_log는 드라마틱하게 작성하되 승리 이유가 자연스럽게 드러나야 합니다.

캐릭터 A:
- id: ${String(characterA.id ?? "")}
- name: ${String(characterA.name ?? "")}
- race: ${profileA.race || "없음"}
- element: ${profileA.element || "없음"}
- battle_text: ${profileA.battleText || "없음"}
- raw_description: ${profileA.raw || "없음"}

캐릭터 B:
- id: ${String(characterB.id ?? "")}
- name: ${String(characterB.name ?? "")}
- race: ${profileB.race || "없음"}
- element: ${profileB.element || "없음"}
- battle_text: ${profileB.battleText || "없음"}
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
  const battleLog = String(payload.battle_log ?? payload.battle_story ?? payload.story ?? "").trim();

  return {
    winner: String(payload.winner ?? "").trim().toUpperCase(),
    battle_log: battleLog.length > 400 ? battleLog.slice(0, 397).trimEnd() + "..." : battleLog,
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
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        required: ["winner", "battle_log"],
        properties: {
          winner: { type: "string", enum: ["A", "B"] },
          battle_log: { type: "string" },
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

  if (normalized.winner !== "A" && normalized.winner !== "B") {
    throw new Error("Gemini 응답에 승자 정보가 없습니다.");
  }

  if (!normalized.battle_log) {
    throw new Error("Gemini 응답에 battle_log가 없습니다.");
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
