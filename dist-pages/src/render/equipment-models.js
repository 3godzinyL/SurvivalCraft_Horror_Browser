// One detailed voxel silhouette for BOTH first-person and F5. All parts are
// rigidly joined through the same model transform; no floating tool heads.
export function install(S){
 S.drawEquipmentModel=function(VP,origin,yaw,pitch,roll,id,fog,cam,scale=1){
  const def=S.itemDefs[id]||{}, cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cz=Math.cos(roll),sz=Math.sin(roll);
  function local(x,y,z){
    const ax=x*cz-y*sz,ay=x*sz+y*cz,az=z;
    const by=ay*cx-az*sx,bz=ay*sx+az*cx;
    return [origin[0]+(ax*cy+bz*sy)*scale,origin[1]+by*scale,origin[2]+(-ax*sy+bz*cy)*scale];
  }
  function piece(x,y,z,w,h,d,col){S.drawBox(VP,local(x,y,z),[w*scale,h*scale,d*scale],col,yaw,fog,cam,pitch,roll);}
  const wood=[.31,.20,.105,1],grain=[.43,.29,.16,1],dark=[.13,.11,.09,1],wrap=[.22,.22,.195,1],iron=[.49,.55,.55,1],edge=[.78,.83,.78,1],gold=[.65,.53,.23,1];
  if(id==='campfire'){
    for(const a of [-.7,.7]){
      // Separate logs held together in a compact crossed arrangement.
      const c=Math.cos(a),s=Math.sin(a);
      for(let i=-1;i<=1;i++)piece(s*.14+i*.035,-.13,c*.10,.075,.23,.075,[.32,.205,.115,1]);
    }
    for(const [y,w,c] of [[.065,.14,[.91,.31,.055,1]],[.15,.095,[1,.57,.08,1]],[.22,.039,[1,.89,.25,1]]])piece(0,y,0,w,.16,w,c);
    return true;
  }
  if(id==='torch'){
    piece(0,.025,0,.078,.45,.078,wood);piece(-.023,-.06,-.042,.022,.26,.012,grain);
    for(const y of [-.13,-.065])piece(0,y,0,.081,.027,.081,wrap);
    piece(0,.275,0,.125,.122,.125,dark);piece(0,.292,-.005,.113,.08,.113,[.43,.22,.085,1]);
    const flicker=Math.sin(performance.now()*.019)*.012;
    piece(0,.391+flicker,0,.055,.13,.054,[1,.47,.11,1]);
    piece(.008,.425+flicker,.012,.025,.064,.027,[1,.83,.28,1]);
    piece(0,.46+flicker,0,.014,.046,.02,[.98,.96,.58,1]);return true;
  }
  if(id==='bedroll'){
    // Horizontal roll with layered cloth, two leather buckles and stitched rim.
    piece(0,.06,0,.43,.17,.235,[.19,.28,.215,1]);
    piece(0,.14,0,.42,.075,.23,[.38,.44,.31,1]);
    piece(0,-.02,0,.43,.053,.24,[.13,.20,.165,1]);
    for(const x of [-.14,.14]){piece(x,.07,0,.048,.24,.25,[.42,.28,.145,1]);piece(x,.193,-.008,.063,.023,.08,[.63,.59,.42,1]);}
    for(const x of [-.195,.195])piece(x,.06,0,.025,.171,.24,[.57,.62,.46,1]);return true;
  }
  if(!def.tool)return false;
  const wooden=def.tier==='wood', golden=def.tier==='gold',head=wooden?grain:golden?gold:iron,bright=wooden?[.56,.39,.215,1]:golden?[.91,.78,.39,1]:edge;
  const shaftY=def.tool==='sword'?-.015:-.02;
  piece(0,shaftY,0,.067,.57,.072,wood);
  piece(-.022,.075,-.041,.014,.27,.011,grain);
  for(const y of [-.22,-.14,.02])piece(0,y,0,.076,.037,.085,wrap);
  piece(0,-.312,0,.093,.04,.09,dark);
  if(def.tool==='axe'){
    piece(.05,.305,0,.38,.235,.086,head);
    piece(.265,.323,0,.117,.30,.056,bright);
    piece(.317,.335,0,.032,.205,.049,bright);
    piece(-.125,.315,0,.10,.173,.085,dark);
    piece(.07,.425,0,.31,.025,.08,bright);
    piece(.045,.205,0,.31,.027,.08,dark);
  } else if(def.tool==='pickaxe'){
    piece(0,.302,0,.56,.11,.082,head);
    piece(-.322,.312,0,.139,.078,.067,bright);
    piece(.322,.312,0,.139,.078,.067,bright);
    piece(-.391,.29,0,.028,.12,.059,bright);
    piece(.391,.29,0,.028,.12,.059,bright);
    piece(0,.374,0,.095,.025,.09,dark);
  } else if(def.tool==='shovel'){
    piece(0,.32,0,.245,.37,.088,head);
    piece(0,.515,0,.218,.047,.077,bright);
    piece(-.10,.30,0,.035,.30,.076,bright);
    piece(.10,.30,0,.035,.30,.076,bright);
    piece(0,.12,0,.112,.10,.10,dark);
  } else if(def.tool==='sword'){
    piece(0,.23,0,.24,.060,.10,[.27,.20,.14,1]);
    piece(0,.273,0,.075,.085,.08,dark);
    piece(0,.57,0,.102,.52,.069,head);
    piece(-.038,.58,-.008,.023,.52,.074,bright);
    piece(.038,.58,-.008,.019,.52,.063,bright);
    piece(0,.855,0,.064,.12,.062,bright);
    piece(0,-.333,0,.115,.058,.115,head);
  } else {piece(0,.31,0,.19,.19,.1,head);piece(0,.41,0,.12,.03,.102,bright);}
  return true;
 };
}
