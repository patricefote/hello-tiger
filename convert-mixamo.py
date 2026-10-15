import bpy
import os

source = os.path.expandvars(r"%USERPROFILE%\Downloads\Standing Idle.fbx")
output = r"C:\Users\pfote\hello-tiger\public\models\mixamo-idle.glb"

if not os.path.isfile(source):
    raise FileNotFoundError("Could not find: " + source)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.fbx(filepath=source)

print("=== IMPORTED OBJECTS ===")
for obj in bpy.context.scene.objects:
    print(obj.name, obj.type)

print("=== ACTIONS ===")
for action in bpy.data.actions:
    print(action.name, action.frame_range[:])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_animations=True,
    export_skins=True,
    use_selection=True
)

print("EXPORTED:", output)
