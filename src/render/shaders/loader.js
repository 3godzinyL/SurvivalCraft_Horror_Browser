// Runtime GLSL sources are ordinary .glsl files; no bundler or generated JS strings.
const FILES={"voxelVertex": "voxel.vert.glsl", "voxelFragment": "voxel.frag.glsl", "colorVertex": "color.vert.glsl", "colorFragment": "color.frag.glsl"};
export async function loadShaders(){
 const out={}; await Promise.all(Object.entries(FILES).map(async([name,file])=>{
  const r=await fetch('/src/render/shaders/'+file);
  if(!r.ok) throw Error('Shader not found: '+file);
  out[name]=await r.text();
 }));return Object.freeze(out);
}
