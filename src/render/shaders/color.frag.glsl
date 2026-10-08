precision mediump float; uniform vec4 uColor; uniform float uFog; uniform vec3 uFogColor;
    void main(){gl_FragColor=vec4(mix(uColor.rgb,uFogColor,uFog),uColor.a);}
