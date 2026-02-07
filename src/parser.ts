import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getLanguagePattern, findPythonFunctionEnd } from './languagePatterns';

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  type: 'function' | 'method' | 'arrow' | 'variable';
}

export interface ParsedFunction {
  original: FunctionInfo;
  historical: FunctionInfo | null;
}

/**
 * Parse JavaScript/TypeScript code and extract function information
 */
export class CodeParser {
  /**
   * Extract all functions from source code
   */
  static extractFunctions(sourceCode: string, fileName: string = 'unknown'): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = sourceCode.split('\n');

    // Check if we have language-specific patterns
    const languagePattern = getLanguagePattern(fileName);
    
    // For JavaScript/TypeScript, use AST parsing
    if (!languagePattern || languagePattern.name === 'JavaScript/TypeScript') {
      return this.extractJavaScriptFunctions(sourceCode, fileName);
    }
    
    // For other languages, use regex patterns
    return this.extractFunctionsWithLanguagePatterns(sourceCode, languagePattern);
  }

  /**
   * Extract JavaScript/TypeScript functions using AST
   */
  private static extractJavaScriptFunctions(sourceCode: string, fileName: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = sourceCode.split('\n');

    try {
      // Determine if it's TypeScript based on file extension
      const isTypeScript = fileName.endsWith('.ts') || fileName.endsWith('.tsx');
      
      const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining'
        ]
      });

      traverse(ast, {
        // Function declarations
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          const node = path.node;
          if (node.loc && node.id) {
            const content = lines.slice(node.loc.start.line - 1, node.loc.end.line).join('\n');
            functions.push({
              name: node.id.name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content,
              type: 'function'
            });
          }
        },

        // Class methods
        ClassMethod(path: NodePath<t.ClassMethod>) {
          const node = path.node;
          if (node.loc && t.isIdentifier(node.key)) {
            const content = lines.slice(node.loc.start.line - 1, node.loc.end.line).join('\n');
            functions.push({
              name: node.key.name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content,
              type: 'method'
            });
          }
        },

        // Arrow functions assigned to variables
        VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
          const node = path.node;
          if (
            t.isIdentifier(node.id) &&
            (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init)) &&
            node.loc
          ) {
            const content = lines.slice(node.loc.start.line - 1, node.loc.end.line).join('\n');
            functions.push({
              name: node.id.name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content,
              type: node.init.type === 'ArrowFunctionExpression' ? 'arrow' : 'variable'
            });
          }
        }
      });

    } catch (error) {
      console.error('Error parsing code:', error);
      // Fallback: try to extract functions using regex
      return this.extractFunctionsWithRegex(sourceCode);
    }

    return functions;
  }

  /**
   * Extract functions using language-specific patterns
   */
  private static extractFunctionsWithLanguagePatterns(sourceCode: string, languagePattern: any): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of languagePattern.functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const functionName = match[2];
          const startLine = i + 1;
          let endLine = startLine;
          
          // Handle different block delimiters
          if (languagePattern.blockDelimiters.end === 'indent') {
            // Python-style indentation
            endLine = findPythonFunctionEnd(lines, i);
          } else {
            // Brace-based languages
            let braceCount = 0;
            let foundOpenBrace = false;
            
            for (let j = i; j < lines.length; j++) {
              const currentLine = lines[j];
              for (const char of currentLine) {
                if (char === languagePattern.blockDelimiters.start) {
                  braceCount++;
                  foundOpenBrace = true;
                } else if (char === languagePattern.blockDelimiters.end) {
                  braceCount--;
                  if (foundOpenBrace && braceCount === 0) {
                    endLine = j + 1;
                    break;
                  }
                }
              }
              if (foundOpenBrace && braceCount === 0) {
                break;
              }
            }
          }

          const content = lines.slice(startLine - 1, endLine).join('\n');
          functions.push({
            name: functionName,
            startLine,
            endLine,
            content,
            type: 'function'
          });
          break;
        }
      }
    }

    return functions;
  }

  /**
   * Fallback method using regex to extract functions
   */
  private static extractFunctionsWithRegex(sourceCode: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = sourceCode.split('\n');

    // Regex patterns for different function types
    const patterns = [
      // Function declarations: function name(...) {
      /^(\s*)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
      // Arrow functions: const name = (...) => {
      /^(\s*)(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*.*=>/,
      // Method definitions: methodName(...) {
      /^(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/,
      // Class methods: public/private methodName(...) {
      /^(\s*)(?:public|private|protected)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const functionName = match[2];
          const startLine = i + 1;
          
          // Find the end of the function by counting braces
          let braceCount = 0;
          let endLine = startLine;
          let foundOpenBrace = false;
          
          for (let j = i; j < lines.length; j++) {
            const currentLine = lines[j];
            for (const char of currentLine) {
              if (char === '{') {
                braceCount++;
                foundOpenBrace = true;
              } else if (char === '}') {
                braceCount--;
                if (foundOpenBrace && braceCount === 0) {
                  endLine = j + 1;
                  break;
                }
              }
            }
            if (foundOpenBrace && braceCount === 0) {
              break;
            }
          }

          const content = lines.slice(startLine - 1, endLine).join('\n');
          functions.push({
            name: functionName,
            startLine,
            endLine,
            content,
            type: 'function'
          });
          break;
        }
      }
    }

    return functions;
  }

  /**
   * Find a function that contains the given line range
   */
  static findFunctionAtLines(functions: FunctionInfo[], startLine: number, endLine: number): FunctionInfo | null {
    // First, try to find a function that exactly matches or contains the selection
    for (const func of functions) {
      if (func.startLine <= startLine && func.endLine >= endLine) {
        return func;
      }
    }

    // If no exact match, find the closest function
    let closest: FunctionInfo | null = null;
    let minDistance = Infinity;

    for (const func of functions) {
      const distance = Math.abs(func.startLine - startLine) + Math.abs(func.endLine - endLine);
      if (distance < minDistance) {
        minDistance = distance;
        closest = func;
      }
    }

    return closest;
  }

  /**
   * Find a function by name in the given functions array
   */
  static findFunctionByName(functions: FunctionInfo[], functionName: string): FunctionInfo | null {
    return functions.find(func => func.name === functionName) || null;
  }

  /**
   * Find the best matching historical content for a given selection
   * This uses multiple strategies: exact line range, function matching, and content similarity
   */
  static findHistoricalMatch(
    historicalContent: string,
    fileName: string,
    targetStartLine: number,
    targetEndLine: number,
    currentSelection: string,
    currentFunction: FunctionInfo | null
  ): { content: string; method: string } {
    const historicalLines = historicalContent.split('\n');
    
    // Strategy 1: Try exact line range first
    if (targetStartLine <= historicalLines.length && targetEndLine <= historicalLines.length) {
      const exactRangeContent = historicalLines
        .slice(targetStartLine - 1, targetEndLine)
        .join('\n');
      
      // If we have reasonable content, use it
      if (exactRangeContent.trim().length > 0) {
        return {
          content: exactRangeContent,
          method: 'exact-lines'
        };
      }
    }
    
    // Strategy 2: If current selection was part of a function, try to find that function
    if (currentFunction) {
      const historicalFunctions = this.extractFunctions(historicalContent, fileName);
      const matchingFunction = this.findFunctionByName(historicalFunctions, currentFunction.name);
      
      if (matchingFunction) {
        return {
          content: matchingFunction.content,
          method: 'function-match'
        };
      }
    }
    
    // Strategy 3: Find content with similar text around the target line range
    const searchRange = Math.max(5, Math.abs(targetEndLine - targetStartLine) * 2);
    const searchStart = Math.max(0, targetStartLine - searchRange);
    const searchEnd = Math.min(historicalLines.length, targetEndLine + searchRange);
    
    let bestMatch = '';
    let bestSimilarity = 0;
    
    // Try different ranges around the target area
    for (let start = searchStart; start < targetStartLine + searchRange && start < historicalLines.length; start++) {
      for (let end = start + 1; end <= searchEnd && end <= historicalLines.length; end++) {
        const candidateContent = historicalLines.slice(start, end).join('\n');
        
        if (candidateContent.trim().length === 0) continue;
        
        // Calculate similarity with current selection
        const similarity = this.calculateTextSimilarity(currentSelection, candidateContent);
        
        if (similarity > bestSimilarity && similarity > 0.3) { // At least 30% similarity
          bestSimilarity = similarity;
          bestMatch = candidateContent;
        }
      }
    }
    
    // Strategy 4: Fallback to broader context around target lines
    if (!bestMatch) {
      const fallbackStart = Math.max(0, targetStartLine - 10);
      const fallbackEnd = Math.min(historicalLines.length, targetEndLine + 10);
      bestMatch = historicalLines.slice(fallbackStart, fallbackEnd).join('\n');
    }
    
    return {
      content: bestMatch,
      method: bestSimilarity > 0.3 ? 'similarity-match' : 'context-fallback'
    };
  }
  
  /**
   * Calculate similarity between two text blocks
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Compare current selection with historical version of a function
   */
  static compareWithHistorical(
    currentContent: string,
    currentFileName: string,
    historicalContent: string,
    selectedStartLine: number,
    selectedEndLine: number
  ): ParsedFunction | null {
    const currentFunctions = this.extractFunctions(currentContent, currentFileName);
    const historicalFunctions = this.extractFunctions(historicalContent, currentFileName);

    // Find the function that contains the selected lines
    const selectedFunction = this.findFunctionAtLines(currentFunctions, selectedStartLine, selectedEndLine);
    
    if (!selectedFunction) {
      return null;
    }

    // Try to find the same function in historical content
    const historicalFunction = this.findFunctionByName(historicalFunctions, selectedFunction.name);

    return {
      original: selectedFunction,
      historical: historicalFunction
    };
  }
}
