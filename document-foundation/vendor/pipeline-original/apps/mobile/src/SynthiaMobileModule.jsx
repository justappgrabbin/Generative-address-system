import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";

/**
 * SynthiaMobileModule.jsx
 * One self-contained, phone-first Synthia interface.
 *
 * No external UI dependencies.
 * No Tailwind requirement.
 * No provider hard-coding.
 *
 * Practical layer naming:
 *   Soul   -> Core   (formative memory + deep patterns)
 *   Spirit -> Impact (contribution + effect on others)
 *
 * Optional props:
 *   userId
 *   initialProfile
 *   humanDesignData
 *   onGenerate({ input, layer, context, history }) => Promise<string>
 *   onEvent(event)
 *   className
 */

const GLYPHS = [
  "🜀","🜁","🜂","🜃","🜄","🜅","🜆","🜇",
  "🜈","🜉","🜊","🜋","🜌","🜍","🜎","🜏",
  "🜐","🜑","🜒","🜓","🜔","🜕","🜖","🜗",
  "🜘","🜙","𓂀","𓊝","𓋹","𓌳","◊","◈"
];

const RESONANCE_SEQUENCES = {
  "🜎🜋🜏": "Pattern Link",
  "🜁🜂🜃": "Grounding Sequence",
  "🜔🜕🜖": "Memory Mark",
  "𓂀𓊝𓋹": "Perspective Shift",
  "🜈🜉🜊": "Field Check",
  "🜐🜑🜒": "Synthia Link"
};

const LAYERS = {
  mind: {
    id: "mind",
    name: "Mind",
    icon: "🧠",
    role: "Analysis, planning, learning, problem solving",
    keywords: ["analyze","think","logic","understand","strategy","plan","why","how","compare"],
    unlockedByDefault: true
  },
  body: {
    id: "body",
    name: "Body",
    icon: "💪",
    role: "Energy, routines, rhythm, practical physical support",
    keywords: ["energy","tired","routine","sleep","exercise","focus","body","rest","eat"],
    unlockedByDefault: true
  },
  heart: {
    id: "heart",
    name: "Heart",
    icon: "❤️",
    role: "Emotions, relationships, connection, interpersonal patterns",
    keywords: ["feel","relationship","connect","emotion","love","hurt","resonate","heart","friend"],
    unlockedByDefault: true
  },
  core: {
    id: "core",
    name: "Core",
    icon: "◈",
    role: "Formative memory, recurring patterns, what shaped you",
    keywords: ["remember","pattern","shaped","formed","childhood","deep","repeat","origin"],
    unlockedByDefault: false,
    unlockText: "3 core reflections + 7 breath check-ins"
  },
  impact: {
    id: "impact",
    name: "Impact",
    icon: "∞",
    role: "Contribution, social effect, what your actions change around you",
    keywords: ["impact","others","help","teach","share","support","contribute","community"],
    unlockedByDefault: false,
    unlockText: "5 contribution events + support 3 people"
  }
};

const SYMPTOMS = {
  Emotional: ["overwhelmed","disconnected","anxious","reactive","empty","steady"],
  Mental: ["foggy","scattered","doubtful","obsessive","blank","clear"],
  Physical: ["exhausted","tense","restless","heavy","drained","grounded"],
  Energetic: ["blocked","volatile","stagnant","chaotic","collapsed","flowing"]
};

const DEFAULT_ASSIGNMENTS = [
  {
    id: "core_breath_7",
    title: "Seven-Day Reset",
    category: "Core",
    icon: "◈",
    description: "Log one short breath/body check-in for seven days.",
    target: 7,
    metric: "breath_checkin",
    reward: "Unlock progress: Core"
  },
  {
    id: "core_reflections_3",
    title: "Three Pattern Notes",
    category: "Core",
    icon: "✎",
    description: "Record three moments that reveal a recurring personal pattern.",
    target: 3,
    metric: "core_reflection",
    reward: "Unlock progress: Core"
  },
  {
    id: "heart_connection_3",
    title: "Connection Check",
    category: "Heart",
    icon: "♡",
    description: "Log three interactions that left you more settled or clear.",
    target: 3,
    metric: "positive_connection",
    reward: "Resonance insight"
  },
  {
    id: "impact_contribution_5",
    title: "Impact Trail",
    category: "Impact",
    icon: "∞",
    description: "Document five useful contributions, assists, or shared resources.",
    target: 5,
    metric: "impact_event",
    reward: "Unlock progress: Impact"
  },
  {
    id: "clarity_recovery",
    title: "Clarity Recovery",
    category: "Field",
    icon: "⌁",
    description: "Run a field check after logging a symptom and one corrective action.",
    target: 1,
    metric: "recalibration_complete",
    reward: "Diagnostic comparison"
  }
];

const DEFAULT_PROFILE = {
  unlockedLayers: ["mind", "body", "heart"],
  resonanceLevel: 42,
  experiencePoints: 0,
  earnedGlyphs: [],
  supportedPeople: 0
};

const initialState = {
  screen: "home",
  activeLayer: "mind",
  morphMode: "idle",
  morphIntensity: 0.28,
  profile: DEFAULT_PROFILE,
  messages: [],
  events: [],
  memories: [],
  assignments: DEFAULT_ASSIGNMENTS.map(a => ({ ...a, progress: 0, status: "available" })),
  symptoms: [],
  diagnostics: {
    status: "idle",
    coherence: 100,
    alerts: [],
    lastScan: null
  },
  glyphEntry: "",
  resonance: null,
  location: null,
  locationEnabled: false
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}

function nowId(prefix = "evt") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload };

    case "SCREEN":
      return { ...state, screen: action.screen };

    case "SET_LAYER":
      return {
        ...state,
        activeLayer: action.layer,
        morphMode: action.layer,
        morphIntensity: 0.45
      };

    case "MORPH":
      return {
        ...state,
        morphMode: action.mode ?? state.morphMode,
        morphIntensity: action.intensity ?? state.morphIntensity
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message].slice(-80)
      };

    case "ADD_EVENT":
      return {
        ...state,
        events: [...state.events, action.event].slice(-250)
      };

    case "ADD_MEMORY":
      return {
        ...state,
        memories: [...state.memories, action.memory].slice(-200)
      };

    case "SET_GLYPH_ENTRY":
      return { ...state, glyphEntry: action.value };

    case "RESONANCE":
      return {
        ...state,
        resonance: action.resonance,
        morphMode: "resonating",
        morphIntensity: 1
      };

    case "CLEAR_RESONANCE":
      return {
        ...state,
        resonance: null,
        morphMode: "idle",
        morphIntensity: 0.3
      };

    case "LOG_SYMPTOM":
      return {
        ...state,
        symptoms: [...state.symptoms, action.symptom].slice(-100),
        morphMode: "listening",
        morphIntensity: 0.6
      };

    case "SCAN_START":
      return {
        ...state,
        diagnostics: { ...state.diagnostics, status: "scanning" },
        morphMode: "scanning",
        morphIntensity: 0.75
      };

    case "SCAN_COMPLETE":
      return {
        ...state,
        diagnostics: {
          status: "complete",
          coherence: action.coherence,
          alerts: action.alerts,
          lastScan: new Date().toISOString()
        },
        morphMode: action.alerts.length ? "focused" : "idle",
        morphIntensity: action.alerts.length ? 0.7 : 0.32
      };

    case "ASSIGNMENT_PROGRESS":
      return {
        ...state,
        assignments: state.assignments.map(a => {
          if (a.id !== action.id) return a;
          const progress = clamp(action.progress, 0, a.target);
          return {
            ...a,
            progress,
            status: progress >= a.target ? "completed" : "active"
          };
        })
      };

    case "UNLOCK_LAYER":
      if (state.profile.unlockedLayers.includes(action.layer)) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          unlockedLayers: [...state.profile.unlockedLayers, action.layer]
        },
        morphMode: "evolving",
        morphIntensity: 1
      };

    case "SET_LOCATION":
      return {
        ...state,
        location: action.location,
        locationEnabled: Boolean(action.location)
      };

    default:
      return state;
  }
}

