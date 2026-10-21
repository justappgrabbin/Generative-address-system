# Driver appended after the donor address_space_engine.py (donor file itself is not modified).
import json
engine = AddressSpaceEngine()
for args in [
    (Planet.SUN, Dimension.BEING, 123.456, Line.L3, Color.C4, Tone.T5, Base.B2),
    (Planet.MOON, Dimension.DESIGN, 7.5, Line.L1, Color.C1, Tone.T1, Base.B1),
    (Planet.SUN, Dimension.BEING, 359.9, Line.L6, Color.C6, Tone.T6, Base.B5),
]:
    r = engine.resolve(*args)
    print(json.dumps(r, sort_keys=True, default=str))
a = engine.resolve(Planet.SUN, Dimension.BEING, 10.0, Line.L1, Color.C1, Tone.T1, Base.B1)
b = engine.resolve(Planet.MOON, Dimension.DESIGN, 200.0, Line.L4, Color.C3, Tone.T2, Base.B4)
print(sorted(a.keys()))
