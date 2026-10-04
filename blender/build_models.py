"""Builds the 3D auction models and exports them to public/models/*.glb.

Run:  blender -b --factory-startup --python blender/build_models.py

Each model ships with its own camera (framing lives here, not in the web code)
and one baked animation clip. The coin's two faces use materials named "Logo"
and "LogoBack"; the web viewer swaps in the team logo at runtime, so one coin
serves all ten teams.
"""
import math
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'models')
TROPHY_SRC = os.path.join(HERE, 'assets', 'ipl-trophy.glb')
FPS = 30


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def mat(name, color, metallic=0.0, roughness=0.5):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m


def assign(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.collection.objects.link(e)
    return e


def parent(child, par):
    # keep world placement: express child's location relative to the parent
    bpy.context.view_layer.update()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def camera(loc, target, lens=50):
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    cam.data.lens = lens
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(cam)
    return cam


def key(obj, frame, **props):
    for prop, value in props.items():
        setattr(obj, prop, value)
        obj.keyframe_insert(prop, frame=frame)


def export(name, end_frame, res=(1920, 1080), image_format='AUTO'):
    # render aspect becomes the glTF camera's aspectRatio; the viewer keeps this framing
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.frame_start, scene.frame_end = 1, end_frame
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f'{name}.glb'),
        export_format='GLB',
        export_cameras=True,
        export_apply=True,
        export_animation_mode='SCENE',
        export_anim_scene_split_object=False,
        export_image_format=image_format,
    )


# palette (linear-ish sRGB)
GOLD = dict(color=(1.0, 0.71, 0.18), metallic=1.0, roughness=0.25)
WOOD = dict(color=(0.16, 0.06, 0.02), roughness=0.55)
CHARCOAL = dict(color=(0.04, 0.04, 0.045), roughness=0.6)
PINK = dict(color=(0.93, 0.05, 0.38), roughness=0.4)


def build_gavel():
    reset()
    wood, gold = mat('Wood', **WOOD), mat('Gold', **GOLD)

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.9, depth=0.25, location=(0, 0, 0.125))
    block = smooth(assign(bpy.context.object, wood))
    block.name = 'Block'
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.93, depth=0.05, location=(0, 0, 0.2))
    parent(smooth(assign(bpy.context.object, gold)), block)

    # pivot sits at the handle's end; rotating it about Y swings the head
    pivot = empty('Gavel', (1.9, 0, 0.53))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.28, depth=1.0, location=(0, 0, 0.53), rotation=(math.pi / 2, 0, 0))
    parent(smooth(assign(bpy.context.object, wood)), pivot)
    for y in (-0.42, 0.42):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.3, depth=0.07, location=(0, y, 0.53), rotation=(math.pi / 2, 0, 0))
        parent(smooth(assign(bpy.context.object, gold)), pivot)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.07, depth=1.9, location=(0.95, 0, 0.53), rotation=(0, math.pi / 2, 0))
    parent(smooth(assign(bpy.context.object, wood)), pivot)

    # raise -> wind up -> SLAM -> bounce -> rest  (~1.3s)
    for f, a in ((1, 0.9), (10, 1.15), (15, 0.0), (19, 0.14), (23, 0.0), (40, 0.0)):
        key(pivot, f, rotation_euler=(0, a, 0))
    for f, s in ((1, (1, 1, 1)), (14, (1, 1, 1)), (16, (1.06, 1.06, 0.82)), (20, (1, 1, 1))):
        key(block, f, scale=s)

    camera((1.2, -5.2, 2.6), (0.6, 0, 0.6), lens=45)
    export('gavel', 40)


def build_unsold():
    reset()
    ink, paper = mat('Ink', **CHARCOAL), mat('Paper', color=(0.92, 0.92, 0.9), roughness=0.7)

    bpy.ops.object.text_add(location=(0, 0, 0))
    text = bpy.context.object
    text.data.body = 'UNSOLD'
    text.data.align_x, text.data.align_y = 'CENTER', 'CENTER'
    text.data.extrude, text.data.bevel_depth = 0.12, 0.015
    bpy.ops.object.convert(target='MESH')
    assign(text, ink)
    text.rotation_euler = (math.pi / 2, 0, 0)
    text.location = (0, -0.1, 0)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.08, 0), scale=(3.9, 0.12, 1.25))
    plate = assign(bpy.context.object, paper)

    stamp = empty('Unsold')
    parent(text, stamp)
    parent(plate, stamp)
    # drop in -> small bounce -> shaky wobble -> settle  (~1.3s)
    for f, z in ((1, 4.0), (9, 0.0), (12, 0.25), (15, 0.0), (40, 0.0)):
        key(stamp, f, location=(0, 0, z))
    for f, r in ((1, 0.0), (15, 0.0), (19, 0.14), (23, -0.11), (27, 0.07), (31, -0.03), (34, 0.0), (40, 0.0)):
        key(stamp, f, rotation_euler=(0, r, 0))

    camera((0, -7.5, 0.4), (0, 0, 0), lens=55)
    export('unsold', 40)


