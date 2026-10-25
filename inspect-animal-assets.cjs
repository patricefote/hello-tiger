const fs = require("fs");
const path = require("path");

const base = path.join(process.cwd(), "public", "models");

function readGltf(file) {
  const ext = path.extname(file).toLowerCase();
  let data;

  if (ext === ".gltf") {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } else {
    const buf = fs.readFileSync(file);
    if (buf.toString("utf8", 0, 4) !== "glTF") return null;

    let offset = 12;
    while (offset + 8 <= buf.length) {
      const length = buf.readUInt32LE(offset);
      const type = buf.readUInt32LE(offset + 4);
      offset += 8;

      // JSON chunk
      if (type === 0x4E4F534A) {
        data = JSON.parse(buf.toString("utf8", offset, offset + length));
        break;
      }
      offset += length;
    }
  }

  if (!data) return null;

  const nodes = data.nodes || [];
  const animations = (data.animations || []).map((a) => {
    const targets = (a.channels || []).map((c) => {
      const nodeIndex = c.target?.node;
      return {
        node: nodeIndex == null ? "(unknown)" : nodes[nodeIndex]?.name || `node_${nodeIndex}`,
        path: c.target?.path || "unknown"
      };
    });

    return {
      name: a.name || "(unnamed)",
      channels: (a.channels || []).length,
      targets: [...new Set(targets.map(t => `${t.node} [${t.path}]`))]
    };
  });

  const skins = (data.skins || []).map((s, i) => ({
    name: s.name || `skin_${i}`,
    jointCount: (s.joints || []).length,
    joints: (s.joints || []).map(j => nodes[j]?.name || `node_${j}`)
  }));

  return {
    file: path.relative(base, file),
    bytes: fs.statSync(file).size,
    meshCount: (data.meshes || []).length,
    nodeCount: nodes.length,
    animations,
    skins
  };
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if ([".glb", ".gltf"].includes(path.extname(entry.name).toLowerCase())) {
      try {
        const result = readGltf(full);
        if (result) console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.log(JSON.stringify({
          file: path.relative(base, full),
          error: e.message
        }, null, 2));
      }
    }
  }
}

if (!fs.existsSync(base)) {
  console.error("Models folder not found:", base);
  process.exit(1);
}

console.log("=== GLB / GLTF ASSET REPORT ===");
walk(base);

console.log("\n=== FBX ASSET INVENTORY ===");
function walkFbx(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFbx(full);
    else if (path.extname(entry.name).toLowerCase() === ".fbx") {
      console.log(`${path.relative(base, full)} | ${fs.statSync(full).size} bytes`);
    }
  }
}
walkFbx(base);
