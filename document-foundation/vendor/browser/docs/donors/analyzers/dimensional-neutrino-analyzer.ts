
/**
 * ============================================================================
 * DIMENSIONAL NEUTRINO RESONANCE ANALYZER
 * ============================================================================
 * Maps Boyle Nathaniel's e4nu Δ(1232) analysis through the 5D cognitive stack
 * 
 * Physics: Neutrino-nucleus scattering, W-mass resonance isolation, CLAS detector
 * Theory: Sheldon Klein's heuristics (Heuristic 5, Heuristic 2.3)
 * Architecture: D1(Impulse) → D2(Polarity) → D3(Witness) → D4(Context) → D5(Meaning)
 * 
 * @module dimensional-neutrino-analyzer
 * @version 1.0.0
 */

// ============================================================
// PHYSICAL CONSTANTS (e4nu framework)
// ============================================================

export const PHYSICS = {
  M_N: 938.272,           // Nucleon mass (MeV/c²)
  M_PI: 139.570,          // Charged pion mass (MeV/c²)
  M_DELTA: 1232.0,        // Delta(1232) resonance mass (MeV/c²)
  W_DELTA: 1232.0,        // Same as M_DELTA for W-space
  GAMMA_DELTA: 120.0,     // Delta(1232) width (MeV)

  // Interaction regime boundaries
  W_QE_MAX: 1050.0,       // Upper bound of quasi-elastic
  W_RES_MIN: 1080.0,      // Lower bound of resonance (dip region)
  W_RES_MAX: 1700.0,      // Upper bound of resonance
  W_DIS_MIN: 1700.0,      // Deep inelastic threshold

  // CLAS detector acceptance
  CLAS_THETA_MIN: 5.0,    // degrees
  CLAS_THETA_MAX: 125.0,  // degrees
  CLAS_P_MIN: 0.3,        // GeV/c
  CLAS_P_MAX: 5.0,        // GeV/c
} as const;

// ============================================================
// TYPES
// ============================================================

export type InteractionType = 'QE' | 'RES' | 'DIS' | 'UNK';
export type NuclearTarget = 'H' | 'D' | 'He' | 'C' | 'Ar' | 'Fe' | 'Sn';

export interface RawEvent {
  id: string;
  beamEnergy: number;     // GeV
  omega: number;            // Energy transfer (GeV)
  q2: number;               // Momentum transfer squared (GeV²)
  theta: number;            // Scattering angle (degrees)
  phi: number;              // Azimuthal angle (degrees)
  target: NuclearTarget;
  trueType?: InteractionType; // For validation
}

export interface D1Tensor {
  beamEnergy: number;
  omega: number;
  q2: number;
  theta: number;
  phi: number;
  wMass: number;
}

export interface D2Tensor {
  qeScore: number;
  resScore: number;
  disScore: number;
  tension: number;
  dominantType: InteractionType;
}

export interface D3Tensor {
  acceptance: number;
  confidence: number;
  observedW: number;
  wResolution: number;
}

export interface D4Tensor {
  massNumber: number;
  wShift: number;
  gammaBroadening: number;
  fermiMomentum: number;
  pauliSuppression: number;
}

export interface D5Tensor {
  attractorMass: number;
  attractorWidth: number;
  attractorStrength: number;
  semanticWeight: number;
  recursionDepth: number;
}

export interface DimensionalStack {
  eventId: string;
  d1: D1Tensor;
  d2: D2Tensor;
  d3: D3Tensor;
  d4: D4Tensor;
  d5: D5Tensor;
}

// ============================================================
// D1: IMPULSE — Raw Event Ingestion
// ============================================================

export class ImpulseEvent {
  readonly eventId: string;
  readonly beamEnergy: number;
  readonly omega: number;
  readonly q2: number;
  readonly theta: number;
  readonly phi: number;
  readonly target: NuclearTarget;
  readonly wMass: number;

  constructor(raw: RawEvent) {
    this.eventId = raw.id;
    this.beamEnergy = raw.beamEnergy;
    this.omega = raw.omega;
    this.q2 = raw.q2;
    this.theta = raw.theta;
    this.phi = raw.phi;
    this.target = raw.target;
    this.wMass = this.calculateWMass();
  }

