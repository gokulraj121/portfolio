import { NodeIO } from '@gltf-transform/core';

async function run() {
  const io = new NodeIO();
  const doc = await io.read("public/models/rune_stone.glb");
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) {
        console.log('Min:', pos.getMin([]));
        console.log('Max:', pos.getMax([]));
      }
    }
  }
}
run().catch(console.error);
