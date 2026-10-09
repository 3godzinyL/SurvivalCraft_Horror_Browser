// Original procedural water strokes: turbulent wash, small impacts and submerged bubbles.
// No source recordings or third-party assets. Deterministic PCM for reproducible builds.
const fs=require('node:fs');
for(let variant=0;variant<3;variant++){
 const rate=44100,length=Math.floor(rate*(.76+variant*.035)),data=new Float64Array(length);let state=71541+variant*8719,lo=0,body=0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296*2-1;};
 const bubbles=Array.from({length:9},(_,i)=>({start:.10+i*.048+(random()+1)*.012,freq:170+(random()+1)*240,amp:.018+(random()+1)*.018}));
 for(let i=0;i<length;i++){
  const t=i/rate,x=random();lo+=.085*(x-lo);body+=.018*(x-body);
  const envelope=Math.pow(Math.min(1,t/.10),1.5)*Math.exp(-t*4.5)*(1+.32*Math.sin(t*13+variant));
  let value=(lo*.44+body*.64)*envelope;
  for(const b of bubbles){const age=t-b.start;if(age>=0&&age<.11)value+=b.amp*Math.sin(2*Math.PI*b.freq*age*(1-.7*age))*Math.sin(Math.PI*Math.min(1,age/.015))*Math.exp(-age*48);}
  data[i]=value*Math.min(1,(length-i)/(rate*.08));
 }
 const peak=Math.max(...Array.from(data.slice(0,1000),Math.abs),...Array.from(data.slice(1000),Math.abs));const scale=.38/peak,b=Buffer.alloc(44+length*2);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length*2,40);
 for(let i=0;i<length;i++)b.writeInt16LE(Math.round(data[i]*scale*32767),44+i*2);
 const name=variant?'swim_stroke_'+(variant+1):'swim';fs.writeFileSync('assets/audio/'+name+'.wav',b);console.log(name,length/rate,'peak .38');
}

