(function () {
  "use strict";

  var APP_STATE_KEY = "keyboard-warrior-static-state";
  var SESSION_KEY = "keyboard-warrior-session";
  var STATE_VERSION = 2;
  var MAX_CHARACTERS = 5;
  var BATTLE_TEXT_LIMIT = 100;
  var GUILD_WIN_SCORE = 10;
  var RACES = ["휴먼", "엘프", "오크", "언데드", "드워프"];
  var ELEMENTS = ["불", "물", "풀", "땅", "전기"];
  var PERSONAL_RANKING = "personal";
  var GUILD_RANKING = "guild";
  var TABS = [
    { key: "home", label: "홈", icon: "🏠" },
    { key: "ranking", label: "랭킹", icon: "🏆" },
    { key: "arena", label: "대항전", icon: "⚔️" },
    { key: "guild", label: "길드", icon: "🛡️" },
    { key: "profile", label: "프로필", icon: "👤" }
  ];

  var view = {
    tab: "home",
    rankingMode: PERSONAL_RANKING,
    selectedCharacterId: null,
    battleResultId: null,
    homeCreateOpen: false,
    isBattling: false,
    battleNotice: ""
  };

  function createId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJson(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function clampText(text, length) {
    return String(text || "").slice(0, length);
  }

  function createSession() {
    var session = readJson(SESSION_KEY);
    var nickname;

    if (session && session.userId && session.nickname) {
      return session;
    }

    nickname = String(window.prompt("사용할 닉네임을 입력하세요.") || "").trim();

    if (!nickname) {
      nickname = "플레이어" + Math.floor(Math.random() * 9000 + 1000);
    }

    session = {
      userId: createId("user"),
      nickname: nickname
    };

    writeJson(SESSION_KEY, session);
    return session;
  }

  function createInitialState(session) {
    var guildA = createId("guild");
    var guildB = createId("guild");
    var users = [
      { id: session.userId, nickname: session.nickname, points: 0, createdAt: nowIso() },
      { id: createId("user"), nickname: "아스트라", points: 34, createdAt: nowIso() },
      { id: createId("user"), nickname: "세리온", points: 49, createdAt: nowIso() },
      { id: createId("user"), nickname: "릴리아", points: 28, createdAt: nowIso() },
      { id: createId("user"), nickname: "카덴", points: 39, createdAt: nowIso() }
    ];

    return {
      version: STATE_VERSION,
      userId: session.userId,
      seasonEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 5,
      users: users,
      characters: [
        {
          id: createId("char"),
          userId: users[1].id,
          name: "블레이즈 헌터",
          race: "휴먼",
          element: "불",
          battleText: "불꽃처럼 거세게 밀어붙이며 주도권을 빼앗는다.",
          wins: 8,
          losses: 3,
          draws: 1,
          createdAt: nowIso()
        },
        {
          id: createId("char"),
          userId: users[2].id,
          name: "타이드 미러",
          race: "엘프",
          element: "물",
          battleText: "물결처럼 흐르며 상대의 빈틈을 천천히 잠식한다.",
          wins: 11,
          losses: 4,
          draws: 2,
          createdAt: nowIso()
        },
        {
          id: createId("char"),
          userId: users[3].id,
          name: "그린 팽",
          race: "오크",
          element: "풀",
          battleText: "질긴 생명력과 압박으로 전장을 끝까지 장악한다.",
          wins: 6,
          losses: 5,
          draws: 1,
          createdAt: nowIso()
        },
        {
          id: createId("char"),
          userId: users[4].id,
          name: "스톤 볼트",
          race: "드워프",
          element: "땅",
          battleText: "묵직한 한 방과 방어적인 운영으로 균형을 무너뜨린다.",
          wins: 9,
          losses: 7,
          draws: 0,
          createdAt: nowIso()
        }
      ],
      battles: [],
      guilds: [
        {
          id: guildA,
          name: "Azure Fang",
          score: 120,
          inviteCode: "FANG-1024",
          createdAt: nowIso()
        },
        {
          id: guildB,
          name: "Crimson Howl",
          score: 95,
          inviteCode: "HOWL-2048",
          createdAt: nowIso()
        }
      ],
      guildMembers: [
        { guildId: guildA, userId: users[1].id, joinedAt: nowIso() },
        { guildId: guildA, userId: users[2].id, joinedAt: nowIso() },
        { guildId: guildB, userId: users[3].id, joinedAt: nowIso() },
        { guildId: guildB, userId: users[4].id, joinedAt: nowIso() }
      ]
    };
  }

  function isValidStateShape(state) {
    return !!(
      state &&
      state.version === STATE_VERSION &&
      Array.isArray(state.users) &&
      Array.isArray(state.characters) &&
      Array.isArray(state.battles) &&
      Array.isArray(state.guilds) &&
      Array.isArray(state.guildMembers)
    );
  }

  function getState() {
    var session = createSession();
    var saved = readJson(APP_STATE_KEY);
    var state = isValidStateShape(saved) ? saved : createInitialState(session);
    var currentUser = state.users.find(function (user) {
      return user.id === session.userId;
    });

    if (!currentUser) {
      state.users.unshift({
        id: session.userId,
        nickname: session.nickname,
        points: 0,
        createdAt: nowIso()
      });
    } else {
      currentUser.nickname = session.nickname;
    }

    state.userId = session.userId;
    state.version = STATE_VERSION;
    saveState(state);
    return state;
  }

  function saveState(state) {
    writeJson(APP_STATE_KEY, state);
  }

  function getCurrentUser(state) {
    return state.users.find(function (user) {
      return user.id === state.userId;
    }) || null;
  }

  function getCharactersByUser(state, userId) {
    return state.characters.filter(function (character) {
      return character.userId === userId;
    });
  }

  function getCharacterById(state, characterId) {
    return state.characters.find(function (character) {
      return character.id === characterId;
    }) || null;
  }

  function getUserById(state, userId) {
    return state.users.find(function (user) {
      return user.id === userId;
    }) || null;
  }

  function getGuildIdByUser(state, userId) {
    var membership = state.guildMembers.find(function (member) {
      return member.userId === userId;
    });

    return membership ? membership.guildId : null;
  }

  function getGuildById(state, guildId) {
    return state.guilds.find(function (guild) {
      return guild.id === guildId;
    }) || null;
  }

  function getGuildByUser(state, userId) {
    var guildId = getGuildIdByUser(state, userId);
    return guildId ? getGuildById(state, guildId) : null;
  }

  function getGuildMembers(state, guildId) {
    return state.guildMembers
      .filter(function (member) {
        return member.guildId === guildId;
      })
      .map(function (member) {
        return getUserById(state, member.userId);
      })
      .filter(Boolean);
  }

  function getCharacterTotalBattles(character) {
    return Number(character.wins || 0) + Number(character.losses || 0) + Number(character.draws || 0);
  }

  function getWinRate(character) {
    var total = getCharacterTotalBattles(character);
    return total ? Math.round((Number(character.wins || 0) / total) * 100) : 0;
  }

  function getScore(character) {
    return Number(character.wins || 0) * 3 + Number(character.draws || 0);
  }

  function getLeague(character) {
    var score = getScore(character);
    if (score >= 30) {
      return "다이아";
    }
    if (score >= 20) {
      return "플래티넘";
    }
    if (score >= 10) {
      return "골드";
    }
    return "브론즈";
  }

  function getPersonalRanking(state) {
    return state.characters
      .slice()
      .sort(function (a, b) {
        return getScore(b) - getScore(a) || Number(b.wins || 0) - Number(a.wins || 0);
      })
      .map(function (character, index) {
        return {
          rank: index + 1,
          character: character,
          user: getUserById(state, character.userId)
        };
      });
  }

  function getGuildRanking(state) {
    return state.guilds
      .slice()
      .sort(function (a, b) {
        return Number(b.score || 0) - Number(a.score || 0);
      })
      .map(function (guild, index) {
        return {
          rank: index + 1,
          guild: guild,
          members: getGuildMembers(state, guild.id)
        };
      });
  }

  function formatSeasonRemaining(targetTime) {
    var remaining = Math.max(0, Number(targetTime || 0) - Date.now());
    var days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    var hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return days + "일 " + hours + "시간";
  }

  function getElementAdvantage(element) {
    return {
      불: "풀",
      물: "불",
      풀: "땅",
      땅: "전기",
      전기: "물"
    }[element] || "";
  }

  function describeCharacterForAi(character) {
    return [
      "종족: " + (character.race || "미설정"),
      "속성: " + (character.element || "미설정"),
      "전투 문장: " + (character.battleText || "")
    ].join("\n");
  }

  function findAiWinner(characterA, characterB, result) {
    if (!result) {
      return null;
    }

    if (result.winner_id) {
      if (String(result.winner_id) === String(characterA.id)) {
        return characterA;
      }

      if (String(result.winner_id) === String(characterB.id)) {
        return characterB;
      }
    }

    if (result.winner_name) {
      if (String(result.winner_name) === String(characterA.name)) {
        return characterA;
      }

      if (String(result.winner_name) === String(characterB.name)) {
        return characterB;
      }
    }

    if (result.winner) {
      if (String(result.winner).toUpperCase() === "A") {
        return characterA;
      }

      if (String(result.winner).toUpperCase() === "B") {
        return characterB;
      }
    }

    return null;
  }

  async function judgeBattleWithAi(characterA, characterB) {
    var result;
    var winner;

    if (!window.SupabaseApi || typeof window.SupabaseApi.generateAiBattleNarrative !== "function") {
      throw new Error("AI 전투 함수를 불러오지 못했습니다.");
    }

    result = await window.SupabaseApi.generateAiBattleNarrative({
      character_a: {
        id: characterA.id,
        name: characterA.name,
        description: describeCharacterForAi(characterA)
      },
      character_b: {
        id: characterB.id,
        name: characterB.name,
        description: describeCharacterForAi(characterB)
      }
    });

    winner = findAiWinner(characterA, characterB, result);

    if (!winner) {
      throw new Error("AI 응답에서 승자를 식별하지 못했습니다.");
    }

    return {
      winner: winner,
      loser: winner.id === characterA.id ? characterB : characterA,
      battleLog: String(result.battle_log || result.battle_story || result.story || result.reasoning || "").trim(),
      source: "ai"
    };
  }

  function scoreCharacterForBattle(character, opponent) {
    var score = getScore(character) * 4;
    var text = String(character.battleText || "");
    var raceBonus = RACES.indexOf(character.race) + 1;
    var elementBonus = ELEMENTS.indexOf(character.element) + 1;

    score += text.length;
    score += raceBonus * 2;
    score += elementBonus * 2;
    score += Math.floor(Math.random() * 18);

    if (getElementAdvantage(character.element) === opponent.element) {
      score += 12;
    }

    return score;
  }

  function buildBattleLog(playerCharacter, opponentCharacter, outcome, battleType) {
    var opener = battleType === "guild" ? "길드 대항전" : "개인 배틀";
    var resultLine =
      outcome === "win"
        ? playerCharacter.name + "가 흐름을 잡고 승리했다."
        : outcome === "loss"
        ? opponentCharacter.name + "가 주도권을 끝까지 지켜냈다."
        : "두 캐릭터 모두 마지막까지 버텨 무승부로 끝났다.";

    return [
      opener + " 시작",
      playerCharacter.name + ": " + playerCharacter.battleText,
      opponentCharacter.name + ": " + opponentCharacter.battleText,
      resultLine
    ].join("\n");
  }

  function updateBattleRecord(character, outcome) {
    if (outcome === "win") {
      character.wins = Number(character.wins || 0) + 1;
    } else if (outcome === "loss") {
      character.losses = Number(character.losses || 0) + 1;
    } else {
      character.draws = Number(character.draws || 0) + 1;
    }
  }

  function createFallbackBattleDecision(playerCharacter, opponentCharacter, battleType) {
    var myScore = scoreCharacterForBattle(playerCharacter, opponentCharacter);
    var enemyScore = scoreCharacterForBattle(opponentCharacter, playerCharacter);
    var margin = myScore - enemyScore;
    var winnerCharacter;

    if (Math.abs(margin) <= 6) {
      return {
        winner: null,
        loser: null,
        battleLog:
          (battleType === "guild" ? "길드 대항전" : "개인 배틀") +
          "에서 두 캐릭터가 끝까지 공방을 주고받았지만 결정타를 만들지 못했다.",
        source: "fallback"
      };
    }

    winnerCharacter = margin > 0 ? playerCharacter : opponentCharacter;

    return {
      winner: winnerCharacter,
      loser: winnerCharacter.id === playerCharacter.id ? opponentCharacter : playerCharacter,
      battleLog:
        winnerCharacter.name +
        "가 전투 문장의 흐름과 상성 우위를 살려 주도권을 끝까지 밀어붙였다.",
      source: "fallback"
    };
  }

  async function runBattle(state, characterId, battleType) {
    var playerCharacter = getCharacterById(state, characterId);
    var playerGuildId;
    var candidates;
    var opponentCharacter;
    var outcome;
    var opponentOutcome;
    var battle;
    var currentUser = getCurrentUser(state);
    var decision;

    if (!playerCharacter || playerCharacter.userId !== state.userId) {
      window.alert("내 캐릭터로만 배틀을 시작할 수 있습니다.");
      return false;
    }

    if (battleType === "guild") {
      playerGuildId = getGuildIdByUser(state, state.userId);
      if (!playerGuildId) {
        window.alert("길드에 가입해야 대항전에 참여할 수 있습니다.");
        return false;
      }

      candidates = state.characters.filter(function (character) {
        var guildId = getGuildIdByUser(state, character.userId);
        return character.userId !== state.userId && guildId && guildId !== playerGuildId;
      });
    } else {
      candidates = state.characters.filter(function (character) {
        return character.userId !== state.userId;
      });
    }

    if (!candidates.length) {
      window.alert("매칭 가능한 상대가 없습니다.");
      return false;
    }

    opponentCharacter = candidates[Math.floor(Math.random() * candidates.length)];

    try {
      decision = await judgeBattleWithAi(playerCharacter, opponentCharacter);
      view.battleNotice = "AI 판정이 반영되었습니다.";
    } catch (error) {
      console.warn("AI battle fallback:", error);
      decision = createFallbackBattleDecision(playerCharacter, opponentCharacter, battleType);
      view.battleNotice = "AI 호출이 실패해 로컬 판정으로 처리되었습니다.";
    }

    if (!decision.winner) {
      outcome = "draw";
      opponentOutcome = "draw";
    } else if (decision.winner.id === playerCharacter.id) {
      outcome = "win";
      opponentOutcome = "loss";
    } else {
      outcome = "loss";
      opponentOutcome = "win";
    }

    updateBattleRecord(playerCharacter, outcome);
    updateBattleRecord(opponentCharacter, opponentOutcome);

    if (currentUser) {
      if (battleType === "guild" && outcome === "win") {
        currentUser.points = Number(currentUser.points || 0) + 5;
      } else if (battleType === "solo" && outcome === "win") {
        currentUser.points = Number(currentUser.points || 0) + 3;
      } else if (outcome === "draw") {
        currentUser.points = Number(currentUser.points || 0) + 1;
      }
    }

    if (battleType === "guild") {
      var winnerGuildId = outcome === "win"
        ? getGuildIdByUser(state, playerCharacter.userId)
        : outcome === "loss"
        ? getGuildIdByUser(state, opponentCharacter.userId)
        : null;

      if (winnerGuildId) {
        var winnerGuild = getGuildById(state, winnerGuildId);
        if (winnerGuild) {
          winnerGuild.score = Number(winnerGuild.score || 0) + GUILD_WIN_SCORE;
        }
      }
    }

    battle = {
      id: createId("battle"),
      battleType: battleType,
      player1CharacterId: playerCharacter.id,
      player2CharacterId: opponentCharacter.id,
      winnerCharacterId: decision.winner ? decision.winner.id : null,
      battleLog: decision.battleLog || buildBattleLog(playerCharacter, opponentCharacter, outcome, battleType),
      source: decision.source || "fallback",
      createdAt: nowIso()
    };

    state.battles.unshift(battle);
    view.selectedCharacterId = playerCharacter.id;
    view.battleResultId = battle.id;
    saveState(state);
    return true;
  }

  function createCharacter(state, payload) {
    var myCharacters = getCharactersByUser(state, state.userId);

    if (myCharacters.length >= MAX_CHARACTERS) {
      window.alert("캐릭터는 최대 5개까지 만들 수 있습니다.");
      return false;
    }

    state.characters.unshift({
      id: createId("char"),
      userId: state.userId,
      name: payload.name,
      race: payload.race,
      element: payload.element,
      battleText: payload.battleText,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: nowIso()
    });

    saveState(state);
    return true;
  }

  function deleteCharacter(state, characterId) {
    var nextCharacters = state.characters.filter(function (character) {
      return character.id !== characterId;
    });
    var nextBattles = state.battles.filter(function (battle) {
      return battle.player1CharacterId !== characterId && battle.player2CharacterId !== characterId;
    });

    state.characters = nextCharacters;
    state.battles = nextBattles;

    if (view.selectedCharacterId === characterId) {
      view.selectedCharacterId = null;
    }

    view.battleResultId = null;

    saveState(state);
  }

  function createGuild(state, guildName) {
    var userGuild = getGuildByUser(state, state.userId);

    if (userGuild) {
      window.alert("이미 길드에 가입되어 있습니다.");
      return false;
    }

    var guild = {
      id: createId("guild"),
      name: guildName,
      score: 0,
      inviteCode: "KW-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: nowIso()
    };

    state.guilds.unshift(guild);
    state.guildMembers.push({
      guildId: guild.id,
      userId: state.userId,
      joinedAt: nowIso()
    });
    saveState(state);
    return true;
  }

  function joinGuild(state, inviteCode) {
    var userGuild = getGuildByUser(state, state.userId);
    var guild = state.guilds.find(function (item) {
      return String(item.inviteCode || "").toUpperCase() === inviteCode.toUpperCase();
    });

    if (userGuild) {
      window.alert("이미 길드에 가입되어 있습니다.");
      return false;
    }

    if (!guild) {
      window.alert("초대 코드를 찾을 수 없습니다.");
      return false;
    }

    state.guildMembers.push({
      guildId: guild.id,
      userId: state.userId,
      joinedAt: nowIso()
    });
    saveState(state);
    return true;
  }

  function leaveGuild(state) {
    state.guildMembers = state.guildMembers.filter(function (member) {
      return member.userId !== state.userId;
    });
    saveState(state);
  }

  function setActiveTab(tab) {
    view.tab = tab;
    view.selectedCharacterId = null;
    view.battleResultId = null;
    view.battleNotice = "";
    renderApp();
  }

  function renderTag(label, value, accent) {
    return '<span class="tag-badge' + (accent ? " tag-badge--" + accent : "") + '">' + escapeHtml(label + " " + value) + "</span>";
  }

  function renderCharacterCard(character, state, context) {
    var selected = view.selectedCharacterId === character.id;
    var winRate = getWinRate(character);
    var actions = [];
    var battleLabel = view.isBattling ? "판정 중..." : "배틀";
    var guildBattleLabel = view.isBattling ? "판정 중..." : "길드 배틀";

    if (context === "home") {
      actions.push('<button class="button button--primary" data-action="start-solo-battle" data-character-id="' + escapeHtml(character.id) + '">' + battleLabel + "</button>");
      actions.push('<button class="button button--danger" data-action="delete-character" data-character-id="' + escapeHtml(character.id) + '">삭제</button>');
    } else if (context === "arena") {
      actions.push('<button class="button button--primary" data-action="start-guild-battle" data-character-id="' + escapeHtml(character.id) + '">' + guildBattleLabel + "</button>");
    }

    return (
      '<article class="character-card' + (selected ? " character-card--selected" : "") + '" data-action="select-character" data-character-id="' + escapeHtml(character.id) + '">' +
      '<div class="character-card__content">' +
      '<div class="stack stack--8">' +
      '<h3 class="character-card__name">' + escapeHtml(character.name) + "</h3>" +
      '<p class="character-card__description">' + escapeHtml(character.battleText) + "</p>" +
      "</div>" +
      '<div class="tag-row">' +
      renderTag("종족", character.race || "미설정") +
      renderTag("속성", character.element || "미설정") +
      renderTag("승률", winRate + "%", "accent") +
      renderTag("점수", getScore(character), "accent") +
      "</div>" +
      "</div>" +
      '<div class="character-card__actions">' +
      actions.join("") +
      "</div>" +
      "</article>"
    );
  }

  function renderBattleResult(state) {
    var battle = state.battles.find(function (item) {
      return item.id === view.battleResultId;
    });
    var opponent;
    var winner;

    if (!battle) {
      return "";
    }

    opponent = getCharacterById(
      state,
      battle.player1CharacterId === view.selectedCharacterId ? battle.player2CharacterId : battle.player1CharacterId
    );
    winner = battle.winnerCharacterId ? getCharacterById(state, battle.winnerCharacterId) : null;

    return (
      '<section class="panel panel--result">' +
      '<div class="section-heading">' +
      "<div>" +
      '<p class="section-kicker">최근 결과</p>' +
      '<h2 class="section-title">배틀 결과</h2>' +
      "</div>" +
      '<span class="tag-badge">' + escapeHtml(battle.battleType === "guild" ? "길드 배틀" : "개인 배틀") + "</span>" +
      "</div>" +
      (view.battleNotice ? '<p class="section-copy">' + escapeHtml(view.battleNotice) + "</p>" : "") +
      '<div class="battle-result__summary">' +
      '<div class="stat-card"><span>상대</span><strong>' + escapeHtml(opponent ? opponent.name : "알 수 없음") + "</strong></div>" +
      '<div class="stat-card"><span>판정</span><strong>' + escapeHtml(winner ? winner.name + " 승리" : "무승부") + "</strong></div>" +
      '<div class="stat-card"><span>판정 방식</span><strong>' + escapeHtml(battle.source === "ai" ? "AI" : "Fallback") + "</strong></div>" +
      "</div>" +
      '<pre class="battle-log">' + escapeHtml(battle.battleLog) + "</pre>" +
      "</section>"
    );
  }

  function renderHomeTab(state) {
    var myCharacters = getCharactersByUser(state, state.userId);
    var selected = myCharacters.find(function (character) {
      return character.id === view.selectedCharacterId;
    }) || null;

    return (
      '<section class="page">' +
      '<header class="page-header">' +
      '<div>' +
      '<p class="page-kicker">Keyboard Warrior</p>' +
      '<h1 class="page-title">내 캐릭터</h1>' +
      '<p class="page-copy">캐릭터를 만들고 바로 개인 배틀에 투입하세요. 전투 문장은 생성 후 수정할 수 없습니다.</p>' +
      "</div>" +
      '<button class="button button--secondary button--compact" data-action="toggle-create-form">캐릭터 생성</button>' +
      "</header>" +
      '<section class="panel panel--intro">' +
      '<div class="counter-row">' +
      renderTag("보유", myCharacters.length + "/" + MAX_CHARACTERS) +
      renderTag("개인 포인트", (getCurrentUser(state) || { points: 0 }).points, "accent") +
      (selected ? renderTag("선택", selected.name, "accent") : "") +
      "</div>" +
      "</section>" +
      (view.homeCreateOpen ? renderCreateCharacterForm() : "") +
      '<section class="list-section">' +
      (myCharacters.length
        ? myCharacters.map(function (character) {
            return renderCharacterCard(character, state, "home");
          }).join("")
        : renderEmptyState("아직 캐릭터가 없습니다.", "첫 캐릭터를 만들고 개인 배틀을 시작하세요.")) +
      "</section>" +
      renderBattleResult(state) +
      "</section>"
    );
  }

  function renderCreateCharacterForm() {
    return (
      '<section class="panel">' +
      '<div class="section-heading">' +
      "<div>" +
      '<p class="section-kicker">캐릭터 생성</p>' +
      '<h2 class="section-title">새 캐릭터 등록</h2>' +
      "</div>" +
      '<button class="button button--ghost button--compact" data-action="toggle-create-form">닫기</button>' +
      "</div>" +
      '<form class="form-stack" id="characterCreateForm">' +
      '<label class="field">' +
      '<span class="field__label">캐릭터 이름</span>' +
      '<input class="field__control" name="name" maxlength="20" required placeholder="예: 블레이즈 헌터" />' +
      "</label>" +
      '<label class="field">' +
      '<span class="field__label">종족</span>' +
      '<select class="field__control" name="race" required>' +
      RACES.map(function (race) {
        return '<option value="' + escapeHtml(race) + '">' + escapeHtml(race) + "</option>";
      }).join("") +
      "</select>" +
      "</label>" +
      '<label class="field">' +
      '<span class="field__label">속성</span>' +
      '<select class="field__control" name="element" required>' +
      ELEMENTS.map(function (element) {
        return '<option value="' + escapeHtml(element) + '">' + escapeHtml(element) + "</option>";
      }).join("") +
      "</select>" +
      "</label>" +
      '<label class="field">' +
      '<span class="field__label">전투 문장</span>' +
      '<textarea class="field__control field__control--textarea" name="battleText" maxlength="' + BATTLE_TEXT_LIMIT + '" required placeholder="최대 100자까지 입력할 수 있습니다."></textarea>' +
      '<span class="field__hint field__hint--align-right">생성 후 수정 불가 / 최대 100자</span>' +
      "</label>" +
      '<button class="button button--primary button--full" type="submit">생성하기</button>' +
      "</form>" +
      "</section>"
    );
  }

  function renderRankingTab(state) {
    var personalRows = getPersonalRanking(state);
    var guildRows = getGuildRanking(state);
    var isPersonal = view.rankingMode === PERSONAL_RANKING;

    return (
      '<section class="page">' +
      '<header class="page-header">' +
      '<div>' +
      '<p class="page-kicker">Leaderboard</p>' +
      '<h1 class="page-title">랭킹</h1>' +
      '<p class="page-copy">개인 랭킹과 길드 랭킹을 전환해 전체 순위를 확인하세요.</p>' +
      "</div>" +
      "</header>" +
      '<section class="panel">' +
      '<div class="segment-control">' +
      '<button class="segment-control__button' + (isPersonal ? " is-active" : "") + '" data-action="set-ranking-mode" data-mode="personal">개인 랭킹</button>' +
      '<button class="segment-control__button' + (!isPersonal ? " is-active" : "") + '" data-action="set-ranking-mode" data-mode="guild">길드 랭킹</button>' +
      "</div>" +
      '<div class="list-section list-section--tight">' +
      (isPersonal
        ? personalRows.map(renderPersonalRankRow).join("")
        : guildRows.map(renderGuildRankRow).join("")) +
      "</div>" +
      "</section>" +
      "</section>"
    );
  }

  function renderPersonalRankRow(entry) {
    return (
      '<article class="rank-row">' +
      '<div class="rank-row__leading"><span class="rank-row__rank">#' + entry.rank + '</span></div>' +
      '<div class="rank-row__body">' +
      '<h3 class="rank-row__title">' + escapeHtml(entry.character.name) + "</h3>" +
      '<p class="rank-row__meta">' + escapeHtml((entry.user && entry.user.nickname) || "알 수 없음") + "</p>" +
      '<div class="tag-row">' +
      renderTag("승", entry.character.wins || 0) +
      renderTag("승률", getWinRate(entry.character) + "%") +
      renderTag("점수", getScore(entry.character), "accent") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderGuildRankRow(entry) {
    return (
      '<article class="rank-row">' +
      '<div class="rank-row__leading"><span class="rank-row__rank">#' + entry.rank + '</span></div>' +
      '<div class="rank-row__body">' +
      '<h3 class="rank-row__title">' + escapeHtml(entry.guild.name) + "</h3>" +
      '<p class="rank-row__meta">' + escapeHtml(entry.members.length + "명 참여") + "</p>" +
      '<div class="tag-row">' +
      renderTag("길드 점수", entry.guild.score, "accent") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderArenaTab(state) {
    var myGuild = getGuildByUser(state, state.userId);
    var myCharacters = getCharactersByUser(state, state.userId);
    var guildRank;

    if (!myGuild) {
      return (
        '<section class="page">' +
        '<header class="page-header">' +
        '<div>' +
        '<p class="page-kicker">Guild War</p>' +
        '<h1 class="page-title">대항전</h1>' +
        '<p class="page-copy">개인 배틀과 분리된 길드 전용 전투 탭입니다.</p>' +
        "</div>" +
        "</header>" +
        '<section class="panel empty-state">' +
        '<h2 class="section-title">길드에 가입해야 대항전에 참여할 수 있습니다</h2>' +
        '<p class="section-copy">길드를 만들거나 초대 코드로 가입한 뒤 길드 전투를 시작할 수 있습니다.</p>' +
        '<div class="button-stack">' +
        '<button class="button button--primary" data-action="go-tab" data-tab="guild">길드 생성 / 가입</button>' +
        "</div>" +
        "</section>" +
        "</section>"
      );
    }

    guildRank = getGuildRanking(state).find(function (entry) {
      return entry.guild.id === myGuild.id;
    });

    return (
      '<section class="page">' +
      '<header class="page-header">' +
      '<div>' +
      '<p class="page-kicker">Guild War</p>' +
      '<h1 class="page-title">대항전</h1>' +
      '<p class="page-copy">길드 소속 캐릭터로 시즌 점수를 올리는 전용 전투입니다.</p>' +
      "</div>" +
      "</header>" +
      '<section class="panel">' +
      '<div class="stats-grid">' +
      '<div class="stat-card"><span>길드</span><strong>' + escapeHtml(myGuild.name) + "</strong></div>" +
      '<div class="stat-card"><span>현재 점수</span><strong>' + escapeHtml(myGuild.score) + "</strong></div>" +
      '<div class="stat-card"><span>현재 순위</span><strong>#' + escapeHtml(guildRank ? guildRank.rank : "-") + "</strong></div>" +
      '<div class="stat-card"><span>시즌 종료</span><strong>' + escapeHtml(formatSeasonRemaining(state.seasonEndsAt)) + "</strong></div>" +
      "</div>" +
      "</section>" +
      '<section class="list-section">' +
      (myCharacters.length
        ? myCharacters.map(function (character) {
            return renderCharacterCard(character, state, "arena");
          }).join("")
        : renderEmptyState("길드전에 투입할 캐릭터가 없습니다.", "홈 탭에서 먼저 캐릭터를 생성하세요.")) +
      "</section>" +
      renderBattleResult(state) +
      "</section>"
    );
  }

  function renderGuildTab(state) {
    var guild = getGuildByUser(state, state.userId);
    var members;
    var guildRank;

    if (!guild) {
      return (
        '<section class="page">' +
        '<header class="page-header">' +
        '<div>' +
        '<p class="page-kicker">Guild</p>' +
        '<h1 class="page-title">길드</h1>' +
        '<p class="page-copy">초대 코드 기반으로 길드를 만들거나 가입할 수 있습니다.</p>' +
        "</div>" +
        "</header>" +
        '<section class="panel">' +
        '<div class="section-heading">' +
        '<div><p class="section-kicker">길드 생성</p><h2 class="section-title">새 길드 만들기</h2></div>' +
        "</div>" +
        '<form class="form-stack" id="guildCreateForm">' +
        '<label class="field">' +
        '<span class="field__label">길드 이름</span>' +
        '<input class="field__control" name="name" maxlength="24" required placeholder="예: Azure Fang" />' +
        "</label>" +
        '<button class="button button--primary button--full" type="submit">길드 생성</button>' +
        "</form>" +
        "</section>" +
        '<section class="panel">' +
        '<div class="section-heading">' +
        '<div><p class="section-kicker">길드 가입</p><h2 class="section-title">초대 코드로 참가</h2></div>' +
        "</div>" +
        '<form class="form-stack" id="guildJoinForm">' +
        '<label class="field">' +
        '<span class="field__label">초대 코드</span>' +
        '<input class="field__control" name="inviteCode" maxlength="20" required placeholder="예: FANG-1024" />' +
        "</label>" +
        '<button class="button button--secondary button--full" type="submit">길드 가입</button>' +
        "</form>" +
        "</section>" +
        "</section>"
      );
    }

    members = getGuildMembers(state, guild.id);
    guildRank = getGuildRanking(state).find(function (entry) {
      return entry.guild.id === guild.id;
    });

    return (
      '<section class="page">' +
      '<header class="page-header">' +
      '<div>' +
      '<p class="page-kicker">Guild</p>' +
      '<h1 class="page-title">길드</h1>' +
      '<p class="page-copy">내 길드 정보와 멤버 현황을 확인할 수 있습니다.</p>' +
      "</div>" +
      "</header>" +
      '<section class="panel">' +
      '<div class="section-heading">' +
      '<div><p class="section-kicker">길드 정보</p><h2 class="section-title">' + escapeHtml(guild.name) + "</h2></div>" +
      "</div>" +
      '<div class="stats-grid">' +
      '<div class="stat-card"><span>멤버 수</span><strong>' + escapeHtml(members.length) + "명</strong></div>" +
      '<div class="stat-card"><span>길드 점수</span><strong>' + escapeHtml(guild.score) + "</strong></div>" +
      '<div class="stat-card"><span>길드 순위</span><strong>#' + escapeHtml(guildRank ? guildRank.rank : "-") + "</strong></div>" +
      '<div class="stat-card"><span>초대 코드</span><strong>' + escapeHtml(guild.inviteCode) + "</strong></div>" +
      "</div>" +
      '<div class="member-list">' +
      members.map(function (member) {
        return '<article class="member-row"><strong>' + escapeHtml(member.nickname) + '</strong></article>';
      }).join("") +
      "</div>" +
      '<button class="button button--danger button--full" data-action="leave-guild">길드 탈퇴</button>' +
      "</section>" +
      "</section>"
    );
  }

  function renderProfileTab(state) {
    var user = getCurrentUser(state);
    var myCharacters = getCharactersByUser(state, state.userId);
    var totals = myCharacters.reduce(
      function (acc, character) {
        acc.wins += Number(character.wins || 0);
        acc.losses += Number(character.losses || 0);
        acc.draws += Number(character.draws || 0);
        return acc;
      },
      { wins: 0, losses: 0, draws: 0 }
    );
    var totalBattles = totals.wins + totals.losses + totals.draws;
    var guild = getGuildByUser(state, state.userId);

    return (
      '<section class="page">' +
      '<header class="page-header">' +
      '<div>' +
      '<p class="page-kicker">Profile</p>' +
      '<h1 class="page-title">프로필</h1>' +
      '<p class="page-copy">계정 정보와 전체 전적을 한눈에 확인할 수 있습니다.</p>' +
      "</div>" +
      "</header>" +
      '<section class="panel">' +
      '<div class="stats-grid">' +
      '<div class="stat-card"><span>닉네임</span><strong>' + escapeHtml(user ? user.nickname : "-") + "</strong></div>" +
      '<div class="stat-card"><span>보유 포인트</span><strong>' + escapeHtml(user ? user.points : 0) + "</strong></div>" +
      '<div class="stat-card"><span>총 전적</span><strong>' + escapeHtml(totalBattles) + "</strong></div>" +
      '<div class="stat-card"><span>승률</span><strong>' + escapeHtml(totalBattles ? Math.round((totals.wins / totalBattles) * 100) : 0) + "%</strong></div>" +
      "</div>" +
      '<div class="panel panel--sub">' +
      '<p class="section-kicker">소속 길드</p>' +
      '<h2 class="section-title section-title--small">' + escapeHtml(guild ? guild.name : "미가입") + "</h2>" +
      '<p class="section-copy">승 ' + escapeHtml(totals.wins) + ' / 패 ' + escapeHtml(totals.losses) + ' / 무 ' + escapeHtml(totals.draws) + "</p>" +
      "</div>" +
      "</section>" +
      "</section>"
    );
  }

  function renderEmptyState(title, copy) {
    return (
      '<section class="panel empty-state">' +
      '<h2 class="section-title section-title--small">' + escapeHtml(title) + "</h2>" +
      '<p class="section-copy">' + escapeHtml(copy) + "</p>" +
      "</section>"
    );
  }

  function renderApp() {
    var app = document.getElementById("app");
    var state = getState();
    var tabContent = "";

    if (view.tab === "home") {
      tabContent = renderHomeTab(state);
    } else if (view.tab === "ranking") {
      tabContent = renderRankingTab(state);
    } else if (view.tab === "arena") {
      tabContent = renderArenaTab(state);
    } else if (view.tab === "guild") {
      tabContent = renderGuildTab(state);
    } else {
      tabContent = renderProfileTab(state);
    }

    app.innerHTML =
      '<div class="app-shell">' +
      tabContent +
      renderBottomNav() +
      "</div>";
  }

  function renderBottomNav() {
    return (
      '<nav class="bottom-nav">' +
      TABS.map(function (tab) {
        return (
          '<button class="bottom-nav__item' + (view.tab === tab.key ? " is-active" : "") + '" data-action="go-tab" data-tab="' + escapeHtml(tab.key) + '">' +
          '<span class="bottom-nav__icon">' + escapeHtml(tab.icon) + "</span>" +
          '<span class="bottom-nav__label">' + escapeHtml(tab.label) + "</span>" +
          "</button>"
        );
      }).join("") +
      "</nav>"
    );
  }

  function handleCreateCharacter(event) {
    var state = getState();
    var form = event.target;
    var name = clampText(form.name.value.trim(), 20);
    var race = form.race.value;
    var element = form.element.value;
    var battleText = clampText(form.battleText.value.trim(), BATTLE_TEXT_LIMIT);

    event.preventDefault();

    if (!name || !race || !element || !battleText) {
      window.alert("모든 항목을 입력하세요.");
      return;
    }

    if (createCharacter(state, {
      name: name,
      race: race,
      element: element,
      battleText: battleText
    })) {
      view.homeCreateOpen = false;
      renderApp();
    }
  }

  function handleGuildCreate(event) {
    var state = getState();
    var name = event.target.name.value.trim();

    event.preventDefault();

    if (!name) {
      window.alert("길드 이름을 입력하세요.");
      return;
    }

    if (createGuild(state, name)) {
      renderApp();
    }
  }

  function handleGuildJoin(event) {
    var state = getState();
    var inviteCode = event.target.inviteCode.value.trim();

    event.preventDefault();

    if (!inviteCode) {
      window.alert("초대 코드를 입력하세요.");
      return;
    }

    if (joinGuild(state, inviteCode)) {
      renderApp();
    }
  }

  async function handleClick(event) {
    var trigger = event.target.closest("[data-action]");
    var state;
    var characterId;

    if (!trigger) {
      return;
    }

    if (trigger.tagName === "BUTTON") {
      event.preventDefault();
    }

    if (trigger.dataset.action === "go-tab") {
      setActiveTab(trigger.dataset.tab);
      return;
    }

    if (trigger.dataset.action === "toggle-create-form") {
      view.homeCreateOpen = !view.homeCreateOpen;
      view.battleNotice = "";
      renderApp();
      return;
    }

    if (trigger.dataset.action === "set-ranking-mode") {
      view.rankingMode = trigger.dataset.mode;
      renderApp();
      return;
    }

    if (trigger.dataset.action === "select-character") {
      if (trigger.dataset.characterId) {
        view.selectedCharacterId = trigger.dataset.characterId;
        view.battleNotice = "";
        renderApp();
      }
      return;
    }

    state = getState();
    characterId = trigger.dataset.characterId;

    if (trigger.dataset.action === "delete-character") {
      if (!window.confirm("이 캐릭터를 삭제할까요? 전적도 함께 삭제됩니다.")) {
        return;
      }
      deleteCharacter(state, characterId);
      renderApp();
      return;
    }

    if (trigger.dataset.action === "start-solo-battle") {
      if (view.isBattling) {
        return;
      }
      view.isBattling = true;
      view.battleNotice = "AI가 전투를 판정하고 있습니다.";
      renderApp();
      try {
        await runBattle(state, characterId, "solo");
      } finally {
        view.isBattling = false;
      }
      renderApp();
      return;
    }

    if (trigger.dataset.action === "start-guild-battle") {
      if (view.isBattling) {
        return;
      }
      view.isBattling = true;
      view.battleNotice = "AI가 전투를 판정하고 있습니다.";
      renderApp();
      try {
        await runBattle(state, characterId, "guild");
      } finally {
        view.isBattling = false;
      }
      renderApp();
      return;
    }

    if (trigger.dataset.action === "leave-guild") {
      if (!window.confirm("길드에서 탈퇴할까요?")) {
        return;
      }
      leaveGuild(state);
      renderApp();
    }
  }

  function handleSubmit(event) {
    if (event.target.id === "characterCreateForm") {
      handleCreateCharacter(event);
      return;
    }

    if (event.target.id === "guildCreateForm") {
      handleGuildCreate(event);
      return;
    }

    if (event.target.id === "guildJoinForm") {
      handleGuildJoin(event);
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("DOMContentLoaded", renderApp);
})();
