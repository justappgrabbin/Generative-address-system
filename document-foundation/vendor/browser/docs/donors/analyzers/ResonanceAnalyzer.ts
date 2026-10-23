// ============================================================================
// ResonanceAnalyzer.ts -- Semantic Resonance Detection & Optimal Cut Engine
// ============================================================================
// Implements the methodology from Boyle's neutrino physics project:
// 1. Generate events (semantic particles)
// 2. Compute feature for each (attractor gravity / interaction strength)
// 3. Histogram the distribution
// 4. Find peaks (stable resonances)
// 5. Cut around peaks (isolate signal from background)
// 6. Validate (map to body pose / center activation)
//
// Applied to semantic fields: finds stable meaning-clusters (resonances)
// vs unstable noise (background), computes optimal thresholds.
// ============================================================================

import {
  SemanticField,
  SemanticParticle,
  FieldInteraction,
  computeAttractorGravity,
  euclideanDistance,
  CONSTANTS,
  clamp,
} from './FieldPhysics';

// ----------------------------------------------------------------------------
// TYPES -- Resonance analysis data structures
// ----------------------------------------------------------------------------

/** A histogram bin for distribution analysis */
export interface HistogramBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  particles: string[];  // particle IDs in this bin
  cumulativeCount: number;
  density: number;       // count / bin width (normalized)
}

/** A detected peak in the distribution = a stable semantic resonance */
export interface SemanticResonance {
  id: string;
  centerGravity: number;    // Peak center (the "mass" of this resonance)
  width: number;            // Standard deviation / FWHM of the peak
  strength: number;         // Peak height / area (how many particles)
  purity: number;           // Signal / (signal + background) at peak
  particles: string[];      // IDs of particles in this resonance
  binIndices: number[];     // Which histogram bins form this peak
  // Physics-inspired quality metrics
  signalToNoise: number;    // Peak height / background level
  significance: number;     // Statistical significance of the peak
  stability: number;        // How stable across field evolution
}

/** Background model for the distribution */
export interface BackgroundModel {
  type: 'polynomial' | 'exponential' | 'power-law';
  coefficients: number[];
  chi2: number;             // Goodness of fit
  ndf: number;              // Number of degrees of freedom
  // Evaluated at bin centers
  values: number[];
}

/** Complete analysis result for a field state */
export interface ResonanceAnalysis {
  timestamp: number;
  histogram: HistogramBin[];
  resonances: SemanticResonance[];
  background: BackgroundModel;
  optimalCuts: OptimalCut[];
  fieldMetrics: FieldResonanceMetrics;
}

/** An optimal threshold for signal isolation */
export interface OptimalCut {
  resonanceId: string;
  lowerBound: number;
  upperBound: number;
  efficiency: number;       // Fraction of signal kept
  purity: number;           // Fraction of kept events that are signal
  significance: number;     // S / sqrt(S + B)
  figureOfMerit: number;    // Optimization metric
  method: 'sensitivity' | 'purity' | 'efficiency' | 'custom';
}

/** High-level field resonance metrics */
export interface FieldResonanceMetrics {
  totalParticles: number;
  totalResonances: number;
  meanGravity: number;
  gravityVariance: number;
  skewness: number;         // Asymmetry of distribution
  kurtosis: number;         // "Tailedness" of distribution
  coherenceIndex: number; // 0-1: how dominated by resonances vs background
  dominantResonance: string | null;
  backgroundFraction: number;
  signalFraction: number;
}

// ----------------------------------------------------------------------------
// PURE FUNCTIONS -- Distribution analysis
// ----------------------------------------------------------------------------

/**
 * Compute the attractor gravity for each particle in the field.
 * This is the "feature" we histogram, analogous to W mass in physics.
 */
export function computeParticleGravities(field: SemanticField): Map<string, number> {
  const gravities = new Map<string, number>();
  for (const particle of field.particles) {
    const gravity = computeAttractorGravity(particle.state.position, field.attractors);
    gravities.set(particle.id, gravity);
  }
  return gravities;
}

