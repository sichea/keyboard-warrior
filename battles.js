(function () {
  "use strict";

  async function initializePage() {
    if (document.body.dataset.page !== "battles") {
      return;
    }

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
          "메인 페이지에서 랜덤 배틀을 실행하면 이곳에 기록이 쌓입니다."
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

  document.addEventListener("DOMContentLoaded", initializePage);
})();
