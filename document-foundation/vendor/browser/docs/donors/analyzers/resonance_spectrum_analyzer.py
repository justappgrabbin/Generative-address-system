
"""
Resonance Spectrum Analyzer (RSA) v1.0
======================================
A module for the Morph OS ecosystem that:
1. Maps hexagrams/gates to spectral tendency distributions
2. Detects active quality clusters via subgraph/community detection
3. Predicts emerging resonance conditions from cluster patterns
4. Suggests response experiments based on historical outcomes
5. Tracks feedback to learn personal patterns

Integrates with: Trident GNN, Morph Agent System, Synthia Server
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import json
import hashlib
from datetime import datetime, timedelta
import random

# ============================================================
# CORE DATA STRUCTURES
# ============================================================

class SpectrumPosition(Enum):
    """Where a quality sits on its expression spectrum"""
    HIGH = "high"           # Optimal, elevated expression
    MID_HIGH = "mid_high"   # Strong but not peak
    MIDDLE = "middle"       # Balanced, neutral
    MID_LOW = "mid_low"     # Diminished, constrained
    LOW = "low"             # Suppressed, inverted, or blocked

@dataclass
class QualitySpectrum:
    """
    A hexagram/gate as a spectrum of possible expressions,
    not a fixed meaning.
    """
    gate_number: int
    hexagram_name: str
    # The five positions on the spectrum
    high_expression: str      # e.g., "Breakthrough innovation"
    mid_high_expression: str  # e.g., "Inspired seeking"
    middle_expression: str    # e.g., "Creative restlessness"
    mid_low_expression: str   # e.g., "Unfinished projects"
    low_expression: str       # e.g., "Destructive chaos"
    # Historical tracking
    personal_history: List[Tuple[datetime, SpectrumPosition, str]] = field(default_factory=list)
    # What tends to shift this quality up or down
    elevation_triggers: List[str] = field(default_factory=list)
    suppression_triggers: List[str] = field(default_factory=list)

@dataclass
class ResonanceCluster:
    """
    A detected subgraph/community of co-activating qualities.
    Like a gene module in BioNeuralNet — qualities that tend to
    express together under certain conditions.
    """
    cluster_id: str
    gates: List[int]
    dominant_hub: int         # The highest-degree node in this cluster
    average_activation: float # 0.0 to 1.0
    temporal_signature: str   # e.g., "new_moon", "mercury_retrograde", "morning"
    historical_frequency: int # How many times this cluster has appeared
    # The condition this cluster tends to create
    associated_condition: str
    condition_confidence: float  # 0.0 to 1.0

@dataclass
class PredictedCondition:
    """
    A condition that the system predicts may emerge
    from the current resonance field state.
    """
    condition_name: str
    probability: float        # 0.0 to 1.0
    contributing_clusters: List[str]
    time_horizon: str         # e.g., "next_4_hours", "next_24_hours", "next_week"
    severity_spectrum: Tuple[float, float]  # (min_expected, max_expected) 0-1
    # Not sickness — states of being
    description: str

@dataclass
class ResponseExperiment:
    """
    A suggested response to test, based on historical A/B patterns.
    """
    experiment_id: str
    trigger_condition: str
    suggested_response: str
    expected_shift: str       # What the response tends to shift
    confidence: float         # Based on historical success rate
    historical_outcomes: List[Tuple[str, float]]  # (outcome_description, success_score)
    category: str             # "patience", "action", "communication", "space", etc.

@dataclass
class ResonanceSnapshot:
    """
    A complete capture of the resonance field at a moment in time.
    """
    timestamp: datetime
    person_id: str
    active_gates: Dict[int, float]  # gate_number -> activation_strength
    detected_clusters: List[ResonanceCluster]
    predicted_conditions: List[PredictedCondition]
    suggested_experiments: List[ResponseExperiment]
    environmental_context: Dict[str, str]  # transits, lunar phase, etc.
    # The actual outcome (filled in later)
    actual_outcome: Optional[str] = None
    outcome_rating: Optional[float] = None  # -1.0 to 1.0


# ============================================================
# SPECTRAL HEXAGRAM DATABASE
# ============================================================

class HexagramSpectrumLibrary:
    """
    The 64 hexagrams as spectral qualities.
    Each gate has a full spectrum of expression.
    This is the foundational knowledge base.
    """

    def __init__(self):
        self.spectra: Dict[int, QualitySpectrum] = {}
        self._initialize_hexagram_spectra()

    def _initialize_hexagram_spectra(self):
        """Initialize all 64 gates with their spectral mappings."""
        # This is a seed database — the system learns and refines these over time
        hexagram_data = {
            1: ("The Creative", "Breakthrough innovation", "Inspired vision", 
                "Creative restlessness", "Unfinished projects", "Destructive forcing"),
            2: ("The Receptive", "Profound nurturing", "Gentle support",
                "Passive waiting", "Over-accommodation", "Self-erasure"),
            3: ("Difficulty at the Beginning", "Courageous pioneering", "Enthusiastic starts",
                "Scattered beginnings", "Premature action", "Reckless chaos"),
            6: ("Conflict", "Constructive debate", "Healthy boundaries",
                "Minor friction", "Avoidance of truth", "Destructive argument"),
            10: ("Treading", "Graceful navigation", "Careful steps",
                 "Hesitant movement", "Fear of misstep", "Paralysis by caution"),
            14: ("Possession in Great Measure", "Generous abundance", "Confident sharing",
                 "Hoarding tendency", "Fear of loss", "Greedy grasping"),
            20: ("Contemplation", "Deep insight", "Patient observation",
                 "Distracted watching", "Analysis paralysis", "Dissociative detachment"),
            33: ("Retreat", "Strategic withdrawal", "Necessary rest",
                 "Avoidant hiding", "Cowardly escape", "Complete shutdown"),
            34: ("The Power of the Great", "Empowered action", "Strong initiative",
                 "Forceful pushing", "Bulldozing others", "Destructive rage"),
            37: ("The Family", "Nurturing community", "Warm belonging",
                 "Clingy dependence", "Toxic loyalty", "Enmeshed dysfunction"),
            40: ("Deliverance", "Liberating release", "Healthy letting go",
                 "Avoidant dismissal", "Reckless abandonment", "Complete severance"),
            44: ("Coming to Meet", "Magnetic attraction", "Timely encounter",
                 "Restless seeking", "Obsessive pursuit", "Predatory stalking"),
            50: ("The Cauldron", "Transformative alchemy", "Skillful refinement",
                 "Slow cooking", "Stagnant brewing", "Toxic pressure"),
            56: ("The Wanderer", "Inspired journey", "Curious exploration",
                 "Restless drifting", "Escapist roaming", "Lost wandering"),
            57: ("The Gentle", "Penetrating insight", "Soft persistence",
                 "Nagging repetition", "Passive aggression", "Corrosive infiltration"),
        }

        for gate, (name, high, mid_high, mid, mid_low, low) in hexagram_data.items():
            self.spectra[gate] = QualitySpectrum(
                gate_number=gate,
                hexagram_name=name,
                high_expression=high,
                mid_high_expression=mid_high,
                middle_expression=mid,
                mid_low_expression=mid_low,
                low_expression=low
            )

    def get_spectrum(self, gate_number: int) -> Optional[QualitySpectrum]:
        return self.spectra.get(gate_number)

    def get_expression_at_position(self, gate: int, position: SpectrumPosition) -> str:
        spec = self.spectra.get(gate)
        if not spec:
            return "Unknown"
        mapping = {
            SpectrumPosition.HIGH: spec.high_expression,
            SpectrumPosition.MID_HIGH: spec.mid_high_expression,
            SpectrumPosition.MIDDLE: spec.middle_expression,
            SpectrumPosition.MID_LOW: spec.mid_low_expression,
            SpectrumPosition.LOW: spec.low_expression,
        }
        return mapping.get(position, "Unknown")


# ============================================================
# SUBGRAPH / CLUSTER DETECTION
# ============================================================

class ResonanceClusterDetector:
    """
    Detects communities/clusters in the resonance graph.
    Adapted from BioNeuralNet's subgraph detection approach.

    Instead of molecular interactions, we detect which gates
    tend to co-activate and form functional modules.
    """

    def __init__(self, history_buffer_size: int = 1000):
        self.cluster_history: List[ResonanceCluster] = []
        self.co_activation_matrix: Dict[Tuple[int, int], int] = defaultdict(int)
        self.history_buffer_size = history_buffer_size
        # Known cluster signatures (learned over time)
        self.known_clusters: Dict[str, Dict] = {}

    def update_co_activation(self, active_gates: List[int]):
        """Record which gates activated together."""
        for i, g1 in enumerate(active_gates):
            for g2 in active_gates[i+1:]:
                key = tuple(sorted([g1, g2]))
                self.co_activation_matrix[key] += 1

    def detect_clusters(self, active_gates: Dict[int, float], 
                       temporal_context: Dict[str, str]) -> List[ResonanceCluster]:
        """
        Detect clusters using a Louvain-like community detection
        adapted for small, symbolic graphs.

        For the 64-gate system, we use a simpler but effective approach:
        1. Build adjacency from co-activation history
        2. Find strongly connected components
        3. Score by activation strength
        """
        clusters = []
        gate_list = list(active_gates.keys())

        if len(gate_list) < 2:
            return clusters

        # Build adjacency for current active gates
        adjacency = defaultdict(list)
        for i, g1 in enumerate(gate_list):
            for g2 in gate_list[i+1:]:
                key = tuple(sorted([g1, g2]))
                weight = self.co_activation_matrix.get(key, 0)
                if weight > 0:
                    adjacency[g1].append((g2, weight))
                    adjacency[g2].append((g1, weight))

        # Simple greedy community detection
        visited = set()
        for gate in gate_list:
            if gate in visited:
                continue

            # Grow a cluster from this seed
            cluster_gates = [gate]
            visited.add(gate)
            queue = [gate]

            while queue:
                current = queue.pop(0)
                for neighbor, weight in adjacency.get(current, []):
                    if neighbor not in visited and neighbor in active_gates:
                        # Include if activation is significant
                        if active_gates[neighbor] > 0.3:
                            cluster_gates.append(neighbor)
                            visited.add(neighbor)
                            queue.append(neighbor)

            if len(cluster_gates) >= 2:
                # Find dominant hub (highest activation)
                dominant = max(cluster_gates, key=lambda g: active_gates.get(g, 0))
                avg_act = np.mean([active_gates.get(g, 0) for g in cluster_gates])

                cluster_id = self._hash_cluster(cluster_gates)

                # Check if we've seen this cluster before
                hist_freq = sum(1 for c in self.cluster_history 
                               if set(c.gates) == set(cluster_gates))

                # Determine associated condition
                condition, confidence = self._infer_condition(cluster_gates, temporal_context)

                cluster = ResonanceCluster(
                    cluster_id=cluster_id,
                    gates=cluster_gates,
                    dominant_hub=dominant,
                    average_activation=avg_act,
                    temporal_signature=self._encode_temporal(temporal_context),
                    historical_frequency=hist_freq,
                    associated_condition=condition,
                    condition_confidence=confidence
                )
                clusters.append(cluster)
                self.cluster_history.append(cluster)

        # Prune history
        if len(self.cluster_history) > self.history_buffer_size:
            self.cluster_history = self.cluster_history[-self.history_buffer_size:]

        return clusters

    def _hash_cluster(self, gates: List[int]) -> str:
        """Create a stable ID for a cluster."""
        gate_str = ",".join(map(str, sorted(gates)))
        return hashlib.md5(gate_str.encode()).hexdigest()[:12]

    def _encode_temporal(self, context: Dict[str, str]) -> str:
        """Encode temporal context into a signature."""
        parts = []
        if "lunar_phase" in context:
            parts.append(context["lunar_phase"])
        if "transit" in context:
            parts.append(context["transit"])
        if "time_of_day" in context:
            parts.append(context["time_of_day"])
        return "_".join(parts) if parts else "general"

    def _infer_condition(self, gates: List[int], context: Dict[str, str]) -> Tuple[str, float]:
        """
        Infer what condition this cluster tends to create.
        This is learned from historical patterns.
        """
        # Look for similar clusters in history
        similar = [c for c in self.cluster_history 
                  if len(set(c.gates) & set(gates)) >= max(2, len(gates)//2)]

        if similar:
            # Weight by similarity
            conditions = defaultdict(float)
            for s in similar:
                overlap = len(set(s.gates) & set(gates)) / max(len(s.gates), len(gates))
                conditions[s.associated_condition] += overlap

            if conditions:
                best = max(conditions, key=conditions.get)
                confidence = min(conditions[best] / len(similar), 1.0)
                return best, confidence

        # Fallback: infer from gate combinations
        return self._heuristic_condition(gates)

    def _heuristic_condition(self, gates: List[int]) -> Tuple[str, float]:
        """Basic heuristic for unknown clusters."""
        # Simple rule-based inference
        creative_gates = {1, 3, 14, 34}
        reflective_gates = {2, 20, 33, 57}
        social_gates = {37, 44, 50}

        creative_count = len(set(gates) & creative_gates)
        reflective_count = len(set(gates) & reflective_gates)
        social_count = len(set(gates) & social_gates)

        if creative_count >= 2 and reflective_count >= 2:
            return "Creative tension — ideas forming but not yet ready", 0.6
        elif social_count >= 2 and creative_count >= 1:
            return "Collaborative spark — shared creative energy", 0.5
        elif reflective_count >= 2:
            return "Inward retreat — processing and integration needed", 0.5
        elif creative_count >= 2:
            return "Creative surge — high output potential", 0.5
        else:
            return "Mixed field — watch for unexpected interactions", 0.3


# ============================================================
# PREDICTIVE CONDITION ENGINE
# ============================================================

class ConditionPredictor:
    """
    Predicts emerging conditions from detected clusters.
    Uses historical A/B patterns (from business ML approach).
    """

    def __init__(self):
        # Historical outcomes: cluster_id -> list of (condition, outcome, rating)
        self.outcome_history: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
        # Response experiments and their results
        self.experiment_results: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        # Personal baselines per person
        self.personal_baselines: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    def predict_conditions(self, clusters: List[ResonanceCluster],
                          active_gates: Dict[int, float],
                          person_id: str,
                          context: Dict[str, str]) -> List[PredictedCondition]:
        """Predict conditions from current cluster state."""
        predictions = []

        for cluster in clusters:
            # Base prediction from cluster
            base_prob = cluster.condition_confidence * cluster.average_activation

            # Adjust for personal baseline
            baseline = self.personal_baselines[person_id].get(cluster.associated_condition, 0.5)
            adjusted_prob = (base_prob + baseline) / 2

            # Time horizon based on activation strength
            if cluster.average_activation > 0.8:
                horizon = "next_4_hours"
            elif cluster.average_activation > 0.5:
                horizon = "next_24_hours"
            else:
                horizon = "next_week"

            # Severity spectrum
            min_sev = max(0, adjusted_prob - 0.2)
            max_sev = min(1, adjusted_prob + 0.2)

            pred = PredictedCondition(
                condition_name=cluster.associated_condition,
                probability=adjusted_prob,
                contributing_clusters=[cluster.cluster_id],
                time_horizon=horizon,
                severity_spectrum=(min_sev, max_sev),
                description=self._describe_condition(cluster, active_gates)
            )
            predictions.append(pred)

        # Also check for cross-cluster interactions
        if len(clusters) >= 2:
            cross_pred = self._predict_cross_cluster(clusters, person_id)
            if cross_pred:
                predictions.append(cross_pred)

        return sorted(predictions, key=lambda p: p.probability, reverse=True)

    def _describe_condition(self, cluster: ResonanceCluster, 
                           active_gates: Dict[int, float]) -> str:
        """Generate a human-readable description of the condition."""
        hub_gate = cluster.dominant_hub
        hub_strength = active_gates.get(hub_gate, 0.5)

        intensity = "strongly" if hub_strength > 0.7 else "moderately" if hub_strength > 0.4 else "subtly"

        return f"{cluster.associated_condition}. The {hub_gate} hub is {intensity} active."

    def _predict_cross_cluster(self, clusters: List[ResonanceCluster], 
                               person_id: str) -> Optional[PredictedCondition]:
        """Predict conditions from interactions between clusters."""
        # Simple: if two clusters have conflicting dominant hubs, predict friction
        if len(clusters) == 2:
            c1, c2 = clusters[0], clusters[1]
            # Check for tension (simplified)
            tension_pairs = [(1, 2), (3, 33), (34, 2), (6, 37), (40, 50)]

            for g1, g2 in tension_pairs:
                if (c1.dominant_hub == g1 and c2.dominant_hub == g2) or \
                   (c1.dominant_hub == g2 and c2.dominant_hub == g1):
                    return PredictedCondition(
                        condition_name="Field tension — conflicting drives",
                        probability=0.6,
                        contributing_clusters=[c1.cluster_id, c2.cluster_id],
                        time_horizon="next_24_hours",
                        severity_spectrum=(0.4, 0.8),
                        description="Two strong clusters with opposing qualities. Space for both is needed."
                    )
        return None

    def record_outcome(self, cluster_id: str, condition: str, 
                      actual_outcome: str, rating: float, person_id: str):
        """Record what actually happened for learning."""
        self.outcome_history[cluster_id].append((condition, actual_outcome, rating))
        # Update personal baseline
        current = self.personal_baselines[person_id][condition]
        self.personal_baselines[person_id][condition] = (current * 0.7) + (rating * 0.3)

    def record_experiment_result(self, experiment_id: str, 
                                 outcome: str, success_score: float):
        """Record the result of a response experiment."""
        self.experiment_results[experiment_id].append((outcome, success_score))


# ============================================================
# RESPONSE EXPERIMENT GENERATOR
# ============================================================

class ResponseExperimentGenerator:
    """
    Generates suggested response experiments based on:
    1. The predicted condition
    2. Historical A/B outcomes
    3. The person's known patterns
    """

    def __init__(self, predictor: ConditionPredictor):
        self.predictor = predictor
        # Response templates by condition category
        self.response_templates: Dict[str, List[Dict]] = {
            "creative_tension": [
                {"response": "Journal without editing for 15 minutes", 
                 "shift": "Release compressed potential into flow",
                 "category": "expression"},
                {"response": "Take a 20-minute walk with no destination",
                 "shift": "Move stagnant energy through the body", 
                 "category": "movement"},
                {"response": "Talk to someone about the idea without seeking feedback",
                 "shift": "Externalize internal pressure",
                 "category": "communication"},
            ],
            "collaborative_spark": [
                {"response": "Schedule a 30-minute co-creation session",
                 "shift": "Channel shared energy into tangible output",
                 "category": "action"},
                {"response": "Share one half-formed idea immediately",
                 "shift": "Break the barrier of perfectionism",
                 "category": "communication"},
            ],
            "inward_retreat": [
                {"response": "Set a 2-hour boundary with no external input",
                 "shift": "Protect integration space",
                 "category": "space"},
                {"response": "Write three sentences about what you're feeling",
                 "shift": "Gentle externalization without pressure",
                 "category": "expression"},
            ],
            "field_tension": [
                {"response": "Name the tension out loud to yourself",
                 "shift": "Bring unconscious conflict into awareness",
                 "category": "awareness"},
                {"response": "Do one small thing for each drive, separately",
                 "shift": "Honor both without forcing integration",
                 "category": "action"},
            ],
            "general": [
                {"response": "Pause and breathe for 60 seconds before responding",
                 "shift": "Create space between stimulus and response",
                 "category": "patience"},
                {"response": "Ask: what is this moment asking of me?",
                 "shift": "Shift from reaction to inquiry",
                 "category": "awareness"},
            ]
        }

    def generate_experiments(self, predictions: List[PredictedCondition],
                            person_id: str) -> List[ResponseExperiment]:
        """Generate response experiments for predicted conditions."""
        experiments = []

        for pred in predictions[:3]:  # Top 3 predictions
            # Map condition to category
            category = self._categorize_condition(pred.condition_name)
            templates = self.response_templates.get(category, self.response_templates["general"])

            for i, template in enumerate(templates):
                exp_id = f"{person_id}_{pred.condition_name}_{i}_{datetime.now().strftime('%H%M%S')}"

                # Calculate confidence from historical results
                hist = self.predictor.experiment_results.get(exp_id, [])
                if hist:
                    avg_success = np.mean([h[1] for h in hist])
                    confidence = min(avg_success + 0.1, 1.0)
                else:
                    confidence = 0.5  # Unknown, moderate confidence

                exp = ResponseExperiment(
                    experiment_id=exp_id,
                    trigger_condition=pred.condition_name,
                    suggested_response=template["response"],
                    expected_shift=template["shift"],
                    confidence=confidence,
                    historical_outcomes=hist,
                    category=template["category"]
                )
                experiments.append(exp)

        return experiments

    def _categorize_condition(self, condition_name: str) -> str:
        """Map a condition name to a response category."""
        condition_lower = condition_name.lower()
        if "creative" in condition_lower and "tension" in condition_lower:
            return "creative_tension"
        elif "collaborative" in condition_lower or "shared" in condition_lower:
            return "collaborative_spark"
        elif "retreat" in condition_lower or "inward" in condition_lower:
            return "inward_retreat"
        elif "tension" in condition_lower or "conflict" in condition_lower:
            return "field_tension"
        else:
            return "general"


# ============================================================
# MAIN RESONANCE SPECTRUM ANALYZER
# ============================================================

class ResonanceSpectrumAnalyzer:
    """
    The main orchestrator.

    Usage:
        rsa = ResonanceSpectrumAnalyzer()
        snapshot = rsa.analyze_field(
            person_id="user_001",
            active_gates={1: 0.9, 8: 0.7, 33: 0.6, 56: 0.4},
            context={"lunar_phase": "new_moon", "time_of_day": "morning"}
        )
    """

    def __init__(self):
        self.spectrum_lib = HexagramSpectrumLibrary()
        self.cluster_detector = ResonanceClusterDetector()
        self.condition_predictor = ConditionPredictor()
        self.experiment_generator = ResponseExperimentGenerator(self.condition_predictor)
        self.snapshots: List[ResonanceSnapshot] = []

    def analyze_field(self, person_id: str,
                     active_gates: Dict[int, float],
                     context: Dict[str, str]) -> ResonanceSnapshot:
        """
        Main entry point: analyze the current resonance field
        and return a complete snapshot with predictions and suggestions.
        """
        # 1. Update co-activation history
        self.cluster_detector.update_co_activation(list(active_gates.keys()))

        # 2. Detect clusters
        clusters = self.cluster_detector.detect_clusters(active_gates, context)

        # 3. Predict conditions
        predictions = self.condition_predictor.predict_conditions(
            clusters, active_gates, person_id, context
        )

        # 4. Generate response experiments
        experiments = self.experiment_generator.generate_experiments(
            predictions, person_id
        )

        # 5. Build snapshot
        snapshot = ResonanceSnapshot(
            timestamp=datetime.now(),
            person_id=person_id,
            active_gates=active_gates,
            detected_clusters=clusters,
            predicted_conditions=predictions,
            suggested_experiments=experiments,
            environmental_context=context
        )

        self.snapshots.append(snapshot)
        return snapshot

    def record_outcome(self, snapshot: ResonanceSnapshot,
                      actual_outcome: str, rating: float):
        """
        Record what actually happened after the snapshot.
        This is the feedback loop that makes the system learn.
        """
        snapshot.actual_outcome = actual_outcome
        snapshot.outcome_rating = rating

        for cluster in snapshot.detected_clusters:
            self.condition_predictor.record_outcome(
                cluster.cluster_id,
                cluster.associated_condition,
                actual_outcome,
                rating,
                snapshot.person_id
            )

    def record_experiment(self, experiment_id: str, 
                         outcome: str, success_score: float):
        """Record the result of trying a suggested response."""
        self.condition_predictor.record_experiment_result(
            experiment_id, outcome, success_score
        )

    def get_personal_insights(self, person_id: str) -> Dict:
        """Get learned insights about a person's patterns."""
        baselines = dict(self.condition_predictor.personal_baselines[person_id])

        # Find most common conditions
        person_snapshots = [s for s in self.snapshots if s.person_id == person_id]
        condition_counts = defaultdict(int)
        for s in person_snapshots:
            for p in s.predicted_conditions:
                condition_counts[p.condition_name] += 1

        # Find most successful experiments
        best_experiments = []
        for exp_id, results in self.condition_predictor.experiment_results.items():
            if results:
                avg = np.mean([r[1] for r in results])
                if avg > 0.7:
                    best_experiments.append((exp_id, avg))

        return {
            "personal_baselines": baselines,
            "common_conditions": dict(condition_counts),
            "best_responses": sorted(best_experiments, key=lambda x: x[1], reverse=True)[:5],
            "total_snapshots": len(person_snapshots)
        }

    def export_snapshot_json(self, snapshot: ResonanceSnapshot) -> str:
        """Export a snapshot as JSON for storage/transmission."""
        data = {
            "timestamp": snapshot.timestamp.isoformat(),
            "person_id": snapshot.person_id,
            "active_gates": snapshot.active_gates,
            "environmental_context": snapshot.environmental_context,
            "clusters": [
                {
                    "id": c.cluster_id,
                    "gates": c.gates,
                    "dominant_hub": c.dominant_hub,
                    "condition": c.associated_condition,
                    "confidence": c.condition_confidence
                }
                for c in snapshot.detected_clusters
            ],
            "predictions": [
                {
                    "condition": p.condition_name,
                    "probability": p.probability,
                    "horizon": p.time_horizon,
                    "description": p.description
                }
                for p in snapshot.predicted_conditions
            ],
            "suggested_experiments": [
                {
                    "id": e.experiment_id,
                    "response": e.suggested_response,
                    "expected_shift": e.expected_shift,
                    "confidence": e.confidence,
                    "category": e.category
                }
                for e in snapshot.suggested_experiments
            ]
        }
        return json.dumps(data, indent=2)