/**
 * Compute interaction strength for each particle (alternative feature).
 * Average resonance with all other particles.
 */
export function computeParticleInteractionStrengths(field: SemanticField): Map<string, number> {
  const strengths = new Map<string, number>();

  for (const particle of field.particles) {
    let totalStrength = 0;
    let count = 0;

    for (const [key, interaction] of field.interactions) {
      if (key.includes(particle.id)) {
        totalStrength += interaction.composite;
        count++;
      }
    }

    strengths.set(particle.id, count > 0 ? totalStrength / count : 0);
  }

  return strengths;
}

/**
 * Build a histogram from a set of values.
 * Uses Freedman-Diaconis rule for optimal bin width.
 */
export function buildHistogram(
  values: number[],
  ids: string[],
  binCount?: number
): HistogramBin[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    // All values identical - single bin
    return [{
      lowerBound: min - 0.5,
      upperBound: max + 0.5,
      count: values.length,
      particles: [...ids],
      cumulativeCount: values.length,
      density: values.length,
    }];
  }

  // Freedman-Diaconis rule: bin width = 2 * IQR / n^(1/3)
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const fdWidth = 2 * iqr / Math.pow(values.length, 1 / 3);

  const nBins = binCount || Math.max(10, Math.ceil(range / (fdWidth || range / 20)));
  const binWidth = range / nBins;

  const bins: HistogramBin[] = [];
  let cumulative = 0;

  for (let i = 0; i < nBins; i++) {
    const lower = min + i * binWidth;
    const upper = min + (i + 1) * binWidth;

    const binParticles: string[] = [];
    let count = 0;

    for (let j = 0; j < values.length; j++) {
      if (values[j] >= lower && values[j] < upper) {
        count++;
        binParticles.push(ids[j]);
      }
    }

    // Include max in last bin
    if (i === nBins - 1) {
      for (let j = 0; j < values.length; j++) {
        if (values[j] === max && !binParticles.includes(ids[j])) {
          count++;
          binParticles.push(ids[j]);
        }
      }
    }

    cumulative += count;

    bins.push({
      lowerBound: lower,
      upperBound: upper,
      count,
      particles: binParticles,
      cumulativeCount: cumulative,
      density: count / (binWidth || 1),
    });
  }

  return bins;
}

/**
 * Fit a background model to the histogram.
 * Uses polynomial fit (degree 2-4) to model the smooth background.
 */
export function fitBackground(
  histogram: HistogramBin[],
  degree: number = 3
): BackgroundModel {
  if (histogram.length < degree + 1) {
    return {
      type: 'polynomial',
      coefficients: [0],
      chi2: 0,
      ndf: 0,
      values: histogram.map(() => 0),
    };
  }

  // Use bin centers as x values
  const x = histogram.map(b => (b.lowerBound + b.upperBound) / 2);
  const y = histogram.map(b => b.density);
  const n = x.length;

  // Build Vandermonde matrix for polynomial fit
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= degree; j++) {
      row.push(Math.pow(x[i], j));
    }
    matrix.push(row);
  }

  // Solve least squares: (A^T A)^-1 A^T y
  const coefficients = solveLeastSquares(matrix, y);

  // Evaluate fit
  const values = x.map(xi => 
    coefficients.reduce((sum, c, i) => sum + c * Math.pow(xi, i), 0)
  );

  // Compute chi2
  let chi2 = 0;
  for (let i = 0; i < n; i++) {
    const error = y[i] > 0 ? Math.sqrt(y[i]) : 1;  // Poisson error
    chi2 += Math.pow((y[i] - values[i]) / error, 2);
  }

  return {
    type: 'polynomial',
    coefficients,
    chi2,
    ndf: n - degree - 1,
    values,
  };
}

