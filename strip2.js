import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read("web/low_poly_fantasy_rune_stone.glb");
  
  // Remove all textures
  for (const texture of doc.getRoot().listTextures()) {
    texture.dispose();
  }
  
  // Remove all materials
  for (const material of doc.getRoot().listMaterials()) {
    material.dispose();
  }

  await io.write("public/models/rune_stone_v2.glb", doc);
  console.log("Written to rune_stone_v2.glb");
}
run().catch(console.error);
