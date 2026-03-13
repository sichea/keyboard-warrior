(function () {
  "use strict";

  var hasBoundBattleButton = false;

  function pickWinner(characterA, characterB) {
    var profileA = window.App.parseCharacterProfile(characterA.description);
    var profileB = window.App.parseCharacterProfile(characterB.description);
    var scoreA = profileA.skills.length + Math.random() * 3;
    var scoreB = profileB.skills.length + Math.random() * 3;

    return scoreA >= scoreB ? characterA : characterB;
  }

  function createFallbackBattleStory(characterA, characterB, winner) {
    var loser = winner.id === characterA.id ? characterB : characterA;
    var winnerProfile = window.App.parseCharacterProfile(winner.description);
    var loserProfile = window.App.parseCharacterProfile(loser.description);
    var winnerSkill = winnerProfile.skills[0] || "전술 변화";
    var loserSkill = loserProfile.skills[0] || "정면 돌파";

    return (
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
      "가 자신의 캐릭터 특성을 더 자연스럽게 살렸기 때문에 승리했습니다."
    );
  }

  async function createBattleStory(characterA, characterB, winner) {
    try {
      var result = await window.SupabaseApi.generateAiBattleNarrative({
        character_a: characterA,
        character_b: characterB,
        winner: winner
      });

      if (result && result.story) {
        return result.story;
      }
    } catch (error) {
      console.warn("AI battle function fallback:", error);
    }

    return createFallbackBattleStory(characterA, characterB, winner);
  }

  async function runMockBattle() {
    if (!window.SupabaseApi) {
      throw new Error("Supabase API가 준비되지 않았습니다.");
    }

    var pair = await window.SupabaseApi.fetchTwoRandomCharacters();
    var characterA = pair[0];
    var characterB = pair[1];
    var winner = pickWinner(characterA, characterB);
    var loser = winner.id === characterA.id ? characterB : characterA;
    var story = await createBattleStory(characterA, characterB, winner);

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
      winner_name: winner.name
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
            "success",
            window.App.escapeHtml(battle.winner_name + "의 승리로 배틀이 저장되었습니다.")
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
    createBattleStory: createBattleStory,
    pickWinner: pickWinner,
    runMockBattle: runMockBattle
  };

  document.addEventListener("DOMContentLoaded", loadHomePage);
})();
