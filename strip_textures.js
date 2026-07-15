import { Document, NodeIO } from '@gltf-transform/core';
import { clearNodeTransform } from '@gltf-transform/functions';

const io = new NodeIO();
async function run() {
  const doc = await io.read("public/models/rune_stone.glb");
  
  // Remove all textures
  for (const texture of doc.getRoot().listTextures()) {
    texture.dispose();
  }
  
  // Remove all materials
  for (const material of doc.getRoot().listMaterials()) {
    material.dispose();
  }

  await io.write("public/models/rune_stone.glb", doc);
  console.log("Stripped textures and materials from rune_stone.glb");
}
run().catch(console.error);
