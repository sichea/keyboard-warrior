(function () {
  "use strict";

  var TARGET_MAX_DIMENSION = 512;
  var TARGET_FILE_SIZE = 150 * 1024;
  var ORIGINAL_WARNING_SIZE = 2 * 1024 * 1024;

  function getCompressionPlan() {
    return [
      { type: "image/webp", extension: ".webp", qualities: [0.82, 0.72, 0.62, 0.52, 0.42] },
      { type: "image/jpeg", extension: ".jpg", qualities: [0.82, 0.72, 0.62, 0.52, 0.42] }
    ];
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("이미지를 읽는 중 오류가 발생했습니다."));
      };

      reader.onload = function (event) {
        resolve(event.target.result);
      };

      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();

      image.onerror = function () {
        reject(new Error("이미지를 불러오지 못했습니다."));
      };

      image.onload = function () {
        resolve(image);
      };

      image.src = dataUrl;
    });
  }

  function calculateResizeSize(width, height, maxDimension) {
    var nextWidth = width;
    var nextHeight = height;

    if (width > height && width > maxDimension) {
      nextHeight = Math.round((height * maxDimension) / width);
      nextWidth = maxDimension;
    } else if (height >= width && height > maxDimension) {
      nextWidth = Math.round((width * maxDimension) / height);
      nextHeight = maxDimension;
    }

    return {
      width: nextWidth,
      height: nextHeight
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (!blob) {
            reject(new Error("압축된 이미지 생성에 실패했습니다."));
            return;
          }

          resolve(blob);
        },
        type,
        quality
      );
    });
  }

  async function resizeAndCompressImage(file) {
    var dataUrl = await readFileAsDataUrl(file);
    var image = await loadImageElement(dataUrl);
    var size = calculateResizeSize(image.width, image.height, TARGET_MAX_DIMENSION);
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    var plan = getCompressionPlan();
    var bestBlob = null;
    var bestMeta = null;
    var baseName = file.name.replace(/\.[^.]+$/, "") || "character-image";
    var i;
    var j;

    if (!context) {
      throw new Error("브라우저가 이미지 리사이즈를 지원하지 않습니다.");
    }

    canvas.width = size.width;
    canvas.height = size.height;
    context.drawImage(image, 0, 0, size.width, size.height);

    for (i = 0; i < plan.length; i += 1) {
      for (j = 0; j < plan[i].qualities.length; j += 1) {
        var quality = plan[i].qualities[j];
        var blob = await canvasToBlob(canvas, plan[i].type, quality);

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
          bestMeta = {
            type: plan[i].type,
            extension: plan[i].extension
          };
        }

        if (blob.size <= TARGET_FILE_SIZE) {
          return {
            file: new File([blob], baseName + plan[i].extension, { type: plan[i].type }),
            outputSize: blob.size,
            targetMet: true
          };
        }
      }
    }

    return {
      file: new File([bestBlob], baseName + bestMeta.extension, { type: bestMeta.type }),
      outputSize: bestBlob.size,
      targetMet: bestBlob.size <= TARGET_FILE_SIZE
    };
  }

  function validateImageFile(file) {
    if (!file) {
      return;
    }

    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드할 수 있습니다.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("원본 이미지가 너무 큽니다. 5MB 이하 이미지를 선택하세요.");
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + "B";
    }

    return Math.round((bytes / 1024) * 10) / 10 + "KB";
  }

  function updateCounter(textarea, counter) {
    var value = textarea.value.slice(0, 100);
    textarea.value = value;
    counter.textContent = value.length + " / 100";
  }

  function loadPreviewFromFile(file, previewElement) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        previewElement.src = window.App.DEFAULT_PLACEHOLDER_IMAGE;
        resolve();
        return;
      }

      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("이미지 미리보기를 읽는 중 오류가 발생했습니다."));
      };

      reader.onload = function (event) {
        previewElement.src = event.target.result;
        resolve();
      };

      reader.readAsDataURL(file);
    });
  }

  async function initializePage() {
    if (document.body.dataset.page !== "create") {
      return;
    }

    var form = window.App.getElement("characterForm");
    var nameInput = window.App.getElement("name");
    var settingsInput = window.App.getElement("settings");
    var skillsInput = window.App.getElement("skills");
    var imageInput = window.App.getElement("image");
    var imagePreview = window.App.getElement("imagePreview");
    var counter = window.App.getElement("settingsCounter");
    var submitButton = window.App.getElement("submitButton");
    var messageBox = window.App.getElement("createMessage");
    var summaryBox = window.App.getElement("createUserSummary");
    var session;
    var user;
    var currentCount;

    imagePreview.src = window.App.DEFAULT_PLACEHOLDER_IMAGE;
    updateCounter(settingsInput, counter);

    try {
      session = await window.App.requireUserSession({ allowPrompt: true });
      user = await window.SupabaseApi.ensureUserRecord(session);
      currentCount = await window.SupabaseApi.countCharactersByUser(user.id);
      summaryBox.innerHTML =
        '<div class="status-banner status-banner--info">' +
        window.App.escapeHtml(user.nickname) +
        " 님의 캐릭터 수: " +
        window.App.escapeHtml(String(currentCount)) +
        " / " +
        window.App.escapeHtml(String(window.SupabaseApi.CHARACTER_LIMIT)) +
        "</div>";
    } catch (error) {
      var loginMessage = window.App.formatSupabaseError(error);
      window.App.setBanner(messageBox, "error", window.App.escapeHtml(loginMessage));
      window.App.showGlobalError(loginMessage);
      return;
    }

    settingsInput.addEventListener("input", function () {
      updateCounter(settingsInput, counter);
    });

    imageInput.addEventListener("change", function () {
      var file = imageInput.files && imageInput.files[0];

      if (!file) {
        window.App.setBanner(messageBox, "", "");
        loadPreviewFromFile(null, imagePreview);
        return;
      }

      try {
        validateImageFile(file);
      } catch (error) {
        window.App.setBanner(messageBox, "error", window.App.escapeHtml(window.App.formatSupabaseError(error)));
        imageInput.value = "";
        loadPreviewFromFile(null, imagePreview);
        return;
      }

      loadPreviewFromFile(file, imagePreview).then(function () {
        if (file.size > ORIGINAL_WARNING_SIZE) {
          window.App.setBanner(
            messageBox,
            "info",
            window.App.escapeHtml("원본 이미지가 커서 업로드 전에 강하게 압축합니다.")
          );
        }
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      submitButton.disabled = true;
      window.App.setBanner(messageBox, "info", window.App.escapeHtml("캐릭터를 저장하는 중입니다."));

      try {
        var settings = settingsInput.value.trim().slice(0, 100);
        var skills = window.App.parseSkills(skillsInput.value);
        var imageUrl = window.App.DEFAULT_PLACEHOLDER_IMAGE;

        if (!nameInput.value.trim()) {
          throw new Error("캐릭터 이름을 입력하세요.");
        }

        if (!settings) {
          throw new Error("캐릭터 설정을 입력하세요.");
        }

        if (currentCount >= window.SupabaseApi.CHARACTER_LIMIT) {
          throw new Error("한 사용자당 캐릭터는 최대 5개까지 만들 수 있습니다.");
        }

        if (imageInput.files && imageInput.files[0]) {
          validateImageFile(imageInput.files[0]);

          var optimized = await resizeAndCompressImage(imageInput.files[0]);

          if (!optimized.targetMet) {
            window.App.setBanner(
              messageBox,
              "info",
              window.App.escapeHtml(
                "150KB 이하 목표에는 못 미쳤지만 가장 작은 결과(" +
                  formatFileSize(optimized.outputSize) +
                  ")를 업로드합니다."
              )
            );
          }

          imageUrl = await window.SupabaseApi.uploadCharacterImage(optimized.file, optimized.file.name);
        }

        await window.SupabaseApi.createCharacter({
          user_id: user.id,
          nickname: user.nickname,
          name: nameInput.value.trim(),
          description: window.App.serializeCharacterProfile(settings, skills),
          image_url: imageUrl
        });

        currentCount += 1;
        summaryBox.innerHTML =
          '<div class="status-banner status-banner--success">' +
          window.App.escapeHtml(user.nickname) +
          " 님의 캐릭터 수: " +
          window.App.escapeHtml(String(currentCount)) +
          " / " +
          window.App.escapeHtml(String(window.SupabaseApi.CHARACTER_LIMIT)) +
          "</div>";
        form.reset();
        imagePreview.src = window.App.DEFAULT_PLACEHOLDER_IMAGE;
        updateCounter(settingsInput, counter);
        window.App.setBanner(messageBox, "success", window.App.escapeHtml("캐릭터가 저장되었습니다."));
      } catch (error) {
        var friendlyMessage = window.App.formatSupabaseError(error);
        window.App.setBanner(messageBox, "error", window.App.escapeHtml(friendlyMessage));
        window.App.showGlobalError(friendlyMessage);
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initializePage);
})();
