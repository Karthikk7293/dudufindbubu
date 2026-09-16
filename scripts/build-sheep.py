"""Build the forest sheep. Run: blender --background --python scripts/build-sheep.py.

The editable source stays in art/characters; only the compact GLB ships to players.
All design coordinates use the game's Y-up / +Z-forward convention.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parents[1]
SOURCE, OUTPUT = ROOT / 'art/characters', ROOT / 'public/models/characters'
SOURCE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

def xyz(p): return (p[0], -p[2], p[1])
def linear(x): return x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4

# A small packed texture adds fibre detail without strands or extra geometry.
texture = bpy.data.images.new('Fine wool normal', width=128, height=128)
texture.colorspace_settings.name = 'Non-Color'
rng = random.Random(91)
pixels = []
for y in range(128):
    for x in range(128):
        pixels.extend((.5 + .085 * math.sin(x * .9 + math.sin(y * .3)) + rng.uniform(-.035, .035),
                       .5 + .085 * math.cos(y * .95 + math.sin(x * .25)) + rng.uniform(-.035, .035), 1, 1))
texture.pixels = pixels
texture.pack()

def material(name, color, wool=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4))
    mat.diffuse_color = (*rgb, 1)
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Roughness'].default_value = .94 if wool else .76
    if wool:
        shader.inputs['Sheen Weight'].default_value = .32
        shader.inputs['Sheen Roughness'].default_value = .9
        image = mat.node_tree.nodes.new('ShaderNodeTexImage')
        image.image = texture
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .16
        mat.node_tree.links.new(image.outputs['Color'], normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
    return mat

palette = {'Wool': material('Ivory fleece', 'F1E8D3', True),
           'Face': material('Warm grey velvet', '82796E'),
           'Hoof': material('Cloven hooves', '514B45'),
           'Dark': material('Eyes and smile', '302A25'),
           'Ear': material('Inner ear rose', 'C6A396')}

class Surface:
    def __init__(self):
        self.vertices, self.faces, self.uv, self.weights, self.blink = [], [], [], [], []

    def vertex(self, p, uv, bone, blink=None):
        self.vertices.append(xyz(p))
        self.uv.append(uv)
        self.weights.append(bone(p) if callable(bone) else {bone: 1})
        self.blink.append(xyz(blink(p) if blink else p))

    def sphere(self, center, size, bone, segments=20, rings=12, wool=False, blink=None, deform=None):
        start = len(self.vertices)
        for j in range(rings + 1):
            lat = -math.pi / 2 + math.pi * j / rings
            for i in range(segments + 1):
                lon = i / segments * math.pi * 2
                unit = (math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon))
                # One continuous fleece surface, with soft interlocking curls.
                bump = 1
                if wool:
                    bump += .045 * math.cos(lat) ** 2 * math.cos(12 * lon + 1.8 * math.sin(lat * 7)) * math.cos(lat * 12)
                    bump += .022 * math.cos(lat) ** 2 * math.cos(lat * 7 + math.sin(lon * 5))
                p = tuple(center[k] + unit[k] * size[k] * bump for k in range(3))
                self.vertex(deform(p) if deform else p, (i / segments, j / rings), bone, blink)
        for j in range(rings):
            for i in range(segments):
                a = start + j * (segments + 1) + i
                b = a + segments + 1
                self.faces.append((a, b, b + 1, a + 1))

    def line(self, path, radius, bone, steps=20):
        start = len(self.vertices)
        for j in range(steps + 1):
            p = path(j / steps)
            for k in range(6):
                angle = k / 6 * math.pi * 2
                self.vertex((p[0], p[1] + math.cos(angle) * radius, p[2] + math.sin(angle) * radius), (j / steps, k / 6), bone)
        for j in range(steps):
            for k in range(6):
                a = start + j * 6 + k
                b = start + j * 6 + (k + 1) % 6
                self.faces.append((a, b, b + 6, a + 6))

surfaces = {name: Surface() for name in palette}
sphere = lambda material, *args, **kwargs: surfaces[material].sphere(*args, **kwargs)
sphere('Wool', (0, .89, -.02), (.475, .43, .68), 'Body', 56, 36, wool=True)
sphere('Face', (0, .95, .47), (.18, .245, .175),
       lambda p: {'Body': 1 - max(0, min(1, (p[1] - .78) / .27)), 'Neck': max(0, min(1, (p[1] - .78) / .27))})
sphere('Face', (0, 1.055, .63), (.235, .275, .28), 'Head', 28, 20)
sphere('Face', (0, .895, .835), (.153, .115, .135), 'Jaw', 24, 16)
sphere('Wool', (0, 1.295, .61), (.27, .18, .245), 'Head', 36, 20, wool=True)

for side in (-1, 1):
    suffix = 'L' if side < 0 else 'R'
    sphere('Face', (side * .385, 1.105, .585), (.225, .078, .112), f'Ear_{suffix}', 24, 12,
           deform=lambda p, side=side: (p[0], p[1] - (abs(p[0]) - .25) * .20, p[2]))
    sphere('Ear', (side * .40, 1.105, .674), (.143, .04, .014), f'Ear_{suffix}', 20, 10,
           deform=lambda p: (p[0], p[1] - (abs(p[0]) - .25) * .20, p[2]))
    x, y = side * .153, 1.11
    def blink(p, y=y): return (p[0], y + (p[1] - y) * .07, p[2])
    sphere('Dark', (x, y, .842), (.033, .043, .023), 'Head', 20, 12, blink=blink)
    sphere('Wool', (x - .008, y + .012, .863), (.008, .010, .004), 'Head', 12, 8, blink=blink)
    sphere('Dark', (side * .035, .927, .956), (.027, .018, .013), 'Jaw', 16, 10)
    for end in (-1, 1):
        label = ('Rear' if end < 0 else 'Front') + '_' + suffix
        def weights(p, label=label):
            knee = max(0, min(1, (.41 - p[1]) / .17))
            return {f'Leg_{label}': 1 - knee, f'Knee_{label}': knee}
        sphere('Face', (side * .28, .385, end * .39), (.08, .285, .083), weights, 20, 16)
        # Separate toes make the cloven hoof readable at close range.
        for toe in (-1, 1):
            sphere('Hoof', (side * .28 + toe * .039, .077, end * .39 + .035), (.038, .064, .095), f'Knee_{label}', 16, 10,
                   deform=lambda p: (p[0], max(.016, p[1]), p[2]))

surfaces['Dark'].line(lambda t: ((t - .5) * .15, .877 - .017 * math.sin(t * math.pi), .962 - .05 * abs(t - .5)), .007, 'Jaw')
sphere('Wool', (0, .91, -.729), (.13, .145, .18), 'Tail', 24, 16, wool=True)

rig_data = bpy.data.armatures.new('Sheep skeleton')
rig = bpy.data.objects.new('SheepRig', rig_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones = {'Body': ((0, 0, 0), None), 'Neck': ((0, .84, .38), 'Body'),
         'Head': ((0, 1.04, .61), 'Neck'), 'Jaw': ((0, .91, .83), 'Head'),
         'Tail': ((0, .96, -.67), 'Body')}
for side in (-1, 1):
    s = 'L' if side < 0 else 'R'
    bones[f'Ear_{s}'] = ((side * .22, 1.13, .57), 'Head')
    for end in (-1, 1):
        label = ('Rear' if end < 0 else 'Front') + '_' + s
        bones[f'Leg_{label}'] = ((side * .28, .67, end * .39), 'Body')
        bones[f'Knee_{label}'] = ((side * .28, .352, end * .39), f'Leg_{label}')
for name, (position, parent) in bones.items():
    bone = rig_data.edit_bones.new(name)
    bone.head = xyz(position)
    bone.tail = bone.head + Vector((0, 0, .14))
    if parent: bone.parent = rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
meshes = []
for name, surface in surfaces.items():
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(surface.vertices, [], surface.faces)
    mesh.update()
    obj = bpy.data.objects.new('Sheep_' + name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(palette[name])
    uv = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop in polygon.loop_indices: uv.data[loop].uv = surface.uv[mesh.loops[loop].vertex_index]
    groups = {name: obj.vertex_groups.new(name=name) for name in bones}
    for index, weights in enumerate(surface.weights):
        for bone, weight in weights.items():
            if weight: groups[bone].add([index], weight, 'REPLACE')
    if surface.vertices != surface.blink:
        obj.shape_key_add(name='Basis')
        shape = obj.shape_key_add(name='Blink')
        shape.data.foreach_set('co', [v for p in surface.blink for v in p])
    # Weld the sampling seam and poles so smooth fleece has no star-shaped
    # shading seam. Edit-mode merging preserves UV loops, weights and eyelids.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.000001)
    bpy.ops.object.mode_set(mode='OBJECT')
    modifier = obj.modifiers.new('Soft leg and neck joints', 'ARMATURE')
    modifier.object = rig
    obj.parent = rig
    meshes.append(obj)

scene = bpy.context.scene
scene.render.fps = 30
convert = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0))).to_quaternion()
def rotate(name, x=0, y=0, z=0):
    bone = rig.pose.bones[name]
    q = convert @ Euler((x, y, z), 'XYZ').to_quaternion() @ convert.inverted()
    rest = bone.bone.matrix_local.to_quaternion()
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = rest.inverted() @ q @ rest

rig.animation_data_create()
for name, frames in [('Idle', 90), ('Walk', 48), ('Graze', 100), ('Rest', 90)]:
    rig.animation_data.action = None
    for frame in range(frames + 1):
        t = frame / frames * math.pi * 2
        for bone in rig.pose.bones:
            bone.location = (0, 0, 0)
            rotate(bone.name)
        rig.pose.bones['Body'].location.y = math.sin(t) * .005
        if name == 'Walk':
            rotate('Head', x=-.04, z=math.sin(t) * .014)
            rotate('Body', z=math.sin(t) * .012)
            for i, label in enumerate(['Rear_L', 'Front_L', 'Rear_R', 'Front_R']):
                wave = math.sin(t + (0 if i in (0, 3) else math.pi))
                rotate('Leg_' + label, x=wave * .28)
                rotate('Knee_' + label, x=max(0, -wave) * .34)
        elif name == 'Graze':
            rig.pose.bones['Body'].location.y -= .035
            rig.pose.bones['Neck'].location.y = -.09
            rotate('Neck', x=1.15 + math.sin(t) * .025)
            rotate('Head', x=.52 + math.cos(t * 2) * .022, y=math.sin(t) * .055)
            rotate('Jaw', x=.055 + math.sin(t * 4) * .05)
        elif name == 'Rest':
            rotate('Neck', x=.24)
            rotate('Head', x=.3, z=.075)
        else:
            rotate('Head', y=math.sin(t) * .065, x=math.cos(t) * .018)
        for i, side in enumerate(['L', 'R']):
            rotate('Ear_' + side, z=math.sin(t + i * math.pi) * (.025 if name == 'Rest' else .065))
        rotate('Tail', y=math.sin(t) * (.018 if name == 'Rest' else .09))
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            bone.keyframe_insert('location', frame=frame)
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
    rotate(bone.name)
scene.frame_set(0)
rig['description'] = 'Original woodland sheep: continuous fleece, weighted neck and knees, cloven hooves, blinking eyes.'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
for obj in meshes: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'sheep.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_morph=True, export_morph_animation=False,
    export_skins=True, export_force_sampling=True, export_frame_range=False, export_extras=True,
    export_try_sparse_sk=True, export_yup=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
rig.animation_data.action = bpy.data.actions['Idle']
rig.animation_data.action_slot = bpy.data.actions['Idle'].slots[0]
scene.frame_end = 90
scene.frame_set(0)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.color_type = 'MATERIAL'
            space.overlay.show_floor = False
            space.region_3d.view_location = Vector((0, 0, .7))
            space.region_3d.view_distance = 3.7
            space.region_3d.view_rotation = Vector((3, -5, 1.7)).to_track_quat('Z', 'Y')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'sheep.blend'), compress=True)
report = {'blender': bpy.app.version_string, 'bones': len(bones),
          'triangles': sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in meshes),
          'materials': len(palette), 'expressions': ['Blink'], 'strideLength': .66,
          'animations': ['Idle', 'Walk', 'Graze', 'Rest'], 'bytes': (OUTPUT / 'sheep.glb').stat().st_size}
(OUTPUT / 'sheep.json').write_text(json.dumps(report, indent=2) + '\n')
print('SHEEP_EXPORT ' + json.dumps(report))
