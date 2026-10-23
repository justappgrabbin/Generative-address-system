// ============================================================
// MORPH ANALYZER v2 — Ported from morph-analyzer.js
// Deep causal analysis: intent reconstruction, pattern inference,
// purpose detection, sophistication scoring.
// ============================================================
export interface AnalysisRecord {
  id: string;
  structure: { text: string; functions: string[]; classes: { name: string; extends: string | null }[]; dependencies: { edges: any[] }; imports: string[]; complexity: { score: number } };
  behavior: { intents: string[]; actions: string[] };
  metadata: { size: number; type: string; language: string };
  [key: string]: any;
}

export class MorphAnalyzer {
  causalModels = new Map<string, any>();
  constructor(bus: any, memory: any) { this.bus = bus; this.memory = memory; }
  private bus: any;
  private memory: any;

  async analyze(record: AnalysisRecord) {
    const causality = this._buildCausality(record);
    const intent = this._reconstructIntent(record, causality);
    const relationships = this._mapRelationships(record, causality);
    const personalization = this._applyUserContext(record, intent);
    const analysis = {
      id: `analysis_${record.id}`, recordId: record.id, causality, intent, relationships, personalization,
      confidence: this._calculateConfidence(causality, intent), timestamp: Date.now()
    };
    this.causalModels.set(analysis.id, analysis);
    this.bus.emit('analysis:complete', { analysis }, { source: 'analyzer', parentId: record.id });
    return analysis;
  }

  _buildCausality(record: AnalysisRecord) {
    const { structure } = record;
    const causality: any = { functions: {}, classes: {}, global: [] };
    structure.functions.forEach((fn: string) => {
      const callers = structure.dependencies.edges.filter((e: any) => e.to === fn).map((e: any) => e.from);
      const enables = structure.dependencies.edges.filter((e: any) => e.from === fn).map((e: any) => e.to);
      causality.functions[fn] = { calledBy: callers, enables, purpose: this._inferPurpose(fn, record), necessity: callers.length > 0 ? 'required' : 'orphan' };
    });
    structure.classes.forEach((cls: any) => {
      causality.classes[cls.name] = { pattern: this._inferPattern(cls, record), extends: cls.extends, responsibility: this._inferResponsibility(cls, record) };
    });
    causality.global = this._findEntryPoints(record);
    return causality;
  }

  _inferPurpose(fnName: string, _record: AnalysisRecord): string {
    const lower = fnName.toLowerCase();
    const purposes: Record<string, string> = {
      init: 'bootstrap', start: 'bootstrap', boot: 'bootstrap',
      render: 'display', draw: 'display', show: 'display', display: 'display',
      handle: 'event', on: 'event', listen: 'event', emit: 'event',
      fetch: 'network', get: 'network', post: 'network', sync: 'network',
      save: 'persistence', store: 'persistence', write: 'persistence',
      read: 'retrieval', load: 'retrieval', load_data: 'retrieval',
      validate: 'integrity', check: 'integrity', verify: 'integrity',
      transform: 'mutation', convert: 'mutation', parse: 'mutation'
    };
    return purposes[lower] || 'utility';
  }

  _inferPattern(_cls: any, record: AnalysisRecord): string {
    const text = record.structure.text.toLowerCase();
    if (text.includes('extends eventtarget') || text.includes('addeventlistener')) return 'observer';
    if (text.includes('constructor') && text.includes('this.')) return 'state-container';
    if (text.includes('static') && text.includes('getinstance')) return 'singleton';
    if (text.includes('render') || text.includes('update')) return 'component';
    if (text.includes('async') || text.includes('await')) return 'async-service';
    return 'entity';
  }

