// Original pixel foliage: irregular overlapping leaves and fine twigs.
// Wrap individual leaves at tile edges, without a repeated grid of holes.
export function buildLeafTile(base,index=6,size=24){
 const data=new Uint8ClampedArray(size*size*4);
 const hash=(x,y)=>{let n=Math.imul(x+index*131,374761393)^Math.imul(y+19,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const put=(x,y,color)=>{const i=(y*size+x)*4;for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,Math.round(color[k])));data[i+3]=255;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const twig=Math.abs(x-y*.67-size*.17)<.6||Math.abs(x+y*.52-size*.82)<.45;
  if(twig)put(x,y,base.map((v,k)=>v*(k===1?.64:.72)));
 }
 for(let j=0;j<48;j++){
  const cx=hash(j,4)*size,cy=hash(j,17)*size;
  const angle=(hash(j,32)-.5)*2.5,ca=Math.cos(angle),sa=Math.sin(angle),hue=(hash(j,73)-.5)*14;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const dx=(x-cx+size*1.5)%size-size*.5,dy=(y-cy+size*1.5)%size-size*.5,u=dx*ca+dy*sa,v=-dx*sa+dy*ca;
   if(u*u/(3.2*3.2)+v*v/(2.1*2.1)>1)continue;
   const vein=Math.abs(v)<.32,edge=Math.abs(v)/2.1;
   const shade=hue+4-edge*8-(vein?6:0)+(hash(x+j,y)-.5)*3;
   put(x,y,base.map((value,k)=>value+shade*(k===1?1:.8)));
  }
 }
 return data;
}