  private calculateWMass(): number {
    /**
     * W = sqrt(M_N² + 2*M_N*omega - Q²)
     * The fundamental resonance variable — the invariant hadronic mass
     */
    const M_N = PHYSICS.M_N / 1000.0; // Convert to GeV
    const wSq = M_N ** 2 + 2 * M_N * this.omega - this.q2;
    return Math.sqrt(Math.max(wSq, 0)) * 1000.0; // Return in MeV
  }

  toD1Tensor(): D1Tensor {
    return {
      beamEnergy: this.beamEnergy,
      omega: this.omega,
      q2: this.q2,
      theta: this.theta,
      phi: this.phi,
      wMass: this.wMass,
    };
  }
}

// ============================================================
// D2: POLARITY — Interaction Type Classification (The Tension)
// ============================================================

export class PolarityField {
  readonly event: ImpulseEvent;
  readonly qeScore: number;
  readonly resScore: number;
  readonly disScore: number;
  readonly tension: number;
  readonly dominantType: InteractionType;

  constructor(event: ImpulseEvent) {
    this.event = event;

    const scores = this.classify();
    this.qeScore = scores.qeScore;
    this.resScore = scores.resScore;
    this.disScore = scores.disScore;
    this.dominantType = scores.dominantType;
    this.tension = scores.tension;
  }

  private classify(): {
    qeScore: number;
    resScore: number;
    disScore: number;
    tension: number;
    dominantType: InteractionType;
  } {
    const w = this.event.wMass;

    // Breit-Wigner resonance profile for Δ(1232)
    const breitWigner = (m: number, m0: number, gamma: number): number => {
      return (gamma / 2) / ((m - m0) ** 2 + (gamma / 2) ** 2);
    };

    // QE score: Gaussian centered at nucleon mass
    const qeWidth = 50.0;
    const qeScore = Math.exp(-((w - PHYSICS.M_N) ** 2) / (2 * qeWidth ** 2));

    // RES score: Breit-Wigner centered at Δ(1232)
    const bwPeak = breitWigner(PHYSICS.M_DELTA, PHYSICS.M_DELTA, PHYSICS.GAMMA_DELTA);
    const bwAtW = breitWigner(w, PHYSICS.M_DELTA, PHYSICS.GAMMA_DELTA);
    const resScore = bwAtW / bwPeak;

    // DIS score: Step function rising above threshold
    let disScore = 0.0;
    if (w > PHYSICS.W_DIS_MIN) {
      disScore = 1.0 - Math.exp(-(w - PHYSICS.W_DIS_MIN) / 200.0);
    }

    // Determine dominant type
    const scores = [
      { type: 'QE' as InteractionType, score: qeScore },
      { type: 'RES' as InteractionType, score: resScore },
      { type: 'DIS' as InteractionType, score: disScore },
    ];
    const dominant = scores.reduce((a, b) => (a.score > b.score ? a : b));

    // Tension: how contested is the classification?
    const sortedScores = scores.map((s) => s.score).sort((a, b) => b - a);
    const tension = 1.0 - (sortedScores[0] - sortedScores[1]) / (sortedScores[0] + 1e-10);

    return { qeScore, resScore, disScore, tension, dominantType: dominant.type };
  }

  toD2Tensor(): D2Tensor {
    return {
      qeScore: this.qeScore,
      resScore: this.resScore,
      disScore: this.disScore,
      tension: this.tension,
      dominantType: this.dominantType,
    };
  }
}

// ============================================================
// D3: WITNESS — Detector as Observer-Node
// ============================================================

export class WitnessObservation {
  readonly event: ImpulseEvent;
  readonly polarity: PolarityField;
  readonly acceptance: number;
  readonly confidence: number;
  readonly observedW: number;
  readonly wResolution: number;

  constructor(event: ImpulseEvent, polarity: PolarityField) {
    this.event = event;
    this.polarity = polarity;
    this.wResolution = 15.0; // CLAS energy resolution (MeV)
    this.acceptance = this.computeAcceptance();
    this.confidence = this.acceptance * (1.0 - polarity.tension);
    this.observedW = this.smearObservation();
  }

