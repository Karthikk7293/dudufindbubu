"""Build the editable Dudu prototype and its browser asset with Blender 4.4+.

Run from this repository: blender --background --python scripts/build-dudu.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bear_builder import build


def extras(sphere, surfaces, slot):
    # The reference's tiny tuft, blue tie, canvas gift bag, piping and keepsake.
    sphere("Blue", (0, 2.355, -.015), (.093, .028, .085), "Head", 24, 12)
    for i in (-1, 0, 1):
        sphere("Fur", (i * .05, 2.423 + (.025 if i == 0 else 0), -.015), (.056, .091, .056), "Head", 16, 12)
    sphere("Bag", (0, .73, -.49), (.43, .39, .25), "Pack", 28, 20, .55)
    sphere("Trim", (0, 1.02, -.55), (.405, .095, .22), "Pack", 28, 16, .65)
    sphere("Trim", (0, .61, -.725), (.285, .16, .03), "Pack", 24, 16, .65)
    sphere("Gold", (0, .85, -.748), (.046, .065, .019), "Pack", 16, 12, .7)
    for side in (-1, 1):
        surfaces["Bag"].tube(lambda t, side=side: (side * (.36 + .052 * math.sin(t * math.pi)),
            1.06 - .47 * t, -.25 + .65 * math.sin(t * math.pi * .65)), .025, "Body", steps=28)
    surfaces["Gold"].tube(lambda t: (-.405, .78 - .15 * t, .41), .01, "Body", steps=10)
    sphere("White", (-.405, .51, .435), (.081, .12, .056), "Body", 16, 12)
    sphere("White", (-.405, .648, .445), (.12, .095, .065), "Body", 20, 14, .94)
    for side in (-1, 1):
        sphere("White", (-.405 + side * .09, .72, .445), (.04, .038, .035), "Body", 12, 8)
        sphere("Dark", (-.405 + side * .037, .645, .505), (.01, .013, .006), "Body", 12, 8)
    sphere("Dark", (-.405, .62, .512), (.012, .008, .005), "Body", 12, 8)


build({
    "name": "Dudu",
    "file": "dudu",
    "limb": 1,
    "shape": {
        "head": (1, .87, .8), "head_y": 1.68, "head_power": .9,
        "body": (.52, .55, .44), "body_y": .62,
        "belly": None,
        "ear": (.245, .25, .185), "ear_inner": (.15, .155, .028),
        "ear_x": .7, "ear_y": 2.34, "ear_z": -.05,
        "eye": (.082, .094, .034), "eye_x": .265, "eye_y": 1.34,
        "cheek": (.175, .16, .033), "cheek_x": .5, "cheek_y": 1.25,
        "brow_y": 1.51, "brow_span": .078,
        "muzzle": None,
        "nose": (1.25, .705, (.03, .023, .016)),
        "mouth_y": 1.17, "mouth_span": .162,
    },
    "palette": {
        "Fur": ("Honey plush", "BD895F", True),
        "Muzzle": ("Warm muzzle", "D4A579", True),
        "Dark": ("Cocoa face", "362522", False),
        "Cheeks": ("Peach cheeks", "DBAB87", True),
        "Ear": ("Ear velvet", "916544", True),
        "Bag": ("Sage canvas", "77866A", True),
        "Trim": ("Canvas piping", "A1AB85", True),
        "Gold": ("Brass button", "D8BB7B", False),
        "White": ("Bubu keepsake", "FFF8E9", True),
        "Blue": ("Blue hair band", "597E8C", False),
    },
    "slots": {"EarOuter": "Fur", "Paw": "Muzzle", "Belly": "Muzzle", "Brow": "Dark", "Mouth": "Dark"},
    "extras": extras,
    "description": "Dudu: soft skinned limbs and ankles, brows, paw pads, "
                   "Happy/Shy/Surprised/Blink/Sleepy morphs, Idle/Walk/Run/Wave clips.",
})
