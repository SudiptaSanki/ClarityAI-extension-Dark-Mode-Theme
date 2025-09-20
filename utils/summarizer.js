export async function summarize(text, { apiKey, style = "short" } = {}) {
  if (!apiKey) throw new Error("Missing API key");
  const prompt = buildPrompt(text, style);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You summarize text concisely and clearly." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
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

