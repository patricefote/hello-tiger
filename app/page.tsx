
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [catsRescued, setCatsRescued] = useState(0);
  const [starsCollected, setStarsCollected] = useState(0);
  const [barnProgress, setBarnProgress] = useState(0);
  const [message, setMessage] = useState(
    "Find the cats and build them a home!"
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.65, 0.82, 0.98, 1);

    // ---------- MATERIALS ----------

    function material(name: string, color: Color3) {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor = color;
      mat.specularColor = new Color3(0.15, 0.15, 0.15);
      return mat;
    }

    const grassMat = material(
      "Grass",
      new Color3(0.30, 0.62, 0.28)
    );
    const wallMat = material(
      "HouseWalls",
      new Color3(0.87, 0.76, 0.60)
    );
    const roofMat = material(
      "HouseRoof",
      new Color3(0.55, 0.20, 0.17)
    );
    const woodMat = material(
      "Wood",
      new Color3(0.48, 0.29, 0.15)
    );
    const blueMat = material(
      "Windows",
      new Color3(0.20, 0.62, 0.92)
    );
    const leafMat = material(
      "Leaves",
      new Color3(0.13, 0.42, 0.17)
    );
    const goldMat = material(
      "GoldMarkers",
      new Color3(1, 0.72, 0.12)
    );
    const whiteMat = material(
      "White",
      new Color3(0.97, 0.95, 0.88)
    );
    const blackMat = material(
      "Black",
      new Color3(0.10, 0.09, 0.08)
    );
    const pinkMat = material(
      "Pink",
      new Color3(1, 0.40, 0.56)
    );
    const orangeMat = material(
      "Orange",
      new Color3(0.96, 0.46, 0.16)
    );
    const grayMat = material(
      "Gray",
      new Color3(0.48, 0.49, 0.53)
    );
    const barnRedMat = material(
      "BarnRed",
      new Color3(0.72, 0.16, 0.14)
    );
    const roofWoodMat = material(
      "BarnRoof",
      new Color3(0.30, 0.19, 0.17)
    );

    // ---------- LIGHTING ----------

    const hemi = new HemisphericLight(
      "SkyLight",
      new Vector3(0, 1, 0),
      scene
    );
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.35, 0.32, 0.27);

    const sun = new DirectionalLight(
      "Sun",
      new Vector3(-0.5, -1, 0.35),
      scene
    );
    sun.position = new Vector3(10, 15, -10);
    sun.intensity = 0.8;

    // ---------- GROUND ----------

    const ground = MeshBuilder.CreateGround(
      "Yard",
      { width: 42, height: 42 },
      scene
    );
    ground.position.y = 0;
    ground.material = grassMat;

    // ---------- DAD'S HOUSE ----------

    const house = MeshBuilder.CreateBox(
      "House",
      { width: 6, height: 3.6, depth: 4 },
      scene
    );
    house.position = new Vector3(0, 1.8, 8);
    house.material = wallMat;

    const houseRoof = MeshBuilder.CreateBox(
      "HouseRoof",
      { width: 6.8, height: 0.35, depth: 4.8 },
      scene
    );
    houseRoof.position = new Vector3(0, 3.85, 8);
    houseRoof.rotation.z = 0.12;
    houseRoof.material = roofMat;

    const door = MeshBuilder.CreateBox(
      "FrontDoor",
      { width: 1.1, height: 2.2, depth: 0.12 },
      scene
    );
    door.position = new Vector3(0, 1.1, 5.94);
    door.material = woodMat;

    const doorKnob = MeshBuilder.CreateSphere(
      "DoorKnob",
      { diameter: 0.12 },
      scene
    );
    doorKnob.position = new Vector3(0.36, 1.1, 5.85);
    doorKnob.material = goldMat;

    for (const x of [-1.9, 1.9]) {
      const windowMesh = MeshBuilder.CreateBox(
        "HouseWindow",
        { width: 1.1, height: 1.05, depth: 0.13 },
        scene
      );
      windowMesh.position = new Vector3(x, 2.15, 5.91);
      windowMesh.material = blueMat;
    }

    // ---------- TREES ----------

    function createTree(x: number, z: number) {
      const trunk = MeshBuilder.CreateCylinder(
        "TreeTrunk",
        { height: 1.7, diameter: 0.42 },
        scene
      );
      trunk.position = new Vector3(x, 0.85, z);
      trunk.material = woodMat;

      const crown = MeshBuilder.CreateSphere(
        "TreeCrown",
        { diameter: 2.1, segments: 8 },
        scene
      );
      crown.position = new Vector3(x, 2.25, z);
      crown.material = leafMat;
    }

    [
      [-9, -5],
      [-10, 3],
      [10, -7],
      [11, 3],
      [-6, -10],
      [5, -11],
    ].forEach(([x, z]) => createTree(x, z));

    // ---------- TIGER ----------

    const tiger = MeshBuilder.CreateCapsule(
      "TigerBody",
      { height: 1.35, radius: 0.35 },
      scene
    );
    tiger.position = new Vector3(0, 0.72, 1);

    const tigerMat = material(
      "TigerSuit",
      new Color3(0.17, 0.55, 0.96)
    );
    tiger.material = tigerMat;

    const tigerHead = MeshBuilder.CreateSphere(
      "TigerHead",
      { diameter: 0.85, segments: 12 },
      scene
    );
    tigerHead.position = new Vector3(0, 1.65, 1);
    tigerHead.material = orangeMat;

    const tigerFace = MeshBuilder.CreateSphere(
      "TigerFace",
      { diameter: 0.47, segments: 12 },
      scene
    );
    tigerFace.position = new Vector3(0, 1.57, 0.73);
    tigerFace.scaling.z = 0.45;
    tigerFace.material = whiteMat;

    for (const x of [-0.16, 0.16]) {
      const eye = MeshBuilder.CreateSphere(
        "TigerEye",
        { diameter: 0.09 },
        scene
      );
      eye.position = new Vector3(x, 1.72, 0.67);
      eye.material = blackMat;
    }

    // ---------- CAMERA ----------
    // Disable camera keyboard movement so the arrow keys
    // remain dedicated to controlling Tiger.

    const camera = new ArcRotateCamera(
      "GameCamera",
      -Math.PI / 2,
      Math.PI / 3,
      13,
      tiger.position,
      scene
    );

    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 22;
    camera.wheelPrecision = 35;
    camera.panningSensibility = 0;
    camera.removeByType?.("ArcRotateCameraKeyboardMoveInput");
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.attachControl(canvas, true);
    camera.lockedTarget = tiger;

    // ---------- COLLECTIBLE GOLD SHAPES ----------
    // These are still simple test objects. Later they can
    // become furniture, toys, building pieces, or other items.

    const markers: Mesh[] = [];

    [
      [-4, 1, -2],
      [4, 1, -4],
      [-7, 1, 5],
      [7, 1, -7],
      [1, 1, -9],
    ].forEach(([x, y, z], index) => {
      const marker = MeshBuilder.CreatePolyhedron(
        `GoldShape${index}`,
        { type: 1, size: 0.55 },
        scene
      );
      marker.position = new Vector3(x, y, z);
      marker.material = goldMat;
      markers.push(marker);
    });

    // ---------- CATS TO RESCUE ----------

    type Cat = {
      x: number;
      z: number;
      parts: Mesh[];
      rescued: boolean;
    };

    const cats: Cat[] = [];

    function createCat(
      name: string,
      x: number,
      z: number,
      color: StandardMaterial
    ) {
      const parts: Mesh[] = [];

      function addPart(mesh: Mesh) {
        mesh.material = color;
        parts.push(mesh);
        return mesh;
      }

      const body = addPart(
        MeshBuilder.CreateSphere(
          `${name}Body`,
          { diameter: 0.7, segments: 10 },
          scene
        )
      );
      body.scaling = new Vector3(1.2, 0.75, 0.8);
      body.position = new Vector3(x, 0.38, z);

      const head = addPart(
        MeshBuilder.CreateSphere(
          `${name}Head`,
          { diameter: 0.55, segments: 10 },
          scene
        )
      );
      head.position = new Vector3(x, 0.67, z - 0.3);

      for (const earX of [-0.17, 0.17]) {
        const ear = addPart(
          MeshBuilder.CreateCylinder(
            `${name}Ear`,
            {
              height: 0.28,
              diameterTop: 0,
              diameterBottom: 0.19,
              tessellation: 4,
            },
            scene
          )
        );
        ear.position = new Vector3(x + earX, 0.97, z - 0.32);
        ear.rotation.z = earX < 0 ? -0.15 : 0.15;
      }

      for (const eyeX of [-0.11, 0.11]) {
        const eye = MeshBuilder.CreateSphere(
          `${name}Eye`,
          { diameter: 0.065 },
          scene
        );
        eye.position = new Vector3(x + eyeX, 0.7, z - 0.54);
        eye.material = blackMat;
        parts.push(eye);
      }

      const nose = MeshBuilder.CreateSphere(
        `${name}Nose`,
        { diameter: 0.07 },
        scene
      );
      nose.position = new Vector3(x, 0.61, z - 0.56);
      nose.material = pinkMat;
      parts.push(nose);

      const tail = addPart(
        MeshBuilder.CreateCylinder(
          `${name}Tail`,
          { height: 0.7, diameter: 0.12 },
          scene
        )
      );
      tail.position = new Vector3(x + 0.42, 0.54, z + 0.12);
      tail.rotation.z = Math.PI / 3;

      cats.push({ x, z, parts, rescued: false });
    }

    createCat("Mittens", -4, -3, whiteMat);
    createCat("Pumpkin", 5, -5, orangeMat);
    createCat("Shadow", -7, 1, grayMat);

    // ---------- BARN BUILDING SITE ----------

    const barnX = 7;
    const barnZ = 2;

    const buildMarker = MeshBuilder.CreateCylinder(
      "BarnBuildSite",
      { height: 0.06, diameter: 4.8, tessellation: 32 },
      scene
    );
    buildMarker.position = new Vector3(barnX, 0.04, barnZ);
    buildMarker.material = goldMat;

    // Each press of B reveals the next building stage.

    const barnPieces: Mesh[] = [];

    function addBarnPiece(
      name: string,
      dimensions: { width: number; height: number; depth: number },
      position: Vector3,
      mat: StandardMaterial,
      rotationZ = 0
    ) {
      const piece = MeshBuilder.CreateBox(name, dimensions, scene);
      piece.position = position;
      piece.rotation.z = rotationZ;
      piece.material = mat;
      piece.setEnabled(false);
      barnPieces.push(piece);
      return piece;
    }

    // Stage 1: floor
    addBarnPiece(
      "BarnFloor",
      { width: 4, height: 0.18, depth: 3.4 },
      new Vector3(barnX, 0.13, barnZ),
      woodMat
    );

    // Stage 2: back wall
    addBarnPiece(
      "BarnBackWall",
      { width: 4, height: 2.4, depth: 0.18 },
      new Vector3(barnX, 1.4, barnZ + 1.6),
      barnRedMat
    );

    // Stage 3: left wall
    addBarnPiece(
      "BarnLeftWall",
      { width: 0.18, height: 2.4, depth: 3.4 },
      new Vector3(barnX - 1.9, 1.4, barnZ),
      barnRedMat
    );

    // Stage 4: right wall
    addBarnPiece(
      "BarnRightWall",
      { width: 0.18, height: 2.4, depth: 3.4 },
      new Vector3(barnX + 1.9, 1.4, barnZ),
      barnRedMat
    );

    // Stage 5: front wall sections leave a doorway
    addBarnPiece(
      "BarnFrontLeft",
      { width: 1.25, height: 2.4, depth: 0.18 },
      new Vector3(barnX - 1.35, 1.4, barnZ - 1.6),
      barnRedMat
    );

    addBarnPiece(
      "BarnFrontRight",
      { width: 1.25, height: 2.4, depth: 0.18 },
      new Vector3(barnX + 1.35, 1.4, barnZ - 1.6),
      barnRedMat
    );

    // Stage 6: two sloping roof pieces
    addBarnPiece(
      "BarnRoofLeft",
      { width: 2.35, height: 0.22, depth: 3.8 },
      new Vector3(barnX - 0.92, 2.75, barnZ),
      roofWoodMat,
      -0.48
    );

    addBarnPiece(
      "BarnRoofRight",
      { width: 2.35, height: 0.22, depth: 3.8 },
      new Vector3(barnX + 0.92, 2.75, barnZ),
      roofWoodMat,
      0.48
    );

    // ---------- CONTROLS ----------

    const keys = new Set<string>();
    let jumpVelocity = 0;
    let isGrounded = true;
    let score = 0;
    let barnStage = 0;

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
          key
        )
      ) {
        event.preventDefault();
      }

      if (
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "w" ||
        key === "a" ||
        key === "s" ||
        key === "d" ||
        key === " "
      ) {
        keys.add(key);
      }

      if (event.repeat) return;

      if (key === "e") {
        let closestCat: Cat | null = null;
        let closestDistance = Infinity;

        for (const cat of cats) {
          if (cat.rescued) continue;

          const distance = Math.hypot(
            tiger.position.x - cat.x,
            tiger.position.z - cat.z
          );

          if (distance < closestDistance) {
            closestDistance = distance;
            closestCat = cat;
          }
        }

        if (closestCat && closestDistance < 2.1) {
          closestCat.rescued = true;
          closestCat.parts.forEach((part) => part.setEnabled(false));

          const total = cats.filter((cat) => cat.rescued).length;
          setCatsRescued(total);

          setMessage(
            total === cats.length
              ? "All the cats are rescued! Let's finish their barn!"
              : "Cat rescued! Find another little friend."
          );
        } else {
          setMessage("Walk closer to a cat, then press E.");
        }
      }

      if (key === "b") {
        const distance = Math.hypot(
          tiger.position.x - barnX,
          tiger.position.z - barnZ
        );

        if (distance > 3.2) {
          setMessage("Walk over to the golden building spot first!");
          return;
        }

        if (barnStage >= barnPieces.length) {
          setMessage("The barn is finished! The cats have a home!");
          return;
        }

        barnPieces[barnStage].setEnabled(true);
        barnStage++;

        setBarnProgress(barnStage);
        setMessage(
          barnStage >= barnPieces.length
            ? "Barn complete! Amazing building, Tiger!"
            : "Nice building! Press B for the next piece."
        );
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      keys.delete(event.key.toLowerCase());
    }

    function clearKeys() {
      keys.clear();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearKeys);

    // ---------- GAME LOOP ----------

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
      const speed = 5 * dt;

      let dx = 0;
      let dz = 0;

      if (keys.has("arrowup") || keys.has("w")) dz -= 1;
      if (keys.has("arrowdown") || keys.has("s")) dz += 1;
      if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
      if (keys.has("arrowright") || keys.has("d")) dx += 1;

      const length = Math.hypot(dx, dz);
      if (length > 0) {
        dx /= length;
        dz /= length;
        tiger.position.x += dx * speed;
        tiger.position.z += dz * speed;
      }

      // Keep Tiger inside the playable yard.
      tiger.position.x = Math.max(-19, Math.min(19, tiger.position.x));
      tiger.position.z = Math.max(-19, Math.min(19, tiger.position.z));

      // Simple jump physics.
      if (keys.has(" ") && isGrounded) {
        jumpVelocity = 7;
        isGrounded = false;
      }

      tiger.position.y += jumpVelocity * dt;
      jumpVelocity -= 18 * dt;

      if (tiger.position.y <= 0.72) {
        tiger.position.y = 0.72;
        jumpVelocity = 0;
        isGrounded = true;
      }

      tigerHead.position.x = tiger.position.x;
      tigerHead.position.y = tiger.position.y + 0.93;
      tigerHead.position.z = tiger.position.z;

      tigerFace.position.x = tiger.position.x;
      tigerFace.position.y = tiger.position.y + 0.85;
      tigerFace.position.z = tiger.position.z - 0.27;

      // Eyes and nose follow the character's head.
      const eyeMeshes = scene.meshes.filter((mesh) =>
        mesh.name === "TigerEye"
      );

      eyeMeshes.forEach((eye, index) => {
        eye.position.x = tiger.position.x + (index === 0 ? -0.16 : 0.16);
        eye.position.y = tiger.position.y + 1.0;
        eye.position.z = tiger.position.z - 0.33;
      });

      const noseMesh = scene.getMeshByName("TigerNose");
      if (noseMesh) {
        noseMesh.position.x = tiger.position.x;
        noseMesh.position.y = tiger.position.y + 0.84;
        noseMesh.position.z = tiger.position.z - 0.35;
      }

      // Gold test objects remain in the world and respond
      // to light and camera movement. Collect by walking near them.
      markers.forEach((marker) => {
        if (!marker.isEnabled()) return;

        marker.rotation.y += dt * 0.8;
        marker.rotation.x += dt * 0.25;

        if (
          Vector3.Distance(tiger.position, marker.position) < 1.25
        ) {
          marker.setEnabled(false);
          score++;
          setStarsCollected(score);
          setMessage("You found a shiny shape!");
        }
      });
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    function handleResize() {
      engine.resize();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-sky-200">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none outline-none"
      />

      <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/50 bg-white/90 p-4 shadow-lg sm:left-6 sm:top-6">
        <h1 className="text-2xl font-black tracking-tight text-blue-700 sm:text-3xl">
          HELLO TIGER!
        </h1>
        <p className="mt-1 text-sm font-semibold text-gray-700">
          Dad&apos;s House &amp; Cat Rescue
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
            🐱 Cats: {catsRescued}/3
          </span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-800">
            ✨ Shapes: {starsCollected}/5
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
            🏠 Barn: {barnProgress}/8
          </span>
        </div>

        <p className="mt-3 max-w-xs text-sm text-gray-700">
          {message}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-2xl bg-black/75 px-4 py-3 text-sm font-medium leading-6 text-white shadow-lg sm:bottom-6 sm:left-6">
        <p>⌨️ Move: WASD or arrow keys</p>
        <p>🦘 Jump: Space</p>
        <p>🐱 Rescue a nearby cat: E</p>
        <p>🧱 Build the barn nearby: B</p>
        <p>🖱️ Drag to rotate · Scroll to zoom</p>
      </div>
    </main>
  );
}