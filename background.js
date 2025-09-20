// Registers context menu and handles summarize requests
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ClarityAI-summarize",
    title: "Summarize this page with ClarityAI",
    contexts: ["page", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "ClarityAI-summarize" || !tab?.id) return;
  try {
    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection?.()?.toString();
        if (selection && selection.trim().length > 0) return selection.trim();
        
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

    const { summaryStyle = "short" } = await chrome.storage.local.get(["summaryStyle"]) || {};
    const summary = await summarizeWithAI(pageText, summaryStyle);
    await chrome.storage.local.set({ lastSummary: summary });
    if (tab.id) {
      chrome.action.openPopup?.();
    }
  } catch (error) {
    const message = formatErrorMessage(error);
    console.error("Summarize error", message);
    await chrome.storage.local.set({ lastSummary: message });
  }
});

async function summarizeWithAI(text, summaryStyle = "short") {
  try {
    const {
      model = "gemini-1.5-flash",
      geminiApiKey = ""
    } = (await chrome.storage.local.get([
      "model",
      "geminiApiKey"
    ])) || {};

    if (!geminiApiKey) {
      throw new Error(`Set your Gemini API key in Settings to use ClarityAI.`);
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text provided for summarization.");
    }
    
    console.log("Building prompt for text length:", text.length);
    const prompt = buildPrompt(text, summaryStyle);
    console.log("Prompt built, calling Gemini API");
    
    const result = await summarizeWithGemini({ prompt, model, apiKey: geminiApiKey });
    console.log("Gemini API call successful, result length:", result?.length || 0);
    
    return result;
  } catch (error) {
    console.error("Error in summarizeWithAI:", error);
    throw error;
  }
}

// Rate limiting to prevent 429 errors
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Increased to 2 seconds between requests
const MAX_RETRIES = 3;

async function summarizeWithGemini({ prompt, model, apiKey, retryCount = 0 }) {
  // Add delay if needed to prevent rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  const requestBody = {
    contents: [
      {
        parts: [
          { text: `You are a helpful assistant that summarizes web pages succinctly.\n\n${prompt}` }
        ]
      }
    ],
    generationConfig: { temperature: 0.2 }
  };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      let details = "";
      try {
        const err = await response.json();
        details = err?.error?.message || JSON.stringify(err);
      } catch (_) {
        details = await response.text();
      }
      
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        // Wait longer and retry for rate limiting
        const waitTime = Math.pow(2, retryCount + 1) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return summarizeWithGemini({ prompt, model, apiKey, retryCount: retryCount + 1 });
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a few minutes and try again.");
      } else if (response.status === 403) {
        throw new Error("API key is invalid or doesn't have access to this model.");
      } else if (response.status === 400) {
        throw new Error("Invalid request. Please check your API key and model settings.");
      } else {
        throw new Error(`Gemini error (${response.status}): ${details}`);
      }
    }
    
    const data = await response.json();
    
    if (!data?.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini API.");
    }
    
    const candidate = data.candidates[0];
    
    if (candidate?.finishReason === "SAFETY") {
      throw new Error("Gemini blocked the response due to safety filters.");
    }
    
    const parts = candidate?.content?.parts || [];
    const text = parts.map(p => p?.text || "").join("").trim();
    
    if (!text) {
      throw new Error("No summary text returned by Gemini.");
    }
    
    return text;
  } catch (error) {
    throw error;
  }
}

function buildPrompt(text, style) {
  const truncated = text.length > 12000 ? text.slice(0, 12000) : text;
  const styleInstructions = {
    short: "Provide a concise 3-5 sentence summary.",
    bullets: "Provide 5-8 bullet points of key takeaways.",
    detailed: "Provide a detailed summary focusing on key arguments and conclusions."
  }[style] || "Provide a concise summary.";
  return `${styleInstructions}\n\nText:\n${truncated}`;
}

// Listen for messages from popup to trigger summarize
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message?.type === "TEST_API") {
    try {
      const { apiKey, model = "gemini-1.5-flash" } = message;
      
      if (!apiKey) {
        return sendResponse({ error: "No API key provided" });
      }
      
      const testResult = await summarizeWithGemini({ 
        prompt: "Please respond with 'API test successful' if you can see this message.", 
        model, 
        apiKey 
      });
      
      sendResponse({ result: testResult });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true; // async response
  }
  
  if (message?.type === "SUMMARIZE_ACTIVE_TAB") {
    try {
      console.log("Received SUMMARIZE_ACTIVE_TAB message");
      
      // Set summarization in progress
      await chrome.storage.local.set({ isSummarizing: true });
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        console.error("No active tab found");
        await chrome.storage.local.set({ isSummarizing: false });
        return sendResponse({ error: "No active tab." });
      }
      
      console.log("Executing script on tab:", tab.id);
      const [{ result: pageText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection?.()?.toString();
          if (selection && selection.trim().length > 0) return selection.trim();
          
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
      
      console.log("Extracted text length:", pageText?.length || 0);
      if (!pageText || pageText.trim().length === 0) {
        console.error("No text found on page");
        await chrome.storage.local.set({ isSummarizing: false });
        return sendResponse({ error: "No text found on this page to summarize." });
      }
      
      const summaryStyle = message.summaryStyle || (await chrome.storage.local.get(["summaryStyle"])).summaryStyle || "short";
      console.log("Using summary style:", summaryStyle);
      
      console.log("Calling summarizeWithAI");
      const summary = await summarizeWithAI(pageText, summaryStyle);
      console.log("Summary generated, length:", summary?.length || 0);
      
      await chrome.storage.local.set({ lastSummary: summary, isSummarizing: false });
      console.log("Sending response with summary");
      sendResponse({ summary });
      
    } catch (e) {
      console.error("Error in SUMMARIZE_ACTIVE_TAB handler:", e);
      const errorMessage = formatErrorMessage(e);
      await chrome.storage.local.set({ lastSummary: errorMessage, isSummarizing: false });
      sendResponse({ error: errorMessage });
    }
    return true; // async response
  }
});

function formatErrorMessage(error) {
  if (!error) return "Failed to generate summary.";
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return "Failed to generate summary.";
  }
}

