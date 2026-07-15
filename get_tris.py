import json, struct, sys

def get_glb_info(filepath):
    try:
        with open(filepath, 'rb') as f:
            magic, version, length = struct.unpack('<4sII', f.read(12))
            if magic != b'glTF': return "Not GLB"
            
            chunk_len, chunk_type = struct.unpack('<II', f.read(8))
            if chunk_type != b'JSON': return "No JSON chunk"
            
            json_data = json.loads(f.read(chunk_len).decode('utf-8'))
            
            tris = 0
            if 'meshes' in json_data:
                for mesh in json_data['meshes']:
                    for primitive in mesh.get('primitives', []):
                        indices = primitive.get('indices')
                        if indices is not None:
                            count = json_data['accessors'][indices]['count']
                            mode = primitive.get('mode', 4) # 4 is TRIANGLES
                            if mode == 4:
                                tris += count // 3
                            elif mode == 5:
                                tris += count - 2
                            elif mode == 6:
                                tris += count - 2
            return tris
    except Exception as e:
        return str(e)

print(f"Crystal: {get_glb_info('public/models/crytal.glb')}")
print(f"Landscape: {get_glb_info('public/models/landscape.glb')}")
