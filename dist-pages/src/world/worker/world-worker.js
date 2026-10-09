// Worker-only voxel generator. No DOM, WebGL or main-thread globals.
// The JS implementation preserves the V14 golden chunk hashes exactly;
// Rust/WASM is enabled only when a build passes the same tests.
import { install as math } from '../../math/matrix.js';
import { install as noise } from '../noise.js';
import { install as registry } from '../../data/registry.js';
import { install as worldgen } from '../worldgen.js';

const S={ GAME_DATA:null };
math(S);noise(S);
let generation=0,ready=false;
self.onmessage=({data:m})=>{
  try {
    if(m.type==='init'){
      generation=m.token;
      if(!ready){ S.GAME_DATA=m.gameData;registry(S);worldgen(S);ready=true; }
      S.worldSeed=m.seed>>>0; S.worldgenVersion=m.worldgenVersion||16; S.villagePlan=m.villagePlan||null;
      S.chunks.clear();S.edits.clear();S.dirtyChunks.clear();
      self.postMessage({type:'ready',token:generation,backend:'js-parity'});
    } else if(m.type==='generate'&&ready&&m.token===generation){
      const data=S.generateChunkData(m.cx,m.cz);
      self.postMessage({type:'chunk',token:generation,cx:m.cx,cz:m.cz,buffer:data.buffer},[data.buffer]);
    }
  } catch(err){ self.postMessage({type:'error',token:m.token,message:String(err?.stack||err)}); }
};