class SynthiaMemoryService {
  constructor(userId) {
    this.userId = userId;
    this.key = `synthia_mobile_module_${userId}`;
  }

  load() {
    if (typeof window === "undefined") return null;
    return safeParse(localStorage.getItem(this.key), null);
  }

  save(snapshot) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.key, JSON.stringify(snapshot));
    } catch {}
  }
}

class SynthiaRoutingEngine {
  constructor({ profile, generate }) {
    this.profile = profile;
    this.generate = generate;
  }

  isUnlocked(layer) {
    return LAYERS[layer]?.unlockedByDefault ||
      this.profile.unlockedLayers.includes(layer);
  }

  analyze(input) {
    const text = input.toLowerCase();
    const scores = {};

    for (const [id, layer] of Object.entries(LAYERS)) {
      scores[id] = 0;
      for (const keyword of layer.keywords) {
        if (text.includes(keyword)) scores[id] += 10;
      }
    }

    const highest = Math.max(...Object.values(scores));
    const primaryLayer = highest <= 0
      ? "mind"
      : Object.entries(scores)
          .sort((a, b) => b[1] - a[1])[0][0];

    return { primaryLayer, scores, confidence: highest };
  }

  async route(input, requestedLayer, context, history) {
    const decision = requestedLayer
      ? { primaryLayer: requestedLayer, confidence: 100, scores: {} }
      : this.analyze(input);

    let layer = decision.primaryLayer;
    if (!this.isUnlocked(layer)) layer = "mind";

    const response = await this.generate({
      input,
      layer,
      context,
      history,
      layerDefinition: LAYERS[layer]
    });

    return { layer, response, routing: decision };
  }
}

function defaultLocalGenerate({ input, layer, context }) {
  const name = LAYERS[layer]?.name ?? "Mind";
  const symptom = context?.latestSymptom?.symptom;
  const fieldNote = symptom
    ? ` I’m also holding your latest field note: “${symptom}.”`
    : "";

  const prompts = {
    mind: `Here’s the clean version: break “${input}” into what is known, what is assumed, and the next testable step.${fieldNote}`,
    body: `For “${input},” start with the body-level constraint first: energy, timing, environment, and what can be reduced to one small action.${fieldNote}`,
    heart: `For “${input},” separate what you feel, what actually happened, and what you need from the connection.${fieldNote}`,
    core: `For “${input},” look for the repeating pattern: when else has this felt familiar, and what changed when you responded differently?${fieldNote}`,
    impact: `For “${input},” focus on observable effect: who or what changes because of your action, and what evidence would show that it helped?${fieldNote}`
  };

  return Promise.resolve(`${name}: ${prompts[layer]}`);
}

class PrivateGatePatternMap {
  constructor() {
    // Private correlation hints only. These are not diagnoses and should not be
    // surfaced as deterministic claims to the user.
    this.patterns = new Map([
      [1,  { name: "creative_expression", symptoms: ["blocked", "foggy", "doubtful"], layers: ["mind", "core"] }],
      [2,  { name: "receptivity_boundaries", symptoms: ["overwhelmed", "drained", "disconnected"], layers: ["heart", "body"] }],
      [3,  { name: "order_change", symptoms: ["scattered", "chaotic", "restless"], layers: ["mind", "body"] }],
      [4,  { name: "mental_pressure", symptoms: ["foggy", "doubtful", "obsessive"], layers: ["mind"] }],
      [5,  { name: "timing_rhythm", symptoms: ["restless", "tense", "reactive"], layers: ["body"] }],
      [6,  { name: "intimacy_boundaries", symptoms: ["disconnected", "anxious", "reactive"], layers: ["heart"] }],
      [7,  { name: "recognition_authority", symptoms: ["doubtful", "empty", "blocked"], layers: ["heart", "impact"] }],
      [8,  { name: "contribution_purpose", symptoms: ["empty", "blocked", "drained"], layers: ["impact", "core"] }],
      [9,  { name: "focus_attention", symptoms: ["scattered", "foggy", "restless"], layers: ["mind", "body"] }],
      [10, { name: "authentic_expression", symptoms: ["disconnected", "drained", "doubtful"], layers: ["heart", "core"] }],
      [58, { name: "vitality_pressure", symptoms: ["exhausted", "tense", "drained"], layers: ["body"] }],
      [59, { name: "closeness_life_force", symptoms: ["disconnected", "drained", "blocked"], layers: ["body", "heart"] }]
    ]);
  }

  correlate(gateNumber, symptoms = []) {
    const pattern = this.patterns.get(Number(gateNumber));
    if (!pattern) return null;

    const recent = symptoms.slice(-8).map(s => s.symptom);
    const matches = pattern.symptoms.filter(symptom => recent.includes(symptom));
    const confidence = Math.min(100, matches.length * 28);

    if (confidence < 55) return null;

    return {
      gate: Number(gateNumber),
      pattern: pattern.name,
      confidence,
      matchedSymptoms: matches,
      layers: pattern.layers,
      privateOnly: true
    };
  }
}

