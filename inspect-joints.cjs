
const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'public', 'models');

const files = [
  'an_animated_cat.glb',
  'bake3d-fox-animated.glb',
  'cat.glb',
  'horse_-_realistic_3d_model_demo_free.glb'
];

// Only print full skeleton hierarchies for these models.
const hierarchyFiles = new Set([
  'an_animated_cat.glb',
  'bake3d-fox-animated.glb'
]);

for (const file of files) {
  const filePath = path.join(dir, file);

  console.log('\n================================');
  console.log('FILE:', file);
  console.log('================================');

  if (!fs.existsSync(filePath)) {
    console.log('Missing file:', filePath);
    continue;
  }

  const buffer = fs.readFileSync(filePath);
  let offset = 12;
  let json;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (type === 0x4E4F534A) {
      json = JSON.parse(
        buffer.toString('utf8', offset, offset + length)
      );
      break;
    }

    offset += length;
  }

  if (!json) {
    console.log('Could not read GLB JSON.');
    continue;
  }

  const nodes = json.nodes || [];
  const skins = json.skins || [];

  // Build a map of each node's parent.
  const parentByNode = new Map();

  nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children || []) {
      parentByNode.set(childIndex, parentIndex);
    }
  });

  // Print skeleton hierarchy for Pumpkin and the fox.
  if (hierarchyFiles.has(file)) {
    console.log('\nSKELETON HIERARCHY');

    if (skins.length === 0) {
      console.log('No skin/skeleton found in this model.');
    }

    skins.forEach((skin, skinIndex) => {
      console.log(
        `\nSkin ${skinIndex + 1}: ${skin.name || '(unnamed)'}`
      );

      const joints = skin.joints || [];
      const jointSet = new Set(joints);

      console.log('Joint count:', joints.length);

      for (const nodeIndex of joints) {
        const node = nodes[nodeIndex];
        const parentIndex = parentByNode.get(nodeIndex);
        const parent = parentIndex !== undefined
          ? nodes[parentIndex]
          : null;

        // Mark parents that are part of this same skeleton.
        const parentLabel = parent
          ? `${parent.name || '(unnamed)'} [node ${parentIndex}]`
          : '(no parent)';

        const relation = parentIndex !== undefined &&
          jointSet.has(parentIndex)
          ? 'joint parent'
          : parent
            ? 'non-joint parent'
            : 'root';

        console.log(
          `  [${nodeIndex}] ${node?.name || '(unnamed)'}`
          + ` <- ${parentLabel} (${relation})`
        );
      }
    });
  }

  // Preserve the existing animation report.
  console.log('\nAnimation clips:', (json.animations || []).length);

  for (const animation of json.animations || []) {
    let minTime = Infinity;
    let maxTime = -Infinity;
    const targets = [];

    for (const channel of animation.channels || []) {
      const sampler = animation.samplers[channel.sampler];
      const node = nodes[channel.target.node];
      const input = json.accessors[sampler.input];

      if (input.min && input.min.length) {
        minTime = Math.min(minTime, input.min[0]);
        maxTime = Math.max(maxTime, input.max[0]);
      }

      targets.push(
        `${node?.name || 'unknown node'} -> ${channel.target.path}`
      );
    }

    console.log('\nClip:', animation.name || '(unnamed)');
    console.log(
      'Duration:',
      Number.isFinite(minTime) && Number.isFinite(maxTime)
        ? (maxTime - minTime).toFixed(3) + ' seconds'
        : 'could not determine'
    );

    const interesting = targets.filter(target =>
      /femur|knee|ankle|toe|ball|hips|body|spine|tail/i.test(target)
    );

    console.log('Total animated channels:', targets.length);
    console.log('Leg/body/tail channels:');

    for (const target of [...new Set(interesting)]) {
      console.log('  ' + target);
    }
  }
}
