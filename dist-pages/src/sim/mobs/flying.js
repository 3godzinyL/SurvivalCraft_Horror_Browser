// Night reconnaissance creatures: sky patrol -> wolf alert -> shallow dive -> retreat.
export function install(S) {
  S.skySpawnTimer=11;
  S.spawnNightFlyer=function(){
    const n=S.currentNightNumber();
    const cap=Math.min(5,1+Math.floor((n+1)/2));
    if(S.enemies.filter(e=>S.enemyDefs[e.type]?.flying).length>=cap)return null;
    const type=n>=4?'night_harrier':'night_moth',angle=Math.random()*Math.PI*2,d=19+Math.random()*18;
    const x=S.player.pos[0]+Math.cos(angle)*d,z=S.player.pos[2]+Math.sin(angle)*d;
    const e=S.spawnEnemy(type,x,z);
    if(!e)return null;
    e.pos[1]=Math.min(S.WORLD_H-5,Math.max(S.player.pos[1]+10,S.findSurface(Math.floor(x),Math.floor(z))+8));
    e.skyState='patrol';e.skyTimer=3+Math.random()*5;e.skyCooldown=4+Math.random()*5;
    e.skyBaseAngle=angle;e.spotted=false;e.facing=angle+Math.PI;e.renderFacing=e.facing;e.skyAlerted=false;
    return e;
  };
  S.updateFlyingSpawns=function(dt,night){
    S.skySpawnTimer-=dt;
    if(S.skySpawnTimer>0)return;
    S.skySpawnTimer=18+Math.random()*12;
    if(night>.54&&S.running&&!S.dead)S.spawnNightFlyer();
  };
  S.updateFlyingPredator=function(e,def,dt,night){
    // Age and impact animation are advanced by the main enemy update loop.
    e.attack=Math.max(0,e.attack-dt);e.flash=Math.max(0,e.flash-dt);
    e.gait+=dt*9;e.skyCooldown=Math.max(0,(e.skyCooldown||0)-dt);
    e.skyCryTimer=(e.skyCryTimer??(3+Math.random()*6))-dt;
    if(e.skyCryTimer<=0){
      const d=Math.hypot(e.pos[0]-S.player.pos[0],e.pos[2]-S.player.pos[2]);
      if(d<30)S.sfx(Math.random()<.4?'bat_wings':'bat_shriek',Math.max(.09,.28-d*.004));
      e.skyCryTimer=8+Math.random()*10;
    }
    e.skyTimer=Math.max(0,(e.skyTimer||0)-dt);
    const px=S.player.pos[0],py=S.player.pos[1]+1.2,pz=S.player.pos[2];
    const dist=Math.hypot(e.pos[0]-px,e.pos[2]-pz),vertical=Math.abs(e.pos[1]-py);
    // Hovering silhouettes search upwind and warn nearby wolf packs.
    const sees=dist<40&&vertical<28&&(S.wolfLineOfSight?.({pos:[e.pos[0],e.pos[1]-.72,e.pos[2]]})??true);
    if(sees){
      if(!e.skyAlerted){
        e.skyAlerted=true;e.spotted=true;
        const closeWolves=S.enemies.filter(w=>w.type==='wolf'&&Math.hypot(w.pos[0]-e.pos[0],w.pos[2]-e.pos[2])<34);
        for(const w of closeWolves){w.spotted=true;w.awareness=1;w.sightAwareness=1;w.track=Math.max(w.track||0,22);w.lastSeen=[px,pz];}
        S.sfx('bat_shriek',.34);
      }
      if(e.skyState==='patrol'&&e.skyCooldown<=0){e.skyState='dive';e.skyTimer=3.8;}
    }
    if(e.skyState==='dive'&&(e.skyTimer<=0||dist<1.8&&vertical<2)){
      if(dist<2.2&&vertical<2.4&&e.attack<=0){
        S.hurtPlayer(def.damage,def.name);e.attack=1.1;e.impactAnim=.5;S.sfx('hurt',.25);
      }
      e.skyState='retreat';e.skyTimer=3+Math.random()*2.1;e.skyCooldown=6+Math.random()*7;
    }
    if(e.skyState==='retreat'&&e.skyTimer<=0){e.skyState='patrol';e.skyTimer=4+Math.random()*5;}
    const phase=e.age*.62+e.skyBaseAngle;
    const tx=e.skyState==='dive'?px:e.skyState==='retreat'?px+Math.sin(phase)*14:px+Math.sin(phase)*12;
    const tz=e.skyState==='dive'?pz:e.skyState==='retreat'?pz-Math.cos(phase)*14:pz-Math.cos(phase)*12;
    const ty=e.skyState==='dive'?py+.5:Math.min(S.WORLD_H-4,py+(e.skyState==='retreat'?14:10)+Math.sin(e.age*.8)*2);
    let dx=tx-e.pos[0],dy=ty-e.pos[1],dz=tz-e.pos[2],len=Math.hypot(dx,dy,dz)||1;
    const max=def.speed*(e.skyState==='dive'?1.65:e.skyState==='retreat'?1.15:.56)*dt;
    const nx=e.pos[0]+dx/len*Math.min(max,len), ny=e.pos[1]+dy/len*Math.min(max,len), nz=e.pos[2]+dz/len*Math.min(max,len);
    const fx=Math.floor(nx),fy=Math.floor(ny),fz=Math.floor(nz);
    if(!S.blockDefs[S.getBlock(fx,fy,fz)]?.solid){e.pos[0]=nx;e.pos[1]=ny;e.pos[2]=nz;}
    else {e.pos[1]=Math.min(S.WORLD_H-3,e.pos[1]+dt*def.speed*1.7);e.skyState='retreat';e.skyTimer=2;}
    const targetAng=Math.atan2(tx-e.pos[0],-(tz-e.pos[2]));
    e.facing=S.turnAngle(e.facing,targetAng,dt*4.4);e.renderFacing=e.facing;
    // Cannot destroy walls; all aggression handled in flight space.
  };
}
