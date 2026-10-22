export interface CodeFile {
  path: string;
  content: string;
  type: string;
  size: number;
}

export interface FunctionSignature {
  name: string;
  params: string[];
  returnType?: string;
  complexity: number;
  dependencies: string[];
  startLine: number;
  endLine: number;
}

export interface CodeAnalysis {
  functions: FunctionSignature[];
  imports: string[];
  exports: string[];
  classes: string[];
  variables: string[];
  complexity: number;
  compatibility: number;
  risks: string[];
  recommendations: string[];
}

export interface IntegrationPlan {
  shouldIntegrate: boolean;
  confidence: number;
  reasoning: string;
  changes: Array<{
    type: 'add' | 'modify' | 'delete';
    file: string;
    content: string;
    explanation: string;
  }>;
  conflicts: string[];
  safetyScore: number;
}

export class CodeAnalyzer {
  private static readonly CODE_EXTENSIONS = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift',
    'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json', 'yaml', 'yml', 'xml', 'sql'
  ]);

  static isCodeFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? this.CODE_EXTENSIONS.has(extension) : false;
  }

  static getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js': return 'javascript';
      case 'jsx': return 'jsx';
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'py': return 'python';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'scss': case 'sass': return 'scss';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'vue': return 'vue';
      case 'svelte': return 'svelte';
      default: return 'text';
    }
  }

  static extractFunctions(content: string, fileType: string): FunctionSignature[] {
    const functions: FunctionSignature[] = [];
    
    if (fileType === 'javascript' || fileType === 'typescript' || fileType === 'jsx' || fileType === 'tsx') {
      return this.extractJavaScriptFunctions(content);
    } else if (fileType === 'python') {
      return this.extractPythonFunctions(content);
    }
    
    return functions;
  }

  private static extractJavaScriptFunctions(content: string): FunctionSignature[] {
    const functions: FunctionSignature[] = [];
    const lines = content.split('\n');
    
    // Simple regex patterns for function detection
    const patterns = [
      /function\s+(\w+)\s*\(([^)]*)\)/g,           // function declarations
      /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,     // arrow functions
      /(\w+)\s*:\s*function\s*\(([^)]*)\)/g,       // object methods
      /(\w+)\s*\(([^)]*)\)\s*{/g,                  // method definitions
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const params = match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/)[0]) : [];
        
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        
        functions.push({
          name,
          params,
          complexity: this.calculateSimpleComplexity(content, match.index),
          dependencies: this.extractDependencies(content, match.index),
          startLine: lineNumber,
          endLine: lineNumber + 10, // Rough estimate
        });
      }
    });

    return functions;
  }

  private static extractPythonFunctions(content: string): FunctionSignature[] {
    const functions: FunctionSignature[] = [];
    const lines = content.split('\n');
    
    const functionPattern = /def\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const name = match[1];
      const params = match[2] ? match[2].split(',').map(p => p.trim().split(/\s+/)[0]) : [];
      
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      functions.push({
        name,
        params,
        complexity: this.calculateSimpleComplexity(content, match.index),
        dependencies: this.extractDependencies(content, match.index),
        startLine: lineNumber,
        endLine: lineNumber + 10,
      });
    }

    return functions;
  }

  private static calculateSimpleComplexity(content: string, startIndex: number): number {
    // Find the function body (simplified)
    const afterFunction = content.substring(startIndex);
    const functionBody = this.extractFunctionBody(afterFunction);
    
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /&&|\|\|/g,
      /\?\s*:/g, // ternary operator
    ];

    decisionPatterns.forEach(pattern => {
      const matches = functionBody.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return Math.min(complexity, 10); // Cap at 10
  }

  private static extractFunctionBody(content: string): string {
    let braceCount = 0;
    let inFunction = false;
    let start = -1;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        if (!inFunction) {
          inFunction = true;
          start = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          return content.substring(start, i + 1);
        }
      }
    }
    
    return content.substring(0, 500); // Fallback: first 500 chars
  }

  private static extractDependencies(content: string, startIndex: number): string[] {
    const functionBody = this.extractFunctionBody(content.substring(startIndex));
    const dependencies = new Set<string>();
    
    // Extract function calls
    const callPattern = /(\w+)\s*\(/g;
    let match;
    
    while ((match = callPattern.exec(functionBody)) !== null) {
      const funcName = match[1];
      if (funcName !== 'if' && funcName !== 'for' && funcName !== 'while' && funcName !== 'switch') {
        dependencies.add(funcName);
      }
    }
    
    return Array.from(dependencies);
  }

  static extractImports(content: string, fileType: string): string[] {
    const imports: string[] = [];
    
    if (fileType === 'javascript' || fileType === 'typescript' || fileType === 'jsx' || fileType === 'tsx') {
      // ES6 imports
      const importPattern = /import.*from\s+['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
      
      // CommonJS requires
      const requirePattern = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      while ((match = requirePattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    } else if (fileType === 'python') {
      // Python imports
      const importPattern = /(?:from\s+(\S+)\s+)?import\s+([^\n]+)/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        if (match[1]) {
          imports.push(match[1]);
        }
        // Also extract individual imports
        const individualImports = match[2].split(',').map(i => i.trim());
        imports.push(...individualImports);
      }
    }
    
    return imports;
  }

  static extractExports(content: string, fileType: string): string[] {
    const exports: string[] = [];
    
    if (fileType === 'javascript' || fileType === 'typescript' || fileType === 'jsx' || fileType === 'tsx') {
      // Named exports
      const namedExportPattern = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
      let match;
      while ((match = namedExportPattern.exec(content)) !== null) {
        exports.push(match[1]);
      }
      
      // Export statements
      const exportPattern = /export\s*{\s*([^}]+)\s*}/g;
      while ((match = exportPattern.exec(content)) !== null) {
        const exportedNames = match[1].split(',').map(e => e.trim().split(/\s+as\s+/)[0]);
        exports.push(...exportedNames);
      }
      
      // Default export
      if (content.includes('export default')) {
        exports.push('default');
      }
    }
    
    return exports;
  }

  static analyzeCompatibility(
    sourceFiles: Record<string, string>,
    targetFiles: Record<string, string>
  ): number {
    let compatibilityScore = 50; // Base score
    
    // Check for naming conflicts
    const sourceNames = new Set<string>();
    const targetNames = new Set<string>();
    
    Object.entries(sourceFiles).forEach(([path, content]) => {
      const fileType = this.getFileType(path);
      const functions = this.extractFunctions(content, fileType);
      functions.forEach(func => sourceNames.add(func.name));
    });
    
    Object.entries(targetFiles).forEach(([path, content]) => {
      const fileType = this.getFileType(path);
      const functions = this.extractFunctions(content, fileType);
      functions.forEach(func => targetNames.add(func.name));
    });
    
    // Calculate conflict ratio
    const conflicts = Array.from(sourceNames).filter(name => targetNames.has(name));
    const conflictRatio = conflicts.length / Math.max(sourceNames.size, 1);
    
    compatibilityScore -= conflictRatio * 30; // Reduce score based on conflicts
    
    // Bonus for similar file structures
    const sourceExtensions = new Set(Object.keys(sourceFiles).map(p => p.split('.').pop()));
    const targetExtensions = new Set(Object.keys(targetFiles).map(p => p.split('.').pop()));
    const commonExtensions = Array.from(sourceExtensions).filter(ext => targetExtensions.has(ext));
    const extensionBonus = (commonExtensions.length / Math.max(sourceExtensions.size, 1)) * 20;
    
    compatibilityScore += extensionBonus;
    
    return Math.max(0, Math.min(100, compatibilityScore));
  }

  static generateIntegrationPlan(
    sourceFiles: Record<string, string>,
    targetFiles: Record<string, string>,
    analysis: CodeAnalysis[]
  ): IntegrationPlan {
    const compatibility = this.analyzeCompatibility(sourceFiles, targetFiles);
    const avgComplexity = analysis.reduce((sum, a) => sum + a.complexity, 0) / Math.max(analysis.length, 1);
    
    const shouldIntegrate = compatibility > 60 && avgComplexity < 50;
    const confidence = Math.min(compatibility, 100 - avgComplexity);
    
    const changes = Object.keys(sourceFiles)
      .filter(file => this.isCodeFile(file))
      .slice(0, 3) // Limit to first 3 files for safety
      .map(file => ({
        type: 'add' as const,
        file,
        content: sourceFiles[file],
        explanation: `Add ${file} with ${this.extractFunctions(sourceFiles[file], this.getFileType(file)).length} functions`
      }));

    const conflicts: string[] = [];
    if (compatibility < 70) {
      conflicts.push("Potential naming conflicts detected");
    }
    if (avgComplexity > 40) {
      conflicts.push("High complexity functions may affect performance");
    }

    return {
      shouldIntegrate,
      confidence,
      reasoning: shouldIntegrate 
        ? `Good compatibility (${compatibility.toFixed(0)}%) and manageable complexity`
        : `Low compatibility (${compatibility.toFixed(0)}%) or high complexity detected`,
      changes,
      conflicts,
      safetyScore: Math.min(compatibility / 100, (100 - avgComplexity) / 100) * 100
    };
  }
}