/**
 * Solve least squares using normal equations.
 * Returns coefficients for polynomial fit.
 */
function solveLeastSquares(A: number[][], y: number[]): number[] {
  const n = A.length;
  const m = A[0].length;

  // Compute A^T A
  const ATA: number[][] = [];
  for (let i = 0; i < m; i++) {
    ATA[i] = [];
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[k][i] * A[k][j];
      }
      ATA[i][j] = sum;
    }
  }

  // Compute A^T y
  const ATy: number[] = [];
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += A[k][i] * y[k];
    }
    ATy[i] = sum;
  }

  // Solve using Gaussian elimination with partial pivoting
  return gaussianElimination(ATA, ATy);
}

/**
 * Gaussian elimination for solving linear systems.
 */
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Elimination
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const solution: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    solution[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      solution[i] -= augmented[i][j] * solution[j];
    }
    solution[i] /= augmented[i][i];
  }

  return solution;
}

// ----------------------------------------------------------------------------
// PEAK FINDING -- Detect semantic resonances
// ----------------------------------------------------------------------------

/**
 * Find peaks in the histogram using background-subtracted data.
 * A peak = consecutive bins where (data - background) > threshold.
 */
export function findPeaks(
  histogram: HistogramBin[],
  background: BackgroundModel,
  thresholdSigma: number = 2.0,
  minBins: number = 2
): SemanticResonance[] {
  const resonances: SemanticResonance[] = [];
  let currentPeak: { bins: number[]; excess: number[] } | null = null;

  for (let i = 0; i < histogram.length; i++) {
    const excess = histogram[i].density - background.values[i];
    const error = Math.sqrt(Math.max(histogram[i].density, 1));
    const significance = excess / error;

    if (significance > thresholdSigma) {
      if (!currentPeak) {
        currentPeak = { bins: [], excess: [] };
      }
      currentPeak.bins.push(i);
      currentPeak.excess.push(excess);
    } else {
      if (currentPeak && currentPeak.bins.length >= minBins) {
        resonances.push(buildResonance(currentPeak, histogram, background));
      }
      currentPeak = null;
    }
  }

  // Handle peak at end
  if (currentPeak && currentPeak.bins.length >= minBins) {
    resonances.push(buildResonance(currentPeak, histogram, background));
  }

  return resonances;
}

/**
 * Build a SemanticResonance from a set of peak bins.
 */
function buildResonance(
  peak: { bins: number[]; excess: number[] },
  histogram: HistogramBin[],
  background: BackgroundModel
): SemanticResonance {
  const binIndices = peak.bins;

  // Collect all particles in peak bins
  const allParticles: string[] = [];
  for (const idx of binIndices) {
    allParticles.push(...histogram[idx].particles);
  }

  // Compute center gravity (weighted mean of bin centers)
  let totalWeight = 0;
  let weightedSum = 0;
  for (const idx of binIndices) {
    const bin = histogram[idx];
    const center = (bin.lowerBound + bin.upperBound) / 2;
    const weight = bin.density;
    weightedSum += center * weight;
    totalWeight += weight;
  }
  const centerGravity = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Compute width (standard deviation of bin centers)
  let varianceSum = 0;
  for (const idx of binIndices) {
    const bin = histogram[idx];
    const center = (bin.lowerBound + bin.upperBound) / 2;
    const weight = bin.density;
    varianceSum += weight * Math.pow(center - centerGravity, 2);
  }
  const width = totalWeight > 0 ? Math.sqrt(varianceSum / totalWeight) : 0;

  // Strength = total excess above background
  const strength = peak.excess.reduce((sum, e) => sum + e, 0);

  // Purity = signal / (signal + background)
  let signal = 0;
  let bg = 0;
  for (const idx of binIndices) {
    signal += Math.max(0, histogram[idx].density - background.values[idx]);
    bg += background.values[idx];
  }
  const purity = (signal + bg) > 0 ? signal / (signal + bg) : 0;

  // Signal-to-noise
  const peakHeight = Math.max(...peak.excess);
  const avgBg = binIndices.reduce((sum, idx) => sum + background.values[idx], 0) / binIndices.length;
  const signalToNoise = avgBg > 0 ? peakHeight / avgBg : 0;

  // Significance = S / sqrt(S + B)
  const significance = (signal + bg) > 0 ? signal / Math.sqrt(signal + bg) : 0;

  return {
    id: `resonance_${centerGravity.toFixed(3)}_${width.toFixed(3)}`,
    centerGravity,
    width,
    strength,
    purity,
    particles: [...new Set(allParticles)],
    binIndices,
    signalToNoise,
    significance,
    stability: 0,  // Computed later from field history
  };
}

