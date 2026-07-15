import { Document, NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function countTris(file) {
  const doc = await io.read(file);
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        tris += indices.getCount() / 3;
      } else {
        const position = prim.getAttribute('POSITION');
        if (position) tris += position.getCount() / 3;
      }
    }
  }
  return tris;
}

async function run() {
  console.log("Crystal:", await countTris("public/models/crytal.glb"));
  console.log("Landscape:", await countTris("public/models/landscape.glb"));
}
run();
