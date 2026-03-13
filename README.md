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

## 앞으로 해야 할 작업

- 캐릭터 추가/수정 UI를 `prompt` 방식에서 실제 모달 또는 폼 화면으로 개선
- 랭킹 필터(`일간`)를 실제 동작하게 확장
- 모의 배틀 캐릭터 선택 UI 추가
- 코드 배틀 문제 목록과 난이도 필터 추가
- 계정 연동을 실제 로그인 API 또는 Supabase 인증과 연결
- 로컬 스토리지 기반 데이터를 실제 백엔드 또는 Supabase 저장 구조로 교체
- 디자인 디테일 보정
  - 아이콘 통일
  - 카드 간격 미세 조정
  - 애니메이션과 탭 전환 완성도 향상