// ----------------------------------------------------------------------------
// OPTIMAL CUTS -- Signal isolation thresholds
// ----------------------------------------------------------------------------

/**
 * Compute optimal cuts for each detected resonance.
 * Multiple optimization methods available.
 */
export function computeOptimalCuts(
  histogram: HistogramBin[],
  resonances: SemanticResonance[],
  background: BackgroundModel
): OptimalCut[] {
  const cuts: OptimalCut[] = [];

  for (const resonance of resonances) {
    // Method 1: Maximize significance (S / sqrt(S + B))
    const sigCut = optimizeCut(
      histogram, resonance, background, 'sensitivity'
    );
    cuts.push(sigCut);

    // Method 2: Maximize purity
    const purityCut = optimizeCut(
      histogram, resonance, background, 'purity'
    );
    cuts.push(purityCut);

    // Method 3: Maximize efficiency (keep all signal)
    const effCut = optimizeCut(
      histogram, resonance, background, 'efficiency'
    );
    cuts.push(effCut);
  }

  return cuts;
}

/**
 * Optimize a single cut for a resonance using specified method.
 */
function optimizeCut(
  histogram: HistogramBin[],
  resonance: SemanticResonance,
  background: BackgroundModel,
  method: 'sensitivity' | 'purity' | 'efficiency' | 'custom'
): OptimalCut {
  const peakBins = resonance.binIndices;
  if (peakBins.length === 0) {
    return {
      resonanceId: resonance.id,
      lowerBound: 0,
      upperBound: 0,
      efficiency: 0,
      purity: 0,
      significance: 0,
      figureOfMerit: 0,
      method,
    };
  }

  // Start with the resonance's natural bounds
  let lowerIdx = Math.min(...peakBins);
  let upperIdx = Math.max(...peakBins);

  // Expand to find optimal boundary
  const maxExpand = 3;  // Expand by up to 3 bins on each side
  let bestFOM = -1;
  let bestLower = lowerIdx;
  let bestUpper = upperIdx;

  for (let l = Math.max(0, lowerIdx - maxExpand); l <= lowerIdx; l++) {
    for (let u = upperIdx; u <= Math.min(histogram.length - 1, upperIdx + maxExpand); u++) {
      const signal = computeSignalInRange(histogram, background, l, u, resonance);
      const bg = computeBackgroundInRange(histogram, background, l, u);
      const totalSignal = resonance.strength;

      const efficiency = totalSignal > 0 ? signal / totalSignal : 0;
      const purity = (signal + bg) > 0 ? signal / (signal + bg) : 0;
      const significance = (signal + bg) > 0 ? signal / Math.sqrt(signal + bg) : 0;

      let fom = 0;
      switch (method) {
        case 'sensitivity':
          fom = significance;
          break;
        case 'purity':
          fom = purity;
          break;
        case 'efficiency':
          fom = efficiency;
          break;
        default:
          fom = significance * purity;  // Combined
      }

      if (fom > bestFOM) {
        bestFOM = fom;
        bestLower = l;
        bestUpper = u;
      }
    }
  }

  const lowerBound = histogram[bestLower].lowerBound;
  const upperBound = histogram[bestUpper].upperBound;

  const finalSignal = computeSignalInRange(histogram, background, bestLower, bestUpper, resonance);
  const finalBg = computeBackgroundInRange(histogram, background, bestLower, bestUpper);
  const totalSignal = resonance.strength;

  const efficiency = totalSignal > 0 ? finalSignal / totalSignal : 0;
  const purity = (finalSignal + finalBg) > 0 ? finalSignal / (finalSignal + finalBg) : 0;
  const significance = (finalSignal + finalBg) > 0 ? finalSignal / Math.sqrt(finalSignal + finalBg) : 0;

  return {
    resonanceId: resonance.id,
    lowerBound,
    upperBound,
    efficiency,
    purity,
    significance,
    figureOfMerit: bestFOM,
    method,
  };
}

