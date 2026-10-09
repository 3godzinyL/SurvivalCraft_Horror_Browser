// Blind cave horror: does not consult player direction or LOS; reacts to noise.
// Movement is floor aware, intentionally slow, with limited independent A*.
export function install(S){
  S.caveSpawnCooldown=0;
  S.caveIsDeep=(p=S.player.pos)=> S.terrainHeight(Math.floor(p[0]),Math.floor(p[2]))-p[1]>=7;
  S.spawnCaveHollowed=()=>{
    if(!S.caveIsDeep() || S.enemies.filter(e=>e.type==='hollowed').length>=2)return null;
    for(let a=0;a<30;a++){
      const dir=Math.random()*Math.PI*2,r=13+Math.random()*18;
      const x=Math.floor(S.player.pos[0]+Math.cos(dir)*r),z=Math.floor(S.player.pos[2]+Math.sin(dir)*r);
      // Spawning probes only already-streamed terrain to avoid main-thread
      // chunk creation (hundreds of unloaded cave checks were stuttering).
      const cx=S.floorDiv(x,S.CHUNK),cz=S.floorDiv(z,S.CHUNK);
      if(!S.chunks.has(S.chunkKey(cx,cz)))continue;
      // A cave needs a real floor, no sky, and 2 free blocks for the creature.
      for(let off of [0,-1,1,-2,2,-3,3,-4,4]){
        const y=Math.floor(S.player.pos[1])+off;
        if(y<3||S.terrainHeight(x,z)-y<7||y>=S.WORLD_H-4)continue;
        if(!S.blockDefs[S.peekLoadedBlock(x,y-1,z)]?.solid || S.peekLoadedBlock(x,y,z)!==S.B.AIR || S.peekLoadedBlock(x,y+1,z)!==S.B.AIR)continue;
        const enemy=S.spawnEnemy('hollowed',x+.5,z+.5,false,{caveSpawn:true,pos:[x+.5,y,z+.5],listenTimer:.3,noiseMemory:0,navPath:[]});
        if(enemy) return enemy;
      }
    }
    return null;
  };
  S.updateCaveHollowed=(e,dt)=>{
    const def=S.enemyDefs.hollowed;
    e.attack=Math.max(0,e.attack-dt);e.flash=Math.max(0,e.flash-dt);
    const dist=Math.hypot(S.player.pos[0]-e.pos[0],S.player.pos[2]-e.pos[2]);
    e.listenTimer=(e.listenTimer||0)-dt;
    if(e.listenTimer<=0){
      e.listenTimer=.50+Math.random()*.24;
      let loudest=0,target=null;
      for(const noise of S.playerNoiseEvents){
        const planar=Math.hypot(noise.pos[0]-e.pos[0],noise.pos[2]-e.pos[2]);
        const vertical=Math.abs(noise.pos[1]-e.pos[1]);
        if(vertical>7||planar>Math.min(39,noise.radius*1.2))continue;
        const strength=noise.intensity*(1-noise.age/noise.ttl)*(1-planar/Math.max(1,noise.radius*1.2));
        if(strength>loudest){loudest=strength;target=[noise.pos[0],noise.pos[2]];}
      }
      if(target&&loudest>.09){
        e.noiseTarget=target;e.noiseMemory=Math.min(12,5+loudest*8);e.navTimer=0;
      }
      // A completely silent player is NOT tracked through walls or vegetation.
    }
    e.noiseMemory=Math.max(0,(e.noiseMemory||0)-dt);
    const heard=e.noiseMemory>0 && e.noiseTarget;
    if(!heard){
      e.wanderTimer-=dt;
      if(e.wanderTimer<=0){e.wander+=(Math.random()-.5)*1.7;e.wanderTimer=3+Math.random()*5;}
    }
    let tx=heard?e.noiseTarget[0]:e.pos[0]+Math.sin(e.wander)*3;
    let tz=heard?e.noiseTarget[1]:e.pos[2]-Math.cos(e.wander)*3;
    e.navTimer=(e.navTimer||0)-dt;
    if(e.navTimer<=0&&heard){
      e.navPath=S.planEnemyPath(e,tx,tz,def,220);
      e.navTimer=1+Math.random()*.5;
    }
    if(e.navPath?.length){
      while(e.navPath.length&&Math.hypot(e.navPath[0][0]-e.pos[0],e.navPath[0][1]-e.pos[2])<.62)e.navPath.shift();
      if(e.navPath.length){tx=e.navPath[0][0];tz=e.navPath[0][1];}
    }
    const angle=Math.atan2(tx-e.pos[0],-(tz-e.pos[2]));
    e.facing=S.turnAngle(e.facing||0,angle,dt*.95);
    e.renderFacing=S.turnAngle(e.renderFacing??e.facing,e.facing,dt*1.4);
    const step=(heard?.82:.20)*def.speed*dt;
    const dx=Math.sin(e.facing)*step,dz=-Math.cos(e.facing)*step;
    const r=def.radius*.72,h=def.height*.66;
    const tryStep=(nx,nz)=>{
      const ny=S.navCanGo(Math.floor(nx),Math.floor(nz),e.pos[1],r,h);
      if(ny===null||Math.abs(ny-e.pos[1])>1.01||S.entityCollides(nx,ny,nz,r,h))return false;
      e.pos[0]=nx;e.pos[1]=ny;e.pos[2]=nz;return true;
    };
    const moved=tryStep(e.pos[0]+dx,e.pos[2]+dz);
    if(!moved){
      e.navTimer=0;
      // Move only when there's clearance; no spinning, jitter or phasing through walls.
      tryStep(e.pos[0]+dx,e.pos[2])||tryStep(e.pos[0],e.pos[2]+dz);
    }
    e.gait+=(moved?dt*2.1:dt*.3);
    e.voice-=dt;
    if(e.voice<=0 && dist<28){
      S.sfx('hollowed_breath',Math.max(.13,.62-dist*.018));
      e.voice=5+Math.random()*7;
    }
    if(dist<1.7 && Math.abs(S.player.pos[1]-e.pos[1])<1.8 && (heard || dist<.9) && e.attack<=0){
      e.attack=2.25;S.hurtPlayer(def.damage,def.name);
      S.sfx('hollowed_attack',.73);
    }
  };
}
