# 텍스트 배틀 모바일 웹앱 MVP

순수 HTML, CSS, Vanilla JavaScript만 사용한 정적 모바일 웹앱 프론트엔드입니다.

## 파일 구성

- `home.html`
- `ranking.html`
- `mock-battle.html`
- `code-battle.html`
- `account.html`
- `styles.css`
- `app.js`
- `README.md`

## 실행 방법

아무 정적 서버로 바로 실행할 수 있습니다.

예시:

```bash
npm run dev
```

또는:

```bash
python3 -m http.server 8080
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8080/home.html
```

Supabase 연동 페이지와 Gemini 배틀 판정 확인은 아래 주소를 사용합니다.

```text
http://localhost:8080/battles.html
```

## 구현 포인트

- 모바일 앱처럼 보이는 최대 폭 `430px` 래퍼 사용
- 다크 그라데이션 배경
- 하단 고정 네비게이션 바
- 카드형 섹션과 둥근 버튼/칩 UI
- 페이지별 활성 탭 자동 강조
- 더미 데이터는 모두 `app.js`에서 관리

## 페이지 설명

- `home.html`: 내 캐릭터 카드와 추천 칩, 캐릭터 추가 버튼
- `ranking.html`: 일간 1위 카드와 1~5위 랭킹 리스트
- `mock-battle.html`: A/B 캐릭터 비교와 최근 모의 배틀 로그
- `code-battle.html`: 문제 카드, 코드 입력 영역, 제출 결과 리스트
- `account.html`: 계정 연결, 언어/테마 설정, 로그아웃/삭제 UI

## 수정 팁

- 색상, 간격, radius는 `styles.css`의 `:root` 변수부터 바꾸면 전체 분위기를 쉽게 조정할 수 있습니다.
- 더미 데이터는 `app.js` 상단의 `APP_DATA` 객체만 수정하면 됩니다.
- 하단 네비 항목은 `app.js`의 `NAV_ITEMS` 배열에서 관리합니다.

## 지금까지 한 작업

- 모바일 앱 스타일의 정적 웹 UI 구조 구현
- `home.html`, `ranking.html`, `mock-battle.html`, `code-battle.html`, `account.html` 페이지 작성
- 공통 다크 그라데이션 배경, 카드 UI, 둥근 버튼, 고정 하단 네비게이션 구현
- `app.js`에서 공통 헤더와 하단 네비 활성 상태 처리
- 로컬 스토리지 기반 실제 동작 추가
- 홈에서 캐릭터 추가 / 수정 / 삭제 가능하게 구현
- 모의 배틀에서 승자 결정, Elo 변경, 최근 배틀 기록 저장 구현
- 코드 배틀에서 실행 / 제출 결과 누적 저장 구현
- 계정 페이지에서 이메일, 언어, 테마, 구글 연결 상태 저장 구현
- Supabase 프로젝트 `gffgiqzkqaockdedlsxp`에 `battle-ai` Edge Function 배포 완료
- Gemini API 키를 Supabase secret으로 등록하고 배포 환경에서 실 호출 확인 완료
- 배포 함수 URL `https://gffgiqzkqaockdedlsxp.supabase.co/functions/v1/battle-ai` 응답 확인 완료
- 프런트엔드에서 `client.functions.invoke("battle-ai")`로 Gemini 배틀 판정 호출 연결 확인
- 홈 화면에 `battles.html`로 이동하는 `AI 배틀 실행하러 가기` 링크 추가
- 로컬 Supabase 실행을 위한 최소 설정 파일 `supabase/config.toml` 추가

## 앞으로 해야 할 작업

- `home.html`에서도 바로 배틀 실행과 최근 배틀 기록 확인이 가능하도록 UI 통합
- `mock-battle.html`에 실제 Supabase 캐릭터 목록과 Gemini 판정 흐름 연결
- 캐릭터 추가/수정 UI를 `prompt` 방식에서 실제 폼 또는 모달 화면으로 교체
- 랭킹과 배틀 기록 페이지에 로딩/빈 상태/오류 상태를 더 세분화
- Supabase 테이블 스키마, RLS 정책, 스토리지 버킷 설정 문서를 README에 추가
- 배포 주소와 anon key를 `.example` 파일 또는 별도 설정 가이드로 분리
- 랭킹 필터와 배틀 검색/정렬 기능 추가
- 코드 배틀 문제 목록, 난이도 필터, 제출 저장 구조 추가
- 계정 연동을 실제 Supabase Auth 또는 외부 로그인과 연결
- 디자인 디테일 보정
- 테스트 시나리오와 배포 체크리스트 문서화

## Gemini 배틀 판정 설정

배틀 심판 함수는 Supabase Edge Function `battle-ai`로 추가되어 있습니다.

현재 배포 상태:

- Supabase project ref: `gffgiqzkqaockdedlsxp`
- 배포 함수 URL: `https://gffgiqzkqaockdedlsxp.supabase.co/functions/v1/battle-ai`
- 배포 확인 일시: `2026-03-14`

필수 환경 변수:

```text
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Supabase에 시크릿 등록:

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key GEMINI_MODEL=gemini-2.5-flash
```

로컬 실행 예시:

```bash
supabase functions serve battle-ai --env-file ./supabase/.env.local
```

예시 `supabase/.env.local`:

```text
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

배포 예시:

```bash
supabase functions deploy battle-ai
```

프로젝트 연결 예시:

```bash
supabase link --project-ref gffgiqzkqaockdedlsxp
```

프런트는 `window.SupabaseApi.generateAiBattleNarrative()`를 통해 이 함수를 호출하며, 함수는 다음 JSON을 반환하도록 설계되어 있습니다.

```json
{
  "winner_id": "character-id",
  "winner_name": "승자 이름",
  "reasoning": "어떤 인과관계로 승리했는지",
  "battle_story": "초반, 중반, 결정타가 포함된 전투 서사",
  "confidence": 84,
  "key_factors": ["핵심 요소 1", "핵심 요소 2"]
}
```

`battles.html`의 `Gemini 배틀 실행` 버튼은 실제 Gemini 판정이 성공하면 성공 배너를, 호출 실패 시에는 폴백 판정 여부와 실패 이유를 함께 보여줍니다.

실제 배포 호출 테스트 예시:

```bash
curl -i -X POST 'https://gffgiqzkqaockdedlsxp.supabase.co/functions/v1/battle-ai' \
  -H 'Content-Type: application/json' \
  -d '{
    "character_a": {
      "id": "a1",
      "name": "전사",
      "description": "설정: 근접전에 강한 기사\n스킬: 방패 돌진, 강타"
    },
    "character_b": {
      "id": "b1",
      "name": "마법사",
      "description": "설정: 원거리 공격에 특화된 마법사\n스킬: 화염구, 순간이동"
    }
  }'
```

위 테스트는 `HTTP 200`과 함께 `winner_id`, `winner_name`, `reasoning`, `battle_story`, `confidence`, `key_factors`를 반환하는 것으로 확인했습니다.
