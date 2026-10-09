precision mediump float;
varying mediump vec3 vTint;
varying mediump vec3 vNormal;
varying highp vec3 vWorld;
varying highp vec2 vUV;
varying mediump float vSky;
varying mediump float vDepth;
uniform sampler2D uReflectionTex;
uniform highp mat4 uReflectionVP;
uniform float uReflectionEnabled,uWaterQuality,uClipHeight;
uniform sampler2D uTex;
uniform sampler2D uTexSharp;
uniform sampler2D uShadowHeight;
uniform highp vec3 uCam;
uniform vec3 uFogColor;
uniform float uWet;
uniform float uFloraFar;
uniform float uFogNear, uFogFar, uDay, uAlpha, uWater, uFlora;
uniform mediump float uTime;
uniform vec2 uShadowOrigin;
uniform float uShadowSpan, uShadowAmount;
uniform highp vec3 uTorch;
uniform float uTorchPower;
uniform highp vec3 uLightPos[12];
uniform float uLightStrength[12];
float falloff(float d) {
  float x=clamp(1.0-d/7.2,0.0,1.0);
  return x*x*(3.0-2.0*x);
}
void main(){
  if(uClipHeight>0.0 && vWorld.y<uClipHeight)discard;
  if(uFlora>.5 && distance(vWorld,uCam)>uFloraFar)discard;
  // Derivatives precede alpha discard, keeping neighbouring fragments coherent.
#ifdef TEXTURE_DERIVATIVES
  vec2 dx=dFdx(vUV)*vec2(256.0,512.0),dy=dFdy(vUV)*vec2(256.0,512.0);
  float footprint=max(length(dx),length(dy));
  float minified=smoothstep(.85,1.65,footprint);
#else
  float minified=smoothstep(12.0,28.0,distance(vWorld,uCam));
#endif
  vec4 sharp=texture2D(uTexSharp,vUV);
  vec4 filtered=texture2D(uTex,vUV);
  vec4 tex=mix(sharp,filtered,minified);
  if(tex.a < (uFlora>.5 ? .35 : .14)) discard;
  float material=floor(vUV.x*8.0)+8.0*floor(vUV.y*16.0);
  bool decor=(material>=37.0&&material<=42.0)||material==56.0||material==57.0||material==58.0||material==70.0||material==71.0;
  // Thin decorative cards can intersect the eye when walking through foliage.
  // Clip only close decoration; solid leaves, walls and terrain retain depth.
  if((uFlora>.5||decor)&&distance(vWorld,uCam)<1.25)discard;
  vec3 normal=normalize(vNormal);
  float day=clamp(uDay,0.0,1.0);
  float exposure=clamp(vSky,0.0,1.0);
  float lam=max(dot(normal,normalize(vec3(-.45,.82,.22))),0.0);
  float sunVisibility=1.0;
  // Height-field shadows affect only direct outdoor sun. Local baked skylight
  // distinguishes leaves from solid ceilings and stays stable while streaming.
  if(uShadowAmount>.005 && exposure>.15 && uWater<.5){
    float obstruction=0.0;
    for(int i=0;i<3;i++){
      float rise=2.0+float(i)*3.7;
      vec2 uv=(vWorld.xz+vec2(-.45,.22)*(rise/.82)-uShadowOrigin)/uShadowSpan;
      if(uv.x>.01 && uv.x<.99 && uv.y>.01 && uv.y<.99){
        vec2 caster=texture2D(uShadowHeight,uv).rg;
        float top=caster.r*255.0;
        obstruction+=smoothstep(vWorld.y+rise+.35,vWorld.y+rise+2.2,top)*mix(1.0,.26,caster.g)/3.0;
      }
    }
    sunVisibility=mix(1.0,.46,obstruction*uShadowAmount);
  }
  // A covered room retains only faint diffuse fill. Dense canopies keep soft
  // daylight; night remains very dark without a local fire.
  float ambient=.012+day*(.12+exposure*(.46+.29*lam*sunVisibility));
  ambient*=mix(.92,1.0,normal.y*.5+.5);
  highp float handD=distance(vWorld,uTorch);
  float hand=falloff(handD)*uTorchPower;
  float local=0.0;
  for(int i=0;i<12;i++){
    if(uLightStrength[i]>.001){
      highp vec3 offset=vWorld-uLightPos[i];
      highp float dist2=dot(offset,offset);
      if(dist2<51.84)local+=uLightStrength[i]*falloff(sqrt(dist2));
    }
  }
  float localLight=.88*(1.0-exp(-(hand+local)*1.2));
  vec3 warm=vec3(1.0,.78,.51)*localLight;
  float tileId=floor(vUV.x*8.0)+8.0*floor(vUV.y*16.0);
  if(normal.y>.8 && (abs(tileId)<.3 || abs(tileId-60.0)<.3 || abs(tileId-61.0)<.3 || abs(tileId-62.0)<.3)){
    float broad=sin(vWorld.x*.090+sin(vWorld.z*.060)*1.4)*cos(vWorld.z*.081-vWorld.x*.018);
    tex.rgb*=vec3(.98,1.03,.94)*(.99+.055*broad);
  }
  float wet=clamp(uWet,0.0,1.0)*exposure;
  if(uWater<.5 && uFlora<.5 && normal.y>.6){
    tex.rgb*=1.0-.10*wet;
    ambient+=wet*.055*day*pow(max(dot(normalize(uCam-vWorld),normal),0.0),4.0);
  }
  tex.rgb*=vTint;
  vec3 col=tex.rgb*(ambient+warm);
  float waterAlpha=tex.a;
  if(uWater>.5){
    float w1=sin(vWorld.x*.42+vWorld.z*.31+uTime*.43);
    float w2=cos(vWorld.z*.73-vWorld.x*.22-uTime*.35);
    vec3 eye=normalize(uCam-vWorld);
    vec3 waveNormal=normalize(vec3(-.028*cos(vWorld.x*.42+uTime*.43),1.0,.035*sin(vWorld.z*.73-uTime*.35)));
    float fres=pow(1.0-max(dot(eye,waveNormal),0.0),4.0);
    float depth=max(.3,vDepth), deepBlend=smoothstep(1.5,8.0,depth);
    float clearSun=smoothstep(.86,1.0,day)*(1.0-uWet*.7)*smoothstep(6.0,13.0,depth);
    vec3 bank=vec3(.065,.080,.055),pond=vec3(.070,.068,.046),clearDeep=vec3(.028,.155,.145);
    vec3 base=mix(bank,pond,smoothstep(.7,3.5,depth));
    base=mix(base,clearDeep,clearSun*.75);
    float visibility=.018+day*(.18+.70*exposure)+localLight*.25;
    col=base*visibility;
    col*=.98+.035*(w1+w2);
    vec2 rainCell=floor(vWorld.xz*1.1),drop=fract(vWorld.xz*1.1)-vec2(.5);
    float rainPhase=fract(uTime*.75+fract(sin(dot(rainCell,vec2(12.9898,78.233)))*43758.5453));
    float ring=exp(-abs(length(drop)-rainPhase*.63)*65.0)*(1.0-rainPhase);
    col+=vec3(.08,.085,.073)*ring*uWet*day;
    vec3 reflected=mix(vec3(.12,.17,.16),uFogColor,.40);
    if(uReflectionEnabled>.5){
      vec4 projected=uReflectionVP*vec4(vWorld,1.0);
      vec2 reflectUV=projected.xy/max(.001,projected.w)*.5+.5;
      reflectUV+=waveNormal.xz*(.018+.007*fres);
      if(projected.w>0.0 && reflectUV.x>.01&&reflectUV.x<.99&&reflectUV.y>.01&&reflectUV.y<.99)
        reflected=texture2D(uReflectionTex,reflectUV).rgb;
    }
    col=mix(col,reflected,(.08+fres*.52+clearSun*.12)*step(.5,uWaterQuality));
    float glint=pow(max(dot(reflect(-normalize(vec3(-.45,.82,.22)),waveNormal),eye),0.0),90.0);
    col+=vec3(.29,.27,.19)*glint*day*.13;
    waterAlpha=clamp(.72+.21*deepBlend+fres*.1,.72,.98);
  }

  float fog=clamp((distance(vWorld,uCam)-uFogNear)/max(1.0,uFogFar-uFogNear),0.0,1.0);
  col=mix(col,uFogColor,fog*mix(.12,1.0,exposure));
  col=col/(1.0+col*.12);
  gl_FragColor=vec4(col,waterAlpha*uAlpha);
}
