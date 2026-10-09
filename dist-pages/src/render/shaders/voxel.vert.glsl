attribute float aDepth;varying mediump float vDepth;
attribute float aSky; varying mediump float vSky;
attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; attribute float aWind; attribute vec3 aTint;
uniform mat4 uVP; uniform mediump float uTime; uniform highp vec3 uCam; uniform mediump float uWater;
varying mediump vec3 vTint; varying highp vec3 vWorld; varying mediump vec3 vNormal; varying highp vec2 vUV;
void main(){
 vec3 p=aPos;
 if(aWind>.98){
   vec2 center=floor(aPos.xz)+vec2(.5);
   vec2 toward=uCam.xz-center;
   toward/=max(length(toward),.0001);
   vec2 across=vec2(toward.y,-toward.x);
   p.xz=center+across*(aPos.x-center.x);
 }
 if(aWind>0.0 && aWind<.98){
  // Vegetation motion is evaluated in world coordinates, irrespective of draw
  // distance. Canopies have coherent low-frequency sway; grasses bend more.
  float canopy=1.0-step(.70,aWind);
  vec2 root=aPos.xz; // continuous field: adjacent vertices cannot jump to different wind cells
  float phase=root.x*.32+root.y*.21+uTime*.72;
  float longWave=sin(phase)+.36*sin(phase*1.73-uTime*.46)+.22*cos(root.x*.11-uTime*.55);
  float gust=.76+.24*sin(uTime*.30+root.x*.031+root.y*.024);
  float flex=mix(aWind*aWind,aWind,canopy);
  // Crown blocks sway visibly but never leave huge gaps at seams.
  vec2 crown=vec2(longWave,cos(phase*.79+uTime*.85))*(.28*flex*gust);
  // Grass/fern: low vertices anchor to the floor through aWind=0.
  vec2 grass=vec2(longWave,cos(phase*.81+uTime*.56))*(.16*flex*gust);
  // Static collision volumes must not sway through the eye at canopy edges.
  float eyeClearance=smoothstep(1.5,3.5,length(aPos.xz-uCam.xz));
  p.xz+=mix(grass,crown,canopy)*mix(1.0,eyeClearance,canopy);
 }

 if(uWater>.5 && aNormal.y>.5){
   float nearShore=.50+.5*sin((p.x+p.z)*.18);
   float small=sin(p.x*1.9+uTime*2.2)*cos(p.z*1.55-uTime*1.45);
   float swell=sin(p.x*.30+p.z*.17-uTime*.95);
   p.y+=(.018*small+.025*swell)*(0.7+.3*nearShore);
 }
 vDepth=aDepth*16.0; vSky=aSky; vTint=aTint;vWorld=p;vNormal=aNormal;vUV=aUV;gl_Position=uVP*vec4(p,1.0);
}