  private computeAcceptance(): number {
    const theta = this.event.theta;

    // Angular acceptance
    let thetaAccept = 0.0;
    if (PHYSICS.CLAS_THETA_MIN <= theta && theta <= PHYSICS.CLAS_THETA_MAX) {
      thetaAccept = 1.0;
    }

    // Momentum acceptance (approximate)
    const pApprox = Math.sqrt(
      this.event.q2 + (this.event.wMass / 1000.0) ** 2
    );
    let pAccept = 0.0;
    if (PHYSICS.CLAS_P_MIN <= pApprox && pApprox <= PHYSICS.CLAS_P_MAX) {
      pAccept = 1.0;
    } else {
      pAccept = Math.exp(-((pApprox - PHYSICS.CLAS_P_MAX) / 1.0) ** 2);
    }

    // Target-dependent efficiency
    const targetEff: Record<NuclearTarget, number> = {
      H: 1.0, D: 0.95, He: 0.90, C: 0.85,
      Ar: 0.80, Fe: 0.75, Sn: 0.70,
    };
    const efficiency = targetEff[this.event.target] ?? 0.85;

    return thetaAccept * pAccept * efficiency;
  }

  private smearObservation(): number {
    // Gaussian smearing by detector resolution
    const smear = this.gaussianRandom(0, this.wResolution);
    return this.event.wMass + smear;
  }

  private gaussianRandom(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * std;
  }

  toD3Tensor(): D3Tensor {
    return {
      acceptance: this.acceptance,
      confidence: this.confidence,
      observedW: this.observedW,
      wResolution: this.wResolution,
    };
  }
}

// ============================================================
// D4: CONTEXT — Nuclear Target Embedding
// ============================================================

export class ContextEmbedding {
  readonly event: ImpulseEvent;
  readonly wShift: number;
  readonly gammaBroadening: number;
  readonly fermiMomentum: number;
  readonly pauliSuppression: number;
  readonly contextVector: number[];

  constructor(event: ImpulseEvent) {
    this.event = event;
    const params = this.getNuclearParams(event.target);
    this.wShift = params.wShift;
    this.gammaBroadening = params.gammaAdd;
    this.fermiMomentum = params.fermi;
    this.pauliSuppression = params.pauli;
    this.contextVector = this.buildContextVector();
  }

  private getNuclearParams(target: NuclearTarget): {
    wShift: number;
    gammaAdd: number;
    fermi: number;
    pauli: number;
  } {
    const params: Record<NuclearTarget, { wShift: number; gammaAdd: number; fermi: number; pauli: number }> = {
      H:  { wShift: 0.0,   gammaAdd: 0.0,  fermi: 0.0,   pauli: 0.0 },
      D:  { wShift: -5.0,  gammaAdd: 10.0, fermi: 50.0,  pauli: 0.05 },
      He: { wShift: -15.0, gammaAdd: 25.0, fermi: 150.0, pauli: 0.15 },
      C:  { wShift: -25.0, gammaAdd: 40.0, fermi: 221.0, pauli: 0.25 },
      Ar: { wShift: -35.0, gammaAdd: 55.0, fermi: 250.0, pauli: 0.35 },
      Fe: { wShift: -40.0, gammaAdd: 65.0, fermi: 260.0, pauli: 0.40 },
      Sn: { wShift: -45.0, gammaAdd: 75.0, fermi: 270.0, pauli: 0.45 },
    };
    return params[target] ?? params.C;
  }

  private buildContextVector(): number[] {
    const massNumbers: Record<NuclearTarget, number> = {
      H: 1, D: 2, He: 4, C: 12, Ar: 40, Fe: 56, Sn: 120,
    };
    const A = massNumbers[this.event.target] ?? 12;
    return [A, this.wShift, this.gammaBroadening, this.fermiMomentum, this.pauliSuppression];
  }

  applyToW(w: number): number {
    return w + this.wShift;
  }