  _inferResponsibility(_cls: any, record: AnalysisRecord): string {
    const text = record.structure.text.toLowerCase();
    if (text.includes('bus') || text.includes('event') || text.includes('message')) return 'messaging';
    if (text.includes('memory') || text.includes('store') || text.includes('cache')) return 'persistence';
    if (text.includes('render') || text.includes('view') || text.includes('display')) return 'presentation';
    if (text.includes('fetch') || text.includes('api') || text.includes('http')) return 'network';
    if (text.includes('learn') || text.includes('pattern') || text.includes('recognize')) return 'cognition';
    return 'general';
  }

  _findEntryPoints(record: AnalysisRecord): string[] {
    const text = record.structure.text;
    const entryPoints: string[] = [];
    if (text.includes("document.addEventListener('DOMContentLoaded'") || text.includes('window.onload')) entryPoints.push('dom-ready');
    if (text.includes('if __name__ == "__main__"') || text.includes('main()')) entryPoints.push('main-function');
    if (text.match(/export\s+default/)) entryPoints.push('module-export');
    if (text.includes('new ') && text.includes('constructor')) entryPoints.push('instantiation');
    return entryPoints.length ? entryPoints : ['implicit'];
  }

  _reconstructIntent(record: AnalysisRecord, causality: any) {
    const intents = record.behavior.intents;
    const primary = intents[0] || 'unknown';
    return { primary, secondary: intents.slice(1), depth: this._calculateIntentDepth(record), sophistication: this._calculateSophistication(record, causality) };
  }

  _calculateIntentDepth(record: AnalysisRecord): number {
    const { structure } = record; let depth = 1;
    if (structure.classes.length > 0) depth++;
    if (structure.imports.length > 0) depth++;
    if (structure.complexity.score > 20) depth++;
    if (structure.functions.length > 10) depth++;
    return depth;
  }

  _calculateSophistication(record: AnalysisRecord, causality: any): number {
    const { structure } = record; let score = 0;
    if (structure.classes.length > 0) score += 2;
    if (structure.imports.length > 2) score += 1;
    if (structure.complexity.score > 30) score += 2;
    if (Object.keys(causality.functions).length > 5) score += 1;
    if (record.behavior.intents.length > 2) score += 2;
    return score;
  }

  _mapRelationships(record: AnalysisRecord, causality: any) {
    const { structure } = record;
    return { internal: structure.dependencies, external: structure.imports.map((imp: string) => ({ module: imp, type: 'import' })), behavioral: record.behavior.actions.map((a: string) => ({ action: a, triggeredBy: [] })), causal: causality };
  }

  _applyUserContext(record: AnalysisRecord, intent: any) {
    const userPatterns = this.memory?.getPatterns?.() || [];
    const preferences = this.memory?.getPreferences?.() || {};
    return { userLikes: preferences.likes || [], userAvoids: preferences.avoids || [], similarFiles: userPatterns.filter((p: any) => p.intents?.some((i: string) => intent.secondary.includes(i))), suggestedImprovements: this._suggestImprovements(record, preferences) };
  }

  _suggestImprovements(record: AnalysisRecord, preferences: any): string[] {
    const suggestions: string[] = [];
    const { structure, behavior } = record;
    if (structure.complexity.score > 50) suggestions.push('modularize: split into smaller modules');
    if (!behavior.intents.includes('memory') && structure.functions.length > 3) suggestions.push('add-persistence: learn from usage patterns');
    if (!behavior.intents.includes('network') && structure.imports.length > 0) suggestions.push('add-sync: connect to remote storage');
    if (preferences.likes?.includes('minimal')) suggestions.push('minimize: remove unused functions');
    if (preferences.likes?.includes('chat')) suggestions.push('add-chat: conversational interface');
    return suggestions;
  }

  _calculateConfidence(causality: any, intent: any): number {
    const fnCount = Object.keys(causality.functions).length;
    const knownPurposes = Object.values(causality.functions).filter((f: any) => f.purpose !== 'utility').length;
    const ratio = fnCount > 0 ? knownPurposes / fnCount : 0;
    return Math.min(0.95, 0.3 + ratio * 0.6 + intent.depth * 0.05);
  }
}
