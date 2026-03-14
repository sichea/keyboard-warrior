(function () {
  "use strict";

  var hasBoundBattleButton = false;
  var hasBoundMockBattlePageButton = false;
  var currentMockBattlePair = [];

  function pickWinner(characterA, characterB) {
    var profileA = window.App.parseCharacterProfile(characterA.description);
    var profileB = window.App.parseCharacterProfile(characterB.description);
    var scoreA = profileA.skills.length + Math.random() * 3;
    var scoreB = profileB.skills.length + Math.random() * 3;

    return scoreA >= scoreB ? characterA : characterB;
  }

  function createFallbackBattleDecision(characterA, characterB) {
    var winner = pickWinner(characterA, characterB);
    var loser = winner.id === characterA.id ? characterB : characterA;
    var winnerProfile = window.App.parseCharacterProfile(winner.description);
    var loserProfile = window.App.parseCharacterProfile(loser.description);
    var winnerSkill = winnerProfile.skills[0] || "전술 변화";
    var loserSkill = loserProfile.skills[0] || "정면 돌파";
    var reasoning =
      winner.name +
      "의 핵심 스킬 `" +
      winnerSkill +
      "`이(가) " +
      loser.name +
      "의 `" +
      loserSkill +
      "` 전개보다 현재 설정에서 더 직접적인 승리 조건을 만들었습니다.";
    var story =
      winner.name +
      "는 " +
      winnerProfile.settings +
      "라는 설정을 전투 흐름에 잘 녹여냈습니다. " +
      loser.name +
      "가 " +
      loserSkill +
      "로 압박했지만, " +
      winner.name +
      "는 " +
      winnerSkill +
      "를 핵심 장면에서 사용해 흐름을 뒤집었습니다. 결국 " +
      winner.name +
      "가 자신의 캐릭터 특성을 더 자연스럽게 살렸기 때문에 승리했습니다.";

    return {
      winner: winner,
      loser: loser,
      winner_id: winner.id,
      confidence: 62,
      reasoning: reasoning,
      key_factors: [winnerSkill, winnerProfile.settings || "캐릭터 설정"],
      story: story
    };
  }

  function findWinnerFromDecision(characterA, characterB, decision) {
    if (!decision) {
      return null;
    }

    if (String(decision.winner_id) === String(characterA.id)) {
      return characterA;
    }

    if (String(decision.winner_id) === String(characterB.id)) {
      return characterB;
    }

    if (decision.winner_name === characterA.name || decision.winner === characterA.name) {
      return characterA;
    }

    if (decision.winner_name === characterB.name || decision.winner === characterB.name) {
      return characterB;
    }

    return null;
  }

  function combineBattleStory(decision) {
    var sections = [];

    if (decision.reasoning) {
      sections.push("판정 근거: " + String(decision.reasoning).trim());
    }

    if (decision.story || decision.battle_story) {
      sections.push(String(decision.story || decision.battle_story).trim());
    }

    return sections.join("\n\n");
  }

  async function judgeBattle(characterA, characterB) {
    try {
      var result = await window.SupabaseApi.generateAiBattleNarrative({
        character_a: characterA,
        character_b: characterB
      });
      var winner = findWinnerFromDecision(characterA, characterB, result);

      if (result && winner) {
        return {
          winner: winner,
          loser: winner.id === characterA.id ? characterB : characterA,
          winner_id: winner.id,
          confidence: Number(result.confidence || 0),
          reasoning: result.reasoning || "",
          key_factors: Array.isArray(result.key_factors) ? result.key_factors : [],
          story: combineBattleStory(result) || (winner.name + "의 승리"),
          source: "gemini"
        };
      }
    } catch (error) {
      console.warn("AI battle function fallback:", error);
      var fallbackDecision = createFallbackBattleDecision(characterA, characterB);

      fallbackDecision.source = "fallback";
      fallbackDecision.error_message = error && error.message ? String(error.message) : "Gemini 판정 실패";
      return fallbackDecision;
    }

    var invalidDecision = createFallbackBattleDecision(characterA, characterB);

    invalidDecision.source = "fallback";
    invalidDecision.error_message = "Gemini 응답에서 승자를 식별하지 못했습니다.";
    return invalidDecision;
  }

  function normalizeBattlePair(pair) {
    if (!Array.isArray(pair) || pair.length < 2) {
      return null;
    }

    if (!pair[0] || !pair[1] || String(pair[0].id) === String(pair[1].id)) {
      return null;
    }

    return [pair[0], pair[1]];
  }

  function renderMockBattlePair(pair) {
    var compareTarget = window.App.getElement("mockBattleCompare");

    if (!compareTarget) {
      return;
    }

    if (!pair || pair.length < 2) {
      window.App.renderEmptyState(
        compareTarget,
        "배틀할 캐릭터가 부족합니다.",
        "유저가 만든 캐릭터가 2명 이상 있어야 배틀을 시작할 수 있습니다."
      );
      return;
    }

    compareTarget.innerHTML =
      '<article class="battle-side">' +
      '<h3 class="battle-side__name">' +
      window.App.escapeHtml(pair[0].name) +
      "</h3>" +
      '<p class="muted-text">' +
      window.App.escapeHtml(window.App.parseCharacterProfile(pair[0].description).settings || "설정 없음") +
      "</p>" +
      '<span class="pill pill--elo">승 ' +
      window.App.escapeHtml(String(pair[0].wins || 0)) +
      " · 패 " +
      window.App.escapeHtml(String(pair[0].losses || 0)) +
      "</span>" +
      "</article>" +
      '<div class="vs-mark">VS</div>' +
      '<article class="battle-side">' +
      '<h3 class="battle-side__name">' +
      window.App.escapeHtml(pair[1].name) +
      "</h3>" +
      '<p class="muted-text">' +
      window.App.escapeHtml(window.App.parseCharacterProfile(pair[1].description).settings || "설정 없음") +
      "</p>" +
      '<span class="pill pill--elo">승 ' +
      window.App.escapeHtml(String(pair[1].wins || 0)) +
      " · 패 " +
      window.App.escapeHtml(String(pair[1].losses || 0)) +
      "</span>" +
      "</article>";
  }

  async function loadMockBattleLogs() {
    var logsTarget = window.App.getElement("mockBattleLogs");
    var messageBox = window.App.getElement("mockBattleMessage");
    var battles;

    if (!logsTarget) {
      return;
    }

    try {
      battles = await window.SupabaseApi.fetchRecentBattles(5);

      if (!battles.length) {
        window.App.renderEmptyState(
          logsTarget,
          "최근 배틀이 없습니다.",
          "위의 버튼으로 첫 배틀을 실행하면 AI 판정 결과가 여기에 표시됩니다."
        );
        return;
      }

      logsTarget.innerHTML = battles
        .map(function (battle) {
          return window.App.createBattleCard(battle, { collapsed: true });
        })
        .join("");
    } catch (error) {
      var friendlyMessage = window.App.formatSupabaseError(error);

      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  }

  async function loadMockBattlePage() {
    if (document.body.dataset.page !== "mock-battle") {
      return;
    }

    var messageBox = window.App.getElement("mockBattleMessage");
    var startButton = window.App.getElement("startMockBattleButton");
    var pair;

    try {
      if (!window.SupabaseApi.hasValidConfig()) {
        throw new Error(window.SupabaseApi.getMissingConfigMessage());
      }

      pair = await window.SupabaseApi.fetchTwoRandomCharacters();
      currentMockBattlePair = pair;
      renderMockBattlePair(pair);
      await loadMockBattleLogs();
      window.App.setBanner(
        messageBox,
        "info",
        window.App.escapeHtml("표시된 두 캐릭터가 배틀하며, AI는 승패와 전투 스토리를 판정합니다.")
      );
    } catch (error) {
      currentMockBattlePair = [];
      renderMockBattlePair([]);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(window.App.formatSupabaseError(error)));
      window.App.showGlobalError(window.App.formatSupabaseError(error));
    }

    if (startButton && !hasBoundMockBattlePageButton) {
      hasBoundMockBattlePageButton = true;
      startButton.addEventListener("click", async function () {
        var originalText = startButton.textContent;
        var pairToRun = normalizeBattlePair(currentMockBattlePair);
        var battle;

        if (!pairToRun) {
          window.App.setBanner(
            messageBox,
            "error",
            window.App.escapeHtml("배틀할 캐릭터를 먼저 불러오지 못했습니다. 잠시 후 다시 시도하세요.")
          );
          return;
        }

        startButton.disabled = true;
        startButton.textContent = "AI 판정 중...";
        window.App.setBanner(
          messageBox,
          "info",
          window.App.escapeHtml("유저가 만든 캐릭터들의 배틀을 진행하고 AI가 승패를 판정하고 있습니다.")
        );

        try {
          battle = await runMockBattle(pairToRun);
          window.App.setBanner(
            messageBox,
            battle.source === "gemini" ? "success" : "info",
            window.App.escapeHtml(
              battle.character_a_name +
                " vs " +
                battle.character_b_name +
                " 결과: " +
                battle.winner_name +
                " 승리" +
                (battle.source === "gemini"
                  ? ". AI 판정이 반영되었습니다."
                  : ". AI 호출 실패로 기본 판정이 사용되었습니다.")
            )
          );
          await loadMockBattlePage();
        } catch (error) {
          var friendlyMessage = window.App.formatSupabaseError(error);

          window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
          window.App.showGlobalError(friendlyMessage);
        } finally {
          startButton.disabled = false;
          startButton.textContent = originalText;
        }
      });
    }
  }

  async function runMockBattle(pair) {
    if (!window.SupabaseApi) {
      throw new Error("Supabase API가 준비되지 않았습니다.");
    }

    var resolvedPair = normalizeBattlePair(pair) || (await window.SupabaseApi.fetchTwoRandomCharacters());
    var characterA = resolvedPair[0];
    var characterB = resolvedPair[1];
    var decision = await judgeBattle(characterA, characterB);
    var winner = decision.winner;
    var loser = decision.loser;
    var story = decision.story;

    await window.SupabaseApi.updateCharacterRecord(
      winner.id,
      Number(winner.wins || 0) + 1,
      Number(winner.losses || 0)
    );

    await window.SupabaseApi.updateCharacterRecord(
      loser.id,
      Number(loser.wins || 0),
      Number(loser.losses || 0) + 1
    );

    var battle = await window.SupabaseApi.createBattle({
      character_a_id: characterA.id,
      character_b_id: characterB.id,
      winner_id: winner.id,
      story: story
    });

    return Object.assign({}, battle, {
      character_a_name: characterA.name,
      character_b_name: characterB.name,
      winner_name: winner.name,
      reasoning: decision.reasoning || "",
      confidence: decision.confidence || 0,
      source: decision.source || "fallback",
      error_message: decision.error_message || ""
    });
  }

  async function loadHomePage() {
    if (document.body.dataset.page !== "home") {
      return;
    }

    var recentList = window.App.getElement("recentBattlesList");
    var recentMessage = window.App.getElement("recentBattlesMessage");
    var recentLoading = window.App.getElement("recentBattlesLoading");
    var battleCountValue = window.App.getElement("battleCountValue");
    var characterCountValue = window.App.getElement("characterCountValue");
    var homeStatusValue = window.App.getElement("homeStatusValue");
    var runBattleButton = window.App.getElement("runBattleButton");

    try {
      if (!window.SupabaseApi.hasValidConfig()) {
        throw new Error(window.SupabaseApi.getMissingConfigMessage());
      }

      var results = await Promise.all([
        window.SupabaseApi.fetchRecentBattles(5),
        window.SupabaseApi.fetchBattleCount(),
        window.SupabaseApi.fetchCharacterCount()
      ]);

      battleCountValue.textContent = String(results[1]);
      characterCountValue.textContent = String(results[2]);
      homeStatusValue.textContent = "온라인";

      if (!results[0].length) {
        window.App.renderEmptyState(
          recentList,
          "아직 배틀 기록이 없습니다.",
          "캐릭터를 두 명 이상 만든 뒤 랜덤 배틀을 실행해 첫 기록을 남겨보세요."
        );
      } else {
        recentList.innerHTML = results[0]
          .map(function (battle) {
            return window.App.createBattleCard(battle, { collapsed: true });
          })
          .join("");
      }

      recentLoading.hidden = true;
      window.App.setBanner(recentMessage, "", "");
    } catch (error) {
      recentLoading.hidden = true;
      homeStatusValue.textContent = "오류";
      window.App.setBanner(recentMessage, "error", window.App.escapeHtml(window.App.formatSupabaseError(error)));
    }

    if (runBattleButton && !hasBoundBattleButton) {
      hasBoundBattleButton = true;
      runBattleButton.addEventListener("click", async function () {
        var originalText = runBattleButton.textContent;

        runBattleButton.disabled = true;
        runBattleButton.textContent = "배틀 실행 중...";
        homeStatusValue.textContent = "AI 분석 중";
        window.App.setBanner(
          recentMessage,
          "info",
          window.App.escapeHtml("캐릭터 설정과 스킬을 분석해 배틀을 생성하고 있습니다.")
        );

        try {
          var battle = await runMockBattle();

          homeStatusValue.textContent = "완료";
          window.App.setBanner(
            recentMessage,
            battle.source === "gemini" ? "success" : "info",
            window.App.escapeHtml(
              battle.winner_name +
                "의 승리로 배틀이 저장되었습니다." +
                (battle.source === "gemini"
                  ? " Gemini 판정이 반영되었습니다."
                  : " Gemini 호출이 실패해 로컬 판정으로 저장되었습니다.")
            )
          );
          await loadHomePage();
        } catch (error) {
          var friendlyMessage = window.App.formatSupabaseError(error);

          homeStatusValue.textContent = "오류";
          window.App.setBanner(recentMessage, "error", window.App.escapeHtml(friendlyMessage));
          window.App.showGlobalError(friendlyMessage);
        } finally {
          runBattleButton.disabled = false;
          runBattleButton.textContent = originalText;
        }
      });
    }
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest('[data-action="toggle-story"]');

    if (!button) {
      return;
    }

    var card = button.closest(".battle-item");
    var storyElement = card ? card.querySelector('[data-role="story"]') : null;
    var fullStory = button.getAttribute("data-full-story") || "";
    var expanded = button.getAttribute("data-expanded") === "true";

    if (!storyElement) {
      return;
    }

    if (expanded) {
      storyElement.textContent = fullStory.slice(0, 220) + "...";
      button.textContent = "스토리 더 보기";
      button.setAttribute("data-expanded", "false");
    } else {
      storyElement.textContent = fullStory;
      button.textContent = "스토리 접기";
      button.setAttribute("data-expanded", "true");
    }
  });

  window.BattleEngine = {
    judgeBattle: judgeBattle,
    pickWinner: pickWinner,
    runMockBattle: runMockBattle
  };

  document.addEventListener("DOMContentLoaded", loadHomePage);
  document.addEventListener("DOMContentLoaded", loadMockBattlePage);
})();