  toD4Tensor(): D4Tensor {
    return {
      massNumber: this.contextVector[0],
      wShift: this.wShift,
      gammaBroadening: this.gammaBroadening,
      fermiMomentum: this.fermiMomentum,
      pauliSuppression: this.pauliSuppression,
    };
  }
}

// ============================================================
// D5: MEANING — Resonance Attractor Crystallization
// ============================================================

export class AttractorCrystal {
  readonly event: ImpulseEvent;
  readonly polarity: PolarityField;
  readonly witness: WitnessObservation;
  readonly context: ContextEmbedding;
  readonly attractorMass: number;
  readonly attractorWidth: number;
  readonly attractorStrength: number;
  readonly semanticWeight: number;
  recursionDepth: number;

  constructor(
    event: ImpulseEvent,
    polarity: PolarityField,
    witness: WitnessObservation,
    context: ContextEmbedding
  ) {
    this.event = event;
    this.polarity = polarity;
    this.witness = witness;
    this.context = context;
    this.recursionDepth = 0;

    this.attractorMass = this.crystallizeMass();
    this.attractorWidth = this.crystallizeWidth();
    this.attractorStrength = this.crystallizeStrength();
    this.semanticWeight = this.computeSemanticWeight();
  }

  private crystallizeMass(): number {
    return this.context.applyToW(PHYSICS.M_DELTA);
  }

  private crystallizeWidth(): number {
    return PHYSICS.GAMMA_DELTA + this.context.gammaBroadening;
  }

  private crystallizeStrength(): number {
    const wObs = this.witness.observedW;
    const distance = Math.abs(wObs - this.attractorMass);
    // Gravitational well: strength = 1 / (1 + distance²/width²)
    return 1.0 / (1.0 + (distance / this.attractorWidth) ** 2);
  }

  private computeSemanticWeight(): number {
    const resAlignment = this.polarity.resScore;
    return (
      resAlignment *
      this.witness.confidence *
      this.attractorStrength *
      (1.0 - this.context.pauliSuppression)
    );
  }

  deepenRecursion(): void {
    this.recursionDepth++;
    // Strengthen attractor based on accumulated meaning
    // Note: attractorStrength is readonly in TS, this is conceptual
  }

  toD5Tensor(): D5Tensor {
    return {
      attractorMass: this.attractorMass,
      attractorWidth: this.attractorWidth,
      attractorStrength: this.attractorStrength,
      semanticWeight: this.semanticWeight,
      recursionDepth: this.recursionDepth,
    };
  }
}

// ============================================================
// KLEIN HEURISTICS
// ============================================================

export interface OptimalCut {
  wMin: number;
  wMax: number;
  purity: number;
  eventsInWindow: number;
  resEvents: number;
  heuristic: string;
}

export interface BilingualPrediction {
  wElectron: number;
  wNeutrino: number;
  q2: number;
  q4Weight: number;
  resonanceStrength: number;
  target: NuclearTarget;
  contextShift: number;
}

export class KleinHeuristics {
  /**
   * Heuristic 5: When a general rule is rejected by data, restrict it
   * to the context where it was first valid.
   * 
   * Applied: Find optimal W cut that maximizes RES purity while
   * minimizing QE and DIS contamination.
   */
  static heuristic5OptimalWCut(
    events: AttractorCrystal[],
    targetPurity: number = 0.85
  ): OptimalCut {
    let bestWindow: [number, number] = [0, 0];
    let bestFOM = 0;

    const wMinRange = Array.from({ length: 50 }, (_, i) => 1050 + i * 2);
    const wMaxRange = Array.from({ length: 50 }, (_, i) => 1300 + i * 6);

    for (const wMin of wMinRange) {
      for (const wMax of wMaxRange) {
        if (wMax <= wMin) continue;

        const windowEvents = events.filter(
          (e) => e.witness.observedW >= wMin && e.witness.observedW <= wMax
        );

        if (windowEvents.length < 10) continue;

        const resCount = windowEvents.filter(
          (e) => e.polarity.dominantType === 'RES'
        ).length;
        const purity = resCount / windowEvents.length;

        const allRes = events.filter((e) => e.polarity.dominantType === 'RES').length;
        const efficiency = resCount / Math.max(allRes, 1);

        if (purity >= targetPurity) {
          const fom = purity * efficiency;
          if (fom > bestFOM) {
            bestFOM = fom;
            bestWindow = [wMin, wMax];
          }
        }
      }
    }

    const [wMin, wMax] = bestWindow;
    const windowEvents = events.filter(
      (e) => e.witness.observedW >= wMin && e.witness.observedW <= wMax
    );
    const resCount = windowEvents.filter(
      (e) => e.polarity.dominantType === 'RES'
    ).length;

    return {
      wMin,
      wMax,
      purity: resCount / windowEvents.length,
      eventsInWindow: windowEvents.length,
      resEvents: resCount,
      heuristic: 'Klein_5_restrict_to_valid_context',
    };
  }

