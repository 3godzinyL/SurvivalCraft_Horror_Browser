// Alpha-weighted mipmaps keep dark transparent texels from outlining plants.
// RGB dilation stays inside each padded tile; alpha and base geometry are unchanged.
export function buildAtlasMipmaps(source,width,height,stride=32){
 let data=new Uint8Array(source);
 for(let pass=0;pass<4;pass++){
  const out=new Uint8Array(data);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4;if(data[i+3]||data[i]||data[i+1]||data[i+2])continue;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height||Math.floor(xx/stride)!==Math.floor(x/stride)||Math.floor(yy/stride)!==Math.floor(y/stride))continue;
    const j=(yy*width+xx)*4;if(data[j]||data[j+1]||data[j+2]){out[i]=data[j];out[i+1]=data[j+1];out[i+2]=data[j+2];break;}
   }
  }data=out;
 }
 const levels=[{width,height,data}];
 while(width>1||height>1){
  const w=Math.max(1,width>>1),h=Math.max(1,height>>1),next=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const dst=(y*w+x)*4;let alpha=0,red=0,green=0,blue=0,rr=0,gg=0,bb=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const i=(Math.min(height-1,y*2+dy)*width+Math.min(width-1,x*2+dx))*4,a=data[i+3];alpha+=a;red+=data[i]*a;green+=data[i+1]*a;blue+=data[i+2]*a;rr+=data[i];gg+=data[i+1];bb+=data[i+2];
   }
   next[dst]=Math.round(alpha?red/alpha:rr/4);next[dst+1]=Math.round(alpha?green/alpha:gg/4);next[dst+2]=Math.round(alpha?blue/alpha:bb/4);next[dst+3]=Math.round(alpha/4);
  }
  width=w;height=h;data=next;levels.push({width,height,data});
 }return levels;
}
