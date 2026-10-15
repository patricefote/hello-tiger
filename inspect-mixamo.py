import bpy
import os
import glob

folder = r"C:\Users\pfote\hello-tiger\public\models"
files = glob.glob(os.path.join(folder, "*.fbx"))

for filepath in files:
    print("\n=== FILE:", os.path.basename(filepath), "===")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    bpy.ops.import_scene.fbx(filepath=filepath)

    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    print("Armatures:", len(armatures))
    print("Meshes:", len(meshes))
    print("Bones:", [len(a.data.bones) for a in armatures])
    print("Actions:", [
        (a.name, tuple(a.frame_range))
        for a in bpy.data.actions
    ])

print("\n=== INSPECTION COMPLETE ===")
