(function () {
  "use strict";

  var APP_STATE_KEY = "keyboard-warrior-static-state";
  var SESSION_KEY = "keyboard-warrior-session";
  var STATE_VERSION = 2;
  var MAX_CHARACTERS = 5;
  var BATTLE_TEXT_LIMIT = 100;
  var GUILD_WIN_SCORE = 10;
  var DEFAULT_CHARACTER_IMAGE =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e293b"/><stop offset="1" stop-color="#334155"/></linearGradient></defs>' +
      '<rect width="320" height="320" rx="32" fill="url(#g)"/>' +
      '<circle cx="160" cy="122" r="56" fill="#94a3b8"/>' +
      '<path d="M78 264c18-44 54-68 82-68s64 24 82 68" fill="#cbd5e1"/>' +
      "</svg>"
    );
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
    battleNotice: "",
    remotePersonalRanking: [],
    remotePersonalRankingLoaded: false,
    remoteStatus: ""
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

  function getTelegramWebAppUser() {
    var telegram = window.Telegram;
    var webApp;
    var user;

    if (!telegram || !telegram.WebApp) {
      return null;
    }

    webApp = telegram.WebApp;

    try {
      if (typeof webApp.ready === "function") {
        webApp.ready();
      }
      if (typeof webApp.expand === "function") {
        webApp.expand();
      }
    } catch (error) {
      console.warn("Telegram WebApp init failed:", error);
    }

    user = webApp.initDataUnsafe && webApp.initDataUnsafe.user;

    if (!user || !user.id) {
      return null;
    }

    return {
      init_data: String(webApp.initData || ""),
      telegram_id: String(user.id),
      nickname: String(
        user.username ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        ""
      ).trim(),
      first_name: String(user.first_name || "").trim(),
      last_name: String(user.last_name || "").trim(),
      username: String(user.username || "").trim()
    };
  }

  function createSession() {
    var session = readJson(SESSION_KEY);
    var telegramUser = getTelegramWebAppUser();

    if (telegramUser && telegramUser.telegram_id) {
      session = Object.assign({}, session || {}, telegramUser, {
        userId: "tg-" + telegramUser.telegram_id,
        nickname: telegramUser.nickname || "플레이어" + telegramUser.telegram_id.slice(-4)
      });

      writeJson(SESSION_KEY, session);
      return session;
    }

    if (session && session.userId && session.nickname) {
      return session;
    }

    session = {
      userId: createId("user"),
      nickname: "게스트" + Math.floor(Math.random() * 9000 + 1000),
      isGuest: true
    };

    writeJson(SESSION_KEY, session);
    return session;
  }

  function saveSession(session) {
    writeJson(SESSION_KEY, session);
  }

  async function verifyTelegramSession() {
    var session = readJson(SESSION_KEY);
    var telegramUser = getTelegramWebAppUser();
    var verified;

    if (!telegramUser || !telegramUser.init_data) {
      return null;
    }

    if (
      session &&
      session.telegram_verified &&
      session.telegram_id === telegramUser.telegram_id &&
      session.init_data === telegramUser.init_data
    ) {
      return session;
    }

    if (!window.SupabaseApi || typeof window.SupabaseApi.verifyTelegramWebAppData !== "function") {
      return null;
    }

    verified = await window.SupabaseApi.verifyTelegramWebAppData(telegramUser.init_data);
    session = Object.assign({}, session || {}, telegramUser, verified, {
      userId: "tg-" + verified.telegram_id,
      nickname: verified.nickname || telegramUser.nickname || "플레이어" + verified.telegram_id.slice(-4),
      telegram_verified: true
    });
    saveSession(session);
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
          ownerUserId: users[1].id,
          score: 120,
          inviteCode: "FANG-1024",
          createdAt: nowIso()
        },
        {
          id: guildB,
          name: "Crimson Howl",
          ownerUserId: users[3].id,
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

  function getGuildOwnerUserId(state, guildId) {
    var guild = getGuildById(state, guildId);
    var firstMember;

    if (guild && guild.ownerUserId) {
      return guild.ownerUserId;
    }

    firstMember = state.guildMembers.find(function (member) {
      return member.guildId === guildId;
    });

    return firstMember ? firstMember.userId : null;
  }

  function pruneOrphanGuilds(state) {
    var activeGuildIds = {};

    state.guildMembers.forEach(function (member) {
      activeGuildIds[member.guildId] = true;
    });

    state.guilds = state.guilds.filter(function (guild) {
      return activeGuildIds[guild.id];
    });
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
    pruneOrphanGuilds(state);
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

  function isGuildOwner(state, userId, guildId) {
    return getGuildOwnerUserId(state, guildId) === userId;
  }

  function getGuildMembers(state, guildId) {
    return state.guildMembers
      .filter(function (member) {
        return member.guildId === guildId;
      })
      .map(function (member) {
        var user = getUserById(state, member.userId);

        if (user) {
          return user;
        }

        return {
          id: member.userId,
          nickname: member.nickname || "알 수 없음"
        };
      });
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
    if (view.remotePersonalRankingLoaded) {
      return view.remotePersonalRanking.slice();
    }

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

  function hasRemoteApi() {
    return !!(
      window.SupabaseApi &&
      typeof window.SupabaseApi.hasValidConfig === "function" &&
      window.SupabaseApi.hasValidConfig()
    );
  }

  function buildCharacterDescription(character) {
    return [
      "종족: " + (character.race || "미설정"),
      "속성: " + (character.element || "미설정"),
      "전투 문장: " + (character.battleText || "")
    ].join("\n");
  }

  function normalizeRemoteCharacter(character) {
    var description = String(character.description || "");
    var raceMatch = description.match(/종족:\s*([^\n]+)/);
    var elementMatch = description.match(/속성:\s*([^\n]+)/);
    var battleTextMatch = description.match(/전투 문장:\s*([^\n]+)/);

    return {
      id: character.id,
      remoteId: character.id,
      userId: character.user_id || "",
      remoteUserId: character.user_id || "",
      nickname: character.nickname || "",
      name: character.name || "알 수 없음",
      race: raceMatch ? raceMatch[1].trim() : "미설정",
      element: elementMatch ? elementMatch[1].trim() : "미설정",
      battleText: battleTextMatch ? battleTextMatch[1].trim() : description.trim(),
      wins: Number(character.wins || 0),
      losses: Number(character.losses || 0),
      draws: Number(character.draws || 0),
      createdAt: character.created_at || nowIso()
    };
  }

  function normalizeRemoteGuild(guild, remoteCurrentUserId, localUserId) {
    return {
      id: guild.id,
      name: guild.name || "이름 없는 길드",
      ownerUserId: guild.owner_user_id === remoteCurrentUserId ? localUserId : guild.owner_user_id,
      remoteOwnerUserId: guild.owner_user_id || "",
      score: Number(guild.score || 0),
      inviteCode: guild.invite_code || "",
      createdAt: guild.created_at || nowIso()
    };
  }

  function normalizeRemoteGuildMember(member, remoteCurrentUserId, localUserId) {
    return {
      guildId: member.guild_id,
      userId: member.user_id === remoteCurrentUserId ? localUserId : member.user_id,
      remoteUserId: member.user_id || "",
      nickname: member.nickname || "알 수 없음",
      joinedAt: member.joined_at || nowIso()
    };
  }

  function applyRemoteCharacterToLocal(localCharacter, remoteCharacter, localUserId) {
    localCharacter.remoteId = remoteCharacter.remoteId || remoteCharacter.id;
    localCharacter.remoteUserId = remoteCharacter.remoteUserId || remoteCharacter.userId || "";
    localCharacter.userId = localUserId || localCharacter.userId;
    localCharacter.name = remoteCharacter.name;
    localCharacter.race = remoteCharacter.race;
    localCharacter.element = remoteCharacter.element;
    localCharacter.battleText = remoteCharacter.battleText;
    localCharacter.wins = Number(remoteCharacter.wins || 0);
    localCharacter.losses = Number(remoteCharacter.losses || 0);
    localCharacter.draws = Number(remoteCharacter.draws || 0);
    localCharacter.createdAt = remoteCharacter.createdAt || localCharacter.createdAt;
  }

  function findMatchingLocalCharacter(state, remoteCharacter) {
    return state.characters.find(function (character) {
      return (
        character.remoteId === remoteCharacter.remoteId ||
        (
          character.userId === state.userId &&
          character.name === remoteCharacter.name &&
          character.battleText === remoteCharacter.battleText
        )
      );
    }) || null;
  }

  function createRemoteRankingEntries(characters) {
    return characters
      .map(normalizeRemoteCharacter)
      .sort(function (a, b) {
        return getScore(b) - getScore(a) || Number(b.wins || 0) - Number(a.wins || 0);
      })
      .map(function (character, index) {
        return {
          rank: index + 1,
          character: character,
          user: { nickname: character.nickname || "알 수 없음" }
        };
      });
  }

  async function ensureRemoteUserSession() {
    var session;
    var user;

    if (!hasRemoteApi()) {
      throw new Error("Supabase 설정이 없어 원격 데이터를 사용할 수 없습니다.");
    }

    session = createSession();
    user = await window.SupabaseApi.ensureUserRecord(session);
    session.remoteUserId = user.id;
    saveSession(session);
    return {
      session: session,
      user: user
    };
  }

  async function syncLocalCharacterToRemote(localCharacter, state) {
    var context;
    var remoteCharacters;
    var matchedCharacter;
    var remoteCharacter;

    if (localCharacter.remoteId) {
      return localCharacter.remoteId;
    }

    context = await ensureRemoteUserSession();
    remoteCharacters = await window.SupabaseApi.fetchMyCharacters(context.user.id);
    matchedCharacter = remoteCharacters
      .map(normalizeRemoteCharacter)
      .find(function (character) {
        return character.name === localCharacter.name && character.battleText === localCharacter.battleText;
      }) || null;

    if (matchedCharacter) {
      localCharacter.remoteId = matchedCharacter.remoteId;
      localCharacter.remoteUserId = context.user.id;
      localCharacter.wins = Number(matchedCharacter.wins || 0);
      localCharacter.losses = Number(matchedCharacter.losses || 0);
      localCharacter.draws = Number(matchedCharacter.draws || 0);
      localCharacter.createdAt = matchedCharacter.createdAt || localCharacter.createdAt;
      if (state) {
        saveState(state);
      }
      return matchedCharacter.remoteId;
    }

    remoteCharacter = await window.SupabaseApi.createCharacter({
      user_id: context.user.id,
      nickname: context.user.nickname,
      name: localCharacter.name,
      description: buildCharacterDescription(localCharacter)
    });

    localCharacter.remoteId = remoteCharacter.id;
    localCharacter.remoteUserId = context.user.id;
    localCharacter.wins = Number(remoteCharacter.wins || localCharacter.wins || 0);
    localCharacter.losses = Number(remoteCharacter.losses || localCharacter.losses || 0);
    localCharacter.draws = Number(remoteCharacter.draws || localCharacter.draws || 0);
    localCharacter.createdAt = remoteCharacter.created_at || localCharacter.createdAt;
    if (state) {
      saveState(state);
    }
    return remoteCharacter.id;
  }

  async function syncRemoteCharactersIntoState(state) {
    var context;
    var remoteCharacters;

    if (!hasRemoteApi()) {
      return;
    }

    context = await ensureRemoteUserSession();
    remoteCharacters = await window.SupabaseApi.fetchCharactersForRanking();

    remoteCharacters.map(normalizeRemoteCharacter).forEach(function (remoteCharacter) {
      var localCharacter = findMatchingLocalCharacter(state, remoteCharacter);
      var localUserId = remoteCharacter.remoteUserId === context.user.id ? state.userId : remoteCharacter.remoteUserId;

      if (localCharacter) {
        applyRemoteCharacterToLocal(localCharacter, remoteCharacter, localUserId);
        return;
      }

      state.characters.unshift({
        id: createId("char"),
        remoteId: remoteCharacter.remoteId,
        remoteUserId: remoteCharacter.remoteUserId,
        userId: localUserId,
        nickname: remoteCharacter.nickname,
        name: remoteCharacter.name,
        race: remoteCharacter.race,
        element: remoteCharacter.element,
        battleText: remoteCharacter.battleText,
        wins: remoteCharacter.wins,
        losses: remoteCharacter.losses,
        draws: remoteCharacter.draws,
        createdAt: remoteCharacter.createdAt
      });
    });

    saveState(state);
  }

  async function syncRemoteGuildsIntoState(state) {
    var context;
    var snapshot;

    if (!hasRemoteApi()) {
      return;
    }

    context = await ensureRemoteUserSession();
    snapshot = await window.SupabaseApi.fetchGuildSnapshot();
    state.guilds = (snapshot.guilds || []).map(function (guild) {
      return normalizeRemoteGuild(guild, context.user.id, state.userId);
    });
    state.guildMembers = (snapshot.guildMembers || []).map(function (member) {
      return normalizeRemoteGuildMember(member, context.user.id, state.userId);
    });
    pruneOrphanGuilds(state);
    saveState(state);
  }

  async function loadRemotePersonalRanking() {
    var characters;

    if (!hasRemoteApi()) {
      view.remotePersonalRanking = [];
      view.remotePersonalRankingLoaded = false;
      view.remoteStatus = "";
      return;
    }

    characters = await window.SupabaseApi.fetchCharactersForRanking();
    view.remotePersonalRanking = createRemoteRankingEntries(characters);
    view.remotePersonalRankingLoaded = true;
    view.remoteStatus = "";
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
      battleLog: String(result.battle_log || "").trim().slice(0, 400),
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

    if (battleType === "solo" && hasRemoteApi()) {
      return runRemoteSoloBattle(state, playerCharacter);
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
          if (hasRemoteApi()) {
            try {
              await window.SupabaseApi.updateGuildScore(winnerGuild.id, Number(winnerGuild.score || 0));
            } catch (error) {
              console.warn("Guild score sync failed:", error);
            }
          }
        }
      }
    }

    battle = {
      id: createId("battle"),
      battleType: battleType,
      player1CharacterId: playerCharacter.id,
      player2CharacterId: opponentCharacter.id,
      opponentName: opponentCharacter.name,
      opponentRace: opponentCharacter.race,
      opponentElement: opponentCharacter.element,
      winnerCharacterId: decision.winner ? decision.winner.id : null,
      battleLog: decision.battleLog || buildBattleLog(playerCharacter, opponentCharacter, outcome, battleType),
      source: decision.source || "fallback",
      createdAt: nowIso()
    };

    state.battles.unshift(battle);
    view.selectedCharacterId = playerCharacter.id;
    view.battleResultId = battle.id;
    saveState(state);
    if (hasRemoteApi() && !playerCharacter.remoteId) {
      try {
        await syncLocalCharacterToRemote(playerCharacter, state);
      } catch (error) {
        console.warn("Player character sync failed:", error);
      }
    }
    if (hasRemoteApi() && playerCharacter.remoteId && opponentCharacter.remoteId) {
      try {
        var remoteWinnerId = outcome === "win"
          ? playerCharacter.remoteId
          : outcome === "loss"
          ? opponentCharacter.remoteId
          : null;
        var remoteBattleLog = battle.battleLog;
        var remoteBattle = await window.SupabaseApi.createBattle({
          character_a_id: playerCharacter.remoteId,
          character_b_id: opponentCharacter.remoteId,
          winner_id: remoteWinnerId,
          story: remoteBattleLog
        });

        battle.remoteBattleId = remoteBattle.id || null;
        battle.id = remoteBattle.id || battle.id;
        view.battleResultId = battle.id;

        await Promise.all([
          window.SupabaseApi.updateCharacterRecord(
            playerCharacter.remoteId,
            Number(playerCharacter.wins || 0),
            Number(playerCharacter.losses || 0),
            Number(playerCharacter.draws || 0)
          ),
          window.SupabaseApi.updateCharacterRecord(
            opponentCharacter.remoteId,
            Number(opponentCharacter.wins || 0),
            Number(opponentCharacter.losses || 0),
            Number(opponentCharacter.draws || 0)
          )
        ]);

        await loadRemotePersonalRanking();

        if (battleType === "guild") {
          await syncRemoteGuildsIntoState(state);
        }

        saveState(state);
      } catch (error) {
        console.warn("Battle sync failed:", error);
      }
    }
    return true;
  }

  async function runRemoteSoloBattle(state, playerCharacter) {
    var currentUser = getCurrentUser(state);
    var context = await ensureRemoteUserSession();
    var remoteCharacters;
    var candidates;
    var opponentCharacter;
    var decision;
    var outcome;
    var opponentOutcome;
    var remoteWinnerId;
    var battleLog;
    var battleRecord;

    await syncLocalCharacterToRemote(playerCharacter, state);
    remoteCharacters = await window.SupabaseApi.fetchCharactersForRanking();
    candidates = remoteCharacters
      .map(normalizeRemoteCharacter)
      .filter(function (character) {
        return character.remoteId !== playerCharacter.remoteId && character.remoteUserId !== context.user.id;
      });

    if (!candidates.length) {
      throw new Error("온라인 개인 배틀을 진행할 상대 캐릭터가 없습니다.");
    }

    opponentCharacter = candidates[Math.floor(Math.random() * candidates.length)];

    try {
      decision = await judgeBattleWithAi(playerCharacter, opponentCharacter);
      view.battleNotice = "AI 판정이 반영되었습니다.";
    } catch (error) {
      console.warn("AI battle fallback:", error);
      decision = createFallbackBattleDecision(playerCharacter, opponentCharacter, "solo");
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

    if (currentUser) {
      if (outcome === "win") {
        currentUser.points = Number(currentUser.points || 0) + 3;
      } else if (outcome === "draw") {
        currentUser.points = Number(currentUser.points || 0) + 1;
      }
    }

    await Promise.all([
      window.SupabaseApi.updateCharacterRecord(
        playerCharacter.remoteId,
        Number(playerCharacter.wins || 0),
        Number(playerCharacter.losses || 0),
        Number(playerCharacter.draws || 0)
      ),
      window.SupabaseApi.updateCharacterRecord(
        opponentCharacter.remoteId,
        Number(opponentCharacter.wins || 0) + (opponentOutcome === "win" ? 1 : 0),
        Number(opponentCharacter.losses || 0) + (opponentOutcome === "loss" ? 1 : 0),
        Number(opponentCharacter.draws || 0) + (opponentOutcome === "draw" ? 1 : 0)
      )
    ]);

    battleLog = decision.battleLog || buildBattleLog(playerCharacter, opponentCharacter, outcome, "solo");
    remoteWinnerId = decision.winner
      ? (decision.winner.id === playerCharacter.id ? playerCharacter.remoteId : opponentCharacter.remoteId)
      : null;

    battleRecord = await window.SupabaseApi.createBattle({
      character_a_id: playerCharacter.remoteId,
      character_b_id: opponentCharacter.remoteId,
      winner_id: remoteWinnerId,
      story: battleLog
    });

    state.battles.unshift({
      id: battleRecord.id || createId("battle"),
      remoteBattleId: battleRecord.id || null,
      battleType: "solo",
      player1CharacterId: playerCharacter.id,
      player2CharacterId: opponentCharacter.remoteId,
      winnerCharacterId: decision.winner
        ? (decision.winner.id === playerCharacter.id ? playerCharacter.id : opponentCharacter.remoteId)
        : null,
      opponentName: opponentCharacter.name,
      opponentRace: opponentCharacter.race,
      opponentElement: opponentCharacter.element,
      winnerName: decision.winner ? decision.winner.name : "",
      battleLog: battleLog,
      source: decision.source || "fallback",
      createdAt: battleRecord.created_at || nowIso()
    });

    view.selectedCharacterId = playerCharacter.id;
    view.battleResultId = state.battles[0].id;
    saveState(state);
    await loadRemotePersonalRanking();
    return true;
  }

  function createCharacter(state, payload) {
    var myCharacters = getCharactersByUser(state, state.userId);

    if (myCharacters.length >= MAX_CHARACTERS) {
      window.alert("캐릭터는 최대 5개까지 만들 수 있습니다.");
      return false;
    }

    var character = {
      id: createId("char"),
      remoteId: payload.remoteId || null,
      remoteUserId: payload.remoteUserId || null,
      userId: state.userId,
      name: payload.name,
      race: payload.race,
      element: payload.element,
      battleText: payload.battleText,
      wins: Number(payload.wins || 0),
      losses: Number(payload.losses || 0),
      draws: Number(payload.draws || 0),
      createdAt: payload.createdAt || nowIso()
    };

    state.characters.unshift(character);

    saveState(state);
    return character;
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
      ownerUserId: state.userId,
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
    pruneOrphanGuilds(state);
    saveState(state);
  }

  function disbandGuild(state, guildId) {
    state.guildMembers = state.guildMembers.filter(function (member) {
      return member.guildId !== guildId;
    });
    state.guilds = state.guilds.filter(function (guild) {
      return guild.id !== guildId;
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
    var headerActions = [];
    var battleLabel = view.isBattling ? "판정 중..." : "배틀";
    var guildBattleLabel = view.isBattling ? "판정 중..." : "길드 배틀";

    if (context === "home") {
      if (selected) {
        actions.push('<button class="button button--primary" data-action="start-solo-battle" data-character-id="' + escapeHtml(character.id) + '">' + battleLabel + "</button>");
      }

      headerActions.push(
        '<button class="icon-button icon-button--danger" type="button" data-action="delete-character" data-character-id="' +
          escapeHtml(character.id) +
          '" aria-label="캐릭터 삭제">✕</button>'
      );
    } else if (context === "arena") {
      if (selected) {
        actions.push('<button class="button button--primary" data-action="start-guild-battle" data-character-id="' + escapeHtml(character.id) + '">' + guildBattleLabel + "</button>");
      }
    }

    return (
      '<article class="character-card' + (selected ? " character-card--selected" : "") + '" data-action="select-character" data-character-id="' + escapeHtml(character.id) + '">' +
      '<div class="character-card__content">' +
      '<div class="stack stack--8">' +
      '<div class="character-card__header">' +
      '<h3 class="character-card__name">' + escapeHtml(character.name) + "</h3>" +
      headerActions.join("") +
      "</div>" +
      '<p class="character-card__description">' + escapeHtml(character.battleText) + "</p>" +
      "</div>" +
      '<div class="tag-row">' +
      renderTag("종족", character.race || "미설정") +
      renderTag("속성", character.element || "미설정") +
      renderTag("승률", winRate + "%", "accent") +
      renderTag("점수", getScore(character), "accent") +
      "</div>" +
      "</div>" +
      (actions.length
        ? ('<div class="character-card__actions">' + actions.join("") + "</div>")
        : "") +
      "</article>"
    );
  }

  function renderBattleResult(state) {
    var battle = state.battles.find(function (item) {
      return item.id === view.battleResultId;
    });
    var opponent;
    var winner;
    var opponentName;
    var opponentRace;
    var opponentElement;

    if (!battle) {
      return "";
    }

    opponent = getCharacterById(
      state,
      battle.player1CharacterId === view.selectedCharacterId ? battle.player2CharacterId : battle.player1CharacterId
    );
    winner = battle.winnerCharacterId ? getCharacterById(state, battle.winnerCharacterId) : null;
    opponentName = opponent ? opponent.name : battle.opponentName || "알 수 없음";
    opponentRace = opponent ? opponent.race : battle.opponentRace || "미설정";
    opponentElement = opponent ? opponent.element : battle.opponentElement || "미설정";

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
      '<div class="stat-card"><span>상대</span><strong>' + escapeHtml(opponentName) + '</strong><div class="tag-row">' + renderTag("종족", opponentRace) + renderTag("속성", opponentElement) + "</div></div>" +
      '<div class="stat-card"><span>판정</span><strong>' + escapeHtml(winner ? winner.name + " 승리" : (battle.winnerName ? battle.winnerName + " 승리" : "무승부")) + "</strong></div>" +
      "</div>" +
      '<pre class="battle-log">' + escapeHtml(battle.battleLog) + "</pre>" +
      "</section>"
    );
  }

  function renderCharacterListWithBattle(state, characters, context) {
    return characters.map(function (character) {
      var content = renderCharacterCard(character, state, context);

      if (view.selectedCharacterId === character.id && view.battleResultId) {
        content += renderBattleResult(state);
      }

      return content;
    }).join("");
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
        ? renderCharacterListWithBattle(state, myCharacters, "home")
        : renderEmptyState("아직 캐릭터가 없습니다.", "첫 캐릭터를 만들고 개인 배틀을 시작하세요.")) +
      "</section>" +
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
      (view.remoteStatus ? '<p class="section-copy">' + escapeHtml(view.remoteStatus) + "</p>" : "") +
      '<div class="segment-control">' +
      '<button class="segment-control__button' + (isPersonal ? " is-active" : "") + '" data-action="set-ranking-mode" data-mode="personal">개인 랭킹</button>' +
      '<button class="segment-control__button' + (!isPersonal ? " is-active" : "") + '" data-action="set-ranking-mode" data-mode="guild">길드 랭킹</button>' +
      "</div>" +
      '<div class="list-section list-section--tight">' +
      (isPersonal
        ? (personalRows.length ? personalRows.map(renderPersonalRankRow).join("") : renderEmptyState("개인 랭킹 데이터가 없습니다.", "배틀을 저장하면 실데이터 랭킹이 표시됩니다."))
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
      '<p class="rank-row__meta">' + escapeHtml((entry.user && entry.user.nickname) || entry.character.nickname || "알 수 없음") + "</p>" +
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
        ? renderCharacterListWithBattle(state, myCharacters, "arena")
        : renderEmptyState("길드전에 투입할 캐릭터가 없습니다.", "홈 탭에서 먼저 캐릭터를 생성하세요.")) +
      "</section>" +
      "</section>"
    );
  }

  function renderGuildTab(state) {
    var guild = getGuildByUser(state, state.userId);
    var members;
    var guildRank;
    var owner;

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
    owner = isGuildOwner(state, state.userId, guild.id);

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
      '<button class="button button--danger button--full" data-action="' + (owner ? "disband-guild" : "leave-guild") + '">' + (owner ? "길드 해체" : "길드 탈퇴") + "</button>" +
      "</section>" +
      "</section>"
    );
  }

  function renderProfileTab(state) {
    var user = getCurrentUser(state);
    var session = createSession();
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
      '<div class="stat-card"><span>연동 상태</span><strong>' + escapeHtml(session.telegram_id ? (session.telegram_verified ? "Telegram 검증됨" : "Telegram 연결됨") : "게스트 모드") + "</strong></div>" +
      '<div class="stat-card"><span>보유 포인트</span><strong>' + escapeHtml(user ? user.points : 0) + "</strong></div>" +
      '<div class="stat-card"><span>총 전적</span><strong>' + escapeHtml(totalBattles) + "</strong></div>" +
      '<div class="stat-card"><span>승률</span><strong>' + escapeHtml(totalBattles ? Math.round((totals.wins / totalBattles) * 100) : 0) + "%</strong></div>" +
      "</div>" +
      '<div class="panel panel--sub">' +
      '<p class="section-kicker">계정 식별</p>' +
      '<h2 class="section-title section-title--small">' + escapeHtml(session.telegram_id ? "Telegram 계정" : "로컬 게스트 세션") + "</h2>" +
      '<p class="section-copy">' +
      escapeHtml(
        session.telegram_id
          ? ("Telegram ID " + session.telegram_id + (session.username ? " / @" + session.username : "") + (session.telegram_verified ? " / 검증 완료" : " / 미검증"))
          : "텔레그램 밖에서 실행 중입니다. 현재 세션은 이 브라우저에만 저장됩니다."
      ) +
      "</p>" +
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

  async function handleCreateCharacter(event) {
    var state = getState();
    var form = event.target;
    var name = clampText(form.name.value.trim(), 20);
    var race = form.race.value;
    var element = form.element.value;
    var battleText = clampText(form.battleText.value.trim(), BATTLE_TEXT_LIMIT);
    var character;
    var remoteCharacter;
    var context;

    event.preventDefault();

    if (!name || !race || !element || !battleText) {
      window.alert("모든 항목을 입력하세요.");
      return;
    }

    if (getCharactersByUser(state, state.userId).length >= MAX_CHARACTERS) {
      window.alert("캐릭터는 최대 5개까지 만들 수 있습니다.");
      return;
    }

    try {
      if (hasRemoteApi()) {
        context = await ensureRemoteUserSession();
        remoteCharacter = await window.SupabaseApi.createCharacter({
          user_id: context.user.id,
          nickname: context.user.nickname,
          name: name,
          image_url: DEFAULT_CHARACTER_IMAGE,
          description: buildCharacterDescription({
            race: race,
            element: element,
            battleText: battleText
          })
        });
      }

      character = createCharacter(state, {
        name: name,
        race: race,
        element: element,
        battleText: battleText,
        remoteId: remoteCharacter ? remoteCharacter.id : null,
        remoteUserId: context ? context.user.id : null,
        wins: remoteCharacter ? remoteCharacter.wins : 0,
        losses: remoteCharacter ? remoteCharacter.losses : 0,
        draws: remoteCharacter ? remoteCharacter.draws : 0,
        createdAt: remoteCharacter ? remoteCharacter.created_at : nowIso()
      });

      if (!character) {
        return;
      }

      view.homeCreateOpen = false;

      if (hasRemoteApi()) {
        await loadRemotePersonalRanking();
      }

      renderApp();
    } catch (error) {
      window.alert(error && error.message ? error.message : "캐릭터 저장 중 오류가 발생했습니다.");
    }
  }

  async function handleGuildCreate(event) {
    var state = getState();
    var name = event.target.name.value.trim();
    var context;

    event.preventDefault();

    if (!name) {
      window.alert("길드 이름을 입력하세요.");
      return;
    }

    try {
      if (hasRemoteApi()) {
        context = await ensureRemoteUserSession();
        await window.SupabaseApi.createGuild(name, context.user.id);
        await syncRemoteGuildsIntoState(state);
        renderApp();
      } else {
        if (createGuild(state, name)) {
          renderApp();
        }
      }
    } catch (error) {
      window.alert(error && error.message ? error.message : "길드 생성 중 오류가 발생했습니다.");
    }
  }

  async function handleGuildJoin(event) {
    var state = getState();
    var inviteCode = event.target.inviteCode.value.trim();
    var context;

    event.preventDefault();

    if (!inviteCode) {
      window.alert("초대 코드를 입력하세요.");
      return;
    }

    try {
      if (hasRemoteApi()) {
        context = await ensureRemoteUserSession();
        await window.SupabaseApi.joinGuildByInviteCode(inviteCode, context.user.id);
        await syncRemoteGuildsIntoState(state);
        renderApp();
      } else {
        if (joinGuild(state, inviteCode)) {
          renderApp();
        }
      }
    } catch (error) {
      window.alert(error && error.message ? error.message : "길드 가입 중 오류가 발생했습니다.");
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
      if (view.rankingMode === PERSONAL_RANKING && hasRemoteApi() && !view.remotePersonalRankingLoaded) {
        view.remoteStatus = "실데이터 랭킹을 불러오는 중입니다.";
        loadRemotePersonalRanking()
          .catch(function (error) {
            view.remoteStatus = error && error.message ? error.message : "랭킹 데이터를 불러오지 못했습니다.";
          })
          .finally(renderApp);
      }
      renderApp();
      return;
    }

    if (trigger.dataset.action === "select-character") {
      if (trigger.dataset.characterId) {
        view.selectedCharacterId =
          view.selectedCharacterId === trigger.dataset.characterId ? null : trigger.dataset.characterId;
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
      if (hasRemoteApi()) {
        var deletingCharacter = getCharacterById(state, characterId);
        if (deletingCharacter && deletingCharacter.remoteId) {
          try {
            await window.SupabaseApi.deleteCharacter(deletingCharacter.remoteId);
          } catch (error) {
            window.alert(error && error.message ? error.message : "원격 캐릭터 삭제에 실패했습니다.");
            return;
          }
        }
      }
      deleteCharacter(state, characterId);
      if (hasRemoteApi()) {
        await loadRemotePersonalRanking();
      }
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
      try {
        if (hasRemoteApi()) {
          var currentContext = await ensureRemoteUserSession();
          var currentGuild = getGuildByUser(state, state.userId);
          if (currentGuild) {
            await window.SupabaseApi.leaveGuild(currentGuild.id, currentContext.user.id);
            await syncRemoteGuildsIntoState(state);
          }
        } else {
          leaveGuild(state);
        }
      } catch (error) {
        window.alert(error && error.message ? error.message : "길드 탈퇴 중 오류가 발생했습니다.");
        return;
      }
      renderApp();
      return;
    }

    if (trigger.dataset.action === "disband-guild") {
      var ownedGuild = getGuildByUser(state, state.userId);
      if (!ownedGuild) {
        return;
      }
      if (!window.confirm("길드를 해체할까요? 초대 코드와 모든 길드 멤버 정보가 함께 삭제됩니다.")) {
        return;
      }
      try {
        if (hasRemoteApi()) {
          await window.SupabaseApi.disbandGuild(ownedGuild.id);
          await syncRemoteGuildsIntoState(state);
        } else {
          disbandGuild(state, ownedGuild.id);
        }
      } catch (error) {
        window.alert(error && error.message ? error.message : "길드 해체 중 오류가 발생했습니다.");
        return;
      }
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
  document.addEventListener("DOMContentLoaded", function () {
    var state = getState();

    renderApp();

    if (!hasRemoteApi()) {
      return;
    }

    view.remoteStatus = "실데이터를 동기화하는 중입니다.";
    verifyTelegramSession()
      .catch(function (error) {
        console.warn("Telegram session verification failed:", error);
      })
      .then(function () {
        return syncRemoteCharactersIntoState(state);
      })
      .then(function () {
        return syncRemoteGuildsIntoState(state);
      })
      .then(loadRemotePersonalRanking)
      .then(function () {
        view.remoteStatus = "";
      })
      .catch(function (error) {
        view.remoteStatus = error && error.message ? error.message : "실데이터 동기화에 실패했습니다.";
      })
      .finally(renderApp);
  });
})();
