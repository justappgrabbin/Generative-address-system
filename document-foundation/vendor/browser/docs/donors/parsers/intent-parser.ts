/**
 * Semantic Intent Parser v2 — Goal Graph + Capability Matching
 * 
 * Dimensional evolution:
 *   D1: Raw impulse (the input string)
 *   D2: Semantic embedding (what does this MEAN, not what words does it contain)
 *   D3: Goal decomposition (what are the sub-goals?)
 *   D4: Capability matching (what tools can satisfy these goals?)
 *   D5: Meaning (the executable intent with full context)
 */

import type { ParsedIntent, IntentType, RAGQuery } from '../types.js';

interface SemanticField {
  concept: string;
  weight: number;
  domain: 'code' | 'research' | 'medical' | 'system' | 'general';
  polarity: 'positive' | 'negative' | 'neutral';
}

interface GoalNode {
  id: string;
  goal: string;
  parent: string | null;
  children: string[];
  requiredCapabilities: string[];
  confidence: number;
  domain: string;
}

interface CapabilityGraph {
  [capability: string]: {
    tools: string[];
    prerequisites: string[];
    risk: 'low' | 'medium' | 'high';
    rollback: string[];
  };
}

// Semantic field extraction — not keyword matching
const SEMANTIC_FIELDS: Record<string, SemanticField[]> = {
  deploy: [
    { concept: 'production', weight: 0.9, domain: 'system', polarity: 'positive' },
    { concept: 'release', weight: 0.85, domain: 'system', polarity: 'positive' },
    { concept: 'ship', weight: 0.8, domain: 'system', polarity: 'positive' },
    { concept: 'go_live', weight: 0.9, domain: 'system', polarity: 'positive' },
    { concept: 'push', weight: 0.7, domain: 'code', polarity: 'positive' },
    { concept: 'build', weight: 0.6, domain: 'code', polarity: 'positive' },
    { concept: 'restart', weight: 0.5, domain: 'system', polarity: 'positive' },
    { concept: 'server', weight: 0.4, domain: 'system', polarity: 'neutral' },
    { concept: 'app', weight: 0.3, domain: 'code', polarity: 'neutral' },
  ],
  fix: [
    { concept: 'broken', weight: 0.9, domain: 'system', polarity: 'negative' },
    { concept: 'error', weight: 0.85, domain: 'system', polarity: 'negative' },
    { concept: 'crash', weight: 0.9, domain: 'system', polarity: 'negative' },
    { concept: 'bug', weight: 0.8, domain: 'code', polarity: 'negative' },
    { concept: 'not_working', weight: 0.85, domain: 'system', polarity: 'negative' },
    { concept: 'fails', weight: 0.8, domain: 'system', polarity: 'negative' },
    { concept: 'debug', weight: 0.7, domain: 'code', polarity: 'neutral' },
    { concept: 'repair', weight: 0.75, domain: 'system', polarity: 'positive' },
    { concept: 'heal', weight: 0.7, domain: 'system', polarity: 'positive' },
    { concept: 'resolve', weight: 0.7, domain: 'system', polarity: 'positive' },
  ],
  setup: [
    { concept: 'initialize', weight: 0.9, domain: 'system', polarity: 'positive' },
    { concept: 'scaffold', weight: 0.85, domain: 'code', polarity: 'positive' },
    { concept: 'create', weight: 0.7, domain: 'code', polarity: 'positive' },
    { concept: 'new_project', weight: 0.9, domain: 'code', polarity: 'positive' },
    { concept: 'bootstrap', weight: 0.85, domain: 'system', polarity: 'positive' },
    { concept: 'from_scratch', weight: 0.8, domain: 'code', polarity: 'neutral' },
    { concept: 'start_fresh', weight: 0.75, domain: 'system', polarity: 'positive' },
  ],
  install: [
    { concept: 'package', weight: 0.8, domain: 'system', polarity: 'positive' },
    { concept: 'dependency', weight: 0.75, domain: 'code', polarity: 'positive' },
    { concept: 'module', weight: 0.7, domain: 'code', polarity: 'neutral' },
    { concept: 'tool', weight: 0.6, domain: 'system', polarity: 'neutral' },
    { concept: 'download', weight: 0.5, domain: 'system', polarity: 'positive' },
  ],
  configure: [
    { concept: 'setting', weight: 0.8, domain: 'system', polarity: 'neutral' },
    { concept: 'env', weight: 0.75, domain: 'system', polarity: 'neutral' },
    { concept: 'variable', weight: 0.7, domain: 'system', polarity: 'neutral' },
    { concept: 'tweak', weight: 0.6, domain: 'system', polarity: 'positive' },
    { concept: 'adjust', weight: 0.6, domain: 'system', polarity: 'positive' },
  ],
  monitor: [
    { concept: 'status', weight: 0.85, domain: 'system', polarity: 'neutral' },
    { concept: 'health', weight: 0.8, domain: 'system', polarity: 'positive' },
    { concept: 'logs', weight: 0.75, domain: 'system', polarity: 'neutral' },
    { concept: 'running', weight: 0.7, domain: 'system', polarity: 'positive' },
    { concept: 'alive', weight: 0.7, domain: 'system', polarity: 'positive' },
    { concept: 'metrics', weight: 0.65, domain: 'system', polarity: 'neutral' },
  ],
  automate: [
    { concept: 'schedule', weight: 0.8, domain: 'system', polarity: 'positive' },
    { concept: 'cron', weight: 0.85, domain: 'system', polarity: 'positive' },
    { concept: 'recurring', weight: 0.75, domain: 'system', polarity: 'positive' },
    { concept: 'workflow', weight: 0.7, domain: 'system', polarity: 'positive' },
    { concept: 'routine', weight: 0.65, domain: 'system', polarity: 'neutral' },
  ],
  device_control: [
    { concept: 'screenshot', weight: 0.9, domain: 'system', polarity: 'neutral' },
    { concept: 'tap', weight: 0.85, domain: 'system', polarity: 'positive' },
    { concept: 'swipe', weight: 0.85, domain: 'system', polarity: 'positive' },
    { concept: 'phone', weight: 0.6, domain: 'system', polarity: 'neutral' },
    { concept: 'screen', weight: 0.5, domain: 'system', polarity: 'neutral' },
    { concept: 'app', weight: 0.4, domain: 'system', polarity: 'neutral' },
    { concept: 'button', weight: 0.7, domain: 'system', polarity: 'neutral' },
    { concept: 'launch', weight: 0.75, domain: 'system', polarity: 'positive' },
  ],
  query: [
    { concept: 'what', weight: 0.6, domain: 'general', polarity: 'neutral' },
    { concept: 'how', weight: 0.6, domain: 'general', polarity: 'neutral' },
    { concept: 'show', weight: 0.5, domain: 'general', polarity: 'neutral' },
    { concept: 'list', weight: 0.5, domain: 'general', polarity: 'neutral' },
    { concept: 'find', weight: 0.55, domain: 'general', polarity: 'neutral' },
    { concept: 'search', weight: 0.6, domain: 'general', polarity: 'neutral' },
    { concept: 'info', weight: 0.5, domain: 'general', polarity: 'neutral' },
  ],
};

