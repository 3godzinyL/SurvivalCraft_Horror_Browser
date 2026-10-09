precision mediump float; varying mediump vec3 vWorld; varying mediump vec3 vNormal; varying mediump vec2 vUV;
    uniform sampler2D uTex; uniform mediump vec3 uCam; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uDay;
    uniform sampler2D uShadowHeight; uniform vec2 uShadowOrigin; uniform float uShadowSpan; uniform float uShadowAmount;
    uniform vec3 uTorch; uniform float uTorchPower; uniform float uAlpha; uniform mediump float uTime; uniform float uWater;
    void main(){
      vec4 tex=texture2D(uTex,vUV); if(tex.a<0.12)discard; float grain=fract(sin(dot(floor(vWorld.xz),vec2(12.9898,78.233)))*43758.5453); tex.rgb*=.94+grain*.105;
      vec3 sunDir=normalize(vec3(-0.45,0.82,0.22)); float lam=max(dot(normalize(vNormal),sunDir),0.0);
      float daylight=mix(0.045,0.72,uDay);
      float hemi=.72+.28*clamp(normalize(vNormal).y*.5+.5,0.0,1.0);
      float cloudA=.5+.5*sin(vWorld.x*.032+uTime*.055)*sin(vWorld.z*.026-uTime*.043);
      float cloudShadow=mix(1.0,.82+.18*cloudA,uDay*.58);
      // Low cost sun visibility from loaded voxel skyline (terrain + tree crowns).
      // Four stepped ray samples along the sun vector; outside coverage is fully lit.
      float sunVisibility=1.0;
      if(uShadowAmount>0.5 && uDay>0.05 && uWater<0.5){
        float occlusion=0.0;
        for(int i=0;i<4;i++){
          float rise=1.65+float(i)*2.75;
          vec2 probe=vWorld.xz+vec2(-0.45,0.22)*(rise/.82);
          vec2 uv=(probe-uShadowOrigin)/uShadowSpan;
          if(uv.x>0.006 && uv.x<0.994 && uv.y>0.006 && uv.y<0.994){
            float canopy=texture2D(uShadowHeight,uv).r*255.0;
            float above=vWorld.y+rise+0.75;
            occlusion=max(occlusion,step(above,canopy));
          }
        }
        // Preserve some ambient fill, with strong shade underneath canopies.
        sunVisibility=mix(1.0,0.35,occlusion*uDay);
      }
      float base=daylight*(0.40+lam*0.60*sunVisibility)*hemi*cloudShadow;
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
        // Long, layered river ripples and broken shoreline foam; animated
        // strictly in fragment space, no repeated mesh uploads or huge UV drift.
        float chop=sin((vWorld.x+vWorld.z*.72)*.65+uTime*1.22)*sin(vWorld.z*1.86-uTime*1.75);
        float micro=sin(vWorld.x*5.2-vWorld.z*4.1+uTime*3.5)*cos(vWorld.z*5.7+uTime*1.9);
        float foam=smoothstep(.67,.95,ripple*.48+chop*.35+micro*.10+.44);
        col+=vec3(.10,.15,.14)*max(0.0,ripple-.55)*.34 + vec3(.11,.14,.15)*fres*.22;
        col+=vec3(.12,.17,.16)*foam*.24+vec3(.013,.035,.040)*micro*.6;
      }
      float d=distance(vWorld,uCam); float fog=clamp((d-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
      col=mix(col,uFogColor,fog);
      float luma=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(luma),col,.93);col*=vec3(.965,.985,1.015);col=pow(max(col,vec3(0.0)),vec3(.96));
      gl_FragColor=vec4(col,tex.a*uAlpha);
    }
