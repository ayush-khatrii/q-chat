export type MessageFormat = "plain" | "code" | "markdown";

// Classification changes presentation only; never rewrite the message source.
export function classifyMessage(text: string): MessageFormat {
  const explicitBlock =
    /^(?: {0,3}(?:`{3,}|~{3,}|#{1,6}\s|>\s|[-+*]\s|\d+[.)]\s)|\s*\|?.+\|\s*\r?\n\s*\|?\s*:?-{3,})/m;
  if (explicitBlock.test(text)) return "markdown";

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length >= 2) {
    const trimmed = text.trim();
    if (/^[{[]/.test(trimmed)) {
      try {
        const value: unknown = JSON.parse(trimmed);
        if (value !== null && typeof value === "object") return "code";
      } catch {
        /* Not JSON; look for other strong code signals. */
      }
    }
    const declaration =
      /^\s*(?:(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=|(?:async\s+)?def\s+\w+\s*\(|class\s+\w+|(?:import|from)\s+[\w{])/;
    const structural =
      /^\s*(?:[}\]);]+\s*;?$|(?:return|throw|await)\s+\S|(?:if|for|while)\s*\(|(?:if|for|while|elif)\s+.+:|\w+(?:\.\w+)*\s*\([^\n]*\)\s*;?$|\w+\s*=\s*\S)|[;{}]\s*$/;
    const hasDeclaration = lines.some((line) => declaration.test(line));
    const codeLines = lines.filter(
      (line) => declaration.test(line) || structural.test(line),
    );
    if (
      hasDeclaration &&
      codeLines.length >= 2 &&
      codeLines.length / lines.length >= 0.5 &&
      lines.some((line) => /^\s+\S/.test(line) || /[{};]\s*$/.test(line))
    )
      return "code";
  }
  return /`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?:^|\s)\*[^*\n]+\*(?=\s|[.,!?]|$)|(?:^|\s)_[^_\n]+_(?=\s|[.,!?]|$)|~~[^~\n]+~~|!?\[[^\]\n]*\]\([^\n]+\)|https?:\/\/\S+|^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$|^.+\r?\n[=-]{3,}\s*$/m.test(
    text,
  )
    ? "markdown"
    : "plain";
}
