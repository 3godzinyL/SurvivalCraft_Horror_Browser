import {skyAt} from "./lighting.js";
// NightCraft V32 - biome-aware, deterministic, decorative flora.
// Flora is a separate render-only layer; never inserts colliders, world edits,
// additional save fields or multiplayer entities. Builds once per dirty chunk.
export function install(S) {
    const B = S.B;
    const SOILS = new Set([
        B.GRASS, B.FOREST_GRASS, B.FROST_GRASS, B.DRY_GRASS,
        B.LOAM, B.PODZOL, B.MOSSY_DIRT, B.MUD, B.PEAT, B.SILT,
    ]);
    const wet = new Set(['riverlands', 'wet_shore', 'willow_swamp', 'swamp', 'marsh']);
    const dry = new Set(['barren', 'red_barrens', 'chaparral', 'pine_barrens']);
    const cold = new Set(['tundra', 'cold_plains', 'taiga', 'spruce_valley', 'frozen_shore']);
    const mountain = new Set(['rocky', 'highlands', 'alpine', 'mountain_forest', 'snow_peaks']);
    const forest = new Set(['forest', 'old_growth', 'darkwood', 'mist_forest', 'birch', 'poplar_grove', 'autumn']);
    const palette = {
        forest: [0.78, 0.99, 0.73], old_growth: [0.60, 0.83, 0.65],
        darkwood: [0.64, 0.78, 0.62], mist_forest: [0.77, 0.91, 0.81],
        birch: [0.88, 0.98, 0.78], poplar_grove: [0.93, 1, 0.81],
        autumn: [0.98, 0.87, 0.58], mountain_forest: [0.78, 0.91, 0.72],
        meadow: [0.90, 1, 0.70], flower_meadow: [0.94, 1, 0.74],
        plains: [0.88, 0.98, 0.68], cold_plains: [0.72, 0.87, 0.78],
        taiga: [0.72, 0.88, 0.80], spruce_valley: [0.66, 0.84, 0.72],
        willow_swamp: [0.65, 0.91, 0.70], swamp: [0.64, 0.84, 0.68],
        marsh: [0.76, 0.94, 0.75], riverlands: [0.82, 0.99, 0.79],
        wet_shore: [0.84, 0.99, 0.79], beach: [0.80, 0.94, 0.70],
        frozen_shore: [0.85, 0.93, 1], tundra: [0.82, 0.89, 0.81],
        alpine: [0.78, 0.85, 0.79], snow_peaks: [0.93, 0.98, 1],
        highlands: [0.74, 0.87, 0.69], rocky: [0.72, 0.82, 0.69],
        chaparral: [0.94, 0.85, 0.64], pine_barrens: [0.84, 0.89, 0.68],
        barren: [0.95, 0.79, 0.57], red_barrens: [0.99, 0.70, 0.52],
    };
    // A per-chunk palette cache: only 4x4 areas request a biome sample,
    // rather than running costly biome noise for every plant in a column.
    const pickProfile = (biome) => {
        if (biome === 'flower_meadow') return {density:.91,grass:97,flowers:[99,105,106,110],flowerRate:.11,scale:1};
        if (biome === 'meadow') return {density:.83,grass:97,flowers:[105,106,110],flowerRate:.055,scale:.96};
        if (biome === 'plains') return {density:.66,grass:97,flowers:[105,106,110],flowerRate:.035,scale:.93};
        if (wet.has(biome)) return {density:.77,grass:100,flowers:[101,102,104],flowerRate:.10,scale:1.27};
        if (forest.has(biome)) return {density:.69,grass:98,flowers:[104,107,104,99],flowerRate:.34,scale:1.13};
        if (cold.has(biome)) return {density:.34,grass:108,flowers:[104,107],flowerRate:.045,scale:.72};
        if (mountain.has(biome)) return {density:biome==='snow_peaks'?.025:.31,grass:108,flowers:[104,107],flowerRate:.12,scale:.71};
        if (dry.has(biome)) return {density:biome==='red_barrens'?.035:.18,grass:109,flowers:[109],flowerRate:0,scale:.73};
        return {density:.38,grass:97,flowers:[107,105],flowerRate:.025,scale:.85};
    };
    const rand = (x, z, salt) => S.hash2i(x, z, (S.worldSeed ^ salt) >>> 0);
    const isOpen = id => id === B.AIR || !!S.blockDefs[id]?.decor;
    const pushQuad = (mesh, cx, cy, cz, width, height, phi, tile, tint, topWind=0.78, horizontal=false) => {
        const sn=Math.sin(phi),cs=Math.cos(phi),hw=width*.5;
        const vx=cs*hw,vz=sn*hw;
        const uvs=[[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]];
        const verts=horizontal ? [
            [cx-vx-vz,cy,cz-vz+vx],[cx+vx-vz,cy,cz+vz+vx],
            [cx+vx+vz,cy,cz+vz-vx],[cx-vx-vz,cy,cz-vz+vx],
            [cx+vx+vz,cy,cz+vz-vx],[cx-vx+vz,cy,cz-vz-vx],
        ] : [
            [cx-vx,cy,cz-vz],[cx+vx,cy,cz+vz],
            [cx+vx,cy+height,cz+vz],[cx-vx,cy,cz-vz],
            [cx+vx,cy+height,cz+vz],[cx-vx,cy+height,cz-vz],
        ];
        for(let i=0;i<6;i++){
            const v=verts[i];mesh.p.push(...v);
            mesh.n.push(0,127,0); // undergrowth receives top-lit diffuse light
            const uv=S.tileUV(tile,...uvs[i]);mesh.uv.push(...uv);
            mesh.wind.push(horizontal ? 0 : i===0||i===1||i===3?0:Math.round(topWind*255));
            mesh.tint.push(tint[0],tint[1],tint[2]);
        }
    };
    S.buildChunkFlora = function buildChunkFlora(chunk) {
        const P={p:[],n:[],uv:[],wind:[],tint:[]};
        const biomes=new Map(),ox=chunk.cx*S.CHUNK,oz=chunk.cz*S.CHUNK;
        const biomeAt=(x,z)=>{
            const key=((x>>2)<<8) + (z>>2);
            if(!biomes.has(key))biomes.set(key,S.biomeAt(ox+(x&~3)+2,oz+(z&~3)+2));
            return biomes.get(key);
        };
        // Sparse, deterministic sprigs soften exposed canopy edges.
        let sprigs=0;
        for(let y=3;y<S.WORLD_H-1;y++)for(let z=0;z<S.CHUNK;z++)for(let x=0;x<S.CHUNK;x++){
            const id=chunk.data[S.idx3(x,y,z)];
            if(!S.isFoliage(id)||sprigs>=64||rand(ox+x,oz+z,y+0x3491)>.10)continue;
            const open=(dx,dz)=> {
              const xx=x+dx,zz=z+dz;
              return xx>=0&&xx<S.CHUNK&&zz>=0&&zz<S.CHUNK&&!S.isFoliage(chunk.data[S.idx3(xx,y,zz)])&&chunk.data[S.idx3(xx,y,zz)]===B.AIR;
            };
            if(!open(1,0)&&!open(-1,0)&&!open(0,1)&&!open(0,-1))continue;
            const angle=rand(ox+x,oz+z,y)*6.283;
            pushQuad(P,ox+x+.5,y+.12,oz+z+.5,.88,.68,angle,112,[175,193,157],.42);
            pushQuad(P,ox+x+.5,y+.12,oz+z+.5,.75,.61,angle+1.57,112,[175,193,157],.42);
            sprigs++;
        }
        for(let z=0;z<S.CHUNK;z++)for(let x=0;x<S.CHUNK;x++){
            const wx=ox+x,wz=oz+z, biome=biomeAt(x,z), prof=pickProfile(biome);
            // Find the *exposed* ground in the actual edited chunk. Never sprout
            // through player structures, trees, roofs, tilled village floors.
            let y=-1,ground=0,isWater=false,waterDepth=0;
            for(let v=S.WORLD_H-2;v>=1;v--){
                const id=chunk.data[S.idx3(x,v,z)];
                if(id===B.AIR || S.blockDefs[id]?.decor || S.isFoliage(id))continue;
                if(id===B.WATER){
                    if(chunk.data[S.idx3(x,v+1,z)]===B.AIR){
                        // A submerged plant needs sediment no deeper than three
                        // blocks under the surface. The root is ON that floor.
                        for(let depth=1;depth<=3;depth++){
                            const bottom=v-depth;
                            if(bottom<1)break;
                            const floor=chunk.data[S.idx3(x,bottom,z)];
                            if(floor===B.WATER)continue;
                            if(S.blockDefs[floor]?.solid && !S.isFoliage(floor)){
                                y=v+1;waterDepth=depth;isWater=true;
                            }
                            break;
                        }
                    }
                    break;
                }
                if(SOILS.has(id) && isOpen(chunk.data[S.idx3(x,v+1,z)])){
                    ground=id;y=v+1;
                }
                break;
            }
            if(y<0)continue;
            const r=rand(wx,wz,0x32091),r2=rand(wx,wz,0x32092);
            let tint=palette[biome]||palette.forest;
            const lightVar=.86 + .20*rand(wx,wz,0x32093);
            tint=tint.map(v=>Math.round(Math.min(1,Math.max(0,(.28+.72*v)*lightVar))*255));
            if(isWater){
                // Hydrophytes and lily pads are render-only: no submerged block
                // replacement, no phantom water collisions and no save changes.
                if (['frozen_shore','snow_peaks','tundra'].includes(biome))continue;
                const marshy=wet.has(biome),p=marshy?.43:.20;
                if(r>p)continue;
                const surface=y+.115;
                if(r2< (marshy?.32:.25)){
                    const tile=r2<.085?111:103;
                    const radius=.58+rand(wx,wz,0x3253)*.30;
                    // Lily pads float, but are anchored in <=3 block shallows.
                    pushQuad(P,wx+.50,surface+.023,wz+.50,radius,0,r*6.283,tile,tint,0,true);
                }else{
                    const tile=r2<.56?101:r2<.78?102:100;
                    const variation=rand(wx,wz,0x3255);
                    const height=waterDepth+.75+variation*.75;
                    // Whole plant rises from the bed, even at 3-block depth.
                    // Roots never levitate in mid-water or penetrate 4+ water.
                    const rootY=y-waterDepth+.02;
                    const px=wx+.31+.38*rand(wx,wz,0x3257);
                    const pz=wz+.31+.38*rand(wx,wz,0x3258);
                    pushQuad(P,px,rootY,pz,.49,height,r*6.28,tile,tint,.74);
                    pushQuad(P,px,rootY,pz,.48,height*.97,r*6.28+1.03,tile,tint,.68);
                    if(r2>.74 && marshy){
                        // Delicate side shoots with some submerged foliage.
                        pushQuad(P,px+.14,rootY,pz-.10,.30,height*.63,r*6.28+.68,100,tint,.52);
                    }
                }
                continue;
            }
            const region = rand(Math.floor(wx/7),Math.floor(wz/7),0x32094);
            const density=prof.density*(.65+region*.63);
            if(r>Math.min(.97,density))continue;
            if(biome==='beach' && ground!==B.GRASS&&ground!==B.FOREST_GRASS && r>.12)continue;
            const inVillage=S.villagePlan && Math.hypot(wx-S.villagePlan.x,wz-S.villagePlan.z)<48;
            const flowering=r2<prof.flowerRate*(inVillage?.22:1);
            const tile=flowering ? prof.flowers[Math.floor(rand(wx,wz,0x32095)*prof.flowers.length)] : prof.grass;
            const jx=.20+.60*rand(wx,wz,0x32096),jz=.20+.60*rand(wx,wz,0x32097);
            const scale=prof.scale*(.85+.75*rand(wx,wz,0x32098));
            const h=(flowering?.69:.64)*scale+rand(wx,wz,0x32099)*.24;
            const width=(flowering?.56:.47)*scale;
            const angle=rand(wx,wz,0x32100)*Math.PI*2;
            // Two angled alpha-cutout clumps with slight root offsets provide
            // depth/volume, not a single rigid X billboard per full-sized block.
            pushQuad(P,wx+jx,y+.018,wz+jz,width,h,angle,tile,tint,.69);
            pushQuad(P,wx+jx,y+.018,wz+jz,width*.91,h*.92,angle+1.13,tile,tint,.66);
            if(r2>.73 && !flowering && prof.density>.42){
                const tu=prof.grass===97?98:prof.grass;
                pushQuad(P,wx+.23+jx*.42,y+.015,wz+.19+jz*.39,width*.66,h*.71,angle+.67,tu,tint,.74);
            }
        }
        const sky=new Uint8Array(P.p.length/3);
        for(let i=0;i<P.p.length;i+=18){const light=Math.round(255*skyAt(S,[P.p[i]+.02,P.p[i+1]+.05,P.p[i+2]+.02]));sky.fill(light,i/3,i/3+6);}
        return P.p.length ? S.makeMeshBuffers(P.p,P.n,P.uv,P.wind,P.tint,sky) : null;
    };
    S.floraProfiles=Object.freeze({totalBiomes:Object.keys(palette).length,atlasStart:97,atlasEnd:111});
}
