import { type ZipEntry } from '../components/PlayerPanel';

export interface EntryPoint {
  file: string;
  type: 'html' | 'javascript' | 'python' | 'unknown';
  confidence: number;
  reason: string;
}

export interface CodeIssue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export class ZipAnalyzer {
  static detectEntryPoint(entries: ZipEntry[]): EntryPoint | null {
    const files = entries.filter(e => !e.isFolder);
    
    // Priority 1: index.html at root
    const rootIndexHtml = files.find(f => f.name === 'index.html' || f.name === '/index.html');
    if (rootIndexHtml) {
      return {
        file: rootIndexHtml.name,
        type: 'html',
        confidence: 1.0,
        reason: 'Found index.html at root'
      };
    }
    
    // Priority 2: index.html in any folder
    const anyIndexHtml = files.find(f => f.name.toLowerCase().endsWith('/index.html'));
    if (anyIndexHtml) {
      return {
        file: anyIndexHtml.name,
        type: 'html',
        confidence: 0.9,
        reason: 'Found index.html in subdirectory'
      };
    }
    
    // Priority 3: Any HTML file at root
    const rootHtml = files.find(f => !f.name.includes('/') && f.name.toLowerCase().endsWith('.html'));
    if (rootHtml) {
      return {
        file: rootHtml.name,
        type: 'html',
        confidence: 0.8,
        reason: 'Found HTML file at root'
      };
    }
    
    // Priority 4: main.js, app.js, index.js
    const jsEntryPoints = ['main.js', 'app.js', 'index.js', 'script.js'];
    for (const entryName of jsEntryPoints) {
      const jsFile = files.find(f => f.name.toLowerCase().endsWith(entryName));
      if (jsFile) {
        return {
          file: jsFile.name,
          type: 'javascript',
          confidence: 0.7,
          reason: `Found ${entryName}`
        };
      }
    }
    
    // Priority 5: main.py, app.py
    const pyEntryPoints = ['main.py', 'app.py', '__main__.py'];
    for (const entryName of pyEntryPoints) {
      const pyFile = files.find(f => f.name.toLowerCase().endsWith(entryName));
      if (pyFile) {
        return {
          file: pyFile.name,
          type: 'python',
          confidence: 0.7,
          reason: `Found ${entryName}`
        };
      }
    }
    
    // Priority 6: First HTML file found
    const firstHtml = files.find(f => f.name.toLowerCase().endsWith('.html'));
    if (firstHtml) {
      return {
        file: firstHtml.name,
        type: 'html',
        confidence: 0.5,
        reason: 'Using first HTML file found'
      };
    }
    
    return null;
  }
  
  static analyzeCode(entries: ZipEntry[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    for (const entry of entries) {
      if (entry.isFolder || !entry.content) continue;
      
      const fileName = entry.name.toLowerCase();
      
      // Analyze HTML files
      if (fileName.endsWith('.html')) {
        issues.push(...this.analyzeHTML(entry));
      }
      
      // Analyze JavaScript files
      if (fileName.endsWith('.js')) {
        issues.push(...this.analyzeJavaScript(entry));
      }
      
      // Analyze CSS files
      if (fileName.endsWith('.css')) {
        issues.push(...this.analyzeCSS(entry));
      }
    }
    
    return issues;
  }
  
  private static analyzeHTML(entry: ZipEntry): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const content = entry.content || '';
    
    // Check for missing DOCTYPE
    if (!content.includes('<!DOCTYPE') && !content.includes('<!doctype')) {
      issues.push({
        file: entry.name,
        severity: 'warning',
        message: 'Missing DOCTYPE declaration',
        suggestion: 'Add <!DOCTYPE html> at the top of the file'
      });
    }
    
    // Check for unclosed tags (basic check)
    const openTags = (content.match(/<(?!\/)[a-z]+/gi) || []).length;
    const closeTags = (content.match(/<\/[a-z]+>/gi) || []).length;
    if (openTags > closeTags + 5) { // Allow some self-closing tags
      issues.push({
        file: entry.name,
        severity: 'error',
        message: 'Possible unclosed HTML tags detected',
        suggestion: 'Check that all tags are properly closed'
      });
    }
    
    // Check for missing meta charset
    if (!content.includes('charset') && content.includes('<head')) {
      issues.push({
        file: entry.name,
        severity: 'info',
        message: 'Missing character encoding declaration',
        suggestion: 'Add <meta charset="UTF-8"> in the <head> section'
      });
    }
    
    return issues;
  }
  
  private static analyzeJavaScript(entry: ZipEntry): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const content = entry.content || '';
    
    // Check for console.log (common debug leftover)
    const consoleLogCount = (content.match(/console\.log/g) || []).length;
    if (consoleLogCount > 3) {
      issues.push({
        file: entry.name,
        severity: 'info',
        message: `Found ${consoleLogCount} console.log statements`,
        suggestion: 'Consider removing debug console.log statements'
      });
    }
    
    // Check for syntax errors (basic)
    const unclosedBraces = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
    if (Math.abs(unclosedBraces) > 0) {
      issues.push({
        file: entry.name,
        severity: 'error',
        message: 'Mismatched curly braces detected',
        suggestion: 'Check for unclosed or extra braces'
      });
    }
    
    // Check for var usage
    if (content.includes('var ')) {
      issues.push({
        file: entry.name,
        severity: 'warning',
        message: 'Using var instead of let/const',
        suggestion: 'Consider using let or const instead of var'
      });
    }
    
    return issues;
  }
  
  private static analyzeCSS(entry: ZipEntry): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const content = entry.content || '';
    
    // Check for unclosed braces
    const unclosedBraces = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
    if (Math.abs(unclosedBraces) > 0) {
      issues.push({
        file: entry.name,
        severity: 'error',
        message: 'Mismatched curly braces in CSS',
        suggestion: 'Check for unclosed or extra braces'
      });
    }
    
    return issues;
  }
  
  static generateExecutableHTML(entries: ZipEntry[], entryPoint: EntryPoint): string {
    if (entryPoint.type === 'html') {
      const htmlFile = entries.find(e => e.name === entryPoint.file);
      if (!htmlFile?.content) return '';
      
      // Inject all CSS and JS files into the HTML
      let html = htmlFile.content;
      
      // Find and inject CSS files
      const cssFiles = entries.filter(e => !e.isFolder && e.name.toLowerCase().endsWith('.css'));
      const cssInjects = cssFiles.map(css => `<style>\n${css.content}\n</style>`).join('\n');
      
      // Find and inject JS files
      const jsFiles = entries.filter(e => !e.isFolder && e.name.toLowerCase().endsWith('.js'));
      const jsInjects = jsFiles.map(js => `<script>\n${js.content}\n</script>`).join('\n');
      
      // Inject before closing tags
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${cssInjects}\n</head>`);
      } else {
        html = cssInjects + html;
      }
      
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${jsInjects}\n</body>`);
      } else {
        html = html + jsInjects;
      }
      
      return html;
    }
    
    if (entryPoint.type === 'javascript') {
      const jsFile = entries.find(e => e.name === entryPoint.file);
      if (!jsFile?.content) return '';
      
      // Create a simple HTML wrapper for JavaScript
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JavaScript Project</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
    }
    #output {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="output"></div>
  <script>
    ${jsFile.content}
  </script>
</body>
</html>
      `.trim();
    }
    
    return '';
  }
}