# ============================================================
# DEMO / TEST
# ============================================================

def demo():
    """Demonstrate the Resonance Spectrum Analyzer."""
    print("=" * 60)
    print("RESONANCE SPECTRUM ANALYZER v1.0 — DEMO")
    print("=" * 60)

    rsa = ResonanceSpectrumAnalyzer()

    # Simulate a field state
    print("\n📊 Analyzing resonance field...")
    print("Active gates: 1 (Creative, 0.9), 8 (0.7), 33 (Retreat, 0.6), 56 (Wanderer, 0.4)")

    snapshot = rsa.analyze_field(
        person_id="test_user",
        active_gates={1: 0.9, 8: 0.7, 33: 0.6, 56: 0.4},
        context={
            "lunar_phase": "new_moon",
            "time_of_day": "morning",
            "transit": "mercury_direct"
        }
    )

    print(f"\n🕐 Timestamp: {snapshot.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"👤 Person: {snapshot.person_id}")

    print("\n🔍 DETECTED CLUSTERS:")
    for cluster in snapshot.detected_clusters:
        print(f"  Cluster {cluster.cluster_id}")
        print(f"    Gates: {cluster.gates}")
        print(f"    Dominant hub: Gate {cluster.dominant_hub}")
        print(f"    Condition: {cluster.associated_condition}")
        print(f"    Confidence: {cluster.condition_confidence:.2f}")

    print("\n🔮 PREDICTED CONDITIONS:")
    for pred in snapshot.predicted_conditions:
        print(f"  • {pred.condition_name}")
        print(f"    Probability: {pred.probability:.2f}")
        print(f"    Horizon: {pred.time_horizon}")
        print(f"    {pred.description}")

    print("\n🧪 SUGGESTED RESPONSE EXPERIMENTS:")
    for exp in snapshot.suggested_experiments:
        print(f"  [{exp.category.upper()}]")
        print(f"    Try: {exp.suggested_response}")
        print(f"    Expected shift: {exp.expected_shift}")
        print(f"    Confidence: {exp.confidence:.2f}")

    # Simulate recording an outcome
    print("\n📝 Recording outcome...")
    rsa.record_outcome(snapshot, "Felt clearer after journaling", 0.8)
    rsa.record_experiment(snapshot.suggested_experiments[0].experiment_id, 
                         "Journaled for 15 min, idea clarified", 0.9)

    # Get insights
    print("\n📈 PERSONAL INSIGHTS:")
    insights = rsa.get_personal_insights("test_user")
    print(f"  Total snapshots: {insights['total_snapshots']}")
    print(f"  Common conditions: {insights['common_conditions']}")

    # Export JSON
    print("\n📤 JSON EXPORT:")
    json_output = rsa.export_snapshot_json(snapshot)
    print(json_output[:500] + "...")

    print("\n" + "=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)

    return rsa, snapshot


if __name__ == "__main__":
    rsa, snapshot = demo()
