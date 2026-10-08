precision mediump float; varying vec3 vWorld; varying vec3 vNormal; varying vec2 vUV;
    uniform sampler2D uTex; uniform vec3 uCam; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uDay;
    uniform vec3 uTorch; uniform float uTorchPower; uniform float uAlpha; uniform float uTime; uniform float uWater;
    void main(){
      vec4 tex=texture2D(uTex,vUV); if(tex.a<0.12)discard; float grain=fract(sin(dot(floor(vWorld.xz),vec2(12.9898,78.233)))*43758.5453); tex.rgb*=.94+grain*.105;
      vec3 sunDir=normalize(vec3(-0.45,0.82,0.22)); float lam=max(dot(normalize(vNormal),sunDir),0.0);
      float daylight=mix(0.045,0.72,uDay);
      float hemi=.72+.28*clamp(normalize(vNormal).y*.5+.5,0.0,1.0);
      float cloudA=.5+.5*sin(vWorld.x*.032+uTime*.055)*sin(vWorld.z*.026-uTime*.043);
      float cloudShadow=mix(1.0,.82+.18*cloudA,uDay*.58);
      float base=daylight*(0.40+lam*0.60)*hemi*cloudShadow;
      float td=distance(vWorld,uTorch); float torch=uTorchPower*max(0.0,1.0-td/11.0); torch*=torch;
      vec3 warm=vec3(1.18,0.72,0.34)*torch;
      vec3 col=tex.rgb*base + tex.rgb*warm;
      if(uWater>0.5){
        float w1=sin(vWorld.x*1.55+vWorld.z*.62+uTime*1.85);
        float w2=cos(vWorld.z*2.15-vWorld.x*.38-uTime*1.42);
        float w3=sin((vWorld.x+vWorld.z)*3.2+uTime*2.75);
        float ripple=(w1*.45+w2*.38+w3*.17);
        vec3 V=normalize(uCam-vWorld); float fres=pow(1.0-max(dot(V,normalize(vNormal)),0.0),2.2);
        vec3 deep=vec3(0.025,0.105,0.125), shallow=vec3(0.055,0.235,0.225);
        col=mix(col,mix(deep,shallow,.48+.20*ripple),.56);
        col+=vec3(.10,.15,.14)*max(0.0,ripple-.55)*.34 + vec3(.11,.14,.15)*fres*.22;
      }
      float d=distance(vWorld,uCam); float fog=clamp((d-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
      col=mix(col,uFogColor,fog);
      float luma=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(luma),col,.93);col*=vec3(.965,.985,1.015);col=pow(max(col,vec3(0.0)),vec3(.96));
      gl_FragColor=vec4(col,tex.a*uAlpha);
    }
