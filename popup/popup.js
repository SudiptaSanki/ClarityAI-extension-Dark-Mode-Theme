const extractTextButton = document.getElementById("extractText");
const summarizeButton = document.getElementById("summarize");
const copySummaryButton = document.getElementById("copySummary");
const testApiButton = document.getElementById("testApi");
const summaryStyleSelect = document.getElementById("summaryStyle");
const outputPre = document.getElementById("output");
const title = document.getElementById("title");
const openOptions = document.getElementById("openOptions");

// Add debug button if it doesn't exist
let debugButton;
if (!document.getElementById("debugButton")) {
  debugButton = document.createElement("button");
  debugButton.id = "debugButton";
  debugButton.textContent = "Debug Info";
  debugButton.style.marginTop = "10px";
  debugButton.style.width = "100%";
  debugButton.style.padding = "8px";
  debugButton.style.backgroundColor = "var(--bg-button)";
  debugButton.style.color = "var(--text-primary)";
  debugButton.style.border = "none";
  debugButton.style.borderRadius = "4px";
  debugButton.style.cursor = "pointer";

  debugButton.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const storage = await chrome.storage.local.get(["geminiApiKey", "model", "summaryStyle"]);

      outputPre.textContent = `🔍 Debug Information:
      
Active Tab: ${tab?.url || 'None'}
API Key: ${storage.geminiApiKey ? '✅ Set' : '❌ Not set'}
Model: ${storage.model || 'gemini-2.5-flash'}
Style: ${storage.summaryStyle || 'short'}
Storage Keys: ${Object.keys(storage).join(', ')}`;
    } catch (e) {
      outputPre.textContent = `Debug Error: ${e.message}`;
    }
  });

  // Insert after the copy button
  copySummaryButton.parentNode.insertBefore(debugButton, copySummaryButton.nextSibling);
}

// Load saved summary style and last summary on popup open
chrome.storage.local.get(["lastSummary", "geminiApiKey", "summaryStyle", "isSummarizing"]).then(({ lastSummary, geminiApiKey, summaryStyle, isSummarizing }) => {
  if (!geminiApiKey) {
    outputPre.textContent = "⚠️ Please set your Gemini API key in Settings first.\n\nTo get an API key:\n1. Go to https://makersuite.google.com/app/apikey\n2. Create a new API key\n3. Copy it and paste it in the Settings page";
    return;
  }

  // Set the summary style dropdown to saved value
  if (summaryStyle) {
    summaryStyleSelect.value = summaryStyle;
  }

  // Check if summarization is in progress
  if (isSummarizing) {
    outputPre.textContent = "🔄 Summarization in progress... Please wait.";
    summarizeButton.disabled = true;
    summarizeButton.textContent = "Summarizing...";
  } else if (lastSummary) {
    // Check if the summary looks like an error message
    if (lastSummary.includes("❌") || lastSummary.includes("Error:") || lastSummary.includes("Failed")) {
      outputPre.textContent = lastSummary;
    } else {
      outputPre.textContent = `✅ Previous Summary:\n\n${lastSummary}`;
    }
  } else {
    outputPre.textContent = "📄 Ready to summarize! Select a style and click 'Summarize' to generate a summary of this page.";
  }
});

// Listen for storage changes to update the popup in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Handle summary updates
    if (changes.lastSummary) {
      const newSummary = changes.lastSummary.newValue;
      if (newSummary) {
        outputPre.textContent = `✅ Summary:\n\n${newSummary}`;
        // Re-enable the button if it was disabled
        summarizeButton.disabled = false;
        summarizeButton.textContent = "Summarize";
      }
    }

    // Handle summarization state changes
    if (changes.isSummarizing) {
      const isSummarizing = changes.isSummarizing.newValue;
      if (isSummarizing) {
        outputPre.textContent = "🔄 Summarization in progress... Please wait.";
        summarizeButton.disabled = true;
        summarizeButton.textContent = "Summarizing...";
      } else {
        // Only re-enable if we don't have a summary yet (to avoid overriding the summary display)
        if (!outputPre.textContent.includes("✅ Summary:")) {
          summarizeButton.disabled = false;
          summarizeButton.textContent = "Summarize";
        }
      }
    }
  }
});

