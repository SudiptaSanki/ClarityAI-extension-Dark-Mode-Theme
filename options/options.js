const modelInput = document.getElementById("model");
const geminiKeyInput = document.getElementById("geminiApiKey");
const styleSelect = document.getElementById("summaryStyle");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("testKey");
const statusEl = document.getElementById("status");

async function load() {
  const {
    model = "gemini-2.5-flash",
    geminiApiKey = "",
    summaryStyle = "short"
  } = (await chrome.storage.local.get([
    "model",
    "geminiApiKey",
    "summaryStyle"
  ])) || {};
  modelInput.value = model;
  geminiKeyInput.value = geminiApiKey;
  styleSelect.value = summaryStyle;
}

async function save() {
  const model = modelInput.value.trim() || "gemini-2.5-flash";
  const geminiApiKey = geminiKeyInput.value.trim();
  const summaryStyle = styleSelect.value;

  if (!geminiApiKey) {
    statusEl.textContent = "Error: API key is required";
    statusEl.style.color = "var(--error)";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.style.color = "";
    }, 3000);
    return;
  }

  await chrome.storage.local.set({ model, geminiApiKey, summaryStyle });
  statusEl.textContent = "Saved successfully!";
  statusEl.style.color = "var(--success)";
  setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }, 1500);
}

async function testApiKey() {
  const geminiApiKey = geminiKeyInput.value.trim();
  if (!geminiApiKey) {
    statusEl.textContent = "Error: Please enter an API key first";
    statusEl.style.color = "var(--error)";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.style.color = "";
    }, 3000);
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = "Testing...";
  statusEl.textContent = "Testing API key...";

  try {
    // Add a small delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello! Please respond with 'API key is working' if you can see this message." }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      } else if (response.status === 403) {
        errorMessage = "API key is invalid or doesn't have access to this model.";
      } else if (response.status === 400) {
        errorMessage = "Invalid request. Please check your API key.";
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      statusEl.textContent = "✅ API key is working!";
      statusEl.style.color = "var(--success)";
    } else {
      throw new Error("Invalid response from API");
    }
  } catch (error) {
    statusEl.textContent = `❌ API key test failed: ${error.message}`;
    statusEl.style.color = "var(--error)";
  }

  setTimeout(() => {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }, 5000);

  testBtn.disabled = false;
  testBtn.textContent = "Test API Key";
}

saveBtn.addEventListener("click", save);
testBtn.addEventListener("click", testApiKey);
document.addEventListener("DOMContentLoaded", load);

