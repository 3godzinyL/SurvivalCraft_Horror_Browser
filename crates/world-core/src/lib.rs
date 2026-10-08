//! Standalone world-data + meshing crate: no DOM, JS, wasm-bindgen or external deps.
//! WARNING: V14 worldgen remains parity-gated in JS until Rust matches golden fixtures.

pub mod ids;
use std::collections::VecDeque;

pub const SIDE: usize = 16;
pub const HEIGHT: usize = 96;
pub const CHUNK_LEN: usize = SIDE * HEIGHT * SIDE;
pub const META_SIZE: usize = 6;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BlockMeta { pub solid: bool, pub transparent: bool, pub decor: bool, pub top: u8, pub side: u8, pub bottom: u8 }
impl BlockMeta {
    pub fn parse(bytes: &[u8]) -> Result<Vec<Self>, &'static str> {
        if bytes.len() != 256 * META_SIZE { return Err("expected exactly 256 block metadata entries"); }
        Ok(bytes.chunks_exact(META_SIZE).map(|b| Self {
            solid: b[0] != 0, transparent: b[1] != 0, decor: b[2] != 0,
            top: b[3], side: b[4], bottom: b[5],
        }).collect())
    }
}

#[inline] pub const fn index(x: usize, y: usize, z: usize) -> usize { y * SIDE * SIDE + z * SIDE + x }
#[inline] fn hash(seed: u32, x: i32, z: i32) -> u32 {
    let mut k = seed ^ (x as u32).wrapping_mul(0x9e3779b9) ^ (z as u32).wrapping_mul(0x85ebca6b);
    k ^= k >> 16; k = k.wrapping_mul(0x7feb352d);
    k ^= k >> 15; k = k.wrapping_mul(0x846ca68b);
    k ^ (k >> 16)
}
#[inline] fn smooth(t: f64) -> f64 { t * t * (3.0 - 2.0 * t) }
fn noise(seed: u32, x: f64, z: f64) -> f64 {
    let ix = x.floor() as i32; let iz = z.floor() as i32;
    let tx = smooth(x - ix as f64); let tz = smooth(z - iz as f64);
    let h = |xx, zz| hash(seed, xx, zz) as f64 / u32::MAX as f64;
    let a = h(ix, iz) * (1.0 - tx) + h(ix + 1, iz) * tx;
    let b = h(ix, iz + 1) * (1.0 - tx) + h(ix + 1, iz + 1) * tx;
    a * (1.0 - tz) + b * tz
}
fn octave(seed: u32, x: f64, z: f64) -> f64 {
    let mut a = 0.5; let mut freq = 1.0; let mut sum = 0.0; let mut norm = 0.0;
    for n in 0..5 {
        sum += noise(seed ^ (n * 0x17112), x * freq, z * freq) * a;
        norm += a; freq *= 2.0; a *= 0.5;
    }
    sum / norm
}

/// Experimental terrain scaffold. NOT V14-compatible: worker must keep parity JS.
/// The native generator is intentionally not enabled by the game yet.
pub fn generate_chunk(cx: i32, cz: i32, seed: u32) -> Vec<u8> {
    let mut out = vec![ids::AIR; CHUNK_LEN];
    for z in 0..SIDE { for x in 0..SIDE {
        let wx = cx as i64 * SIDE as i64 + x as i64;
        let wz = cz as i64 * SIDE as i64 + z as i64;
        let h = (15.0 + octave(seed, wx as f64 * 0.015, wz as f64 * 0.015) * 34.0)
            .clamp(5.0, (HEIGHT - 5) as f64) as usize;
        for y in 0..HEIGHT {
            let id = if y == 0 { ids::BEDROCK }
               else if y + 3 < h { ids::STONE }
               else if y < h { ids::DIRT }
               else if y == h { if h <= 23 { ids::SAND } else { ids::GRASS } }
               else if y <= 22 { ids::WATER } else { ids::AIR };
            out[index(x,y,z)] = id;
        }
    }}
    out
}

/// Neighbor order: +X, -X, -Z, +Z. Missing neighbors are air.
/// Exact block samples across edges prevent missing seams when 4 neighbors are supplied.
pub struct Neighbors<'a> { pub east: Option<&'a [u8]>, pub west: Option<&'a [u8]>, pub north: Option<&'a [u8]>, pub south: Option<&'a [u8]> }
impl<'a> Default for Neighbors<'a> {
    fn default() -> Self { Self { east: None, west: None, north: None, south: None } }
}
fn sample(data: &[u8], n: &Neighbors<'_>, x: i32, y: i32, z: i32) -> u8 {
    if y < 0 || y >= HEIGHT as i32 { return ids::AIR; }
    let (x0,z0) = (x.rem_euclid(SIDE as i32) as usize,z.rem_euclid(SIDE as i32) as usize);
    let part = if x < 0 { n.west } else if x >= SIDE as i32 { n.east }
        else if z < 0 { n.north } else if z >= SIDE as i32 { n.south }
        else { Some(data) };
    part.and_then(|arr| arr.get(index(x0,y as usize,z0))).copied().unwrap_or(ids::AIR)
}

