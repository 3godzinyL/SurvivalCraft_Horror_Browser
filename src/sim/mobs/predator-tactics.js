// Predator tactics: separation, pursuer offsets, destructible obstacles.
export function install(S) {
  S.predatorSequence=0;
  S.predatorFormationTarget=function(e,tx,tz,dist){
    if(e.type!=='wolf')return [tx,tz];
    // Independent stable flank lanes: A direct pursuit, B left, C right,
    // outer flankers intercept player's projected position, not the same node.
    const slot=(e.huntSlot??0)%5;
    const vx=S.player.vel[0]||0,vz=S.player.vel[2]||0;
    const vel=Math.hypot(vx,vz);
    const ahead=Math.min(3.8,dist*.22);
    const tx0=tx+(vel>.2?vx/vel*ahead:0),tz0=tz+(vel>.2?vz/vel*ahead:0);
    const dirX=(tx0-e.pos[0]),dirZ=(tz0-e.pos[2]),dir=Math.max(.01,Math.hypot(dirX,dirZ));
    const sideX=-dirZ/dir,sideZ=dirX/dir;
    const flank=[0,-1,1,-2,2][slot]*(dist<4?1.2:dist>17?2.7:2.15);
    const backoff=dist<3?.5:0;
    return [tx0+sideX*flank-dirX/dir*backoff,tz0+sideZ*flank-dirZ/dir*backoff];
  };
  S.predatorSeparation=function(e){
    let sx=0,sz=0;
    for(const other of S.enemies){
      if(other===e||S.enemyDefs[other.type]?.flying)continue;
      const dx=e.pos[0]-other.pos[0],dz=e.pos[2]-other.pos[2],d2=dx*dx+dz*dz;
      const rad=(S.enemyDefs[e.type]?.radius||.4)+(S.enemyDefs[other.type]?.radius||.4)+.34;
      if(d2>=rad*rad||Math.abs(e.pos[1]-other.pos[1])>1.2)continue;
      if(d2<.001){
        // Distinct but exactly coincident predators must separate too. Their
        // unique hunt slots determine a stable direction, not a random spin.
        const direction=(e.huntSlot??0)-(other.huntSlot??0),a=direction*2.399963229728653+(direction===0?.47:0);
        sx+=Math.cos(a)*1.4;sz+=Math.sin(a)*1.4;
        continue;
      }
      const d=Math.sqrt(d2),w=(rad-d)/rad;
      sx+=dx/d*w;sz+=dz/d*w;
    }
    return [sx,sz];
  };
  S.canPredatorBreakBlock=function(e,id,x,y,z){
    if(S.enemyDefs[e.type]?.passive||S.enemyDefs[e.type]?.flying||!id||id===S.B.BEDROCK||id===S.B.WATER||id===S.B.CHEST||id===S.B.IRON||id===S.B.GOLD)return false;
    if(Math.hypot(x-S.player.pos[0],z-S.player.pos[2])>32)return false;
    const def=S.blockDefs[id];
    if(!def?.solid||def.decor)return false;
    // Man-made blocks and soft natural cover can be slowly broken;
    // untouched natural mountain rock is intentionally NOT excavated.
    return S.edits.has(S.fortKey(x,y,z)) || ['wood','leaves','dirt'].includes(def.material);
  };
  S.predatorObstacle=function(e,angle,def,range=1.32){
    if(!Number.isFinite(angle))return null;
    const ox=Math.sin(angle),oz=-Math.cos(angle);
    for(const step of [.52,.86,1.18,range]){
      const x=Math.floor(e.pos[0]+ox*step),z=Math.floor(e.pos[2]+oz*step);
      for(const dy of [.28,.88,1.48]){
        const y=Math.floor(e.pos[1]+dy),id=S.getBlock(x,y,z);
        if(S.canPredatorBreakBlock(e,id,x,y,z))return {x,y,z,id};
      }
    }
    return null;
  };
  S.damageObstacleByPredator=function(e,def,target){
    if(!target||e.attack>0)return false;
    const key=S.fortKey(target.x,target.y,target.z), current=S.getBlock(target.x,target.y,target.z);
    if(current!==target.id||!S.canPredatorBreakBlock(e,current,target.x,target.y,target.z))return false;
    const f=S.ensureFortification(target.x,target.y,target.z,current,true);
    // Attack animation and impact are present for ALL predators.
    e.attack=e.type==='wolf'&&current===S.B.WOOD_DOOR?3.2:e.type==='wolf'?1.07:.95;e.impactAnim=.46;
    e.velY=Math.max(e.velY||0,0);
    if(f){S.damageFortification(target.x,target.y,target.z,e.type==='wolf'&&current===S.B.WOOD_DOOR?Math.max(.7,def.damage*.075):Math.max(2.0,def.damage*.55),def.name);return true;}
    let damage=S.enemyBlockDamage.get(key);
    if(!damage||damage.id!==current){const original=S.blockDefs[current]?.hard||1;damage={id:current,hp:Math.max(22,original*70),maxHp:Math.max(22,original*70),lastHit:0};}
    damage.hp-=Math.max(2.2,(def.damage||8)*.45);damage.lastHit=S.worldSeconds;S.enemyBlockDamage.set(key,damage);
    S.spawnDebris(target.x,target.y,target.z,current,4,false);
    S.sfx('mine',.37,S.soundMaterialForBlock(current));
    if(damage.hp<=0){
      S.enemyBlockDamage.delete(key);S.fortifications.delete(key);S.setBlock(target.x,target.y,target.z,S.B.AIR);
      S.spawnDebris(target.x,target.y,target.z,current,22,true);
      S.sfx('break',.68,S.soundMaterialForBlock(current));e.navPath=[];e.navTimer=0;
    }
    return true;
  };
  S.trimPredatorDamage=function(){
    let n=0;
    for(const [key,d] of S.enemyBlockDamage){
      if(!Number.isFinite(d.hp)||d.hp<=0||S.worldSeconds-d.lastHit>S.BLOCK_DAMAGE_TTL||++n>1200)S.enemyBlockDamage.delete(key);
    }
  };
}
