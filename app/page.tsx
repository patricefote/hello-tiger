"use client";

let rusticTimberMat: Material | null = null;
let weatheredPlanksMat: Material | null = null;

import { useEffect, useRef, useState } from "react";
import "@babylonjs/loaders/glTF";
import {
  AnimationGroup,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";

type Cat = {
  name: string;
  x: number;
  z: number;
  parts: Mesh[];
  partOffsets: Vector3[];
  modelRoot: TransformNode | null;
  animationGroups: AnimationGroup[];
  targetX: number;
  targetZ: number;
  yaw: number;
  restingUntil: number;
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

type BuildMode = "none" | "barn" | "road" | "water";

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

type WaterTile = {
  x: number;
  z: number;
  parts: Mesh[];
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRootRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const houseCatActionRef = useRef<(() => void) | null>(null);

  const [catsRescued, setCatsRescued] = useState(0);
  const [catsHoused, setCatsHoused] = useState(0);
  const [mana, setMana] = useState(0);
  const [wood, setWood] = useState(0);
  const [stone, setStone] = useState(0);
  const [barnBuilt, setBarnBuilt] = useState(false);
  const [barnCount, setBarnCount] = useState(0);
  const [roadCount, setRoadCount] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
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
    "Welcome home, Tiger! Collect mana, meet Paris, and protect the yard."
  );

  const canHouseCat = barnBuilt && catsRescued > catsHoused;

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === gameRootRef.current);
      // Make Babylon recalculate the canvas dimensions after entering or leaving
      // fullscreen, including when the user presses Escape.
      window.dispatchEvent(new Event("resize"));
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    const gameRoot = gameRootRef.current;
    if (!gameRoot) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await gameRoot.requestFullscreen();
      }
    } catch (error) {
      console.error("Unable to toggle fullscreen mode:", error);
      setMessage("Fullscreen isn't available in this browser window. Try opening the game in a regular browser tab.");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      powerPreference: "high-performance",
    });

    // Keep the game crisp instead of deliberately rendering at reduced resolution.
    engine.setHardwareScalingLevel(1);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.55, 0.78, 0.98, 1);
    scene.skipPointerMovePicking = true;

    // Disable fog to remove the enclosed-horizon haze.
    scene.fogMode = Scene.FOGMODE_NONE;
    scene.fogDensity = 0;

    // A restrained cinematic grade adds depth without making the kid-friendly
    // palette too dark or oversaturated.
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.05;
    scene.imageProcessingConfiguration.contrast = 1.12;

    const makeMaterial = (
      name: string,
      color: Color3,
      alpha = 1
    ) => {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor = color;
      // Keep surfaces softly lit instead of producing tiny, distracting glossy hotspots.
      mat.specularColor = new Color3(0.10, 0.10, 0.10);
      mat.specularPower = 48;
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
    const kidSkinMat = makeMaterial("TigerSkin", new Color3(0.79, 0.51, 0.36));
    const kidHairMat = makeMaterial("TigerHair", new Color3(0.22, 0.105, 0.055));
    const kidShortsMat = makeMaterial("TigerShorts", new Color3(0.16, 0.31, 0.72));
    const kidShoeMat = makeMaterial("TigerShoes", new Color3(0.92, 0.22, 0.16));
    const kidSoleMat = makeMaterial("TigerSoles", new Color3(0.96, 0.91, 0.78));
    const kidMouthMat = makeMaterial("TigerSmile", new Color3(0.32, 0.12, 0.10));
    const kidHairHighlightMat = makeMaterial("TigerHairHighlights", new Color3(0.34, 0.17, 0.085));
    const kidInnerEarMat = makeMaterial("TigerInnerEar", new Color3(0.66, 0.28, 0.25));
    const kidShirtTrimMat = makeMaterial("TigerShirtTrim", new Color3(0.08, 0.27, 0.64));
    const kidShirtLightMat = makeMaterial("TigerShirtLight", new Color3(0.22, 0.54, 0.98));
    const kidStitchMat = makeMaterial("TigerStitching", new Color3(0.99, 0.82, 0.33));
    const leafMat = makeMaterial("Leaves", new Color3(0.12, 0.43, 0.16));
    const leafLightMat = makeMaterial("LeavesLight", new Color3(0.19, 0.52, 0.20));
    const leafDeepMat = makeMaterial("LeavesDeep", new Color3(0.08, 0.34, 0.13));
    const barkLightMat = makeMaterial("TreeBarkLight", new Color3(0.66, 0.42, 0.22));
    const barkDeepMat = makeMaterial("TreeBarkGrooves", new Color3(0.30, 0.17, 0.09));
    const manaMat = makeMaterial("ManaCrystal", new Color3(0.1, 0.95, 1));
    const whiteMat = makeMaterial("White", new Color3(0.96, 0.96, 0.96));
    const blackMat = makeMaterial("Black", new Color3(0.035, 0.035, 0.035));
    const pinkMat = makeMaterial("Pink", new Color3(1, 0.35, 0.55));
    const orangeMat = makeMaterial("Orange", new Color3(1, 0.35, 0.06));
    const grayMat = makeMaterial("Gray", new Color3(0.38, 0.4, 0.46));
    // Dedicated stone material so Shadow the cat keeps its original gray color.
    const stoneMat = makeMaterial("NaturalStone", Color3.White());
    stoneMat.specularColor = new Color3(0.12, 0.12, 0.12);
    stoneMat.specularPower = 12;
    const barnRedMat = makeMaterial("BarnRed", new Color3(0.75, 0.12, 0.12));
    const roofWoodMat = makeMaterial("BarnRoof", new Color3(0.32, 0.17, 0.12));
    const ghostMat = makeMaterial("BuildingPreview", new Color3(0.2, 0.9, 1), 0.38);
    const roadMat = makeMaterial("RoadSurface", new Color3(0.34, 0.36, 0.4));
    const roadLineMat = makeMaterial("RoadMarkings", new Color3(0.95, 0.85, 0.45));
    const roadEdgeMat = makeMaterial("RoadCurb", new Color3(0.57, 0.59, 0.61));
    const waterMat = makeMaterial("WaterBlock", new Color3(0.08, 0.62, 0.92), 0.78);
    waterMat.emissiveColor = new Color3(0.02, 0.16, 0.22);
    waterMat.specularColor = new Color3(0.75, 0.9, 1);
    waterMat.specularPower = 64;
    const waterRippleMat = makeMaterial("WaterRipple", new Color3(0.55, 0.94, 1), 0.82);
    const hayMat = makeMaterial("BarnHay", new Color3(0.88, 0.66, 0.25));
    const bowlMat = makeMaterial("CatBowl", new Color3(0.12, 0.65, 0.82));
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

    // PROCEDURAL WORLD TEXTURES: drawn in code, so no image downloads are needed.
    const makePatternTexture = (
      name: string,
      drawPattern: (ctx: ReturnType<DynamicTexture["getContext"]>, size: number) => void,
      repeatsU = 1,
      repeatsV = 1
    ) => {
      const texture = new DynamicTexture(
        name,
        { width: 512, height: 512 },
        scene,
        false
      );
      const ctx = texture.getContext();
      drawPattern(ctx, 512);
      texture.update(false);
      texture.wrapU = Texture.WRAP_ADDRESSMODE;
      texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.uScale = repeatsU;
      texture.vScale = repeatsV;
      texture.anisotropicFilteringLevel = 4;
      return texture;
    };

    const grassTexture = makePatternTexture(
      "GrassTexture",
      (ctx, size) => {
        ctx.fillStyle = "#4d9b43";
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1800; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const shade = Math.random();
          ctx.strokeStyle = shade > 0.5 ? "#76b957" : "#347c35";
          ctx.lineWidth = 1 + Math.random() * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 5, y - 2 - Math.random() * 6);
          ctx.stroke();
        }
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = i % 2 ? "rgba(35,105,39,0.12)" : "rgba(190,218,100,0.12)";
          const cx = Math.random() * size;
          const cy = Math.random() * size;
          const rx = 5 + Math.random() * 15;
          const ry = 3 + Math.random() * 9;
          const angle = Math.random() * Math.PI;
          ctx.beginPath();
          for (let point = 0; point <= 12; point++) {
            const a = (point / 12) * Math.PI * 2;
            const px = cx + Math.cos(a) * rx * Math.cos(angle) - Math.sin(a) * ry * Math.sin(angle);
            const py = cy + Math.cos(a) * rx * Math.sin(angle) + Math.sin(a) * ry * Math.cos(angle);
            if (point === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      },
      16,
      16
    );

    const plasterTexture = makePatternTexture(
      "HousePlasterTexture",
      (ctx, size) => {
        ctx.fillStyle = "#ead1a4";
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 2600; i++) {
          const light = Math.random() > 0.5;
          ctx.fillStyle = light ? "rgba(255,247,220,0.28)" : "rgba(133,91,49,0.10)";
          ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 1 + Math.random() * 3);
        }
      },
      2,
      2
    );

    const terracottaTexture = makePatternTexture(
      "TerracottaRoofTexture",
      (ctx, size) => {
        ctx.fillStyle = "#8f3328";
        ctx.fillRect(0, 0, size, size);
        const tileW = 64;
        const tileH = 34;
        for (let row = 0; row < size / tileH + 1; row++) {
          const offset = row % 2 ? -tileW / 2 : 0;
          for (let col = -1; col < size / tileW + 1; col++) {
            const x = col * tileW + offset;
            const y = row * tileH;
            ctx.fillStyle = ["#a84432", "#b94e37", "#963729", "#c05a3c"][Math.floor(Math.random() * 4)];
            // Rectangular tile edges keep this compatible with Babylon's canvas context.
            ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 3);
            ctx.strokeStyle = "rgba(70,24,20,0.45)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, tileW - 4, tileH - 3);
            ctx.strokeStyle = "rgba(255,190,130,0.22)";
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 6);
            ctx.lineTo(x + tileW - 9, y + 6);
            ctx.stroke();
          }
        }
      },
      2,
      2
    );

    const timberTexture = makePatternTexture(
      "TimberPlankTexture",
      (ctx, size) => {
        ctx.fillStyle = "#87552f";
        ctx.fillRect(0, 0, size, size);
        const plankW = 64;
        for (let x = 0; x < size; x += plankW) {
          ctx.fillStyle = ["#9c673b", "#80502d", "#a16b3d", "#734629"][Math.floor(x / plankW) % 4];
          ctx.fillRect(x + 2, 0, plankW - 4, size);
          ctx.strokeStyle = "rgba(45,25,13,0.65)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
          for (let j = 0; j < 9; j++) {
            const y = Math.random() * size;
            ctx.strokeStyle = "rgba(55,30,14,0.22)";
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(x + 8, y);
            ctx.lineTo(x + 20, y - 2);
            ctx.lineTo(x + 35, y + 2);
            ctx.lineTo(x + plankW - 8, y - 1);
            ctx.stroke();
          }
        }
      },
      2,
      2
    );

    const barnTexture = makePatternTexture(
      "RedBarnPlankTexture",
      (ctx, size) => {
        ctx.fillStyle = "#a92f2c";
        ctx.fillRect(0, 0, size, size);
        const plankW = 48;
        for (let x = 0; x < size; x += plankW) {
          ctx.fillStyle = ["#c23c36", "#ad302d", "#982926", "#c7463c"][Math.floor(x / plankW) % 4];
          ctx.fillRect(x + 2, 0, plankW - 4, size);
          ctx.fillStyle = "rgba(75,17,17,0.5)";
          ctx.fillRect(x, 0, 3, size);
          ctx.fillStyle = "rgba(255,190,160,0.16)";
          ctx.fillRect(x + 5, 0, 2, size);
        }
        for (let y = 0; y < size; y += 128) {
          ctx.fillStyle = "rgba(70,15,15,0.42)";
          ctx.fillRect(0, y, size, 4);
        }
      },
      2,
      2
    );

    const stoneTexture = makePatternTexture(
      "NaturalStoneTexture",
      (ctx, size) => {
        // A warm gray mineral base with mottling, grain, and fine natural cracks.
        ctx.fillStyle = "#77766e";
        ctx.fillRect(0, 0, size, size);

        const mineralColors = [
          "rgba(205,198,180,0.18)",
          "rgba(45,46,45,0.16)",
          "rgba(153,145,127,0.22)",
          "rgba(230,224,207,0.10)",
          "rgba(93,101,101,0.18)",
        ];
        for (let i = 0; i < 260; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const rx = 3 + Math.random() * 20;
          const ry = 2 + Math.random() * 13;
          ctx.fillStyle = mineralColors[Math.floor(Math.random() * mineralColors.length)];
          const angle = Math.random() * Math.PI;
          ctx.beginPath();
          for (let point = 0; point <= 12; point++) {
            const a = (point / 12) * Math.PI * 2;
            const px = x + Math.cos(a) * rx * Math.cos(angle) - Math.sin(a) * ry * Math.sin(angle);
            const py = y + Math.cos(a) * rx * Math.sin(angle) + Math.sin(a) * ry * Math.cos(angle);
            if (point === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }

        for (let i = 0; i < 5200; i++) {
          const shade = Math.random();
          ctx.fillStyle = shade > 0.55
            ? `rgba(225,220,205,${0.08 + Math.random() * 0.2})`
            : `rgba(28,31,31,${0.06 + Math.random() * 0.18})`;
          const dot = 0.5 + Math.random() * 2.2;
          ctx.fillRect(Math.random() * size, Math.random() * size, dot, dot);
        }

        // Fine, broken seams add a subtle weathered-rock character.
        for (let i = 0; i < 24; i++) {
          let x = Math.random() * size;
          let y = Math.random() * size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = "rgba(39,41,39,0.28)";
          ctx.lineWidth = 0.7 + Math.random() * 1.1;
          const steps = 3 + Math.floor(Math.random() * 5);
          for (let step = 0; step < steps; step++) {
            x += (Math.random() - 0.5) * 20;
            y += 3 + Math.random() * 12;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - 2, y);
          ctx.lineTo(x + 3 + Math.random() * 7, y + 4 + Math.random() * 7);
          ctx.strokeStyle = "rgba(220,214,198,0.2)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      },
      1,
      1
    );

    const asphaltTexture = makePatternTexture(
      "RoadAsphaltTexture",
      (ctx, size) => {
        ctx.fillStyle = "#454951";
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 4500; i++) {
          const shade = Math.floor(65 + Math.random() * 65);
          ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.35})`;
          const dot = 1 + Math.random() * 2;
          ctx.fillRect(Math.random() * size, Math.random() * size, dot, dot);
        }
      },
      1,
      1
    );

    grassMat.diffuseTexture = grassTexture;
    grassMat.diffuseColor = Color3.White();
    wallMat.diffuseTexture = plasterTexture;
    wallMat.diffuseColor = Color3.White();
    roofMat.diffuseTexture = terracottaTexture;
    roofMat.diffuseColor = Color3.White();
    woodMat.diffuseTexture = timberTexture;
    woodMat.diffuseColor = Color3.White();
    barnRedMat.diffuseTexture = barnTexture;
    barnRedMat.diffuseColor = Color3.White();
    roofWoodMat.diffuseTexture = timberTexture;
    roofWoodMat.diffuseColor = new Color3(0.62, 0.62, 0.62);
    roadMat.diffuseTexture = asphaltTexture;
    roadMat.diffuseColor = Color3.White();
    stoneMat.diffuseTexture = stoneTexture;
    stoneMat.diffuseColor = Color3.White();

    // Lighting and shadows.
    const hemiLight = new HemisphericLight(
      "HemisphericLight",
      new Vector3(0, 1, 0),
      scene
    );
    hemiLight.intensity = 0.72;

    const sunLight = new DirectionalLight(
      "SunLight",
      new Vector3(-0.5, -1, 0.4),
      scene
    );
    sunLight.position = new Vector3(10, 18, -10);
    sunLight.intensity = 1.0;

// Higher-resolution filtered shadows make characters and scenery feel grounded.
const shadowGenerator = new ShadowGenerator(2048, sunLight);
shadowGenerator.usePercentageCloserFiltering = true;
shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
shadowGenerator.setDarkness(0.22);

// Expanded terrain gives us room to expose more existing pickups
// and build out the larger world without shifting its center.
const ground = MeshBuilder.CreateGround(
  "Ground",
  { width: 400, height: 300 },
  scene
);
ground.position.x = 40;
ground.material = grassMat;
ground.isPickable = false;
ground.receiveShadows = true;


    // LAKE: a natural-looking oval, spaced away from the new environments.
  
    // LAKE: move behind the house and farther from the environments.
    const lakeShoreMat = new StandardMaterial("LakeShoreMaterial", scene);
    lakeShoreMat.diffuseColor = new Color3(0.48, 0.39, 0.25);
    lakeShoreMat.specularColor = new Color3(0.12, 0.12, 0.12);

    const lakeShore = MeshBuilder.CreateCylinder(
      "LakeSandyShore",
      { diameter: 23, height: 0.12, tessellation: 64 },
      scene
    );
    lakeShore.position.set(65, 0.035, 55);
    lakeShore.scaling.z = 0.68;
    lakeShore.material = lakeShoreMat;
    lakeShore.isPickable = false;
    lakeShore.receiveShadows = true;

    const lakeWaterMat = new StandardMaterial("LakeWaterMaterial", scene);
    lakeWaterMat.diffuseColor = new Color3(0.12, 0.58, 0.82);
    lakeWaterMat.emissiveColor = new Color3(0.025, 0.12, 0.18);
    lakeWaterMat.specularColor = new Color3(0.75, 0.9, 1);
    lakeWaterMat.specularPower = 96;
    lakeWaterMat.alpha = 0.9;

    const lake = MeshBuilder.CreateCylinder(
      "LakeWater",
      { diameter: 20.5, height: 0.1, tessellation: 64 },
      scene
    );
    lake.position.set(65, 0.12, 55);
    lake.scaling.z = 0.68;
    lake.material = lakeWaterMat;
    lake.isPickable = false;
    lake.receiveShadows = false;

    // HELLO TIGER! — EXPLORABLE ENVIRONMENTS Our MAP
    // Diagnostic mode: identify and isolate the mountain sphere.
    void (async () => {
      const environments = [
        {
          name: "JapaneseExplorationLocation",
          file: "an_overgrown_japanese-style_location.glb",
          x: 10,
          z: -72,
          targetFootprint: 110,
          groundOffset: -15.8,
        },
                {
          name: "ReachableMountainLandscape",
          file: "landscape_forest__mountains.glb",
          x: 220,
          z: -55,
          targetFootprint: 450,
          groundOffset: -28.5,
        },
       
{
  name: "GrandmasHouse",
  file: "dae_diorama_-_grandmas_house.glb",
  x: 400,
  z: -145,
  targetFootprint: 295,
  groundOffset: -50,
},

{
  name: "GrandmasHouse2",
  file: "dae_diorama_-_grandmas_house2.glb",
  x: -195,
  z: -95,
  targetFootprint: 205,
  groundOffset: -38,
  rotationY: Math.PI / 2,
},   ];

      for (const environment of environments) {
        try {
          const imported = await SceneLoader.ImportMeshAsync(
            "",
            "/models/",
            environment.file,
            scene
          );

          if (scene.isDisposed) {
            imported.meshes.forEach((mesh) => mesh.dispose());
            return;
          }

          const root =
            imported.meshes.find((mesh) => mesh.name === "__root__") ??
            imported.meshes.find((mesh) => mesh.parent === null) ??
            imported.meshes[0];

          if (!root) {
            imported.meshes.forEach((mesh) => mesh.dispose());
            console.error(`No root mesh found for ${environment.file}`);
            continue;
          }

          root.name = environment.name;

          // Log all meshes for the mountain asset so we can identify its sphere.
          if (environment.file === "landscape_forest__mountains.glb") {
            console.log(
              "HELLO TIGER! MOUNTAIN — ALL MESHES",
              imported.meshes.map((mesh, index) => ({
                index,
                name: mesh.name,
                parent: mesh.parent?.name ?? "(no parent)",
                vertices: mesh.getTotalVertices(),
                material: mesh.material?.name ?? "(no material)",
                enabled: mesh.isEnabled(),
                position: {
                  x: mesh.position.x,
                  y: mesh.position.y,
                  z: mesh.position.z,
                },
                scaling: {
                  x: mesh.scaling.x,
                  y: mesh.scaling.y,
                  z: mesh.scaling.z,
                },
              }))
            );
          } else {
            console.log(
              `HELLO TIGER! ${environment.name} — DOME CANDIDATES`,
              imported.meshes
                .map((mesh) => ({
                  name: mesh.name,
                  parent: mesh.parent?.name ?? "(no parent)",
                  vertices: mesh.getTotalVertices(),
                  material: mesh.material?.name ?? "(no material)",
                }))
                .filter((mesh) =>
                  /dome|sphere|sky|horizon|background|environment/i.test(
                    `${mesh.name} ${mesh.parent} ${mesh.material}`
                  )
                )
            );
          }

          // Hide the confirmed Japanese sphere, without disposing it.
          if (
            environment.file === "an_overgrown_japanese-style_location.glb"
          ) {
            imported.meshes.forEach((mesh) => {
              if (
                mesh.name === "Sphere_Material_0" ||
                mesh.parent?.name === "Sphere"
              ) {
                mesh.setEnabled(false);
                console.log("JAPANESE SPHERE HIDDEN", mesh.name);
              }
            });
          }

         
          // Hide the confirmed mountain dome without disposing it.
          if (
            environment.file === "landscape_forest__mountains.glb"
          ) {
            imported.meshes.forEach((mesh) => {
              if (
                mesh.name === "Sphere_Material.011_0" &&
                mesh.parent?.name === "Sphere"
              ) {
                mesh.setEnabled(false);

                console.log("MOUNTAIN DOME HIDDEN — PRESERVED FOR REUSE", {
                  name: mesh.name,
                  parent: mesh.parent?.name ?? null,
                  material: mesh.material?.name ?? null,
                  vertices: mesh.getTotalVertices(),
                });
              }
            });
          }

          // Calculate model dimensions.
          root.computeWorldMatrix(true);
          let bounds = root.getHierarchyBoundingVectors(true);

          const sizeX = bounds.max.x - bounds.min.x;
          const sizeZ = bounds.max.z - bounds.min.z;
          const footprint = Math.max(sizeX, sizeZ);

          if (!Number.isFinite(footprint) || footprint <= 0) {
            console.error(`Invalid model dimensions: ${environment.file}`);
            imported.meshes.forEach((mesh) => mesh.dispose());
            continue;
          }

          // Scale the environment to its configured footprint.
          const scale = environment.targetFootprint / footprint;
          root.scaling.scaleInPlace(scale);
          root.computeWorldMatrix(true);

          bounds = root.getHierarchyBoundingVectors(true);

          // Center the environment at its configured X/Z coordinates.
          root.position.x +=
            environment.x - (bounds.min.x + bounds.max.x) / 2;

          root.position.z +=
            environment.z - (bounds.min.z + bounds.max.z) / 2;

          // Align vertically and apply the configured ground offset.
          root.position.y -= bounds.min.y;
          root.position.y += environment.groundOffset;

          root.computeWorldMatrix(true);

          // Configure visible environment meshes and their shadows.
          imported.meshes.forEach((mesh) => {
            if (mesh.getTotalVertices() === 0 || !mesh.isEnabled()) return;

            mesh.isPickable = true;
            mesh.receiveShadows = true;

            if (mesh !== root) {
              shadowGenerator.addShadowCaster(mesh, true);
            }
          });

         if (environment.name === "GrandmasHouse") {
  const houseBounds = root.getHierarchyBoundingVectors(true);

  const marker = MeshBuilder.CreateSphere(
    "GrandmasHouseDebugMarker",
    { diameter: 8 },
    scene
  );

  marker.position.set(
    (houseBounds.min.x + houseBounds.max.x) / 2,
    (houseBounds.min.y + houseBounds.max.y) / 2,
    (houseBounds.min.z + houseBounds.max.z) / 2
  );

  const markerMaterial = new StandardMaterial(
    "GrandmasHouseDebugMarkerMaterial",
    scene
  );
  markerMaterial.diffuseColor = new Color3(1, 0, 1);
  markerMaterial.emissiveColor = new Color3(1, 0, 1);
  marker.material = markerMaterial;

  console.log("GRANDMA'S HOUSE DEBUG", {
    rootPosition: root.position.asArray(),
    boundsMin: houseBounds.min.asArray(),
    boundsMax: houseBounds.max.asArray(),
    markerPosition: marker.position.asArray(),
    meshCount: imported.meshes.length,
    visibleMeshes: imported.meshes.filter(
      (mesh) => mesh.isEnabled() && mesh.getTotalVertices() > 0
    ).length,
  });
}

          console.log("HELLO TIGER! ENVIRONMENT LOADED", {
            name: environment.name,
            file: environment.file,
            position: {
              x: environment.x,
              z: environment.z,
              groundOffset: environment.groundOffset,
            },
            scale,
            footprint: environment.targetFootprint,
          });
        } catch (error) {
          console.error(
            `Failed to load environment: ${environment.file}`,
            error
          );
        }
      }
    })();


            // MEDIEVAL COUNTRYSIDE HOUSE
        void (async () => {
          try {
            const imported = await SceneLoader.ImportMeshAsync(
              "",
              "/models/",
              "stylized_medieval_house_scene_by_jungle_jim.glb",
              scene
            );

            const houseRoot = imported.meshes[0];

            if (!houseRoot || scene.isDisposed) {
              imported.meshes.forEach((mesh) => mesh.dispose());
              return;
            }

            houseRoot.name = "MedievalCountrysideHouseRoot";
            houseRoot.position.set(94, 0, -12);
            houseRoot.scaling.setAll(2.5);

          
// HELLO TIGER! — Imported Material Library
const findImportedMaterial = (name: string) =>
  scene.materials.find((mat) => mat.name === name) ?? null;

rusticTimberMat = findImportedMaterial("wood_01");
weatheredPlanksMat = findImportedMaterial("wood_planks_09");

console.log("HELLO TIGER! MATERIAL LIBRARY", {
  rusticTimber: rusticTimberMat?.name ?? "Fallback required",
  weatheredPlanks: weatheredPlanksMat?.name ?? "Fallback required",
});

console.log(
  "HOUSE MESHES — SORTED BY SIZE",
  imported.meshes
    .filter((mesh) => mesh.getTotalVertices() > 0)
    .map((mesh) => {
      const bounds = mesh.getBoundingInfo().boundingBox;

      return {
        name: mesh.name,
        material: mesh.material?.name ?? "(none)",
        sizeX: Number((bounds.extendSize.x * 2).toFixed(2)),
        sizeY: Number((bounds.extendSize.y * 2).toFixed(2)),
        sizeZ: Number((bounds.extendSize.z * 2).toFixed(2)),
        center: bounds.center.asArray().map((n) => Number(n.toFixed(2))),
      };
    })
    .sort(
      (a, b) =>
        b.sizeX * b.sizeY * b.sizeZ -
        a.sizeX * a.sizeY * a.sizeZ
    )
);

            imported.meshes.forEach((mesh) => {
              // Hide the imported sand ground plane.
              if (mesh.name === "Object_4") {
                mesh.setEnabled(false);
                return;
              }

              // Hide the suspected forest-textured horizon dome.
              if (
                mesh.name === "Object_10" &&
                mesh.parent?.name === "Sphere_4"
              ) {
                mesh.setEnabled(false);
                return;
              }

              // Preserve the house, smoke, and remaining decorations.
              if (mesh.getTotalVertices() > 0) {
                mesh.isPickable = false;
                mesh.receiveShadows = true;
              }
            });

            console.log("MEDIEVAL HOUSE — DOME TEST", {
              hiddenMeshes: ["Object_4", "Object_10"],
              transformNodes: imported.transformNodes.map((node) => ({
                name: node.name,
                parent: node.parent?.name ?? "(none)",
                position: node.getAbsolutePosition().asArray(),
                scaling: node.scaling.asArray(),
              })),
            });

      } catch (error) {
        console.error("Failed to load medieval house:", error);
      }
    })();

    // A cheerful sun and soft, drifting clouds bring the yard to life.
    // These are decorative sky meshes: they never block movement or picking.
    const sunMat = makeMaterial("SunnyGold", new Color3(1, 0.78, 0.2));
    sunMat.emissiveColor = new Color3(1, 0.58, 0.08);
    sunMat.disableLighting = true;
    const sunHaloMat = makeMaterial("SunHalo", new Color3(1, 0.86, 0.42), 0.2);
    sunHaloMat.emissiveColor = new Color3(1, 0.72, 0.25);
    sunHaloMat.disableLighting = true;

    const sunHalo = MeshBuilder.CreateSphere(
      "SunSoftHalo",
      { diameter: 6.2, segments: 20 },
      scene
    );
    sunHalo.position.set(0, 24, -30);
    sunHalo.material = sunHaloMat;
    sunHalo.isPickable = false;
    sunHalo.receiveShadows = false;

    const sun = MeshBuilder.CreateSphere(
      "SunnySun",
      { diameter: 4.2, segments: 24 },
      scene
    );
    sun.position.copyFrom(sunHalo.position);
    sun.material = sunMat;
    sun.isPickable = false;
    sun.receiveShadows = false;

    const cloudMat = makeMaterial("CloudWhite", new Color3(0.98, 0.99, 1));
    cloudMat.emissiveColor = new Color3(0.38, 0.4, 0.42);
    cloudMat.disableLighting = true;
    const cloudShadeMat = makeMaterial("CloudSoftShade", new Color3(0.78, 0.87, 0.96));
    cloudShadeMat.disableLighting = true;

    const skyClouds: {
      parts: Mesh[];
      basePositions: Vector3[];
      phase: number;
      drift: number;
    }[] = [];

    const makeCloud = (name: string, x: number, y: number, z: number, scale: number, phase: number, drift: number) => {
      const parts: Mesh[] = [];
      const offsets = [
        [-1.25, 0, 0, 1.65, 0.72, 0.82],
        [-0.35, 0.34, 0.08, 1.75, 1.05, 1.05],
        [0.72, 0.18, -0.03, 1.85, 0.9, 1.0],
        [1.45, -0.03, 0.04, 1.35, 0.66, 0.78],
      ];
      offsets.forEach(([ox, oy, oz, sx, sy, sz], index) => {
        const puff = MeshBuilder.CreateSphere(
          `${name}Puff${index}`,
          { diameter: 1, segments: 12 },
          scene
        );
        puff.position.set(x + ox * scale, y + oy * scale, z + oz * scale);
        puff.scaling.set(sx * scale, sy * scale, sz * scale);
        puff.material = index === 0 ? cloudShadeMat : cloudMat;
        puff.isPickable = false;
        puff.receiveShadows = false;
        parts.push(puff);
      });
      skyClouds.push({
        parts,
        basePositions: parts.map((part) => part.position.clone()),
        phase,
        drift,
      });
    };

    // Spread clouds around the play area so they're visible as the camera rotates.
    makeCloud("CloudNorthWest", -25, 16, -27, 1.25, 0.3, 1.0);
    makeCloud("CloudNorthEast", 22, 19, -29, 1.05, 1.7, -0.8);
    makeCloud("CloudWest", -32, 14, -2, 0.9, 2.4, 0.7);
    makeCloud("CloudEast", 32, 17, 5, 1.15, 3.1, -0.65);
    makeCloud("CloudSouthWest", -24, 18, 27, 1.0, 4.2, 0.8);
    makeCloud("CloudSouthEast", 25, 15, 29, 1.2, 5.1, -0.7);

    // Home: layered foundation, gable roof, framed windows, and a paneled door.
    
    // Starter house imported from the stylized GLB asset.
    void (async () => {
      try {
        const imported = await SceneLoader.ImportMeshAsync(
          "",
          "/models/",
          "work_33_stylized_houses_blender3d.glb",
          scene
        );

        const root =
          imported.meshes.find((mesh) => mesh.name === "__root__") ??
          imported.meshes[0];

        if (!root) {
          throw new Error("House GLB did not provide a root mesh.");
        }

        // Scale the complete asset to fit the starter-house footprint.
        const houseScale = 0.84;
        root.scaling.setAll(houseScale);

        // Center the model, align its lowest point to the ground,
        // and preserve the existing starter-house location at Z = 8.
        root.position.set(-0.616, 0.898, 7.994);

        imported.meshes.forEach((mesh) => {
          if (mesh.getTotalVertices() > 0) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
          }
        });

        console.log("Starter house GLB loaded and positioned.");
      } catch (error) {
        console.error("Failed to load starter house GLB:", error);
      }
    })();

    // Two decorative barn landmarks — scenery only, not player-built.
    void (async () => {
      const barnPositions = [
        { x: -8, z: 8 },
        { x: -19, z: 13 },
      ];

      for (const [index, position] of barnPositions.entries()) {
        try {
          const imported = await SceneLoader.ImportMeshAsync(
            "",
            "/models/",
            "barn.glb",
            scene
          );

          const root =
            imported.meshes.find((mesh) => mesh.name === "__root__") ??
            imported.meshes[0];

          if (!root) {
            throw new Error(`Barn ${index + 1} GLB has no root mesh.`);
          }

          // Three times the original scale.
          root.scaling.setAll(2.8);
          root.position.set(0, 0, 0);

          // Center the barn horizontally and align its base to the ground.
          const bounds = root.getHierarchyBoundingVectors(true);
          const centerX = (bounds.min.x + bounds.max.x) / 2;
          const centerZ = (bounds.min.z + bounds.max.z) / 2;

          root.position.set(
            position.x - centerX,
            -bounds.min.y,
            position.z - centerZ
          );

          imported.meshes.forEach((mesh) => {
            if (mesh.getTotalVertices() > 0) {
              mesh.receiveShadows = true;
              shadowGenerator.addShadowCaster(mesh);
            }
          });

          console.log(
            `Decorative barn ${index + 1} loaded at:`,
            position.x,
            position.z
          );
        } catch (error) {
          console.error(`Failed to load decorative barn ${index + 1}:`, error);
        }
      }
    })();

     
    // Expanded tree locations.

    const importedTreeTemplates: TransformNode[] = [];

    // Low-poly forest and lake — imported world scenery.
    void (async () => {
      try {
        const imported = await SceneLoader.ImportMeshAsync(
          "",
          "/models/",
          "low_poly_tree_scene_free.glb",
          scene
        );

        const root =
          imported.meshes.find((mesh) => mesh.name === "__root__") ??
          imported.meshes[0];

        if (!root) {
          throw new Error("Forest scene GLB did not provide a root mesh.");
        }

        root.position.set(0, 0, 0);

        // Preserve the established forest footprint and transforms.
        const initialBounds = root.getHierarchyBoundingVectors(true);
        const initialSize = initialBounds.max.subtract(initialBounds.min);
        const largestDimension = Math.max(initialSize.x, initialSize.z);

        if (largestDimension <= 0) {
          throw new Error("Forest scene has invalid dimensions.");
        }

        const sceneScale = 52 / largestDimension;
        root.scaling.setAll(sceneScale);

        const bounds = root.getHierarchyBoundingVectors(true);
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;

        const worldX = 24;
        const worldZ = 24;
        const groundOffset = -2;

        root.position.set(
          worldX - centerX,
          -bounds.min.y + groundOffset,
          worldZ - centerZ
        );

        imported.meshes.forEach((mesh) => {
          if (mesh.getTotalVertices() > 0) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
          }
        });

        // Locate complete tree branches by their bark transforms.
        const barkNodes = imported.transformNodes.filter((node) =>
          /^Bark(?:\.\d+)?_\d+$/.test(node.name)
        );

        barkNodes.forEach((barkNode) => {
          const hasTreeMeshes = barkNode
            .getChildMeshes(false)
            .some((mesh) => mesh.getTotalVertices() > 0);

          if (hasTreeMeshes) {
            importedTreeTemplates.push(barkNode);
          }
        });

        console.log("IMPORTED TREE TEMPLATES READY", {
          templateCount: importedTreeTemplates.length,
          forestScale: sceneScale,
          forestPosition: { x: worldX, z: worldZ },
        });
      } catch (error) {
        console.error("Failed to load forest and lake scene:", error);
      }
    })();

    // Fantasy house landmark — tucked just beyond the forest.
    void (async () => {
      try {
        const imported = await SceneLoader.ImportMeshAsync(
          "",
          "/models/",
          "fantasy house.glb",
          scene
        );

        const root =
          imported.meshes.find((mesh) => mesh.name === "__root__") ??
          imported.meshes[0];

        if (!root) {
          throw new Error("Fantasy house GLB did not provide a root mesh.");
        }

        root.scaling.scaleInPlace(7.6);
        root.position.set(0, 0, 0);
        root.computeWorldMatrix(true);

        const bounds = root.getHierarchyBoundingVectors(true);
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;

        const worldX = 65;
        const worldZ = 35;
        const groundOffset = -0.78;

        root.position.set(
          worldX - centerX,
          -bounds.min.y + groundOffset,
          worldZ - centerZ
        );
        root.computeWorldMatrix(true);

        imported.meshes.forEach((mesh) => {
          if (mesh.getTotalVertices() > 0) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
          }
        });

        console.log("FANTASY HOUSE LOADED", {
          scale: 7.6,
          position: { x: worldX, z: worldZ },
          groundOffset,
          meshCount: imported.meshes.length,
        });
      } catch (error) {
        console.error("Failed to load fantasy house:", error);
      }
    })();

    // Shared wind animation registry for foliage and ground plants.
    const windSwayMeshes: {
      mesh: Mesh;
      baseRotationX: number;
      baseRotationZ: number;
      basePositionX: number;
      basePositionY: number;
      basePositionZ: number;
      phase: number;
      amplitude: number;
      positionAmplitude: number;
      speed: number;
    }[] = [];

    const extraTreePositions: [number, number][] = [
      [-105, -115], [-75, -95], [-120, -55],
      [-95, -10], [-115, 35], [-80, 75],
      [-45, 100], [-5, 115], [35, 105],
      [80, 115], [125, 105], [175, 115],
      [215, 90], [220, 45], [225, 5],
      [35, -100], [75, -125], [115, -105],
      [150, -125], [185, -100], [220, -120],
      [-65, -130], [-110, 110], [5, 65],
    ];

    const treePositions: [number, number][] = [
      // Home area
      [-28, -7],

      // Western woodland
      [2, -17], [23, -1], [19, 3], [-13, 37],

      // Northern woodland
      [-19, 25], [10, -2], [13, -3],

      // Eastern woodland
      [7, -13], [4, -3], [-5, 28], [3, 41],

      // Southern woodland
      [-3, 34], [-4, 29],

      // Scattered interior trees
      [-29, 12], [-7, 14],

      // Japanese exploration area
      [-42, -48], [-30, -55], [2, -57],
      [-38, -78], [-20, -112], [38, -65],

      // Connecting woodland
      [65, -42], [105, -65], [120, -48],
      [175, -35], [200, -48],

      // Mountain approach
      [210, -90], [290, -95], [330, -75],
      [370, -65], [390, -30],

      // Southern woodland
      [75, 65], [100, 80], [125, 60],
      [245, 85], [265, 115],
    ];

    console.log("Original trees:", treePositions.length);
    console.log("Extra trees:", extraTreePositions.length);

    // Place the imported trees once the forest templates are ready.
    void (async () => {
      while (importedTreeTemplates.length === 0) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        );
      }

      const positions: [number, number][] = [
        ...treePositions,
        ...extraTreePositions,
      ];

      positions.forEach(([x, z], index) => {
        const template =
          importedTreeTemplates[index % importedTreeTemplates.length];

        const clone = template.clone(`placedTree_${index}`, null, false);

        if (!clone) {
          console.error("TREE CLONE FAILED", { index });
          return;
        }

        clone.parent = null;
        clone.position.set(x, 0, z);
        clone.rotation.set(0, Math.random() * Math.PI * 2, 0);
        clone.scaling.setAll(1);
        clone.setEnabled(true);

        clone.getChildMeshes(false).forEach((mesh) => {
          mesh.setEnabled(true);
          mesh.isVisible = true;
          mesh.isPickable = true;
          mesh.receiveShadows = true;
          shadowGenerator.addShadowCaster(mesh);
        });

        clone.computeWorldMatrix(true);
      });

      console.log("IMPORTED TREES PLACED", {
        requested: positions.length,
        templates: importedTreeTemplates.length,
      });
    })();

    // Ground-detail pass starts immediately below this line.

    // Ground-detail pass: small, low-profile decorations make the yard feel
    // hand-crafted without obstructing movement, cat routes, or construction.
    // These use shared materials and remain non-pickable for performance.
    const grassBladeMat = makeMaterial("GroundGrassBlades", new Color3(0.22, 0.48, 0.16));
    const grassBladeLightMat = makeMaterial("GroundGrassBladesLight", new Color3(0.39, 0.67, 0.25));
    const flowerWhiteMat = makeMaterial("WildflowerCream", new Color3(1, 0.94, 0.72));
    const flowerPinkMat = makeMaterial("WildflowerPink", new Color3(1, 0.42, 0.64));
    const flowerYellowMat = makeMaterial("WildflowerYellow", new Color3(1, 0.76, 0.18));
    const flowerCenterMat = makeMaterial("WildflowerCenter", new Color3(0.72, 0.34, 0.08));
    const pebbleMat = makeMaterial("SmallPebbles", new Color3(0.58, 0.57, 0.49));
    const pebbleLightMat = makeMaterial("SmallPebblesLight", new Color3(0.72, 0.69, 0.58));

    const grassTuftPositions: [number, number][] = [
      [-7, -17], [8, -20], [-18, -7], [17, -3], [-24, 9], [24, 18],
      [-32, 13], [32, 21], [-34, -31], [23, -34], [4, 30], [-18, 27],
      [31, -17], [-25, -31], [14, 25], [-7, 37],
    ];

    grassTuftPositions.forEach(([x, z], i) => {
      // Three short, angled blades create a tiny tuft rather than a tall obstacle.
      for (let blade = 0; blade < 3; blade++) {
        const angle = (blade / 3) * Math.PI + (i % 2) * 0.3;
        const mesh = MeshBuilder.CreateBox(
          `GroundGrassTuft${i}_${blade}`,
          { width: 0.075, height: 0.24 + ((i + blade) % 3) * 0.035, depth: 0.035 },
          scene
        );
        mesh.position.set(
          x + Math.cos(angle) * 0.12,
          0.1 + ((i + blade) % 2) * 0.015,
          z + Math.sin(angle) * 0.12
        );
        mesh.rotation.set(0.12, angle, Math.cos(i + blade) * 0.22);
        mesh.material = (i + blade) % 3 === 0 ? grassBladeLightMat : grassBladeMat;
        windSwayMeshes.push({
          mesh,
          baseRotationX: mesh.rotation.x,
          baseRotationZ: mesh.rotation.z,
          basePositionX: mesh.position.x,
          basePositionY: mesh.position.y,
          basePositionZ: mesh.position.z,
          phase: i * 0.83 + blade * 1.37,
          amplitude: 0.18 + ((i + blade) % 3) * 0.035,
          positionAmplitude: 0.025 + ((i + blade) % 3) * 0.008,
          speed: 0.00135 + (blade % 2) * 0.0002,
        });
        mesh.isPickable = false;
        mesh.receiveShadows = false;
      }
    });

    const flowerClusters: { x: number; z: number; color: StandardMaterial }[] = [
      { x: -9, z: -19, color: flowerYellowMat },
      { x: 12, z: -22, color: flowerWhiteMat },
      { x: -21, z: -3, color: flowerPinkMat },
      { x: 20, z: 7, color: flowerYellowMat },
      { x: -29, z: 15, color: flowerWhiteMat },
      { x: 28, z: 23, color: flowerPinkMat },
      { x: -31, z: -34, color: flowerYellowMat },
      { x: 20, z: -31, color: flowerWhiteMat },
      { x: 7, z: 34, color: flowerPinkMat },
      { x: -20, z: 31, color: flowerYellowMat },
    ];

    flowerClusters.forEach(({ x, z, color }, i) => {
      for (let bloom = 0; bloom < 3; bloom++) {
        const angle = (bloom / 3) * Math.PI * 2 + i * 0.61;
        const fx = x + Math.cos(angle) * (0.16 + bloom * 0.035);
        const fz = z + Math.sin(angle) * (0.16 + bloom * 0.035);
        const stem = MeshBuilder.CreateCylinder(
          `WildflowerStem${i}_${bloom}`,
          { height: 0.2 + bloom * 0.025, diameter: 0.025, tessellation: 5 },
          scene
        );
        stem.position.set(fx, 0.1 + bloom * 0.012, fz);
        stem.material = grassBladeMat;
        stem.isPickable = false;
        stem.receiveShadows = false;

        const head = MeshBuilder.CreateSphere(
          `WildflowerBloom${i}_${bloom}`,
          { diameter: 0.13, segments: 7 },
          scene
        );
        head.position.set(fx, 0.23 + bloom * 0.025, fz);
        head.scaling.y = 0.62;
        head.material = color;
        head.isPickable = false;
        head.receiveShadows = false;

        const center = MeshBuilder.CreateSphere(
          `WildflowerHeart${i}_${bloom}`,
          { diameter: 0.045, segments: 6 },
          scene
        );
        center.position.set(fx, 0.245 + bloom * 0.025, fz);
        center.material = flowerCenterMat;
        center.isPickable = false;
        center.receiveShadows = false;
      }
    });

    const pebblePositions: [number, number, number][] = [
      [-14, -15, 0.22], [15, -17, 0.18], [-26, -6, 0.2], [27, 10, 0.24],
      [-35, 7, 0.18], [35, 28, 0.23], [-30, -25, 0.2], [18, -37, 0.22],
      [1, 37, 0.18], [-23, 24, 0.23], [29, -23, 0.19], [-5, -30, 0.2],
      [35, -4, 0.22], [-36, -15, 0.18],
    ];

    pebblePositions.forEach(([x, z, size], i) => {
      const pebble = MeshBuilder.CreateSphere(
        `YardPebble${i}`,
        { diameter: 1, segments: 7 },
        scene
      );
      pebble.position.set(x, size * 0.34, z);
      pebble.scaling.set(size * 1.35, size * 0.55, size);
      pebble.rotation.y = i * 0.73;
      pebble.material = i % 3 === 0 ? pebbleLightMat : pebbleMat;
      pebble.isPickable = false;
      pebble.receiveShadows = false;
    });

    // Tiger: a small, friendly kid adventurer with a big head, tousled hair,
    // colorful clothes, little arms and legs, and bright expressive eyes.
    // The main body remains the movement/collision root used by the game.
    const tiger = MeshBuilder.CreateCapsule(
      "Tiger",
      { height: 1.08, radius: 0.34, tessellation: 16, updatable: true },
      scene
    );
    tiger.position.set(0, 0.8, 1);
    tiger.material = blueMat;



    // The invisible gameplay root remains responsible for movement, collision,
    // camera tracking, pickups, and combat. The downloaded GLB is rendered on a
    // separate visual root so its own proportions and rig are not distorted by
    // the old procedural character geometry.
    const tigerVisualRoot = new TransformNode("TigerImportedVisualRoot", scene);
    tigerVisualRoot.position.set(tiger.position.x, 0, tiger.position.z);
    let tigerModelAnimations: AnimationGroup[] = [];
    let activeTigerAnimation = "";
    let tigerModelLoaded = false;

    // Sculpt the existing movement-root mesh into a more character-like shirt
    // silhouette: slightly broader shoulders, a gently tapered waist, and a
    // little fullness through the middle. The mesh remains the same root, so
    // movement, jumping, and every gameplay reference stay intact.
    const torsoPositions = tiger.getVerticesData(VertexBuffer.PositionKind);
    const torsoIndices = tiger.getIndices();
    if (torsoPositions && torsoIndices) {
      for (let i = 0; i < torsoPositions.length; i += 3) {
        const x = torsoPositions[i];
        const y = torsoPositions[i + 1];
        const z = torsoPositions[i + 2];
        const height = Math.max(-1, Math.min(1, y / 0.54));
        const shoulder = Math.max(0, height) * 0.12;
        const waistTaper = Math.max(0, Math.min(1, (-height + 0.05) / 0.95));
        const belly = Math.exp(-Math.pow((height + 0.12) / 0.34, 2)) * 0.025;
        const widthFactor = 1 + shoulder - waistTaper * 0.10 + belly;
        torsoPositions[i] = x * widthFactor;
        torsoPositions[i + 2] = z * (widthFactor + 0.015);
      }
      tiger.updateVerticesData(VertexBuffer.PositionKind, torsoPositions);
      const torsoNormals: number[] = [];
      VertexData.ComputeNormals(torsoPositions, torsoIndices, torsoNormals);
      tiger.updateVerticesData(VertexBuffer.NormalKind, torsoNormals);
      tiger.refreshBoundingInfo();
    }
    shadowGenerator.addShadowCaster(tiger);

    const tigerHead = MeshBuilder.CreateSphere(
      "TigerHead",
      { diameter: 0.82, segments: 32, updatable: true },
      scene
    );
    tigerHead.parent = tiger;
    tigerHead.position.set(0, 0.68, 0.035);
    tigerHead.material = kidSkinMat;

    // Reshape the sphere into a soft cartoon head: a broader forehead, a
    // narrower jaw, and gently fuller cheeks. This changes the actual mesh,
    // rather than merely adding more little decorative spheres.
    const headPositions = tigerHead.getVerticesData(VertexBuffer.PositionKind);
    const headIndices = tigerHead.getIndices();
    if (headPositions && headIndices) {
      for (let i = 0; i < headPositions.length; i += 3) {
        const x = headPositions[i];
        const y = headPositions[i + 1];
        const z = headPositions[i + 2];
        const normalizedY = y / 0.41;
        const jawTaper = Math.max(0, Math.min(1, (-normalizedY - 0.02) / 0.82));
        const forehead = Math.max(0, normalizedY) * 0.035;
        const cheekZone = Math.exp(-Math.pow((Math.abs(x) - 0.19) / 0.105, 2))
          * Math.exp(-Math.pow((y + 0.095) / 0.14, 2))
          * Math.max(0, z / 0.41);
        headPositions[i] = x * (1 - jawTaper * 0.13 + forehead);
        headPositions[i + 2] = z + cheekZone * 0.035;
      }
      tigerHead.updateVerticesData(VertexBuffer.PositionKind, headPositions);
      const headNormals: number[] = [];
      VertexData.ComputeNormals(headPositions, headIndices, headNormals);
      tigerHead.updateVerticesData(VertexBuffer.NormalKind, headNormals);
      tigerHead.refreshBoundingInfo();
    }
    shadowGenerator.addShadowCaster(tigerHead);

    // Close-cropped base with a defined high-top silhouette.
    const tigerHair = MeshBuilder.CreateSphere(
      "TigerHairCap",
      { diameter: 0.78, segments: 16, updatable: true },
      scene
    );
    tigerHair.parent = tiger;
    tigerHair.position.set(0, 0.91, -0.015);
    tigerHair.scaling.set(1.04, 0.49, 0.94);
    tigerHair.material = kidHairMat;

    const hairCapPositions = tigerHair.getVerticesData(VertexBuffer.PositionKind);
    const hairCapIndices = tigerHair.getIndices();
    if (hairCapPositions && hairCapIndices) {
      for (let i = 0; i < hairCapPositions.length; i += 3) {
        const y = hairCapPositions[i + 1] / 0.39;
        const topTaper = Math.max(0, y) * 0.055;
        hairCapPositions[i] *= 1 - topTaper;
        hairCapPositions[i + 2] *= 1 - topTaper * 0.7;
      }
      tigerHair.updateVerticesData(VertexBuffer.PositionKind, hairCapPositions);
      const hairNormals: number[] = [];
      VertexData.ComputeNormals(hairCapPositions, hairCapIndices, hairNormals);
      tigerHair.updateVerticesData(VertexBuffer.NormalKind, hairNormals);
      tigerHair.refreshBoundingInfo();
    }

    // A short, squared-off high-top sits above the close-cropped sides.
    const tigerHighTop = MeshBuilder.CreateCylinder(
      "TigerHighTop",
      { height: 0.25, diameterTop: 0.43, diameterBottom: 0.53, tessellation: 12 },
      scene
    );
    tigerHighTop.parent = tiger;
    tigerHighTop.position.set(0, 1.045, -0.005);
    tigerHighTop.scaling.z = 0.88;
    tigerHighTop.material = kidHairMat;
    tigerHighTop.isPickable = false;

    // Rounded hair coils along the front edge break up the simple cylinder
    // and give Tiger's high-top a more sculpted, signature silhouette.
    const hairCoils: [number, number, number, number][] = [
      [-0.20, 0.91, 0.275, 0.15], [-0.105, 0.945, 0.315, 0.145],
      [0, 0.955, 0.325, 0.15], [0.105, 0.945, 0.315, 0.145],
      [0.20, 0.91, 0.275, 0.15], [-0.13, 1.075, 0.12, 0.105],
      [0.02, 1.09, 0.12, 0.11], [0.15, 1.07, 0.12, 0.10],
    ];
    hairCoils.forEach(([x, y, z, diameter], i) => {
      const coil = MeshBuilder.CreateSphere(`TigerHairCoil${i}`, { diameter, segments: 10 }, scene);
      coil.parent = tiger;
      coil.position.set(x, y, z);
      coil.scaling.set(1.0, 0.82, 0.76);
      coil.material = i % 3 === 0 ? kidHairHighlightMat : kidHairMat;
      coil.isPickable = false;
    });

    // Ears peek out from the sides of the head.
    const tigerArmPivots: TransformNode[] = [];
    const tigerLegPivots: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const ear = MeshBuilder.CreateSphere(
        `TigerEar${side}`,
        { diameter: 0.19, segments: 12 },
        scene
      );
      ear.parent = tiger;
      ear.position.set(side * 0.36, 0.63, 0.015);
      ear.material = kidSkinMat;
      const innerEar = MeshBuilder.CreateSphere(
        `TigerInnerEar${side}`,
        { diameter: 0.105, segments: 9 },
        scene
      );
      innerEar.parent = tiger;
      innerEar.position.set(side * 0.375, 0.635, 0.095);
      innerEar.scaling.set(0.72, 1.0, 0.38);
      innerEar.material = kidInnerEarMat;
      innerEar.isPickable = false;

      // Shoulder pivots let the arms swing naturally instead of rotating around
      // their own centers. Hands follow each sleeve as one connected limb.
      const armPivot = new TransformNode(`TigerArmPivot${side}`, scene);
      armPivot.parent = tiger;
      armPivot.position.set(side * 0.29, 0.24, 0.015);
      tigerArmPivots.push(armPivot);

      const arm = MeshBuilder.CreateCapsule(
        `TigerArm${side}`,
        { height: 0.52, radius: 0.105, tessellation: 10 },
        scene
      );
      arm.parent = armPivot;
      arm.position.set(side * 0.045, -0.22, 0);
      arm.rotation.z = side * -0.12;
      arm.material = blueMat;
      shadowGenerator.addShadowCaster(arm);

      const sleeveCuff = MeshBuilder.CreateCapsule(
        `TigerSleeveCuff${side}`,
        { height: 0.15, radius: 0.11, tessellation: 12 },
        scene
      );
      sleeveCuff.parent = armPivot;
      sleeveCuff.position.set(side * 0.055, -0.39, 0.006);
      sleeveCuff.scaling.set(1.0, 0.58, 1.0);
      sleeveCuff.material = kidShirtTrimMat;
      sleeveCuff.isPickable = false;

      const hand = MeshBuilder.CreateSphere(
        `TigerHand${side}`,
        { diameter: 0.17, segments: 10 },
        scene
      );
      hand.parent = armPivot;
      hand.position.set(side * 0.065, -0.45, 0.035);
      hand.material = kidSkinMat;

      // Hip pivots animate the legs and shoes together during walking.
      const legPivot = new TransformNode(`TigerLegPivot${side}`, scene);
      legPivot.parent = tiger;
      legPivot.position.set(side * 0.17, -0.36, 0.015);
      tigerLegPivots.push(legPivot);

      const leg = MeshBuilder.CreateCapsule(
        `TigerLeg${side}`,
        { height: 0.46, radius: 0.13, tessellation: 10 },
        scene
      );
      leg.parent = legPivot;
      leg.position.set(0, -0.15, 0);
      leg.material = kidShortsMat;
      shadowGenerator.addShadowCaster(leg);

      const shoe = MeshBuilder.CreateSphere(
        `TigerShoe${side}`,
        { diameter: 0.3, segments: 12 },
        scene
      );
      shoe.parent = legPivot;
      shoe.position.set(0, -0.36, 0.09);
      shoe.scaling.set(1.08, 0.58, 1.35);
      shoe.material = kidShoeMat;

      const sole = MeshBuilder.CreateSphere(
        `TigerSole${side}`,
        { diameter: 0.29, segments: 10 },
        scene
      );
      sole.parent = legPivot;
      sole.position.set(0, -0.42, 0.095);
      sole.scaling.set(1.08, 0.22, 1.34);
      sole.material = kidSoleMat;
    }

    // Bright eyes with white highlights, facing the character's forward (+Z) direction.
    for (const offset of [-0.17, 0.17]) {
      const eyeWhite = MeshBuilder.CreateSphere(
        `TigerEyeWhite${offset}`,
        { diameter: 0.19, segments: 12 },
        scene
      );
      eyeWhite.parent = tiger;
      eyeWhite.position.set(offset, 0.69, 0.355);
      eyeWhite.material = whiteMat;

      const pupil = MeshBuilder.CreateSphere(
        `TigerEye${offset}`,
        { diameter: 0.105, segments: 12 },
        scene
      );
      pupil.parent = tiger;
      pupil.position.set(offset + 0.015, 0.69, 0.435);
      pupil.material = blackMat;

      const eyeSparkle = MeshBuilder.CreateSphere(
        `TigerEyeSparkle${offset}`,
        { diameter: 0.035, segments: 8 },
        scene
      );
      eyeSparkle.parent = tiger;
      eyeSparkle.position.set(offset - 0.005, 0.72, 0.477);
      eyeSparkle.material = whiteMat;
    }

    const tigerNose = MeshBuilder.CreateSphere(
      "TigerNose",
      { diameter: 0.085, segments: 10 },
      scene
    );
    tigerNose.parent = tiger;
    tigerNose.position.set(0, 0.56, 0.43);
    tigerNose.material = pinkMat;
    tigerNose.position.y = 0.575;
    tigerNose.scaling.set(1.0, 0.78, 0.72);

    // Soft cheek/muzzle pads add depth to the face instead of leaving it as a
    // flat arrangement of eyes and a dot nose.
    for (const side of [-1, 1]) {
      const muzzle = MeshBuilder.CreateSphere(
        `TigerMuzzle${side}`,
        { diameter: 0.19, segments: 12 },
        scene
      );
      muzzle.parent = tiger;
      muzzle.position.set(side * 0.073, 0.525, 0.385);
      muzzle.scaling.set(1.0, 0.72, 0.55);
      muzzle.material = kidSkinMat;
      muzzle.isPickable = false;

      const cheek = MeshBuilder.CreateSphere(
        `TigerCheek${side}`,
        { diameter: 0.115, segments: 10 },
        scene
      );
      cheek.parent = tiger;
      cheek.position.set(side * 0.245, 0.555, 0.328);
      cheek.scaling.set(1.0, 0.62, 0.3);
      cheek.material = kidSkinMat;
      cheek.isPickable = false;
    }

    const tigerSmile = MeshBuilder.CreateSphere(
      "TigerSmile",
      { diameter: 0.13, segments: 10 },
      scene
    );
    tigerSmile.parent = tiger;
    tigerSmile.position.set(0, 0.49, 0.405);
    tigerSmile.scaling.set(1, 0.28, 0.45);
    tigerSmile.material = kidMouthMat;
    tigerSmile.position.y = 0.475;
    tigerSmile.scaling.set(0.9, 0.24, 0.32);

    // Tiny smile corners and freckles make the expression read at game distance.
    for (const side of [-1, 1]) {
      const smileCorner = MeshBuilder.CreateSphere(
        `TigerSmileCorner${side}`,
        { diameter: 0.035, segments: 7 },
        scene
      );
      smileCorner.parent = tiger;
      smileCorner.position.set(side * 0.065, 0.49, 0.413);
      smileCorner.material = kidMouthMat;
      smileCorner.isPickable = false;
      for (let dot = 0; dot < 2; dot++) {
        const freckle = MeshBuilder.CreateSphere(
          `TigerFreckle${side}_${dot}`,
          { diameter: 0.018, segments: 6 },
          scene
        );
        freckle.parent = tiger;
        freckle.position.set(side * (0.19 + dot * 0.035), 0.535 - dot * 0.025, 0.392 - dot * 0.012);
        freckle.material = kidInnerEarMat;
        freckle.isPickable = false;
      }
    }

    // A small sunshine-yellow backpack adds a playful adventurer detail.
    const backpackMat = makeMaterial("TigerBackpack", new Color3(1, 0.68, 0.12));
    const backpack = MeshBuilder.CreateBox(
      "TigerBackpack",
      { width: 0.38, height: 0.42, depth: 0.18 },
      scene
    );
    backpack.parent = tiger;
    backpack.position.set(0, 0.12, -0.31);
    backpack.material = backpackMat;

    const backpackPocket = MeshBuilder.CreateBox(
      "TigerBackpackPocket",
      { width: 0.25, height: 0.16, depth: 0.035 },
      scene
    );
    backpackPocket.parent = tiger;
    backpackPocket.position.set(0, 0.045, -0.415);
    backpackPocket.material = kidStitchMat;
    backpackPocket.isPickable = false;
    const backpackBadge = MeshBuilder.CreateSphere(
      "TigerBackpackBadge",
      { diameter: 0.075, segments: 8 },
      scene
    );
    backpackBadge.parent = tiger;
    backpackBadge.position.set(0, 0.17, -0.415);
    backpackBadge.scaling.z = 0.35;
    backpackBadge.material = whiteMat;
    backpackBadge.isPickable = false;

    // Bright front straps make the little backpack read clearly from the camera.
    for (const side of [-1, 1]) {
      const strap = MeshBuilder.CreateBox(
        `TigerBackpackStrap${side}`,
        { width: 0.075, height: 0.47, depth: 0.035 },
        scene
      );
      strap.parent = tiger;
      strap.position.set(side * 0.155, 0.12, 0.318);
      strap.rotation.z = side * -0.10;
      strap.material = backpackMat;
      strap.isPickable = false;

      const brow = MeshBuilder.CreateCapsule(
        `TigerEyebrow${side}`,
        { height: 0.14, radius: 0.025, tessellation: 8 },
        scene
      );
      brow.parent = tiger;
      brow.position.set(side * 0.17, 0.805, 0.405);
      brow.rotation.z = side * -0.14;
      brow.material = kidHairMat;
      brow.isPickable = false;
    }

    // A tiny golden cat-paw badge gives Tiger's shirt a memorable signature.
    const shirtBadgeMat = makeMaterial("TigerShirtBadge", new Color3(1, 0.78, 0.16));
    const pawPad = MeshBuilder.CreateSphere(
      "TigerShirtPawPad",
      { diameter: 0.105, segments: 10 },
      scene
    );
    pawPad.parent = tiger;
    pawPad.position.set(0, 0.10, 0.348);
    pawPad.scaling.set(1.05, 0.82, 0.32);
    pawPad.material = shirtBadgeMat;
    pawPad.isPickable = false;
    for (const [i, dx] of [-1, 0, 1].entries()) {
      const toe = MeshBuilder.CreateSphere(
        `TigerShirtPawToe${i}`,
        { diameter: 0.043, segments: 8 },
        scene
      );
      toe.parent = tiger;
      toe.position.set(dx * 0.043, 0.16 + (i === 1 ? 0.015 : 0), 0.35);
      toe.scaling.z = 0.35;
      toe.material = shirtBadgeMat;
      toe.isPickable = false;
    }

    // Tailored shirt details: collar, cuffs, hem, and a little utility pocket.
    const collar = MeshBuilder.CreateSphere(
      "TigerShirtCollar",
      { diameter: 0.28, segments: 12 },
      scene
    );
    collar.parent = tiger;
    collar.position.set(0, 0.355, 0.285);
    collar.scaling.set(1.0, 0.42, 0.22);
    collar.material = kidShirtTrimMat;
    collar.isPickable = false;

    const shirtPocket = MeshBuilder.CreateBox(
      "TigerShirtPocket",
      { width: 0.145, height: 0.14, depth: 0.025 },
      scene
    );
    shirtPocket.parent = tiger;
    shirtPocket.position.set(-0.205, -0.005, 0.278);
    shirtPocket.rotation.z = -0.04;
    shirtPocket.material = kidShirtLightMat;
    shirtPocket.isPickable = false;

    const pocketStitch = MeshBuilder.CreateBox(
      "TigerPocketStitch",
      { width: 0.10, height: 0.012, depth: 0.008 },
      scene
    );
    pocketStitch.parent = tiger;
    pocketStitch.position.set(-0.205, 0.047, 0.294);
    pocketStitch.material = kidStitchMat;
    pocketStitch.isPickable = false;

    const shirtHem = MeshBuilder.CreateBox(
      "TigerShirtHem",
      { width: 0.48, height: 0.055, depth: 0.27 },
      scene
    );
    shirtHem.parent = tiger;
    shirtHem.position.set(0, -0.285, 0.015);
    shirtHem.material = kidShirtTrimMat;
    shirtHem.isPickable = false;

    // Small bright lace bars and toe caps make the red high-top sneakers legible.
    tigerLegPivots.forEach((legPivot, index) => {
      const toeCap = MeshBuilder.CreateSphere(
        `TigerShoeToeCap${index}`,
        { diameter: 0.13, segments: 9 },
        scene
      );
      toeCap.parent = legPivot;
      toeCap.position.set(0, -0.335, 0.235);
      toeCap.scaling.set(1.0, 0.55, 0.48);
      toeCap.material = kidSoleMat;
      toeCap.isPickable = false;
      for (let lace = 0; lace < 3; lace++) {
        const laceBar = MeshBuilder.CreateBox(
          `TigerShoeLace${index}_${lace}`,
          { width: 0.105, height: 0.018, depth: 0.018 },
          scene
        );
        laceBar.parent = legPivot;
        laceBar.position.set(0, -0.29 + lace * 0.035, 0.235 - lace * 0.018);
        laceBar.material = kidSoleMat;
        laceBar.isPickable = false;
      }
    });

    // Load the free, locally downloaded character. Keep the procedural Tiger
    // visible as a fallback until the GLB has loaded successfully.
    const proceduralTigerMeshes = scene.meshes.filter(
      (mesh) => mesh === tiger || mesh.name.startsWith("Tiger")
    );
    void (async () => {
      try {
        const imported = await SceneLoader.ImportMeshAsync(
          "",
          "/models/",
          "tiger-animated.glb",
          scene
        );

        const modelMeshes = imported.meshes.filter(
          (mesh) => mesh !== tiger && mesh.getTotalVertices() > 0
        );
        if (modelMeshes.length === 0) {
          throw new Error("tiger.glb loaded but did not contain any renderable meshes.");
        }

        // Measure the downloaded model before parenting it, then fit it to the
        // existing character's approximate height while keeping its feet on ground.
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        modelMeshes.forEach((mesh) => {
          mesh.computeWorldMatrix(true);
          const bounds = mesh.getBoundingInfo().boundingBox;
          minY = Math.min(minY, bounds.minimumWorld.y);
          maxY = Math.max(maxY, bounds.maximumWorld.y);
        });
        const modelHeight = maxY - minY;
        if (!Number.isFinite(modelHeight) || modelHeight <= 0.001) {
          throw new Error("Could not determine the height of tiger.glb.");
        }
        const targetHeight = 1.95;
        const uniformScale = targetHeight / modelHeight;

        
const modelRoot = imported.meshes.find(
  (mesh) => mesh.name === "__root__"
) ?? imported.meshes.find((mesh) => mesh.parent === null);

const visualScale = uniformScale * 1.5;

if (modelRoot) {
  modelRoot.parent = tigerVisualRoot;
  modelRoot.scaling.set(visualScale, visualScale, visualScale);
  modelRoot.position.y = -minY * visualScale;
} else {
  // Defensive fallback for GLBs that expose multiple top-level meshes.
  modelMeshes.forEach((mesh) => {
    if (!mesh.parent) {
      mesh.parent = tigerVisualRoot;
      mesh.scaling.scaleInPlace(visualScale);
    }
  });

  tigerVisualRoot.position.y = -minY * visualScale;
}

        imported.meshes.forEach((mesh) => {
          if (mesh !== modelRoot && !mesh.parent) mesh.parent = tigerVisualRoot;
          if (mesh.getTotalVertices() > 0) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
          }
        });

        // Hide only the old character meshes; the gameplay root stays active for
        // world interactions and the imported model follows it below.
        proceduralTigerMeshes.forEach((mesh) => {
          mesh.isVisible = false;
          mesh.isPickable = false;
          shadowGenerator.removeShadowCaster(mesh);
        });

        
tigerModelAnimations = imported.animationGroups;
tigerModelAnimations.forEach((group) => group.stop());


      // Prefer a genuine idle animation rather than blindly playing the first clip.
      const initialAnimation = tigerModelAnimations.find((group) =>
        /idle|stand|breath/i.test(group.name)
      );

      activeTigerAnimation = "";
      tigerModelLoaded = true;

      if (initialAnimation) {
        initialAnimation.start(true);
        activeTigerAnimation = initialAnimation.name;
      } else {
        console.warn(
          "No idle animation found for Tiger. Available animations:",
          tigerModelAnimations.map((group) => group.name)
        );
      }

      setMessage("Tiger's 3D model is ready!");
    } catch (error) {
      console.error(
        "Could not load /models/tiger-animated.glb. Keeping the built-in Tiger model.",
        error
      );
      setMessage(
        "Couldn't load tiger.glb. Check that it is in public/models and that the Babylon loaders package is installed."
      );
    }
  })();

  const camera = new ArcRotateCamera(
    "Camera",
    -Math.PI / 2,
    Math.PI / 3,
    16,
    tiger.position.clone(),
    scene
  );

  camera.lowerRadiusLimit = 7;
  camera.upperRadiusLimit = 50;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2.05;
  camera.inertia = 0.65;
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  camera.attachControl(canvas, true);
  camera.lockedTarget = tiger;

  // Expanded-world bounds for systems that use this configuration.
  // The ground mesh and movement/building systems must also be updated
  // to match these bounds before the full expansion is playable.
  const worldBounds = {
    minX: -80,
    maxX: 200,
    minZ: -100,
    maxZ: 100,
  };

  // Mana crystals throughout the expanded world.
  const manaCrystals: Mesh[] = [];

  const crystalPositions = [
    // Starter rewards near spawn
    [-4, -2], [4, -4], [-7, 5],

    // Western discoveries
    [-55, -30], [-68, 8], [-59, 42],
    [-43, 67], [-25, 83], [-65, -65],
    [-38, -78], [-12, -62],

    // Original-world discoveries
    [-17, -14], [-27, -8], [-28, 5],
    [-33, 21], [-22, 29], [-10, 38],
    [-12, -38], [0, -42], [17, -37],
    [31, -32], [40, -19], [40, -5],
    [39, 13], [31, 29], [17, 39],
    [2, 35], [-8, 34], [-34, 28],
    [-39, -23], [-25, -31], [-5, -35],
    [23, -27], [-22, 2], [-14, 15],
    [-5, 24], [8, 19], [21, 2], [28, 0],

    // Northern and southern frontier
    [-5, 57], [22, 65], [48, 78],
    [76, 62], [112, 70], [151, 54],
    [184, 25], [166, -12], [190, -45],
    [148, -73], [111, -86], [67, -76],
    [27, -89], [-18, -91], [-61, -42],

    // Eastern discoveries
    [62, -12], [88, -22], [112, -21],
    [87, -8], [98, 1], [84, 0],
    [126, 16], [145, 31], [172, 4],
    [190, 62], [137, -39], [177, -79],
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

  // Bonus heart pickups scattered around the expanded world.
  // Each heart restores one health when collected.
  const heartPickups: HeartPickup[] = [];

  const heartPositions = [
    // Starter rewards near spawn
    [-2, -6], [8, 3],

    // Original-world discoveries
    [-19, -15], [-31, -7], [-8, 11],
    [10, 25], [-14, 36], [-23, -38],
    [-5, -11], [14, -39], [30, -31],
    [39, -17], [40, 4], [35, 22],
    [2, 36], [8, 40], [-13, 34],
    [-32, 30], [-29, -25], [-24, -33],
    [4, -34], [25, -25], [-23, 3],
    [-16, 17], [-6, 25], [7, 21],
    [22, 13], [29, 1],

    // Western frontier
    [-58, -18], [-70, 24], [-49, 55],
    [-26, 72], [-62, -59], [-34, -82],

    // Northern frontier
    [-2, 57], [28, 73], [62, 84],
    [99, 67], [143, 58], [181, 30],

    // Southern frontier
    [-10, -68], [22, -85], [58, -92],
    [96, -78], [139, -69], [184, -49],

    // Eastern frontier
    [126, 10], [151, 36], [176, 7],
    [192, -20], [166, -81],

    // Hidden health rewards near the medieval house
    [87, -5], [100, -22], [106, -14],
    [99, -3],
  ];

  heartPositions.forEach(([x, z], index) => {
    const parts: Mesh[] = [];

    const leftLobe = MeshBuilder.CreateSphere(
      `BonusHeart${index}Left`,
      { diameter: 0.48, segments: 24 },
      scene
    );
    leftLobe.position.set(x - 0.16, 0.83, z);
    leftLobe.scaling.set(1, 1, 0.65);
    leftLobe.material = heartRedMat;
    leftLobe.isPickable = false;
    parts.push(leftLobe);

    const rightLobe = MeshBuilder.CreateSphere(
      `BonusHeart${index}Right`,
      { diameter: 0.48, segments: 24 },
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
        tessellation: 20,
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
      { diameter: 0.1, segments: 20 },
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

  
  // Cats explore the expanded world, using trees as roaming destinations.
  const cats: Cat[] = [];

  const catWorldBounds = {
    minX: worldBounds.minX + 2,
    maxX: worldBounds.maxX - 2,
    minZ: worldBounds.minZ + 2,
    maxZ: worldBounds.maxZ - 2,
  };

  const chooseCatRestSpot = (fromX: number, fromZ: number) => {
    const allValidTrees = treePositions.filter(([treeX, treeZ]) =>
      treeX >= catWorldBounds.minX &&
      treeX <= catWorldBounds.maxX &&
      treeZ >= catWorldBounds.minZ &&
      treeZ <= catWorldBounds.maxZ
    );

    // Prefer nearby trees, but occasionally encourage a longer expedition.
    const nearbyTrees = allValidTrees.filter(([treeX, treeZ]) => {
      const distance = Math.hypot(treeX - fromX, treeZ - fromZ);
      return distance > 4 && distance < 35;
    });

    const adventurousTrees = allValidTrees.filter(([treeX, treeZ]) => {
      const distance = Math.hypot(treeX - fromX, treeZ - fromZ);
      return distance >= 35 && distance < 100;
    });

    const roll = Math.random();

    const choices =
      roll < 0.7 && nearbyTrees.length > 0
        ? nearbyTrees
        : adventurousTrees.length > 0 && roll < 0.9
          ? adventurousTrees
          : allValidTrees.length > 0
            ? allValidTrees
            : [[fromX, fromZ] as [number, number]];

    const [treeX, treeZ] =
      choices[Math.floor(Math.random() * choices.length)];

    // Stop near the tree rather than inside its trunk.
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.5 + Math.random() * 1.5;

    return {
      x: Math.max(
        catWorldBounds.minX,
        Math.min(catWorldBounds.maxX, treeX + Math.cos(angle) * radius)
      ),
      z: Math.max(
        catWorldBounds.minZ,
        Math.min(catWorldBounds.maxZ, treeZ + Math.sin(angle) * radius)
      ),
    };
  };

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

    const firstRestSpot = chooseCatRestSpot(x, z);

    cats.push({
      name,
      x,
      z,
      parts,
      modelRoot: null,
      animationGroups: [],
      partOffsets: parts.map(
        (part) =>
          new Vector3(
            part.position.x - x,
            part.position.y,
            part.position.z - z
          )
      ),
      targetX: firstRestSpot.x,
      targetZ: firstRestSpot.z,
      yaw: 0,
      restingUntil: 0,
      rescued: false,
      housed: false,
      barnIndex: null,
    });
  };

  createCat("Mittens", -4, -3, whiteMat);
  createCat("Pumpkin", 5, -5, orangeMat);
  createCat("Shadow", -7, 1, grayMat);

  // Load the animated model for Mittens only; retain procedural fallbacks.
  void (async () => {
    const cat = cats.find((entry) => entry.name === "Mittens");
    if (!cat) return;

    try {
      const imported = await SceneLoader.ImportMeshAsync(
        "",
        "/models/",
        "an_animated_cat.glb",
        scene
      );

      const modelMeshes = imported.meshes.filter(
        (mesh) => mesh.getTotalVertices() > 0
      );

      if (modelMeshes.length === 0) {
        throw new Error("The GLB contains no renderable meshes.");
      }

      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      modelMeshes.forEach((mesh) => {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        minY = Math.min(minY, bounds.minimumWorld.y);
        maxY = Math.max(maxY, bounds.maximumWorld.y);
      });

      const modelHeight = maxY - minY;
      if (!Number.isFinite(modelHeight) || modelHeight <= 0.001) {
        throw new Error("Could not determine the animated cat height.");
      }

      const scale = 1.1 / modelHeight;
      const visualRoot = new TransformNode("MittensAnimatedRoot", scene);
      visualRoot.position.set(cat.x, 0, cat.z);

      const importedRoot =
        imported.meshes.find((mesh) => mesh.name === "__root__") ??
        imported.meshes.find((mesh) => mesh.parent === null);

      if (importedRoot) {
        importedRoot.parent = visualRoot;
        importedRoot.scaling.scaleInPlace(scale);
        importedRoot.position.y += -minY * scale;
      } else {
        modelMeshes.forEach((mesh) => {
          if (!mesh.parent) {
            mesh.parent = visualRoot;
            mesh.scaling.scaleInPlace(scale);
          }
        });
      }

      imported.meshes.forEach((mesh) => {
        if (mesh !== importedRoot && !mesh.parent) {
          mesh.parent = visualRoot;
        }

        if (mesh.getTotalVertices() > 0) {
          mesh.isPickable = false;
          shadowGenerator.addShadowCaster(mesh);
        }
      });

      cat.modelRoot = visualRoot;
      cat.animationGroups = imported.animationGroups;

      const animation = cat.animationGroups.find((group) =>
        /idle|stand|breath/i.test(group.name)
      );

      if (animation) {
        animation.start(true);
      } else {
        console.warn(
          `No idle animation found for ${cat.name}. Available animations:`,
          cat.animationGroups.map((group) => group.name)
        );
      }

      // Keep the procedural fallback available until the model loads.
      cat.parts.forEach((part) => {
        part.setEnabled(false);
        shadowGenerator.removeShadowCaster(part);
      });

      console.info(
        "Animated cat loaded:",
        cat.name,
        "animation:",
        animation?.name ?? "none"
      );
    } catch (error) {
      console.error(
        "Could not load the animated cat; using the procedural fallback.",
        error
      );
    }
  })();

  // Resource pickups spread across the expanded world for exploration.
  const resources: Resource[] = [];

  const createResource = (
    type: "wood" | "stone",
    x: number,
    z: number,
    index: number
  ) => {
    let mesh: Mesh;

    if (type === "wood") {
      mesh = MeshBuilder.CreateBox(
        `WoodResource${index}`,
        { width: 1.15, height: 0.75, depth: 0.9 },
        scene
      );
      mesh.position.set(x, 0.38, z);
      mesh.isVisible = false;
      mesh.isPickable = false;

      const logMaterial: Material = rusticTimberMat ?? woodMat;

      const logSpecs = [
        { x: -0.12, y: 0.19, z: -0.2, rotation: 0 },
        { x: 0.12, y: 0.19, z: 0.2, rotation: 0 },
        { x: 0, y: 0.46, z: 0, rotation: Math.PI / 2 },
      ];

      logSpecs.forEach((spec, logIndex) => {
        const log = MeshBuilder.CreateCylinder(
          `WoodResource${index}Log${logIndex}`,
          {
            height: 0.8,
            diameter: 0.3,
            tessellation: 12,
          },
          scene
        );

        log.rotation.z = Math.PI / 2;
        log.rotation.y = spec.rotation;
        log.position.set(x + spec.x, spec.y, z + spec.z);
        log.material = logMaterial;
        log.isPickable = false;
        log.receiveShadows = true;
        shadowGenerator.addShadowCaster(log);

        log.parent = mesh;
        log.position.set(spec.x, spec.y - 0.38, spec.z);
      });
    } else {
      mesh = MeshBuilder.CreateSphere(
        `StoneResource${index}`,
        { diameter: 1, segments: 24 },
        scene
      );

      const variation = 0.82 + Math.random() * 0.3;
      mesh.scaling.set(
        variation * (0.9 + Math.random() * 0.25),
        variation * (0.7 + Math.random() * 0.25),
        variation * (0.85 + Math.random() * 0.3)
      );

      mesh.position.set(x, 0.34, z);
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.35,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.35
      );
      mesh.material = stoneMat;
    }

    mesh.isPickable = false;
    resources.push({ type, mesh, x, z, collected: false });
  };

    // WOOD — isolated finds across the main world.
    [
      // Starting area
      [-8, -10], [9, 6],

      // Western reaches
      [-20, -6], [-36, -4], [-25, 37],
      [-29, 30], [-14, 25], [-1, -31],

      // Northern reaches
      [-17, -41], [5, -5], [28, -40],
      [39, -25],

      // Eastern reaches
      [40, 3], [3, 22], [17, 40],
      [39, 35],

      // Southern reaches
      [-36, 13], [-22, 32], [4, 29],
      [19, 15], [17, -38], [-10, -32],
      [30, -12], [-25, 1],

      // Medieval house expedition
      [77, -24], [83, 1], [89, -34],
      [101, -29], [110, -10], [109, 9],
      [96, 12], [78, -7],
    ].forEach(([x, z], i) => createResource("wood", x, z, i));

    // STONE — offset from wood to encourage exploring different routes.
    [
      // Starting area
      [-2, 18], [2, -12],

      // Western reaches
      [-30, -37], [-4, -16], [-38, 6],
      [-29, 27], [-5, 20], [-39, -37],

      // Northern reaches
      [-31, -40], [-4, -43], [17, -32],
      [36, -37],

      // Eastern reaches
      [35, -5], [24, 47], [5, 38],
      [41, 17],

      // Southern reaches
      [-9, 20], [-35, 27], [13, 23],
      [22, 5], [32, -24], [-4, -35],
      [38, -16], [-18, 14],

      // Medieval house expedition
      [81, -4], [91, 3], [96, -37],
      [117, -25], [14, -2], [12, 17],
      [87, -30], [76, 20],
    ].forEach(([x, z], i) => createResource("stone", x, z, i));

    // Paris.
    const npcX = -8;
    const npcZ = -4;

    const npcBody = MeshBuilder.CreateCylinder(
      "ParisBody",
      { height: 1.25, diameter: 0.65 },
      scene
    );
    npcBody.position.set(npcX, 0.68, npcZ);
    npcBody.material = npcMat;

    const npcHead = MeshBuilder.CreateSphere(
      "ParisHead",
      { diameter: 0.7 },
      scene
    );
    npcHead.position.set(npcX, 1.55, npcZ);
    npcHead.material = whiteMat;

    for (const offset of [-0.13, 0.13]) {
      const eye = MeshBuilder.CreateSphere(
        `ParisEye${offset}`,
        { diameter: 0.08 },
        scene
      );
      eye.position.set(npcX + offset, 1.6, npcZ + 0.3);
      eye.material = blackMat;
    }

    const npcMarker = MeshBuilder.CreateTorus(
      "ParisQuestMarker",
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

    // TIGER'S LIGHTNING MAGIC ⚡
    // Build a jagged lightning bolt from connected emissive segments.
    const createLightningBolt = (
      name: string,
      length = 1.35,
      width = 0.48
    ): Mesh => {
      const bolt = MeshBuilder.CreateBox(
        name,
        { width: 0.01, height: 0.01, depth: 0.01 },
        scene
      );

      bolt.isPickable = false;
      bolt.isVisible = false;

      const segments = [
        {
          x1: width * 0.08,
          y1: length * 0.5,
          x2: -width * 0.08,
          y2: length * 0.13,
          thickness: width * 0.19,
        },
        {
          x1: -width * 0.08,
          y1: length * 0.13,
          x2: width * 0.48,
          y2: length * 0.13,
          thickness: width * 0.19,
        },
        {
          x1: width * 0.48,
          y1: length * 0.13,
          x2: -width * 0.12,
          y2: -length * 0.12,
          thickness: width * 0.19,
        },
        {
          x1: -width * 0.12,
          y1: -length * 0.12,
          x2: width * 0.12,
          y2: -length * 0.12,
          thickness: width * 0.19,
        },
        {
          x1: width * 0.12,
          y1: -length * 0.12,
          x2: -width * 0.42,
          y2: -length * 0.5,
          thickness: width * 0.19,
        },
      ];

      segments.forEach((segment, index) => {
        const start = new Vector3(segment.x1, segment.y1, 0);
        const end = new Vector3(segment.x2, segment.y2, 0);
        const direction = end.subtract(start);
        const midpoint = start.add(end).scale(0.5);

        const piece = MeshBuilder.CreateBox(
          `${name}Segment${index}`,
          {
            width: segment.thickness,
            height: direction.length() + segment.thickness * 0.45,
            depth: 0.055,
          },
          scene
        );

        piece.position.copyFrom(midpoint);
        piece.rotation.z = -Math.atan2(direction.x, direction.y);
        piece.parent = bolt;
        piece.isPickable = false;
      });

      return bolt;
    };

    // Bright electric core.
    const lightningCoreMat = new StandardMaterial(
      "LightningCoreMaterial",
      scene
    );
    lightningCoreMat.diffuseColor = new Color3(0.75, 0.95, 1);
    lightningCoreMat.emissiveColor = new Color3(0.25, 0.8, 1);
    lightningCoreMat.specularColor = new Color3(1, 1, 1);
    lightningCoreMat.disableLighting = true;

    // Electric-blue aura.
    const lightningAuraMat = new StandardMaterial(
      "LightningAuraMaterial",
      scene
    );
    lightningAuraMat.diffuseColor = new Color3(0.15, 0.45, 1);
    lightningAuraMat.emissiveColor = new Color3(0.08, 0.25, 1);
    lightningAuraMat.alpha = 0.42;
    lightningAuraMat.disableLighting = true;

    // Build a complete bolt with a blue aura and bright inner core.
    const createLightningProjectileVisual = (name: string) => {
      const aura = createLightningBolt(`${name}Aura`, 1.65, 0.68);
      aura.material = lightningAuraMat;
      aura.isVisible = true;
      aura.isPickable = false;

      aura.getChildMeshes().forEach((mesh) => {
        mesh.material = lightningAuraMat;
        mesh.isVisible = true;
        mesh.isPickable = false;
      });

      const core = createLightningBolt(`${name}Core`, 1.35, 0.48);
      core.material = lightningCoreMat;
      core.parent = aura;
      core.position.set(0, 0, -0.06);
      core.isVisible = true;
      core.isPickable = false;

      core.getChildMeshes().forEach((mesh) => {
        mesh.material = lightningCoreMat;
        mesh.isVisible = true;
        mesh.isPickable = false;
      });

      return aura;
    };

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
    let tigerWalkPhase = 0;
    let tigerMotionBlend = 0;
    let jumpVelocity = 0;
    let idleSeconds = 0;
    let idleDanceSeconds = 0;
    let idleDanceDurationSeconds = 0;
    let nextIdleDanceSeconds = 8 + Math.random() * 10;
    let tigerIsDancing = false;

    let tigerIsCasting = false;
    let tigerCastSecondsRemaining = 0;

    const switchTigerModelAnimation = (
      kind: "idle" | "walk" | "run" | "jump" | "dance" | "cast"
    ) => {
      if (!tigerModelLoaded || tigerModelAnimations.length === 0) return;

      const clipNames: Record<typeof kind, string> = {
        idle: "Idle_Standing",
        walk: "Motion_Standard_Walk",
        run: "Motion_Standing_Sprint_Forward",
        jump: "Motion_Jump",
        dance: "Motion_Hip_Hop_Dancing",
        cast: "Motion_Spell_Cast",
      };

      const fallbackPatterns: Record<typeof kind, RegExp[]> = {
        idle: [/idle/i, /stand/i, /breath/i],
        walk: [/standard.walk/i, /start.walking/i, /walk/i],
        run: [/sprint/i, /running/i, /run/i],
        jump: [/jump/i],
        dance: [/hip.hop.dancing/i, /danc/i],
        cast: [/spell.cast/i],
      };

      const next =
        tigerModelAnimations.find((group) => group.name === clipNames[kind]) ??
        tigerModelAnimations.find((group) =>
          fallbackPatterns[kind].some((pattern) => pattern.test(group.name))
        );

      if (!next || next.name === activeTigerAnimation) return;

      const previous = tigerModelAnimations.find(
        (group) => group.name === activeTigerAnimation
      );

      if (previous?.isPlaying) {
        previous.stop();
      }

      tigerModelAnimations.forEach((group) => {
        if (group !== next) group.stop();
      });

      next.start(kind !== "cast");
      activeTigerAnimation = next.name;

      if (kind === "cast") {
        tigerIsCasting = true;
        tigerCastSecondsRemaining = (next.to - next.from) / 60;
      }
    };

    let isGrounded = true;

    const keys = new Set<string>();
    const roadTiles: RoadTile[] = [];
    const waterTiles: WaterTile[] = [];
    const barns: Barn[] = [];
    let roadPreview: Mesh[] = [];
    let waterPreview: Mesh[] = [];
    let roadX = 0;
    let roadZ = 0;
    let waterX = 0;
    let waterZ = 0;
    let roadRotation = 0;

    const setMode = (nextMode: BuildMode) => {
      buildMode = nextMode;
      setModeUI(nextMode);
      keys.clear();
    };

    // HELLO TIGER! — Reusable Imported Material Library
    // let rusticTimberMat: Material | null = null;
    // let weatheredPlanksMat: Material | null = null;

    // Barn layout: open front keeps the cats visible.
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
      mat: Material,
      rotationZ = 0
    ): Mesh => {
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
      wallMaterial: Material,
      roofMaterial: Material,
      frameMaterial: Material = wallMaterial
    ): Mesh[] => [
      // Floor
      addBarnPart(
        `${prefix}Floor`,
        4, 0.18, 3.4,
        0, 0.13, 0,
        wallMaterial
      ),

      // Back wall
      addBarnPart(
        `${prefix}BackWall`,
        4, 2.4, 0.18,
        0, 1.4, 1.6,
        wallMaterial
      ),

      // Side walls
      addBarnPart(
        `${prefix}LeftWall`,
        0.18, 2.4, 3.4,
        -1.9, 1.4, 0,
        wallMaterial
      ),
      addBarnPart(
        `${prefix}RightWall`,
        0.18, 2.4, 3.4,
        1.9, 1.4, 0,
        wallMaterial
      ),

      // Split front — central doorway remains open
      addBarnPart(
        `${prefix}FrontLeft`,
        1.25, 2.4, 0.18,
        -1.35, 1.4, -1.6,
        wallMaterial
      ),
      addBarnPart(
        `${prefix}FrontRight`,
        1.25, 2.4, 0.18,
        1.35, 1.4, -1.6,
        wallMaterial
      ),

      // Pitched roof
      addBarnPart(
        `${prefix}RoofLeft`,
        2.35, 0.22, 3.8,
        -0.92, 2.75, 0,
        roofMaterial,
        0.48
      ),
      addBarnPart(
        `${prefix}RoofRight`,
        2.35, 0.22, 3.8,
        0.92, 2.75, 0,
        roofMaterial,
        -0.48
      ),
    ];

    // Ghost preview — keep all eight pieces in the same order.
    const ghostParts = createBarnParts(
      "GhostBarn",
      ghostMat,
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
          x +
          localX * Math.cos(radians) -
          localZ * Math.sin(radians);

        part.position.z =
          z +
          localX * Math.sin(radians) +
          localZ * Math.cos(radians);

        const slope =
          index === 6 ? 0.48 :
          index === 7 ? -0.48 :
          0;

        part.rotation.set(0, radians, slope);
      });
    };

    const updateBarnPreview = () => {
      placeParts(ghostParts, buildX, buildZ, barnRotation);
      ghostParts.forEach((part) => part.setEnabled(true));
    };

    const makeBarn = (
      x: number,
      z: number,
      rotation: number,
      index: number
    ): Barn => {
      const wallMaterial: Material = weatheredPlanksMat ?? barnRedMat;
      const frameMaterial: Material = rusticTimberMat ?? barnRedMat;

      const parts = createBarnParts(
        `BuiltBarn${index}`,
        wallMaterial,
        roofWoodMat,
        frameMaterial
      );

      placeParts(parts, x, z, rotation);

      // Six warm straw pads make each rescued cat's spot easy to see.
      const catSlots = [
        [-0.85, -0.62],
        [0, -0.62],
        [0.85, -0.62],
        [-0.85, 0.45],
        [0, 0.45],
        [0.85, 0.45],
      ];

      const radians = (rotation * Math.PI) / 180;

      catSlots.forEach(([localX, localZ], slotIndex) => {
        const worldX =
          x + localX * Math.cos(radians) - localZ * Math.sin(radians);
        const worldZ =
          z + localX * Math.sin(radians) + localZ * Math.cos(radians);

        const bed = MeshBuilder.CreateCylinder(
          `Barn${index}CatBed${slotIndex}`,
          { height: 0.07, diameter: 0.82, tessellation: 24 },
          scene
        );

        bed.position.set(worldX, 0.26, worldZ);
        bed.rotation.y = radians;
        bed.material = hayMat;
        bed.isPickable = false;
        parts.push(bed);

        const bowl = MeshBuilder.CreateCylinder(
          `Barn${index}WaterBowl${slotIndex}`,
          { height: 0.09, diameter: 0.24, tessellation: 20 },
          scene
        );

        bowl.position.set(
          worldX + Math.cos(radians) * 0.28,
          0.31,
          worldZ + Math.sin(radians) * 0.28
        );

        bowl.material = bowlMat;
        bowl.isPickable = false;
        parts.push(bowl);
      });

      // Register the barn, cat beds, and bowls as shadow casters.
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

      const curbs = [-1, 1].map((side) => {
        const curb = MeshBuilder.CreateBox(
          `${prefix}Curb${side}`,
          { width: 0.12, height: 0.12, depth: 2 },
          scene
        );
        curb.position.set(
          x + side * 0.93 * Math.cos(radians),
          0.065,
          z - side * 0.93 * Math.sin(radians)
        );
        curb.rotation.y = radians;
        curb.material = preview ? ghostMat : roadEdgeMat;
        curb.isPickable = false;
        return curb;
      });

      return [tile, dash, ...curbs];
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
        roadPreview[2].position.set(
          roadX - 0.93 * Math.cos(radians), 0.065,
          roadZ + 0.93 * Math.sin(radians)
        );
        roadPreview[3].position.set(
          roadX + 0.93 * Math.cos(radians), 0.065,
          roadZ - 0.93 * Math.sin(radians)
        );
        roadPreview[2].rotation.y = radians;
        roadPreview[3].rotation.y = radians;
      }
    };

    const clearWaterPreview = () => {
      waterPreview.forEach((part) => part.dispose());
      waterPreview = [];
    };

    const createWaterTile = (
      x: number,
      z: number,
      prefix: string,
      preview = false
    ) => {
      const parts: Mesh[] = [];
      const surface = MeshBuilder.CreateBox(
        `${prefix}Surface`,
        { width: 1.92, height: 0.09, depth: 1.92 },
        scene
      );
      surface.position.set(x, 0.11, z);
      surface.material = preview ? ghostMat : waterMat;
      surface.isPickable = false;
      parts.push(surface);

    // Three bright, inset ripple lines make a water block read as water.
    for (let i = 0; i < 3; i++) {
      const ripple = MeshBuilder.CreateBox(
        `${prefix}Ripple${i}`,
        { width: 0.9 - i * 0.18, height: 0.018, depth: 0.055 },
        scene
      );
      ripple.position.set(x, 0.165 + i * 0.003, z + (i - 1) * 0.38);
      ripple.material = preview ? ghostMat : waterRippleMat;
      ripple.isPickable = false;
      parts.push(ripple);
    }

    return parts;
  };

  const updateWaterPreview = () => {
    if (waterPreview.length === 0) {
      waterPreview = createWaterTile(waterX, waterZ, "WaterPreview", true);
    } else {
      waterPreview[0].position.set(waterX, 0.11, waterZ);

      for (let i = 1; i < waterPreview.length; i++) {
        waterPreview[i].position.x = waterX;
        waterPreview[i].position.z = waterZ + (i - 2) * 0.38;
      }
    }
  };

  // Place a housed cat inside a barn and make its model visible again.
  const houseOneCat = () => {
    if (barns.length === 0) {
      setMessage("Build a barn first, then you can house rescued cats.");
      return;
    }

    const nextCat = cats.find((cat) => cat.rescued && !cat.housed);

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
      setMessage("All barns are full! Build another barn to house more cats.");
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

    if (nextCat.modelRoot) {
      nextCat.modelRoot.position.set(targetX, 0, targetZ);
      nextCat.modelRoot.rotation.y = nextCat.yaw;
      nextCat.modelRoot.setEnabled(true);
    } else {
      nextCat.parts.forEach((part) => {
        part.position.x += deltaX;
        part.position.z += deltaZ;
        part.setEnabled(true);
        shadowGenerator.addShadowCaster(part);
      });
    }

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

    switchTigerModelAnimation("cast");
    manaCount -= 1;
    setMana(manaCount);

    // Match the attack direction to Tiger's facing.
    const dx = Math.sin(tiger.rotation.y);
    const dz = Math.cos(tiger.rotation.y);
    const angle = Math.atan2(dx, dz);

    const projectile = MeshBuilder.CreateBox(
      `MagicBolt${performance.now()}`,
      { width: 0.18, height: 0.18, depth: 0.85 },
      scene
    );

    const boltMaterial = new StandardMaterial(
      `MagicBoltMaterial${performance.now()}`,
      scene
    );

    boltMaterial.diffuseColor = new Color3(0.35, 0.85, 1);
    boltMaterial.emissiveColor = new Color3(0.2, 0.8, 1);
    boltMaterial.specularColor = new Color3(1, 1, 1);
    boltMaterial.disableLighting = true;

    projectile.material = boltMaterial;
    projectile.isPickable = false;

    // Spawn ahead of Tiger, aligned horizontally with the attack.
    projectile.position.set(
      tiger.position.x + dx * 1.0,
      1.05,
      tiger.position.z + dz * 1.0
    );

    projectile.rotation.set(0, angle, 0);

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

  // World placement limits: keep builds and tile edges
  // inside the expanded 240 × 160 ground footprint.
  // New exploration zones, and future quests.
  const WORLD_MIN_X = -160;
  const WORLD_MAX_X = 240;
  const WORLD_MIN_Z = -150;
  const WORLD_MAX_Z = 150;

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
        clearWaterPreview();
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

        buildX = Math.max(
          WORLD_MIN_X,
          Math.min(WORLD_MAX_X, buildX)
        );
        buildZ = Math.max(
          WORLD_MIN_Z,
          Math.min(WORLD_MAX_Z, buildZ)
        );
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

        roadX = Math.max(
          WORLD_MIN_X,
          Math.min(WORLD_MAX_X, roadX)
        );
        roadZ = Math.max(
          WORLD_MIN_Z,
          Math.min(WORLD_MAX_Z, roadZ)
        );
        updateRoadPreview();
        return;
      }

      if (buildMode === "water") {
        if (key === "y") {
          setMode("none");
          clearWaterPreview();
          setMessage("Water-block placement cancelled.");
          return;
        }

        if (key === "arrowup" || key === "w") waterZ -= 2;
        else if (key === "arrowdown" || key === "s") waterZ += 2;
        else if (key === "arrowleft" || key === "a") waterX -= 2;
        else if (key === "arrowright" || key === "d") waterX += 2;
        else if (key === "enter") {
          if (manaCount < 1 || stoneCount < 2) {
            setMessage(
              `Water-block recipe: 1 mana + 2 stone. You have ${manaCount} mana and ${stoneCount} stone.`
            );
            return;
          }

          const occupied =
            waterTiles.some(
              (tile) =>
                Math.abs(tile.x - waterX) < 1.5 &&
                Math.abs(tile.z - waterZ) < 1.5
            ) ||
            roadTiles.some(
              (tile) =>
                Math.abs(tile.x - waterX) < 1.2 &&
                Math.abs(tile.z - waterZ) < 1.2
            );

          if (occupied) {
            setMessage(
              "That spot is occupied. Place water beside the road or another water block."
            );
            return;
          }

          const parts = createWaterTile(
            waterX,
            waterZ,
            `WaterBlock${waterTiles.length}`,
            false
          );

          parts.forEach((part) => shadowGenerator.addShadowCaster(part));
          waterTiles.push({ x: waterX, z: waterZ, parts });

          manaCount -= 1;
          stoneCount -= 2;
          setMana(manaCount);
          setStone(stoneCount);
          setWaterCount(waterTiles.length);

          setMessage(
            `Water block placed! ${waterTiles.length} water block(s) built.`
          );

          waterX = Math.min(WORLD_MAX_X - 2, waterX + 2);
          updateWaterPreview();
          return;
        } else {
          return;
        }

        waterX = Math.max(
          WORLD_MIN_X,
          Math.min(WORLD_MAX_X - 2, waterX)
        );
        waterZ = Math.max(
          WORLD_MIN_Z,
          Math.min(WORLD_MAX_Z - 2, waterZ)
        );
        updateWaterPreview();
        return;
      }
    }

    if (
      [
        "arrowup", "arrowdown", "arrowleft", "arrowright",
        "w", "a", "s", "d", " ", "shift"
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
              "Paris: Help protect our yard! Defeat 3 slimes, then come back to me."
            );
          } else if (slimeKillCount >= 3 && !questClaimed) {
            questClaimed = true;
            setQuestComplete(true);
            manaCount += 3;
            setMana(manaCount);
            setMessage(
              "Paris: You did it! Here are 3 bonus mana crystals. You're a hero, Tiger!"
            );
          } else if (questClaimed) {
            setMessage("Paris: Thanks for protecting the yard, Tiger!");
          } else {
            setMessage(
              `Paris: You've defeated ${slimeKillCount}/3 slimes. Keep going!`
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
          closestCat.modelRoot?.setEnabled(false);
          closestCat.parts.forEach((part) => part.setEnabled(false));
          setCatsRescued(cats.filter((cat) => cat.rescued).length);
          setMessage(
            `${closestCat.name} rescued! Press H or use the House a Cat button after building a barn.`
          );
          return;
        }

        // Collect the closest available resource.
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

        if (closestResource && closestResourceDistance < 3.5) {
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
            "Get closer to Paris, an unrescued cat, wood, or stone, then press E."
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
        setMessage(
          "Place another barn: move with WASD, rotate with Q/R, Enter builds."
        );
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
        setMessage(
          "Place a road tile: move with WASD, rotate with Q/R, Enter places."
        );
        return;
      }

      if (key === "y") {
        if (manaCount < 1 || stoneCount < 2) {
          setMessage(
            `Water-block recipe: 1 mana + 2 stone. You have ${manaCount} mana and ${stoneCount} stone.`
          );
          return;
        }

        waterX = Math.round(tiger.position.x + 2);
        waterZ = Math.round(tiger.position.z);
        setMode("water");
        updateWaterPreview();
        setMessage(
          "Place water blocks: move with WASD, Enter places a block, Y cancels."
        );
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const clearKeys = () => keys.clear();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearKeys);

    const updateCats = (dt: number, now: number) => {
      for (const cat of cats) {
        // Rescued cats are carried by the rescue flow; housed cats belong in their barn slots.
        if (cat.rescued || cat.housed) continue;

        const dx = cat.targetX - cat.x;
        const dz = cat.targetZ - cat.z;
        const distance = Math.hypot(dx, dz);
        const isWalking = distance >= 0.28;

        if (distance < 0.28) {
          if (cat.restingUntil === 0) {
            cat.restingUntil = now + 2800 + Math.random() * 4200;
          } else if (now >= cat.restingUntil) {
            const nextSpot = chooseCatRestSpot(cat.x, cat.z);
            cat.targetX = nextSpot.x;
            cat.targetZ = nextSpot.z;
            cat.restingUntil = 0;
          }
        } else {
          const speed = 0.035 * dt;
          const step = Math.min(speed, distance);
          cat.x += (dx / distance) * step;
          cat.z += (dz / distance) * step;
          cat.yaw = Math.atan2(dx, dz);
        }

        // Move and turn the whole little cat model around its center.
        if (cat.modelRoot) {
          cat.modelRoot.position.set(cat.x, 0, cat.z);
          cat.modelRoot.rotation.y = cat.yaw;
          continue;
        }

        const cos = Math.cos(cat.yaw);
        const sin = Math.sin(cat.yaw);
        cat.parts.forEach((part, index) => {
          const offset = cat.partOffsets[index];
          const phase = cat.x * 1.7 + cat.z * 0.9;
          const walkBounce = isWalking
            ? Math.abs(Math.sin(now / 88 + phase)) * 0.045
            : Math.sin(now / 620 + phase) * 0.012;

          part.position.x = cat.x + offset.x * cos + offset.z * sin;
          part.position.y = offset.y + walkBounce;
          part.position.z = cat.z - offset.x * sin + offset.z * cos;
          part.rotation.y = cat.yaw;

          // Tiny idle animations make each kitten feel alive without adding
          // extra meshes or expensive animation systems.
          if (part.name.includes("Tail")) {
            part.rotation.z =
              Math.PI / 3 + Math.sin(now / 360 + phase) * 0.22;
          } else if (part.name.includes("Eye")) {
            const blinkCycle =
              (now + Math.abs(cat.x * 173 + cat.z * 91)) % 3600;
            const blink =
              blinkCycle > 0 && blinkCycle < 145
                ? Math.max(0.12, Math.abs(blinkCycle - 72.5) / 72.5)
                : 1;
            part.scaling.y = blink;
          }
        });
      }
    };

    engine.runRenderLoop(() => {
      if (scene.isDisposed) return;

      const now = performance.now();
      const deltaMs = Math.min(now - previousFrameTime, 50);
      previousFrameTime = now;
      const dt = deltaMs / 16.667;

      updateCats(dt, now);

      if (buildMode === "none" && tigerModelLoaded) {
        const sprinting = keys.has("shift");
        const moveSpeed = (sprinting ? 0.216 : 0.12) * dt;
        let moveX = 0;
        let moveZ = 0;

        const verticalDirection = invertedMovementRef.current ? -1 : 1;

        if (keys.has("arrowup") || keys.has("w")) {
          moveZ -= verticalDirection;
        }
        if (keys.has("arrowdown") || keys.has("s")) {
          moveZ += verticalDirection;
        }
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

        // Keep player movement aligned with the expanded world boundaries.
        tiger.position.x = Math.max(
          WORLD_MIN_X,
          Math.min(WORLD_MAX_X, tiger.position.x)
        );
        tiger.position.z = Math.max(
          WORLD_MIN_Z,
          Math.min(WORLD_MAX_Z, tiger.position.z)
        );
      }
    
      // Fluid, visible kid locomotion. Blend movement in/out so limbs ease into
      // a stride instead of snapping, while arms and legs counter-swing naturally.
      const tigerMoving =
        buildMode === "none" &&
        (keys.has("arrowup") ||
          keys.has("w") ||
          keys.has("arrowdown") ||
          keys.has("s") ||
          keys.has("arrowleft") ||
          keys.has("a") ||
          keys.has("arrowright") ||
          keys.has("d"));

      const tigerAirborne = !isGrounded;
      const blendTarget = tigerMoving && !tigerAirborne ? 1 : 0;

      tigerMotionBlend +=
        (blendTarget - tigerMotionBlend) * Math.min(1, dt * 0.22);
      tigerWalkPhase += dt * (0.045 + tigerMotionBlend * 0.255);

      const stride = Math.sin(tigerWalkPhase);
      const oppositeStride = Math.sin(tigerWalkPhase + Math.PI);

      const bodyBob =
        tigerMotionBlend > 0.02
          ? Math.abs(Math.sin(tigerWalkPhase * 2)) *
            0.075 *
            tigerMotionBlend
          : Math.sin(now * 0.0021) * 0.018;

      // Only add a grounded bounce; jumping continues to use the existing physics.
      if (isGrounded) tiger.position.y = 0.8 + bodyBob;

      tiger.rotation.z = tigerAirborne
        ? -0.055
        : stride * 0.065 * tigerMotionBlend;

      tigerArmPivots.forEach((pivot, index) => {
        const side = index === 0 ? -1 : 1;
        const armStride = index === 0 ? stride : oppositeStride;
        const relaxedSway =
          Math.sin(now * 0.0018 + index * Math.PI) * 0.045;

        pivot.rotation.x = tigerAirborne
          ? -0.72
          : armStride * 1.08 * tigerMotionBlend +
            relaxedSway * (1 - tigerMotionBlend);

        pivot.rotation.z =
          side * (-0.09 + Math.abs(armStride) * 0.075 * tigerMotionBlend);
      });

      tigerLegPivots.forEach((pivot, index) => {
        const side = index === 0 ? -1 : 1;
        const legStride = index === 0 ? oppositeStride : stride;

        pivot.rotation.x = tigerAirborne
          ? side < 0
            ? -0.34
            : 0.48
          : legStride * 0.86 * tigerMotionBlend;

        // Lift each foot clearly during its forward swing for a readable stride.
        pivot.position.y =
          -0.36 +
          Math.max(
            0,
            Math.sin(tigerWalkPhase + (index === 0 ? Math.PI : 0))
          ) *
            0.105 *
            tigerMotionBlend;
      });

      tigerHead.rotation.z = tigerAirborne
        ? 0.045
        : Math.sin(tigerWalkPhase * 2) * 0.055 * tigerMotionBlend +
          Math.sin(now * 0.0015) * 0.018 * (1 - tigerMotionBlend);

      tigerHead.rotation.x = tigerAirborne
        ? -0.075
        : Math.sin(tigerWalkPhase) * 0.03 * tigerMotionBlend +
          Math.sin(now * 0.0012) * 0.012 * (1 - tigerMotionBlend);

      // Keep the real 3D model aligned with the invisible gameplay root.
      // The root's y=0.8 baseline represents standing on the ground.
      tigerVisualRoot.position.x = tiger.position.x;
      tigerVisualRoot.position.y = tiger.position.y - 0.8;
      tigerVisualRoot.position.z = tiger.position.z;
      tigerVisualRoot.rotation.y = tiger.rotation.y + Math.PI;
      tigerVisualRoot.rotation.z = tiger.rotation.z;

      if (tigerIsCasting) {
        tigerCastSecondsRemaining -= dt / 60;

        if (tigerCastSecondsRemaining <= 0) {
          tigerIsCasting = false;
          tigerCastSecondsRemaining = 0;

          // Stop the cast and let the normal controller choose
          // the correct animation for Tiger's current state.
          tigerModelAnimations.forEach((group) => group.stop());
          activeTigerAnimation = "";
        }
      }

      if (!tigerIsCasting) {
        if (tigerAirborne) {
          tigerIsDancing = false;
          idleSeconds = 0;
          idleDanceSeconds = 0;
          nextIdleDanceSeconds = 8 + Math.random() * 10;
          switchTigerModelAnimation("jump");
        } else if (tigerMoving) {
          tigerIsDancing = false;
          idleSeconds = 0;
          idleDanceSeconds = 0;
          nextIdleDanceSeconds = 8 + Math.random() * 10;
          switchTigerModelAnimation(keys.has("shift") ? "run" : "walk");
        } else if (tigerIsDancing) {
          idleDanceSeconds += dt / 60;

          if (idleDanceSeconds >= idleDanceDurationSeconds) {
            tigerIsDancing = false;
            idleSeconds = 0;
            idleDanceSeconds = 0;
            nextIdleDanceSeconds = 10 + Math.random() * 16;
            switchTigerModelAnimation("idle");
          } else {
            switchTigerModelAnimation("dance");
          }
        } else {
          idleSeconds += dt / 60;

          if (idleSeconds >= nextIdleDanceSeconds) {
            tigerIsDancing = true;
            idleDanceSeconds = 0;
            idleDanceDurationSeconds = 6 + Math.random() * 5;
            switchTigerModelAnimation("dance");
          } else {
            switchTigerModelAnimation("idle");
          }
        }
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

        const bob =
          Math.sin(now * 0.004 + heart.x * 0.7 + heart.z * 0.3) * 0.13;

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
          Math.abs(projectile.x) > WORLD_MAX_X ||
          projectile.x < WORLD_MIN_X ||
          Math.abs(projectile.z) > WORLD_MAX_Z ||
          projectile.z < WORLD_MIN_Z
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
          "YOU DID IT, TIGER! Every cat is safe, Paris's quest is complete, and the yard is protected!"
        );
      }

      // A soft, layered breeze moves the treetops and grass independently.
      // The slow phase offsets avoid a synchronized, mechanical wave.
      windSwayMeshes.forEach((item) => {
        const breeze = Math.sin(now * item.speed + item.phase);
        const secondaryBreeze = Math.sin(now * item.speed * 0.63 + item.phase * 1.7);
        // Both rotation and small positional drift make the breeze readable at game distance.
        item.mesh.rotation.x = item.baseRotationX + breeze * item.amplitude * 0.32;
        item.mesh.rotation.z = item.baseRotationZ + breeze * item.amplitude
          + secondaryBreeze * item.amplitude * 0.28;
        item.mesh.position.x = item.basePositionX + breeze * item.positionAmplitude;
        item.mesh.position.y = item.basePositionY + Math.abs(secondaryBreeze) * item.positionAmplitude * 0.16;
        item.mesh.position.z = item.basePositionZ + secondaryBreeze * item.positionAmplitude * 0.6;
      });

      // Clouds drift slowly and bob just a little, keeping the sky lively but calm.
      skyClouds.forEach((cloud) => {
        cloud.parts.forEach((part, index) => {
          const base = cloud.basePositions[index];
          part.position.x = base.x + Math.sin(now * 0.00012 * cloud.drift + cloud.phase) * 1.8;
          part.position.y = base.y + Math.sin(now * 0.00055 + cloud.phase) * 0.16;
        });
      });
      const haloScale = 1 + Math.sin(now * 0.0011) * 0.025;
      sunHalo.scaling.set(haloScale, haloScale, haloScale);

      // Gentle shimmer keeps placed water blocks feeling alive without heavy effects.
      waterTiles.forEach((tile, index) => {
        tile.parts.slice(1).forEach((ripple, rippleIndex) => {
          ripple.position.x = tile.x + Math.sin(now * 0.0018 + index + rippleIndex) * 0.12;
          ripple.scaling.x = 0.85 + Math.sin(now * 0.002 + rippleIndex) * 0.12;
        });
      });

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
  
<main
  ref={gameRootRef}
  className="relative h-screen w-screen overflow-hidden"
  style={{
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100dvh",
    overflow: "hidden",
    isolation: "isolate",
    background: "#07111f",
    color: "#f1f5f9",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  }}
>
  <canvas
    ref={canvasRef}
    className="outline-none"
    style={{
      position: "absolute",
      inset: 0,
      display: "block",
      width: "100%",
      height: "100%",
      touchAction: "none",
      zIndex: 0,
    }}
  />

  {/* FULLSCREEN */}
  <button
    onClick={toggleFullscreen}
    style={{
      position: "fixed",
      top: 18,
      right: 18,
      zIndex: 1000,
      width: 44,
      height: 44,
      display: "grid",
      placeItems: "center",
      borderRadius: 14,
      border: "1px solid rgba(148,163,184,.22)",
      background: "rgba(7,17,31,.78)",
      color: "#e2e8f0",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      cursor: "pointer",
      fontSize: 20,
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
    }}
    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
  >
    {isFullscreen ? "↙" : "⛶"}
  </button>

  {/* LEFT HUD */}
  <section
    className="game-hud-scroll"
    style={{
      position: "fixed",
      top: 18,
      left: 18,
      zIndex: 900,
      width: 294,
      maxWidth: "calc(100vw - 36px)",
      maxHeight: "calc(100dvh - 36px)",
      overflowY: "auto",
      overflowX: "hidden",
      padding: 16,
      borderRadius: 22,
      border: "1px solid rgba(148,163,184,.18)",
      background: "linear-gradient(145deg, rgba(9,18,34,.88), rgba(12,24,43,.72))",
      backdropFilter: "blur(22px)",
      WebkitBackdropFilter: "blur(22px)",
      boxShadow: "0 18px 55px rgba(0,0,0,.28)",
    }}
  >
    {/* BRAND */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 14,
            background: "linear-gradient(135deg,#22d3ee,#6366f1)",
            color: "#07111f",
            fontSize: 23,
            boxShadow: "0 0 24px rgba(34,211,238,.22)",
          }}
        >
          🐯
        </div>
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: "-.6px",
              lineHeight: 1.2,
            }}
          >
            HELLO TIGER!
          </div>
          <div
            style={{
              marginTop: 4,
              color: "#94a3b8",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "1.7px",
            }}
          >
            ADVENTURE STATUS
          </div>
        </div>
      </div>

      <span
        style={{
          width: 8,
          height: 8,
          flexShrink: 0,
          borderRadius: 99,
          background: gameWon ? "#4ade80" : "#22d3ee",
          boxShadow: `0 0 12px ${gameWon ? "#4ade80" : "#22d3ee"}`,
        }}
      />
    </div>

    {/* HEALTH + MANA */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 9,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: 12,
          borderRadius: 15,
          background: "rgba(255,255,255,.045)",
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".8px",
          }}
        >
          <span>HEALTH</span>
          <span style={{ color: "#fb7185" }}>♥</span>
        </div>
        <div style={{ marginTop: 7, fontSize: 22, fontWeight: 900 }}>
          {health}
        </div>
        <div
          style={{
            height: 4,
            marginTop: 8,
            borderRadius: 99,
            overflow: "hidden",
            background: "rgba(255,255,255,.09)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, Number(health) || 0))}%`,
              background: "linear-gradient(90deg,#fb7185,#f43f5e)",
              borderRadius: 99,
            }}
          />
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 15,
          background: "rgba(255,255,255,.045)",
          border: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#94a3b8",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".8px",
          }}
        >
          <span>MANA</span>
          <span style={{ color: "#a78bfa" }}>✦</span>
        </div>
        <div style={{ marginTop: 7, fontSize: 22, fontWeight: 900 }}>
          {mana}
        </div>
        <div
          style={{
            height: 4,
            marginTop: 8,
            borderRadius: 99,
            overflow: "hidden",
            background: "rgba(255,255,255,.09)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, Number(mana) || 0))}%`,
              background: "linear-gradient(90deg,#818cf8,#c084fc)",
              borderRadius: 99,
            }}
          />
        </div>
      </div>
    </div>

    {/* WORLD STATS */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3,minmax(0,1fr))",
        gap: 7,
      }}
    >
      {[
        { label: "SLIMES", value: slimesDefeated, icon: "◈", color: "#67e8f9" },
        { label: "CATS", value: catsRescued, icon: "🐾", color: "#f9a8d4" },
        { label: "HOUSED", value: catsHoused, icon: "⌂", color: "#86efac" },
        { label: "WOOD", value: wood, icon: "▥", color: "#fbbf24" },
        { label: "STONE", value: stone, icon: "◆", color: "#cbd5e1" },
        { label: "BARNS", value: barnCount, icon: "⌂", color: "#fdba74" },
        { label: "ROADS", value: roadCount, icon: "↗", color: "#93c5fd" },
        { label: "WATER", value: waterCount, icon: "≈", color: "#67e8f9" },
      ].map((stat) => (
        <div
          key={stat.label}
          style={{
            minWidth: 0,
            padding: "10px 8px",
            borderRadius: 13,
            background: "rgba(255,255,255,.035)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: stat.color,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <span>{stat.icon}</span>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 9,
                letterSpacing: ".4px",
              }}
            >
              {stat.label}
            </span>
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 20,
              fontWeight: 850,
              lineHeight: 1,
              color: "#f8fafc",
              overflowWrap: "anywhere",
            }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>

    {/* QUEST */}
    <div
      style={{
        marginTop: 12,
        padding: 13,
        borderRadius: 16,
        border: "1px solid rgba(34,211,238,.16)",
        background: "linear-gradient(120deg,rgba(8,145,178,.13),rgba(99,102,241,.10))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "#67e8f9",
            fontWeight: 900,
            letterSpacing: "1.2px",
          }}
        >
          
MAIN QUEST
        </span>
        <span
          style={{
            padding: "4px 7px",
            borderRadius: 7,
            background: questComplete
              ? "rgba(74,222,128,.13)"
              : "rgba(255,255,255,.07)",
            color: questComplete ? "#86efac" : "#cbd5e1",
            fontSize: 9,
            fontWeight: 800,
          }}
        >
          {questComplete ? "COMPLETE" : questStarted ? "IN PROGRESS" : "READY"}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 850 }}>
        {questComplete ? "Paris is home!" : "Rescue Paris"}
      </div>
      <div
        style={{
          marginTop: 4,
          color: "#94a3b8",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {questComplete
          ? "A new adventure awaits."
          : "Explore the world and bring your furry friend home."}
      </div>
      <div
        style={{
          height: 4,
          marginTop: 11,
          borderRadius: 99,
          overflow: "hidden",
          background: "rgba(255,255,255,.09)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: questComplete ? "100%" : questStarted ? "50%" : "8%",
            borderRadius: 99,
            background: "linear-gradient(90deg,#22d3ee,#818cf8)",
            transition: "width .3s ease",
          }}
        />
      </div>
    </div>

    {/* MODE */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 13,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.07)",
      }}
    >
      <span
        style={{
          color: "#94a3b8",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".8px",
        }}
      >
        BUILD MODE
      </span>
      <span
        style={{
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "#a5f3fc",
          fontSize: 11,
          fontWeight: 850,
          textTransform: "uppercase",
        }}
      >
        {mode}
      </span>
    </div>

    {/* ACTIONS */}
    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <button
        onClick={(event) => {
          event.currentTarget.blur();
        }}
        style={{
          width: "100%",
          minHeight: 42,
          padding: "10px 12px",
          borderRadius: 13,
          border: "1px solid rgba(34,211,238,.24)",
          background:
            "linear-gradient(110deg,rgba(8,145,178,.24),rgba(79,70,229,.20))",
          color: "#cffafe",
          fontSize: 12,
          fontWeight: 850,
          cursor: "pointer",
        }}
      >
        🐾 {canHouseCat ? "HOUSE RESCUED CAT" : "CAT SANCTUARY"}
      </button>

      <button
        onClick={() => {
          const nextInverted = !invertedMovementRef.current;
          invertedMovementRef.current = nextInverted;
          setInvertedMovement(nextInverted);
        }}
        style={{
          width: "100%",
          minHeight: 38,
          padding: "9px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.09)",
          background: "rgba(255,255,255,.035)",
          color: "#cbd5e1",
          fontSize: 11,
          fontWeight: 750,
          cursor: "pointer",
        }}
      >
        ↕ Vertical movement: {invertedMovement ? "REVERSED" : "NORMAL"}
      </button>
    </div>

    {/* GAME MESSAGE */}
    <div
      style={{
        marginTop: 11,
        padding: "10px 11px",
        borderLeft: "2px solid #22d3ee",
        borderRadius: "0 10px 10px 0",
        background: "rgba(34,211,238,.055)",
        color: "#cbd5e1",
        fontSize: 11,
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      {message}
    </div>
  </section>

  {/* RIGHT CONTROLS */}
  <aside
    className="game-hud-scroll"
    style={{
      position: "fixed",
      right: 18,
      bottom: 18,
      zIndex: 800,
      width: 290,
      maxWidth: "calc(100vw - 36px)",
      maxHeight: "calc(100dvh - 36px)",
      overflowY: "auto",
      overflowX: "hidden",
      padding: 15,
      borderRadius: 20,
      border: "1px solid rgba(148,163,184,.18)",
      background:
        "linear-gradient(145deg,rgba(9,18,34,.58),rgba(12,24,43,.42))",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: "0 18px 55px rgba(0,0,0,.25)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "1.4px",
          color: "#e2e8f0",
        }}
      >
        CONTROLS
      </div>
      <div
        style={{
          padding: "4px 7px",
          borderRadius: 7,
          background: "rgba(34,211,238,.10)",
          color: "#67e8f9",
          fontSize: 9,
          fontWeight: 850,
        }}
      >
        HOW TO PLAY
      </div>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 7,
      }}
    >
      {[
        ["W A S D", "Move"],
        ["ARROWS", "Move"],
        ["SHIFT", "Sprint"],
        ["MOUSE", "Look around"],
        ["WHEEL", "Zoom camera"],
        ["SPACE", "Jump / stomp"],
        ["F", "Fire magic bolt"],
        ["C", "Craft charm"],
        ["E", "Interact / rescue / collect"],
        ["B", "Barn build mode"],
        ["T", "Road build mode"],
        ["Q / R", "Rotate build preview"],
        ["ENTER", "Build / place"],
        ["ESC", "Cancel / exit build mode"],
      ].map(([key, description]) => (
        <div
          key={key}
          style={{
            minWidth: 0,
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,.12)",
            background: "rgba(255,255,255,.035)",
          }}
        >
          <div
            style={{
              color: "#67e8f9",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: ".35px",
              marginBottom: 4,
            }}
          >
            {key}
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 10,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {description}
          </div>
        </div>
      ))}
    </div>

    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 12,
        background: "rgba(99,102,241,.09)",
        border: "1px solid rgba(129,140,248,.12)",
      }}
    >
      <div
        style={{
          color: "#c4b5fd",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: ".7px",
          marginBottom: 5,
        }}
      >
        CURRENT OBJECTIVE
      </div>
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {mode === "water"
          ? "Place water to bring your world to life."
          : mode === "road"
          ? "Build roads to connect your world."
          : mode === "barn"
          ? "Place a barn to grow your sanctuary."
          : "Explore, rescue cats, collect resources, and build."}
      </div>
    </div>
  </aside>
</main>
  );
}