def disc(radius, z, flip, material):
    """Flat circle facing +Z (or -Z if flip) with planar 0..1 UVs for a logo."""
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=radius, fill_type='NGON', location=(0, 0, z))
    obj = bpy.context.object
    me = obj.data
    if flip:
        for p in me.polygons:
            p.flip()
    uv = me.uv_layers.active  # the primitive ships with one; a second map wouldn't be exported
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        u = co.x / (2 * radius) + 0.5
        v = co.y / (2 * radius) + 0.5
        # back face is seen from behind: mirror u so the logo isn't reversed
        uv.data[loop.index].uv = (1 - u if flip else u, v)
    return assign(obj, material)


def build_coin():
    reset()
    gold = mat('Gold', **GOLD)
    logo, logo_back = mat('Logo', (1, 1, 1), roughness=0.6), mat('LogoBack', (1, 1, 1), roughness=0.6)

    depth = 0.16
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.0, depth=depth, end_fill_type='NOTHING')
    rim = smooth(assign(bpy.context.object, gold))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=depth / 2, major_segments=64, minor_segments=12)
    lip = smooth(assign(bpy.context.object, gold))
    front = disc(0.97, depth / 2 - 0.01, False, logo)
    back = disc(0.97, -depth / 2 + 0.01, True, logo_back)

    for o in (lip, front, back):
        o.select_set(True)
    rim.select_set(True)
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.join()
    coin = bpy.context.object
    coin.name = 'Coin'
    coin.rotation_euler = (math.pi / 2, 0, 0)  # stand up: +Z face now looks at -Y (the camera)
    bpy.ops.object.transform_apply(rotation=True)

    # spin in from nothing -> overshoot -> settle -> gentle sway  (2s)
    for f, s in ((1, 0.01), (20, 1.12), (26, 0.96), (30, 1.0), (60, 1.0)):
        key(coin, f, scale=(s, s, s))
    for f, r in ((1, -4 * math.pi), (26, 0.12), (32, 0.0), (45, -0.18), (60, 0.0)):
        key(coin, f, rotation_euler=(0, 0, r))

    camera((0, -4.6, 0.2), (0, 0, 0), lens=50)
    export('coin', 60, res=(1000, 1000))


def build_trophy():
    reset()
    gold, base_mat = mat('Gold', **GOLD), mat('Base', **CHARCOAL)

    # official trophy scan (60k tris, 2K texture) -> ~15k tris, 1K WebP texture
    bpy.ops.import_scene.gltf(filepath=TROPHY_SRC)
    cup = bpy.context.selected_objects[0]
    bpy.context.view_layer.objects.active = cup
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    dec = cup.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = 0.25
    for img in bpy.data.images:
        img.scale(1024, 1024)
    # fit: 2.1 units tall, centred, standing on the plinth top (z=0.28)
    corners = [cup.matrix_world @ Vector(c) for c in cup.bound_box]
    lo = Vector([min(c[i] for c in corners) for i in range(3)])
    hi = Vector([max(c[i] for c in corners) for i in range(3)])
    k = 2.1 / (hi.z - lo.z)
    cup.scale = (k, k, k)
    cup.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, 0.28 - lo.z * k)
    bpy.ops.object.transform_apply(location=True, scale=True)
    trophy = empty('Trophy')
    parent(cup, trophy)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.85, depth=0.3, location=(0, 0, 0.15))
    smooth(assign(bpy.context.object, base_mat))
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.87, depth=0.04, location=(0, 0, 0.26))
    smooth(assign(bpy.context.object, gold))

    # seamless 4s loop: full turn + a slow bob
    end = 121
    prefs = bpy.context.preferences.edit
    prefs.keyframe_new_interpolation_type = 'LINEAR'
    key(trophy, 1, rotation_euler=(0, 0, 0))
    key(trophy, end, rotation_euler=(0, 0, 2 * math.pi))
    prefs.keyframe_new_interpolation_type = 'BEZIER'
    for f, z in ((1, 0.0), (31, 0.06), (61, 0.0), (91, 0.06), (end, 0.0)):
        key(trophy, f, location=(0, 0, z))

    camera((0, -5.1, 1.9), (0, 0, 1.25), lens=50)
    export('trophy', end, res=(800, 1000), image_format='WEBP')


if __name__ == '__main__':
    build_gavel()
    build_unsold()
    build_coin()
    build_trophy()
    print('models written to', os.path.abspath(OUT))
