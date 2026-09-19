"""Shared Blender builder for the forest bears, Dudu and Bubu.

Run from this repository with Blender 4.4+:
    blender --background --python scripts/build-dudu.py
    blender --background --python scripts/build-bubu.py
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
MORPHS = ("Happy", "Shy", "Surprised", "Blink", "Sleepy")


def xyz(v):
    return (v[0], -v[2], v[1])


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


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

    def ring(self, center, radius, thickness, bone, segments=28, rings=8, scale=(1, 1, 1)):
        start = len(self.vertices)
        for j in range(segments + 1):
            a = 2 * math.pi * j / segments
            for i in range(rings + 1):
                b = 2 * math.pi * i / rings
                r = radius + math.cos(b) * thickness
                self.vertex((center[0] + math.sin(a) * r * scale[0],
                             center[1] + math.sin(b) * thickness * scale[1],
                             center[2] + math.cos(a) * r * scale[2]), (j / segments, i / rings), bone)
        for j in range(segments):
            for i in range(rings):
                a = start + j * (rings + 1) + i
                b = a + rings + 1
                self.faces.append((a, b, b + 1, a + 1))

    def tube(self, path, radius, bone, targets=None, steps=40, taper=None):
        start = len(self.vertices)
        for j in range(steps + 1):
            t = j / steps
            for k in range(8):
                a = k / 8 * 2 * math.pi
                def sample(fn, t=t):
                    p = fn(t)
                    r = radius * (taper(t) if taper else 1)
                    return (p[0], p[1] + math.cos(a) * r, p[2] + math.sin(a) * r)
                p = sample(path)
                changes = {name: (lambda _, fn=fn: sample(fn)) for name, fn in (targets or {}).items()}
                self.vertex(p, (t, k / 8), bone, changes)
        for j in range(steps):
            for k in range(8):
                a = start + j * 8 + k
                b = start + j * 8 + (k + 1) % 8
                self.faces.append((a, b, b + 8, a + 8))


def build(bear):
    """Build one bear, save its editable .blend and export its browser GLB."""
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.actions):
        bpy.data.actions.remove(block)

    # An embedded normal texture keeps the soft surface consistent in Blender/WebGL.
    weave = bpy.data.images.new(f"{bear['name']} soft fabric normal", width=128, height=128)
    weave.colorspace_settings.name = "Non-Color"
    rng = random.Random(17)
    pixels = []
    for i in range(128 * 128):
        pixels.extend((.5 + rng.uniform(-.1, .1), .5 + rng.uniform(-.1, .1), 1, 1))
    weave.pixels = pixels
    weave.pack()

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

    palette = {key: material(label, color, plush) for key, (label, color, plush) in bear["palette"].items()}
    surfaces = {name: Surface(name) for name in palette}
    # Shared shapes name a slot; each bear points the slot at one of its materials.
    slot = lambda key: bear["slots"].get(key, key)
    sphere = lambda name, *args, **kwargs: surfaces[slot(name)].ellipsoid(*args, **kwargs)
    limb, form = bear["limb"], bear["shape"]
    head, head_y, power = form["head"], form["head_y"], form["head_power"]

    # Rounded forehead, softly fuller cheeks and a pear-shaped torso.
    def head_shape(p):
        cheek = math.exp(-((p[1] - (head_y - .28)) / (head[1] * .37)) ** 2)
        return (p[0] * (1 + cheek * .035), p[1], p[2])

    sphere("Fur", (0, head_y, 0), head, "Head", 44, 30, power, deform=head_shape)
    sphere("Fur", (0, form["body_y"], -.025), form["body"], "Body", 28, 22, .94,
           deform=lambda p: (p[0] * (1 + (form["body_y"] - .03 - p[1]) * .14), p[1], p[2]))
    # A soft plush tail, visible from the camera that follows the bears.
    sphere("Fur", (0, form["body_y"] - .16, -form["body"][2] - .02), (.155, .16, .15), "Body", 20, 14)
    if form["belly"]:
        # A lighter chest patch breaks up the front of the body.
        sphere("Belly", (0, form["belly"][0], form["belly"][1]), form["belly"][2], "Body", 24, 16, .92)

    def face_z(x, y):
        return head[2] * max(.015, 1 - abs(x / head[0]) ** (2 / power) - abs((y - head_y) / head[1]) ** (2 / power)) ** (power / 2)

    for side in (-1, 1):
        suffix = "L" if side < 0 else "R"
        sphere("EarOuter", (side * form["ear_x"], form["ear_y"], form["ear_z"]), form["ear"], f"Ear_{suffix}")
        sphere("Ear", (side * form["ear_x"], form["ear_y"] + .005, form["ear_z"] + form["ear"][2] * .8), form["ear_inner"], f"Ear_{suffix}")
        # A continuous arm mesh receives smooth weights across the elbow.
        def arm_weights(p, suffix=suffix):
            lower = max(0, min(1, (.78 - p[1]) / .19))
            return {f"Arm_{suffix}": 1 - lower, f"Forearm_{suffix}": lower}
        sphere("Fur", (side * .565, .64, .035), (.182, .31 * limb, .19), arm_weights, 26, 18, .95)
        # Soft pads finish each front paw, with three little toe beans.
        wrist = .64 - .31 * limb
        sphere("Paw", (side * .565, wrist + .035, .09), (.105, .055, .145), f"Forearm_{suffix}", 18, 10)
        for toe in (-1, 0, 1):
            sphere("Paw", (side * .565 + toe * .05, wrist + .042, .175), (.03, .025, .028), f"Forearm_{suffix}", 10, 8)
        # The ankle bends inside the leg so the sole can stay level and roll off the toes.
        def leg_weights(p, suffix=suffix):
            lower = max(0, min(1, (.145 - p[1]) / .105))
            return {f"Leg_{suffix}": 1 - lower, f"Foot_{suffix}": lower}
        sphere("Fur", (side * .28, .205, .055), (.23, .225 * limb, .285), leg_weights, 24, 16, .92,
               deform=lambda p: (p[0], max(.015, p[1]), p[2]))
        sphere("Paw", (side * .28, .052, .105), (.17, .045, .215), f"Foot_{suffix}", 20, 12)
        x, y = side * form["eye_x"], form["eye_y"]
        eye_z = face_z(x, y) + .018
        def eye_change(p, kind, x=x, y=y):
            dx, dy = p[0] - x, p[1] - y
            if kind == "Happy":
                return (p[0], y + dy * .16 + .026 * (1 - (dx / form["eye"][0]) ** 2), p[2])
            if kind == "Blink":
                return (p[0], y + dy * .06, p[2])
            if kind == "Sleepy":
                # Heavy lids close the eye from above without shrinking the smile.
                return (p[0], min(y + .012, y + dy * .52) - .013, p[2])
            if kind == "Shy":
                return (p[0] - side * .009, y + dy * .78 - .016, p[2])
            return (x + dx * 1.12, y + dy * 1.22 + .01, p[2])
        sphere("Dark", (x, y, eye_z), form["eye"], "Head", 22, 14,
               changes={name: lambda p, name=name: eye_change(p, name) for name in MORPHS})
        # Highlights flatten with the eyelids so no white dots float above a smile.
        sphere("White", (x - form["eye"][0] * .3, y + form["eye"][1] * .28, eye_z + form["eye"][2]), 
               (.013, .016, .005), "Head", 12, 8,
               changes={name: lambda p, name=name: eye_change(p, name) for name in MORPHS})
        cx, cy = side * form["cheek_x"], form["cheek_y"]
        sphere("Cheeks", (cx, cy, face_z(cx, cy) + .011), form["cheek"], "Head", 22, 12,
               changes={"Shy": lambda p, cx=cx, cy=cy: (cx + (p[0] - cx) * 1.15, cy + (p[1] - cy) * 1.17, p[2] + .003)})

        # Fine brows carry most of the mood: raised in surprise, drawn in when shy,
        # softened by a smile and lowered when sleepy.
        def brow_path(t, kind="Calm", side=side, x=x):
            span, lift, tilt = form["brow_span"], .0, 0.
            if kind == "Surprised":
                span, lift, tilt = form["brow_span"] * 1.08, .038, .012
            elif kind == "Shy":
                span, lift, tilt = form["brow_span"] * .89, -.012, -.022
            elif kind == "Happy":
                span, lift, tilt = form["brow_span"] * .97, .006, .008
            elif kind == "Sleepy":
                span, lift, tilt = form["brow_span"] * .92, -.02, -.014
            bx = x + (t - .5) * span * 2
            by = form["brow_y"] + lift + math.sin(t * math.pi) * .016 + tilt * side * (t - .5) * 2
            return (bx, by, face_z(bx, by) + .022)
        surfaces[slot("Brow")].tube(brow_path, .0115, "Head",
            {name: lambda t, name=name: brow_path(t, name) for name in MORPHS if name != "Blink"},
            steps=12, taper=lambda t: .45 + math.sin(t * math.pi) * .8)

    if form["muzzle"]:
        sphere("Muzzle", (0, form["muzzle"][0], form["muzzle"][1]), form["muzzle"][2], "Head", 28, 18)
    nose_y, nose_z, nose = form["nose"]
    sphere("Dark", (0, nose_y, nose_z), nose, "Head", 20, 14, .9)
    sphere("White", (-nose[0] * .3, nose_y + nose[1] * .32, nose_z + nose[2] * .7), (.009, .007, .005), "Head", 10, 8)

    def mouth_path(t, kind="Calm"):
        span, drop = form["mouth_span"], form["mouth_y"]
        x = (t - .5) * span
        y = drop - .024 * math.sin(t * math.pi * 2) ** 2
        if kind == "Happy":
            x *= 1.18
            y = drop + .004 - .052 * math.sin(t * math.pi)
        elif kind == "Shy":
            x *= .8
            y -= .008
        elif kind == "Sleepy":
            x *= .86
            y = drop + .002 - .026 * math.sin(t * math.pi)
        elif kind == "Surprised":
            x = math.sin(t * 2 * math.pi) * .038
            y = drop - .062 + math.cos(t * 2 * math.pi) * .052
        return (x, y, face_z(x, y) + .055)
    surfaces[slot("Mouth")].tube(mouth_path, .012, "Head",
        {name: lambda t, name=name: mouth_path(t, name) for name in MORPHS if name != "Blink"})

    bear["extras"](sphere, surfaces, slot)

    # Every bone uses the same rest orientation. Named pivots match the live game.
    rig_data = bpy.data.armatures.new(f"{bear['name']} skeleton")
    rig = bpy.data.objects.new(f"{bear['name']}Rig", rig_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {"Body": ((0, 0, 0), None), "Head": ((0, form["head_y"], 0), "Body"), "Pack": ((0, .73, -.49), "Body")}
    for side in (-1, 1):
        s = "L" if side < 0 else "R"
        bones.update({f"Arm_{s}": ((side * .52, .86, 0), "Body"),
                      f"Forearm_{s}": ((side * .545, .64 - .31 * limb + .05, .025), f"Arm_{s}"),
                      f"Leg_{s}": ((side * .28, .24, 0), "Body"),
                      f"Foot_{s}": ((side * .28, .085, .04), f"Leg_{s}"),
                      f"Ear_{s}": ((side * form["ear_x"], form["ear_y"], form["ear_z"]), "Head")})
    for name, (position, parent) in bones.items():
        bone = rig_data.edit_bones.new(name)
        bone.head = xyz(position)
        bone.tail = bone.head + Vector((0, 0, .18))
        if parent:
            bone.parent = rig_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    meshes = []
    for name, surface in surfaces.items():
        if not surface.vertices:
            continue
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(surface.vertices, [], surface.faces)
        mesh.update()
        obj = bpy.data.objects.new(f"{bear['name']}_{name}", mesh)
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
    # with any clip. The game can also drive these named bones for story poses.
    scene = bpy.context.scene
    scene.render.fps = 30
    convert = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_quaternion()
    def rotate(bone, x=0, y=0, z=0):
        q = convert @ Euler((x, y, z), "XYZ").to_quaternion() @ convert.inverted()
        rest = bone.bone.matrix_local.to_quaternion()
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = rest.inverted() @ q @ rest

    def step_pose(phase, reach, lift, swing, pitch):
        """One walking or running stride, including the ankle roll on each foot."""
        rig.pose.bones["Body"].location.y = (1 - math.cos(phase * 2)) * lift
        rotate(rig.pose.bones["Body"], x=pitch, z=math.sin(phase) * .022, y=-math.sin(phase) * .05)
        rotate(rig.pose.bones["Head"], x=math.sin(phase * 2) * .013 - pitch * .55, z=-math.sin(phase) * .015,
               y=math.sin(phase) * .028)
        for i, side in enumerate(("L", "R")):
            step = math.sin(phase + i * math.pi)
            rotate(rig.pose.bones[f"Leg_{side}"], x=step * reach)
            rotate(rig.pose.bones[f"Foot_{side}"], x=(step * .4 if step > 0 else step * .2) - step * reach)
            rotate(rig.pose.bones[f"Arm_{side}"], x=-step * swing)
            rotate(rig.pose.bones[f"Forearm_{side}"], x=-.12 - max(0, -step) * .18 - pitch * 1.6)

    rig.animation_data_create()
    for name, frames in (("Idle", 72), ("Walk", 32), ("Run", 24), ("Wave", 60)):
        rig.animation_data.action = None
        for frame in range(frames + 1):
            phase = frame / frames * math.pi * 2
            for bone in rig.pose.bones:
                bone.location = (0, 0, 0)
                rotate(bone)
            if name == "Walk":
                step_pose(phase, .43, .019, .3, 0)
            elif name == "Run":
                step_pose(phase, .58, .042, .48, .08)
            elif name == "Wave":
                # A greeting that begins and ends at rest, so the clip still loops.
                envelope = math.sin(frame / frames * math.pi) ** 2
                rig.pose.bones["Body"].location.y = math.sin(phase) * .008
                rotate(rig.pose.bones["Body"], z=-.03 * envelope)
                rotate(rig.pose.bones["Head"], z=.09 * envelope, y=-.05 * envelope)
                rotate(rig.pose.bones["Arm_R"], x=-.75 * envelope, z=-.95 * envelope)
                rotate(rig.pose.bones["Forearm_R"], x=-.55 * envelope,
                       z=math.sin(frame / frames * math.pi * 8) * .34 * envelope)
                rotate(rig.pose.bones["Arm_L"], x=-.12 * envelope)
                for side in ("L", "R"):
                    rotate(rig.pose.bones[f"Ear_{side}"], z=(-.06 if side == "L" else .06) * envelope)
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
    rig["description"] = bear["description"]
    rig["reference"] = "User-provided Dudu/Bubu reels; modeled from scratch, no extracted mesh."
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig

    # No lights, ground or camera enter the browser model.
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f"{bear['file']}.glb"), export_format="GLB",
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
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{bear['file']}.blend"), compress=True)
    report = {"blender": bpy.app.version_string, "bones": len(bones),
        "triangles": sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in meshes),
        "materials": len(meshes), "expressions": list(MORPHS),
        "animations": ["Idle", "Walk", "Run", "Wave"],
        "bytes": (OUTPUT / f"{bear['file']}.glb").stat().st_size}
    (OUTPUT / f"{bear['file']}.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"{bear['file'].upper()}_EXPORT " + json.dumps(report))