  /**
   * Heuristic 2.3: Bilingual transformation.
   * Electron scattering → Neutrino prediction by Q⁴ reweighting.
   * Two languages sharing the same nuclear grammar.
   */
  static heuristic23BilingualTransform(
    events: AttractorCrystal[],
    q4Weight: number = 1.0
  ): BilingualPrediction[] {
    return events.map((event) => {
      const q2 = event.event.q2;
      const weight = q2 ** 2 * q4Weight;
      const wNeutrino = event.context.applyToW(event.witness.observedW);

      return {
        wElectron: event.witness.observedW,
        wNeutrino,
        q2,
        q4Weight: weight,
        resonanceStrength: event.attractorStrength * weight,
        target: event.event.target,
        contextShift: event.context.wShift,
      };
    });
  }
}

// ============================================================
// UNIVERSAL ENGINE: 5D ORCHESTRATOR
// ============================================================

export interface AttractorField {
  wValues: number[];
  targetFields: Record<string, number[]>;
  manifoldEquation: string;
  note: string;
}

export interface RecursionState {
  recursion: number;
  eventCount: number;
  meanAttractorStrength: number;
  meanSemanticWeight: number;
}

export class DimensionalNeutrinoEngine {
  private events: AttractorCrystal[] = [];
  private attractorHistory: RecursionState[] = [];
  private recursionCount = 0;

  /**
   * D1: Ingest raw MC events as impulses.
   * Each event is a "speaker" in Klein's speech community.
   */
  ingest(rawEvents: RawEvent[]): AttractorCrystal[] {
    this.events = rawEvents.map((raw) => {
      const impulse = new ImpulseEvent(raw);
      const polarity = new PolarityField(impulse);
      const witness = new WitnessObservation(impulse, polarity);
      const context = new ContextEmbedding(impulse);
      return new AttractorCrystal(impulse, polarity, witness, context);
    });

    return this.events;
  }

  /**
   * Apply Klein Heuristic 5: Optimal W cut
   */
  findOptimalCut(targetPurity: number = 0.85): OptimalCut {
    return KleinHeuristics.heuristic5OptimalWCut(this.events, targetPurity);
  }

  /**
   * Apply Klein Heuristic 2.3: Bilingual transform
   */
  bilingualTransform(q4Weight: number = 1.0): BilingualPrediction[] {
    return KleinHeuristics.heuristic23BilingualTransform(this.events, q4Weight);
  }

  /**
   * Compute the attractor field across W-space.
   * The Δ(1232) creates the manifold through its gravitational field.
   * M(x) = Σᵢ gᵢ / (1 + |x - aᵢ|)
   */
  computeAttractorField(): AttractorField {
    const wValues = Array.from({ length: 200 }, (_, i) => 900 + i * 5.5);
    const targets: NuclearTarget[] = ['H', 'C', 'Fe', 'Sn'];
    const targetFields: Record<string, number[]> = {};

    for (const target of targets) {
      const field = wValues.map((w) => {
        let strength = 0.0;
        for (const e of this.events) {
          if (e.event.target === target) {
            const dist = Math.abs(w - e.attractorMass);
            strength += e.attractorStrength / (1.0 + dist / 100.0);
          }
        }
        return strength;
      });
      targetFields[target] = field;
    }

    return {
      wValues,
      targetFields,
      manifoldEquation: 'M(x) = Σᵢ gᵢ / (1 + |x - aᵢ|)',
      note: 'Attractor geometry generates the embedding space',
    };
  }

