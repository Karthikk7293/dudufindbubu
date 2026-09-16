"""Build the editable Dudu prototype and its browser asset with Blender 4.4+.

Run from this repository: blender --background --python scripts/build-dudu.py
Coordinates below use the game's Y-up / +Z-forward convention.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/characters"
OUTPUT = ROOT / "public/models/characters"
SOURCE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.actions):
    bpy.data.actions.remove(block)

def xyz(v):
    return (v[0], -v[2], v[1])

def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def material(name, color, plush=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4))
    m.diffuse_color = (*rgb, 1)
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .88 if plush else .65
    if plush:
        shader.inputs["Sheen Weight"].default_value = .35
        shader.inputs["Sheen Roughness"].default_value = .8
        normal = m.node_tree.nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = .18
        texture = m.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = weave
        m.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
        m.node_tree.links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    return m

# An embedded normal texture keeps the soft surface consistent in Blender/WebGL.
weave = bpy.data.images.new("Dudu soft fabric normal", width=128, height=128)
weave.colorspace_settings.name = "Non-Color"
rng = random.Random(17)
pixels = []
for i in range(128 * 128):
    pixels.extend((.5 + rng.uniform(-.1, .1), .5 + rng.uniform(-.1, .1), 1, 1))
weave.pixels = pixels
weave.pack()
palette = {
    "Fur": material("Honey plush", "BD895F", True),
    "Muzzle": material("Warm muzzle", "D4A579", True),
    "Dark": material("Cocoa face", "362522"),
    "Cheeks": material("Peach cheeks", "DBAB87", True),
    "Ear": material("Ear velvet", "916544", True),
    "Bag": material("Sage canvas", "77866A", True),
    "Trim": material("Canvas piping", "A1AB85", True),
    "Gold": material("Brass button", "D8BB7B"),
    "White": material("Bubu keepsake", "FFF8E9", True),
    "Blue": material("Blue hair band", "597E8C"),
}
MORPHS = ("Happy", "Shy", "Surprised", "Blink")

class Surface:
    def __init__(self, name):
        self.name, self.vertices, self.faces, self.uv, self.weights = name, [], [], [], []
        self.targets = {name: [] for name in MORPHS}

    def vertex(self, p, uv, weight, changes=None):
        index = len(self.vertices)
        self.vertices.append(xyz(p))
        self.uv.append(uv)
        self.weights.append(weight(p) if callable(weight) else {weight: 1})
        for name in MORPHS:
            target = changes[name](p) if changes and name in changes else p
            self.targets[name].append(xyz(target))
        return index

    def ellipsoid(self, center, size, bone, segments=24, rings=16, power=1, changes=None, deform=None):
        start = len(self.vertices)
        soft = lambda n: math.copysign(abs(n) ** power, n)
        for j in range(rings + 1):
            lat = -math.pi / 2 + math.pi * j / rings
            for i in range(segments + 1):
                lon = 2 * math.pi * i / segments
                p = (center[0] + soft(math.cos(lat) * math.cos(lon)) * size[0],
                     center[1] + soft(math.sin(lat)) * size[1],
                     center[2] + soft(math.cos(lat) * math.sin(lon)) * size[2])
                self.vertex(deform(p) if deform else p, (i / segments, j / rings), bone, changes)
        for j in range(rings):
            for i in range(segments):
                a = start + j * (segments + 1) + i
                b = a + segments + 1
                # Outward winding after the orientation-preserving Y/Z conversion.
                self.faces.append((a, b, b + 1, a + 1))

    def tube(self, path, radius, bone, targets=None, steps=40):
        start = len(self.vertices)
        for j in range(steps + 1):
            t = j / steps
            for k in range(8):
                a = k / 8 * 2 * math.pi
                def sample(fn):
                    p = fn(t)
                    return (p[0], p[1] + math.cos(a) * radius, p[2] + math.sin(a) * radius)
                p = sample(path)
                changes = {name: (lambda _, fn=fn: sample(fn)) for name, fn in (targets or {}).items()}
                self.vertex(p, (t, k / 8), bone, changes)
        for j in range(steps):
            for k in range(8):
                a = start + j * 8 + k
                b = start + j * 8 + (k + 1) % 8
                self.faces.append((a, b, b + 8, a + 8))

surfaces = {name: Surface(name) for name in palette}
sphere = lambda name, *args, **kwargs: surfaces[name].ellipsoid(*args, **kwargs)

# Rounded forehead, softly fuller cheeks and a pear-shaped torso.
def head_shape(p):
    x, y, z = p
    cheek = math.exp(-((y - 1.34) / .28) ** 2)
    return (x * (1 + cheek * .035), y, z)

sphere("Fur", (0, 1.62, 0), (.91, .75, .64), "Head", 48, 32, .91, deform=head_shape)
sphere("Fur", (0, .68, -.025), (.54, .59, .425), "Body", 32, 24, .94,
       deform=lambda p: (p[0] * (1 + (.65 - p[1]) * .14), p[1], p[2]))
sphere("Fur", (0, .44, -.45), (.14, .145, .14), "Body")

def face_z(x, y):
    return .64 * max(.015, 1 - abs(x / .91) ** (2 / .91) - abs((y - 1.62) / .75) ** (2 / .91)) ** (.91 / 2)

for side in (-1, 1):
    suffix = "L" if side < 0 else "R"
    sphere("Fur", (side * .67, 2.20, -.045), (.23, .235, .17), f"Ear_{suffix}")
    sphere("Ear", (side * .67, 2.205, .109), (.145, .15, .028), f"Ear_{suffix}")
    # A continuous arm mesh receives smooth weights across the elbow.
    def arm_weights(p, suffix=suffix):
        lower = max(0, min(1, (.78 - p[1]) / .19))
        return {f"Arm_{suffix}": 1 - lower, f"Forearm_{suffix}": lower}
    sphere("Fur", (side * .565, .64, .035), (.182, .31, .19), arm_weights, 28, 22, .95)
    sphere("Fur", (side * .28, .205, .055), (.23, .225, .285), f"Leg_{suffix}", 28, 18, .92,
           deform=lambda p: (p[0], max(.015, p[1]), p[2]))
    sphere("Muzzle", (side * .28, .08, .265), (.105, .044, .025), f"Leg_{suffix}")
    x, y = side * .215, 1.325
    eye_z = face_z(x, y) + .018
    def eye_change(p, kind, x=x, y=y):
        dx, dy = p[0] - x, p[1] - y
        if kind == "Happy":
            return (p[0], y + dy * .16 + .026 * (1 - (dx / .054) ** 2), p[2])
        if kind == "Blink":
            return (p[0], y + dy * .06, p[2])
        if kind == "Shy":
            return (p[0] - side * .009, y + dy * .78 - .016, p[2])
        return (x + dx * 1.12, y + dy * 1.22 + .01, p[2])
    sphere("Dark", (x, y, eye_z), (.054, .069, .025), "Head", 24, 16,
           changes={name: lambda p, name=name: eye_change(p, name) for name in MORPHS})
    # Highlights flatten with the eyelids so no white dots float above a smile.
    sphere("White", (x - .014, y + .018, eye_z + .024), (.011, .014, .005), "Head", 12, 8,
           changes={name: lambda p, name=name: eye_change(p, name) for name in MORPHS})
    cx, cy = side * .47, 1.24
    sphere("Cheeks", (cx, cy, face_z(cx, cy) + .011), (.123, .075, .027), "Head", 24, 14,
           changes={"Shy": lambda p, cx=cx, cy=cy: (cx + (p[0] - cx) * 1.15, cy + (p[1] - cy) * 1.17, p[2] + .003)})

sphere("Muzzle", (0, 1.252, .611), (.095, .052, .032), "Head", 32, 20)
sphere("Dark", (0, 1.272, .648), (.037, .027, .021), "Head", 24, 16, .9)

def mouth_path(t, kind="Calm"):
    x = (t - .5) * .17
    y = 1.194 - .024 * math.sin(t * math.pi * 2) ** 2
    if kind == "Happy":
        x *= 1.18
        y = 1.198 - .052 * math.sin(t * math.pi)
    elif kind == "Shy":
        x *= .8
        y -= .008
    elif kind == "Surprised":
        x = math.sin(t * 2 * math.pi) * .038
        y = 1.132 + math.cos(t * 2 * math.pi) * .052
    return (x, y, face_z(x, y) + .055)
surfaces["Dark"].tube(mouth_path, .012, "Head",
    {name: lambda t, name=name: mouth_path(t, name) for name in MORPHS if name != "Blink"})

# The reference's tiny tuft, blue tie, canvas gift bag, piping and keepsake.
sphere("Blue", (0, 2.355, -.015), (.093, .028, .085), "Head", 24, 12)
for i in (-1, 0, 1):
    sphere("Fur", (i * .05, 2.423 + (.025 if i == 0 else 0), -.015), (.056, .091, .056), "Head", 16, 12)
sphere("Bag", (0, .73, -.49), (.43, .39, .25), "Pack", 32, 24, .55)
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

# Every bone uses the same rest orientation. Named pivots match the live game.
rig_data = bpy.data.armatures.new("Dudu skeleton")
rig = bpy.data.objects.new("DuduRig", rig_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bones = {"Body": ((0, 0, 0), None), "Head": ((0, 1.62, 0), "Body"), "Pack": ((0, .73, -.49), "Body")}
for side in (-1, 1):
    s = "L" if side < 0 else "R"
    bones.update({f"Arm_{s}": ((side * .52, .86, 0), "Body"),
                  f"Forearm_{s}": ((side * .545, .69, .025), f"Arm_{s}"),
                  f"Leg_{s}": ((side * .28, .24, 0), "Body"),
                  f"Ear_{s}": ((side * .67, 2.20, -.045), "Head")})
for name, (position, parent) in bones.items():
    bone = rig_data.edit_bones.new(name)
    bone.head = xyz(position)
    bone.tail = bone.head + Vector((0, 0, .18))
    if parent:
        bone.parent = rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
meshes = []
for name, surface in surfaces.items():
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(surface.vertices, [], surface.faces)
    mesh.update()
    obj = bpy.data.objects.new("Dudu_" + name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(palette[name])
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop in polygon.loop_indices:
            uv.data[loop].uv = surface.uv[mesh.loops[loop].vertex_index]
    groups = {bone: obj.vertex_groups.new(name=bone) for bone in bones}
    for index, weights in enumerate(surface.weights):
        for bone, weight in weights.items():
            if weight > 0:
                groups[bone].add([index], weight, "REPLACE")
    # Only face meshes need morph data; body vertices are not duplicated for emotions.
    active = [key for key in MORPHS if surface.targets[key] != surface.vertices]
    if active:
        obj.shape_key_add(name="Basis")
        for key in active:
            shape = obj.shape_key_add(name=key)
            shape.data.foreach_set("co", [v for p in surface.targets[key] for v in p])
    modifier = obj.modifiers.new("Soft joint deformation", "ARMATURE")
    modifier.object = rig
    obj.parent = rig
    meshes.append(obj)

# Reusable authored clips. Facial morphs stay independent so expressions can mix
# with either clip. The game can also drive these named bones for story poses.
scene = bpy.context.scene
scene.render.fps = 30
convert = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_quaternion()
def rotate(bone, x=0, y=0, z=0):
    q = convert @ Euler((x, y, z), "XYZ").to_quaternion() @ convert.inverted()
    rest = bone.bone.matrix_local.to_quaternion()
    bone.rotation_mode = "QUATERNION"
    bone.rotation_quaternion = rest.inverted() @ q @ rest

rig.animation_data_create()
for name, frames in (("Idle", 72), ("Walk", 32)):
    rig.animation_data.action = None
    for frame in range(frames + 1):
        phase = frame / frames * math.pi * 2
        for bone in rig.pose.bones:
            bone.location = (0, 0, 0)
            rotate(bone)
        if name == "Walk":
            rig.pose.bones["Body"].location.y = (1 - math.cos(phase * 2)) * .019
            rotate(rig.pose.bones["Body"], z=math.sin(phase) * .022)
            rotate(rig.pose.bones["Head"], x=math.sin(phase * 2) * .013, z=-math.sin(phase) * .015)
            for i, side in enumerate(("L", "R")):
                step = math.sin(phase + i * math.pi)
                rotate(rig.pose.bones[f"Leg_{side}"], x=step * .43)
                rotate(rig.pose.bones[f"Arm_{side}"], x=-step * .3)
                rotate(rig.pose.bones[f"Forearm_{side}"], x=-.12 - max(0, -step) * .18)
        else:
            rig.pose.bones["Body"].location.y = math.sin(phase) * .01
            rotate(rig.pose.bones["Head"], y=math.sin(phase) * .025, z=math.cos(phase) * .012)
        for bone in rig.pose.bones:
            bone.keyframe_insert("rotation_quaternion", frame=frame)
            bone.keyframe_insert("location", frame=frame)
    action = rig.animation_data.action
    action.name = name
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.action_slot = rig.animation_data.action_slot
    track.mute = True
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.location = (0, 0, 0)
    rotate(bone)
scene.frame_set(0)
scene.frame_end = 72
rig["description"] = "Dudu prototype: soft skinned limbs, Happy/Shy/Surprised/Blink morphs, Idle/Walk clips."
rig["reference"] = "User-provided Dudu/Bubu reels; modeled from scratch, no extracted mesh."
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig

# No lights, ground or camera enter the browser model.
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / "dudu.glb"), export_format="GLB",
    use_selection=True, export_animations=True, export_animation_mode="ACTIONS",
    export_morph=True, export_morph_animation=False, export_skins=True,
    export_force_sampling=True, export_frame_range=False, export_extras=True,
    export_try_sparse_sk=True, export_texcoords=True, export_yup=True)
# Open the source file on the character, with material colors and an idle action
# ready to play. These editor settings do not affect the exported rest pose.
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
rig.animation_data.action = bpy.data.actions["Idle"]
rig.animation_data.action_slot = bpy.data.actions["Idle"].slots[0]
scene.frame_set(0)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            space = area.spaces.active
            space.shading.color_type = "MATERIAL"
            space.overlay.show_floor = False
            space.region_3d.view_location = Vector((0, 0, 1.2))
            space.region_3d.view_distance = 4.8
            space.region_3d.view_rotation = Vector((3, -6, 1.3)).to_track_quat("Z", "Y")
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "dudu.blend"), compress=True)
report = {"blender": bpy.app.version_string, "bones": len(bones),
    "triangles": sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in meshes),
    "materials": len(palette), "expressions": list(MORPHS), "animations": ["Idle", "Walk"],
    "bytes": (OUTPUT / "dudu.glb").stat().st_size}
(OUTPUT / "dudu.json").write_text(json.dumps(report, indent=2) + "\n")
print("DUDU_EXPORT " + json.dumps(report))
