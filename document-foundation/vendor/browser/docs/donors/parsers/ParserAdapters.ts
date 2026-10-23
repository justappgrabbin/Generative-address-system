import { ParserAdapter, IngestedFile, UniversalAST, UniversalNode, nodeMetadata } from './UniversalCompiler';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';
import Papa from 'papaparse';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { marked } from 'marked';

function root(file: IngestedFile, kind: string, sourceType: string): UniversalNode {
  return { id: `${sourceType}_root_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, sourceType, children: [], metadata: nodeMetadata(file) };
}

export class JavaScriptParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['js', 'ts', 'jsx', 'tsx'].includes(ext || '') || file.mime === 'application/javascript';
  }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const code = file.buffer.toString('utf8');
    const symbols: Record<string, UniversalNode> = {};
    const diagnostics: string[] = [];
    const rootNode = root(file, 'module', 'js');
    try {
      const ast = babelParser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'objectRestSpread'] });
      const addNode = (kind: string, name: string, start = 0, end = 0) => {
        const text = code.slice(start, end);
        const uNode: UniversalNode = { id: `${kind}_${name}_${start}`, kind, sourceType: 'js', text, children: [], metadata: nodeMetadata(file, text, { name, span: [start, end] }) };
        symbols[uNode.id] = uNode;
        rootNode.children.push(uNode);
      };
      traverse(ast, {
        ClassDeclaration(path) { addNode('class', path.node.id?.name || 'AnonymousClass', path.node.start || 0, path.node.end || 0); },
        FunctionDeclaration(path) { addNode('function', path.node.id?.name || 'AnonymousFunction', path.node.start || 0, path.node.end || 0); },
        VariableDeclarator(path) {
          if (path.node.init && ['ArrowFunctionExpression', 'FunctionExpression'].includes(path.node.init.type)) {
            addNode('function', (path.node.id as any).name || 'AnonymousExpression', path.node.start || 0, path.node.end || 0);
          }
        }
      });
    } catch (err: any) {
      diagnostics.push(`Babel parser error: ${err.message}`);
      rootNode.text = code;
    }
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics };
  }
}

export class CSVParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean { return file.name.endsWith('.csv') || file.mime === 'text/csv'; }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const rawText = file.buffer.toString('utf8');
    const parsed = Papa.parse(rawText, { header: true, skipEmptyLines: true });
    const symbols: Record<string, UniversalNode> = {};
    const rootNode = root(file, 'table', 'csv');
    rootNode.metadata.rowCount = parsed.data.length;
    parsed.data.forEach((row: any, idx: number) => {
      const uNode: UniversalNode = { id: `row_${idx}`, kind: 'table_row', sourceType: 'csv', value: row, children: [], metadata: nodeMetadata(file, JSON.stringify(row), { index: idx }) };
      symbols[uNode.id] = uNode;
      rootNode.children.push(uNode);
    });
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics: parsed.errors.map(e => e.message) };
  }
}

export class PDFParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean { return file.name.endsWith('.pdf') || file.mime === 'application/pdf'; }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const symbols: Record<string, UniversalNode> = {};
    const diagnostics: string[] = [];
    const rootNode = root(file, 'document', 'pdf');
    try {
      const data = await pdf(file.buffer);
      rootNode.metadata.pageCount = data.numpages;
      data.text.split(/\n{2,}/).forEach((text: string, idx: number) => {
        const clean = text.trim().replace(/\s+/g, ' ');
        if (clean.length < 4) return;
        const uNode: UniversalNode = { id: `pdf_paragraph_${idx}`, kind: 'paragraph', sourceType: 'pdf', text: clean, children: [], metadata: nodeMetadata(file, clean, { sequence: idx }) };
        symbols[uNode.id] = uNode;
        rootNode.children.push(uNode);
      });
    } catch (err: any) { diagnostics.push(`PDF parser error: ${err.message}`); rootNode.kind = 'corrupted_asset'; }
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics };
  }
}

export class ExcelParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean { const ext = file.name.split('.').pop()?.toLowerCase(); return ['xlsx', 'xls'].includes(ext || ''); }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const symbols: Record<string, UniversalNode> = {};
    const diagnostics: string[] = [];
    const rootNode = root(file, 'workbook', 'xlsx');
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      workbook.eachSheet(sheet => {
        const sheetNode: UniversalNode = { id: `sheet_${sheet.name.replace(/[^a-zA-Z0-9]/g, '_')}`, kind: 'table', sourceType: 'xlsx', children: [], metadata: nodeMetadata(file, sheet.name, { title: sheet.name, rowCount: sheet.rowCount }) };
        const headers: string[] = [];
        sheet.eachRow((row, rowIdx) => {
          if (rowIdx === 1) { row.eachCell(cell => headers.push(cell.text.trim())); return; }
          const value: Record<string, unknown> = {};
          row.eachCell((cell, colIdx) => { value[headers[colIdx - 1] || `column_${colIdx}`] = cell.value; });
          const uNode: UniversalNode = { id: `${sheetNode.id}_r_${rowIdx}`, kind: 'table_row', sourceType: 'xlsx', value, children: [], metadata: nodeMetadata(file, JSON.stringify(value), { rowNumber: rowIdx }) };
          symbols[uNode.id] = uNode;
          sheetNode.children.push(uNode);
        });
        symbols[sheetNode.id] = sheetNode;
        rootNode.children.push(sheetNode);
      });
    } catch (err: any) { diagnostics.push(`Excel parser error: ${err.message}`); }
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics };
  }
}

export class DocxParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean { return file.name.endsWith('.docx') || file.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const symbols: Record<string, UniversalNode> = {};
    const diagnostics: string[] = [];
    const rootNode = root(file, 'document', 'docx');
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      result.value.split('\n').forEach((text, idx) => {
        const clean = text.trim(); if (!clean) return;
        const uNode: UniversalNode = { id: `docx_p_${idx}`, kind: 'paragraph', sourceType: 'docx', text: clean, children: [], metadata: nodeMetadata(file, clean, { paragraphIndex: idx }) };
        symbols[uNode.id] = uNode; rootNode.children.push(uNode);
      });
    } catch (err: any) { diagnostics.push(`DOCX parser error: ${err.message}`); }
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics };
  }
}

export class MarkdownParserAdapter implements ParserAdapter {
  accepts(file: IngestedFile): boolean { const ext = file.name.split('.').pop()?.toLowerCase(); return ['md', 'txt', 'markdown'].includes(ext || '') || file.mime === 'text/markdown'; }
  async parse(file: IngestedFile): Promise<UniversalAST> {
    const text = file.buffer.toString('utf8');
    const tokens = marked.lexer(text);
    const symbols: Record<string, UniversalNode> = {};
    const rootNode = root(file, 'document', 'md');
    tokens.forEach((token: any, idx: number) => {
      const kind = token.type === 'heading' ? `heading_l${token.depth}` : token.type === 'code' ? 'code_block' : token.type === 'list' ? 'list_container' : token.type === 'table' ? 'table' : 'paragraph';
      const raw = token.raw || '';
      const uNode: UniversalNode = { id: `md_node_${idx}_${token.type}`, kind, sourceType: 'md', text: raw, value: token, children: [], metadata: nodeMetadata(file, raw, { type: token.type }) };
      symbols[uNode.id] = uNode; rootNode.children.push(uNode);
    });
    return { version: 'uast-0.1', root: rootNode, symbols, diagnostics: [] };
  }
}