/**
 * Compute signal in a bin range (data - background, only positive excess).
 */
function computeSignalInRange(
  histogram: HistogramBin[],
  background: BackgroundModel,
  lowerIdx: number,
  upperIdx: number,
  resonance: SemanticResonance
): number {
  let signal = 0;
  for (let i = lowerIdx; i <= upperIdx; i++) {
    const excess = histogram[i].density - background.values[i];
    if (excess > 0) signal += excess;
  }
  return signal;
}

/**
 * Compute background in a bin range.
 */
function computeBackgroundInRange(
  histogram: HistogramBin[],
  background: BackgroundModel,
  lowerIdx: number,
  upperIdx: number
): number {
  let bg = 0;
  for (let i = lowerIdx; i <= upperIdx; i++) {
    bg += background.values[i];
  }
  return bg;
}

// ----------------------------------------------------------------------------
// FIELD METRICS -- High-level resonance characterization
// ----------------------------------------------------------------------------

/**
 * Compute comprehensive field resonance metrics.
 */
export function computeFieldResonanceMetrics(
  field: SemanticField,
  resonances: SemanticResonance[],
  histogram: HistogramBin[]
): FieldResonanceMetrics {
  const gravities = computeParticleGravities(field);
  const values = Array.from(gravities.values());

  const totalParticles = values.length;
  const totalResonances = resonances.length;

  const meanGravity = values.reduce((sum, v) => sum + v, 0) / totalParticles;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - meanGravity, 2), 0) / totalParticles;

  // Skewness (third standardized moment)
  const skewness = values.reduce((sum, v) => 
    sum + Math.pow((v - meanGravity) / Math.sqrt(variance || 1), 3), 0
  ) / totalParticles;

  // Kurtosis (fourth standardized moment)
  const kurtosis = values.reduce((sum, v) => 
    sum + Math.pow((v - meanGravity) / Math.sqrt(variance || 1), 4), 0
  ) / totalParticles;

  // Coherence index: fraction of particles in resonances
  const resonanceParticles = new Set<string>();
  for (const r of resonances) {
    for (const p of r.particles) resonanceParticles.add(p);
  }
  const coherenceIndex = totalParticles > 0 ? resonanceParticles.size / totalParticles : 0;

  // Dominant resonance = strongest one
  let dominantResonance: string | null = null;
  let maxStrength = 0;
  for (const r of resonances) {
    if (r.strength > maxStrength) {
      maxStrength = r.strength;
      dominantResonance = r.id;
    }
  }

  // Background fraction = particles not in any resonance
  const signalFraction = coherenceIndex;
  const backgroundFraction = 1 - signalFraction;

  return {
    totalParticles,
    totalResonances,
    meanGravity,
    gravityVariance: variance,
    skewness,
    kurtosis,
    coherenceIndex,
    dominantResonance,
    backgroundFraction,
    signalFraction,
  };
}

// ----------------------------------------------------------------------------
// STABILITY ANALYSIS -- Track resonance evolution
// ----------------------------------------------------------------------------