/// Vertex format: u32 bits 0..4 local X, 5..11 Y, 12..16 Z,
/// 17..19 normal index, 20..27 atlas tile, 28..29 ambient occlusion (0..3).
/// Ship packed bytes to WebGL as UNSIGNED_BYTE vec4: WebGL1 float attributes
/// cannot represent arbitrary 30-bit integers losslessly.
#[inline] pub fn pack_vertex(x: u8, y: u8, z: u8, normal: u8, tile: u8, ao: u8) -> u32 {
    (x as u32 & 31) | ((y as u32 & 127) << 5) | ((z as u32 & 31) << 12)
      | ((normal as u32 & 7) << 17) | ((tile as u32) << 20) | ((ao as u32 & 3) << 28)
}

pub struct Mesh { pub opaque: Vec<u32>, pub translucent: Vec<u32> }
const DIRS: [(i32,i32,i32);6] = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,-1),(0,0,1)];
const CORNERS: [[(u8,u8,u8);4];6] = [
    [(1,0,0),(1,1,0),(1,1,1),(1,0,1)],
    [(0,0,0),(0,0,1),(0,1,1),(0,1,0)],
    [(0,1,0),(0,1,1),(1,1,1),(1,1,0)],
    [(0,0,0),(1,0,0),(1,0,1),(0,0,1)],
    [(0,0,0),(0,1,0),(1,1,0),(1,0,0)],
    [(0,0,1),(1,0,1),(1,1,1),(0,1,1)],
];
fn shadow(data:&[u8], n:&Neighbors<'_>, meta:&[BlockMeta], x:i32,y:i32,z:i32)->bool {
    let id=sample(data,n,x,y,z);
    meta.get(id as usize).map(|m| m.solid&&!m.transparent).unwrap_or(false)
}
fn corner_ao(data:&[u8], n:&Neighbors<'_>, meta:&[BlockMeta], x:i32,y:i32,z:i32,dir:usize,c:(u8,u8,u8))->u8 {
    let normal=DIRS[dir];
    let (a,b)=match dir {0|1=>(1,2),2|3=>(0,2),_=>(0,1)};
    let xyz=[x,y,z];let coords=[c.0,c.1,c.2];
    let va=if coords[a]==0{-1}else{1};let vb=if coords[b]==0{-1}else{1};
    let mut p=[xyz[0]+normal.0,xyz[1]+normal.1,xyz[2]+normal.2];
    p[a]+=va;let s1=shadow(data,n,meta,p[0],p[1],p[2]);p[a]-=va;
    p[b]+=vb;let s2=shadow(data,n,meta,p[0],p[1],p[2]);p[a]+=va;
    let corner=shadow(data,n,meta,p[0],p[1],p[2]);
    if s1&&s2 {0} else {3-(s1 as u8+s2 as u8+corner as u8)}
}
pub fn mesh_chunk(data:&[u8], neighbors:&Neighbors<'_>, meta:&[BlockMeta])->Result<Mesh,&'static str> {
    if data.len()!=CHUNK_LEN{return Err("invalid chunk length")}
    if meta.len()!=256{return Err("invalid block metadata")}
    let mut result=Mesh{opaque:Vec::new(),translucent:Vec::new()};
    for y in 0..HEIGHT { for z in 0..SIDE { for x in 0..SIDE {
        let id=data[index(x,y,z)];if id==ids::AIR {continue}
        let m=meta[id as usize];if m.decor{continue} // billboards handled separately
        let target=if m.transparent {&mut result.translucent} else {&mut result.opaque};
        for dir in 0..6 {
            let d=DIRS[dir];let other=sample(data,neighbors,x as i32+d.0,y as i32+d.1,z as i32+d.2);
            let adj=meta[other as usize];
            if other==id || (other!=ids::AIR && !adj.transparent) {continue}
            let tile=if dir==2 {m.top} else if dir==3 {m.bottom} else {m.side};
            let mut packed=[0_u32;4];
            for (i,c) in CORNERS[dir].iter().enumerate(){
                let ao=corner_ao(data,neighbors,meta,x as i32,y as i32,z as i32,dir,*c);
                packed[i]=pack_vertex(x as u8+c.0,y as u8+c.1,z as u8+c.2,dir as u8,tile,ao);
            }
            target.extend_from_slice(&[packed[0],packed[1],packed[2],packed[0],packed[2],packed[3]]);
        }
    }}}
    Ok(result)
}

/// 6-direction flood fill; buffers are small enough to run with no allocations per cell.
pub fn flood_light(data:&[u8],meta:&[BlockMeta],sources:&[(u8,u8,u8,u8)])->Result<Vec<u8>,&'static str>{
    if data.len()!=CHUNK_LEN{return Err("invalid chunk length")}
    if meta.len()!=256{return Err("invalid metadata")}
    let mut levels=vec![0_u8;CHUNK_LEN];let mut q=VecDeque::new();
    for &(x,y,z,intensity) in sources {
        if x as usize>=SIDE||y as usize>=HEIGHT||z as usize>=SIDE {continue}
        let i=index(x as usize,y as usize,z as usize);
        if intensity>levels[i] {levels[i]=intensity.min(15);q.push_back((x as i32,y as i32,z as i32));}
    }
    while let Some((x,y,z))=q.pop_front(){
        let val=levels[index(x as usize,y as usize,z as usize)];if val<=1{continue}
        for &(dx,dy,dz) in &DIRS {
            let xx=x+dx;let yy=y+dy;let zz=z+dz;
            if !(0..SIDE as i32).contains(&xx)||!(0..HEIGHT as i32).contains(&yy)||!(0..SIDE as i32).contains(&zz){continue}
            let i=index(xx as usize,yy as usize,zz as usize);
            let m=meta[data[i] as usize];if m.solid&&!m.transparent {continue}
            if levels[i]+1<val {levels[i]=val-1;q.push_back((xx,yy,zz));}
        }
    }
    Ok(levels)
}