// Simple summarize function
async function performSummarize() {
  const { geminiApiKey } = await chrome.storage.local.get(["geminiApiKey"]);
  if (!geminiApiKey) {
    outputPre.textContent = "⚠️ Please set your Gemini API key in Settings first.";
    return;
  }

  outputPre.textContent = "🔄 Extracting page content...";
  summarizeButton.disabled = true;
  summarizeButton.textContent = "Extracting...";

  try {
    const selectedStyle = summaryStyleSelect.value;
    await chrome.storage.local.set({ summaryStyle: selectedStyle });

    // Update status to show we're now summarizing
    outputPre.textContent = "🔄 Summarizing with AI... Please wait.";
    summarizeButton.textContent = "Summarizing...";

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000)
    );

    const messagePromise = chrome.runtime.sendMessage({
      type: "SUMMARIZE_ACTIVE_TAB",
      summaryStyle: selectedStyle
    });

    const response = await Promise.race([messagePromise, timeoutPromise]);

    if (response?.error) {
      outputPre.textContent = `❌ Error: ${response.error}`;
      console.error("Summarization error:", response.error);
    } else if (response?.summary) {
      // The storage listener will automatically update the UI
      // But we can also update immediately for better responsiveness
      outputPre.textContent = `✅ Summary:\n\n${response.summary}`;
      // Also save to storage for persistence
      await chrome.storage.local.set({ lastSummary: response.summary });
    } else {
      outputPre.textContent = "❌ No summary received. Please try again.\n\nThis might be due to:\n• Rate limiting (wait a moment)\n• Page content issues\n• API connection problems";
      console.error("Unexpected response:", response);
    }
  } catch (e) {
    console.error("Summarize error:", e);
    if (e.message.includes("timeout")) {
      outputPre.textContent = `❌ Request timed out. Please try again.\n\nThis might be due to:\n• Slow API response\n• Network issues\n• Rate limiting`;
    } else {
      outputPre.textContent = `❌ Failed to summarize: ${e.message}\n\nPlease check your API key and try again.`;
    }
  } finally {
    summarizeButton.disabled = false;
    summarizeButton.textContent = "Summarize";
  }
}

// Manual summarize button click
summarizeButton.addEventListener("click", performSummarize);

extractTextButton.addEventListener("click", async () => {
  outputPre.textContent = "Extracting text...";
  extractTextButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      outputPre.textContent = "No active tab.";
      return;
    }
    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const parts = [];
        let node;
        const maxChars = 100000;
        while ((node = walker.nextNode())) {
          const text = node.nodeValue?.replace(/\s+/g, " ").trim();
          if (text) {
            parts.push(text);
            if (parts.join(" ").length > maxChars) break;
          }
        }
        return parts.join(" ");
      }
    });
    outputPre.textContent = pageText || "No text extracted.";
  } catch (e) {
    outputPre.textContent = "Failed to extract text.";
  } finally {
    extractTextButton.disabled = false;
  }
});

copySummaryButton.addEventListener("click", async () => {
  const text = outputPre.textContent;
  if (text && text !== "No summary yet." && !text.includes("Failed") && !text.includes("Extracting") && !text.includes("⚠️")) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = copySummaryButton.textContent;
      copySummaryButton.textContent = "Copied!";
      copySummaryButton.style.background = "var(--success)";
      setTimeout(() => {
        copySummaryButton.textContent = originalText;
        copySummaryButton.style.background = "var(--bg-button-primary)";
      }, 1000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }
});

// Test API connection
testApiButton.addEventListener("click", async () => {
  outputPre.textContent = "Testing API connection...";
  testApiButton.disabled = true;
  testApiButton.textContent = "Testing...";

  try {
    const { geminiApiKey, model = "gemini-2.5-flash" } = await chrome.storage.local.get(["geminiApiKey", "model"]);

    if (!geminiApiKey) {
      outputPre.textContent = "No API key found. Please set your API key in Settings.";
      return;
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("API test timed out after 15 seconds")), 15000)
    );

    const messagePromise = chrome.runtime.sendMessage({
      type: "TEST_API",
      apiKey: geminiApiKey,
      model: model
    });

    const response = await Promise.race([messagePromise, timeoutPromise]);

    if (response?.error) {
      outputPre.textContent = `❌ API Test Failed: ${response.error}`;
    } else if (response?.result) {
      outputPre.textContent = `✅ API Test Successful!\n\nResponse: ${response.result}`;
    } else {
      outputPre.textContent = `✅ API Test Successful!\n\nResponse: ${JSON.stringify(response)}`;
    }
  } catch (e) {
    console.error("API test error:", e);
    if (e.message.includes("timeout")) {
      outputPre.textContent = `❌ API Test timed out. Please try again.`;
    } else {
      outputPre.textContent = `❌ API Test Failed: ${e.message}`;
    }
  } finally {
    testApiButton.disabled = false;
    testApiButton.textContent = "Test API";
  }
});

openOptions.addEventListener("click", async (e) => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open("../options/options.html");
  }
});

