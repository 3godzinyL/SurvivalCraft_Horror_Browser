attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV;
    uniform mat4 uVP; varying vec3 vWorld; varying vec3 vNormal; varying vec2 vUV;
    void main(){vWorld=aPos;vNormal=aNormal;vUV=aUV;gl_Position=uVP*vec4(aPos,1.0);}
