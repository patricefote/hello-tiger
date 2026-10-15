import bpy
import os
import glob

base_path = os.path.join(
    os.environ["USERPROFILE"], "Downloads", "Standing Idle.fbx"
)
motion_folder = r"C:\Users\pfote\hello-tiger\public\models"
output_path = os.path.join(motion_folder, "tiger-animated.glb")

if not os.path.isfile(base_path):
    raise FileNotFoundError("Missing base character: " + base_path)

# Start with a clean scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# Import the character that has skin and its idle animation.
bpy.ops.import_scene.fbx(filepath=base_path)

base_armatures = [
    obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"
]
if not base_armatures:
    raise RuntimeError("No armature found in Standing Idle.fbx")

base_rig = base_armatures[0]
base_action = (
    base_rig.animation_data.action
    if base_rig.animation_data else None
)
if base_action is None:
    raise RuntimeError("No idle action found on the base character")

base_action.name = "Idle_Standing"

# Collect all motion files except the base character.
motion_files = sorted(glob.glob(os.path.join(motion_folder, "*.fbx")))
clips = [("Idle_Standing", base_action)]

for path in motion_files:
    label = os.path.splitext(os.path.basename(path))[0]
    print("\nIMPORTING MOTION:", label)

    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)

    bpy.ops.import_scene.fbx(filepath=path)

    new_objects = set(bpy.data.objects) - before_objects
    new_rigs = [o for o in new_objects if o.type == "ARMATURE"]
    new_actions = list(set(bpy.data.actions) - before_actions)

    if not new_rigs:
        print("SKIPPED: no armature found")
        for obj in list(new_objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        continue

    motion_rig = new_rigs[0]
    motion_action = (
        motion_rig.animation_data.action
        if motion_rig.animation_data else None
    )

    if motion_action is None and new_actions:
        motion_action = new_actions[0]

    if motion_action is None:
        print("SKIPPED: no animation action found")
    else:
        motion_action.name = "Motion_" + label.replace(" ", "_")
        clips.append((motion_action.name, motion_action))
        print("CAPTURED:", motion_action.name,
              "frames:", tuple(motion_action.frame_range))

    # Keep the original character; discard the imported motion's model.
    for obj in list(new_objects):
        bpy.data.objects.remove(obj, do_unlink=True)

# Add each clip as a separate NLA track on the base rig.
base_rig.animation_data_create()
base_rig.animation_data.action = None

for name, action in clips:
    track = base_rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.name = name

# Export the base character and its animation tracks.
bpy.ops.object.select_all(action="DESELECT")
base_rig.select_set(True)
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)

bpy.context.view_layer.objects.active = base_rig

print("\nEXPORTING CLIPS:", [name for name, _ in clips])

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_animations=True,
    export_nla_strips=True,
    export_skins=True,
    use_selection=True
)

print("\nEXPORTED:", output_path)
print("CLIPS PREPARED:", len(clips))