#[cfg(test)] mod tests {
    use super::*;
    fn meta()->Vec<BlockMeta>{let mut m=vec![BlockMeta{solid:false,transparent:true,decor:false,top:0,side:0,bottom:0};256];m[ids::STONE as usize]=BlockMeta{solid:true,transparent:false,decor:false,top:2,side:2,bottom:2};m}
    #[test] fn packed_coordinates(){let p=pack_vertex(16,96,9,5,112,3);assert_eq!(p&31,16);assert_eq!((p>>5)&127,96);assert_eq!((p>>12)&31,9);assert_eq!((p>>17)&7,5);assert_eq!((p>>20)&255,112);assert_eq!((p>>28)&3,3);}
    #[test] fn one_block_six_faces(){let mut d=vec![0;CHUNK_LEN];d[index(8,8,8)]=ids::STONE;let m=mesh_chunk(&d,&Neighbors::default(),&meta()).unwrap();assert_eq!(m.opaque.len(),36);assert!(m.translucent.is_empty());}
    #[test] fn two_blocks_hide_internal_face(){let mut d=vec![0;CHUNK_LEN];d[index(8,8,8)]=ids::STONE;d[index(9,8,8)]=ids::STONE;let m=mesh_chunk(&d,&Neighbors::default(),&meta()).unwrap();assert_eq!(m.opaque.len(),60);}
    #[test] fn neighbor_hides_chunk_seam(){let mut d=vec![0;CHUNK_LEN];d[index(15,5,6)]=ids::STONE;let mut east=vec![0;CHUNK_LEN];east[index(0,5,6)]=ids::STONE;let neighbors=Neighbors{east:Some(&east),..Neighbors::default()};let m=mesh_chunk(&d,&neighbors,&meta()).unwrap();assert_eq!(m.opaque.len(),30);}
    #[test] fn light_avoids_stone(){let mut d=vec![0;CHUNK_LEN];d[index(9,8,8)]=ids::STONE;let light=flood_light(&d,&meta(),&[(8,8,8,15)]).unwrap();assert_eq!(light[index(8,8,8)],15);assert_eq!(light[index(9,8,8)],0);assert_eq!(light[index(7,8,8)],14);}
    #[test] fn terrain_deterministic(){let a=generate_chunk(4,-3,765);let b=generate_chunk(4,-3,765);assert_eq!(a,b);assert_eq!(a.len(),CHUNK_LEN);}
    #[test] fn meta_validation(){assert!(BlockMeta::parse(&[0;1536]).is_ok());assert!(BlockMeta::parse(&[0;1535]).is_err());}
}
