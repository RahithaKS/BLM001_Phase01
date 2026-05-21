/**
 * Preprocesses markdown content to ensure tables render correctly
 * ROOT CAUSE FIX: Handles all line ending formats, flexible whitespace, and proper logging
 */
export function preprocessMarkdown(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // STEP 1: Normalize all line endings to \n (fixes Windows/Mac/Linux differences)
  let normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // STEP 2: Detect and fix tables with more flexible patterns
  // This regex is intentionally permissive to catch all table variations
  const tablePattern = /\|[^\n]*\|[\s]*\n[\s]*\|[\s]*[-:]+[\s]*\|/g;
  
  // Find all table positions
  const tableMatches: Array<{index: number, length: number}> = [];
  let match;
  while ((match = tablePattern.exec(normalized)) !== null) {
    tableMatches.push({
      index: match.index,
      length: match[0].length
    });
  }
  
  // STEP 3: Ensure blank lines before each table
  // Work backwards to preserve indices
  for (let i = tableMatches.length - 1; i >= 0; i--) {
    const tableStart = tableMatches[i].index;
    
    // Check if there are already 2+ newlines before the table
    let precedingText = normalized.substring(0, tableStart);
    
    // If table is at start of content, skip
    if (tableStart === 0) continue;
    
    // Check last few characters before table
    const lastChars = precedingText.slice(-5);
    
    // If we don't have double newline before table, add it
    if (!lastChars.endsWith('\n\n') && !lastChars.endsWith('\n\n\n')) {
      // Remove any single newlines and replace with double newline
      if (precedingText.endsWith('\n')) {
        normalized = precedingText.slice(0, -1) + '\n\n' + normalized.substring(tableStart);
      } else {
        normalized = precedingText + '\n\n' + normalized.substring(tableStart);
      }
    }
  }
  
  // STEP 4: Remove code fences around tables (more flexible pattern)
  normalized = normalized.replace(
    /```(?:markdown|md)?\s*\n(\|[^\n]+\|[\s\S]*?)\n```/gi,
    '\n\n$1\n\n'
  );
  
  // STEP 5: Ensure blank line after tables
  // Match table rows ending, followed by non-table content
  normalized = normalized.replace(
    /(\|[^\n]+\|)\n([^\n|])/g,
    '$1\n\n$2'
  );
  
  // STEP 6: Clean up excessive blank lines (more than 3 in a row)
  normalized = normalized.replace(/\n{4,}/g, '\n\n\n');
  
  // Log for debugging (only in development)
  if (import.meta.env.DEV && tableMatches.length > 0) {
    console.log(`[Markdown Preprocessor] Fixed ${tableMatches.length} table(s)`);
  }
  
  return normalized;
}