/**
 * Compute stability of resonances across field history.
 * A stable resonance persists across multiple field states.
 */
export function computeResonanceStability(
  currentResonances: SemanticResonance[],
  previousAnalyses: ResonanceAnalysis[]
): SemanticResonance[] {
  return currentResonances.map(r => {
    let stabilityScore = 0;
    let matches = 0;

    for (const prev of previousAnalyses) {
      // Find matching resonance in previous analysis
      const match = prev.resonances.find(pr => 
        Math.abs(pr.centerGravity - r.centerGravity) < pr.width * 2 &&
        Math.abs(pr.width - r.width) < pr.width * 0.5
      );

      if (match) {
        matches++;
        // Stability increases with consistency
        const gravityConsistency = 1 - Math.abs(match.centerGravity - r.centerGravity) / (r.width || 1);
        const widthConsistency = 1 - Math.abs(match.width - r.width) / (match.width || 1);
        stabilityScore += (gravityConsistency + widthConsistency) / 2;
      }
    }

    const stability = previousAnalyses.length > 0 
      ? (matches / previousAnalyses.length) * (stabilityScore / (matches || 1))
      : 0;

    return { ...r, stability };
  });
}

// ----------------------------------------------------------------------------
// MAIN ANALYSIS PIPELINE
// ----------------------------------------------------------------------------

/**
 * Complete resonance analysis of a semantic field.
 * The full pipeline: histogram -> background fit -> peak find -> optimal cuts -> metrics.
 */
export function analyzeFieldResonances(
  field: SemanticField,
  previousAnalyses: ResonanceAnalysis[] = [],
  feature: 'gravity' | 'interaction' = 'gravity'
): ResonanceAnalysis {
  // Step 1: Compute feature values for all particles
  let values: number[];
  let ids: string[];

  if (feature === 'gravity') {
    const gravities = computeParticleGravities(field);
    values = Array.from(gravities.values());
    ids = Array.from(gravities.keys());
  } else {
    const strengths = computeParticleInteractionStrengths(field);
    values = Array.from(strengths.values());
    ids = Array.from(strengths.keys());
  }

  // Step 2: Build histogram
  const histogram = buildHistogram(values, ids);

  // Step 3: Fit background
  const background = fitBackground(histogram, 3);

  // Step 4: Find peaks (resonances)
  let resonances = findPeaks(histogram, background, 2.0, 2);

  // Step 5: Compute stability from history
  resonances = computeResonanceStability(resonances, previousAnalyses);

  // Step 6: Compute optimal cuts
  const optimalCuts = computeOptimalCuts(histogram, resonances, background);

  // Step 7: Compute field metrics
  const fieldMetrics = computeFieldResonanceMetrics(field, resonances, histogram);

  return {
    timestamp: field.timestamp,
    histogram,
    resonances,
    background,
    optimalCuts,
    fieldMetrics,
  };
}

// ----------------------------------------------------------------------------
// INTERPRETATION -- Human-readable resonance descriptions
// ----------------------------------------------------------------------------

/**
 * Generate a human-readable interpretation of a resonance analysis.
 * Maps physics concepts to semantic meaning.
 */
