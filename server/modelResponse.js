function collectText(value, textBlocks) {
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, textBlocks);
    return;
  }

  if (!value || typeof value !== "object") return;

  if (value.type === "text" && typeof value.text === "string") {
    textBlocks.push(value.text);
    return;
  }

  for (const key of ["content", "parts", "output", "outputs", "steps"]) {
    if (key in value) collectText(value[key], textBlocks);
  }
}

export function extractRecommendationText(result, { interactions = false } = {}) {
  if (typeof result?.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }

  if (interactions) {
    const textBlocks = [];
    collectText(result?.outputs, textBlocks);
    collectText(result?.output, textBlocks);
    collectText(result?.steps, textBlocks);
    return textBlocks.join("\n").trim();
  }

  const geminiText = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((text) => typeof text === "string")
    .join("\n");
  if (geminiText) return geminiText.trim();

  const openAiText = result?.choices?.[0]?.message?.content;
  return typeof openAiText === "string" ? openAiText.trim() : "";
}

export function sanitizePlainText(text) {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/, "")
        .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/[*#`_~]/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
    )
    .reduce((lines, line) => {
      if (line) {
        lines.push(line);
      } else if (lines.length > 0 && lines.at(-1) !== "") {
        lines.push("");
      }
      return lines;
    }, [])
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