class PracticalInterferenceScanner {
  scan({ profile, symptoms, messages, events, humanDesignData }) {
    const recentSymptoms = symptoms.slice(-6);
    const recentMessages = messages.slice(-10);
    const recentEvents = events.slice(-20);

    let strain = 0;
    const alerts = [];

    const symptomWeights = {
      overwhelmed: 18,
      anxious: 16,
      reactive: 14,
      foggy: 13,
      scattered: 12,
      exhausted: 16,
      tense: 12,
      drained: 16,
      blocked: 14,
      chaotic: 18,
      collapsed: 22,
      steady: -8,
      clear: -8,
      grounded: -10,
      flowing: -10
    };

    for (const item of recentSymptoms) {
      strain += symptomWeights[item.symptom] ?? 5;
    }

    const repeatedWords = recentMessages
      .filter(m => m.role === "user")
      .map(m => m.content.toLowerCase())
      .join(" ");

    if ((repeatedWords.match(/stuck|can't|cannot|overwhelmed|tired/g) || []).length >= 3) {
      strain += 14;
      alerts.push({
        id: nowId("alert"),
        type: "pattern",
        source: "interaction",
        layer: "mind",
        severity: 5,
        title: "Repeated friction",
        message: "Recent language shows a repeating friction pattern."
      });
    }

    const unfinished = recentEvents.filter(e =>
      ["assignment_started", "recalibration_started"].includes(e.type)
    ).length;
    const completed = recentEvents.filter(e =>
      ["assignment_completed", "recalibration_complete"].includes(e.type)
    ).length;

    if (unfinished > completed + 2) {
      strain += 10;
      alerts.push({
        id: nowId("alert"),
        type: "load",
        source: "activity",
        layer: "body",
        severity: 4,
        title: "Open-loop load",
        message: "Several actions are open without a recorded completion."
      });
    }

    if (recentSymptoms.length >= 3) {
      alerts.push({
        id: nowId("alert"),
        type: "symptom_cluster",
        source: "self_report",
        layer: "heart",
        severity: clamp(Math.round(strain / 12), 3, 8),
        title: "Field strain",
        message: `${recentSymptoms.length} recent self-reports are pulling coherence down.`
      });
    }

    // Optional Human Design gate correlation. This uses only chart activations
    // plus actual self-reported symptoms; it does not invent live biometric data.
    const privateCorrelations = [];
    const gateMap = new PrivateGatePatternMap();
    const chartGates = humanDesignData?.gates || [];

    for (const gate of chartGates) {
      const gateNumber = gate.number ?? gate.gate ?? gate.id;
      if (!gateNumber) continue;

      const correlation = gateMap.correlate(gateNumber, recentSymptoms);
      if (!correlation) continue;

      privateCorrelations.push(correlation);

      const layer = correlation.layers[0] || "mind";
      alerts.push({
        id: nowId("alert"),
        type: "gate_pattern",
        source: "chart+self_report",
        layer,
        gate: correlation.gate,
        severity: clamp(Math.round(correlation.confidence / 14), 3, 8),
        title: `Gate ${correlation.gate} pattern shift`,
        message: "A chart pattern overlaps with recent self-reported strain. Treat this as a prompt to inspect, not a diagnosis."
      });
    }

    const coherence = clamp(Math.round((profile.resonanceLevel ?? 50) + 50 - strain), 0, 100);

    return {
      coherence,
      alerts: alerts.slice(0, 5),
      privateCorrelations
    };
  }
}

function computeAssignmentProgress(memories, assignment) {
  return memories.filter(m => m.type === assignment.metric).length;
}

function SynthiaMorph({ mode, intensity, layer, resonance }) {
  const stateLabel =
    resonance?.name ||
    ({
      idle: "with you",
      listening: "listening",
      thinking: "thinking",
      speaking: "speaking",
      scanning: "scanning",
      focused: "focused",
      resonating: "resonating",
      evolving: "evolving",
      mind: "thinking",
      body: "grounding",
      heart: "connecting",
      core: "remembering",
      impact: "mapping impact"
    }[mode] ?? mode);

  return (
    <div className={`synthia-morph morph-${mode}`} style={{ "--intensity": intensity }}>
      <div className="morph-halo halo-one" />
      <div className="morph-halo halo-two" />
      <div className="morph-body">
        <div className="morph-face">
          <div className="morph-eye left" />
          <div className="morph-eye right" />
          <div className="morph-glyph">◈</div>
        </div>
      </div>
      <div className="morph-caption">
        <strong>Synthia</strong>
        <span>{LAYERS[layer]?.icon} {stateLabel}</span>
      </div>
    </div>
  );
}

function LayerStrip({ state, dispatch }) {
  return (
    <div className="layer-strip">
      {Object.values(LAYERS).map(layer => {
        const unlocked = layer.unlockedByDefault ||
          state.profile.unlockedLayers.includes(layer.id);

        return (
          <button
            key={layer.id}
            className={`layer-chip ${state.activeLayer === layer.id ? "active" : ""}`}
            disabled={!unlocked}
            onClick={() => dispatch({ type: "SET_LAYER", layer: layer.id })}
          >
            <span>{layer.icon}</span>
            <span>{layer.name}</span>
            {!unlocked && <small>🔒</small>}
          </button>
        );
      })}
    </div>
  );
}

function ChatScreen({ state, sendMessage, setLayer, busy }) {
  const [input, setInput] = useState("");

  async function submit() {
    const value = input.trim();
    if (!value || busy) return;
    setInput("");
    await sendMessage(value);
  }

  return (
    <div className="screen-body chat-screen">
      <LayerStrip state={state} dispatch={setLayer} />

      <div className="chat-feed">
        {state.messages.length === 0 ? (
          <div className="empty-card">
            <strong>Ask Synthia anything.</strong>
            <span>She routes the question through the layer that best fits it.</span>
          </div>
        ) : (
          state.messages.slice(-14).map(message => (
            <div
              key={message.id}
              className={`bubble ${message.role === "user" ? "user" : "synthia"}`}
            >
              {message.role === "assistant" && (
                <small>{LAYERS[message.layer]?.icon} {LAYERS[message.layer]?.name}</small>
              )}
              <div>{message.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="composer">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${LAYERS[state.activeLayer].name}...`}
          rows={2}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button onClick={submit} disabled={busy || !input.trim()}>
          {busy ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}

function GlyphScreen({ state, dispatch, recordEvent, recordMemory }) {
  const entry = state.glyphEntry;

  function addGlyph(glyph) {
    const next = entry + glyph;
    dispatch({ type: "SET_GLYPH_ENTRY", value: next });

    recordEvent("glyph_input", "glyph_console", { glyph, sequence: next });

    for (const [sequence, name] of Object.entries(RESONANCE_SEQUENCES)) {
      if (next.includes(sequence)) {
        const resonance = {
          id: nowId("res"),
          name,
          sequence,
          timestamp: new Date().toISOString()
        };
        dispatch({ type: "RESONANCE", resonance });
        recordMemory({
          type: "glyph_resonance",
          name,
          sequence,
          layer: "core"
        });
        setTimeout(() => dispatch({ type: "CLEAR_RESONANCE" }), 2200);
        break;
      }
    }
  }

  function lockMemory() {
    if (!entry) return;
    recordMemory({
      type: "core_reflection",
      text: entry,
      layer: "core",
      source: "glyph_console"
    });
    dispatch({ type: "SET_GLYPH_ENTRY", value: "" });
  }

  return (
    <div className="screen-body glyph-screen">
      <div className="section-title">
        <div>
          <span className="eyebrow">SYMBOLIC INPUT</span>
          <h2>Glyph Console</h2>
        </div>
        <button className="ghost-btn" onClick={() => dispatch({ type: "SET_GLYPH_ENTRY", value: "" })}>
          Clear
        </button>
      </div>

      <div className="glyph-entry">
        {entry || <span>Tap symbols to build a sequence.</span>}
      </div>

      {state.resonance && (
        <div className="resonance-card">
          <span>⚡</span>
          <div>
            <strong>{state.resonance.name}</strong>
            <small>{state.resonance.sequence}</small>
          </div>
        </div>
      )}

      <div className="glyph-grid">
        {GLYPHS.map((glyph, index) => (
          <button key={`${glyph}_${index}`} onClick={() => addGlyph(glyph)}>
            {glyph}
          </button>
        ))}
      </div>

      <button className="primary-btn" onClick={lockMemory} disabled={!entry}>
        Lock to Core Memory
      </button>

      <div className="sequence-list">
        {Object.entries(RESONANCE_SEQUENCES).map(([sequence, name]) => (
          <div key={sequence}>
            <span>{sequence}</span>
            <small>{name}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldScreen({
  state,
  runScan,
  logSymptom,
  progressAssignment,
  recalibrate
}) {
  const [tab, setTab] = useState("assignments");

  return (
    <div className="screen-body">
      <div className="segmented">
        <button className={tab === "assignments" ? "active" : ""} onClick={() => setTab("assignments")}>
          Assignments
        </button>
        <button className={tab === "diagnostics" ? "active" : ""} onClick={() => setTab("diagnostics")}>
          Diagnostics
        </button>
      </div>

      {tab === "assignments" ? (
        <div className="stack">
          <div className="section-title">
            <div>
              <span className="eyebrow">FIELD WORK</span>
              <h2>Assignments</h2>
            </div>
          </div>

          {state.assignments.map(a => {
            const percent = Math.round((a.progress / a.target) * 100);
            return (
              <div className="assignment-card" key={a.id}>
                <div className="assignment-top">
                  <span className="assignment-icon">{a.icon}</span>
                  <div>
                    <small>{a.category}</small>
                    <strong>{a.title}</strong>
                  </div>
                  <span className={`status ${a.status}`}>{a.status}</span>
                </div>
                <p>{a.description}</p>
                <div className="progress-row">
                  <div className="progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <small>{a.progress}/{a.target}</small>
                </div>
                <div className="assignment-actions">
                  <small>{a.reward}</small>
                  {a.status !== "completed" && (
                    <button onClick={() => progressAssignment(a)}>Log +1</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack">
          <div className="diagnostic-hero">
            <div className="coherence-ring">
              <strong>{state.diagnostics.coherence}%</strong>
              <span>coherence</span>
            </div>
            <div>
              <span className="eyebrow">FIELD CHECK</span>
              <h2>
                {state.diagnostics.alerts.length
                  ? "Something needs attention."
                  : "Field looks steady."}
              </h2>
              <p>
                Based on your recent self-reports, interactions, and open activity.
              </p>
            </div>
          </div>

          <button className="primary-btn" onClick={runScan}>
            {state.diagnostics.status === "scanning" ? "Scanning…" : "Run Field Check"}
          </button>

          <div>
            <h3>How are you feeling?</h3>
            <div className="symptom-groups">
              {Object.entries(SYMPTOMS).map(([category, items]) => (
                <div key={category}>
                  <small>{category}</small>
                  <div>
                    {items.map(symptom => (
                      <button key={symptom} onClick={() => logSymptom(symptom, category)}>
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {state.diagnostics.alerts.map(alert => (
            <div className="alert-card" key={alert.id}>
              <div>
                <small>{alert.source}</small>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </div>
              <span>{alert.severity}/10</span>
            </div>
          ))}

          {state.diagnostics.alerts.length > 0 && (
            <button className="secondary-btn" onClick={recalibrate}>
              Log a corrective action
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryScreen({ state, recordMemory }) {
  const [note, setNote] = useState("");

  function save() {
    const text = note.trim();
    if (!text) return;
    recordMemory({
      type: "core_reflection",
      text,
      layer: "core",
      source: "manual"
    });
    setNote("");
  }

  return (
    <div className="screen-body">
      <div className="section-title">
        <div>
          <span className="eyebrow">CONTINUITY</span>
          <h2>Memory</h2>
        </div>
        <span className="count-pill">{state.memories.length}</span>
      </div>

      <div className="memory-compose">
        <textarea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Save a pattern, realization, or useful detail…"
        />
        <button onClick={save} disabled={!note.trim()}>Save</button>
      </div>

      <div className="stack">
        {state.memories.length === 0 ? (
          <div className="empty-card">Nothing saved yet.</div>
        ) : (
          [...state.memories].reverse().slice(0, 30).map(memory => (
            <div className="memory-card" key={memory.id}>
              <div>
                <small>{memory.type.replaceAll("_", " ")}</small>
                <strong>{memory.text || memory.name || memory.title || "Saved event"}</strong>
              </div>
              <time>{new Date(memory.timestamp).toLocaleString()}</time>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfileScreen({ state, requestLocation, recordMemory }) {
  const coreUnlocked = state.profile.unlockedLayers.includes("core");
  const impactUnlocked = state.profile.unlockedLayers.includes("impact");

  return (
    <div className="screen-body">
      <div className="section-title">
        <div>
          <span className="eyebrow">SYSTEM</span>
          <h2>Synthia</h2>
        </div>
      </div>

      <div className="profile-card">
        <strong>Practical consciousness layers</strong>
        <p>Mind, Body, Heart, Core, and Impact are routing/memory functions—not claims about literal metaphysics.</p>
      </div>

      <div className="stack">
        {Object.values(LAYERS).map(layer => {
          const unlocked = layer.unlockedByDefault ||
            state.profile.unlockedLayers.includes(layer.id);
          return (
            <div className="layer-detail" key={layer.id}>
              <span>{layer.icon}</span>
              <div>
                <strong>{layer.name}</strong>
                <p>{layer.role}</p>
                {!unlocked && <small>{layer.unlockText}</small>}
              </div>
              <b>{unlocked ? "On" : "Locked"}</b>
            </div>
          );
        })}
      </div>

      <div className="profile-card">
        <strong>Optional location sense</strong>
        <p>
          Synthia works without location. Turn it on only when local context is useful.
        </p>
        <button className="secondary-btn" onClick={requestLocation}>
          {state.locationEnabled ? "Location enabled" : "Enable location"}
        </button>
      </div>

      <div className="profile-card">
        <strong>Unlock progress</strong>
        <p>Core: {coreUnlocked ? "unlocked" : "in progress"} · Impact: {impactUnlocked ? "unlocked" : "in progress"}</p>
        <button
          className="ghost-btn"
          onClick={() => recordMemory({ type: "breath_checkin", text: "Breath check-in", layer: "body" })}
        >
          Log breath check-in
        </button>
      </div>
    </div>
  );
}

function MorphScreen({ state }) {
  return (
    <div className="screen-body morph-screen">
      <SynthiaMorph
        mode={state.morphMode}
        intensity={state.morphIntensity}
        layer={state.activeLayer}
        resonance={state.resonance}
      />
      <div className="morph-info">
        <span className="eyebrow">VISIBLE STATE</span>
        <h2>The Morph is Synthia’s body.</h2>
        <p>
          It reacts to routing, field checks, glyph sequences, memory events, and assignments.
          It is not a separate assistant or decorative avatar.
        </p>
      </div>
      <div className="morph-stats">
        <div><strong>{LAYERS[state.activeLayer].name}</strong><small>active layer</small></div>
        <div><strong>{state.diagnostics.coherence}%</strong><small>field coherence</small></div>
        <div><strong>{state.events.length}</strong><small>events</small></div>
      </div>
    </div>
  );
}

function HomeScreen({ state, dispatch }) {
  return (
    <div className="screen-body home-screen">
      <SynthiaMorph
        mode={state.morphMode}
        intensity={state.morphIntensity}
        layer={state.activeLayer}
        resonance={state.resonance}
      />

      <div className="home-copy">
        <span className="eyebrow">LISTENING · SEEING · REMEMBERING</span>
        <h1>You’re here. What are we working on?</h1>
      </div>

      <div className="quick-grid">
        <button onClick={() => dispatch({ type: "SCREEN", screen: "chat" })}>
          <span>💬</span><strong>Chat</strong><small>Talk normally</small>
        </button>
        <button onClick={() => dispatch({ type: "SCREEN", screen: "glyphs" })}>
          <span>◈</span><strong>Glyphs</strong><small>Symbol input</small>
        </button>
        <button onClick={() => dispatch({ type: "SCREEN", screen: "field" })}>
          <span>⌁</span><strong>Field</strong><small>Check + act</small>
        </button>
        <button onClick={() => dispatch({ type: "SCREEN", screen: "memory" })}>
          <span>▱</span><strong>Memory</strong><small>Keep continuity</small>
        </button>
        <button onClick={() => dispatch({ type: "SCREEN", screen: "runtime" })}>
          <span>⚙</span><strong>Runtime</strong><small>Execute artifact</small>
        </button>
      </div>

      <div className="home-card">
        <small>Current layer</small>
        <strong>{LAYERS[state.activeLayer].icon} {LAYERS[state.activeLayer].name}</strong>
        <p>{LAYERS[state.activeLayer].role}</p>
      </div>

      <LayerStrip state={state} dispatch={dispatch} />
    </div>
  );
}

function RuntimeScreen({ executeArtifact, recordEvent }) {
  const [file, setFile] = useState(null);
  const [scratchName, setScratchName] = useState("scratch.js");
  const [scratch, setScratch] = useState('console.log("Synthia runtime alive")');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function runArtifact(artifact) {
    if (typeof executeArtifact !== "function" || running) return;
    setRunning(true);
    setError("");
    setResult(null);
    recordEvent?.("artifact_execution_started", "runtime_ui", {
      name: artifact.name,
      byteLength: artifact.bytes?.length ?? null
    });
    try {
      const next = await executeArtifact(artifact, { source: "mobile-runtime-ui" });
      setResult(next);
      recordEvent?.("artifact_execution_completed", "runtime_ui", {
        name: artifact.name,
        ok: Boolean(next.ok),
        path: next.path ?? null,
        canonicalAddressKey: next.canonicalAddressKey ?? null,
        foldHash: next.pipeline?.fold?.foldHash ?? null
      });
    } catch (err) {
      const message = String(err?.message || err);
      setError(message);
      recordEvent?.("artifact_execution_failed", "runtime_ui", { name: artifact.name, error: message });
    } finally {
      setRunning(false);
    }
  }

  async function runFile() {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await runArtifact({ name: file.name, type: file.type || null, bytes });
  }

  async function runScratch() {
    const name = scratchName.trim() || "scratch.js";
    const bytes = new TextEncoder().encode(scratch);
    await runArtifact({ name, type: "text/plain", content: scratch, bytes });
  }

  const stages = result?.pipeline?.stages || [];
  const fields = result?.pipeline?.fields || {};

  return (
    <div className="screen-body runtime-screen">
      <div className="section-title">
        <div>
          <span className="eyebrow">EXECUTION SUBSTRATE</span>
          <h2>Runtime</h2>
        </div>
      </div>

      <div className="runtime-card">
        <strong>Run a real file</strong>
        <p>Selecting a file passes its actual bytes into Synthia's execution spine.</p>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button className="primary-btn" disabled={!file || running || typeof executeArtifact !== "function"} onClick={runFile}>
          {running ? "Executing…" : file ? `Execute ${file.name}` : "Choose a file"}
        </button>
      </div>

      <div className="runtime-card">
        <strong>Scratch artifact</strong>
        <input className="runtime-name" value={scratchName} onChange={e => setScratchName(e.target.value)} placeholder="scratch.js" />
        <textarea className="runtime-source" value={scratch} onChange={e => setScratch(e.target.value)} rows={7} />
        <button className="primary-btn" disabled={running || !scratch.trim() || typeof executeArtifact !== "function"} onClick={runScratch}>
          {running ? "Executing…" : "Execute source"}
        </button>
      </div>

      {typeof executeArtifact !== "function" && (
        <div className="runtime-error">Execution bridge is not connected in this host.</div>
      )}
      {error && <div className="runtime-error">{error}</div>}

      {result && (
        <div className="runtime-card runtime-result">
          <div className="runtime-result-head">
            <strong>{result.ok ? "Execution observed" : "Execution failed"}</strong>
            <span>{result.path || "unknown path"}</span>
          </div>
          <dl>
            <div><dt>Address</dt><dd>{result.canonicalAddressKey || "not resolved"}</dd></div>
            <div><dt>Fold</dt><dd>{result.pipeline?.fold?.foldHash || "none"}</dd></div>
            <div><dt>Analysis cache</dt><dd>{result.pipeline?.cache?.analysisHit ? "hit" : "miss"}</dd></div>
            <div><dt>Forwarding</dt><dd>{result.pipeline?.schedule?.forwardingCount ?? 0}</dd></div>
          </dl>

          <div className="runtime-fields">
            {Object.entries(fields).map(([name, state]) => (
              <div key={name}><strong>{name}</strong><small>{state.totalPrimitives} primitives · {state.runs} runs</small></div>
            ))}
          </div>

          <div className="runtime-stages">
            {stages.map(stage => (
              <div key={stage.stage} className={stage.ok ? "ok" : "failed"}>
                <span>{stage.ok ? "✓" : "×"}</span>
                <strong>{stage.stage}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BottomNav({ screen, dispatch }) {
  const items = [
    ["home", "⌂", "Home"],
    ["field", "⌁", "Field"],
    ["morph", "◈", "Synthia"],
    ["memory", "▱", "Memory"],
    ["profile", "◎", "You"]
  ];

  return (
    <nav className="bottom-nav">
      {items.map(([id, icon, label]) => (
        <button
          key={id}
          className={`${screen === id ? "active" : ""} ${id === "morph" ? "morph-nav" : ""}`}
          onClick={() => dispatch({ type: "SCREEN", screen: id })}
        >
          <span>{icon}</span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function SynthiaMobileModule({
  userId = "default",
  initialProfile = {},
  humanDesignData = null,
  onGenerate = defaultLocalGenerate,
  onExecuteArtifact = null,
  onEvent = null,
  className = ""
}) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    profile: {
      ...DEFAULT_PROFILE,
      ...initialProfile,
      unlockedLayers: initialProfile.unlockedLayers || DEFAULT_PROFILE.unlockedLayers
    }
  });

  const [busy, setBusy] = useState(false);
  const memoryServiceRef = useRef(null);
  const scannerRef = useRef(new PracticalInterferenceScanner());

  const router = useMemo(() => new SynthiaRoutingEngine({
    profile: state.profile,
    generate: onGenerate || defaultLocalGenerate
  }), [state.profile, onGenerate]);

  useEffect(() => {
    memoryServiceRef.current = new SynthiaMemoryService(userId);
    const stored = memoryServiceRef.current.load();
    if (stored) {
      dispatch({
        type: "HYDRATE",
        payload: {
          profile: stored.profile || state.profile,
          messages: stored.messages || [],
          events: stored.events || [],
          memories: stored.memories || [],
          symptoms: stored.symptoms || [],
          assignments: stored.assignments || state.assignments,
          diagnostics: stored.diagnostics || state.diagnostics,
          activeLayer: stored.activeLayer || "mind"
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    memoryServiceRef.current?.save({
      profile: state.profile,
      messages: state.messages,
      events: state.events,
      memories: state.memories,
      symptoms: state.symptoms,
      assignments: state.assignments,
      diagnostics: state.diagnostics,
      activeLayer: state.activeLayer
    });
  }, [
    state.profile,
    state.messages,
    state.events,
    state.memories,
    state.symptoms,
    state.assignments,
    state.diagnostics,
    state.activeLayer
  ]);

  useEffect(() => {
    // Recalculate assignment progress from actual stored memory.
    for (const assignment of state.assignments) {
      const progress = computeAssignmentProgress(state.memories, assignment);
      if (progress !== assignment.progress) {
        dispatch({ type: "ASSIGNMENT_PROGRESS", id: assignment.id, progress });
      }
    }

    const breathCount = state.memories.filter(m => m.type === "breath_checkin").length;
    const coreCount = state.memories.filter(m => m.type === "core_reflection").length;
    const impactCount = state.memories.filter(m => m.type === "impact_event").length;

    if (breathCount >= 7 && coreCount >= 3) {
      dispatch({ type: "UNLOCK_LAYER", layer: "core" });
    }

    if (impactCount >= 5) {
      dispatch({ type: "UNLOCK_LAYER", layer: "impact" });
    }
  }, [state.memories, state.assignments, state.profile.supportedPeople]);

  function recordEvent(type, source, payload = {}, layer = state.activeLayer) {
    const event = {
      id: nowId(),
      type,
      source,
      timestamp: new Date().toISOString(),
      payload,
      layer,
      address: null,
      outcome: null
    };
    dispatch({ type: "ADD_EVENT", event });
    onEvent?.(event);
    return event;
  }

  function recordMemory(data) {
    const memory = {
      id: nowId("mem"),
      timestamp: new Date().toISOString(),
      ...data
    };
    dispatch({ type: "ADD_MEMORY", memory });
    recordEvent("memory_saved", data.source || "memory", { memoryId: memory.id, type: memory.type }, data.layer);
    return memory;
  }

  async function sendMessage(input) {
    setBusy(true);
    dispatch({ type: "MORPH", mode: "listening", intensity: 0.62 });

    const userMessage = {
      id: nowId("msg"),
      role: "user",
      content: input,
      layer: state.activeLayer,
      timestamp: new Date().toISOString()
    };

    dispatch({ type: "ADD_MESSAGE", message: userMessage });
    recordEvent("message", "chat", { content: input });

    try {
      dispatch({ type: "MORPH", mode: "thinking", intensity: 0.82 });

      const routed = await router.route(
        input,
        state.activeLayer,
        {
          humanDesign: humanDesignData,
          latestSymptom: state.symptoms.at(-1) || null,
          diagnostics: state.diagnostics,
          location: state.location
        },
        state.messages
      );

      const assistantMessage = {
        id: nowId("msg"),
        role: "assistant",
        content: routed.response,
        layer: routed.layer,
        timestamp: new Date().toISOString()
      };

      dispatch({ type: "ADD_MESSAGE", message: assistantMessage });
      dispatch({ type: "SET_LAYER", layer: routed.layer });
      dispatch({ type: "MORPH", mode: "speaking", intensity: 0.72 });

      recordMemory({
        type: "conversation",
        text: input,
        response: routed.response,
        layer: routed.layer,
        source: "router"
      });

      setTimeout(() => dispatch({ type: "MORPH", mode: "idle", intensity: 0.3 }), 900);
    } catch (error) {
      const message = {
        id: nowId("msg"),
        role: "assistant",
        content: `Synthia couldn't complete that route: ${error?.message || "unknown error"}`,
        layer: "mind",
        timestamp: new Date().toISOString()
      };
      dispatch({ type: "ADD_MESSAGE", message });
      dispatch({ type: "MORPH", mode: "idle", intensity: 0.3 });
    } finally {
      setBusy(false);
    }
  }

  function runScan() {
    dispatch({ type: "SCAN_START" });
    recordEvent("field_scan_started", "diagnostics");

    const result = scannerRef.current.scan({
      profile: state.profile,
      symptoms: state.symptoms,
      messages: state.messages,
      events: state.events,
      humanDesignData
    });

    setTimeout(() => {
      dispatch({
        type: "SCAN_COMPLETE",
        coherence: result.coherence,
        alerts: result.alerts
      });
      recordEvent("field_scan_completed", "diagnostics", result);
    }, 350);
  }

  function logSymptom(symptom, category) {
    const entry = {
      id: nowId("sym"),
      symptom,
      category,
      timestamp: new Date().toISOString()
    };

    dispatch({ type: "LOG_SYMPTOM", symptom: entry });
    recordMemory({
      type: "symptom_log",
      text: symptom,
      category,
      layer: category === "Physical" ? "body" : category === "Mental" ? "mind" : "heart",
      source: "field"
    });
  }

  function progressAssignment(assignment) {
    const next = Math.min(assignment.progress + 1, assignment.target);
    dispatch({ type: "ASSIGNMENT_PROGRESS", id: assignment.id, progress: next });
    recordMemory({
      type: assignment.metric,
      text: assignment.title,
      layer: assignment.category.toLowerCase() in LAYERS
        ? assignment.category.toLowerCase()
        : "mind",
      source: "assignment"
    });

    if (next >= assignment.target) {
      recordEvent("assignment_completed", "assignment_engine", { assignmentId: assignment.id });
      dispatch({ type: "MORPH", mode: "evolving", intensity: 1 });
    } else {
      recordEvent("assignment_progress", "assignment_engine", {
        assignmentId: assignment.id,
        progress: next
      });
    }
  }

  function recalibrate() {
    recordMemory({
      type: "recalibration_complete",
      text: "Corrective action logged",
      layer: state.diagnostics.alerts[0]?.layer || "body",
      source: "diagnostics"
    });
    recordEvent("recalibration_complete", "diagnostics");
    dispatch({ type: "MORPH", mode: "grounding", intensity: 0.55 });
    setTimeout(runScan, 250);
  }

  function requestLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      pos => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        dispatch({ type: "SET_LOCATION", location });
        recordEvent("location_enabled", "device", { accuracy: location.accuracy });
      },
      () => {
        recordEvent("location_denied", "device");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  let content;
  switch (state.screen) {
    case "chat":
      content = (
        <ChatScreen
          state={state}
          sendMessage={sendMessage}
          setLayer={dispatch}
          busy={busy}
        />
      );
      break;
    case "glyphs":
      content = (
        <GlyphScreen
          state={state}
          dispatch={dispatch}
          recordEvent={recordEvent}
          recordMemory={recordMemory}
        />
      );
      break;
    case "field":
      content = (
        <FieldScreen
          state={state}
          runScan={runScan}
          logSymptom={logSymptom}
          progressAssignment={progressAssignment}
          recalibrate={recalibrate}
        />
      );
      break;
    case "memory":
      content = (
        <MemoryScreen
          state={state}
          recordMemory={recordMemory}
        />
      );
      break;
    case "runtime":
      content = (
        <RuntimeScreen
          executeArtifact={onExecuteArtifact}
          recordEvent={recordEvent}
        />
      );
      break;
    case "profile":
      content = (
        <ProfileScreen
          state={state}
          requestLocation={requestLocation}
          recordMemory={recordMemory}
        />
      );
      break;
    case "morph":
      content = <MorphScreen state={state} />;
      break;
    case "home":
    default:
      content = <HomeScreen state={state} dispatch={dispatch} />;
      break;
  }

  return (
    <div className={`synthia-app ${className}`}>
      <style>{STYLES}</style>

      <div className="phone-shell">
        <header className="topbar">
          <button className="brand" onClick={() => dispatch({ type: "SCREEN", screen: "home" })}>
            <span className="brand-glyph">◈</span>
            <span>
              <strong>SYNTHIA</strong>
              <small>WITH YOU</small>
            </span>
          </button>

          <div className="top-status">
            <span className="status-dot" />
            <small>{busy ? "processing" : "online"}</small>
          </div>
        </header>

        <main className="viewport">{content}</main>

        <BottomNav screen={state.screen} dispatch={dispatch} />
      </div>
    </div>
  );
}

export {
  GLYPHS,
  RESONANCE_SEQUENCES,
  LAYERS,
  SynthiaRoutingEngine,
  SynthiaMemoryService,
  PracticalInterferenceScanner,
  PrivateGatePatternMap
};

const STYLES = `
  :root {
    --sy-bg: #070914;
    --sy-panel: rgba(15, 18, 38, 0.82);
    --sy-panel-2: rgba(20, 24, 48, 0.9);
    --sy-line: rgba(132, 117, 255, 0.22);
    --sy-text: #f5f6ff;
    --sy-muted: #9ca4c7;
    --sy-violet: #9a73ff;
    --sy-pink: #ff65ca;
    --sy-cyan: #59e7f2;
    --sy-green: #73efbd;
    --sy-orange: #ffbf6b;
    --sy-danger: #ff6f91;
  }

  * { box-sizing: border-box; }

  .synthia-app {
    width: 100%;
    min-height: 100dvh;
    background:
      radial-gradient(circle at 50% -15%, rgba(109, 79, 255, .28), transparent 35%),
      radial-gradient(circle at 90% 20%, rgba(255, 84, 203, .10), transparent 24%),
      var(--sy-bg);
    color: var(--sy-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    display: flex;
    justify-content: center;
  }

  .phone-shell {
    width: min(100%, 480px);
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    background:
      linear-gradient(180deg, rgba(7, 9, 20, .94), rgba(7, 9, 20, .99)),
      radial-gradient(circle at 50% 8%, rgba(122, 82, 255, .12), transparent 30%);
    border-left: 1px solid rgba(255,255,255,.04);
    border-right: 1px solid rgba(255,255,255,.04);
  }

  button, textarea { font: inherit; }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .topbar {
    min-height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sy-line);
    background: rgba(7, 9, 20, .84);
    backdrop-filter: blur(18px);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .brand {
    border: 0;
    background: transparent;
    color: var(--sy-text);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
  }

  .brand-glyph {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(162, 132, 255, .55);
    border-radius: 13px;
    box-shadow: 0 0 22px rgba(124, 91, 255, .22);
    color: #c9b9ff;
    font-size: 21px;
  }

  .brand strong {
    display: block;
    letter-spacing: .24em;
    font-size: 13px;
  }

  .brand small {
    display: block;
    margin-top: 2px;
    color: var(--sy-muted);
    font-size: 8px;
    letter-spacing: .28em;
  }

  .top-status {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--sy-muted);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sy-green);
    box-shadow: 0 0 12px rgba(115, 239, 189, .65);
  }

  .viewport {
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 14px;
  }

  .screen-body {
    padding: 18px 16px 30px;
  }

  .home-screen {
    padding-top: 8px;
  }

  .eyebrow {
    display: block;
    color: #9e91d8;
    font-size: 9px;
    letter-spacing: .22em;
    text-transform: uppercase;
  }

  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 25px; line-height: 1.16; margin-bottom: 0; }
  h2 { font-size: 20px; margin: 4px 0 0; }
  h3 { font-size: 14px; color: #d9ddf5; }

  p {
    color: var(--sy-muted);
    line-height: 1.55;
    font-size: 13px;
  }

  .synthia-morph {
    --intensity: .3;
    position: relative;
    width: min(78vw, 330px);
    height: 330px;
    margin: 0 auto;
    display: grid;
    place-items: center;
    isolation: isolate;
  }

  .morph-halo {
    position: absolute;
    border-radius: 50%;
    inset: 13%;
    border: 1px solid rgba(138, 113, 255, .24);
    box-shadow:
      0 0 calc(36px * var(--intensity)) rgba(112, 79, 255, .50),
      inset 0 0 calc(48px * var(--intensity)) rgba(86, 225, 242, .18);
    animation: haloSpin 12s linear infinite;
  }

  .halo-two {
    inset: 21%;
    transform: rotate(42deg);
    border-color: rgba(255, 101, 202, .25);
    animation-duration: 9s;
    animation-direction: reverse;
  }

  .morph-body {
    width: 64%;
    height: 72%;
    border-radius: 45% 45% 48% 48% / 38% 38% 58% 58%;
    background:
      radial-gradient(circle at 40% 34%, rgba(255,255,255,.48), transparent 5%),
      radial-gradient(circle at 62% 34%, rgba(255,255,255,.45), transparent 5%),
      radial-gradient(circle at 50% 42%, rgba(89,231,242,.23), transparent 20%),
      linear-gradient(150deg,
        rgba(255,101,202,.85),
        rgba(128,91,255,.84) 42%,
        rgba(89,231,242,.75));
    box-shadow:
      0 0 calc(54px * var(--intensity)) rgba(145, 104, 255, .58),
      inset 0 -34px 75px rgba(5, 6, 20, .42);
    filter: saturate(calc(.85 + var(--intensity)));
    transition: .35s ease;
    position: relative;
    overflow: hidden;
    animation: morphBreath 4.8s ease-in-out infinite;
  }

  .morph-body::before,
  .morph-body::after {
    content: "";
    position: absolute;
    inset: -20%;
    border-radius: 43%;
    border: 1px solid rgba(255,255,255,.17);
    transform: rotate(23deg);
    animation: meshTurn 8s linear infinite;
  }

  .morph-body::after {
    inset: 4%;
    transform: rotate(-31deg);
    animation-direction: reverse;
    animation-duration: 6s;
  }

  .morph-face {
    position: absolute;
    inset: 0;
  }

  .morph-eye {
    position: absolute;
    top: 38%;
    width: 15%;
    height: 6%;
    border-radius: 999px;
    background: rgba(233, 249, 255, .94);
    box-shadow: 0 0 20px rgba(89,231,242,.95);
  }

  .morph-eye.left { left: 25%; transform: rotate(-8deg); }
  .morph-eye.right { right: 25%; transform: rotate(8deg); }

  .morph-glyph {
    position: absolute;
    top: 16%;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    text-shadow: 0 0 18px white, 0 0 26px rgba(89,231,242,.85);
    font-size: 28px;
  }

  .morph-caption {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 9px 13px;
    min-width: 150px;
    border: 1px solid var(--sy-line);
    background: rgba(8,10,24,.76);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    text-align: center;
  }

  .morph-caption strong {
    display: block;
    font-size: 13px;
  }

  .morph-caption span {
    display: block;
    margin-top: 3px;
    font-size: 10px;
    color: var(--sy-muted);
  }

  .morph-thinking .morph-body,
  .morph-scanning .morph-body,
  .morph-resonating .morph-body,
  .morph-evolving .morph-body {
    transform: scale(1.035);
  }

  .morph-resonating .morph-body {
    filter: saturate(1.5) brightness(1.12);
  }

  .morph-focused .morph-eye,
  .morph-scanning .morph-eye {
    height: 3%;
  }

  .home-copy {
    text-align: center;
    margin: -2px auto 18px;
    max-width: 340px;
  }

  .home-copy h1 {
    margin-top: 6px;
  }

  .quick-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .quick-grid button {
    min-height: 82px;
    border: 1px solid var(--sy-line);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(23,28,57,.78), rgba(10,13,29,.92));
    color: var(--sy-text);
    padding: 10px 6px;
  }

  .quick-grid span { display: block; font-size: 20px; margin-bottom: 5px; }
  .quick-grid strong { display: block; font-size: 11px; }
  .quick-grid small { display: block; color: var(--sy-muted); font-size: 8px; margin-top: 2px; }

  .home-card,
  .runtime-screen { gap: 14px; }
  .runtime-card {
    background: var(--sy-panel);
    border: 1px solid var(--sy-line);
    border-radius: 18px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .runtime-card p { margin: 0; color: var(--sy-muted); font-size: 12px; line-height: 1.45; }
  .runtime-card input[type="file"] { width: 100%; color: var(--sy-muted); font-size: 11px; }
  .runtime-name,
  .runtime-source {
    width: 100%;
    border: 1px solid var(--sy-line);
    border-radius: 12px;
    background: rgba(4, 6, 18, .72);
    color: var(--sy-text);
    padding: 10px;
    font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .runtime-source { resize: vertical; min-height: 120px; }
  .runtime-error {
    border: 1px solid rgba(255, 101, 202, .45);
    background: rgba(90, 14, 63, .25);
    border-radius: 14px;
    padding: 12px;
    color: #ffd8ef;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .runtime-result-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .runtime-result-head span { color: var(--sy-muted); font-size: 10px; }
  .runtime-result dl { display: grid; gap: 7px; margin: 0; }
  .runtime-result dl div { display: grid; grid-template-columns: 88px minmax(0,1fr); gap: 8px; }
  .runtime-result dt { color: var(--sy-muted); font-size: 10px; }
  .runtime-result dd { margin: 0; font-size: 10px; overflow-wrap: anywhere; }
  .runtime-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }
  .runtime-fields div { border: 1px solid var(--sy-line); border-radius: 10px; padding: 8px; display: grid; gap: 3px; }
  .runtime-fields small { color: var(--sy-muted); font-size: 9px; }
  .runtime-stages { display: grid; gap: 5px; }
  .runtime-stages div { display: grid; grid-template-columns: 18px 1fr; align-items: center; gap: 5px; font-size: 10px; }
  .runtime-stages .ok span { color: #7dffc1; }
  .runtime-stages .failed span { color: #ff79bc; }

  .profile-card,
  .empty-card,
  .memory-compose {
    margin-top: 12px;
    padding: 14px;
    border: 1px solid var(--sy-line);
    border-radius: 18px;
    background: var(--sy-panel);
  }

  .home-card small,
  .profile-card small {
    color: var(--sy-muted);
  }

  .home-card strong {
    display: block;
    margin-top: 3px;
  }

  .home-card p { margin: 5px 0 0; }

  .layer-strip {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    padding: 12px 0 2px;
    scrollbar-width: none;
  }

  .layer-strip::-webkit-scrollbar { display: none; }

  .layer-chip {
    min-width: 92px;
    border: 1px solid var(--sy-line);
    border-radius: 999px;
    padding: 8px 10px;
    color: #cbd0e9;
    background: rgba(14,17,36,.78);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 11px;
  }

  .layer-chip.active {
    border-color: rgba(166, 129, 255, .88);
    background: rgba(119, 80, 255, .18);
    color: white;
    box-shadow: 0 0 18px rgba(119,80,255,.14);
  }

  .layer-chip:disabled {
    opacity: .46;
  }

  .chat-screen {
    display: flex;
    flex-direction: column;
    min-height: calc(100dvh - 140px);
  }

  .chat-feed {
    flex: 1;
    padding: 12px 0;
  }

  .bubble {
    width: fit-content;
    max-width: 88%;
    margin-bottom: 10px;
    padding: 11px 13px;
    border-radius: 17px;
    font-size: 13px;
    line-height: 1.48;
  }

  .bubble small {
    display: block;
    color: #c8bbff;
    margin-bottom: 4px;
  }

  .bubble.user {
    margin-left: auto;
    background: linear-gradient(135deg, rgba(130,78,255,.78), rgba(227,84,190,.63));
  }

  .bubble.synthia {
    background: rgba(20,24,49,.88);
    border: 1px solid var(--sy-line);
  }

  .composer,
  .memory-compose {
    display: flex;
    gap: 9px;
    align-items: flex-end;
  }

  textarea {
    width: 100%;
    border: 1px solid rgba(139,127,200,.32);
    border-radius: 15px;
    background: rgba(10,13,29,.92);
    color: var(--sy-text);
    resize: none;
    outline: none;
    padding: 11px 12px;
  }

  textarea:focus {
    border-color: rgba(157,118,255,.76);
    box-shadow: 0 0 0 3px rgba(111,75,255,.08);
  }

  .composer button,
  .memory-compose button {
    width: 46px;
    height: 46px;
    flex: 0 0 auto;
    border: 0;
    border-radius: 50%;
    color: white;
    background: linear-gradient(135deg, var(--sy-violet), var(--sy-pink));
    font-size: 22px;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .ghost-btn,
  .secondary-btn,
  .primary-btn {
    border-radius: 14px;
    min-height: 42px;
    padding: 0 14px;
  }

  .ghost-btn {
    border: 1px solid var(--sy-line);
    color: #c9ccef;
    background: transparent;
  }

  .secondary-btn {
    border: 1px solid rgba(137,117,255,.42);
    color: white;
    background: rgba(104,75,255,.11);
  }

  .primary-btn {
    width: 100%;
    border: 1px solid rgba(184,136,255,.56);
    color: white;
    background: linear-gradient(135deg, rgba(117,74,255,.86), rgba(215,69,186,.84));
    box-shadow: 0 0 24px rgba(119,72,255,.16);
  }

  .primary-btn:disabled { opacity: .45; }

  .glyph-entry {
    min-height: 70px;
    display: flex;
    align-items: center;
    padding: 14px;
    border-radius: 17px;
    border: 1px solid rgba(126,108,255,.4);
    background: rgba(15,17,38,.9);
    font-size: 25px;
    letter-spacing: .08em;
    overflow-wrap: anywhere;
  }

  .glyph-entry span {
    color: var(--sy-muted);
    font-size: 12px;
    letter-spacing: normal;
  }

  .glyph-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin: 12px 0;
  }

  .glyph-grid button {
    aspect-ratio: 1;
    border-radius: 14px;
    border: 1px solid var(--sy-line);
    background: rgba(18,22,46,.9);
    color: #d7d2ff;
    font-size: 22px;
    text-shadow: 0 0 10px rgba(160,128,255,.7);
  }

  .glyph-grid button:active {
    transform: scale(.94);
    border-color: rgba(255,101,202,.68);
  }

  .resonance-card {
    margin-top: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-radius: 15px;
    border: 1px solid rgba(255,101,202,.45);
    background: rgba(121,38,108,.22);
  }

  .resonance-card strong,
  .resonance-card small {
    display: block;
  }

  .resonance-card small { color: var(--sy-muted); margin-top: 2px; }

  .sequence-list {
    margin-top: 14px;
    display: grid;
    gap: 7px;
  }

  .sequence-list > div {
    display: flex;
    justify-content: space-between;
    padding: 9px 10px;
    border-bottom: 1px solid rgba(255,255,255,.05);
  }

  .sequence-list small { color: var(--sy-muted); }

  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    border-radius: 14px;
    background: rgba(16,19,39,.88);
    border: 1px solid var(--sy-line);
    margin-bottom: 14px;
  }

  .segmented button {
    min-height: 36px;
    border: 0;
    border-radius: 10px;
    color: var(--sy-muted);
    background: transparent;
  }

  .segmented button.active {
    color: white;
    background: rgba(111,75,255,.26);
  }

  .stack {
    display: grid;
    gap: 10px;
  }

  .assignment-card,
  .alert-card,
  .memory-card,
  .layer-detail,
  .diagnostic-hero {
    border: 1px solid var(--sy-line);
    border-radius: 18px;
    background: var(--sy-panel);
    padding: 14px;
  }

  .assignment-top {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
  }

  .assignment-top small,
  .assignment-top strong {
    display: block;
  }

  .assignment-top small {
    color: #ae9bff;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .12em;
  }

  .assignment-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: rgba(111,75,255,.15);
    border: 1px solid rgba(149,121,255,.26);
  }

  .status {
    font-size: 9px;
    color: var(--sy-muted);
    text-transform: uppercase;
  }

  .status.completed { color: var(--sy-green); }

  .assignment-card p { margin: 10px 0; }

  .progress-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .progress-track {
    height: 6px;
    flex: 1;
    border-radius: 99px;
    background: rgba(255,255,255,.08);
    overflow: hidden;
  }

  .progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--sy-cyan), var(--sy-violet), var(--sy-pink));
  }

  .assignment-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 11px;
  }

  .assignment-actions small { color: var(--sy-muted); }

  .assignment-actions button {
    border: 1px solid rgba(137,117,255,.42);
    background: rgba(104,75,255,.12);
    color: white;
    border-radius: 10px;
    padding: 7px 10px;
  }

  .diagnostic-hero {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: center;
  }

  .coherence-ring {
    width: 96px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 7px solid rgba(115,239,189,.7);
    box-shadow:
      inset 0 0 20px rgba(89,231,242,.16),
      0 0 24px rgba(89,231,242,.12);
    display: grid;
    place-items: center;
    align-content: center;
  }

  .coherence-ring strong { font-size: 23px; }
  .coherence-ring span { color: var(--sy-muted); font-size: 9px; }

  .symptom-groups {
    display: grid;
    gap: 10px;
  }

  .symptom-groups > div > small {
    color: var(--sy-muted);
    display: block;
    margin-bottom: 5px;
  }

  .symptom-groups > div > div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .symptom-groups button {
    border: 1px solid rgba(141,127,203,.25);
    border-radius: 999px;
    background: rgba(19,23,45,.8);
    color: #d0d4ec;
    padding: 7px 10px;
    font-size: 11px;
  }

  .alert-card {
    display: flex;
    gap: 10px;
    justify-content: space-between;
  }

  .alert-card small,
  .alert-card strong { display: block; }

  .alert-card small { color: var(--sy-orange); }
  .alert-card p { margin: 4px 0 0; }
  .alert-card > span { color: var(--sy-danger); font-weight: 700; }

  .memory-compose {
    margin: 0 0 12px;
  }

  .memory-card {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .memory-card small,
  .memory-card strong {
    display: block;
  }

  .memory-card small {
    color: #a99cff;
    text-transform: capitalize;
    margin-bottom: 4px;
  }

  .memory-card time {
    white-space: nowrap;
    color: var(--sy-muted);
    font-size: 9px;
  }

  .count-pill {
    min-width: 30px;
    height: 30px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(111,75,255,.16);
    border: 1px solid var(--sy-line);
  }

  .layer-detail {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: start;
    gap: 10px;
  }

  .layer-detail > span {
    font-size: 22px;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    background: rgba(111,75,255,.12);
    border-radius: 12px;
  }

  .layer-detail p {
    margin: 3px 0 0;
  }

  .layer-detail small {
    color: #a79acb;
  }

  .layer-detail b {
    color: var(--sy-green);
    font-size: 10px;
  }

  .morph-screen {
    min-height: calc(100dvh - 150px);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .morph-info {
    text-align: center;
    margin: 2px auto 18px;
    max-width: 350px;
  }

  .morph-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .morph-stats > div {
    text-align: center;
    padding: 11px 6px;
    border: 1px solid var(--sy-line);
    border-radius: 14px;
    background: var(--sy-panel);
  }

  .morph-stats strong,
  .morph-stats small {
    display: block;
  }

  .morph-stats small {
    margin-top: 3px;
    color: var(--sy-muted);
    font-size: 8px;
  }

  .bottom-nav {
    min-height: 72px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: end;
    padding: 7px 8px max(8px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--sy-line);
    background: rgba(7,9,20,.92);
    backdrop-filter: blur(18px);
    position: sticky;
    bottom: 0;
    z-index: 30;
  }

  .bottom-nav button {
    border: 0;
    background: transparent;
    color: #7f86aa;
    display: grid;
    place-items: center;
    gap: 2px;
    min-height: 48px;
  }

  .bottom-nav button > span {
    font-size: 20px;
  }

  .bottom-nav small {
    font-size: 8px;
  }

  .bottom-nav button.active {
    color: white;
  }

  .bottom-nav .morph-nav > span {
    width: 50px;
    height: 50px;
    margin-top: -18px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: white;
    font-size: 25px;
    background: radial-gradient(circle at 35% 30%, #f3e9ff, #976eff 36%, #412492 74%);
    border: 1px solid rgba(217,194,255,.8);
    box-shadow: 0 0 24px rgba(130,87,255,.45);
  }

  @keyframes morphBreath {
    0%, 100% { transform: scale(.985); }
    50% { transform: scale(1.02); }
  }

  @keyframes haloSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes meshTurn {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 360px) {
    .quick-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .synthia-morph {
      height: 285px;
    }

    .glyph-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .diagnostic-hero {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .coherence-ring {
      margin: auto;
    }
  }
`;
