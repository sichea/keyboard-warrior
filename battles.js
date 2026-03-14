(function () {
  "use strict";

  async function loadBattles() {
    var battleList = window.App.getElement("battleList");
    var loading = window.App.getElement("battlesLoading");
    var messageBox = window.App.getElement("battlesMessage");

    try {
      if (!window.SupabaseApi.hasValidConfig()) {
        throw new Error(window.SupabaseApi.getMissingConfigMessage());
      }

      var battles = await window.SupabaseApi.fetchAllBattles();
      loading.hidden = true;

      if (!battles.length) {
        window.App.renderEmptyState(
          battleList,
          "배틀 기록이 없습니다.",
          "배틀 탭에서 첫 배틀을 실행하면 기록이 여기에 쌓입니다."
        );
        return;
      }

      battleList.innerHTML = battles
        .map(function (battle) {
          return window.App.createBattleCard(battle, { collapsed: true });
        })
        .join("");
    } catch (error) {
      loading.hidden = true;
      var friendlyMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  }

  async function initializePage() {
    if (document.body.dataset.page !== "battles") {
      return;
    }

    await loadBattles();
  }

  document.addEventListener("DOMContentLoaded", initializePage);
})();