export function interpretResonanceAnalysis(
  analysis: ResonanceAnalysis
): string[] {
  const interpretations: string[] = [];
  const { resonances, fieldMetrics, optimalCuts } = analysis;

  // Overall field characterization
  if (fieldMetrics.coherenceIndex > 0.8) {
    interpretations.push(
      `Field is highly coherent (${(fieldMetrics.coherenceIndex * 100).toFixed(1)}% of particles in stable resonances). ` +
      `Meaning is well-structured and stable.`
    );
  } else if (fieldMetrics.coherenceIndex > 0.5) {
    interpretations.push(
      `Field shows moderate coherence (${(fieldMetrics.coherenceIndex * 100).toFixed(1)}%). ` +
      `Some stable meanings exist alongside background noise.`
    );
  } else {
    interpretations.push(
      `Field is incoherent (${(fieldMetrics.coherenceIndex * 100).toFixed(1)}%). ` +
      `Most particles are in background noise. High creative potential but low stability.`
    );
  }

  // Skewness interpretation
  if (fieldMetrics.skewness > 1) {
    interpretations.push(
      `Distribution is strongly right-skewed (skewness=${fieldMetrics.skewness.toFixed(2)}). ` +
      `Most particles cluster at low gravity with a few high-gravity outliers.`
    );
  } else if (fieldMetrics.skewness < -1) {
    interpretations.push(
      `Distribution is strongly left-skewed (skewness=${fieldMetrics.skewness.toFixed(2)}). ` +
      `Most particles have high gravity with few low-gravity outliers.`
    );
  }

  // Kurtosis interpretation
  if (fieldMetrics.kurtosis > 3) {
    interpretations.push(
      `Distribution is leptokurtic (kurtosis=${fieldMetrics.kurtosis.toFixed(2)}). ` +
      `Sharp peaks with heavy tails -- strong resonances with significant background.`
    );
  } else if (fieldMetrics.kurtosis < 3) {
    interpretations.push(
      `Distribution is platykurtic (kurtosis=${fieldMetrics.kurtosis.toFixed(2)}). ` +
      `Flat distribution -- weak or no strong resonances.`
    );
  }

  // Individual resonance interpretations
  for (const r of resonances) {
    let description = `Resonance ${r.id}: `;

    if (r.strength > fieldMetrics.meanGravity * 2) {
      description += `Strong resonance (strength=${r.strength.toFixed(2)}). `;
    } else {
      description += `Weak resonance (strength=${r.strength.toFixed(2)}). `;
    }

    if (r.width < 0.5) {
      description += `Narrow width (${r.width.toFixed(2)}) -- precise, specific meaning. `;
    } else {
      description += `Broad width (${r.width.toFixed(2)}) -- diffuse, general meaning. `;
    }

    if (r.purity > 0.8) {
      description += `High purity (${(r.purity * 100).toFixed(1)}%) -- well-isolated from background.`;
    } else {
      description += `Low purity (${(r.purity * 100).toFixed(1)}%) -- contaminated by background.`;
    }

    if (r.stability > 0.7) {
      description += ` Stable across time (stability=${(r.stability * 100).toFixed(1)}%).`;
    } else if (r.stability > 0.3) {
      description += ` Moderately stable (stability=${(r.stability * 100).toFixed(1)}%).`;
    } else {
      description += ` Unstable (stability=${(r.stability * 100).toFixed(1)}%) -- emerging or decaying.`;
    }

    interpretations.push(description);
  }

  // Optimal cut recommendations
  for (const cut of optimalCuts.filter(c => c.method === 'sensitivity')) {
    const resonance = resonances.find(r => r.id === cut.resonanceId);
    if (resonance) {
      interpretations.push(
        `Optimal cut for ${resonance.id}: ` +
        `gravity in [${cut.lowerBound.toFixed(2)}, ${cut.upperBound.toFixed(2)}]. ` +
        `Efficiency=${(cut.efficiency * 100).toFixed(1)}%, ` +
        `Purity=${(cut.purity * 100).toFixed(1)}%, ` +
        `Significance=${cut.significance.toFixed(2)}.`
      );
    }
  }

  return interpretations;
}

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------

export default {
  // Core analysis
  computeParticleGravities,
  computeParticleInteractionStrengths,
  buildHistogram,
  fitBackground,
  findPeaks,
  computeOptimalCuts,
  computeFieldResonanceMetrics,
  computeResonanceStability,
  analyzeFieldResonances,
  interpretResonanceAnalysis,

  // Types
  HistogramBin,
  SemanticResonance,
  BackgroundModel,
  ResonanceAnalysis,
  OptimalCut,
  FieldResonanceMetrics,
};