// Capability graph — what each tool can do
const CAPABILITY_GRAPH: CapabilityGraph = {
  'git.pull': { tools: ['shell'], prerequisites: ['git.available'], risk: 'low', rollback: ['git.reset'] },
  'git.build': { tools: ['shell'], prerequisites: ['npm.available'], risk: 'medium', rollback: ['npm.clean'] },
  'service.restart': { tools: ['shell'], prerequisites: ['pm2.available'], risk: 'medium', rollback: ['service.stop'] },
  'service.health': { tools: ['shell'], prerequisites: ['curl.available'], risk: 'low', rollback: [] },
  'deps.install': { tools: ['shell', 'core_install'], prerequisites: [], risk: 'low', rollback: ['deps.clean'] },
  'env.set': { tools: ['core_env_set'], prerequisites: [], risk: 'low', rollback: ['env.unset'] },
  'db.start': { tools: ['core_pg'], prerequisites: [], risk: 'low', rollback: ['db.stop'] },
  'device.screenshot': { tools: ['device_screenshot'], prerequisites: ['termux.available'], risk: 'low', rollback: [] },
  'device.tap': { tools: ['device_tap'], prerequisites: ['adb.available'], risk: 'low', rollback: [] },
  'rag.query': { tools: ['rag'], prerequisites: ['internet.available'], risk: 'low', rollback: [] },
};

