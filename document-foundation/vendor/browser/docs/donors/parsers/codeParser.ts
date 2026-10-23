/**
 * Code Parser — Extracts granular code pieces (DNA) from uploaded files
 * Analyzes TSX, TS, JS, CSS files and breaks them into reusable pieces
 */

import { RecipePiece } from "../drizzle/schema";

export interface ParsedCodePiece {
  name: string;
  pieceType: RecipePiece["pieceType"];
  language: string;
  code: string;
  signature?: string;
  description?: string;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Parse a TypeScript/TSX file and extract individual functions, components, hooks
 */
export function parseTypeScriptFile(content: string, filename: string): ParsedCodePiece[] {
  const pieces: ParsedCodePiece[] = [];

  // Extract React components (function declarations starting with capital letter)
  const componentRegex = /export\s+(?:default\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*(?:\(|:)/gm;
  let match;
  while ((match = componentRegex.exec(content)) !== null) {
    const name = match[1];
    const startIdx = match.index;
    const endIdx = findBlockEnd(content, startIdx);
    const code = content.substring(startIdx, endIdx);

    pieces.push({
      name,
      pieceType: filename.includes(".tsx") ? "component" : "function",
      language: filename.includes(".tsx") ? "tsx" : "ts",
      code: code.trim(),
      signature: extractSignature(code),
      tags: ["exported", filename.includes(".tsx") ? "react" : ""],
    });
  }

  // Extract custom hooks (function declarations starting with "use")
  const hookRegex = /export\s+(?:const|function)\s+(use[A-Z][a-zA-Z0-9]*)\s*(?:\(|:)/gm;
  while ((match = hookRegex.exec(content)) !== null) {
    const name = match[1];
    const startIdx = match.index;
    const endIdx = findBlockEnd(content, startIdx);
    const code = content.substring(startIdx, endIdx);

    pieces.push({
      name,
      pieceType: "hook",
      language: filename.includes(".tsx") ? "tsx" : "ts",
      code: code.trim(),
      signature: extractSignature(code),
      tags: ["exported", "react", "hook"],
    });
  }

  // Extract utility functions
  const utilRegex = /export\s+(?:const|function)\s+([a-z][a-zA-Z0-9]*)\s*(?:\(|:)/gm;
  while ((match = utilRegex.exec(content)) !== null) {
    const name = match[1];
    // Skip if already captured as component or hook
    if (/^[A-Z]/.test(name) || name.startsWith("use")) continue;

    const startIdx = match.index;
    const endIdx = findBlockEnd(content, startIdx);
    const code = content.substring(startIdx, endIdx);

    pieces.push({
      name,
      pieceType: "utility",
      language: filename.includes(".tsx") ? "tsx" : "ts",
      code: code.trim(),
      signature: extractSignature(code),
      tags: ["exported", "utility"],
    });
  }

  // Extract interfaces and types
  const typeRegex = /export\s+(?:interface|type)\s+([A-Z][a-zA-Z0-9]*)\s*[={]/gm;
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    const startIdx = match.index;
    const endIdx = findBlockEnd(content, startIdx);
    const code = content.substring(startIdx, endIdx);

    pieces.push({
      name,
      pieceType: "schema",
      language: "ts",
      code: code.trim(),
      tags: ["exported", "type", "schema"],
    });
  }

  return pieces;
}

/**
 * Parse a CSS/SCSS file and extract individual style blocks
 */
export function parseCSSFile(content: string, filename: string): ParsedCodePiece[] {
  const pieces: ParsedCodePiece[] = [];

  // Extract class definitions
  const classRegex = /\.([a-zA-Z0-9_-]+)\s*{([^}]+)}/gm;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const name = match[1];
    const code = match[0];

    pieces.push({
      name,
      pieceType: "style",
      language: filename.includes(".scss") ? "scss" : "css",
      code: code.trim(),
      tags: ["css", "class"],
    });
  }

  return pieces;
}

/**
 * Parse a JavaScript file (generic function extraction)
 */
export function parseJavaScriptFile(content: string, filename: string): ParsedCodePiece[] {
  const pieces: ParsedCodePiece[] = [];

  // Extract exported functions
  const funcRegex = /export\s+(?:async\s+)?(?:const|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\(|:)/gm;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    const startIdx = match.index;
    const endIdx = findBlockEnd(content, startIdx);
    const code = content.substring(startIdx, endIdx);

    pieces.push({
      name,
      pieceType: "function",
      language: "js",
      code: code.trim(),
      signature: extractSignature(code),
      tags: ["exported", "function"],
    });
  }

  return pieces;
}

/**
 * Extract dependencies from code (imports)
 */
export function extractDependencies(code: string): string[] {
  const deps = new Set<string>();

  // Match import statements
  const importRegex = /import\s+(?:{[^}]*}|\w+)\s+from\s+['"]([^'"]+)['"]/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    deps.add(match[1]);
  }

  // Match require statements
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  while ((match = requireRegex.exec(code)) !== null) {
    deps.add(match[1]);
  }

  return Array.from(deps);
}

/**
 * Extract function signature for display
 */
function extractSignature(code: string): string {
  // Match function declaration or arrow function
  const sigRegex = /(?:export\s+)?(?:async\s+)?(?:const|function)\s+(\w+)\s*(?:\(([^)]*)\))?/;
  const match = code.match(sigRegex);

  if (match) {
    const name = match[1];
    const params = match[2] || "";
    return `${name}(${params})`;
  }

  // Match interface/type
  const typeRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/;
  const typeMatch = code.match(typeRegex);
  if (typeMatch) {
    return typeMatch[1];
  }

  return code.split("\n")[0] || "Unknown";
}

/**
 * Find the end of a code block (matching braces)
 */
function findBlockEnd(content: string, startIdx: number): number {
  let braceCount = 0;
  let inString = false;
  let stringChar = "";

  for (let i = startIdx; i < content.length; i++) {
    const char = content[i];

    // Handle strings
    if ((char === '"' || char === "'" || char === "`") && content[i - 1] !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      braceCount++;
    } else if (char === "}") {
      braceCount--;
      if (braceCount === 0) {
        return i + 1;
      }
    }
  }

  return content.length;
}

/**
 * Main parser dispatcher — routes to appropriate parser based on file type
 */
export function parseFile(content: string, filename: string): ParsedCodePiece[] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "tsx" || ext === "ts") {
    return parseTypeScriptFile(content, filename);
  } else if (ext === "jsx" || ext === "js") {
    return parseJavaScriptFile(content, filename);
  } else if (ext === "css" || ext === "scss") {
    return parseCSSFile(content, filename);
  }

  return [];
}

/**
 * Parse multiple files (e.g., from a zip)
 */
export function parseMultipleFiles(
  files: Array<{ filename: string; content: string }>
): Map<string, ParsedCodePiece[]> {
  const allPieces = new Map<string, ParsedCodePiece[]>();

  for (const file of files) {
    const pieces = parseFile(file.content, file.filename);
    if (pieces.length > 0) {
      allPieces.set(file.filename, pieces);
    }
  }

  return allPieces;
}
