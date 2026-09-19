"""Build the editable Bubu prototype and its browser asset with Blender 4.4+.

Run from this repository: blender --background --python scripts/build-bubu.py
Proportions follow the user's Bubu reference frames: a large round head, small
cocoa ears, low worried eyes, wide soft blush, mitten paws and a neat neck bow.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bear_builder import build


def tilt(cx, cy, angle):
    """Rotate an ellipsoid about the Z axis so the bow loops fan out from the knot."""
    cos, sin = math.cos(angle), math.sin(angle)
    def deform(p):
        dx, dy = p[0] - cx, p[1] - cy
        return (cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, p[2])
    return deform


def extras(sphere, surfaces, slot):
    # A flat ribbon collar with a small knot and two loops, as in the reference.
    surfaces["Tips"].ring((0, .87, -.015), .4, .03, "Body", 28, 8, (1, 1, .88))
    for side in (-1, 1):
        sphere("Tips", (side * .085, .785, .325), (.052, .092, .038), "Body", 18, 12,
               deform=tilt(side * .085, .785, side * .38))
    sphere("Ribbon", (0, .862, .345), (.055, .05, .042), "Body", 18, 12)


build({
    "name": "Bubu",
    "file": "bubu",
    "limb": .8,
    "shape": {
        "head": (1.02, .92, .84), "head_y": 1.72, "head_power": .9,
        "body": (.5, .55, .41), "body_y": .58,
        "belly": None,
        "ear": (.215, .22, .17), "ear_inner": (.12, .125, .026),
        "ear_x": .7, "ear_y": 2.42, "ear_z": -.03,
        "eye": (.092, .105, .036), "eye_x": .28, "eye_y": 1.36,
        "cheek": (.185, .17, .034), "cheek_x": .49, "cheek_y": 1.27,
        "brow_y": 1.54, "brow_span": .082,
        "muzzle": None,
        "nose": (1.27, .755, (.028, .021, .015)),
        "mouth_y": 1.19, "mouth_span": .155,
    },
    "palette": {
        "Fur": ("Snow plush", "FFFAF2", True),
        "Muzzle": ("Cream underside", "FFF3E2", True),
        "Dark": ("Cocoa face", "3B2A24", False),
        "Tips": ("Cocoa tips", "4A342B", True),
        "Cheeks": ("Rose cheeks", "EFAFAC", True),
        "Ear": ("Ear velvet", "6C4C3D", True),
        "White": ("Eye highlight", "FFF8E9", True),
        "Ribbon": ("Bow knot", "342420", False),
    },
    "slots": {"EarOuter": "Tips", "Paw": "Tips", "Belly": "Muzzle", "Brow": "Dark", "Mouth": "Dark"},
    "extras": extras,
    "description": "Bubu: large round head, cocoa ears and mitten paws, neck bow, brows, "
                   "Happy/Shy/Surprised/Blink/Sleepy morphs, Idle/Walk/Run/Wave clips.",
})
