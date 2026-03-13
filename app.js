(function () {
  "use strict";

  var STORAGE_KEY = "text-battle-mobile-mvp";
  var NAV_ITEMS = [
    { key: "home", label: "홈", href: "./home.html", icon: "🏠" },
    { key: "ranking", label: "랭킹", href: "./ranking.html", icon: "🏆" },
    { key: "mock-battle", label: "모의 배틀", href: "./mock-battle.html", icon: "⚔️" },
    { key: "code-battle", label: "코드 배틀", href: "./code-battle.html", icon: "💻" },
    { key: "account", label: "계정", href: "./account.html", icon: "👤" }
  ];

  function createDefaultState() {
    return {
      points: 0,
      contactEmail: "textbattle.help@gmail.com",
      maxCharacters: 5,
      nextCharacterId: 2,
      nextBattleId: 4,
      characters: [
        {
          id: 1,
          name: "루멘 블레이드",
          summary: "어둠 속에서 빛의 잔상을 남기는 검투사 캐릭터",
          elo: 1240
        }
      ],
      battleLogs: [
        {
          id: 1,
          leftName: "루멘 블레이드",
          rightName: "바이트 킹",
          winner: "바이트 킹",
          story: "초반에는 루멘 블레이드가 빠르게 주도권을 잡았지만, 후반 운영에서 바이트 킹이 반격에 성공했습니다.",
          date: "2026.03.13"
        },
        {
          id: 2,
          leftName: "세라핀",
          rightName: "제로 코드",
          winner: "세라핀",
          story: "거리 조절과 견제 타이밍이 완벽하게 맞아떨어지며 세라핀이 안정적으로 승리했습니다.",
          date: "2026.03.12"
        },
        {
          id: 3,
          leftName: "실버 노트",
          rightName: "미드나잇 러너",
          winner: "실버 노트",
          story: "짧은 연계가 연속으로 들어가며 실버 노트가 템포를 빼앗지 않고 끝까지 밀어붙였습니다.",
          date: "2026.03.11"
        }
      ],
      codeBattle: {
        title: "문자열 미러 매치",
        difficulty: "중간",
        description:
          "주어진 문자열이 좌우 대칭 규칙을 만족하는지 검사하는 함수를 작성하세요. 입력이 길어져도 빠르게 처리할 수 있어야 합니다.",
        starterCode:
          "function solve(input) {\n  // 여기에 코드를 작성하세요.\n  return input;\n}\n\nconsole.log(solve('text battle'));\n",
        submissions: [
          {
            title: "문자열 미러 매치",
            status: "성공",
            language: "JavaScript",
            result: "테스트 12개 통과"
          },
          {
            title: "문자열 미러 매치",
            status: "실패",
            language: "JavaScript",
            result: "예외 케이스 2개 실패"
          },
          {
            title: "문자열 미러 매치",
            status: "성공",
            language: "Python",
            result: "실행 시간 0.18초"
          }
        ]
      },
      account: {
        email: "",
        googleConnected: false,
        uiLanguage: "ko",
        battleLanguage: "한국어",
        theme: "purple"
      }
    };
  }

  function getState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");

      if (!saved) {
        return createDefaultState();
      }

      return Object.assign(createDefaultState(), saved, {
        account: Object.assign(createDefaultState().account, saved.account || {}),
        codeBattle: Object.assign(createDefaultState().codeBattle, saved.codeBattle || {})
      });
    } catch (error) {
      return createDefaultState();
    }
  }

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__textBattleState));
  }

  function updateState(updater) {
    updater(window.__textBattleState);
    saveState();
  }

  function getPage() {
    return document.body ? document.body.dataset.page || "home" : "home";
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderHeader() {
    var target = getElement("appHeader");

    if (!target) {
      return;
    }

    target.innerHTML =
      '<div class="brand-block">' +
      '<p class="brand-caption">Mobile Web MVP</p>' +
      '<h1 class="brand-title">텍스트 배틀</h1>' +
      "</div>" +
      '<div class="coin-badge" aria-label="포인트">' +
      '<span class="coin-badge__icon">🪙</span>' +
      '<span class="coin-badge__value">' +
      escapeHtml(window.__textBattleState.points) +
      "</span>" +
      "</div>";
  }

  function renderBottomNav() {
    var target = getElement("bottomNav");
    var page = getPage();

    if (!target) {
      return;
    }

    target.querySelectorAll(".bottom-nav__item").forEach(function (item) {
      var itemPage = item.getAttribute("data-page");
      item.classList.toggle("is-active", itemPage === page);
    });
  }

  function createStatusBox(message, type) {
    return (
      '<div class="status-box' +
      (type ? " status-box--" + escapeHtml(type) : "") +
      '">' +
      escapeHtml(message) +
      "</div>"
    );
  }

  function getSortedCharacters() {
    return window.__textBattleState.characters.slice().sort(function (a, b) {
      return b.elo - a.elo;
    });
  }

  function findCharacter(characterId) {
    return window.__textBattleState.characters.find(function (character) {
      return character.id === characterId;
    });
  }

  function formatToday() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  }

  function renderHomePage() {
    var characterTarget = getElement("myCharacterCard");
    var countTarget = getElement("characterCountBadge");
    var emailTarget = getElement("contactMail");
    var noticeTarget = getElement("homeNotice");
    var characters = window.__textBattleState.characters;

    if (!characterTarget || !countTarget || !emailTarget || !noticeTarget) {
      return;
    }

    if (!characters.length) {
      characterTarget.innerHTML =
        '<div class="empty-state">아직 캐릭터가 없습니다. 아래 버튼으로 첫 캐릭터를 추가해보세요.</div>';
    } else {
      characterTarget.innerHTML = characters
        .map(function (character) {
          return (
            '<article class="character-card">' +
            '<div class="character-card__top">' +
            "<div>" +
            '<h3 class="character-card__name">' +
            escapeHtml(character.name) +
            "</h3>" +
            '<p class="character-card__meta">' +
            escapeHtml(character.summary) +
            "</p>" +
            "</div>" +
            '<div class="character-card__actions">' +
            '<button class="icon-button" type="button" data-edit-character="' +
            escapeHtml(character.id) +
            '" aria-label="수정">✏️</button>' +
            '<button class="icon-button" type="button" data-delete-character="' +
            escapeHtml(character.id) +
            '" aria-label="삭제">🗑️</button>' +
            "</div>" +
            "</div>" +
            '<div class="character-card__footer">' +
            '<span class="pill pill--elo">Elo ' +
            escapeHtml(character.elo) +
            "</span>" +
            '<span class="muted-text">배틀 가능</span>' +
            "</div>" +
            "</article>"
          );
        })
        .join("");
    }

    countTarget.textContent = characters.length + "/" + window.__textBattleState.maxCharacters;
    emailTarget.textContent = window.__textBattleState.contactEmail;
    noticeTarget.innerHTML = createStatusBox("캐릭터 추가, 수정, 삭제가 실제로 동작합니다.");
  }

  function renderRankingPage() {
    var heroTarget = getElement("dailyChampionCard");
    var listTarget = getElement("rankingList");
    var ranking = getSortedCharacters();

    if (!heroTarget || !listTarget) {
      return;
    }

    if (!ranking.length) {
      heroTarget.innerHTML = '<div class="empty-state">등록된 캐릭터가 없습니다.</div>';
      listTarget.innerHTML = "";
      return;
    }

    heroTarget.innerHTML =
      '<div class="hero-rank">' +
      '<div class="card-header">' +
      '<div>' +
      '<h3 class="card-title">👑 일간 1위</h3>' +
      '<p class="card-subtitle">@' +
      escapeHtml(ranking[0].name.toLowerCase().replace(/\s+/g, "")) +
      "</p>" +
      "</div>" +
      '<button class="icon-button" type="button" aria-label="상세 보기">↗</button>' +
      "</div>" +
      '<div class="hero-rank__score">' +
      escapeHtml(ranking[0].name) +
      " · " +
      escapeHtml(ranking[0].elo) +
      "</div>" +
      '<p class="hero-rank__time">다음 1위까지 06:18:42</p>' +
      "</div>";

    listTarget.innerHTML = ranking
      .slice(0, 5)
      .map(function (item, index) {
        return (
          '<article class="rank-item">' +
          '<div class="rank-item__order">' +
          escapeHtml(index + 1) +
          "</div>" +
          "<div>" +
          '<h3 class="rank-item__name">' +
          escapeHtml(item.name) +
          "</h3>" +
          '<p class="rank-item__sub">@' +
          escapeHtml(item.name.toLowerCase().replace(/\s+/g, "")) +
          "</p>" +
          "</div>" +
          '<div class="rank-item__side">' +
          '<strong>' +
          escapeHtml(item.elo) +
          "</strong>" +
          '<button class="mini-button mini-button--blue" type="button" data-challenge-character="' +
          escapeHtml(item.id) +
          '">모의 배틀</button>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function getMockBattlePair() {
    var characters = window.__textBattleState.characters;

    if (!characters.length) {
      return [];
    }

    if (characters.length === 1) {
      return [characters[0], characters[0]];
    }

    return [characters[0], characters[1]];
  }

  function renderMockBattlePage() {
    var compareTarget = getElement("mockBattleCompare");
    var logsTarget = getElement("mockBattleLogs");
    var pair = getMockBattlePair();

    if (!compareTarget || !logsTarget) {
      return;
    }

    if (!pair.length) {
      compareTarget.innerHTML = '<div class="empty-state">배틀을 시작하려면 캐릭터를 먼저 추가하세요.</div>';
    } else {
      compareTarget.innerHTML =
        '<article class="battle-side">' +
        '<h3 class="battle-side__name">' +
        escapeHtml(pair[0].name) +
        "</h3>" +
        '<p class="muted-text">' +
        escapeHtml(pair[0].summary) +
        "</p>" +
        '<span class="pill pill--elo">Elo ' +
        escapeHtml(pair[0].elo) +
        "</span>" +
        "</article>" +
        '<div class="vs-mark">VS</div>' +
        '<article class="battle-side">' +
        '<h3 class="battle-side__name">' +
        escapeHtml(pair[1].name) +
        "</h3>" +
        '<p class="muted-text">' +
        escapeHtml(pair[1].summary) +
        "</p>" +
        '<span class="pill pill--elo">Elo ' +
        escapeHtml(pair[1].elo) +
        "</span>" +
        "</article>";
    }

    logsTarget.innerHTML = window.__textBattleState.battleLogs
      .slice(0, 3)
      .map(function (log) {
        return (
          '<article class="battle-log">' +
          '<h3 class="battle-log__title">' +
          escapeHtml(log.leftName + " vs " + log.rightName) +
          "</h3>" +
          '<p class="muted-text">승자: ' +
          escapeHtml(log.winner) +
          "</p>" +
          '<p class="battle-log__meta">' +
          escapeHtml(log.story) +
          "</p>" +
          '<p class="battle-log__meta">' +
          escapeHtml(log.date) +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderCodeBattlePage() {
    var titleTarget = getElement("codeBattleProblemTitle");
    var descTarget = getElement("codeBattleDescription");
    var codeTarget = getElement("codeBattleEditor");
    var logsTarget = getElement("codeBattleSubmissions");

    if (!titleTarget || !descTarget || !codeTarget || !logsTarget) {
      return;
    }

    titleTarget.textContent = window.__textBattleState.codeBattle.title;
    descTarget.textContent = window.__textBattleState.codeBattle.description;

    if (!codeTarget.value) {
      codeTarget.value = window.__textBattleState.codeBattle.starterCode;
    }

    logsTarget.innerHTML = window.__textBattleState.codeBattle.submissions
      .slice(0, 3)
      .map(function (item) {
        var badgeClass = item.status === "성공" ? "pill--success" : "pill--failure";

        return (
          '<article class="submit-item">' +
          '<div class="card-header">' +
          '<h3 class="submit-item__title">' +
          escapeHtml(item.title) +
          "</h3>" +
          '<span class="pill ' +
          badgeClass +
          '">' +
          escapeHtml(item.status) +
          "</span>" +
          "</div>" +
          '<p class="submit-item__meta">' +
          escapeHtml(item.language) +
          " · " +
          escapeHtml(item.result) +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderAccountPage() {
    var statusTarget = getElement("accountStatus");
    var emailInput = getElement("accountEmail");
    var battleLanguage = getElement("battleLanguage");
    var account = window.__textBattleState.account;

    if (!statusTarget || !emailInput || !battleLanguage) {
      return;
    }

    emailInput.value = account.email;
    battleLanguage.value = account.battleLanguage;

    document.querySelectorAll("[data-ui-language]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-ui-language") === account.uiLanguage);
    });

    document.querySelectorAll("[data-theme-option]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-theme-option") === account.theme);
    });

    statusTarget.innerHTML = createStatusBox(
      account.googleConnected ? "구글 계정이 연결되어 있습니다." : "현재는 익명 계정 상태입니다.",
      account.googleConnected ? "success" : ""
    );
  }

  function promptCharacterData(existingCharacter) {
    var currentName = existingCharacter ? existingCharacter.name : "";
    var currentSummary = existingCharacter ? existingCharacter.summary : "";
    var name = window.prompt("캐릭터 이름을 입력하세요.", currentName);

    if (!name) {
      return null;
    }

    var summary = window.prompt("짧은 설명을 입력하세요.", currentSummary);

    if (!summary) {
      return null;
    }

    return {
      name: name.trim(),
      summary: summary.trim()
    };
  }

  function addCharacter() {
    if (window.__textBattleState.characters.length >= window.__textBattleState.maxCharacters) {
      window.alert("캐릭터는 최대 5개까지 추가할 수 있습니다.");
      return;
    }

    var data = promptCharacterData();

    if (!data) {
      return;
    }

    updateState(function (state) {
      state.characters.push({
        id: state.nextCharacterId,
        name: data.name,
        summary: data.summary,
        elo: 1000 + Math.floor(Math.random() * 150)
      });
      state.nextCharacterId += 1;
    });

    rerenderCurrentPage();
  }

  function editCharacter(characterId) {
    var character = findCharacter(characterId);
    var data;

    if (!character) {
      return;
    }

    data = promptCharacterData(character);

    if (!data) {
      return;
    }

    updateState(function (state) {
      state.characters = state.characters.map(function (item) {
        if (item.id === characterId) {
          return Object.assign({}, item, {
            name: data.name,
            summary: data.summary
          });
        }

        return item;
      });
    });

    rerenderCurrentPage();
  }

  function deleteCharacter(characterId) {
    if (!window.confirm("이 캐릭터를 삭제할까요?")) {
      return;
    }

    updateState(function (state) {
      state.characters = state.characters.filter(function (item) {
        return item.id !== characterId;
      });
    });

    rerenderCurrentPage();
  }

  function startMockBattle() {
    var pair = getMockBattlePair();
    var winner;
    var loser;
    var story;

    if (pair.length < 2 || pair[0].id === pair[1].id) {
      window.alert("모의 배틀을 시작하려면 캐릭터가 최소 2개 필요합니다.");
      return;
    }

    winner = pair[0].elo + Math.random() * 120 >= pair[1].elo + Math.random() * 120 ? pair[0] : pair[1];
    loser = winner.id === pair[0].id ? pair[1] : pair[0];
    story =
      winner.name +
      "가 초반 흐름을 읽고 " +
      loser.name +
      "의 빈틈을 파고들며 승기를 잡았습니다. 마지막 교전에서 Elo 차이를 뒤집는 운영이 승부를 갈랐습니다.";

    updateState(function (state) {
      state.characters = state.characters.map(function (character) {
        if (character.id === winner.id) {
          return Object.assign({}, character, { elo: character.elo + 14 });
        }

        if (character.id === loser.id) {
          return Object.assign({}, character, { elo: Math.max(900, character.elo - 9) });
        }

        return character;
      });

      state.points += 3;
      state.battleLogs.unshift({
        id: state.nextBattleId,
        leftName: pair[0].name,
        rightName: pair[1].name,
        winner: winner.name,
        story: story,
        date: formatToday()
      });
      state.nextBattleId += 1;
      state.battleLogs = state.battleLogs.slice(0, 6);
    });

    rerenderCurrentPage();
    window.alert(winner.name + " 승리! Elo와 기록이 갱신되었습니다.");
  }

  function runCode() {
    var editor = getElement("codeBattleEditor");

    if (!editor) {
      return;
    }

    if (!editor.value.trim()) {
      window.alert("코드를 입력하세요.");
      return;
    }

    window.alert("실행 완료: 문법 검사를 통과한 것으로 처리했습니다.");
  }

  function submitCode() {
    var editor = getElement("codeBattleEditor");
    var isSuccess;

    if (!editor) {
      return;
    }

    isSuccess = editor.value.indexOf("function solve") > -1 && editor.value.indexOf("return") > -1;

    updateState(function (state) {
      state.codeBattle.submissions.unshift({
        title: state.codeBattle.title,
        status: isSuccess ? "성공" : "실패",
        language: "JavaScript",
        result: isSuccess ? "핵심 키워드 검사를 통과했습니다." : "solve 함수 또는 return 문이 부족합니다."
      });
      state.codeBattle.submissions = state.codeBattle.submissions.slice(0, 6);

      if (isSuccess) {
        state.points += 5;
      }
    });

    rerenderCurrentPage();
  }

  function connectGoogle() {
    updateState(function (state) {
      state.account.googleConnected = !state.account.googleConnected;
    });

    renderHeader();
    renderAccountPage();
  }

  function registerAccount() {
    var emailInput = getElement("accountEmail");
    var passwordInput = getElement("accountPassword");

    if (!emailInput || !passwordInput) {
      return;
    }

    if (!emailInput.value.trim() || !passwordInput.value.trim()) {
      window.alert("이메일과 비밀번호를 모두 입력하세요.");
      return;
    }

    updateState(function (state) {
      state.account.email = emailInput.value.trim();
      state.points += 2;
    });

    renderHeader();
    renderAccountPage();
    window.alert("계정 정보가 저장되었습니다.");
  }

  function logoutAccount() {
    updateState(function (state) {
      state.account.email = "";
      state.account.googleConnected = false;
    });

    renderAccountPage();
    window.alert("로그아웃되었습니다.");
  }

  function deleteAccount() {
    if (!window.confirm("계정 관련 로컬 데이터를 모두 삭제할까요?")) {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    window.__textBattleState = createDefaultState();
    rerenderCurrentPage();
    window.alert("로컬 계정 데이터가 삭제되었습니다.");
  }

  function attachHomeEvents() {
    var addButton = getElement("addCharacterButton");

    if (addButton) {
      addButton.addEventListener("click", addCharacter);
    }

    document.querySelectorAll("[data-edit-character]").forEach(function (button) {
      button.addEventListener("click", function () {
        editCharacter(Number(button.getAttribute("data-edit-character")));
      });
    });

    document.querySelectorAll("[data-delete-character]").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteCharacter(Number(button.getAttribute("data-delete-character")));
      });
    });
  }

  function attachRankingEvents() {
    document.querySelectorAll("[data-challenge-character]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.location.href = "./mock-battle.html";
      });
    });
  }

  function attachMockBattleEvents() {
    var startButton = getElement("startMockBattleButton");

    if (startButton) {
      startButton.addEventListener("click", startMockBattle);
    }
  }

  function attachCodeBattleEvents() {
    var runButton = getElement("runCodeButton");
    var submitButton = getElement("submitCodeButton");

    if (runButton) {
      runButton.addEventListener("click", runCode);
    }

    if (submitButton) {
      submitButton.addEventListener("click", submitCode);
    }
  }

  function attachAccountEvents() {
    var googleButton = getElement("googleConnectButton");
    var registerButton = getElement("registerAccountButton");
    var logoutButton = getElement("logoutButton");
    var deleteButton = getElement("deleteAccountButton");
    var battleLanguage = getElement("battleLanguage");

    document.querySelectorAll("[data-ui-language]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateState(function (state) {
          state.account.uiLanguage = button.getAttribute("data-ui-language");
        });
        renderAccountPage();
      });
    });

    document.querySelectorAll("[data-theme-option]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateState(function (state) {
          state.account.theme = button.getAttribute("data-theme-option");
        });
        renderAccountPage();
      });
    });

    if (battleLanguage) {
      battleLanguage.addEventListener("change", function () {
        updateState(function (state) {
          state.account.battleLanguage = battleLanguage.value;
        });
      });
    }

    if (googleButton) {
      googleButton.addEventListener("click", connectGoogle);
    }

    if (registerButton) {
      registerButton.addEventListener("click", registerAccount);
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", logoutAccount);
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", deleteAccount);
    }
  }

  function rerenderCurrentPage() {
    renderHeader();
    renderBottomNav();

    if (getPage() === "home") {
      renderHomePage();
      attachHomeEvents();
    }

    if (getPage() === "ranking") {
      renderRankingPage();
      attachRankingEvents();
    }

    if (getPage() === "mock-battle") {
      renderMockBattlePage();
      attachMockBattleEvents();
    }

    if (getPage() === "code-battle") {
      renderCodeBattlePage();
      attachCodeBattleEvents();
    }

    if (getPage() === "account") {
      renderAccountPage();
      attachAccountEvents();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    window.__textBattleState = getState();
    rerenderCurrentPage();
  });
})();
