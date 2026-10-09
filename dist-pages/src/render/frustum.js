// WebGL clip-space plane extraction; the matrix is column-major.
// Conservative positive-vertex AABB rejection: never discards geometry touching a plane.
export function extractFrustumPlanes(m){
  const planes=[];
  for(const [axis,sign] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){
    const a=m[3]+sign*m[axis],b=m[7]+sign*m[4+axis],c=m[11]+sign*m[8+axis],d=m[15]+sign*m[12+axis];
    const inv=1/(Math.hypot(a,b,c)||1);
    planes.push([a*inv,b*inv,c*inv,d*inv]);
  }
  return planes;
}
export function aabbInFrustum(planes,x0,y0,z0,x1,y1,z1){
  for(const [a,b,c,d] of planes){
    const px=a>=0?x1:x0,py=b>=0?y1:y0,pz=c>=0?z1:z0;
    if(a*px+b*py+c*pz+d < -.25)return false;
  }
  return true;
}
export function install(S){S.extractFrustumPlanes=extractFrustumPlanes;S.aabbInFrustum=aabbInFrustum;}
