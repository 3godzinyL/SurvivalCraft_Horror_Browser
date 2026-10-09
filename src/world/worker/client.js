// Explicit worker lifecycle; every world switch invalidates pending responses.
export function createChunkWorker(S,gameData){
  let worker=null,token=0,initialized=false,queue=[],inflight=new Set(),requested=new Set();
  let focus=[0,0,5];
  const relevant=(cx,cz)=>Math.abs(cx-focus[0])<=focus[2]&&Math.abs(cz-focus[1])<=focus[2];
  const MAX_INFLIGHT=3;
  const key=(x,z)=>`${x},${z}`;
  const pump=()=>{
    if(!initialized||!worker)return;
    while(inflight.size<MAX_INFLIGHT&&queue.length){
      const req=queue.shift(),k=key(req.cx,req.cz);
      if(!requested.has(k)||S.chunks.has(k)||!relevant(req.cx,req.cz)) {requested.delete(k);continue;}
      inflight.add(k);worker.postMessage({type:'generate',token,cx:req.cx,cz:req.cz});
    }
  };
  const applyEdits=(cx,cz,blocks)=>{
    for(const [pos,id] of S.edits){
      const [x,y,z]=pos.split(',').map(Number);
      if(S.floorDiv(x,16)===cx&&S.floorDiv(z,16)===cz&&y>=0&&y<S.WORLD_H)
        blocks[S.idx3(S.mod(x,16),y,S.mod(z,16))]=id;
    }
  };
  function setFocus(cx,cz,range){
    focus=[cx,cz,range];
    queue=queue.filter(req=>{
      if(relevant(req.cx,req.cz))return true;
      requested.delete(key(req.cx,req.cz));return false;
    });
  }
  function reset(seed){
    token++;queue=[];inflight.clear();requested.clear();initialized=false;
    if(worker)worker.postMessage({type:'init',token,seed:seed>>>0,worldgenVersion:S.worldgenVersion||16,villagePlan:S.villagePlan,gameData});
  }
  function stop(){token++;initialized=false;queue=[];requested.clear();inflight.clear();worker?.terminate();worker=null;}
  function request(cx,cz){
    if(!initialized||!worker||!relevant(cx,cz)||S.chunks.has(key(cx,cz)))return false;
    const k=key(cx,cz);if(requested.has(k))return true;
    if(queue.length>420)return false;
    requested.add(k);queue.push({cx,cz});queue.sort((a,b)=>(a.cx-focus[0])**2+(a.cz-focus[1])**2-(b.cx-focus[0])**2-(b.cz-focus[1])**2);pump();return true;
  }
  try{
    if(typeof Worker!=='undefined'){
      worker=new Worker(new URL('./world-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data:m})=>{
        if(m.token!==token)return;
        if(m.type==='ready'){initialized=true;pump();return;}
        if(m.type==='error'){
          console.warn('Chunk worker failed; synchronous JS fallback active',m.message);
          stop();return;
        }
        if(m.type!=='chunk')return;
        const k=key(m.cx,m.cz);requested.delete(k);inflight.delete(k);
        if(!S.chunks.has(k)&&relevant(m.cx,m.cz)&&m.buffer){
          const blocks=new Uint8Array(m.buffer);applyEdits(m.cx,m.cz,blocks);
          S.chunks.set(k,{cx:m.cx,cz:m.cz,data:blocks,opaque:null,water:null,dirty:true});
          S.dirtyChunks.add(k);
          S.markDirty?.(m.cx-1,m.cz);S.markDirty?.(m.cx+1,m.cz);
          S.markDirty?.(m.cx,m.cz-1);S.markDirty?.(m.cx,m.cz+1);
        }
        pump();
      };
      worker.onerror=e=>{console.warn('Chunk worker unavailable',e.message);stop();};
    }
  }catch(err){console.warn('Worker init unavailable; JS fallback active',err);stop();}
  S.chunkWorker={reset,stop,request,setFocus,isRequested:(cx,cz)=>requested.has(key(cx,cz)),get ready(){return initialized;},get pending(){return requested.size;},get backend(){return initialized?'js-parity':'synchronous-js';}};
  return S.chunkWorker;
}
