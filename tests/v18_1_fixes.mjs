import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {install as worldApi} from '../src/world/world-api.js';
import {install as held} from '../src/render/held-block.js';
import {install as menuScene} from '../src/render/menu-scene.js';
const files = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
// A canvas texture is uploaded with UNPACK_FLIP_Y_WEBGL=false. Thus v=0 means
// the FIRST (upper) row painted with y<6. Top cube vertices must use v=0,
// bottom vertices must use v=1 -- V18 accidentally inverted these twice.
const atlas=files('src/render/gl.js');
assert.match(atlas,/pixelStorei\(S\.gl\.UNPACK_FLIP_Y_WEBGL, false\)/);
assert.match(atlas,/paint\(1,.*?const moss=y<4/s);
const renderer=files('src/render/held-block.js');
assert.doesNotMatch(renderer,/1\s*-\s*fuv\[i\]\[1\]/,'grass faces must not be inverted again');
const gl={getAttribLocation(){return 0;},getUniformLocation(){return {};}};
const S={gl,atlas:{cols:8,rows:14,tile:24},B:{GRASS:1},GRASS_TOP_BLOCKS:new Set([1]),blockTile:{1:{top:0,side:1,bottom:2}},makeProgram(){return {};},makeMeshBuffers(p,n,u){return {p,n,u}}};
worldApi(S);held(S);S.makeMeshBuffers=(p,n,u)=>({p,n,u});
const mesh=S.heldBlockMeshFor(1);
assert.ok(mesh.u[1] > mesh.u[3],'bottom of side must point to bottom of tile, top to the green painted top of tile');
assert.equal(mesh.u.length/2,36);
assert.match(files('src/render/menu-scene.js'),/const CHUNK_RADIUS=12/);
assert.match(files('src/render/menu-scene.js'),/if\(queued\.length\)buildSector\(queued\.shift\(\)\)/);
console.log('V18_1_FIXES_PASS grass side UV upward in world and held block, 12-chunk radius staged preview');
