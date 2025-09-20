export function extractReadableText() {
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

