export interface LanguagePattern {
  name: string;
  extensions: string[];
  functionPatterns: RegExp[];
  blockDelimiters: {
    start: string;
    end: string;
  };
}

export const LANGUAGE_PATTERNS: LanguagePattern[] = [
  // JavaScript/TypeScript
  {
    name: 'JavaScript/TypeScript',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    functionPatterns: [
      /^(\s*)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
      /^(\s*)(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*.*=>/,
      /^(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/,
      /^(\s*)(?:public|private|protected|static)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/
    ],
    blockDelimiters: { start: '{', end: '}' }
  },

  // Python
  {
    name: 'Python',
    extensions: ['.py', '.pyw'],
    functionPatterns: [
      /^(\s*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
      /^(\s*)async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
      /^(\s*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(:]?/
    ],
    blockDelimiters: { start: ':', end: 'indent' } // Python uses indentation
  },

  // Java
  {
    name: 'Java',
    extensions: ['.java'],
    functionPatterns: [
      /^(\s*)(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*\w+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/,
      /^(\s*)(?:public|private|protected)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /^(\s*)(?:public|private|protected)?\s*interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    ],
    blockDelimiters: { start: '{', end: '}' }
  },

  // C#
  {
    name: 'C#',
    extensions: ['.cs'],
    functionPatterns: [
      /^(\s*)(?:public|private|protected|internal)?\s*(?:static)?\s*(?:virtual|override)?\s*\w+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{?/,
      /^(\s*)(?:public|private|protected|internal)?\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /^(\s*)(?:public|private|protected|internal)?\s*interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    ],
    blockDelimiters: { start: '{', end: '}' }
  },

  // Python (more specific patterns)
  {
    name: 'Go',
    extensions: ['.go'],
    functionPatterns: [
      /^(\s*)func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
      /^(\s*)func\s*\([^)]*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,  // method receivers
      /^(\s*)type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/
    ],
    blockDelimiters: { start: '{', end: '}' }
  },

  // Rust
  {
    name: 'Rust',
    extensions: ['.rs'],
    functionPatterns: [
      /^(\s*)(?:pub\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
      /^(\s*)(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /^(\s*)(?:pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /^(\s*)impl(?:\s*<[^>]*>)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/
    ],
    blockDelimiters: { start: '{', end: '}' }
  }
];

export function getLanguagePattern(fileName: string): LanguagePattern | null {
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  return LANGUAGE_PATTERNS.find(pattern => 
    pattern.extensions.includes(extension)
  ) || null;
}

export function findPythonFunctionEnd(lines: string[], startLine: number): number {
  const baseIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0;
  
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line or comment, continue
    if (!line || line.startsWith('#')) {
      continue;
    }
    
    const currentIndent = lines[i].match(/^(\s*)/)?.[1].length || 0;
    
    // If we're back to the same or less indentation, function is done
    if (currentIndent <= baseIndent) {
      return i;
    }
  }
  
  return lines.length;
}
