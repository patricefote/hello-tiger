const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'public', 'models');
const farm = path.join(root, 'Farm Animals Animated  by Quaternius', 'FBX');

function inspectGLB(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'glTF') return;
  let offset = 12;
  while (offset + 8 <= b.length) {
    const len = b.readUInt32LE(offset);
    const type = b.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4E4F534A) {
      const j = JSON.parse(b.toString('utf8', offset, offset + len));
      console.log('\nGLB:', path.basename(file));
      console.log('Animations:', (j.animations || []).map(a => a.name || '(unnamed)'));
      console.log('Skins:', (j.skins || []).length, 'Nodes:', (j.nodes || []).length);
      return;
    }
    offset += len;
  }
}

function inspectFBX(file) {
  const b = fs.readFileSync(file);
  const s = b.toString('latin1');
  const terms = [...new Set(
    s.match(/.{0,45}(?:AnimationStack|AnimationLayer|AnimationCurveNode|AnimStack|Walk|Idle|Take 001|Take 002).{0,65}/gi) || []
  )];
  console.log('\nFBX:', path.basename(file));
  console.log('Animation markers:', terms.length ? terms.slice(0, 12) : '(no readable markers)');
}

for (const name of [
  'an_animated_cat.glb',
  'cat.glb',
  'cat_in_motion_3d_model_free.glb',
  'bake3d-fox-animated.glb',
  'horse_-_realistic_3d_model_demo_free.glb'
]) {
  const f = path.join(root, name);
  if (fs.existsSync(f)) inspectGLB(f);
}

if (fs.existsSync(farm)) {
  for (const name of fs.readdirSync(farm).filter(n => n.toLowerCase().endsWith('.fbx'))) {
    inspectFBX(path.join(farm, name));
  }
} else {
  console.log('\nFarm FBX directory not found:', farm);
}
