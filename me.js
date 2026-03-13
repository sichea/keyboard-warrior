(function () {
  "use strict";

  function createEditor(character) {
    var profile = window.App.parseCharacterProfile(character.description);

    return (
      '<article class="character-card">' +
      '<div class="character-card__image">' +
      '<img src="' +
      window.App.escapeHtml(window.App.withPlaceholder(character.image_url)) +
      '" alt="' +
      window.App.escapeHtml(character.name || "캐릭터 이미지") +
      '" />' +
      "</div>" +
      "<h3>" +
      window.App.escapeHtml(character.name) +
      "</h3>" +
      '<form class="form-grid" data-role="edit-form" data-character-id="' +
      window.App.escapeHtml(character.id) +
      '">' +
      '<div class="form-field">' +
      '<label>캐릭터 이름</label>' +
      '<input name="name" type="text" maxlength="30" value="' +
      window.App.escapeHtml(character.name || "") +
      '" required />' +
      "</div>" +
      '<div class="form-field">' +
      '<label>캐릭터 설정</label>' +
      '<textarea name="settings" maxlength="100" required>' +
      window.App.escapeHtml(profile.settings) +
      "</textarea>" +
      "</div>" +
      '<div class="form-field">' +
      '<label>캐릭터 스킬</label>' +
      '<textarea name="skills" maxlength="180">' +
      window.App.escapeHtml(profile.skills.join(", ")) +
      "</textarea>" +
      "</div>" +
      '<div class="character-card__footer">' +
      '<button class="button button--secondary" type="submit">수정 저장</button>' +
      '<button class="button button--danger" type="button" data-action="delete-character" data-character-id="' +
      window.App.escapeHtml(character.id) +
      '">삭제</button>' +
      "</div>" +
      "</form>" +
      "</article>"
    );
  }

  async function loadMyCharacters() {
    if (document.body.dataset.page !== "me") {
      return;
    }

    var messageBox = window.App.getElement("myCharactersMessage");
    var summaryBox = window.App.getElement("myCharactersSummary");
    var list = window.App.getElement("myCharactersList");

    try {
      var session = await window.App.requireUserSession({ allowPrompt: true });
      var user = await window.SupabaseApi.ensureUserRecord(session);
      var characters = await window.SupabaseApi.fetchMyCharacters(user.id);

      summaryBox.innerHTML =
        '<div class="status-banner status-banner--info">' +
        window.App.escapeHtml(user.nickname || "사용자") +
        " 님의 캐릭터 " +
        window.App.escapeHtml(String(characters.length)) +
        " / 5" +
        "</div>";

      if (!characters.length) {
        window.App.renderEmptyState(
          list,
          "아직 내 캐릭터가 없습니다.",
          "캐릭터 만들기 페이지에서 첫 캐릭터를 등록해 보세요."
        );
        return;
      }

      list.innerHTML = characters.map(createEditor).join("");
      window.App.setBanner(messageBox, "", "");
    } catch (error) {
      var friendlyMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  }

  document.addEventListener("submit", async function (event) {
    var form = event.target.closest('[data-role="edit-form"]');

    if (!form) {
      return;
    }

    event.preventDefault();

    var messageBox = window.App.getElement("myCharactersMessage");
    var characterId = form.getAttribute("data-character-id");
    var formData = new FormData(form);
    var name = String(formData.get("name") || "").trim();
    var settings = String(formData.get("settings") || "").trim().slice(0, 100);
    var skills = String(formData.get("skills") || "").trim();

    try {
      if (!name) {
        throw new Error("캐릭터 이름을 입력하세요.");
      }

      if (!settings) {
        throw new Error("캐릭터 설정을 입력하세요.");
      }

      await window.SupabaseApi.updateCharacterDetails(characterId, {
        name: name,
        description: window.App.serializeCharacterProfile(settings, window.App.parseSkills(skills))
      });

      window.App.setBanner(messageBox, "success", window.App.escapeHtml("캐릭터가 수정되었습니다."));
      await loadMyCharacters();
    } catch (error) {
      var friendlyMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  });

  document.addEventListener("click", async function (event) {
    var button = event.target.closest('[data-action="delete-character"]');

    if (!button) {
      return;
    }

    var characterId = button.getAttribute("data-character-id");
    var messageBox = window.App.getElement("myCharactersMessage");

    if (!window.confirm("정말 이 캐릭터를 삭제하시겠습니까?")) {
      return;
    }

    try {
      await window.SupabaseApi.deleteCharacter(characterId);
      window.App.setBanner(messageBox, "success", window.App.escapeHtml("캐릭터가 삭제되었습니다."));
      await loadMyCharacters();
    } catch (error) {
      var friendlyMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
      window.App.showGlobalError(friendlyMessage);
    }
  });

  document.addEventListener("DOMContentLoaded", loadMyCharacters);
})();
