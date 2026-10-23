/**
 * Layer 2: Semantic Analyzer
 * Detects entities, concepts, purpose, dependencies from parsed file structure.
 * Feeds parsed AST into MRNN for cognitive analysis.
 */

class SemanticAnalyzer {
    constructor(mrnnMesh, cognitiveEngine) {
        this.mrnn = mrnnMesh;
        this.cognitive = cognitiveEngine;

        // Entity type patterns
        this.entityPatterns = {
            person: [/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, /\b(Mr|Mrs|Ms|Dr|Prof)\.[\s]+[A-Z][a-z]+\b/g],
            organization: [/\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*(?:Inc|LLC|Ltd|Corp|Company|Organization|Foundation|Institute)\b/g],
            location: [/\b[A-Z][a-z]+(?:,\s*[A-Z]{2})?\b/g],
            email: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
            url: [/https?:\/\/[^\s<>"{}|\\^`[\]]+/g],
            date: [/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, /\b\d{4}-\d{2}-\d{2}\b/g],
            phone: [/\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g],
            ip: [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g],
            version: [/\b\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?\b/g],
            hash: [/\b[a-f0-9]{32}\b/g, /\b[a-f0-9]{40}\b/g, /\b[a-f0-9]{64}\b/g],
            uuid: [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi]
        };

        // Concept taxonomies
        this.conceptTaxonomy = {
            'ui': ['button', 'input', 'form', 'modal', 'dialog', 'dropdown', 'menu', 'navbar', 'sidebar', 'card', 'grid', 'list', 'table', 'chart', 'graph', 'map', 'slider', 'toggle', 'switch', 'tab'],
            'data': ['database', 'query', 'schema', 'model', 'entity', 'record', 'field', 'column', 'row', 'index', 'key', 'relation', 'join', 'filter', 'sort', 'aggregate', 'transform', 'migrate'],
            'network': ['api', 'endpoint', 'route', 'request', 'response', 'header', 'cookie', 'session', 'auth', 'token', 'jwt', 'oauth', 'cors', 'proxy', 'gateway', 'load', 'balancer'],
            'security': ['encrypt', 'hash', 'salt', 'cipher', 'ssl', 'tls', 'certificate', 'firewall', 'sandbox', 'permission', 'role', 'policy', 'audit', 'log', 'trace'],
            'system': ['process', 'thread', 'fork', 'spawn', 'daemon', 'service', 'container', 'docker', 'kubernetes', 'vm', 'server', 'client', 'host', 'port', 'socket'],
            'media': ['image', 'video', 'audio', 'stream', 'codec', 'format', 'compress', 'encode', 'decode', 'render', 'capture', 'record', 'play', 'pause', 'seek'],
            'math': ['vector', 'matrix', 'tensor', 'scalar', 'gradient', 'derivative', 'integral', 'probability', 'statistics', 'regression', 'cluster', 'classify', 'predict'],
            'language': ['token', 'parse', 'lex', 'syntax', 'grammar', 'ast', 'transform', 'compile', 'transpile', 'minify', 'bundle', 'tree', 'shake']
        };

        // Purpose inference rules
        this.purposeRules = [
            { pattern: /test|spec|\.test\.|\.spec\./i, purpose: 'testing', confidence: 0.9 },
            { pattern: /config|settings|\.env|environment/i, purpose: 'configuration', confidence: 0.9 },
            { pattern: /readme|changelog|license|contributing/i, purpose: 'documentation', confidence: 0.95 },
            { pattern: /dockerfile|docker-compose|\.docker/i, purpose: 'containerization', confidence: 0.95 },
            { pattern: /ci|\.github|\.gitlab|jenkins|travis/i, purpose: 'continuous-integration', confidence: 0.9 },
            { pattern: /deploy|build|webpack|rollup|vite|esbuild/i, purpose: 'build-tooling', confidence: 0.85 },
            { pattern: /server|app|index|main|entry/i, purpose: 'application-entry', confidence: 0.8 },
            { pattern: /utils|helpers|tools|lib/i, purpose: 'utility-library', confidence: 0.8 },
            { pattern: /component|widget|element|module/i, purpose: 'ui-component', confidence: 0.85 },
            { pattern: /hook|context|provider|store/i, purpose: 'state-management', confidence: 0.85 },
            { pattern: /style|theme|css|scss|less|styled/i, purpose: 'styling', confidence: 0.9 },
            { pattern: /route|router|navigate|navigation/i, purpose: 'routing', confidence: 0.9 },
            { pattern: /api|fetch|axios|request|client/i, purpose: 'api-client', confidence: 0.85 },
            { pattern: /model|schema|entity|dto|type/i, purpose: 'data-model', confidence: 0.85 },
            { pattern: /middleware|guard|interceptor|filter/i, purpose: 'middleware', confidence: 0.9 },
            { pattern: /error|exception|handler|catch/i, purpose: 'error-handling', confidence: 0.85 }
        ];
    }

    async analyze(parsedFile) {
        const text = this.extractTextFromParsed(parsedFile);

        // Run cognitive analysis on extracted text
        const cognitiveResult = this.cognitive.analyze(text);

        // Extract entities
        const entities = this.extractEntities(text, parsedFile);

        // Extract concepts
        const concepts = this.extractConcepts(text, parsedFile);

        // Infer purpose
        const purpose = this.inferPurpose(parsedFile, text);

        // Extract dependencies
        const dependencies = this.extractDependencies(parsedFile);

        // Extract relationships
        const relationships = this.extractRelationships(parsedFile, entities, concepts);

        // Generate semantic fingerprint
        const fingerprint = this.generateFingerprint(parsedFile, cognitiveResult, entities, concepts, purpose);

        return {
            entities,
            concepts,
            purpose,
            dependencies,
            relationships,
            fingerprint,
            cognitive: cognitiveResult,
            confidence: this.calculateConfidence(parsedFile, entities, concepts, purpose)
        };
    }

    extractTextFromParsed(parsedFile) {
        const parts = [];

        // Add file name
        parts.push(parsedFile.fileName || '');

        // Add structure text
        if (parsedFile.structure) {
            const structure = parsedFile.structure;

            // Functions
            if (structure.functions) {
                for (const fn of structure.functions) {
                    parts.push(fn.name || '');
                }
            }

            // Classes
            if (structure.classes) {
                for (const cls of structure.classes) {
                    parts.push(cls.name || '');
                }
            }

            // Variables
            if (structure.variables) {
                for (const v of structure.variables) {
                    parts.push(v.name || '');
                }
            }

            // Imports
            if (structure.imports) {
                for (const imp of structure.imports) {
                    parts.push(imp.source || imp.path || '');
                }
            }

            // Comments
            if (structure.comments) {
                for (const comment of structure.comments) {
                    parts.push(comment.text || comment.content || '');
                }
            }

            // Headers (markdown)
            if (structure.headers) {
                for (const h of structure.headers) {
                    parts.push(h.text || '');
                }
            }

            // Top-level keys (JSON)
            if (structure.topLevelKeys) {
                parts.push(...structure.topLevelKeys);
            }
        }

        // Add raw preview
        if (parsedFile.rawPreview) {
            parts.push(parsedFile.rawPreview.slice(0, 1000));
        }

        return parts.join(' ');
    }

    extractEntities(text, parsedFile) {
        const entities = [];

        for (const [type, patterns] of Object.entries(this.entityPatterns)) {
            for (const pattern of patterns) {
                const matches = text.matchAll(pattern);
                for (const match of matches) {
                    entities.push({
                        type,
                        value: match[0],
                        position: match.index,
                        confidence: this.calculateEntityConfidence(type, match[0], parsedFile)
                    });
                }
            }
        }

        // Extract code-specific entities
        if (parsedFile.structure) {
            const structure = parsedFile.structure;

            // Functions as entities
            if (structure.functions) {
                for (const fn of structure.functions) {
                    entities.push({
                        type: 'function',
                        value: fn.name,
                        position: null,
                        confidence: 1.0,
                        metadata: { line: fn.line, async: fn.async, type: fn.type }
                    });
                }
            }

            // Classes as entities
            if (structure.classes) {
                for (const cls of structure.classes) {
                    entities.push({
                        type: 'class',
                        value: cls.name,
                        position: null,
                        confidence: 1.0,
                        metadata: { line: cls.line, extends: cls.extends || cls.superclass || cls.base }
                    });
                }
            }

            // Variables as entities
            if (structure.variables) {
                for (const v of structure.variables) {
                    entities.push({
                        type: 'variable',
                        value: v.name,
                        position: null,
                        confidence: 0.9,
                        metadata: { line: v.line, declaration: v.declaration }
                    });
                }
            }

            // Imports as entities
            if (structure.imports) {
                for (const imp of structure.imports) {
                    entities.push({
                        type: 'import',
                        value: imp.source || imp.path || imp.module,
                        position: null,
                        confidence: 1.0,
                        metadata: { line: imp.line, type: imp.type }
                    });
                }
            }
        }

        // Deduplicate
        const seen = new Set();
        return entities.filter(e => {
            const key = `${e.type}:${e.value}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    calculateEntityConfidence(type, value, parsedFile) {
        let confidence = 0.7;

        // Higher confidence for well-formed values
        if (type === 'email' && value.includes('@') && value.includes('.')) confidence = 0.95;
        if (type === 'url' && value.startsWith('http')) confidence = 0.95;
        if (type === 'uuid' && value.length === 36) confidence = 0.99;
        if (type === 'hash' && value.length >= 32) confidence = 0.9;

        // Lower confidence for short/generic values
        if (value.length < 3) confidence *= 0.5;
        if (/^[A-Z]$/.test(value)) confidence *= 0.3;

        return confidence;
    }

    extractConcepts(text, parsedFile) {
        const concepts = [];
        const lowerText = text.toLowerCase();

        // Match against taxonomy
        for (const [category, terms] of Object.entries(this.conceptTaxonomy)) {
            for (const term of terms) {
                const regex = new RegExp(`\\b${term}\\b`, 'gi');
                const matches = lowerText.matchAll(regex);
                for (const match of matches) {
                    concepts.push({
                        category,
                        term: match[0],
                        position: match.index,
                        confidence: 0.8
                    });
                }
            }
        }

        // Extract from parsed structure
        if (parsedFile.structure) {
            const structure = parsedFile.structure;

            // Detect UI concepts from HTML
            if (parsedFile.language === 'html') {
                if (structure.forms && structure.forms.length > 0) {
                    concepts.push({ category: 'ui', term: 'form', confidence: 1.0 });
                }
                if (structure.tables && structure.tables.length > 0) {
                    concepts.push({ category: 'ui', term: 'table', confidence: 1.0 });
                }
                if (structure.semanticElements) {
                    if (structure.semanticElements.nav > 0) concepts.push({ category: 'ui', term: 'navigation', confidence: 1.0 });
                    if (structure.semanticElements.header > 0) concepts.push({ category: 'ui', term: 'header', confidence: 1.0 });
                    if (structure.semanticElements.footer > 0) concepts.push({ category: 'ui', term: 'footer', confidence: 1.0 });
                }
            }

            // Detect data concepts from JSON
            if (parsedFile.language === 'json') {
                if (structure.type === 'package.json' || structure.type === 'package-manifest') {
                    concepts.push({ category: 'system', term: 'package-management', confidence: 1.0 });
                }
                if (structure.depth && structure.depth > 3) {
                    concepts.push({ category: 'data', term: 'nested-structure', confidence: 0.9 });
                }
            }

            // Detect network concepts from JS/TS
            if (['javascript', 'typescript'].includes(parsedFile.language)) {
                if (structure.apiCalls && structure.apiCalls.length > 0) {
                    concepts.push({ category: 'network', term: 'api-client', confidence: 1.0 });
                }
                if (structure.eventListeners && structure.eventListeners.length > 0) {
                    concepts.push({ category: 'ui', term: 'event-driven', confidence: 0.9 });
                }
            }

            // Detect system concepts
            if (structure.asyncFunctions && structure.asyncFunctions.length > 0) {
                concepts.push({ category: 'system', term: 'async-processing', confidence: 0.9 });
            }
        }

        // Deduplicate and score
        const conceptMap = new Map();
        for (const concept of concepts) {
            const key = `${concept.category}:${concept.term}`;
            if (!conceptMap.has(key) || conceptMap.get(key).confidence < concept.confidence) {
                conceptMap.set(key, concept);
            }
        }

        return Array.from(conceptMap.values());
    }

    inferPurpose(parsedFile, text) {
        const purposes = [];
        const fileName = (parsedFile.fileName || '').toLowerCase();

        // Check purpose rules against filename
        for (const rule of this.purposeRules) {
            if (rule.pattern.test(fileName)) {
                purposes.push({
                    purpose: rule.purpose,
                    confidence: rule.confidence,
                    source: 'filename'
                });
            }
        }

        // Check against content
        for (const rule of this.purposeRules) {
            if (rule.pattern.test(text)) {
                const existing = purposes.find(p => p.purpose === rule.purpose);
                if (existing) {
                    existing.confidence = Math.max(existing.confidence, rule.confidence);
                    existing.source = 'both';
                } else {
                    purposes.push({
                        purpose: rule.purpose,
                        confidence: rule.confidence * 0.9,
                        source: 'content'
                    });
                }
            }
        }

        // Infer from language and structure
        if (parsedFile.language === 'html') {
            if (parsedFile.structure?.forms?.length > 0) {
                purposes.push({ purpose: 'form-handling', confidence: 0.8, source: 'structure' });
            }
            if (parsedFile.structure?.scripts?.some(s => s.src)) {
                purposes.push({ purpose: 'script-loading', confidence: 0.7, source: 'structure' });
            }
        }

        if (parsedFile.language === 'css') {
            purposes.push({ purpose: 'styling', confidence: 1.0, source: 'language' });
        }

        if (parsedFile.language === 'json') {
            if (parsedFile.structure?.type === 'package.json') {
                purposes.push({ purpose: 'dependency-management', confidence: 1.0, source: 'language' });
            } else {
                purposes.push({ purpose: 'data-storage', confidence: 0.9, source: 'language' });
            }
        }

        if (['javascript', 'typescript'].includes(parsedFile.language)) {
            if (parsedFile.structure?.hasFunctions && !parsedFile.structure?.hasClasses) {
                purposes.push({ purpose: 'functional-script', confidence: 0.7, source: 'structure' });
            }
            if (parsedFile.structure?.hasClasses) {
                purposes.push({ purpose: 'object-oriented', confidence: 0.8, source: 'structure' });
            }
        }

        // Sort by confidence
        purposes.sort((a, b) => b.confidence - a.confidence);

        return {
            primary: purposes[0] || { purpose: 'unknown', confidence: 0.5, source: 'default' },
            secondary: purposes.slice(1, 3),
            all: purposes
        };
    }

    extractDependencies(parsedFile) {
        const dependencies = [];

        if (!parsedFile.structure) return dependencies;
        const structure = parsedFile.structure;

        // Extract from imports
        if (structure.imports) {
            for (const imp of structure.imports) {
                const source = imp.source || imp.path || imp.module || '';
                if (source && !source.startsWith('.') && !source.startsWith('/')) {
                    dependencies.push({
                        name: source.split('/')[0],
                        type: 'external',
                        version: null,
                        optional: false,
                        dev: false
                    });
                } else if (source) {
                    dependencies.push({
                        name: source,
                        type: 'internal',
                        version: null,
                        optional: false,
                        dev: false
                    });
                }
            }
        }

        // Extract from package.json
        if (parsedFile.language === 'json' && parsedFile.structure?.type === 'package.json') {
            // Would need full JSON parsing for this
            const text = parsedFile.rawPreview || '';
            const depRegex = /"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{([^}]+)\}/g;
            let match;
            while ((match = depRegex.exec(text)) !== null) {
                const depType = match[1];
                const depBlock = match[2];
                const depMatches = depBlock.matchAll(/"([^"]+)":\s*"([^"]+)"/g);
                for (const dep of depMatches) {
                    dependencies.push({
                        name: dep[1],
                        type: 'npm',
                        version: dep[2],
                        optional: depType === 'optionalDependencies',
                        dev: depType === 'devDependencies'
                    });
                }
            }
        }

        // Extract from HTML scripts/stylesheets
        if (parsedFile.language === 'html') {
            if (structure.scripts) {
                for (const script of structure.scripts) {
                    if (script.src && script.src.startsWith('http')) {
                        dependencies.push({
                            name: script.src,
                            type: 'cdn',
                            version: null,
                            optional: false,
                            dev: false
                        });
                    }
                }
            }
            if (structure.stylesheets) {
                for (const sheet of structure.stylesheets) {
                    if (sheet.href && sheet.href.startsWith('http')) {
                        dependencies.push({
                            name: sheet.href,
                            type: 'cdn',
                            version: null,
                            optional: false,
                            dev: false
                        });
                    }
                }
            }
        }

        // Deduplicate
        const seen = new Set();
        return dependencies.filter(d => {
            const key = `${d.type}:${d.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    extractRelationships(parsedFile, entities, concepts) {
        const relationships = [];

        // Entity-to-entity relationships
        const functions = entities.filter(e => e.type === 'function');
        const classes = entities.filter(e => e.type === 'class');
        const variables = entities.filter(e => e.type === 'variable');

        // Function calls function (simplified - would need full AST)
        for (const fn of functions) {
            for (const other of functions) {
                if (fn.value !== other.value) {
                    relationships.push({
                        from: fn.value,
                        to: other.value,
                        type: 'may-call',
                        confidence: 0.3
                    });
                }
            }
        }

        // Class contains function
        for (const cls of classes) {
            for (const fn of functions) {
                relationships.push({
                    from: cls.value,
                    to: fn.value,
                    type: 'may-contain',
                    confidence: 0.5
                });
            }
        }

        // Variable used by function
        for (const v of variables) {
            for (const fn of functions) {
                relationships.push({
                    from: fn.value,
                    to: v.value,
                    type: 'may-use',
                    confidence: 0.4
                });
            }
        }

        // Concept-to-concept relationships
        const uiConcepts = concepts.filter(c => c.category === 'ui');
        const dataConcepts = concepts.filter(c => c.category === 'data');

        for (const ui of uiConcepts) {
            for (const data of dataConcepts) {
                relationships.push({
                    from: ui.term,
                    to: data.term,
                    type: 'ui-data-binding',
                    confidence: 0.6
                });
            }
        }

        // File-to-dependency relationships
        const deps = this.extractDependencies(parsedFile);
        for (const dep of deps) {
            relationships.push({
                from: parsedFile.fileName,
                to: dep.name,
                type: 'depends-on',
                confidence: 1.0
            });
        }

        return relationships;
    }

    generateFingerprint(parsedFile, cognitiveResult, entities, concepts, purpose) {
        // Create a unique fingerprint for this file
        const components = [
            parsedFile.language || 'unknown',
            parsedFile.fileName || '',
            (purpose.primary?.purpose || 'unknown'),
            entities.map(e => e.type).sort().join(','),
            concepts.map(c => c.category).sort().join(','),
            JSON.stringify(parsedFile.structure?.topLevelKeys || []),
            parsedFile.fileSize?.toString() || '0'
        ];

        const fingerprint = this.hashString(components.join('|'));

        return {
            hash: fingerprint,
            components: {
                language: parsedFile.language,
                purpose: purpose.primary?.purpose,
                entityTypes: [...new Set(entities.map(e => e.type))],
                conceptCategories: [...new Set(concepts.map(c => c.category))],
                complexity: parsedFile.structure?.complexity || 0,
                size: parsedFile.fileSize
            },
            mrnnResonance: cognitiveResult.mrnn?.meaning?.coherence || 0
        };
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    calculateConfidence(parsedFile, entities, concepts, purpose) {
        let confidence = 0.5;

        // Higher confidence for well-structured files
        if (parsedFile.structure) {
            if (parsedFile.structure.lineCount > 0) confidence += 0.1;
            if (parsedFile.structure.complexity > 0) confidence += 0.1;
        }

        // Higher confidence with more entities
        if (entities.length > 5) confidence += 0.1;
        if (entities.length > 20) confidence += 0.1;

        // Higher confidence with concepts
        if (concepts.length > 0) confidence += 0.1;
        if (concepts.length > 5) confidence += 0.1;

        // Higher confidence with clear purpose
        if (purpose.primary && purpose.primary.confidence > 0.8) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }
}

window.SemanticAnalyzer = SemanticAnalyzer;