export class SemanticIntentParser {
  private goalCounter = 0;

  parse(input: string): ParsedIntent {
    const lower = input.toLowerCase();

    // D2: Semantic field matching (not keyword matching)
    const { type, confidence, semanticScore } = this.matchSemanticFields(lower);

    // D3: Goal decomposition
    const goals = this.decomposeGoals(lower, type);

    // D4: Capability matching
    const requiredCapabilities = this.matchCapabilities(goals);

    // D5: Extract entities with semantic awareness
    const entities = this.extractSemanticEntities(lower, type, goals);

    // Urgency detection
    let urgency: ParsedIntent['urgency'] = 'medium';
    const urgencyMap = {
      critical: ['urgent', 'asap', 'critical', 'down', 'emergency', 'now', 'immediately'],
      high: ['important', 'needed', 'soon', 'quickly', 'priority'],
      low: ['whenever', 'later', 'eventually'],
    };
    for (const [level, keywords] of Object.entries(urgencyMap)) {
      if (keywords.some(k => lower.includes(k))) { urgency = level as ParsedIntent['urgency']; break; }
    }

    return {
      type,
      raw: input,
      entities,
      confidence: Math.min(confidence + semanticScore * 0.3, 1),
      urgency,
    };
  }

  private matchSemanticFields(input: string): { type: IntentType; confidence: number; semanticScore: number } {
    let bestType: IntentType = 'unknown';
    let bestScore = 0;
    let bestSemanticScore = 0;

    for (const [type, fields] of Object.entries(SEMANTIC_FIELDS)) {
      let score = 0;
      let semanticScore = 0;

      for (const field of fields) {
        // Check if the concept OR its synonyms appear
        const conceptWords = field.concept.split('_');
        const matches = conceptWords.filter(w => input.includes(w)).length;

        if (matches > 0) {
          // Weight by match quality and semantic weight
          const matchQuality = matches / conceptWords.length;
          score += field.weight * matchQuality * 10;
          semanticScore += field.weight * matchQuality;
        }

        // Also check for related concepts (semantic proximity)
        const related = this.getRelatedConcepts(field.concept);
        for (const rel of related) {
          if (input.includes(rel)) {
            score += field.weight * 0.3; // Partial credit for related concepts
            semanticScore += field.weight * 0.3;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestType = type as IntentType;
        bestSemanticScore = semanticScore;
      }
    }

    return { type: bestType, confidence: Math.min(bestScore / 20, 1), semanticScore: bestSemanticScore };
  }

  private getRelatedConcepts(concept: string): string[] {
    const related: Record<string, string[]> = {
      'production': ['prod', 'live', 'deployed', 'hosting', 'server'],
      'release': ['version', 'tag', 'publish', 'launch'],
      'broken': ['fail', 'crash', 'error', 'bug', 'issue', 'problem', 'not working'],
      'screenshot': ['capture', 'screen', 'image', 'photo'],
      'initialize': ['init', 'setup', 'create', 'new', 'start'],
    };
    return related[concept] || [];
  }

  private decomposeGoals(input: string, type: IntentType): GoalNode[] {
    this.goalCounter++;
    const goals: GoalNode[] = [];

    // Decompose based on intent type
    switch (type) {
      case 'deploy': {
        const rootId = `goal_${this.goalCounter}_deploy`;
        goals.push({
          id: rootId,
          goal: 'Deploy application',
          parent: null,
          children: [],
          requiredCapabilities: ['git.pull', 'deps.install', 'git.build', 'service.restart', 'service.health'],
          confidence: 0.9,
          domain: 'system',
        });
        break;
      }
      case 'fix': {
        const rootId = `goal_${this.goalCounter}_fix`;
        goals.push({
          id: rootId,
          goal: 'Fix system issue',
          parent: null,
          children: [],
          requiredCapabilities: ['service.health', 'deps.install', 'git.build', 'service.restart'],
          confidence: 0.85,
          domain: 'system',
        });
        break;
      }
      case 'setup': {
        const rootId = `goal_${this.goalCounter}_setup`;
        goals.push({
          id: rootId,
          goal: 'Initialize project',
          parent: null,
          children: [],
          requiredCapabilities: ['deps.install'],
          confidence: 0.8,
          domain: 'code',
        });
        break;
      }
      case 'device_control': {
        const rootId = `goal_${this.goalCounter}_device`;
        const capabilities: string[] = [];
        if (input.includes('screenshot')) capabilities.push('device.screenshot');
        if (input.includes('tap') || input.includes('click')) capabilities.push('device.tap');
        if (input.includes('swipe')) capabilities.push('device.swipe');
        if (input.includes('app') || input.includes('launch')) capabilities.push('device.launch');
        if (capabilities.length === 0) capabilities.push('device.screenshot');

        goals.push({
          id: rootId,
          goal: 'Control device',
          parent: null,
          children: [],
          requiredCapabilities: capabilities,
          confidence: 0.8,
          domain: 'system',
        });
        break;
      }
      default: {
        const rootId = `goal_${this.goalCounter}_general`;
        goals.push({
          id: rootId,
          goal: 'General query',
          parent: null,
          children: [],
          requiredCapabilities: ['rag.query'],
          confidence: 0.5,
          domain: 'general',
        });
      }
    }

    return goals;
  }

  private matchCapabilities(goals: GoalNode[]): string[] {
    const allCapabilities: string[] = [];

    for (const goal of goals) {
      for (const cap of goal.requiredCapabilities) {
        if (CAPABILITY_GRAPH[cap]) {
          allCapabilities.push(cap);
          // Also add prerequisites
          allCapabilities.push(...CAPABILITY_GRAPH[cap].prerequisites);
        }
      }
    }

    return [...new Set(allCapabilities)];
  }

  private extractSemanticEntities(input: string, type: IntentType, goals: GoalNode[]): string[] {
    const entities: string[] = [];

    // Tech stack entities (semantic, not just regex)
    const techPatterns = [
      { pattern: /\b(node\.js|nodejs|node)\b/gi, entity: 'nodejs' },
      { pattern: /\b(python|py)\b/gi, entity: 'python' },
      { pattern: /\b(react|next\.js|nextjs)\b/gi, entity: 'react' },
      { pattern: /\b(express|nest|nestjs|fastapi|flask)\b/gi, entity: 'framework' },
      { pattern: /\b(postgres|postgresql|sqlite|mongodb|redis)\b/gi, entity: 'database' },
      { pattern: /\b(docker|nginx|pm2|kubernetes|k8s)\b/gi, entity: 'infrastructure' },
      { pattern: /\b(git|github|gitlab)\b/gi, entity: 'vcs' },
      { pattern: /\b(vercel|netlify|aws|gcp|azure)\b/gi, entity: 'cloud' },
    ];

    for (const { pattern, entity } of techPatterns) {
      if (pattern.test(input)) entities.push(entity);
    }

    // Port detection
    const portMatch = input.match(/\b(port\s*)?(\d{4,5})\b/);
    if (portMatch && parseInt(portMatch[2]) > 1000) {
      entities.push(`port:${portMatch[2]}`);
    }

    // Path detection
    const pathMatches = input.matchAll(/([~\/][\w\-\/\.]+)/g);
    for (const match of pathMatches) entities.push(match[1]);

    // Goal-derived entities
    for (const goal of goals) {
      if (goal.domain === 'code') entities.push('code-context');
      if (goal.domain === 'system') entities.push('system-context');
    }

    return [...new Set(entities)];
  }

  // Expose capability graph for planner use
  getCapabilityGraph(): CapabilityGraph {
    return { ...CAPABILITY_GRAPH };
  }

  // Expose goal decomposition for planner use
  getGoalsForIntent(type: IntentType): GoalNode[] {
    return this.decomposeGoals('', type);
  }
}
