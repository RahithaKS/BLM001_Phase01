export interface Citation {
  id: string;
  label: string;
  displayNumber: number;
}

export interface ParsedMessage {
  formattedContent: string;
  citations: Citation[];
}

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function toSuperscript(num: number): string {
  return num
    .toString()
    .split('')
    .map((digit) => SUPERSCRIPT_DIGITS[parseInt(digit)])
    .join('');
}

export function parseCitations(
  content: string,
  citationsArray?: string[]
): ParsedMessage {
  if (!citationsArray || citationsArray.length === 0) {
    return {
      formattedContent: content,
      citations: [],
    };
  }

  const citationMap = new Map<string, Citation>();
  let displayNumber = 1;

  citationsArray.forEach((citation) => {
    const match = citation.match(/^\[(\w+)\]\s+(.+)$/);
    if (match) {
      const [, id, label] = match;
      citationMap.set(id, {
        id,
        label: label.trim(),
        displayNumber: displayNumber++,
      });
    }
  });

  if (citationMap.size === 0) {
    return {
      formattedContent: content,
      citations: [],
    };
  }

  let formattedContent = content;
  const citationRegex = /\[(\w+)\]/g;
  const usedCitations = new Set<string>();

  formattedContent = formattedContent.replace(citationRegex, (match, citationId) => {
    const citation = citationMap.get(citationId);
    if (citation) {
      usedCitations.add(citationId);
      return toSuperscript(citation.displayNumber);
    }
    return match;
  });

  if (usedCitations.size === 0) {
    return {
      formattedContent: content,
      citations: [],
    };
  }

  const citations = Array.from(usedCitations)
    .map((id) => citationMap.get(id)!)
    .sort((a, b) => a.displayNumber - b.displayNumber);

  return {
    formattedContent,
    citations,
  };
}
