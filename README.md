# ClarityAI Extension (Dark Mode Theme)

![SmartSummarizer Logo](SmartSummarizer%20Logo%20with%20Paper%20and%20Digital%20Interface.png)

A Chrome extension that uses Google's Gemini AI to summarize web pages.

## What makes us different ?

- Our extension automatically saves your last summary locally, so you won’t need to reuse API tokens every time you close it. The saved summary remains available until you generate a new one

## Features

- 📄 Summarize any webpage with AI
- 🎯 Multiple summary styles (short, bullets, detailed)
- 📋 Copy summaries to clipboard
- 🔧 Customizable settings
- 🧪 API key testing functionality

## Setup Instructions

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key (starts with "AIza...")

### 2. Install the Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. *Only if you didnot find it you can see any YouTube video to know you browser settings

### 3. Configure the Extension

1. Click the ClarityAI extension icon in your toolbar
2. Click "Settings" in the popup
3. Paste your Gemini API key in the "Gemini API Key" field
4. Click "Test API Key" to verify it works
5. Click "Save"

### 4. Use the Extension

- **Auto-summarize**: Click the extension icon to automatically summarize the current page
- **Context menu**: Right-click on any page and select "Summarize this page with ClarityAI"
- **Selected text**: Select text on a page, right-click, and choose the summarize option

## Troubleshooting

### "No summary yet" or "Please set your Gemini API key"

- Make sure you've added your API key in the Settings page
- Verify the API key is correct by using the "Test API Key" button
- Check that you have an active internet connection

### API Key Errors

- Ensure your API key is valid and not expired
- Check that you have sufficient quota on your Google AI Studio account
- Verify the API key starts with "AIza..."

### Extension Not Working

- Most common error is when you cannot summarize any more that means you have used up all free tokens. Then either wait for next day or you can create new API Key (From another Gemini account)
- Try reloading the extension in `chrome://extensions/`
- Check the browser console for error messages
- Ensure the extension has permission to access the current page

## Privacy

- Your API key is stored locally in your browser so nothing to worry no one can see it)
- Page content is sent to Google's Gemini API for summarization
- No data is stored on external servers

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your API key is working (Use Test API button from extension)
3. Try reloading the extension
4. Check that the target website allows content extraction