  /**
   * Recursion: the attractor field evolves with each pass.
   * Each recursion deepens the crystallization of the resonance.
   */
  recurse(): this {
    this.recursionCount++;

    for (const event of this.events) {
      event.recursionDepth = this.recursionCount;
      // Conceptual: strengthen based on accumulated meaning
    }

    const strengths = this.events.map((e) => e.attractorStrength);
    const weights = this.events.map((e) => e.semanticWeight);

    this.attractorHistory.push({
      recursion: this.recursionCount,
      eventCount: this.events.length,
      meanAttractorStrength: strengths.reduce((a, b) => a + b, 0) / strengths.length,
      meanSemanticWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
    });

    return this;
  }

  /**
   * Export the full 5D dimensional stack for each event.
   */
  exportDimensionalStack(): {
    recursionCount: number;
    totalEvents: number;
    dimensionalStack: DimensionalStack[];
  } {
    const stack = this.events.map((e) => ({
      eventId: e.event.eventId,
      d1: e.event.toD1Tensor(),
      d2: e.polarity.toD2Tensor(),
      d3: e.witness.toD3Tensor(),
      d4: e.context.toD4Tensor(),
      d5: e.toD5Tensor(),
    }));

    return {
      recursionCount: this.recursionCount,
      totalEvents: this.events.length,
      dimensionalStack: stack,
    };
  }

  getEvents(): AttractorCrystal[] {
    return this.events;
  }

  getRecursionCount(): number {
    return this.recursionCount;
  }

  getAttractorHistory(): RecursionState[] {
    return this.attractorHistory;
  }
}

// ============================================================
// MONTE CARLO EVENT GENERATOR
// ============================================================

export class MonteCarloGenerator {
  /**
   * Generate simulated neutrino events for Δ(1232) analysis.
   * Simulates the MC that Boyle Nathaniel's code processes.
   */
  static generateEvents(
    nEvents: number = 1000,
    target: NuclearTarget = 'C',
    beamEnergy: number = 2.0
  ): RawEvent[] {
    const events: RawEvent[] = [];
    const typeWeights = { QE: 0.30, RES: 0.45, DIS: 0.25 };

    for (let i = 0; i < nEvents; i++) {
      const r = Math.random();
      let interaction: InteractionType;
      if (r < typeWeights.QE) {
        interaction = 'QE';
      } else if (r < typeWeights.QE + typeWeights.RES) {
        interaction = 'RES';
      } else {
        interaction = 'DIS';
      }

      let w: number, q2: number, omega: number;

      if (interaction === 'QE') {
        w = gaussianRandom(PHYSICS.M_N, 30.0);
        q2 = randomRange(0.05, 0.5);
        omega = (w ** 2 - PHYSICS.M_N ** 2 + q2 * 1e6) / (2 * PHYSICS.M_N) / 1000.0;
      } else if (interaction === 'RES') {
        w = gaussianRandom(PHYSICS.M_DELTA, 60.0);
        q2 = randomRange(0.1, 1.0);
        omega = (w ** 2 - PHYSICS.M_N ** 2 + q2 * 1e6) / (2 * PHYSICS.M_N) / 1000.0;
      } else {
        w = randomRange(PHYSICS.W_DIS_MIN, 2500.0);
        q2 = randomRange(0.5, 3.0);
        omega = (w ** 2 - PHYSICS.M_N ** 2 + q2 * 1e6) / (2 * PHYSICS.M_N) / 1000.0;
      }

      omega = Math.max(omega, 0.1);

      events.push({
        id: `${target}_${interaction}_${i.toString().padStart(4, '0')}`,
        beamEnergy,
        omega,
        q2,
        theta: randomRange(5.0, 125.0),
        phi: randomRange(0.0, 360.0),
        target,
        trueType: interaction,
      });
    }

    return events;
  }
}

// Helper functions
function gaussianRandom(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * std;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ============================================================
// EXPORT
// ============================================================

export {
  PHYSICS,
};

export default DimensionalNeutrinoEngine;
