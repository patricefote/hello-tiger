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
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

type Cat = {
  name: string;
  x: number;
  z: number;
  parts: Mesh[];
  rescued: boolean;
  housed: boolean;
  barnIndex: number | null;
};

type Resource = {
  type: "wood" | "stone";
  mesh: Mesh;
  x: number;
  z: number;
  collected: boolean;
};

// BONUS HEART PICKUPS
type HeartPickup = {
  x: number;
  z: number;
  parts: Mesh[];
  baseY: number[];
  collected: boolean;
};

type Slime = {
  x: number;
  z: number;
  health: number;
  alive: boolean;
  body: Mesh;
  eyes: Mesh[];
  hitFlash: number;
  stompCooldown: number;
};

type Projectile = {
  mesh: Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
};

type BuildMode = "none" | "barn" | "road";

type RoadTile = {
  x: number;
  z: number;
  rotation: number;
};

type Barn = {
  x: number;
  z: number;
  rotation: number;
  parts: Mesh[];
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const houseCatActionRef = useRef<(() => void) | null>(null);

  const [catsRescued, setCatsRescued] = useState(0);
  const [catsHoused, setCatsHoused] = useState(0);
  const [mana, setMana] = useState(0);
  const [wood, setWood] = useState(0);
  const [stone, setStone] = useState(0);
  const [barnBuilt, setBarnBuilt] = useState(false);
  const [barnCount, setBarnCount] = useState(0);
  const [roadCount, setRoadCount] = useState(0);
  const [mode, setModeUI] = useState<BuildMode>("none");
  const [invertedMovement, setInvertedMovement] = useState(false);
  const invertedMovementRef = useRef(false);
  const [health, setHealth] = useState(5);
  const [slimesDefeated, setSlimesDefeated] = useState(0);
  const [charmCrafted, setCharmCrafted] = useState(false);
  const [questStarted, setQuestStarted] = useState(false);
  const [questComplete, setQuestComplete] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [message, setMessage] = useState(
    "Welcome home, Tiger! Collect mana, meet Milo, and protect the yard."
  );

  const canHouseCat = barnBuilt && catsRescued > catsHoused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      powerPreference: "high-performance",
    });

    engine.setHardwareScalingLevel(
      window.devicePixelRatio > 1 ? 1.25 : 1
    );

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.55, 0.78, 0.98, 1);
    scene.skipPointerMovePicking = true;
    scene.fogMode = Scene.FOGMODE_EXP;
    scene.fogDensity = 0.004;
    scene.fogColor = new Color3(0.55, 0.78, 0.98);

    const makeMaterial = (
      name: string,
      color: Color3,
      alpha = 1
    ) => {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor = color;
      mat.alpha = alpha;

      if (alpha < 1) {
        mat.transparencyMode =
          StandardMaterial.MATERIAL_ALPHABLEND;
        mat.disableDepthWrite = true;
      }

      return mat;
    };

    const grassMat = makeMaterial("Grass", new Color3(0.25, 0.58, 0.25));
    const wallMat = makeMaterial("HouseWalls", new Color3(0.94, 0.79, 0.59));
    const roofMat = makeMaterial("HouseRoof", new Color3(0.55, 0.19, 0.15));
    const woodMat = makeMaterial("Wood", new Color3(0.52, 0.30, 0.13));
    const blueMat = makeMaterial("Blue", new Color3(0.12, 0.42, 0.9));
    const leafMat = makeMaterial("Leaves", new Color3(0.12, 0.43, 0.16));
    const manaMat = makeMaterial("ManaCrystal", new Color3(0.1, 0.95, 1));
    const whiteMat = makeMaterial("White", new Color3(0.96, 0.96, 0.96));
    const blackMat = makeMaterial("Black", new Color3(0.035, 0.035, 0.035));
    const pinkMat = makeMaterial("Pink", new Color3(1, 0.35, 0.55));
    const orangeMat = makeMaterial("Orange", new Color3(1, 0.35, 0.06));
    const grayMat = makeMaterial("Gray", new Color3(0.38, 0.4, 0.46));
    const barnRedMat = makeMaterial("BarnRed", new Color3(0.75, 0.12, 0.12));
    const roofWoodMat = makeMaterial("BarnRoof", new Color3(0.32, 0.17, 0.12));
    const ghostMat = makeMaterial("BuildingPreview", new Color3(0.2, 0.9, 1), 0.38);
    const roadMat = makeMaterial("RoadSurface", new Color3(0.34, 0.36, 0.4));
    const roadLineMat = makeMaterial("RoadMarkings", new Color3(0.95, 0.85, 0.45));
    const slimeMat = makeMaterial("SlimeGreen", new Color3(0.2, 0.9, 0.35));
    const slimeEyeMat = makeMaterial("SlimeEyes", new Color3(0.04, 0.08, 0.05));
    const magicMat = makeMaterial("MagicProjectile", new Color3(0.25, 0.45, 1));
    const charmMat = makeMaterial("MagicCharm", new Color3(0.7, 0.25, 1));
    const npcMat = makeMaterial("NPCBlue", new Color3(0.95, 0.62, 0.15));

    // BONUS HEART MATERIALS
    const heartRedMat = makeMaterial("BonusHeartRed", new Color3(1, 0.08, 0.2));
    const heartHighlightMat = makeMaterial(
      "BonusHeartHighlight",
      new Color3(1, 0.75, 0.8)
    );

    // Lighting and shadows.
    const hemiLight = new HemisphericLight(
      "HemisphericLight",
      new Vector3(0, 1, 0),
      scene
    );
    hemiLight.intensity = 0.85;

    const sunLight = new DirectionalLight(
      "SunLight",
      new Vector3(-0.5, -1, 0.4),
      scene
    );
    sunLight.position = new Vector3(10, 18, -10);
    sunLight.intensity = 0.8;

    const shadowGenerator = new ShadowGenerator(1024, sunLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 16;
    shadowGenerator.setDarkness(0.25);

    const ground = MeshBuilder.CreateGround(
      "Ground",
      { width: 80, height: 80 },
      scene
    );
    ground.material = grassMat;
    ground.isPickable = false;
    ground.receiveShadows = true;

    // Home.
    const house = MeshBuilder.CreateBox(
      "House",
      { width: 6, height: 4, depth: 5 },
      scene
    );
    house.position.set(0, 2, 8);
    house.material = wallMat;
    shadowGenerator.addShadowCaster(house);

    const houseRoof = MeshBuilder.CreateCylinder(
      "HouseRoof",
      {
        diameterTop: 0,
        diameterBottom: 8,
        height: 3.5,
        tessellation: 4,
      },
      scene
    );
    houseRoof.position.set(0, 5.1, 8);
    houseRoof.rotation.y = Math.PI / 4;
    houseRoof.material = roofMat;
    shadowGenerator.addShadowCaster(houseRoof);

    const door = MeshBuilder.CreateBox(
      "FrontDoor",
      { width: 1.2, height: 2.2, depth: 0.15 },
      scene
    );
    door.position.set(0, 1.1, 5.42);
    door.material = woodMat;

    const doorKnob = MeshBuilder.CreateSphere(
      "DoorKnob",
      { diameter: 0.12 },
      scene
    );
    doorKnob.position.set(0.4, 1.1, 5.3);
    doorKnob.material = manaMat;

    for (const x of [-1.9, 1.9]) {
      const windowMesh = MeshBuilder.CreateBox(
        `HouseWindow${x}`,
        { width: 1, height: 1, depth: 0.12 },
        scene
      );
      windowMesh.position.set(x, 2.6, 5.42);
      windowMesh.material = blueMat;
    }

    // Expanded tree locations.
    const treePositions = [
      [-11, -7], [11, -8], [-12, 5], [11, 3],
      [-3, -12], [5, -12], [14, 9],
      [-20, -18], [-29, -12], [-34, 3],
      [-27, 22], [-15, 30], [-1, 34],
      [14, 32], [29, 26], [36, 12],
      [34, -10], [26, -28], [10, -35],
      [-10, -34], [-28, -28], [-35, -22],
      [-22, 1], [-17, 13], [-7, 22],
      [7, 18], [20, 14], [29, 3],
      [18, -15], [0, -24], [-13, -21],
    ];

    treePositions.forEach(([x, z], i) => {
      const trunk = MeshBuilder.CreateCylinder(
        `TreeTrunk${i}`,
        { height: 2, diameter: 0.65 },
        scene
      );
      trunk.position.set(x, 1, z);
      trunk.material = woodMat;
      shadowGenerator.addShadowCaster(trunk);

      const leaves = MeshBuilder.CreateSphere(
        `TreeLeaves${i}`,
        { diameter: 2.8 },
        scene
      );
      leaves.position.set(x, 2.6, z);
      leaves.material = leafMat;
      shadowGenerator.addShadowCaster(leaves);
    });

    // Tiger.
    const tiger = MeshBuilder.CreateCapsule(
      "Tiger",
      { height: 1.5, radius: 0.45 },
      scene
    );
    tiger.position.set(0, 0.8, 1);
    tiger.material = blueMat;
    shadowGenerator.addShadowCaster(tiger);

    const tigerHead = MeshBuilder.CreateSphere(
      "TigerHead",
      { diameter: 0.85 },
      scene
    );
    tigerHead.parent = tiger;
    tigerHead.position.set(0, 0.75, 0);

    for (const offset of [-0.17, 0.17]) {
      const eye = MeshBuilder.CreateSphere(
        `TigerEye${offset}`,
        { diameter: 0.13 },
        scene
      );
      eye.parent = tiger;
      eye.position.set(offset, 0.82, 0.35);
      eye.material = blackMat;
    }

    const tigerNose = MeshBuilder.CreateSphere(
      "TigerNose",
      { diameter: 0.1 },
      scene
    );
    tigerNose.parent = tiger;
    tigerNose.position.set(0, 0.68, 0.4);
    tigerNose.material = pinkMat;

    const camera = new ArcRotateCamera(
      "Camera",
      -Math.PI / 2,
      Math.PI / 3,
      16,
      tiger.position.clone(),
      scene
    );
    camera.lowerRadiusLimit = 7;
    camera.upperRadiusLimit = 34;
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = Math.PI / 2.05;
    camera.inertia = 0.65;
    camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    camera.attachControl(canvas, true);
    camera.lockedTarget = tiger;

    // Mana crystals throughout the expanded world.
    const manaCrystals: Mesh[] = [];
    const crystalPositions = [
      [-4, -2], [4, -4], [-7, 5], [7, -7],
      [1, -9], [10, 0], [-9, -10], [3, 12],
      [-16, -14], [-22, -5], [-28, 8], [-18, 20],
      [-8, 25], [5, 28], [18, 23], [29, 15],
      [32, 0], [25, -18], [13, -28], [-4, -30],
      [-20, -27], [30, 29], [-32, 15], [0, 2],
      [15, 10], [-25, 0], [8, 20], [22, -5],
    ];

    crystalPositions.forEach(([x, z], i) => {
      const crystal = MeshBuilder.CreatePolyhedron(
        `ManaCrystal${i}`,
        { type: 1, size: 0.65 },
        scene
      );
      crystal.position.set(x, 0.9, z);
      crystal.material = manaMat;
      crystal.isPickable = false;
      manaCrystals.push(crystal);
    });

    // BONUS HEART PICKUPS SCATTERED AROUND THE YARD.
    // Hearts are collected by walking close to them; each restores one health.
    const heartPickups: HeartPickup[] = [];
    const heartPositions = [
      [-2, -6], [8, 3], [-11, -5], [4, 10],
      [-17, -10], [-25, 5], [-19, 23], [-5, 28],
      [12, 25], [27, 18], [34, 0], [24, -23],
      [7, -31], [-17, -29], [-31, -18], [0, 18],
    ];

    heartPositions.forEach(([x, z], index) => {
      const parts: Mesh[] = [];

      const leftLobe = MeshBuilder.CreateSphere(
        `BonusHeart${index}Left`,
        { diameter: 0.48, segments: 10 },
        scene
      );
      leftLobe.position.set(x - 0.16, 0.83, z);
      leftLobe.scaling.set(1, 1, 0.65);
      leftLobe.material = heartRedMat;
      leftLobe.isPickable = false;
      parts.push(leftLobe);

      const rightLobe = MeshBuilder.CreateSphere(
        `BonusHeart${index}Right`,
        { diameter: 0.48, segments: 10 },
        scene
      );
      rightLobe.position.set(x + 0.16, 0.83, z);
      rightLobe.scaling.set(1, 1, 0.65);
      rightLobe.material = heartRedMat;
      rightLobe.isPickable = false;
      parts.push(rightLobe);

      const point = MeshBuilder.CreateCylinder(
        `BonusHeart${index}Point`,
        {
          height: 0.4,
          diameterTop: 0,
          diameterBottom: 0.38,
          tessellation: 4,
        },
        scene
      );
      point.position.set(x, 0.64, z);
      point.rotation.y = Math.PI / 4;
      point.rotation.z = Math.PI;
      point.material = heartRedMat;
      point.isPickable = false;
      parts.push(point);

      const highlight = MeshBuilder.CreateSphere(
        `BonusHeart${index}Highlight`,
        { diameter: 0.1, segments: 8 },
        scene
      );
      highlight.position.set(x - 0.2, 0.92, z - 0.04);
      highlight.material = heartHighlightMat;
      highlight.isPickable = false;
      parts.push(highlight);

      heartPickups.push({
        x,
        z,
        parts,
        baseY: parts.map((part) => part.position.y),
        collected: false,
      });
    });

    // Cats.
    const cats: Cat[] = [];

    const createCat = (
      name: string,
      x: number,
      z: number,
      color: StandardMaterial
    ) => {
      const parts: Mesh[] = [];

      const addPart = (
        mesh: Mesh,
        px: number,
        py: number,
        pz: number,
        material = color
      ) => {
        mesh.position.set(px, py, pz);
        mesh.material = material;
        mesh.isPickable = false;
        parts.push(mesh);
        return mesh;
      };

      addPart(
        MeshBuilder.CreateSphere(`${name}Body`, { diameter: 0.8 }, scene),
        x, 0.45, z
      );

      addPart(
        MeshBuilder.CreateSphere(`${name}Head`, { diameter: 0.65 }, scene),
        x, 0.85, z + 0.35
      );

      const leftEar = addPart(
        MeshBuilder.CreateCylinder(
          `${name}EarLeft`,
          { height: 0.32, diameterTop: 0, diameterBottom: 0.24 },
          scene
        ),
        x - 0.2, 1.17, z + 0.35
      );
      leftEar.rotation.z = -0.18;

      const rightEar = addPart(
        MeshBuilder.CreateCylinder(
          `${name}EarRight`,
          { height: 0.32, diameterTop: 0, diameterBottom: 0.24 },
          scene
        ),
        x + 0.2, 1.17, z + 0.35
      );
      rightEar.rotation.z = 0.18;

      for (const offset of [-0.13, 0.13]) {
        addPart(
          MeshBuilder.CreateSphere(
            `${name}Eye${offset}`,
            { diameter: 0.09 },
            scene
          ),
          x + offset, 0.9, z + 0.64, blackMat
        );
      }

      addPart(
        MeshBuilder.CreateSphere(`${name}Nose`, { diameter: 0.09 }, scene),
        x, 0.8, z + 0.68, pinkMat
      );

      const tail = addPart(
        MeshBuilder.CreateCylinder(
          `${name}Tail`,
          { height: 0.65, diameter: 0.13 },
          scene
        ),
        x + 0.43, 0.55, z - 0.22
      );
      tail.rotation.z = Math.PI / 3;

      cats.push({
        name,
        x,
        z,
        parts,
        rescued: false,
        housed: false,
        barnIndex: null,
      });
    };

    createCat("Mittens", -4, -3, whiteMat);
    createCat("Pumpkin", 5, -5, orangeMat);
    createCat("Shadow", -7, 1, grayMat);

    // Resource pickups.
    const resources: Resource[] = [];

    const createResource = (
      type: "wood" | "stone",
      x: number,
      z: number,
      index: number
    ) => {
      const mesh =
        type === "wood"
          ? MeshBuilder.CreateBox(
              `WoodResource${index}`,
              { width: 0.85, height: 0.65, depth: 0.85 },
              scene
            )
          : MeshBuilder.CreatePolyhedron(
              `StoneResource${index}`,
              { type: 1, size: 0.55 },
              scene
            );

      mesh.position.set(x, type === "wood" ? 0.38 : 0.5, z);
      mesh.material = type === "wood" ? woodMat : grayMat;
      mesh.isPickable = false;

      resources.push({ type, mesh, x, z, collected: false });
    };

    [
      [-5, -8], [2, -7], [-9, 3], [8, -5],
      [1, -11], [12, -3], [-12, -9],
      [-18, -18], [-26, -12], [-30, 4],
      [-23, 16], [-14, 26], [-2, 31],
      [11, 30], [24, 25], [34, 12],
      [31, -9], [22, -25], [7, -33],
      [-12, -31], [-29, -24], [18, 5],
      [-20, 3], [3, 19], [28, -2],
    ].forEach(([x, z], i) => createResource("wood", x, z, i));

    [
      [-6, -6], [6, 5], [-10, -2], [12, 6],
      [-2, -13], [9, 11],
      [-25, -18], [-32, -5], [-24, 12],
      [-15, 22], [-4, 27], [9, 23],
      [20, 30], [33, 22], [35, -15],
      [26, -29], [12, -32], [-7, -25],
      [-19, -29], [3, 5], [16, -12],
      [-30, 26], [23, 11], [-13, -16],
    ].forEach(([x, z], i) => createResource("stone", x, z, i));

    // Milo.
    const npcX = -8;
    const npcZ = -4;

    const npcBody = MeshBuilder.CreateCylinder(
      "MiloBody",
      { height: 1.25, diameter: 0.65 },
      scene
    );
    npcBody.position.set(npcX, 0.68, npcZ);
    npcBody.material = npcMat;

    const npcHead = MeshBuilder.CreateSphere(
      "MiloHead",
      { diameter: 0.7 },
      scene
    );
    npcHead.position.set(npcX, 1.55, npcZ);
    npcHead.material = whiteMat;

    for (const offset of [-0.13, 0.13]) {
      const eye = MeshBuilder.CreateSphere(
        `MiloEye${offset}`,
        { diameter: 0.08 },
        scene
      );
      eye.position.set(npcX + offset, 1.6, npcZ + 0.3);
      eye.material = blackMat;
    }

    const npcMarker = MeshBuilder.CreateTorus(
      "MiloQuestMarker",
      { diameter: 0.75, thickness: 0.12 },
      scene
    );
    npcMarker.position.set(npcX, 2.25, npcZ);
    npcMarker.material = manaMat;

    // Slimes.
    const slimes: Slime[] = [];

    const createSlime = (x: number, z: number, index: number) => {
      const body = MeshBuilder.CreateSphere(
        `Slime${index}`,
        { diameter: 1.2, segments: 12 },
        scene
      );
      body.position.set(x, 0.48, z);
      body.scaling.y = 0.8;
      body.material = slimeMat;
      body.isPickable = false;
      shadowGenerator.addShadowCaster(body);

      const eyes: Mesh[] = [];

      for (const offset of [-0.2, 0.2]) {
        const eye = MeshBuilder.CreateSphere(
          `Slime${index}Eye${offset}`,
          { diameter: 0.16 },
          scene
        );
        eye.position.set(x + offset, 0.55, z + 0.48);
        eye.material = slimeEyeMat;
        eye.isPickable = false;
        eyes.push(eye);
      }

      slimes.push({
        x,
        z,
        health: 2,
        alive: true,
        body,
        eyes,
        hitFlash: 0,
        stompCooldown: 0,
      });
    };

    createSlime(-6, -10, 0);
    createSlime(7, -2, 1);
    createSlime(10, 7, 2);
    createSlime(-12, 9, 3);

    const projectiles: Projectile[] = [];

    let buildX = 0;
    let buildZ = 0;
    let barnRotation = 0;
    let buildMode: BuildMode = "none";
    let woodCount = 0;
    let stoneCount = 0;
    let manaCount = 0;
    let catsHousedCount = 0;
    let healthCount = 5;
    let slimeKillCount = 0;
    let charmCreated = false;
    let questStartedLocal = false;
    let questClaimed = false;
    let lastDamageTime = 0;
    let previousFrameTime = performance.now();
    let jumpVelocity = 0;
    let isGrounded = true;

    const keys = new Set<string>();
    const roadTiles: RoadTile[] = [];
    const barns: Barn[] = [];
    let roadPreview: Mesh[] = [];
    let roadX = 0;
    let roadZ = 0;
    let roadRotation = 0;

    const setMode = (nextMode: BuildMode) => {
      buildMode = nextMode;
      setModeUI(nextMode);
      keys.clear();
    };

    // Barn layout uses a clear front opening so housed cats can be seen.
    const barnLocalPositions = [
      [0, 0],
      [0, 1.6],
      [-1.9, 0],
      [1.9, 0],
      [-1.35, -1.6],
      [1.35, -1.6],
      [-0.92, 0],
      [0.92, 0],
    ];

    const addBarnPart = (
      name: string,
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      mat: StandardMaterial,
      rotationZ = 0
    ) => {
      const mesh = MeshBuilder.CreateBox(
        name,
        { width, height, depth },
        scene
      );
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      mesh.material = mat;
      mesh.isPickable = false;
      return mesh;
    };

    const createBarnParts = (
      prefix: string,
      material: StandardMaterial,
      roofMaterial: StandardMaterial
    ): Mesh[] => [
      addBarnPart(`${prefix}Floor`, 4, 0.18, 3.4, 0, 0.13, 0, material),
      addBarnPart(`${prefix}BackWall`, 4, 2.4, 0.18, 0, 1.4, 1.6, material),
      addBarnPart(`${prefix}LeftWall`, 0.18, 2.4, 3.4, -1.9, 1.4, 0, material),
      addBarnPart(`${prefix}RightWall`, 0.18, 2.4, 3.4, 1.9, 1.4, 0, material),
      addBarnPart(`${prefix}FrontLeft`, 1.25, 2.4, 0.18, -1.35, 1.4, -1.6, material),
      addBarnPart(`${prefix}FrontRight`, 1.25, 2.4, 0.18, 1.35, 1.4, -1.6, material),
      addBarnPart(`${prefix}RoofLeft`, 2.35, 0.22, 3.8, -0.92, 2.75, 0, roofMaterial, -0.48),
      addBarnPart(`${prefix}RoofRight`, 2.35, 0.22, 3.8, 0.92, 2.75, 0, roofMaterial, 0.48),
    ];

    const ghostParts = createBarnParts(
      "GhostBarn",
      ghostMat,
      ghostMat
    );
    ghostParts.forEach((part) => part.setEnabled(false));

    const placeParts = (
      parts: Mesh[],
      x: number,
      z: number,
      rotation: number
    ) => {
      const radians = (rotation * Math.PI) / 180;

      parts.forEach((part, index) => {
        const [localX, localZ] = barnLocalPositions[index];

        part.position.x =
          x + localX * Math.cos(radians) -
          localZ * Math.sin(radians);
        part.position.z =
          z + localX * Math.sin(radians) +
          localZ * Math.cos(radians);

        const slope = index === 6 ? -0.48 : index === 7 ? 0.48 : 0;
        part.rotation.set(0, radians, slope);
      });
    };

    const updateBarnPreview = () => {
      placeParts(ghostParts, buildX, buildZ, barnRotation);
    };

    const makeBarn = (
      x: number,
      z: number,
      rotation: number,
      index: number
    ): Barn => {
      const parts = createBarnParts(
        `BuiltBarn${index}`,
        barnRedMat,
        roofWoodMat
      );
      placeParts(parts, x, z, rotation);
      parts.forEach((part) => shadowGenerator.addShadowCaster(part));

      return { x, z, rotation, parts };
    };

    const createRoadTile = (
      x: number,
      z: number,
      rotation: number,
      prefix: string,
      preview = false
    ) => {
      const radians = (rotation * Math.PI) / 180;

      const tile = MeshBuilder.CreateBox(
        `${prefix}Surface`,
        { width: 2, height: 0.08, depth: 2 },
        scene
      );
      tile.position.set(x, 0.045, z);
      tile.rotation.y = radians;
      tile.material = preview ? ghostMat : roadMat;
      tile.isPickable = false;

      const dash = MeshBuilder.CreateBox(
        `${prefix}CenterLine`,
        { width: 0.12, height: 0.025, depth: 0.75 },
        scene
      );
      dash.position.set(x, 0.1, z);
      dash.rotation.y = radians;
      dash.material = preview ? ghostMat : roadLineMat;
      dash.isPickable = false;

      return [tile, dash];
    };

    const clearRoadPreview = () => {
      roadPreview.forEach((part) => part.dispose());
      roadPreview = [];
    };

    const updateRoadPreview = () => {
      if (roadPreview.length === 0) {
        roadPreview = createRoadTile(
          roadX,
          roadZ,
          roadRotation,
          "RoadPreview",
          true
        );
      } else {
        const radians = (roadRotation * Math.PI) / 180;
        roadPreview[0].position.set(roadX, 0.045, roadZ);
        roadPreview[0].rotation.y = radians;
        roadPreview[1].position.set(roadX, 0.1, roadZ);
        roadPreview[1].rotation.y = radians;
      }
    };

    // Place a housed cat inside a barn and make its model visible again.
    const houseOneCat = () => {
      if (barns.length === 0) {
        setMessage("Build a barn first, then you can house rescued cats.");
        return;
      }

      const nextCat = cats.find(
        (cat) => cat.rescued && !cat.housed
      );

      if (!nextCat) {
        setMessage("No rescued cats are waiting for a home right now.");
        return;
      }

      const slots = [
        [-0.85, -0.62],
        [0, -0.62],
        [0.85, -0.62],
        [-0.85, 0.45],
        [0, 0.45],
        [0.85, 0.45],
      ];

      const barnIndex = barns.findIndex((_, index) => {
        const count = cats.filter(
          (cat) => cat.housed && cat.barnIndex === index
        ).length;
        return count < slots.length;
      });

      if (barnIndex < 0) {
        setMessage("All barn spots are full. Build another barn for more cats!");
        return;
      }

      const barn = barns[barnIndex];
      const housedInBarn = cats.filter(
        (cat) => cat.housed && cat.barnIndex === barnIndex
      ).length;

      const [localX, localZ] = slots[housedInBarn];
      const radians = (barn.rotation * Math.PI) / 180;

      const targetX =
        barn.x + localX * Math.cos(radians) -
        localZ * Math.sin(radians);
      const targetZ =
        barn.z + localX * Math.sin(radians) +
        localZ * Math.cos(radians);

      const deltaX = targetX - nextCat.x;
      const deltaZ = targetZ - nextCat.z;

      nextCat.parts.forEach((part) => {
        part.position.x += deltaX;
        part.position.z += deltaZ;
        part.setEnabled(true);
        shadowGenerator.addShadowCaster(part);
      });

      nextCat.x = targetX;
      nextCat.z = targetZ;
      nextCat.housed = true;
      nextCat.barnIndex = barnIndex;

      catsHousedCount += 1;
      setCatsHoused(catsHousedCount);
      setMessage(
        `${nextCat.name} is now visible in Barn ${barnIndex + 1}! 🐈🏠`
      );
    };

    houseCatActionRef.current = houseOneCat;

    const fireProjectile = () => {
      if (buildMode !== "none") return;

      if (manaCount < 1) {
        setMessage("You need 1 mana to cast a magic bolt. Find a blue crystal!");
        return;
      }

      manaCount -= 1;
      setMana(manaCount);

      const dx = Math.sin(tiger.rotation.y);
      const dz = Math.cos(tiger.rotation.y);

      const projectile = MeshBuilder.CreateSphere(
        `MagicBolt${performance.now()}`,
        { diameter: 0.38, segments: 8 },
        scene
      );
      projectile.position.set(
        tiger.position.x + dx * 0.85,
        1.05,
        tiger.position.z + dz * 0.85
      );
      projectile.material = magicMat;
      projectile.isPickable = false;

      projectiles.push({
        mesh: projectile,
        x: projectile.position.x,
        z: projectile.position.z,
        vx: dx * 0.42,
        vz: dz * 0.42,
        life: 65,
      });

      setMessage("Magic bolt cast! Hit a slime to protect the yard.");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      ) {
        event.preventDefault();
      }

      if (event.repeat) return;

      if (buildMode !== "none") {
        if (key === "escape") {
          setMode("none");
          ghostParts.forEach((part) => part.setEnabled(false));
          clearRoadPreview();
          setMessage("Placement cancelled. Keep exploring!");
          return;
        }

        if (buildMode === "barn") {
          if (key === "b") {
            setMode("none");
            ghostParts.forEach((part) => part.setEnabled(false));
            setMessage("Barn placement cancelled.");
            return;
          }

          if (key === "q" || key === "r") {
            barnRotation =
              (barnRotation + (key === "r" ? 90 : 270)) % 360;
            updateBarnPreview();
            return;
          }

          if (key === "arrowup" || key === "w") buildZ -= 1;
          else if (key === "arrowdown" || key === "s") buildZ += 1;
          else if (key === "arrowleft" || key === "a") buildX -= 1;
          else if (key === "arrowright" || key === "d") buildX += 1;
          else if (key === "enter") {
            if (woodCount < 5 || stoneCount < 3) {
              setMessage("A barn needs 5 wood and 3 stone.");
              return;
            }

            const tooCloseToTiger =
              Math.hypot(
                buildX - tiger.position.x,
                buildZ - tiger.position.z
              ) < 2.5;

            const tooCloseToHouse =
              Math.hypot(buildX, buildZ - 8) < 5;

            const tooCloseToAnotherBarn = barns.some(
              (barn) => Math.hypot(buildX - barn.x, buildZ - barn.z) < 5
            );

            if (tooCloseToTiger || tooCloseToHouse || tooCloseToAnotherBarn) {
              setMessage(
                "Move the barn away from Tiger, the house, and other barns."
              );
              return;
            }

            const newBarn = makeBarn(
              buildX,
              buildZ,
              barnRotation,
              barns.length
            );

            barns.push(newBarn);

            woodCount -= 5;
            stoneCount -= 3;
            setWood(woodCount);
            setStone(stoneCount);

            setBarnBuilt(true);
            setBarnCount(barns.length);

            setMode("none");
            ghostParts.forEach((part) => part.setEnabled(false));

            setMessage(
              `Barn ${barns.length} built! You can build more barns whenever you have enough resources.`
            );
            return;
          } else {
            return;
          }

          buildX = Math.max(-35, Math.min(35, buildX));
          buildZ = Math.max(-35, Math.min(35, buildZ));
          updateBarnPreview();
          return;
        }

        if (buildMode === "road") {
          if (key === "t") {
            setMode("none");
            clearRoadPreview();
            setMessage("Road placement cancelled.");
            return;
          }

          if (key === "q" || key === "r") {
            roadRotation =
              (roadRotation + (key === "r" ? 90 : 270)) % 360;
            updateRoadPreview();
            return;
          }

          if (key === "arrowup" || key === "w") roadZ -= 2;
          else if (key === "arrowdown" || key === "s") roadZ += 2;
          else if (key === "arrowleft" || key === "a") roadX -= 2;
          else if (key === "arrowright" || key === "d") roadX += 2;
          else if (key === "enter") {
            if (woodCount < 1 || stoneCount < 2) {
              setMessage("A road tile needs 1 wood and 2 stone.");
              return;
            }

            const occupied = roadTiles.some(
              (tile) =>
                Math.abs(tile.x - roadX) < 0.5 &&
                Math.abs(tile.z - roadZ) < 0.5
            );

            if (occupied) {
              setMessage("There's already a road tile here.");
              return;
            }

            createRoadTile(
              roadX,
              roadZ,
              roadRotation,
              `RoadTile${roadTiles.length}`,
              false
            );
            roadTiles.push({
              x: roadX,
              z: roadZ,
              rotation: roadRotation,
            });

            woodCount -= 1;
            stoneCount -= 2;
            setWood(woodCount);
            setStone(stoneCount);
            setRoadCount(roadTiles.length);
            setMessage(
              `Road tile placed! You have built ${roadTiles.length} road tile(s).`
            );

            updateRoadPreview();
            return;
          } else {
            return;
          }

          roadX = Math.max(-37, Math.min(37, roadX));
          roadZ = Math.max(-37, Math.min(37, roadZ));
          updateRoadPreview();
          return;
        }
      }

      if (
        [
          "arrowup", "arrowdown", "arrowleft", "arrowright",
          "w", "a", "s", "d", " "
        ].includes(key)
      ) {
        keys.add(key);
      }

      if (key === "f") {
        fireProjectile();
        return;
      }

      // H KEY: HOUSE THE NEXT RESCUED CAT.
      if (key === "h") {
        houseOneCat();
        return;
      }

      if (key === "c") {
        if (charmCreated) {
          setMessage("You already crafted your magic charm!");
          return;
        }

        if (manaCount < 3) {
          setMessage(`Crafting needs 3 mana. You have ${manaCount}.`);
          return;
        }

        manaCount -= 3;
        setMana(manaCount);
        charmCreated = true;
        setCharmCrafted(true);

        const charm = MeshBuilder.CreateSphere(
          "TigerMagicCharm",
          { diameter: 0.28 },
          scene
        );
        charm.parent = tiger;
        charm.position.set(0.48, 0.25, -0.25);
        charm.material = charmMat;

        setMessage("Magic charm crafted! You turned 3 mana into a magical item.");
        return;
      }

      if (key === "e") {
        const npcDistance = Math.hypot(
          tiger.position.x - npcX,
          tiger.position.z - npcZ
        );

        if (npcDistance < 2.4) {
          if (!questStartedLocal) {
            questStartedLocal = true;
            setQuestStarted(true);
            setMessage(
              "Milo: Help protect our yard! Defeat 3 slimes, then come back to me."
            );
          } else if (slimeKillCount >= 3 && !questClaimed) {
            questClaimed = true;
            setQuestComplete(true);
            manaCount += 3;
            setMana(manaCount);
            setMessage(
              "Milo: You did it! Here are 3 bonus mana crystals. You're a hero, Tiger!"
            );
          } else if (questClaimed) {
            setMessage("Milo: Thanks for protecting the yard, Tiger!");
          } else {
            setMessage(
              `Milo: You've defeated ${slimeKillCount}/3 slimes. Keep going!`
            );
          }
          return;
        }

        // Rescue the nearest cat.
        let closestCat: Cat | null = null;
        let closestCatDistance = Infinity;

        for (const cat of cats) {
          if (cat.rescued) continue;

          const distance = Math.hypot(
            tiger.position.x - cat.x,
            tiger.position.z - cat.z
          );

          if (distance < closestCatDistance) {
            closestCatDistance = distance;
            closestCat = cat;
          }
        }

        if (closestCat && closestCatDistance < 2.1) {
          closestCat.rescued = true;
          closestCat.parts.forEach((part) => part.setEnabled(false));
          setCatsRescued(cats.filter((cat) => cat.rescued).length);
          setMessage(
            `${closestCat.name} rescued! Press H or use the House a Cat button after building a barn.`
          );
          return;
        }

        // Collect the closest resource.
        let closestResource: Resource | null = null;
        let closestResourceDistance = Infinity;

        for (const resource of resources) {
          if (resource.collected) continue;

          const distance = Math.hypot(
            tiger.position.x - resource.x,
            tiger.position.z - resource.z
          );

          if (distance < closestResourceDistance) {
            closestResourceDistance = distance;
            closestResource = resource;
          }
        }

        if (closestResource && closestResourceDistance < 1.9) {
          closestResource.collected = true;
          closestResource.mesh.setEnabled(false);

          if (closestResource.type === "wood") {
            woodCount += 1;
            setWood(woodCount);
            setMessage(`Wood collected! You have ${woodCount} wood.`);
          } else {
            stoneCount += 1;
            setStone(stoneCount);
            setMessage(`Stone collected! You have ${stoneCount} stone.`);
          }
        } else {
          setMessage(
            "Get close to Milo, an unrescued cat, wood, or stone, then press E."
          );
        }
      }

      if (key === "b") {
        if (woodCount < 5 || stoneCount < 3) {
          setMessage(
            `Barn recipe: 5 wood + 3 stone. You have ${woodCount} wood and ${stoneCount} stone.`
          );
          return;
        }

        buildX = Math.round(tiger.position.x + 3);
        buildZ = Math.round(tiger.position.z);
        barnRotation = 0;

        updateBarnPreview();
        ghostParts.forEach((part) => part.setEnabled(true));
        setMode("barn");
        setMessage("Place another barn: move with WASD, rotate with Q/R, Enter builds.");
        return;
      }

      if (key === "t") {
        if (woodCount < 1 || stoneCount < 2) {
          setMessage("A road tile needs 1 wood + 2 stone.");
          return;
        }

        roadX = Math.round(tiger.position.x + 2);
        roadZ = Math.round(tiger.position.z);
        roadRotation = 0;

        setMode("road");
        updateRoadPreview();
        setMessage("Place a road tile: move with WASD, rotate with Q/R, Enter places.");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const clearKeys = () => keys.clear();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearKeys);

    engine.runRenderLoop(() => {
      if (scene.isDisposed) return;

      const now = performance.now();
      const deltaMs = Math.min(now - previousFrameTime, 50);
      previousFrameTime = now;
      const dt = deltaMs / 16.667;

      if (buildMode === "none") {
        const moveSpeed = 0.12 * dt;
        let moveX = 0;
        let moveZ = 0;

        const verticalDirection = invertedMovementRef.current ? -1 : 1;
        if (keys.has("arrowup") || keys.has("w")) moveZ -= verticalDirection;
        if (keys.has("arrowdown") || keys.has("s")) moveZ += verticalDirection;
        if (keys.has("arrowleft") || keys.has("a")) moveX -= 1;
        if (keys.has("arrowright") || keys.has("d")) moveX += 1;

        if (moveX !== 0 || moveZ !== 0) {
          const length = Math.hypot(moveX, moveZ);
          moveX /= length;
          moveZ /= length;

          tiger.position.x += moveX * moveSpeed;
          tiger.position.z += moveZ * moveSpeed;
          tiger.rotation.y = Math.atan2(moveX, moveZ);
        }

        if (keys.has(" ") && isGrounded) {
          jumpVelocity = 0.26;
          isGrounded = false;
        }

        if (!isGrounded) {
          tiger.position.y += jumpVelocity * dt;
          jumpVelocity -= 0.012 * dt;

          if (tiger.position.y <= 0.8) {
            tiger.position.y = 0.8;
            jumpVelocity = 0;
            isGrounded = true;
          }
        }

        tiger.position.x = Math.max(-38, Math.min(38, tiger.position.x));
        tiger.position.z = Math.max(-38, Math.min(38, tiger.position.z));
      }

      // Crystal animation and pickup.
      for (const crystal of manaCrystals) {
        if (!crystal.isEnabled()) continue;

        crystal.rotation.y += 0.035 * dt;
        crystal.rotation.x += 0.012 * dt;
        crystal.position.y =
          0.9 + Math.sin(now * 0.003 + crystal.position.x) * 0.12;

        const distance = Math.hypot(
          tiger.position.x - crystal.position.x,
          tiger.position.z - crystal.position.z
        );

        if (distance < 1.2) {
          crystal.setEnabled(false);
          manaCount += 1;
          setMana(manaCount);
          setMessage("Mana collected! Press F to cast a magic bolt.");
        }
      }

      // BONUS HEART ANIMATION AND HEALTH PICKUP.
      for (const heart of heartPickups) {
        if (heart.collected) continue;

        const bob = Math.sin(now * 0.004 + heart.x * 0.7 + heart.z * 0.3) * 0.13;

        heart.parts.forEach((part, index) => {
          part.position.y = heart.baseY[index] + bob;
        });

        const distance = Math.hypot(
          tiger.position.x - heart.x,
          tiger.position.z - heart.z
        );

        if (distance < 1.25) {
          heart.collected = true;
          heart.parts.forEach((part) => part.setEnabled(false));

          if (healthCount < 13) {
            healthCount = Math.min(13, healthCount + 1);
            setHealth(healthCount);
            setMessage(
              `Bonus heart collected! ❤️ Tiger now has ${healthCount}/13 health!`
            );
          } else {
            setMessage(
              "Bonus heart collected! Tiger is already at maximum health (13/13)."
            );
          }
        }
      }

      // Quest marker.
      if (!questClaimed) {
        npcMarker.rotation.y += 0.025 * dt;
        npcMarker.position.y = 2.2 + Math.sin(now * 0.003) * 0.12;
      } else {
        npcMarker.setEnabled(false);
      }

      // Projectiles.
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];

        projectile.x += projectile.vx * dt;
        projectile.z += projectile.vz * dt;
        projectile.life -= dt;

        projectile.mesh.position.x = projectile.x;
        projectile.mesh.position.z = projectile.z;
        projectile.mesh.position.y =
          1.05 + Math.sin(now * 0.02) * 0.04;

        let hit = false;

        for (const slime of slimes) {
          if (!slime.alive) continue;

          const distance = Math.hypot(
            projectile.x - slime.x,
            projectile.z - slime.z
          );

          if (distance < 0.95) {
            slime.health -= 1;
            slime.hitFlash = 12;
            hit = true;

            if (slime.health <= 0) {
              slime.alive = false;
              slime.body.setEnabled(false);
              slime.eyes.forEach((eye) => eye.setEnabled(false));

              slimeKillCount += 1;
              setSlimesDefeated(slimeKillCount);

              manaCount += 1;
              setMana(manaCount);
              setMessage(
                `Slime defeated! +1 mana. Slimes defeated: ${slimeKillCount}/4.`
              );
            } else {
              setMessage("Direct hit! One more hit should defeat this slime.");
            }

            break;
          }
        }

        if (
          hit ||
          projectile.life <= 0 ||
          Math.abs(projectile.x) > 41 ||
          Math.abs(projectile.z) > 41
        ) {
          projectile.mesh.dispose();
          projectiles.splice(i, 1);
        }
      }

      // Slime AI, stomp attacks, and contact damage.
      for (const slime of slimes) {
        if (!slime.alive) continue;

        if (slime.hitFlash > 0) {
          slime.hitFlash = Math.max(0, slime.hitFlash - dt);
          slime.body.scaling.y = 0.55;
        } else {
          slime.body.scaling.y = 0.8;
        }

        const dx = tiger.position.x - slime.x;
        const dz = tiger.position.z - slime.z;
        let distance = Math.hypot(dx, dz);
        let stompedThisFrame = false;

        if (
          !isGrounded &&
          jumpVelocity < 0 &&
          tiger.position.y > 1.0 &&
          distance < 1.25 &&
          now >= slime.stompCooldown
        ) {
          slime.health -= 1;
          slime.hitFlash = 14;
          slime.stompCooldown = now + 450;
          stompedThisFrame = true;

          jumpVelocity = 0.19;
          isGrounded = false;
          tiger.position.y = Math.max(tiger.position.y, 1.05);

          if (slime.health <= 0) {
            slime.alive = false;
            slime.body.setEnabled(false);
            slime.eyes.forEach((eye) => eye.setEnabled(false));

            slimeKillCount += 1;
            setSlimesDefeated(slimeKillCount);

            manaCount += 1;
            setMana(manaCount);

            setMessage(
              `Amazing stomp! Slime defeated! +1 mana. Slimes defeated: ${slimeKillCount}/4.`
            );
          } else {
            setMessage(
              "BOING! Nice stomp, Tiger! One more hit defeats this slime!"
            );
          }
        }

        const currentDx = tiger.position.x - slime.x;
        const currentDz = tiger.position.z - slime.z;
        distance = Math.hypot(currentDx, currentDz);

        if (distance < 10 && distance > 1.05) {
          const speed = 0.035 * dt;
          slime.x += (currentDx / distance) * speed;
          slime.z += (currentDz / distance) * speed;
        }

        slime.body.position.x = slime.x;
        slime.body.position.z = slime.z;
        slime.body.position.y =
          0.48 + Math.sin(now * 0.006 + slime.x) * 0.06;

        slime.eyes[0].position.set(
          slime.x - 0.2,
          slime.body.position.y + 0.07,
          slime.z + 0.48
        );

        slime.eyes[1].position.set(
          slime.x + 0.2,
          slime.body.position.y + 0.07,
          slime.z + 0.48
        );

        if (
          !stompedThisFrame &&
          distance < 1.15 &&
          now - lastDamageTime > 1100
        ) {
          lastDamageTime = now;
          healthCount -= 1;

          if (healthCount <= 0) {
            healthCount = 5;
            tiger.position.set(0, 0.8, 1);
            jumpVelocity = 0;
            isGrounded = true;

            setMessage(
              "Tiger ran out of health and returned home. Try jumping on slimes!"
            );
          } else {
            const pushDistance = Math.max(distance, 0.01);

            tiger.position.x +=
              currentDx === 0
                ? 0.7
                : (currentDx / pushDistance) * 0.8;

            tiger.position.z +=
              currentDz === 0
                ? 0.7
                : (currentDz / pushDistance) * 0.8;

            setMessage(
              "Ouch! Side contact hurts. Jump onto the slime to stomp it!"
            );
          }

          setHealth(healthCount);
        }
      }

      // Check the win condition.
      if (
        !gameWon &&
        questClaimed &&
        cats.every((cat) => cat.rescued && cat.housed)
      ) {
        setGameWon(true);
        setMessage(
          "YOU DID IT, TIGER! Every cat is safe, Milo's quest is complete, and the yard is protected!"
        );
      }

      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      houseCatActionRef.current = null;

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("resize", handleResize);

      engine.stopRenderLoop();
      shadowGenerator.dispose();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-sky-300">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none outline-none"
      />

      <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/30 bg-slate-950/80 p-4 text-white shadow-xl sm:left-6 sm:top-6 sm:p-5">
        <h1 className="text-2xl font-black tracking-wide sm:text-3xl">
          HELLO TIGER!
        </h1>

        <p className="mt-1 text-sm font-semibold text-sky-200">
          Magic, Monsters &amp; Cat Rescue
        </p>

        {gameWon && (
          <div className="mt-3 rounded-xl border border-yellow-300/50 bg-yellow-400/20 p-3">
            <div className="text-lg font-black text-yellow-200">
              🏆 YOU DID IT, TIGER!
            </div>
            <div className="mt-1 text-sm">
              All cats are safe and the yard is protected!
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Tiger health</div>
            <div className="text-lg font-bold">{health}/13 ❤️</div>
            <div className="text-xs text-slate-300">Find bonus hearts to heal</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Mana</div>
            <div className="text-lg font-bold">{mana} 💎</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Slimes defeated</div>
            <div className="text-lg font-bold">{slimesDefeated}/4</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Magic charm</div>
            <div className="text-lg font-bold">
              {charmCrafted ? "Crafted ✨" : "3 mana"}
            </div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Cats rescued</div>
            <div className="text-lg font-bold">{catsRescued}/3 🐈</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Cats housed</div>
            <div className="text-lg font-bold">{catsHoused}/3 🏠</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Wood</div>
            <div className="text-lg font-bold">{wood} 🪵</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Stone</div>
            <div className="text-lg font-bold">{stone} 🪨</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Barns built</div>
            <div className="text-lg font-bold">{barnCount} 🏠</div>
          </div>

          <div className="rounded-xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">Road tiles</div>
            <div className="text-lg font-bold">{roadCount} 🛣️</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
          <div className="text-xs text-slate-300">Milo&apos;s quest</div>
          <div className="font-bold">
            {questComplete
              ? "Complete! +3 bonus mana ✓"
              : questStarted
                ? `Defeat 3 slimes: ${Math.min(slimesDefeated, 3)}/3`
                : "Find Milo and press E"}
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
          <div className="text-xs text-slate-300">Selected activity</div>
          <div className="font-bold">
            {mode === "barn"
              ? "Place a barn"
              : mode === "road"
                ? "Build a road tile"
                : "Explore and defend the yard"}
          </div>
        </div>

        <div className="pointer-events-auto mt-3 rounded-xl border border-amber-200/30 bg-amber-400/10 p-3">
          <div className="text-xs text-amber-100">Cat care</div>
          <div className="mt-1 text-sm font-bold">
            {!barnBuilt
              ? "Build a barn to house rescued cats."
              : canHouseCat
                ? `${catsRescued - catsHoused} rescued cat(s) ready for a home!`
                : "Rescue a cat to make it available here."}
          </div>

          <button
            type="button"
            disabled={!canHouseCat}
            onClick={() => houseCatActionRef.current?.()}
            className="mt-2 w-full rounded-lg border border-amber-100/30 bg-amber-500 px-3 py-2 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🐈 House a Cat (H)
          </button>
        </div>

        <div className="pointer-events-auto mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
          <div className="text-xs text-slate-300">Movement controls</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Vertical movement</div>
              <div className="text-xs text-slate-300">
                {invertedMovement
                  ? "Inverted: Up / W moves down"
                  : "Normal: Up / W moves up"}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={invertedMovement}
              onClick={() => {
                const nextValue = !invertedMovement;
                invertedMovementRef.current = nextValue;
                setInvertedMovement(nextValue);
              }}
              className="shrink-0 rounded-lg border border-sky-200/40 bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              {invertedMovement ? "Turn off" : "Invert"}
            </button>
          </div>
        </div>

        <p className="mt-3 max-w-72 text-sm leading-relaxed text-white">
          {message}
        </p>
      </div>

      ```
  <div className="pointer-events-none absolute bottom-4 right-4 left-auto max-h-[45vh] w-[min(22rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-white/20 bg-slate-950/85 p-3 text-xs text-white shadow-xl sm:bottom-6 sm:right-6 sm:max-h-[55vh] sm:p-4 sm:text-sm">
    {mode === "road" ? (
      <>
        <p className="mb-2 font-bold text-cyan-300">ROAD-BUILDING MODE</p>
        <p>Recipe: 1 wood + 2 stone per tile</p>
        <p>WASD / Arrows — Move road preview</p>
        <p>Q / R — Rotate</p>
        <p>Enter — Place tile</p>
        <p>T / Escape — Exit</p>
      </>
    ) : mode === "barn" ? (
      <>
        <p className="mb-2 font-bold text-cyan-300">BARN-PLACEMENT MODE</p>
        <p>Recipe: 5 wood + 3 stone per barn</p>
        <p>WASD / Arrows — Move barn</p>
        <p>Q / R — Rotate</p>
        <p>Enter — Build another barn</p>
        <p>B / Escape — Cancel</p>
      </>
    ) : (
      <>
        <p className="mb-2 font-bold text-sky-200">HOW TO PLAY</p>
        <p>WASD / Arrows — Move Tiger</p>
        <p>Space — Jump and stomp slimes while descending</p>
        <p>F — Fire magic bolt (costs 1 mana)</p>
        <p>C — Craft magic charm (costs 3 mana)</p>
        <p>E — Talk to Milo, rescue cats, collect wood and stone</p>
        <p>H / House a Cat button — House a rescued cat in a barn</p>
        <p>❤️ Collect floating bonus hearts to heal up to 13 health</p>
        <p>B — Build another barn (5 wood + 3 stone)</p>
        <p>T — Place road tiles (1 wood + 2 stone each)</p>
        <p>Mouse drag / scroll — Rotate camera / zoom</p>
      </>
    )}
  </div>
```

    </main>
  );
}