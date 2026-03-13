(function () {
  "use strict";

  async function initializePage() {
    if (document.body.dataset.page !== "rank") {
      return;
    }

    var rankList = window.App.getElement("rankList");
    var loading = window.App.getElement("rankLoading");
    var messageBox = window.App.getElement("rankMessage");

    try {
      if (!window.SupabaseApi.hasValidConfig()) {
        throw new Error(window.SupabaseApi.getMissingConfigMessage());
      }

      var characters = await window.SupabaseApi.fetchCharactersForRanking();
      loading.hidden = true;

      if (!characters.length) {
        window.App.renderEmptyState(
          rankList,
          "아직 등록된 캐릭터가 없습니다.",
          "캐릭터를 먼저 만든 뒤 랭킹을 확인하세요."
        );
        return;
      }

      rankList.innerHTML = characters
        .map(function (character) {
          return window.App.createCharacterCard(character);
        })
        .join("");
    } catch (error) {
      loading.hidden = true;
      var friendlyMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  }

  document.addEventListener("DOMContentLoaded", initializePage);
})();
