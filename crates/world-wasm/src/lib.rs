//! Minimal import-free wasm ABI. There is no wasm-bindgen/runtime bundler.
//! Experimental native generator must not be activated until golden parity passes.
use nightcraft_world_core::{self as core,BlockMeta,Neighbors,CHUNK_LEN};
use std::sync::Mutex;

struct Engine {seed:u32,meta:Vec<BlockMeta>,chunk:Vec<u8>,opaque:Vec<u32>,translucent:Vec<u32>}
static ENGINE:Mutex<Option<Engine>>=Mutex::new(None);
static INPUT:Mutex<Vec<u8>>=Mutex::new(Vec::new());

/// Reserve memory for JS to copy typed arrays directly into linear wasm memory.
#[no_mangle]pub extern "C" fn input_alloc(bytes:usize)->*mut u8 {
    let Ok(mut buf)=INPUT.lock() else{return std::ptr::null_mut()};
    if bytes>16*1024*1024{return std::ptr::null_mut()}
    buf.resize(bytes,0);buf.as_mut_ptr()
}
/// Initialize with 256*6 compact metadata bytes and stable numeric seed.
#[no_mangle]pub extern "C" fn init(meta_len:usize,seed:u32)->i32 {
    let Ok(input)=INPUT.lock() else{return -1};
    if input.len()<meta_len{return -2}
    let Ok(meta)=BlockMeta::parse(&input[..meta_len]) else{return -3};
    let Ok(mut e)=ENGINE.lock() else{return -4};
    *e=Some(Engine{seed,meta,chunk:Vec::new(),opaque:Vec::new(),translucent:Vec::new()});0
}
/// Source-only prototype generator, not parity-certified: browser uses legacy JS.
#[no_mangle]pub extern "C" fn generate_chunk(cx:i32,cz:i32)->*const u8 {
    let Ok(mut lock)=ENGINE.lock() else{return std::ptr::null()};
    let Some(e)=lock.as_mut() else{return std::ptr::null()};
    e.chunk=core::generate_chunk(cx,cz,e.seed);e.chunk.as_ptr()
}
#[no_mangle]pub extern "C" fn chunk_len()->usize{CHUNK_LEN}

/// INPUT must contain [center (24576 B), east, west, north, south] in this order.
/// The 4 optional neighbor buffers may be omitted (but only in that order).
#[no_mangle]pub extern "C" fn mesh_chunk(n_chunks:usize)->i32 {
    if !(1..=5).contains(&n_chunks){return -1}
    let Ok(input)=INPUT.lock() else{return -2};
    if input.len()<n_chunks*CHUNK_LEN{return -3}
    let Ok(mut lock)=ENGINE.lock() else{return -4};
    let Some(e)=lock.as_mut() else{return -5};
    let block=|i| if n_chunks>i{Some(&input[i*CHUNK_LEN..(i+1)*CHUNK_LEN])}else{None};
    let n=Neighbors{east:block(1),west:block(2),north:block(3),south:block(4)};
    let Ok(mesh)=core::mesh_chunk(block(0).unwrap(),&n,&e.meta) else{return -6};
    e.opaque=mesh.opaque;e.translucent=mesh.translucent;0
}
#[no_mangle]pub extern "C" fn opaque_ptr()->*const u32 {ENGINE.lock().ok().and_then(|e|e.as_ref().map(|v|v.opaque.as_ptr())).unwrap_or(std::ptr::null())}
#[no_mangle]pub extern "C" fn opaque_len()->usize{ENGINE.lock().ok().and_then(|e|e.as_ref().map(|v|v.opaque.len())).unwrap_or(0)}
#[no_mangle]pub extern "C" fn translucent_ptr()->*const u32{ENGINE.lock().ok().and_then(|e|e.as_ref().map(|v|v.translucent.as_ptr())).unwrap_or(std::ptr::null())}
#[no_mangle]pub extern "C" fn translucent_len()->usize{ENGINE.lock().ok().and_then(|e|e.as_ref().map(|v|v.translucent.len())).unwrap_or(0)}
