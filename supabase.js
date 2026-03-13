(function () {
  "use strict";

  var SUPABASE_URL = "https://gffgiqzkqaockdedlsxp.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_4TH7g59bxTthNr6aXMmxdw_9loMIb4S";
  var STORAGE_BUCKET = "character-images";
  var AI_FUNCTION_NAME = "battle-ai";
  var CHARACTER_LIMIT = 5;

  function hasValidConfig() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  function getMissingConfigMessage() {
    return "Supabase 연결 정보가 비어 있습니다. supabase.js의 URL과 anon key를 먼저 입력하세요.";
  }

  function ensureClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인하세요.");
    }

    if (!hasValidConfig()) {
      throw new Error(getMissingConfigMessage());
    }

    if (!window.__supabaseClient) {
      window.__supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return window.__supabaseClient;
  }

  async function uploadCharacterImage(file, fileName) {
    var client = ensureClient();
    var safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    var path = "public/" + Date.now() + "-" + safeFileName;
    var result = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (result.error) {
      throw result.error;
    }

    return client.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function ensureUserRecord(session) {
    var client = ensureClient();
    var nickname = String(session.nickname || "").trim();
    var telegramId = session.telegram_id ? String(session.telegram_id).trim() : null;
    var query;
    var result;

    if (!nickname) {
      throw new Error("사용자 닉네임이 필요합니다.");
    }

    if (telegramId) {
      query = await client
        .from("users")
        .select("*")
        .eq("telegram_id", telegramId)
        .limit(1)
        .maybeSingle();

      if (query.error) {
        throw query.error;
      }

      if (query.data) {
        if (query.data.nickname !== nickname) {
          result = await client
            .from("users")
            .update({ nickname: nickname })
            .eq("id", query.data.id)
            .select()
            .single();

          if (result.error) {
            throw result.error;
          }

          return result.data;
        }

        return query.data;
      }
    }

    query = await client
      .from("users")
      .select("*")
      .eq("nickname", nickname)
      .limit(1)
      .maybeSingle();

    if (query.error) {
      throw query.error;
    }

    if (query.data) {
      return query.data;
    }

    result = await client
      .from("users")
      .insert([
        {
          nickname: nickname,
          telegram_id: telegramId
        }
      ])
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function countCharactersByUser(userId) {
    var client = ensureClient();
    var result = await client
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (result.error) {
      throw result.error;
    }

    return result.count || 0;
  }

  async function createCharacter(payload) {
    var client = ensureClient();
    var currentCount = await countCharactersByUser(payload.user_id);

    if (currentCount >= CHARACTER_LIMIT) {
      throw new Error("한 사용자당 캐릭터는 최대 5개까지 만들 수 있습니다.");
    }

    var result = await client.from("characters").insert([payload]).select().single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function fetchCharactersForRanking() {
    var client = ensureClient();
    var result = await client
      .from("characters")
      .select("*")
      .order("wins", { ascending: false })
      .order("losses", { ascending: true })
      .order("created_at", { ascending: false });

    if (result.error) {
      throw result.error;
    }

    return result.data || [];
  }

  async function fetchMyCharacters(userId) {
    var client = ensureClient();
    var result = await client
      .from("characters")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (result.error) {
      throw result.error;
    }

    return result.data || [];
  }

  async function updateCharacterDetails(characterId, payload) {
    var client = ensureClient();
    var result = await client
      .from("characters")
      .update(payload)
      .eq("id", characterId)
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function deleteCharacter(characterId) {
    var client = ensureClient();
    var result = await client.from("characters").delete().eq("id", characterId);

    if (result.error) {
      throw result.error;
    }
  }

  async function fetchCharacterCount() {
    var client = ensureClient();
    var result = await client.from("characters").select("id", { count: "exact", head: true });

    if (result.error) {
      throw result.error;
    }

    return result.count || 0;
  }

  async function fetchBattleCount() {
    var client = ensureClient();
    var result = await client.from("battles").select("id", { count: "exact", head: true });

    if (result.error) {
      throw result.error;
    }

    return result.count || 0;
  }

  async function fetchRecentBattles(limit) {
    var client = ensureClient();
    var result = await client
      .from("battles")
      .select("id, character_a_id, character_b_id, winner_id, story, created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 5);

    if (result.error) {
      throw result.error;
    }

    return hydrateBattles(result.data || []);
  }

  async function fetchAllBattles() {
    return fetchRecentBattles(100);
  }

  async function hydrateBattles(battles) {
    if (!battles.length) {
      return [];
    }

    var ids = [];
    var map = {};
    var client = ensureClient();
    var result;
    var characterNameMap = {};

    battles.forEach(function (battle) {
      [battle.character_a_id, battle.character_b_id, battle.winner_id].forEach(function (id) {
        if (id && !map[id]) {
          map[id] = true;
          ids.push(id);
        }
      });
    });

    result = await client
      .from("characters")
      .select("id, name")
      .in("id", ids);

    if (result.error) {
      throw result.error;
    }

    (result.data || []).forEach(function (character) {
      characterNameMap[character.id] = character.name;
    });

    return battles.map(function (battle) {
      return Object.assign({}, battle, {
        character_a_name: characterNameMap[battle.character_a_id] || "알 수 없음",
        character_b_name: characterNameMap[battle.character_b_id] || "알 수 없음",
        winner_name: characterNameMap[battle.winner_id] || "알 수 없음"
      });
    });
  }

  async function fetchTwoRandomCharacters() {
    var characters = await fetchCharactersForRanking();

    if (characters.length < 2) {
      throw new Error("배틀을 실행하려면 캐릭터가 최소 2명 필요합니다.");
    }

    var firstIndex = Math.floor(Math.random() * characters.length);
    var secondIndex = firstIndex;

    while (secondIndex === firstIndex) {
      secondIndex = Math.floor(Math.random() * characters.length);
    }

    return [characters[firstIndex], characters[secondIndex]];
  }

  async function generateAiBattleNarrative(payload) {
    var client = ensureClient();
    var result = await client.functions.invoke(AI_FUNCTION_NAME, {
      body: payload
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function createBattle(payload) {
    var client = ensureClient();
    var result = await client.from("battles").insert([payload]).select().single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function updateCharacterRecord(characterId, nextWins, nextLosses) {
    var client = ensureClient();
    var result = await client
      .from("characters")
      .update({
        wins: nextWins,
        losses: nextLosses
      })
      .eq("id", characterId)
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  window.SupabaseApi = {
    AI_FUNCTION_NAME: AI_FUNCTION_NAME,
    CHARACTER_LIMIT: CHARACTER_LIMIT,
    STORAGE_BUCKET: STORAGE_BUCKET,
    countCharactersByUser: countCharactersByUser,
    createBattle: createBattle,
    createCharacter: createCharacter,
    deleteCharacter: deleteCharacter,
    ensureClient: ensureClient,
    ensureUserRecord: ensureUserRecord,
    fetchAllBattles: fetchAllBattles,
    fetchBattleCount: fetchBattleCount,
    fetchCharacterCount: fetchCharacterCount,
    fetchCharactersForRanking: fetchCharactersForRanking,
    fetchMyCharacters: fetchMyCharacters,
    fetchRecentBattles: fetchRecentBattles,
    fetchTwoRandomCharacters: fetchTwoRandomCharacters,
    generateAiBattleNarrative: generateAiBattleNarrative,
    getMissingConfigMessage: getMissingConfigMessage,
    hasValidConfig: hasValidConfig,
    hydrateBattles: hydrateBattles,
    updateCharacterDetails: updateCharacterDetails,
    updateCharacterRecord: updateCharacterRecord,
    uploadCharacterImage: uploadCharacterImage
  };
})();
