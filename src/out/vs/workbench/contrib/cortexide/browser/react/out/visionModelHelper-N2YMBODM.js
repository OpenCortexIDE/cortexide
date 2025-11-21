import './chunk-JSBRDJBE.js';

// src2/util/visionModelHelper.ts
var VISION_PROVIDERS = ["anthropic", "openAI", "gemini"];
function hasVisionCapableApiKey(settingsOfProvider, currentModelSelection) {
  if (currentModelSelection) {
    const { providerName } = currentModelSelection;
    if (providerName !== "auto" && VISION_PROVIDERS.includes(providerName)) {
      const providerSettings = settingsOfProvider[providerName];
      if (providerSettings.apiKey && providerSettings.apiKey.length > 10) {
        return true;
      }
    }
  }
  for (const providerName of VISION_PROVIDERS) {
    const providerSettings = settingsOfProvider[providerName];
    if (providerSettings.apiKey && providerSettings.apiKey.length > 10) {
      const hasEnabledModel = providerSettings.models.some((m) => !m.isHidden);
      if (hasEnabledModel) {
        return true;
      }
    }
  }
  return false;
}
function isVisionModelName(modelName) {
  const name = modelName.toLowerCase();
  const visionModelNames = ["llava", "bakllava", "llama-vision", "qwen-vl"];
  return visionModelNames.some((vm) => name.includes(vm));
}
async function hasOllamaVisionModel() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    const models = data.models || [];
    return models.some((m) => {
      const name = (m.name || "").toLowerCase();
      return isVisionModelName(name);
    });
  } catch {
    return false;
  }
}
async function checkOllamaModelVisionCapable(modelName) {
  try {
    const res = await fetch(`http://127.0.0.1:11434/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName })
    });
    if (!res.ok) return false;
    const modelInfo = await res.json();
    const details = JSON.stringify(modelInfo).toLowerCase();
    return details.includes("vision") || details.includes("multimodal") || isVisionModelName(modelName);
  } catch {
    return isVisionModelName(modelName);
  }
}
function isSelectedModelVisionCapable(currentModelSelection, settingsOfProvider) {
  if (!currentModelSelection) return false;
  const { providerName, modelName } = currentModelSelection;
  if (providerName === "auto") return false;
  if (VISION_PROVIDERS.includes(providerName)) {
    const providerSettings = settingsOfProvider[providerName];
    if (providerSettings.apiKey && providerSettings.apiKey.length > 10) {
      const modelExists = providerSettings.models.some(
        (m) => m.modelName === modelName && !m.isHidden
      );
      if (modelExists) {
        return true;
      }
    }
  }
  if (providerName === "ollama") {
    const providerSettings = settingsOfProvider[providerName];
    const baseModelName = modelName.split(":")[0].toLowerCase();
    if (isVisionModelName(modelName)) {
      return true;
    }
    const matchingModel = providerSettings.models.find((m) => {
      if (m.isHidden) return false;
      const modelBaseName = m.modelName.split(":")[0].toLowerCase();
      if (m.modelName === modelName || modelBaseName === baseModelName) {
        return isVisionModelName(m.modelName);
      }
      return false;
    });
    if (matchingModel) {
      return true;
    }
  }
  return false;
}
async function isOllamaAccessible() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export { checkOllamaModelVisionCapable, hasOllamaVisionModel, hasVisionCapableApiKey, isOllamaAccessible, isSelectedModelVisionCapable, isVisionModelName };
