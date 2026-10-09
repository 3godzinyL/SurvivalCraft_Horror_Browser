// Natural-tree felling, independent of rendering and save format.
// Authored / player-placed logs have a committed world edit and are never eligible.
export const LOG_NAMES = Object.freeze(['WOOD','PINEWOOD','BIRCHWOOD','DARKWOOD','DEADWOOD','WILLOWWOOD','POPLARWOOD','MIMOSAWOOD']);
export const LEAF_NAMES = Object.freeze(['LEAVES','PINELEAVES','BIRCHLEAVES','DARKLEAVES','AUTUMNLEAVES','WILLOWLEAVES','POPLARLEAVES','MIMOSALEAVES']);
export function isNaturalRoot(S,x,y,z){
  const id=S.getBlock(x,y,z);
  if(!LOG_NAMES.some(k=>S.B[k]===id) || S.edits.has(S.editKey(x,y,z)) || y<2)return false;
  if(S.getBlock(x,y-1,z)===id)return false;
  const underneath=S.getBlock(x,y-1,z);
  if(!S.blockDefs[underneath]?.solid || LOG_NAMES.some(k=>S.B[k]===underneath))return false;
  let trunk=0;
  for(let h=0;h<26&&y+h<S.WORLD_H-1;h++){
    if(S.getBlock(x,y+h,z)!==id||S.edits.has(S.editKey(x,y+h,z)))break;
    trunk++;
  }
  return trunk>=3;
}
export function collectTree(S,x,y,z){
  if(!isNaturalRoot(S,x,y,z))return null;
  const id=S.getBlock(x,y,z), found=[], queue=[[x,y,z]],seen=new Set();
  const adjacent=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const independentRoots=new Map();
  const isOtherTrunk=(a,b,c)=>{
    if(a===x&&c===z)return false;
    const col=`${a},${c}`;
    if(!independentRoots.has(col)){
      let separate=false;
      for(let y0=Math.max(2,y-3);y0<=Math.min(y+3,b);y0++){
        if(isNaturalRoot(S,a,y0,c)){separate=true;break;}
      }
      independentRoots.set(col,separate);
    }
    return independentRoots.get(col);
  };
  while(queue.length&&found.length<185){
    const [a,b,c]=queue.shift(),key=S.editKey(a,b,c);
    if(seen.has(key))continue;seen.add(key);
    if(Math.abs(a-x)>4||Math.abs(c-z)>4||b<y||b>y+28||S.getBlock(a,b,c)!==id||S.edits.has(key)||isOtherTrunk(a,b,c))continue;
    found.push([a,b,c,id]);
    for(const [dx,dy,dz]of adjacent)queue.push([a+dx,b+dy,c+dz]);
  }
  // Reject accidental unions with adjacent trees; the main trunk must be intact.
  const main=found.filter(p=>p[0]===x&&p[2]===z);
  if(main.length<3||found.length>=185)return null;
  const tallest=Math.max(...found.map(p=>p[1]));
  const leafIds=LEAF_NAMES.map(k=>S.B[k]).filter(Number.isInteger),leaves=[];
  const min=Math.max(y+2,tallest-8);
  for(let a=x-4;a<=x+4;a++)for(let c=z-4;c<=z+4;c++)for(let b=min;b<=Math.min(S.WORLD_H-2,tallest+4);b++){
    const lid=S.getBlock(a,b,c),key=S.editKey(a,b,c);
    if(leafIds.includes(lid)&&!S.edits.has(key) && Math.hypot(a-x,c-z)<=4.7)leaves.push([a,b,c,lid]);
  }
  return {root:[x,y,z],id,logs:found,leaves, height:main.length};
}
export function pickFallDirection(x,z){
  const norm=Math.hypot(x,z);return norm>.001?[x/norm,z/norm]:[0,-1];
}
export function install(S){
  S.fallingTrees=[];
  S.fallenLogDamage = new Map(); // normalized cracks on fallen natural trunks; persisted in saves
  S.treeChopAim=null;
  S.sampleTreeChopAim=(hit,dt)=>{
    const key=S.editKey(hit.x,hit.y,hit.z);
    if(S.treeChopAim?.key!==key)S.treeChopAim={key,x:0,z:0,time:0};
    const [dx,,dz]=S.lookDir();const t=Math.min(Math.max(dt,0),.1);
    S.treeChopAim.x+=dx*t;S.treeChopAim.z+=dz*t;S.treeChopAim.time+=t;
  };
  S.chopTreeRoot=(hit)=>{
    const tree=collectTree(S,hit.x,hit.y,hit.z);
    if(!tree)return false;
    const aim=S.treeChopAim?.key===S.editKey(hit.x,hit.y,hit.z)?S.treeChopAim:null;
    const look=S.lookDir(),[dx,dz]=pickFallDirection(aim?.x??look[0],aim?.z??look[2]);
    // No other tree, constructed block or existing edit is overwritten on landing.
    // Removing source pieces records edits, retaining determinism of old chunk generation.
    for(const [x,y,z]of [...tree.logs,...tree.leaves])S.setBlock(x,y,z,S.B.AIR);
    S.fallingTrees.push({...tree,dx,dz,angle:0,age:0,settled:false});
    S.treeChopAim=null;
    S.sfx?.('break',1,'wood');
    S.showMessage?.('DRZEWO PADA! ODSUŃ SIĘ OD KORONY',2);
    return true;
  };
  const isReplaceable=id=>id===S.B.AIR||id===S.B.WATER||Boolean(S.blockDefs[id]?.decor);
  const woods=LOG_NAMES.map(k=>S.B[k]),foliage=LEAF_NAMES.map(k=>S.B[k]);
  S.settleFallingTree=tree=>{
    const [bx,by,bz]=tree.root, rootX=bx+.5,rootZ=bz+.5;
    const source=tree.logs.filter(p=>p[0]===bx&&p[2]===bz).sort((a,b)=>a[1]-b[1]);
    const destinations=[],existing=new Set();
    const scale=source.length;
    if(!scale){const drop=S.blockDefs[tree.id]?.drop;if(drop)for(const log of tree.logs)S.spawnItemDrop(drop,1,[log[0]+.5,log[1]+.5,log[2]+.5],null,.6);return;}
    // Direction vector uses the weighted facing over the entire chop, not final frame.
    for(let i=0;i<scale;i++){
      const x=Math.floor(rootX+tree.dx*i),z=Math.floor(rootZ+tree.dz*i),key=`${x},${z}`;
      if(!existing.has(key)){existing.add(key);destinations.push([x,z]);}
    }
    const ground=destinations.map(([x,z])=>{
      let y=Math.min(S.WORLD_H-4,by+Math.min(scale,16)+4);
      for(;y>=1;y--){
        const id=S.getBlock(x,y,z);
        // Ignore *other naturally generated trees* in landing height: they
        // never deflect the fall or make the trunk hover over their canopies.
        if((woods.includes(id)||foliage.includes(id))&&!S.edits.has(S.editKey(x,y,z)))continue;
        if(!isReplaceable(id))return y;
      }
      return 1;
    });
    const layY=Math.max(by,Math.max(...ground)+1);
    const occupied=[];
    for(let i=0;i<destinations.length;i++){
      const [x,z]=destinations[i];
      if(layY>=S.WORLD_H-1 || layY-ground[i]>2 || !isReplaceable(S.getBlock(x,layY,z))){
        occupied.push(false);continue;
      }
      const old=S.getBlock(x,layY,z);
      if(S.blockDefs[old]?.decor && old!==S.B.AIR) {
        S.spawnDebris?.(x,layY,z,old,9,true);
        S.spawnParticle?.([x+.5,layY+.34,z+.5],[0,1.6,0],.35,[.23,.34,.19,1],5,4,.7);
      }
      S.setBlock(x,layY,z,tree.id);
      // Each fallen segment takes independent 5–30% impact damage.
      S.fallenLogDamage.set(S.editKey(x,layY,z),.05+Math.random()*.25);
      occupied.push(true);
    }
    // Every source log remains recoverable: the excess, branches and blocked
    // positions fall as collectable objects. Never overwrite other trees/houses.
    const remaining=Math.max(0,tree.logs.length-occupied.filter(Boolean).length);
    const drop=S.blockDefs[tree.id]?.drop;
    if(drop)for(let n=0;n<remaining;n++)S.spawnItemDrop(drop,1,[bx+.5+tree.dx*(n%scale),layY+.7,bz+.5+tree.dz*(n%scale)],null,.65);
    const impactPos=[bx+.5+tree.dx*(scale*.72),layY+.25,bz+.5+tree.dz*(scale*.72)];
    // Impact disperses the full canopy over the actual horizontal landing path.
    S.emitTreeCrashLeaves?.(tree,layY);
    const target=Math.min(145,Math.max(45,tree.leaves.length));
    for(let i=0;i<target;i++){
      const leaf=tree.leaves[i%tree.leaves.length];
      if(!leaf)break;
      const along=Math.random()*Math.max(2,scale-1), ang=Math.random()*Math.PI*2;
      const radial=.8+Math.random()*2.5;
      const ox=bx+.5+tree.dx*along+Math.cos(ang)*radial;
      const oz=bz+.5+tree.dz*along+Math.sin(ang)*radial;
      S.spawnParticle?.([ox,layY+.18+Math.random()*.75,oz],
        [Math.cos(ang)*(1+Math.random()*2.8),1+Math.random()*3,Math.sin(ang)*(1+Math.random()*2.8)],
        .45+Math.random()*1.1,S.leafColorForBlock?.(leaf[3])||[.13,.3,.12,1],
        3+Math.random()*3.8,5.8,.8);
    }
    S.sfx?.('break',.8,'leaves');
  };
  S.updateFallingTrees=dt=>{
    for(let i=S.fallingTrees.length-1;i>=0;i--){
      const t=S.fallingTrees[i];t.age+=dt;
      // Slow start, accelerated fall, light rebound: 1.5–2.2 seconds.
      const x=Math.min(1,t.age/Math.min(2.2,1.30+t.height*.036));
      const ease=x*x*(3-2*x);t.angle=ease*Math.PI*.5+Math.sin(x*Math.PI*3)*(.035*(1-x));
      if(x>.54&&x<.98&&Math.random()<Math.min(1,dt*19) && t.leaves.length){
        const leaf=t.leaves[(Math.random()*t.leaves.length)|0];
        const spread=2+Math.random()*3;
        S.spawnParticle?.([t.root[0]+.5+t.dx*spread,t.root[1]+1.1+Math.random()*2,t.root[2]+.5+t.dz*spread],
          [(Math.random()-.5)*2.4,.2+Math.random()*.9,(Math.random()-.5)*2.4],
          .55+Math.random()*.65,S.leafColorForBlock?.(leaf[3])||[.14,.3,.12,1],3.8,3.4,.6);
      }
      if(x>=1){S.settleFallingTree(t);S.fallingTrees.splice(i,1);}
    }
  };
}
