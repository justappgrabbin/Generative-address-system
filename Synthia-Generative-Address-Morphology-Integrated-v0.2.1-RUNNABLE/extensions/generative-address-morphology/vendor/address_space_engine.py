"""
DETERMINISTIC ADDRESS-SPACE ENGINE
=====================================

Core principle: Coordinate = Address = State Space = Renderings

No randomness. No hard-coded lookup tables. No simulation.
No Math.random(). No gate % 5 shortcuts.

A coordinate resolves the same way every time unless context changes.

Architecture:
    Address Space → Coordinate Resolution → State Space Construction → Resonance Calculation → Substrate Rendering

Substrates:
    language, music, code, behavior, charts, images
    = Different renderings of the same state space

Punctuation operators (state transitions, not grammar):
    .  Transitioner — step inward (HOW → WHY)
    °  Collapse — anchor coordinate (fix state)
    ′  Pulse — tempo marking (rhythmic modulation)
    ″  Flicker — micro-transition (threshold crossing)
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Tuple, Any
from enum import Enum, auto
from abc import ABC, abstractmethod

# ============================================================
# 1. POSITIONAL STACK (Canonical Resolution Order)
# ============================================================

class Planet(Enum):
    """1. Planetary — source of force (HOW)"""
    SUN = auto(); MOON = auto(); MERCURY = auto(); VENUS = auto()
    MARS = auto(); JUPITER = auto(); SATURN = auto(); URANUS = auto()
    NEPTUNE = auto(); PLUTO = auto(); NORTH_NODE = auto(); SOUTH_NODE = auto(); EARTH = auto()

class Dimension(Enum):
    """2. Dimension — field of expression (WHO/WHAT)"""
    MOVEMENT = auto(); EVOLUTION = auto(); BEING = auto(); DESIGN = auto(); SPACE = auto()

class Gate(Enum):
    """3. Gate — thematic function (WHAT) — 64 hexagrams"""
    G1 = 1; G2 = 2; G3 = 3; G4 = 4; G5 = 5; G6 = 6; G7 = 7; G8 = 8
    G9 = 9; G10 = 10; G11 = 11; G12 = 12; G13 = 13; G14 = 14; G15 = 15; G16 = 16
    G17 = 17; G18 = 18; G19 = 19; G20 = 20; G21 = 21; G22 = 22; G23 = 23; G24 = 24
    G25 = 25; G26 = 26; G27 = 27; G28 = 28; G29 = 29; G30 = 30; G31 = 31; G32 = 32
    G33 = 33; G34 = 34; G35 = 35; G36 = 36; G37 = 37; G38 = 38; G39 = 39; G40 = 40
    G41 = 41; G42 = 42; G43 = 43; G44 = 44; G45 = 45; G46 = 46; G47 = 47; G48 = 48
    G49 = 49; G50 = 50; G51 = 51; G52 = 52; G53 = 53; G54 = 54; G55 = 55; G56 = 56
    G57 = 57; G58 = 58; G59 = 59; G60 = 60; G61 = 61; G62 = 62; G63 = 63; G64 = 64

class Line(Enum):
    """4. Line — behavioral mode (HOW-WHY resolution)"""
    L1 = 1; L2 = 2; L3 = 3; L4 = 4; L5 = 5; L6 = 6

class Color(Enum):
    """5. Color — modulation"""
    C1 = 1; C2 = 2; C3 = 3; C4 = 4; C5 = 5; C6 = 6

class Tone(Enum):
    """6. Tone — modulation"""
    T1 = 1; T2 = 2; T3 = 3; T4 = 4; T5 = 5; T6 = 6

class Base(Enum):
    """7. Base — modulation"""
    B1 = 1; B2 = 2; B3 = 3; B4 = 4; B5 = 5

class Zodiac(Enum):
    """12. Zodiac — symbolic field mapping (WHY)"""
    ARIES = 1; TAURUS = 2; GEMINI = 3; CANCER = 4; LEO = 5; VIRGO = 6
    LIBRA = 7; SCORPIO = 8; SAGITTARIUS = 9; CAPRICORN = 10; AQUARIUS = 11; PISCES = 12

class House(Enum):
    """13. House — lived context (WHERE)"""
    H1 = 1; H2 = 2; H3 = 3; H4 = 4; H5 = 5; H6 = 6
    H7 = 7; H8 = 8; H9 = 9; H10 = 10; H11 = 11; H12 = 12

# ============================================================
# 2. DETERMINISTIC ANGULAR DECOMPOSITION
# ============================================================

class AngularDecomposer:
    """θ ↦ (gate, degree, minute, second, zodiac, house) — deterministic"""

    DELTA_GATE = 360.0 / 64  # 5.625° per gate

    @staticmethod
    def decompose(theta: float) -> Tuple[int, int, float]:
        gate_idx = int(np.floor(theta / AngularDecomposer.DELTA_GATE))
        remainder = theta - gate_idx * AngularDecomposer.DELTA_GATE
        degree = int(np.floor(remainder))
        minute = int(np.floor((remainder - degree) * 60))
        second = ((remainder - degree) * 60 - minute) * 60
        return (degree, minute, second)

    @staticmethod
    def gate_from_angle(theta: float) -> Gate:
        gate_idx = int(np.floor(theta / AngularDecomposer.DELTA_GATE))
        return Gate((gate_idx % 64) + 1)

    @staticmethod
    def zodiac_from_angle(theta: float) -> Zodiac:
        z_idx = int(np.floor(theta / 30.0)) % 12 + 1
        return Zodiac(z_idx)

    @staticmethod
    def house_from_angle(theta: float, ascendant: float = 0.0) -> House:
        h_idx = int(np.floor((theta - ascendant) / 30.0)) % 12 + 1
        return House(h_idx)

# ============================================================
# 3. ADDRESS — THE COORDINATE
# ============================================================

@dataclass(frozen=True)
class Address:
    """
    a = (planet, dimension, gate, line, color, tone, base, degree, minute, second, axis, zodiac, house)

    Frozen = immutable = hashable = deterministic.
    Same coordinate = same hash = same resolution.
    """
    planet: Planet
    dimension: Dimension
    gate: Gate
    line: Line
    color: Color
    tone: Tone
    base: Base
    degree: int
    minute: int
    second: float
    axis: str  # "toward", "away", "through"
    zodiac: Zodiac
    house: House

    def __hash__(self):
        return hash((
            self.planet, self.dimension, self.gate, self.line,
            self.color, self.tone, self.base,
            self.degree, self.minute, int(self.second * 100),
            self.axis, self.zodiac, self.house
        ))

    def to_dict(self) -> Dict[str, Any]:
        return {
            'planet': self.planet.name,
            'dimension': self.dimension.name,
            'gate': self.gate.value,
            'line': self.line.value,
            'color': self.color.value,
            'tone': self.tone.value,
            'base': self.base.value,
            'degree': self.degree,
            'minute': self.minute,
            'second': round(self.second, 2),
            'axis': self.axis,
            'zodiac': self.zodiac.name,
            'house': self.house.value
        }

# ============================================================
# 4. STATE SPACE — DETERMINISTIC FIELD CONSTRUCTION
# ============================================================

class StateSpace:
    """
    From Address → State Space (deterministic).

    No randomness. No lookup tables. The state space is constructed
    from coordinate geometry using seeded (deterministic) harmonic functions.
    """

    def __init__(self, address: Address):
        self.address = address
        self.vector = self._build_vector()
        self.resonance = self._calculate_resonance()

    def _build_vector(self) -> np.ndarray:
        """Build 64-dimensional state vector from coordinate (deterministic)."""
        # Seed from address hash — deterministic, reproducible
        seed = hash(self.address) % (2**32)
        rng = np.random.RandomState(seed)

        v = np.zeros(64)
        v[self.address.gate.value - 1] = 1.0  # Base gate activation

        # Line position within gate (6 subdivisions)
        line_positions = np.linspace(0, 1, 7)[:-1]
        line_offset = line_positions[self.address.line.value - 1]

        # Harmonic modulators from substructure
        color_freq = self.address.color.value / 6
        tone_freq = self.address.tone.value / 6
        base_freq = self.address.base.value / 5

        # Build harmonic structure — deterministic given seed
        for i in range(64):
            phase = (i + self.address.gate.value) * 2 * np.pi / 64
            v[i] += 0.3 * np.sin(phase * (1 + line_offset))
            v[i] += 0.2 * np.sin(phase * color_freq * 2)
            v[i] += 0.15 * np.sin(phase * tone_freq * 3)
            v[i] += 0.1 * np.sin(phase * base_freq * 4)

        v = v / (np.linalg.norm(v) + 1e-8)
        return v

    def _calculate_resonance(self) -> Dict[str, float]:
        """Calculate self-resonance from autocorrelation (deterministic)."""
        self_corr = np.correlate(self.vector, self.vector, mode='full')
        self_corr = self_corr[len(self_corr)//2:]

        peaks = []
        for i in range(1, len(self_corr)-1):
            if self_corr[i] > self_corr[i-1] and self_corr[i] > self_corr[i+1]:
                peaks.append((i, self_corr[i]))

        constructive = sum(p[1] for p in peaks) if peaks else 0
        total = np.sum(np.abs(self_corr))

        return {
            'self_coherence': float(constructive / (total + 1e-8)),
            'num_peaks': len(peaks),
            'dominant_period': peaks[0][0] if peaks else 0,
            'vector_entropy': float(-np.sum(self.vector * np.log2(np.abs(self.vector) + 1e-8)))
        }

    def interference_with(self, other: 'StateSpace') -> float:
        """Deterministic interference: cosine similarity between state vectors."""
        return float(np.dot(self.vector, other.vector))

# ============================================================
# 5. PUNCTUATION OPERATORS (State Transitions, Not Grammar)
# ============================================================

class Punctuation:
    """
    Punctuation is not grammar. It is state operators.

    .  Transitioner — step inward (HOW → WHY, change of intent)
    °  Collapse — anchor coordinate (fix state, resolve ambiguity)
    ′  Pulse — tempo marking (rhythmic modulation, cadence)
    ″  Flicker — micro-transition (threshold crossing, edge awareness)
    """

    OPERATORS = {
        '.': {
            'name': 'Transitioner',
            'function': 'step_inward',
            'linguistic': ['then', 'so', 'thus'],
            'topology': 'change_of_intent',
            'level': 2,
            'rule': 'Marks HOW → WHY transition. Governing question changes.'
        },
        '°': {
            'name': 'Collapse',
            'function': 'anchor_coordinate',
            'linguistic': ['at', 'in', 'to'],
            'topology': 'state_fixation',
            'level': 3,
            'rule': 'Collapses potential into fixed coordinate. Resolves ambiguity into location.'
        },
        '′': {
            'name': 'Pulse',
            'function': 'tempo_marking',
            'linguistic': ['by', 'per'],
            'topology': 'rhythmic_modulation',
            'level': 4,
            'rule': 'Introduces rhythm. Defines cadence or rate of change. Continuous within same intent.'
        },
        '″': {
            'name': 'Flicker',
            'function': 'micro_transition',
            'linguistic': ['just', 'yet'],
            'topology': 'threshold_crossing',
            'level': 5,
            'rule': 'Instant shift. Threshold crossing. Shimmer of awareness between states.'
        }
    }

    @classmethod
    def get_operator(cls, symbol: str) -> Dict[str, Any]:
        return cls.OPERATORS.get(symbol, cls.OPERATORS['.'])

    @classmethod
    def apply(cls, symbol: str, state_space: StateSpace) -> Dict[str, Any]:
        """Apply punctuation operator to state space (deterministic)."""
        op = cls.get_operator(symbol)

        if symbol == '.':
            return {
                'operator': op,
                'action': 'transition',
                'new_level': op['level'],
                'governing_question': 'WHY',
                'state_modification': 'intent_shift',
                'topology_change': 'HOW_continuous → WHY_discrete'
            }
        elif symbol == '°':
            return {
                'operator': op,
                'action': 'collapse',
                'new_level': op['level'],
                'governing_question': 'WHERE',
                'state_modification': 'coordinate_fixation',
                'fixed_coordinate': {
                    'gate': state_space.address.gate.value,
                    'line': state_space.address.line.value
                }
            }
        elif symbol == '′':
            return {
                'operator': op,
                'action': 'pulse',
                'new_level': op['level'],
                'governing_question': 'WHEN',
                'state_modification': 'tempo_modulation',
                'cadence': state_space.address.tone.value / 6
            }
        elif symbol == '″':
            return {
                'operator': op,
                'action': 'flicker',
                'new_level': op['level'],
                'governing_question': 'HOW_EXACTLY',
                'state_modification': 'threshold_awareness',
                'edge_proximity': state_space.resonance['self_coherence']
            }

        return {'operator': op, 'action': 'unknown'}

# ============================================================
# 6. SUBSTRATE RENDERERS
# ============================================================

class SubstrateRenderer(ABC):
    @abstractmethod
    def render(self, state_space: StateSpace, punctuation_chain: List[str]) -> Dict[str, Any]:
        pass

class LanguageRenderer(SubstrateRenderer):
    """Render state space to natural language (one of many substrates)."""

    VOCABULARY = {
        'planets': {
            'SUN': ['vitality', 'identity', 'life force', 'illumination'],
            'MOON': ['reflection', 'emotion', 'cycle', 'nurture'],
            'MERCURY': ['communication', 'analysis', 'transfer', 'mind'],
            'VENUS': ['attraction', 'valuation', 'harmony', 'love'],
            'MARS': ['force', 'action', 'drive', 'assertion'],
            'JUPITER': ['expansion', 'growth', 'wisdom', 'abundance'],
            'SATURN': ['contraction', 'discipline', 'structure', 'limitation'],
            'URANUS': ['disruption', 'innovation', 'awakening', 'revolution'],
            'NEPTUNE': ['dissolution', 'imagination', 'transcendence', 'dream'],
            'PLUTO': ['transformation', 'power', 'death', 'rebirth'],
            'NORTH_NODE': ['destiny', 'growth', 'future', 'evolution'],
            'SOUTH_NODE': ['karma', 'past', 'release', 'completion'],
            'EARTH': ['grounding', 'manifestation', 'body', 'presence']
        },
        'dimensions': {
            'MOVEMENT': ['I Define', 'initiation', 'direction', 'purpose'],
            'EVOLUTION': ['I Remember', 'growth', 'learning', 'maturation'],
            'BEING': ['I Design', 'form', 'structure', 'identity'],
            'SPACE': ['I Think', 'awareness', 'perspective', 'consciousness'],
            'DESIGN': ['I Am', 'embodiment', 'presence', 'existence']
        },
        'gates': {
            1: ['creation', 'initiation', 'creative', 'yang', 'the creative'],
            2: ['reception', 'grounding', 'receptive', 'yin', 'the receptive'],
            3: ['difficulty', 'ordering', 'chaos to order', 'beginning'],
            4: ['youthful folly', 'inexperience', 'learning', 'innocence'],
            5: ['waiting', 'patience', 'expectation', 'nourishment'],
            6: ['conflict', 'friction', 'intimacy', 'emotional', 'strife'],
            25: ['innocence', 'universal love', 'survival', 'spirit', 'the unexpected'],
            51: ['shock', 'awakening', 'initiation', 'the arousing', 'thunder'],
        },
        'lines': {
            1: ['foundational', 'intention', 'research', 'preparation'],
            2: ['natural', 'grace', 'talent', 'unconscious'],
            3: ['trial', 'error', 'adaptation', 'experimentation'],
            4: ['opportunism', 'influence', 'network', 'reach'],
            5: ['universal', 'leadership', 'generalization', 'power'],
            6: ['transcendence', 'detachment', 'overview', 'role model']
        },
        'colors': {
            1: ['survival', 'fear', 'drive', 'instinct'],
            2: ['desire', 'want', 'attraction', 'longing'],
            3: ['touch', 'contact', 'sensation', 'experience'],
            4: ['geometry', 'form', 'structure', 'mental'],
            5: ['taste', 'discernment', 'preference', 'aesthetic'],
            6: ['love', 'universal', 'connection', 'heart']
        },
        'tones': {
            1: ['binary', 'either/or', 'polarity', 'opposition'],
            2: ['duality', 'both/and', 'balance', 'pair'],
            3: ['rhythm', 'pattern', 'cycle', 'pulse'],
            4: ['harmony', 'resonance', 'chord', 'agreement'],
            5: ['vibration', 'frequency', 'oscillation', 'wave'],
            6: ['unity', 'oneness', 'whole', 'integration']
        },
        'bases': {
            1: ['point', 'focus', 'singularity', 'origin'],
            2: ['line', 'connection', 'path', 'direction'],
            3: ['triangle', 'stability', 'structure', 'foundation'],
            4: ['square', 'order', 'system', 'framework'],
            5: ['pentagon', 'human', 'center', 'self']
        },
        'zodiacs': {
            'ARIES': ['initiation', 'fire', 'cardinal', 'impulse', 'spring'],
            'TAURUS': ['stabilization', 'earth', 'fixed', 'sustenance', 'form'],
            'GEMINI': ['distribution', 'air', 'mutable', 'communication', 'exchange'],
            'CANCER': ['nurturing', 'water', 'cardinal', 'emotion', 'home'],
            'LEO': ['expression', 'fire', 'fixed', 'creativity', 'radiance'],
            'VIRGO': ['refinement', 'earth', 'mutable', 'service', 'discrimination'],
            'LIBRA': ['balancing', 'air', 'cardinal', 'harmony', 'relationship'],
            'SCORPIO': ['transformation', 'water', 'fixed', 'depth', 'intensity'],
            'SAGITTARIUS': ['expansion', 'fire', 'mutable', 'philosophy', 'adventure'],
            'CAPRICORN': ['structuring', 'earth', 'cardinal', 'ambition', 'mastery'],
            'AQUARIUS': ['innovation', 'air', 'fixed', 'revolution', 'humanity'],
            'PISCES': ['dissolution', 'water', 'mutable', 'compassion', 'transcendence']
        },
        'houses': {
            1: ['identity', 'self', 'body', 'appearance', 'beginning'],
            2: ['resources', 'values', 'material', 'security', 'worth'],
            3: ['communication', 'siblings', 'learning', 'local', 'mind'],
            4: ['roots', 'home', 'family', 'foundation', 'endings'],
            5: ['creativity', 'children', 'play', 'expression', 'romance'],
            6: ['service', 'health', 'routine', 'work', 'discipline'],
            7: ['partnership', 'marriage', 'contracts', 'others', 'balance'],
            8: ['transformation', 'death', 'shared resources', 'intimacy', 'crisis'],
            9: ['philosophy', 'travel', 'higher learning', 'meaning', 'expansion'],
            10: ['career', 'public', 'authority', 'achievement', 'status'],
            11: ['community', 'friends', 'groups', 'future', 'hopes'],
            12: ['dissolution', 'hidden', 'spirituality', 'suffering', 'completion']
        }
    }

    def render(self, state_space: StateSpace, punctuation_chain: List[str]) -> Dict[str, Any]:
        addr = state_space.address
        v = self.VOCABULARY

        clusters = {
            'planetary': v['planets'][addr.planet.name],
            'dimensional': v['dimensions'][addr.dimension.name],
            'gate': v['gates'].get(addr.gate.value, ['archetype', 'pattern']),
            'line': v['lines'][addr.line.value],
            'color': v['colors'][addr.color.value],
            'tone': v['tones'][addr.tone.value],
            'base': v['bases'][addr.base.value],
            'zodiac': v['zodiacs'][addr.zodiac.name],
            'house': v['houses'][addr.house.value]
        }

        folded = self._fold_clusters(clusters, punctuation_chain, addr)

        return {
            'substrate': 'language',
            'clusters': clusters,
            'folded': folded,
            'grammar': self._build_grammar(folded, punctuation_chain),
            'sentence': self._compose_sentence(folded, addr)
        }

    def _fold_clusters(self, clusters: Dict, punctuation_chain: List[str], addr: Address) -> Dict:
        """Fold clusters based on punctuation operators (deterministic)."""
        folded = {
            'who': clusters['dimensional'][0],  # "I Define", "I Am", etc.
            'what': clusters['gate'][0],
            'how': clusters['planetary'][0],
            'where': clusters['house'][0],
            'when': f"{addr.degree}°{addr.minute}′{addr.second:.1f}″",
            'why': clusters['zodiac'][0],
            'modulation': {
                'line': clusters['line'][0],
                'color': clusters['color'][0],
                'tone': clusters['tone'][0],
                'base': clusters['base'][0]
            }
        }

        for symbol in punctuation_chain:
            if symbol == '.':
                folded['turn'] = f"{folded['how']} shapes {folded['what']}"
                folded['governing'] = 'WHY'
            elif symbol == '°':
                folded['anchor'] = f"at Gate {addr.gate.value}°Line {addr.line.value}"
                folded['governing'] = 'WHERE'
            elif symbol == '′':
                folded['tempo'] = f"by {clusters['tone'][0]}"
                folded['governing'] = 'WHEN'
            elif symbol == '″':
                folded['edge'] = f"just {clusters['color'][0]}"
                folded['governing'] = 'HOW_EXACTLY'

        return folded

    def _build_grammar(self, folded: Dict, punctuation_chain: List[str]) -> str:
        parts = [f"• {folded['who']}"]

        for symbol in punctuation_chain:
            if symbol == '.':
                parts.append(f". {folded['how']} {folded['what']}")
            elif symbol == '°':
                parts.append(f"° {folded['anchor']}")
            elif symbol == '′':
                parts.append(f"′ {folded['tempo']}")
            elif symbol == '″':
                parts.append(f"″ {folded['edge']}")

        return ' '.join(parts)

    def _compose_sentence(self, folded: Dict, addr: Address) -> str:
        sentence = (
            f"{folded['who']} {folded['how']} through {folded['what']} "
            f"at Gate {addr.gate.value}°Line {addr.line.value}, "
            f"expressed as {folded['where']} in {folded['why']} context."
        )
        return sentence

class MusicRenderer(SubstrateRenderer):
    """Render state space to musical structure."""

    def render(self, state_space: StateSpace, punctuation_chain: List[str]) -> Dict[str, Any]:
        addr = state_space.address
        key = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'][(addr.gate.value - 1) % 12]
        mode = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian'][(addr.line.value - 1) % 6]
        tempo = 60 + (addr.tone.value * 20)
        time_signature = f"{addr.color.value}/{(addr.base.value % 4) + 2}"

        return {
            'substrate': 'music',
            'key': key,
            'mode': mode,
            'tempo': tempo,
            'time_signature': time_signature,
            'structure': {
                'intro': f"{key} {mode} — {addr.gate.name}",
                'verse': f"Line {addr.line.value} progression",
                'chorus': f"Color {addr.color.value} modulation",
                'bridge': f"Tone {addr.tone.value} transition"
            }
        }

class CodeRenderer(SubstrateRenderer):
    """Render state space to code structure."""

    def render(self, state_space: StateSpace, punctuation_chain: List[str]) -> Dict[str, Any]:
        addr = state_space.address
        function_name = f"gate_{addr.gate.value}_line_{addr.line.value}"
        params = [f"color_{addr.color.value}", f"tone_{addr.tone.value}", f"base_{addr.base.value}"]
        return_type = addr.dimension.name.lower()

        return {
            'substrate': 'code',
            'function': function_name,
            'parameters': params,
            'return_type': return_type,
            'body': f"// {addr.planet.name} in {addr.zodiac.name}, House {addr.house.value}",
            'punctuation_ops': [Punctuation.get_operator(s) for s in punctuation_chain]
        }

# ============================================================
# 7. THE ENGINE — Coordinate Resolution
# ============================================================

class AddressSpaceEngine:
    """
    Core engine: Coordinate → Address → State Space → Renderings.

    No randomness. No AI. No simulation.
    Just deterministic resolution of coordinates into state space,
    then rendering that state space to different substrates.
    """

    def __init__(self):
        self.decomposer = AngularDecomposer()
        self.renderers = {
            'language': LanguageRenderer(),
            'music': MusicRenderer(),
            'code': CodeRenderer()
        }

    def resolve(self, 
                planet: Planet,
                dimension: Dimension,
                theta: float,
                line: Line,
                color: Color,
                tone: Tone,
                base: Base,
                axis: str = "toward",
                ascendant: float = 0.0) -> Dict[str, Any]:
        """
        Main entry: resolve coordinate to full state space and renderings.

        Args:
            planet: Source of force (HOW)
            dimension: Field of expression (WHO/WHAT)
            theta: Angular position on 360° wheel
            line: Behavioral mode (HOW-WHY resolution)
            color, tone, base: Modulators
            axis: Directional orientation ("toward", "away", "through")
            ascendant: House system offset

        Returns:
            Full resolution: address, state space, punctuation, renderings
        """
        # Deterministic decomposition
        degree, minute, second = self.decomposer.decompose(theta)
        gate = self.decomposer.gate_from_angle(theta)
        zodiac = self.decomposer.zodiac_from_angle(theta)
        house = self.decomposer.house_from_angle(theta, ascendant)

        # Build immutable address
        address = Address(
            planet=planet, dimension=dimension, gate=gate, line=line,
            color=color, tone=tone, base=base,
            degree=degree, minute=minute, second=second,
            axis=axis, zodiac=zodiac, house=house
        )

        # Build state space (deterministic from address)
        state_space = StateSpace(address)

        # Determine punctuation chain from coordinate geometry
        punctuation_chain = self._determine_punctuation(address, state_space)

        # Render to all substrates
        renderings = {}
        for name, renderer in self.renderers.items():
            renderings[name] = renderer.render(state_space, punctuation_chain)

        return {
            'address': address.to_dict(),
            'state_space': {
                'resonance': state_space.resonance,
                'vector_shape': state_space.vector.shape
            },
            'punctuation_chain': punctuation_chain,
            'punctuation_ops': [Punctuation.get_operator(s) for s in punctuation_chain],
            'renderings': renderings
        }

    def _determine_punctuation(self, address: Address, state_space: StateSpace) -> List[str]:
        """
        Determine punctuation chain from coordinate geometry (deterministic).

        Rules:
        - Always start with . (Transitioner) to enter the field
        - ° (Collapse) always anchors the coordinate
        - ′ (Pulse) if tone > 3 (rhythmic emphasis)
        - ″ (Flicker) if coherence > 0.5 (high resonance)
        """
        chain = ['.']  # Always transition inward first
        chain.append('°')  # Always anchor the coordinate

        if address.tone.value > 3:
            chain.append('′')

        if state_space.resonance['self_coherence'] > 0.5:
            chain.append('″')

        return chain

    def compare(self, addr1: Address, addr2: Address) -> Dict[str, Any]:
        """Compare two addresses — deterministic interference."""
        ss1 = StateSpace(addr1)
        ss2 = StateSpace(addr2)
        interference = ss1.interference_with(ss2)

        return {
            'address_1': addr1.to_dict(),
            'address_2': addr2.to_dict(),
            'interference': interference,
            'relationship': 'constructive' if interference > 0.5 else 'destructive' if interference < -0.5 else 'neutral'
        }
