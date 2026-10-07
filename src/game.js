'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    document.body.innerHTML = '<div style="padding:40px;color:white;background:#111;font-family:monospace">Ta przeglądarka nie udostępnia WebGL. Włącz akcelerację sprzętową albo użyj aktualnego Chrome/Edge/Firefox.</div>';
    return;
  }

  // ---------------------------------------------------------------------------
  // DOM / UI references
  // ---------------------------------------------------------------------------
  const UI = {
    mainMenu: $('mainMenu'), pauseMenu: $('pauseMenu'), deathMenu: $('deathMenu'), hud: $('hud'),
    inventoryPanel: $('inventoryPanel'), inventoryGrid: $('inventoryGrid'), recipeList: $('recipeList'),
    chestSection: $('chestSection'), chestGrid: $('chestGrid'), cursorStack: $('cursorStack'),
    craftGrid: $('craftGrid'), craftOutput: $('craftOutput'), craftStatus: $('craftStatus'),
    seedInput: $('seedInput'), difficultySelect: $('difficultySelect'), newGameBtn: $('newGameBtn'), continueBtn: $('continueBtn'),
    resumeBtn: $('resumeBtn'), saveBtn: $('saveBtn'), adminToggleBtn: $('adminToggleBtn'), quitBtn: $('quitBtn'), respawnBtn: $('respawnBtn'), deathQuitBtn: $('deathQuitBtn'),
    closeInventoryBtn: $('closeInventoryBtn'), sensInput: $('sensInput'), volumeInput: $('volumeInput'), renderDistanceSelect: $('renderDistanceSelect'),
    hungerBar: $('hungerBar'), staminaBar: $('staminaBar'), sanityBar: $('sanityBar'),
    hungerText: $('hungerText'), staminaText: $('staminaText'), sanityText: $('sanityText'), heartHud: $('heartHud'),
    worldClock: $('worldClock'), worldBiome: $('worldBiome'), threatInfo: $('threatInfo'), message: $('message'), hotbar: $('hotbar'), selectedLabel: $('selectedLabel'),
    debugPanel: $('debugPanel'), nightWarning: $('nightWarning'), mineProgress: $('mineProgress'),
    mineHud: $('mineHud'), mineBlockName: $('mineBlockName'), minePercent: $('minePercent'), mineBarFill: $('mineBarFill'), weatherInfo: $('weatherInfo'),
    worldMineBar: $('worldMineBar'), worldMineName: $('worldMineName'), worldMineFill: $('worldMineFill'), worldMinePct: $('worldMinePct'),
    damageFlash: $('damageFlash'), vignette: $('vignette'), deathStats: $('deathStats'), deathTitle: $('deathTitle'),
    mainHandSlot: $('mainHandSlot'), offhandSlot: $('offhandSlot'), craftSearch: $('craftSearch'), enemyHud: $('enemyHud'), enemyName: $('enemyName'), enemyHpText: $('enemyHpText'), enemyHpFill: $('enemyHpFill'),
    adminPanel: $('adminPanel'), closeAdminBtn: $('closeAdminBtn'), adminGrid: $('adminGrid'), adminBlocksTab: $('adminBlocksTab'), adminMobsTab: $('adminMobsTab'), adminSearch: $('adminSearch'),
    itemTooltip: $('itemTooltip'), minimap: $('minimap'), minimapWrap: $('minimapWrap'), minimapBiome: $('minimapBiome'), threatPulse: $('threatPulse'),
    furnacePanel: $('furnacePanel'), furnaceInput: $('furnaceInput'), furnaceFuel: $('furnaceFuel'), furnaceOutput: $('furnaceOutput'), furnaceBurnFill: $('furnaceBurnFill'), furnaceProgressFill: $('furnaceProgressFill'), furnaceStatus: $('furnaceStatus'), closeFurnaceBtn: $('closeFurnaceBtn'),
    fullMapPanel: $('fullMapPanel'), fullMap: $('fullMap'), mapStats: $('mapStats'), closeMapBtn: $('closeMapBtn'), fortifyHud: $('fortifyHud'), fortifyName: $('fortifyName'), fortifyHp: $('fortifyHp'), fortifyFill: $('fortifyFill'), fortifyNext: $('fortifyNext')
  };

  // ---------------------------------------------------------------------------
  // Tiny math library (column-major matrices compatible with WebGL)
  // ---------------------------------------------------------------------------
  const M4 = {
    identity() {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
      return new Float32Array([
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,(2*far*near)*nf,0
      ]);
    },
    multiply(a, b) {
      const o = new Float32Array(16);
      for (let c=0;c<4;c++) for (let r=0;r<4;r++) {
        o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
      }
      return o;
    },
    translation(x,y,z) {
      const m = this.identity(); m[12]=x; m[13]=y; m[14]=z; return m;
    },
    scale(x,y,z) {
      const m = this.identity(); m[0]=x; m[5]=y; m[10]=z; return m;
    },
    rotY(a) {
      const c=Math.cos(a),s=Math.sin(a);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    },
    rotX(a) {
      const c=Math.cos(a),s=Math.sin(a);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    },
    rotZ(a) {
      const c=Math.cos(a),s=Math.sin(a);
      return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    },
    lookAt(eye, target, up=[0,1,0]) {
      let zx=eye[0]-target[0], zy=eye[1]-target[1], zz=eye[2]-target[2];
      let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
      let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
      l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
      let yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      return new Float32Array([
        xx,yx,zx,0,
        xy,yy,zy,0,
        xz,yz,zz,0,
        -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
        -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
        -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
      ]);
    }
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>t*t*(3-2*t);
  const dist3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const norm3=(v)=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};

  // ---------------------------------------------------------------------------
  // Deterministic noise / hashing
  // ---------------------------------------------------------------------------
  let worldSeed = 1337;
  function hashString(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function hash2i(x,z,seed=worldSeed){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^seed;h=(h^(h>>>13));h=Math.imul(h,1274126177);return((h^(h>>>16))>>>0)/4294967295;}
  function hash3i(x,y,z,seed=worldSeed){let h=Math.imul(x|0,73856093)^Math.imul(y|0,19349663)^Math.imul(z|0,83492791)^seed;h=(h^(h>>>13));h=Math.imul(h,1274126177);return((h^(h>>>16))>>>0)/4294967295;}
  function noise2(x,z){const x0=Math.floor(x),z0=Math.floor(z),tx=smooth(x-x0),tz=smooth(z-z0);const a=hash2i(x0,z0),b=hash2i(x0+1,z0),c=hash2i(x0,z0+1),d=hash2i(x0+1,z0+1);return lerp(lerp(a,b,tx),lerp(c,d,tx),tz);}
  function fbm2(x,z){let s=0,a=.55,f=1;for(let i=0;i<4;i++){s+=noise2(x*f,z*f)*a;f*=2.03;a*=.5;}return s/1.03125;}
  function noise3(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),tx=smooth(x-X),ty=smooth(y-Y),tz=smooth(z-Z);const h=(dx,dy,dz)=>hash3i(X+dx,Y+dy,Z+dz);const x00=lerp(h(0,0,0),h(1,0,0),tx),x10=lerp(h(0,1,0),h(1,1,0),tx),x01=lerp(h(0,0,1),h(1,0,1),tx),x11=lerp(h(0,1,1),h(1,1,1),tx);return lerp(lerp(x00,x10,ty),lerp(x01,x11,ty),tz);}

  // ---------------------------------------------------------------------------
  // Blocks and item metadata
  // ---------------------------------------------------------------------------
  const B={
    AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,WOOD:5,LEAVES:6,COAL:7,IRON:8,WATER:9,PLANKS:10,TORCH:11,BEDROCK:12,MOSS:13,GRAVEL:14,MUD:15,
    DARKSTONE:16,PINEWOOD:17,PINELEAVES:18,DEADWOOD:19,SNOW:20,CLAY:21,SLATE:22,ROOTS:23,BIRCHWOOD:24,BIRCHLEAVES:25,DARKWOOD:26,DARKLEAVES:27,
    AUTUMNLEAVES:28,TALLGRASS:29,FERN:30,REEDS:31,RED_FLOWER:32,WHITE_FLOWER:33,MUSHROOM:34,ICE:35,COBBLE:36,CHEST:37,
    LOAM:38,PODZOL:39,SILT:40,PEAT:41,LIMESTONE:42,GRANITE:43,BASALT:44,MARBLE:45,WILLOWWOOD:46,WILLOWLEAVES:47,
    BLUE_FLOWER:48,YELLOW_FLOWER:49,HEATHER:50,MOSSY_DIRT:51,DRY_GRASS:52,FOREST_GRASS:53,FROST_GRASS:54,SANDSTONE:55,
    RED_SAND:56,MOSSY_STONE:57,POPLARWOOD:58,POPLARLEAVES:59,MIMOSAWOOD:60,MIMOSALEAVES:61,BUSH:62,DRY_BUSH:63,
    PUMPKIN:64,CACTUS:65,RIVER_ROCK:66,CAVE_DIRT:67,
    STONE_BRICKS:68,CRACKED_BRICKS:69,MOSSY_BRICKS:70,CHISELED_STONE:71,OLD_PLANKS:72,DARK_PLANKS:73,RUBBLE:74,ASH_BLOCK:75,
    RUNE_STONE:76,WEATHERED_BRICKS:77,OLD_TILES:78,GRAVE_STONE:79,
    GOLD:80,FURNACE:81,GLASS:82,SMOOTH_STONE:83,IRON_BLOCK:84,GOLD_BLOCK:85,WOOD_DOOR:86,WOOD_STAIRS:87,WOOD_FENCE:88
  };
  const blockDefs={
    [B.AIR]:{name:'Powietrze',solid:false,transparent:true,hard:0},
    [B.GRASS]:{name:'Mokra trawa',solid:true,hard:.62,drop:'dirt',tool:'shovel',material:'grass'},
    [B.DIRT]:{name:'Ziemia',solid:true,hard:.58,drop:'dirt',tool:'shovel',material:'dirt'},
    [B.STONE]:{name:'Kamień',solid:true,hard:1.75,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.SAND]:{name:'Ciemny piasek',solid:true,hard:.52,drop:'sand',tool:'shovel',material:'sand'},
    [B.WOOD]:{name:'Drewno dębowe',solid:true,hard:1.28,drop:'wood',tool:'axe',material:'wood'},
    [B.LEAVES]:{name:'Mokre liście',solid:true,hard:.26,drop:'leaves',transparent:true,material:'grass'},
    [B.COAL]:{name:'Ruda węgla',solid:true,hard:1.9,drop:'coal',tool:'pickaxe',material:'stone'},
    [B.IRON]:{name:'Ruda żelaza',solid:true,hard:2.25,drop:'iron',tool:'pickaxe',material:'stone'},
    [B.WATER]:{name:'Zimna woda',solid:false,liquid:true,transparent:true,hard:99,material:'water'},
    [B.PLANKS]:{name:'Surowe deski',solid:true,hard:.9,drop:'planks',tool:'axe',material:'wood'},
    [B.TORCH]:{name:'Pochodnia',solid:false,torch:true,transparent:true,hard:.15,drop:'torch',material:'wood'},
    [B.BEDROCK]:{name:'Skała macierzysta',solid:true,hard:999,material:'stone'},
    [B.MOSS]:{name:'Omszały kamień',solid:true,hard:1.55,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.GRAVEL]:{name:'Żwir',solid:true,hard:.72,drop:'gravel',tool:'shovel',material:'sand'},
    [B.MUD]:{name:'Błoto',solid:true,hard:.48,drop:'mud',tool:'shovel',material:'dirt'},
    [B.DARKSTONE]:{name:'Ciemny granit',solid:true,hard:2.05,drop:'darkstone',tool:'pickaxe',material:'stone'},
    [B.PINEWOOD]:{name:'Drewno świerkowe',solid:true,hard:1.38,drop:'pinewood',tool:'axe',material:'wood'},
    [B.PINELEAVES]:{name:'Igliwie',solid:true,hard:.28,drop:'pineleaves',transparent:true,material:'grass'},
    [B.DEADWOOD]:{name:'Martwe drewno',solid:true,hard:1.0,drop:'deadwood',tool:'axe',material:'wood'},
    [B.SNOW]:{name:'Śnieg',solid:true,hard:.4,drop:'snow',tool:'shovel',material:'snow'},
    [B.CLAY]:{name:'Glina',solid:true,hard:.75,drop:'clay',tool:'shovel',material:'dirt'},
    [B.SLATE]:{name:'Łupek',solid:true,hard:1.95,drop:'slate',tool:'pickaxe',material:'stone'},
    [B.ROOTS]:{name:'Splątane korzenie',solid:true,hard:.8,drop:'roots',tool:'axe',material:'wood'},
    [B.BIRCHWOOD]:{name:'Brzozowe drewno',solid:true,hard:1.22,drop:'birchwood',tool:'axe',material:'wood'},
    [B.BIRCHLEAVES]:{name:'Liście brzozy',solid:true,hard:.22,drop:'birchleaves',transparent:true,material:'grass'},
    [B.DARKWOOD]:{name:'Czarne drewno',solid:true,hard:1.45,drop:'darkwood',tool:'axe',material:'wood'},
    [B.DARKLEAVES]:{name:'Ciemne liście',solid:true,hard:.28,drop:'darkleaves',transparent:true,material:'grass'},
    [B.AUTUMNLEAVES]:{name:'Rdzawe liście',solid:true,hard:.24,drop:'autumnleaves',transparent:true,material:'grass'},
    [B.TALLGRASS]:{name:'Wysoka trawa',solid:false,transparent:true,decor:true,hard:.08,drop:null,material:'grass'},
    [B.FERN]:{name:'Paproć',solid:false,transparent:true,decor:true,hard:.09,drop:null,material:'grass'},
    [B.REEDS]:{name:'Trzcina',solid:false,transparent:true,decor:true,hard:.12,drop:null,material:'grass'},
    [B.RED_FLOWER]:{name:'Krwawy mak',solid:false,transparent:true,decor:true,hard:.06,drop:null,material:'grass'},
    [B.WHITE_FLOWER]:{name:'Biały kwiat',solid:false,transparent:true,decor:true,hard:.06,drop:null,material:'grass'},
    [B.MUSHROOM]:{name:'Grzyb leśny',solid:false,transparent:true,decor:true,hard:.08,drop:null,material:'grass'},
    [B.ICE]:{name:'Lód',solid:true,hard:.85,drop:'ice',transparent:true,material:'snow'},
    [B.COBBLE]:{name:'Łupany kamień',solid:true,hard:1.55,drop:'cobble',tool:'pickaxe',material:'stone'},
    [B.CHEST]:{name:'Drewniana skrzynia',solid:true,hard:1.1,drop:'chest',tool:'axe',material:'wood'},
    [B.LOAM]:{name:'Ciemna próchnica',solid:true,hard:.54,drop:'dirt',tool:'shovel',material:'dirt'},
    [B.PODZOL]:{name:'Bielicowa ziemia',solid:true,hard:.58,drop:'dirt',tool:'shovel',material:'dirt'},
    [B.SILT]:{name:'Muł rzeczny',solid:true,hard:.45,drop:'dirt',tool:'shovel',material:'sand'},
    [B.PEAT]:{name:'Torf',solid:true,hard:.46,drop:'dirt',tool:'shovel',material:'dirt'},
    [B.LIMESTONE]:{name:'Wapień',solid:true,hard:1.55,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.GRANITE]:{name:'Granit',solid:true,hard:2.05,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.BASALT]:{name:'Bazalt',solid:true,hard:2.2,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.MARBLE]:{name:'Marmur',solid:true,hard:1.85,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.WILLOWWOOD]:{name:'Drewno wierzbowe',solid:true,hard:1.18,drop:'willowwood',tool:'axe',material:'wood'},
    [B.WILLOWLEAVES]:{name:'Liście wierzby',solid:true,hard:.22,drop:'willowleaves',transparent:true,material:'grass'},
    [B.BLUE_FLOWER]:{name:'Niebieski kwiat',solid:false,transparent:true,decor:true,hard:.06,drop:null,material:'grass'},
    [B.YELLOW_FLOWER]:{name:'Żółty kwiat',solid:false,transparent:true,decor:true,hard:.06,drop:null,material:'grass'},
    [B.HEATHER]:{name:'Wrzos',solid:false,transparent:true,decor:true,hard:.08,drop:null,material:'grass'},
    [B.MOSSY_DIRT]:{name:'Omszała ziemia',solid:true,hard:.55,drop:'dirt',tool:'shovel',material:'grass'},
    [B.DRY_GRASS]:{name:'Sucha darń',solid:true,hard:.56,drop:'dirt',tool:'shovel',material:'grass'},
    [B.FOREST_GRASS]:{name:'Leśna darń',solid:true,hard:.58,drop:'dirt',tool:'shovel',material:'grass'},
    [B.FROST_GRASS]:{name:'Przymarznięta darń',solid:true,hard:.66,drop:'dirt',tool:'shovel',material:'snow'},
    [B.SANDSTONE]:{name:'Piaskowiec',solid:true,hard:1.28,drop:'sandstone',tool:'pickaxe',material:'stone'},
    [B.RED_SAND]:{name:'Rdzawy piasek',solid:true,hard:.54,drop:'redsand',tool:'shovel',material:'sand'},
    [B.MOSSY_STONE]:{name:'Kamień porośnięty mchem',solid:true,hard:1.62,drop:'stone',tool:'pickaxe',material:'stone'},
    [B.POPLARWOOD]:{name:'Drewno topolowe',solid:true,hard:1.18,drop:'poplarwood',tool:'axe',material:'wood'},
    [B.POPLARLEAVES]:{name:'Liście topoli',solid:true,hard:.21,drop:'poplarleaves',transparent:true,material:'grass'},
    [B.MIMOSAWOOD]:{name:'Drewno mimozy',solid:true,hard:1.16,drop:'mimosawood',tool:'axe',material:'wood'},
    [B.MIMOSALEAVES]:{name:'Liście mimozy',solid:true,hard:.20,drop:'mimosaleaves',transparent:true,material:'grass'},
    [B.BUSH]:{name:'Leśny krzew',solid:false,transparent:true,decor:true,hard:.10,drop:null,material:'grass'},
    [B.DRY_BUSH]:{name:'Suchy krzew',solid:false,transparent:true,decor:true,hard:.08,drop:null,material:'grass'},
    [B.PUMPKIN]:{name:'Dzika dynia',solid:true,hard:.42,drop:'pumpkin',tool:'axe',material:'wood'},
    [B.CACTUS]:{name:'Dziki kaktus',solid:true,hard:.48,drop:'cactus',material:'grass'},
    [B.RIVER_ROCK]:{name:'Kamień rzeczny',solid:true,hard:1.38,drop:'riverrock',tool:'pickaxe',material:'stone'},
    [B.CAVE_DIRT]:{name:'Zbita ziemia jaskiniowa',solid:true,hard:.72,drop:'dirt',tool:'shovel',material:'dirt'},
    [B.STONE_BRICKS]:{name:'Kamienne cegły',solid:true,hard:1.72,drop:'stone_bricks',tool:'pickaxe',material:'stone'},
    [B.CRACKED_BRICKS]:{name:'Popękane cegły',solid:true,hard:1.55,drop:'cracked_bricks',tool:'pickaxe',material:'stone'},
    [B.MOSSY_BRICKS]:{name:'Omszałe cegły',solid:true,hard:1.48,drop:'mossy_bricks',tool:'pickaxe',material:'stone'},
    [B.CHISELED_STONE]:{name:'Rzeźbiony kamień',solid:true,hard:1.86,drop:'chiseled_stone',tool:'pickaxe',material:'stone'},
    [B.OLD_PLANKS]:{name:'Stare deski',solid:true,hard:.88,drop:'old_planks',tool:'axe',material:'wood'},
    [B.DARK_PLANKS]:{name:'Ciemne deski',solid:true,hard:1.02,drop:'dark_planks',tool:'axe',material:'wood'},
    [B.RUBBLE]:{name:'Rumowisko',solid:true,hard:1.12,drop:'rubble',tool:'pickaxe',material:'stone'},
    [B.ASH_BLOCK]:{name:'Popiół',solid:true,hard:.34,drop:'ash_block',tool:'shovel',material:'sand'},
    [B.RUNE_STONE]:{name:'Kamień runiczny',solid:true,hard:2.05,drop:'rune_stone',tool:'pickaxe',material:'stone'},
    [B.WEATHERED_BRICKS]:{name:'Zwietrzałe cegły',solid:true,hard:1.62,drop:'weathered_bricks',tool:'pickaxe',material:'stone'},
    [B.OLD_TILES]:{name:'Stare dachówki',solid:true,hard:1.18,drop:'old_tiles',tool:'pickaxe',material:'stone'},
    [B.GRAVE_STONE]:{name:'Kamień nagrobny',solid:true,hard:1.65,drop:'grave_stone',tool:'pickaxe',material:'stone'},
    [B.GOLD]:{name:'Ruda złota',solid:true,hard:2.55,drop:'gold_ore',tool:'pickaxe',material:'stone'},
    [B.FURNACE]:{name:'Kamienny piec',solid:true,hard:2.2,drop:'furnace',tool:'pickaxe',material:'stone'},
    [B.GLASS]:{name:'Szkło',solid:true,hard:.45,drop:'glass',tool:null,material:'glass',transparent:true},
    [B.SMOOTH_STONE]:{name:'Przepalony kamień',solid:true,hard:2.0,drop:'smooth_stone',tool:'pickaxe',material:'stone'},
    [B.IRON_BLOCK]:{name:'Blok żelaza',solid:true,hard:3.8,drop:'iron_block',tool:'pickaxe',material:'metal'},
    [B.GOLD_BLOCK]:{name:'Blok złota',solid:true,hard:3.2,drop:'gold_block',tool:'pickaxe',material:'metal'},
    [B.WOOD_DOOR]:{name:'Drewniane drzwi',solid:true,hard:1.0,drop:'wood_door',tool:'axe',material:'wood',construction:'door'},
    [B.WOOD_STAIRS]:{name:'Drewniane schodki',solid:true,hard:.95,drop:'wood_stairs',tool:'axe',material:'wood',construction:'stairs'},
    [B.WOOD_FENCE]:{name:'Drewniane ogrodzenie',solid:true,hard:.9,drop:'wood_fence',tool:'axe',material:'wood',construction:'fence'}
  };
  const FOLIAGE_BLOCKS=new Set([B.LEAVES,B.PINELEAVES,B.BIRCHLEAVES,B.DARKLEAVES,B.AUTUMNLEAVES,B.WILLOWLEAVES,B.POPLARLEAVES,B.MIMOSALEAVES]);
  const isFoliage=(id)=>FOLIAGE_BLOCKS.has(id);
  const itemDefs={
    dirt:{name:'Ziemia',place:B.DIRT,kind:'block'}, stone:{name:'Kamień',place:B.STONE,kind:'block'}, sand:{name:'Ciemny piasek',place:B.SAND,kind:'block'},
    gravel:{name:'Żwir',place:B.GRAVEL,kind:'block'}, mud:{name:'Błoto',place:B.MUD,kind:'block'}, darkstone:{name:'Ciemny granit',place:B.DARKSTONE,kind:'block'},
    wood:{name:'Drewno dębowe',place:B.WOOD,kind:'block'}, pinewood:{name:'Drewno świerkowe',place:B.PINEWOOD,kind:'block'}, deadwood:{name:'Martwe drewno',place:B.DEADWOOD,kind:'block'},
    leaves:{name:'Mokre liście',place:B.LEAVES,kind:'block'}, pineleaves:{name:'Igliwie',place:B.PINELEAVES,kind:'block'}, snow:{name:'Śnieg',place:B.SNOW,kind:'block'}, clay:{name:'Glina',place:B.CLAY,kind:'block'},
    slate:{name:'Łupek',place:B.SLATE,kind:'block'}, roots:{name:'Korzenie',place:B.ROOTS,kind:'block'}, birchwood:{name:'Brzozowe drewno',place:B.BIRCHWOOD,kind:'block'},
    birchleaves:{name:'Liście brzozy',place:B.BIRCHLEAVES,kind:'block'}, darkwood:{name:'Czarne drewno',place:B.DARKWOOD,kind:'block'}, darkleaves:{name:'Ciemne liście',place:B.DARKLEAVES,kind:'block'},
    autumnleaves:{name:'Rdzawe liście',place:B.AUTUMNLEAVES,kind:'block'}, ice:{name:'Lód',place:B.ICE,kind:'block'}, cobble:{name:'Łupany kamień',place:B.COBBLE,kind:'block'},
    chest:{name:'Skrzynia',place:B.CHEST,kind:'block'}, loam:{name:'Ciemna próchnica',place:B.LOAM,kind:'block'}, podzol:{name:'Bielicowa ziemia',place:B.PODZOL,kind:'block'},
    silt:{name:'Muł rzeczny',place:B.SILT,kind:'block'}, peat:{name:'Torf',place:B.PEAT,kind:'block'}, limestone:{name:'Wapień',place:B.LIMESTONE,kind:'block'}, granite:{name:'Granit',place:B.GRANITE,kind:'block'},
    basalt:{name:'Bazalt',place:B.BASALT,kind:'block'}, marble:{name:'Marmur',place:B.MARBLE,kind:'block'}, willowwood:{name:'Drewno wierzbowe',place:B.WILLOWWOOD,kind:'block'}, willowleaves:{name:'Liście wierzby',place:B.WILLOWLEAVES,kind:'block'},
    mossydirt:{name:'Omszała ziemia',place:B.MOSSY_DIRT,kind:'block'}, drygrass:{name:'Sucha darń',place:B.DRY_GRASS,kind:'block'}, forestgrass:{name:'Leśna darń',place:B.FOREST_GRASS,kind:'block'}, frostgrass:{name:'Przymarznięta darń',place:B.FROST_GRASS,kind:'block'},
    sandstone:{name:'Piaskowiec',place:B.SANDSTONE,kind:'block'}, redsand:{name:'Rdzawy piasek',place:B.RED_SAND,kind:'block'}, mossystone:{name:'Kamień z mchem',place:B.MOSSY_STONE,kind:'block'},
    poplarwood:{name:'Drewno topolowe',place:B.POPLARWOOD,kind:'block'}, poplarleaves:{name:'Liście topoli',place:B.POPLARLEAVES,kind:'block'}, mimosawood:{name:'Drewno mimozy',place:B.MIMOSAWOOD,kind:'block'}, mimosaleaves:{name:'Liście mimozy',place:B.MIMOSALEAVES,kind:'block'},
    bush:{name:'Leśny krzew',place:B.BUSH,kind:'block'}, drybush:{name:'Suchy krzew',place:B.DRY_BUSH,kind:'block'}, pumpkin:{name:'Dzika dynia',place:B.PUMPKIN,kind:'block',food:18}, cactus:{name:'Dziki kaktus',place:B.CACTUS,kind:'block'}, riverrock:{name:'Kamień rzeczny',place:B.RIVER_ROCK,kind:'block'}, cavedirt:{name:'Zbita ziemia',place:B.CAVE_DIRT,kind:'block'},
    stone_bricks:{name:'Kamienne cegły',place:B.STONE_BRICKS,kind:'block'}, cracked_bricks:{name:'Popękane cegły',place:B.CRACKED_BRICKS,kind:'block'}, mossy_bricks:{name:'Omszałe cegły',place:B.MOSSY_BRICKS,kind:'block'}, chiseled_stone:{name:'Rzeźbiony kamień',place:B.CHISELED_STONE,kind:'block'},
    old_planks:{name:'Stare deski',place:B.OLD_PLANKS,kind:'block'}, dark_planks:{name:'Ciemne deski',place:B.DARK_PLANKS,kind:'block'}, rubble:{name:'Rumowisko',place:B.RUBBLE,kind:'block'}, ash_block:{name:'Popiół',place:B.ASH_BLOCK,kind:'block'},
    rune_stone:{name:'Kamień runiczny',place:B.RUNE_STONE,kind:'block'}, weathered_bricks:{name:'Zwietrzałe cegły',place:B.WEATHERED_BRICKS,kind:'block'}, old_tiles:{name:'Stare dachówki',place:B.OLD_TILES,kind:'block'}, grave_stone:{name:'Kamień nagrobny',place:B.GRAVE_STONE,kind:'block'},
    coal:{name:'Węgiel',kind:'resource'}, iron:{name:'Ruda żelaza',kind:'resource'}, gold_ore:{name:'Ruda złota',kind:'resource'}, iron_ingot:{name:'Sztabka żelaza',kind:'resource'}, gold_ingot:{name:'Sztabka złota',kind:'resource'}, stick:{name:'Drewniany kij',kind:'resource'}, planks:{name:'Surowe deski',place:B.PLANKS,kind:'block'}, torch:{name:'Pochodnia',place:B.TORCH,kind:'light'},
    furnace:{name:'Kamienny piec',place:B.FURNACE,kind:'block'}, glass:{name:'Szkło',place:B.GLASS,kind:'block'}, smooth_stone:{name:'Przepalony kamień',place:B.SMOOTH_STONE,kind:'block'}, iron_block:{name:'Blok żelaza',place:B.IRON_BLOCK,kind:'block'}, gold_block:{name:'Blok złota',place:B.GOLD_BLOCK,kind:'block'},
    wood_door:{name:'Drewniane drzwi',place:B.WOOD_DOOR,kind:'construction',maxStack:16}, wood_stairs:{name:'Drewniane schodki',place:B.WOOD_STAIRS,kind:'construction'}, wood_fence:{name:'Drewniane ogrodzenie',place:B.WOOD_FENCE,kind:'construction'},
    wood_pickaxe:{name:'Drewniany kilof',tool:'pickaxe',power:1.30,kind:'tool',tier:'wood',maxStack:1}, wood_axe:{name:'Drewniana siekiera',tool:'axe',power:1.28,damage:5,kind:'tool',tier:'wood',maxStack:1},
    wood_shovel:{name:'Drewniana łopata',tool:'shovel',power:1.42,kind:'tool',tier:'wood',maxStack:1}, wood_sword:{name:'Drewniany miecz',tool:'sword',damage:7,kind:'tool',tier:'wood',maxStack:1},
    pickaxe:{name:'Ciężki kilof',tool:'pickaxe',power:3.65,kind:'tool',tier:'iron',maxStack:1}, axe:{name:'Topór leśny',tool:'axe',power:3.25,damage:9,kind:'tool',tier:'iron',maxStack:1},
    shovel:{name:'Łopata',tool:'shovel',power:3.7,kind:'tool',tier:'iron',maxStack:1}, sword:{name:'Maczeta',tool:'sword',damage:15,kind:'tool',tier:'iron',maxStack:1},
    gold_pickaxe:{name:'Złoty kilof',tool:'pickaxe',power:4.15,kind:'tool',tier:'gold',maxStack:1}, gold_axe:{name:'Złota siekiera',tool:'axe',power:3.9,damage:10,kind:'tool',tier:'gold',maxStack:1},
    gold_shovel:{name:'Złota łopata',tool:'shovel',power:4.25,kind:'tool',tier:'gold',maxStack:1}, gold_sword:{name:'Złoty miecz',tool:'sword',damage:13,kind:'tool',tier:'gold',maxStack:1},
    rawmeat:{name:'Surowe mięso',food:21,hurt:4,kind:'food'}, cookedmeat:{name:'Pieczone mięso',food:48,heal:9,kind:'food'}, berries:{name:'Ciemne jagody',food:11,heal:1,kind:'food'},
    bandage:{name:'Bandaż',heal:27,kind:'medical'}
  };
  const blockItemById={};
  for(const [id,d] of Object.entries(itemDefs))if(d.place!==undefined)blockItemById[d.place]=id;
  const LOG_INGREDIENTS=['wood','pinewood','birchwood','darkwood','willowwood','poplarwood','mimosawood','deadwood'];
  const recipes=[
    {name:'4× Deski',out:{planks:4},pattern:['L'],key:{L:LOG_INGREDIENTS}},
    {name:'4× Kij',out:{stick:4},pattern:['P','P'],key:{P:'planks'}},
    {name:'Drewniany kilof',out:{wood_pickaxe:1},pattern:['PPP',' S ',' S '],key:{P:'planks',S:'stick'}},
    {name:'Drewniana siekiera',out:{wood_axe:1},pattern:['PP ','PS ',' S '],key:{P:'planks',S:'stick'},mirror:true},
    {name:'Drewniana łopata',out:{wood_shovel:1},pattern:['P','S','S'],key:{P:'planks',S:'stick'}},
    {name:'Drewniany miecz',out:{wood_sword:1},pattern:['P','P','S'],key:{P:'planks',S:'stick'}},
    {name:'4× Kamienne cegły',out:{stone_bricks:4},pattern:['SS','SS'],key:{S:'smooth_stone'}},
    {name:'4× Pochodnia',out:{torch:4},pattern:['C','S'],key:{C:'coal',S:'stick'}},
    {name:'Kamienny piec',out:{furnace:1},pattern:['CCC','C C','CCC'],key:{C:'cobble'}},
    {name:'Skrzynia',out:{chest:1},pattern:['PPP','P P','PPP'],key:{P:'planks'}},
    {name:'3× Drewniane drzwi',out:{wood_door:3},pattern:['PP','PP','PP'],key:{P:'planks'}},
    {name:'4× Drewniane schodki',out:{wood_stairs:4},pattern:['P  ','PP ','PPP'],key:{P:'planks'},mirror:true},
    {name:'3× Drewniane ogrodzenie',out:{wood_fence:3},pattern:['PSP','PSP'],key:{P:'planks',S:'stick'}},
    {name:'Żelazny kilof',out:{pickaxe:1},pattern:['III',' S ',' S '],key:{I:'iron_ingot',S:'stick'}},
    {name:'Żelazna siekiera',out:{axe:1},pattern:['II ','IS ',' S '],key:{I:'iron_ingot',S:'stick'},mirror:true},
    {name:'Żelazna łopata',out:{shovel:1},pattern:['I','S','S'],key:{I:'iron_ingot',S:'stick'}},
    {name:'Żelazny miecz',out:{sword:1},pattern:['I','I','S'],key:{I:'iron_ingot',S:'stick'}},
    {name:'Złoty kilof',out:{gold_pickaxe:1},pattern:['GGG',' S ',' S '],key:{G:'gold_ingot',S:'stick'}},
    {name:'Złota siekiera',out:{gold_axe:1},pattern:['GG ','GS ',' S '],key:{G:'gold_ingot',S:'stick'},mirror:true},
    {name:'Złota łopata',out:{gold_shovel:1},pattern:['G','S','S'],key:{G:'gold_ingot',S:'stick'}},
    {name:'Złoty miecz',out:{gold_sword:1},pattern:['G','G','S'],key:{G:'gold_ingot',S:'stick'}},
    {name:'Blok żelaza',out:{iron_block:1},pattern:['III','III','III'],key:{I:'iron_ingot'}},
    {name:'9× Sztabka żelaza',out:{iron_ingot:9},pattern:['B'],key:{B:'iron_block'}},
    {name:'Blok złota',out:{gold_block:1},pattern:['GGG','GGG','GGG'],key:{G:'gold_ingot'}},
    {name:'9× Sztabka złota',out:{gold_ingot:9},pattern:['B'],key:{B:'gold_block'}},
    {name:'Bandaż',out:{bandage:1},shapeless:{leaves:3,roots:1}}
  ];


  // ---------------------------------------------------------------------------
  // WebGL programs / procedural texture atlas
  // ---------------------------------------------------------------------------
  function compileShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function makeProgram(vs,fs){const p=gl.createProgram();gl.attachShader(p,compileShader(gl.VERTEX_SHADER,vs));gl.attachShader(p,compileShader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  const voxelProgram=makeProgram(`
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV;
    uniform mat4 uVP; varying vec3 vWorld; varying vec3 vNormal; varying vec2 vUV;
    void main(){vWorld=aPos;vNormal=aNormal;vUV=aUV;gl_Position=uVP*vec4(aPos,1.0);}
  `,`
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
  `);
  const colorProgram=makeProgram(`
    attribute vec3 aPos; uniform mat4 uMVP; void main(){gl_Position=uMVP*vec4(aPos,1.0);}
  `,`
    precision mediump float; uniform vec4 uColor; uniform float uFog; uniform vec3 uFogColor;
    void main(){gl_FragColor=vec4(mix(uColor.rgb,uFogColor,uFog),uColor.a);}
  `);
  const VL={
    pos:gl.getAttribLocation(voxelProgram,'aPos'),normal:gl.getAttribLocation(voxelProgram,'aNormal'),uv:gl.getAttribLocation(voxelProgram,'aUV'),
    vp:gl.getUniformLocation(voxelProgram,'uVP'),tex:gl.getUniformLocation(voxelProgram,'uTex'),cam:gl.getUniformLocation(voxelProgram,'uCam'),fogColor:gl.getUniformLocation(voxelProgram,'uFogColor'),fogNear:gl.getUniformLocation(voxelProgram,'uFogNear'),fogFar:gl.getUniformLocation(voxelProgram,'uFogFar'),day:gl.getUniformLocation(voxelProgram,'uDay'),torch:gl.getUniformLocation(voxelProgram,'uTorch'),torchPower:gl.getUniformLocation(voxelProgram,'uTorchPower'),alpha:gl.getUniformLocation(voxelProgram,'uAlpha'),time:gl.getUniformLocation(voxelProgram,'uTime'),water:gl.getUniformLocation(voxelProgram,'uWater')
  };
  const CL={pos:gl.getAttribLocation(colorProgram,'aPos'),mvp:gl.getUniformLocation(colorProgram,'uMVP'),color:gl.getUniformLocation(colorProgram,'uColor'),fog:gl.getUniformLocation(colorProgram,'uFog'),fogColor:gl.getUniformLocation(colorProgram,'uFogColor')};

  function makeAtlas(){
    const tile=24, cols=8, rows=14, c=document.createElement('canvas');c.width=tile*cols;c.height=tile*rows;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
    const rnd=(x,y,k)=>hash3i(x,y,k,7919),rgb=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
    const px=(idx,x,y,col)=>{ctx.fillStyle=`rgb(${clamp(col[0],0,255)|0},${clamp(col[1],0,255)|0},${clamp(col[2],0,255)|0})`;ctx.fillRect((idx%cols)*tile+x,Math.floor(idx/cols)*tile+y,1,1);};
    const paint=(idx,base,variance=20,fn=null)=>{const b=rgb(base);for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){let n=(rnd(x,y,idx)-.5)*variance,col=[b[0]+n,b[1]+n,b[2]+n];if(fn)col=fn(x,y,col,rnd(x+37,y-11,idx),rnd(x-19,y+23,idx));px(idx,x,y,col);}};
    const cracks=(x,y,col,n)=>{if((x*7+y*11)%37===0||((x+y)%19===0&&n>.74))return[col[0]*.5,col[1]*.5,col[2]*.5];return col;};
    paint(0,'#26371e',48,(x,y,c,n,m)=>{if(n>.78)c=[c[0]+18+18*m,c[1]+27+20*m,c[2]+7];if(n<.17)c=[c[0]*.54,c[1]*.62,c[2]*.48];if((x*11+y*7)%41===0)c=[83,73,42];return c;});
    paint(1,'#4a3422',40,(x,y,c,n,m)=>{if(y<6){const moss=.74+.26*m;c=[35+16*m,67+24*m,30+13*m];if(y===5)c=[c[0]*.82,c[1]*.76,c[2]*.70];}else{if(n>.86)c=[c[0]+18,c[1]+10,c[2]+4];if((x*5+y*7)%29===0)c=[c[0]*.62,c[1]*.58,c[2]*.52];}return c;});
    paint(2,'#493726',40,(x,y,c,n)=>n>.9?[c[0]+22,c[1]+15,c[2]+7]:c);
    paint(3,'#4b504e',46,(x,y,c,n)=>cracks(x,y,n>.9?[c[0]+34,c[1]+32,c[2]+28]:c,n));
    paint(4,'#80755b',36,(x,y,c,n,m)=>{const grain=Math.sin(x*.82+y*.17)*5;return n>.87?[c[0]+26,c[1]+23,c[2]+13]:[c[0]+grain,c[1]+grain*.8,c[2]+grain*.45];});
    paint(5,'#3a2718',40,(x,y,c,n,m)=>{const ring=Math.sin((x*.55)+Math.sin(y*.22)*1.3);if(Math.abs(ring)>.82)c=[c[0]*.57,c[1]*.55,c[2]*.50];if(n>.90)c=[c[0]+24,c[1]+14,c[2]+6];return c;});
    paint(6,'#1f3420',50,(x,y,c,n)=>{if(n>.79)c=[c[0]*.85,c[1]*1.35,c[2]*.8];if((x*3+y*5)%17===0)c=[c[0]*.48,c[1]*.6,c[2]*.45];return c;});
    paint(7,'#343735',38,(x,y,c,n)=>n>.72?[14,16,15]:cracks(x,y,c,n));
    paint(8,'#55514c',34,(x,y,c,n,m)=>n>.84?[116+20*m,72+10*m,50+6*m]:cracks(x,y,c,n));
    paint(9,'#163239',24,(x,y,c,n)=>{const w=Math.sin(x*.95+y*.33)*7+(n-.5)*8;return[c[0]+w*.2,c[1]+w*.7,c[2]+w];});
    paint(10,'#59402b',26,(x,y,c,n)=>{if(y%8===0)c=[c[0]*.52,c[1]*.5,c[2]*.48];if(x%12===0)c=[c[0]*.72,c[1]*.7,c[2]*.68];return c;});
    paint(11,'#6d4e25',22,(x,y,c,n)=>{if(x>8&&x<15&&y<8)return[208+25*n,125+30*n,42+25*n];if(x<8||x>15)c=[c[0]*.63,c[1]*.6,c[2]*.55];return c;});
    paint(12,'#202321',34,(x,y,c,n)=>cracks(x,y,c,n));
    paint(13,'#3e4940',42,(x,y,c,n)=>n>.72?[35,72,37]:cracks(x,y,c,n));
    paint(14,'#5c5a52',54,(x,y,c,n,m)=>{const q=((x*5+y*7)%9<3);return q?[c[0]+18*m,c[1]+17*m,c[2]+15*m]:[c[0]-17*n,c[1]-15*n,c[2]-13*n];});
    paint(15,'#343127',34,(x,y,c,n)=>n>.83?[c[0]+16,c[1]+12,c[2]+5]:[c[0]*.86,c[1]*.88,c[2]*.8]);
    paint(16,'#2f3436',48,(x,y,c,n)=>{if(n>.86)c=[c[0]+20,c[1]+22,c[2]+25];return cracks(x,y,c,n);});
    paint(17,'#3c2d21',30,(x,y,c,n)=>{if(x%5===0)c=[c[0]*.6,c[1]*.58,c[2]*.55];if((y+x)%17===0)c=[c[0]+22,c[1]+13,c[2]+6];return c;});
    paint(18,'#172b1d',48,(x,y,c,n)=>n>.77?[c[0]+12,c[1]+27,c[2]+10]:[c[0]*.82,c[1]*.93,c[2]*.82]);
    paint(19,'#2f251e',28,(x,y,c,n)=>{if(x%7<2)c=[c[0]*.48,c[1]*.46,c[2]*.44];return n>.92?[c[0]+20,c[1]+14,c[2]+8]:c;});
    paint(20,'#a7aaa3',35,(x,y,c,n)=>{if(n>.89)c=[c[0]+28,c[1]+28,c[2]+28];if(n<.12)c=[c[0]-35,c[1]-32,c[2]-28];return c;});
    paint(21,'#6a6258',28,(x,y,c,n)=>n>.9?[c[0]+15,c[1]+10,c[2]+8]:c);
    paint(22,'#384044',34,(x,y,c,n)=>((x+y*3)%11===0)?[c[0]*.55,c[1]*.57,c[2]*.6]:cracks(x,y,c,n));
    paint(23,'#3c2d1f',42,(x,y,c,n)=>((x*2+y)%7<2)?[c[0]*.55,c[1]*.5,c[2]*.42]:c);
    paint(24,'#26322b',44,(x,y,c,n)=>n>.82?[c[0]+18,c[1]+22,c[2]+13]:c);
    paint(25,'#202a21',44,(x,y,c,n)=>n>.86?[c[0]+8,c[1]+25,c[2]+9]:c);
    paint(26,'#47392e',32,(x,y,c,n)=>((x+y)%8<2)?[c[0]*.72,c[1]*.68,c[2]*.63]:c);
    paint(27,'#252a2b',30,(x,y,c,n)=>n>.86?[c[0]+25,c[1]+23,c[2]+20]:c);
    paint(28,'#4b4b45',42,(x,y,c,n)=>n>.9?[c[0]+25,c[1]+25,c[2]+20]:c);
    paint(29,'#2d221a',40,(x,y,c,n)=>((x*7+y*3)%13<3)?[c[0]*.55,c[1]*.48,c[2]*.42]:c);
    paint(30,'#5a584f',32,(x,y,c,n)=>n>.87?[c[0]+15,c[1]+14,c[2]+12]:c);
    paint(31,'#151c18',28,(x,y,c,n)=>n>.86?[c[0]+12,c[1]+18,c[2]+11]:c);
    paint(32,'#334b2e',46,(x,y,c,n)=>{if((x+y)%7<2)c=[c[0]*.55,c[1]*.72,c[2]*.5];if(n>.83)c=[c[0]+12,c[1]+30,c[2]+10];return c;});
    paint(33,'#e8e1d4',34,(x,y,c,n)=>{if((x<5||x>18)&&n>.45)c=[36,34,30];if((x+y)%11===0)c=[45,43,39];return c;});
    paint(34,'#32261d',32,(x,y,c,n)=>{if(x%5===0)c=[c[0]*.48,c[1]*.46,c[2]*.44];return c;});
    paint(35,'#16281a',42,(x,y,c,n)=>n>.78?[c[0]+10,c[1]+23,c[2]+9]:[c[0]*.82,c[1]*.9,c[2]*.82]);
    paint(36,'#70452f',52,(x,y,c,n)=>n>.78?[c[0]+28,c[1]+13,c[2]-2]:[c[0]*.78,c[1]*.72,c[2]*.66]);
    paint(37,'#31522d',58,(x,y,c,n)=>{if((x+y*2)%9<3)c=[c[0]*.56,c[1]*.74,c[2]*.55];return c;});
    paint(38,'#49663d',48,(x,y,c,n)=>n>.75?[c[0]+10,c[1]+30,c[2]+8]:c);
    paint(39,'#315f3e',40,(x,y,c,n)=>((x*3+y)%8<2)?[c[0]*.6,c[1]*.75,c[2]*.62]:c);
    paint(40,'#7d1c24',42,(x,y,c,n)=>{if((x-12)*(x-12)+(y-10)*(y-10)<28)return[140+50*n,24+18*n,30+15*n];return[31,55,33];});
    paint(41,'#d7d6c8',34,(x,y,c,n)=>{if((x-12)*(x-12)+(y-10)*(y-10)<26)return[205+35*n,205+35*n,194+30*n];return[31,55,33];});
    paint(42,'#62422b',44,(x,y,c,n)=>{if(y<11&&Math.abs(x-12)<8)return[92+35*n,52+18*n,31+12*n];return[38,53,34];});
    paint(43,'#91a9ad',36,(x,y,c,n)=>{const w=Math.sin((x+y)*.75)*11;return[c[0]+w*.3,c[1]+w*.55,c[2]+w*.7];});
    paint(44,'#555853',54,(x,y,c,n)=>cracks(x,y,n>.86?[c[0]+28,c[1]+28,c[2]+25]:c,n));
    paint(45,'#5a3c21',32,(x,y,c,n)=>{if(y<4||y>19||x<3||x>20)c=[c[0]*.58,c[1]*.54,c[2]*.48];if(y===11||x===11)c=[c[0]*.72,c[1]*.62,c[2]*.45];if(x>15&&x<19&&y>9&&y<14)return[112,88,43];return c;});
    paint(46,'#49382a',38,(x,y,c,n)=>{if(n>.86)c=[c[0]+20,c[1]+14,c[2]+8];if((x+y)%17===0)c=[c[0]*.62,c[1]*.58,c[2]*.52];return c;});
    paint(47,'#403323',42,(x,y,c,n)=>{if(y<5)c=[c[0]*.7,c[1]*.82,c[2]*.54];if(n>.9)c=[c[0]+16,c[1]+11,c[2]+5];return c;});
    paint(48,'#5e5849',34,(x,y,c,n)=>n>.86?[c[0]+18,c[1]+17,c[2]+12]:c);
    paint(49,'#2f2b24',35,(x,y,c,n)=>{if(n>.84)c=[c[0]+14,c[1]+11,c[2]+6];if((x*5+y*7)%31===0)c=[c[0]*.55,c[1]*.52,c[2]*.48];return c;});
    paint(50,'#77766a',42,(x,y,c,n)=>cracks(x,y,n>.87?[c[0]+24,c[1]+23,c[2]+18]:c,n));
    paint(51,'#61554f',48,(x,y,c,n)=>{if(n>.82)c=[c[0]+28,c[1]+20,c[2]+20];return cracks(x,y,c,n);});
    paint(52,'#272b2c',34,(x,y,c,n)=>{if((x+y*2)%13===0)c=[c[0]*.55,c[1]*.58,c[2]*.6];if(n>.9)c=[c[0]+18,c[1]+19,c[2]+20];return c;});
    paint(53,'#a7a59d',40,(x,y,c,n)=>{if((x*3+y*5)%23===0)c=[c[0]*.58,c[1]*.58,c[2]*.6];if(n>.91)c=[c[0]+26,c[1]+25,c[2]+24];return c;});
    paint(54,'#4b3525',36,(x,y,c,n)=>{if(x%5<2)c=[c[0]*.58,c[1]*.55,c[2]*.5];if(n>.9)c=[c[0]+20,c[1]+13,c[2]+6];return c;});
    paint(55,'#2a472b',52,(x,y,c,n)=>n>.79?[c[0]+12,c[1]+29,c[2]+10]:[c[0]*.8,c[1]*.91,c[2]*.78]);
    paint(56,'#5b71b7',46,(x,y,c,n)=>{if((x-12)*(x-12)+(y-9)*(y-9)<27)return[78+30*n,98+35*n,176+45*n];return[30,57,34];});
    paint(57,'#d3ac3c',42,(x,y,c,n)=>{if((x-12)*(x-12)+(y-9)*(y-9)<27)return[184+45*n,143+38*n,38+18*n];return[30,57,34];});
    paint(58,'#795f87',42,(x,y,c,n)=>{if(y<15&&Math.abs(x-12)<7&&((x+y)%3<2))return[100+35*n,73+28*n,116+42*n];return[31,55,33];});
    paint(59,'#35402c',44,(x,y,c,n)=>{if(y<6)c=[c[0]*.72,c[1]*1.14,c[2]*.66];if(n>.86)c=[c[0]+17,c[1]+21,c[2]+8];return c;});
    paint(60,'#77704f',38,(x,y,c,n)=>{if(y<6)c=[c[0]*.72,c[1]*1.05,c[2]*.55];if(n>.88)c=[c[0]+22,c[1]+19,c[2]+9];return c;});
    paint(61,'#244427',48,(x,y,c,n)=>{if(y<6)c=[c[0]*.62,c[1]*1.22,c[2]*.65];if(n>.84)c=[c[0]+14,c[1]+29,c[2]+13];return c;});
    paint(62,'#6e765f',34,(x,y,c,n)=>{if(y<7)c=[c[0]*.85,c[1]*1.08,c[2]*.95];if(n>.90)c=[c[0]+24,c[1]+26,c[2]+22];return c;});
    paint(63,'#8a7654',32,(x,y,c,n)=>{if((x*5+y*3)%17===0)c=[c[0]*.72,c[1]*.68,c[2]*.61];return c;});
    paint(64,'#915f47',33,(x,y,c,n)=>n>.87?[c[0]+20,c[1]+10,c[2]+5]:c);
    paint(65,'#3d4b3b',45,(x,y,c,n)=>{if(n>.78)c=[c[0]*.72,c[1]*1.28,c[2]*.72];return cracks(x,y,c,n);});
    paint(66,'#d8d2bd',29,(x,y,c,n)=>{if(x%6<2)c=[c[0]*.68,c[1]*.66,c[2]*.59];if(n>.91)c=[c[0]+13,c[1]+12,c[2]+9];return c;});
    paint(67,'#263c2a',50,(x,y,c,n)=>n>.77?[c[0]+9,c[1]+28,c[2]+10]:[c[0]*.76,c[1]*.92,c[2]*.77]);
    paint(68,'#4a3020',32,(x,y,c,n)=>{if(x%7<2)c=[c[0]*.62,c[1]*.60,c[2]*.57];return c;});
    paint(69,'#6e8569',44,(x,y,c,n)=>n>.77?[c[0]+19,c[1]+30,c[2]+15]:[c[0]*.84,c[1]*.94,c[2]*.82]);
    paint(70,'#28482a',56,(x,y,c,n)=>{if(y<16&&Math.abs(x-12)<9&&n>.24)return[c[0]+5,c[1]+22,c[2]+5];return[25,45,26];});
    paint(71,'#715c39',42,(x,y,c,n)=>{if(y<16&&Math.abs(x-12)<9&&n>.35)return[c[0]+12,c[1]+7,c[2]-3];return[39,38,27];});
    paint(72,'#9d5a17',35,(x,y,c,n)=>{if(x%6<2)c=[c[0]*.78,c[1]*.72,c[2]*.62];if(y<5)c=[54,72,28];return c;});
    paint(73,'#315d30',39,(x,y,c,n)=>{if(x%5===0)c=[c[0]*.7,c[1]*.85,c[2]*.68];if(n>.93)c=[c[0]+20,c[1]+25,c[2]+12];return c;});
    paint(74,'#60635d',44,(x,y,c,n)=>cracks(x,y,n>.88?[c[0]+26,c[1]+27,c[2]+24]:c,n));
    paint(75,'#3f3326',36,(x,y,c,n)=>n>.88?[c[0]+18,c[1]+12,c[2]+7]:c);
    paint(76,'#5a5b55',38,(x,y,c,n)=>{if(y%8<2||x%12<2)c=[c[0]*.48,c[1]*.49,c[2]*.47];if(n>.91)c=[c[0]+21,c[1]+21,c[2]+18];return c;});
    paint(77,'#4b4b46',42,(x,y,c,n)=>{if(y%8<2||x%12<2)c=[c[0]*.42,c[1]*.43,c[2]*.42];if((x*7+y*11)%37<3)c=[c[0]*.48,c[1]*.48,c[2]*.46];return c;});
    paint(78,'#46513f',44,(x,y,c,n)=>{if(y%8<2||x%12<2)c=[c[0]*.46,c[1]*.47,c[2]*.44];if(n>.72)c=[c[0]*.72,c[1]*1.18,c[2]*.70];return c;});
    paint(79,'#66665d',34,(x,y,c,n)=>{const cross=(Math.abs(x-12)<2||Math.abs(y-12)<2);if(cross)c=[c[0]*.55,c[1]*.55,c[2]*.52];if(n>.9)c=[c[0]+18,c[1]+17,c[2]+14];return c;});
    paint(80,'#4b3825',31,(x,y,c,n)=>{if(y%7<2)c=[c[0]*.48,c[1]*.44,c[2]*.39];if((x*3+y*5)%29<2)c=[c[0]+17,c[1]+9,c[2]+4];return c;});
    paint(81,'#2e261e',34,(x,y,c,n)=>{if(y%7<2)c=[c[0]*.43,c[1]*.42,c[2]*.39];if(n>.9)c=[c[0]+14,c[1]+10,c[2]+6];return c;});
    paint(82,'#55534c',56,(x,y,c,n)=>{if(n>.72)c=[c[0]+16,c[1]+15,c[2]+12];if((x*5+y*3)%11<4)c=[c[0]*.68,c[1]*.66,c[2]*.62];return c;});
    paint(83,'#38352f',52,(x,y,c,n)=>{if(n>.82)c=[c[0]+18,c[1]+15,c[2]+11];if((x+y)%9<3)c=[c[0]*.69,c[1]*.66,c[2]*.61];return c;});
    paint(84,'#4a4b45',40,(x,y,c,n)=>{const rune=Math.abs(x-12)<2||(y>6&&y<18&&Math.abs(x-(y-2))<2)||(y>7&&y<18&&Math.abs(x-(25-y))<2);if(rune)return[79,94,78];return n>.9?[c[0]+18,c[1]+18,c[2]+16]:c;});
    paint(85,'#676057',39,(x,y,c,n)=>{if(y%8<2||((x+6*(Math.floor(y/8)%2))%12)<2)c=[c[0]*.50,c[1]*.49,c[2]*.46];if(n>.9)c=[c[0]+18,c[1]+15,c[2]+12];return c;});
    paint(86,'#5a4033',35,(x,y,c,n)=>{if((x+y)%12<3)c=[c[0]*.53,c[1]*.50,c[2]*.47];if(n>.88)c=[c[0]+18,c[1]+10,c[2]+7];return c;});
    paint(87,'#565650',36,(x,y,c,n)=>{if(x<5||x>18)c=[c[0]*.64,c[1]*.64,c[2]*.61];if(y<6)c=[c[0]*.76,c[1]*.77,c[2]*.72];if(n>.9)c=[c[0]+15,c[1]+15,c[2]+13];return c;});
    paint(88,'#5b5348',36,(x,y,c,n)=>n>.83?[154+28*n,117+18*n,42+8*n]:cracks(x,y,c,n));
    paint(89,'#4b4d49',30,(x,y,c,n)=>{if(y%8<2||x%8<2)c=[c[0]*.54,c[1]*.54,c[2]*.52];if(x>8&&x<15&&y>8&&y<15)c=[25,20,17];return c;});
    paint(90,'#8fa3a0',22,(x,y,c,n)=>{if((x+y)%9<2)return[181,202,198];return[c[0]+8*n,c[1]+11*n,c[2]+13*n];});
    paint(91,'#777b76',34,(x,y,c,n)=>{if((x*7+y*5)%31<2)c=[c[0]*.68,c[1]*.68,c[2]*.66];return c;});
    paint(92,'#656967',27,(x,y,c,n)=>{if(x%6<2||y%6<2)c=[c[0]*.72,c[1]*.72,c[2]*.70];if(n>.9)c=[c[0]+24,c[1]+24,c[2]+24];return c;});
    paint(93,'#a38230',30,(x,y,c,n)=>{if(x%6<2||y%6<2)c=[c[0]*.72,c[1]*.67,c[2]*.43];if(n>.9)c=[c[0]+28,c[1]+23,c[2]+8];return c;});
    paint(94,'#5a3e27',30,(x,y,c,n)=>{if(x<3||x>20||y<3||y>20)c=[c[0]*.52,c[1]*.48,c[2]*.42];if(x>10&&x<14&&y>9&&y<14)return[128,101,50];return c;});
    paint(95,'#6b4b2f',28,(x,y,c,n)=>{if(y%6<2)c=[c[0]*.52,c[1]*.48,c[2]*.43];return c;});
    paint(96,'#594028',29,(x,y,c,n)=>{if(x%7<2)c=[c[0]*.5,c[1]*.46,c[2]*.42];if(y%9<2)c=[c[0]*.72,c[1]*.66,c[2]*.58];return c;});
    const alphaMask=(idx,pred)=>{const sx=(idx%cols)*tile,sy=Math.floor(idx/cols)*tile,img=ctx.getImageData(sx,sy,tile,tile),d=img.data;for(let y=0;y<tile;y++)for(let x=0;x<tile;x++)if(!pred(x,y)){d[(y*tile+x)*4+3]=0;}ctx.putImageData(img,sx,sy);};
    alphaMask(37,(x,y)=>y>7&&(Math.abs(x-5-(23-y)*.17)<1.8||Math.abs(x-11+(23-y)*.11)<2||Math.abs(x-17-(23-y)*.12)<1.8||Math.abs(x-21+(23-y)*.2)<1.4));
    alphaMask(38,(x,y)=>y>5&&(Math.abs(x-12)<1.8||Math.abs(x-(12+(18-y)*.58))<2.2||Math.abs(x-(12-(18-y)*.58))<2.2||((y%5)<2&&Math.abs(x-12)<7)));
    alphaMask(39,(x,y)=>y>2&&(Math.abs(x-5)<2||Math.abs(x-11)<2||Math.abs(x-17)<2||Math.abs(x-21)<1.5));
    alphaMask(40,(x,y)=>((x-12)*(x-12)+(y-9)*(y-9)<30)||(y>9&&Math.abs(x-12)<1.7));
    alphaMask(41,(x,y)=>((x-12)*(x-12)+(y-9)*(y-9)<29)||(y>9&&Math.abs(x-12)<1.7));
    alphaMask(42,(x,y)=>(y>9&&y<14&&Math.abs(x-12)<7)||(y>=14&&Math.abs(x-12)<2));
    alphaMask(56,(x,y)=>((x-12)*(x-12)+(y-9)*(y-9)<30)||(y>9&&Math.abs(x-12)<1.7));
    alphaMask(57,(x,y)=>((x-12)*(x-12)+(y-9)*(y-9)<30)||(y>9&&Math.abs(x-12)<1.7));
    alphaMask(58,(x,y)=>y>4&&(Math.abs(x-8)<2||Math.abs(x-12)<2||Math.abs(x-16)<2||((y%4)<2&&Math.abs(x-12)<7)));
    alphaMask(70,(x,y)=>y>6&&(((x-12)*(x-12)+(y-11)*(y-11)<76)||Math.abs(x-12)<2));
    alphaMask(71,(x,y)=>y>7&&(Math.abs(x-7)<2||Math.abs(x-12)<2||Math.abs(x-17)<2||((y%5)<2&&Math.abs(x-12)<8)));
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return{tex,tile,cols,rows,canvas:c};
  }
  const atlas=makeAtlas();
  const blockTile={
    [B.GRASS]:{top:0,side:1,bottom:2},[B.DIRT]:2,[B.STONE]:3,[B.SAND]:4,[B.WOOD]:5,[B.LEAVES]:6,[B.COAL]:7,[B.IRON]:8,[B.WATER]:9,[B.PLANKS]:10,[B.TORCH]:11,[B.BEDROCK]:12,[B.MOSS]:13,
    [B.GRAVEL]:14,[B.MUD]:15,[B.DARKSTONE]:16,[B.PINEWOOD]:17,[B.PINELEAVES]:18,[B.DEADWOOD]:19,[B.SNOW]:20,[B.CLAY]:21,[B.SLATE]:22,[B.ROOTS]:23,
    [B.BIRCHWOOD]:33,[B.BIRCHLEAVES]:32,[B.DARKWOOD]:34,[B.DARKLEAVES]:35,[B.AUTUMNLEAVES]:36,[B.TALLGRASS]:37,[B.FERN]:38,[B.REEDS]:39,
    [B.RED_FLOWER]:40,[B.WHITE_FLOWER]:41,[B.MUSHROOM]:42,[B.ICE]:43,[B.COBBLE]:44,[B.CHEST]:45,[B.LOAM]:46,[B.PODZOL]:47,[B.SILT]:48,[B.PEAT]:49,
    [B.LIMESTONE]:50,[B.GRANITE]:51,[B.BASALT]:52,[B.MARBLE]:53,[B.WILLOWWOOD]:54,[B.WILLOWLEAVES]:55,[B.BLUE_FLOWER]:56,[B.YELLOW_FLOWER]:57,[B.HEATHER]:58,[B.MOSSY_DIRT]:59,
    [B.DRY_GRASS]:{top:60,side:2,bottom:2},[B.FOREST_GRASS]:{top:61,side:1,bottom:2},[B.FROST_GRASS]:{top:62,side:2,bottom:2},[B.SANDSTONE]:63,[B.RED_SAND]:64,[B.MOSSY_STONE]:65,
    [B.POPLARWOOD]:66,[B.POPLARLEAVES]:67,[B.MIMOSAWOOD]:68,[B.MIMOSALEAVES]:69,[B.BUSH]:70,[B.DRY_BUSH]:71,[B.PUMPKIN]:72,[B.CACTUS]:73,[B.RIVER_ROCK]:74,[B.CAVE_DIRT]:75,
    [B.STONE_BRICKS]:76,[B.CRACKED_BRICKS]:77,[B.MOSSY_BRICKS]:78,[B.CHISELED_STONE]:79,[B.OLD_PLANKS]:80,[B.DARK_PLANKS]:81,[B.RUBBLE]:82,[B.ASH_BLOCK]:83,[B.RUNE_STONE]:84,[B.WEATHERED_BRICKS]:85,[B.OLD_TILES]:86,[B.GRAVE_STONE]:87,
    [B.GOLD]:88,[B.FURNACE]:89,[B.GLASS]:90,[B.SMOOTH_STONE]:91,[B.IRON_BLOCK]:92,[B.GOLD_BLOCK]:93,[B.WOOD_DOOR]:94,[B.WOOD_STAIRS]:95,[B.WOOD_FENCE]:96
  };

  // ---------------------------------------------------------------------------
  // Chunked voxel world
  // ---------------------------------------------------------------------------
  const CHUNK=16, WORLD_H=96, SEA=22;
  const chunks=new Map();
  const edits=new Map();
  const dirtyChunks=new Set();
  const fortifications=new Map();
  const furnaces=new Map();
  let worldSpawn=null;
  let renderDistance=4;
  const chunkKey=(cx,cz)=>`${cx},${cz}`;
  const editKey=(x,y,z)=>`${x},${y},${z}`;
  const floorDiv=(n,d)=>Math.floor(n/d);
  const mod=(n,d)=>((n%d)+d)%d;
  const idx3=(lx,y,lz)=>y*CHUNK*CHUNK+lz*CHUNK+lx;

  function warpedTerrainXZ(wx,wz){
    // Domain warp keeps ridges, rivers and biome borders from following obvious
    // noise-grid directions. Seed affects every lookup through hash/noise.
    const warpX=(fbm2(wx*.00115+311,wz*.00115-183)-.5)*230;
    const warpZ=(fbm2(wx*.00115-147,wz*.00115+269)-.5)*230;
    return [wx+warpX,wz+warpZ];
  }
  function terrainHeight(wx,wz){
    // V6 terrain: macro continents + ridged mountain chains + broad valleys,
    // river erosion, cliff shelves and local relief. The fields are intentionally
    // sampled at very different scales so a seed has landmarks rather than a
    // uniform rolling Roblox-like surface.
    const [x,z]=warpedTerrainXZ(wx,wz);
    const continent=fbm2(x*.00155-121,z*.00155+88);
    const region=fbm2(x*.0030+31,z*.0030-42);
    const rolling=fbm2(x*.0082,z*.0082);
    const local=fbm2(x*.021+17,z*.021-13);
    const micro=fbm2(x*.051-91,z*.051+44);
    const ridge0=Math.abs(fbm2(x*.00465-49,z*.00465+39)-.5)*2;
    const ridge1=Math.abs(fbm2(x*.0092+219,z*.0092-177)-.5)*2;
    const ridge=Math.pow(clamp(1-ridge0,0,1),2.35)*.72+Math.pow(clamp(1-ridge1,0,1),2.8)*.28;
    const mountainMask=clamp((continent-.43)*3.8,0,1)*clamp((region-.34)*2.1,0,1);
    const highlandMask=clamp((region-.52)*3.3,0,1);
    const valley=fbm2(x*.00215+214,z*.00215-151);
    const river=Math.abs(fbm2(x*.00135+487,z*.00135-373)-.5)*2;
    const tributary=Math.abs(fbm2(x*.00315-222,z*.00315+333)-.5)*2;
    const riverCut=clamp((.092-river)*115,0,15.5)+clamp((.040-tributary)*120,0,5.2);
    const basin=fbm2(x*.00082-903,z*.00082+711);
    const basinCut=clamp((.265-basin)*38,0,12)*clamp((.61-continent)*4.2,0,1);
    const rugged=clamp(ridge*mountainMask*1.8+highlandMask*.45,0,1);
    const relief=(rolling-.5)*(8+13*rugged)+(local-.5)*(4+10*rugged)+(micro-.5)*(1.5+3.4*rugged);
    const mountains=ridge*mountainMask*(34+region*24);
    const broad=13+continent*23+region*8;
    // cliff shelves only in rugged country: stepped rock faces like old voxel survivals.
    const shelfRaw=fbm2(x*.0061+61,z*.0061+91);
    const shelf=(Math.floor(shelfRaw*7)/7-.5)*(rugged*7.5);
    const ravineField=Math.abs(fbm2(x*.0052+812,z*.0052-659)-.5)*2;
    const ravine=clamp((.030-ravineField)*170,0,5.2)*clamp((local-.42)*4,0,1);
    let h=broad+relief+mountains+shelf-riverCut-basinCut-ravine-Math.max(0,.34-valley)*8.5;
    // Preserve beaches/low wetlands while allowing true high peaks.
    return clamp(Math.floor(h),5,WORLD_H-7);
  }
  function biomeAt(wx,wz,hKnown=null){
    const [x,z]=warpedTerrainXZ(wx,wz);
    const moisture=fbm2(x*.0035+101,z*.0035-83);
    const temp=fbm2(x*.0028-271,z*.0028+221);
    const weird=fbm2(x*.0063+703,z*.0063-513);
    const forestNoise=fbm2(x*.0105+133,z*.0105-211);
    const river=Math.abs(fbm2(x*.00185+487,z*.00185-373)-.5)*2;
    const h=hKnown==null?terrainHeight(wx,wz):hKnown;
    if(h<=SEA-2)return temp<.30?'frozen_shore':'beach';
    if(h<=SEA+1&&moisture>.68)return river<.12?'riverlands':'wet_shore';
    if(h>78)return temp<.60?'snow_peaks':'alpine';
    if(h>62)return moisture>.49?'mountain_forest':'highlands';
    if(h>50&&moisture<.40)return'rocky';
    if(moisture>.82&&h<SEA+10)return weird>.50?'willow_swamp':'marsh';
    if(moisture>.72&&h<SEA+14)return'swamp';
    if(temp<.22)return'tundra';
    if(temp<.35)return moisture>.58?'spruce_valley':moisture>.45?'taiga':'cold_plains';
    if(temp>.78&&moisture<.25)return'red_barrens';
    if(temp>.68&&moisture<.36)return'chaparral';
    if(moisture>.75&&weird>.60)return'mist_forest';
    if(moisture>.69&&forestNoise>.59)return'old_growth';
    if(moisture>.63&&weird>.55)return'darkwood';
    if(moisture>.59)return'forest';
    if(moisture>.53&&weird>.63)return'poplar_grove';
    if(moisture>.50&&weird>.52)return'birch';
    if(moisture>.48&&weird<.34)return'flower_meadow';
    if(moisture>.43)return'meadow';
    if(weird<.23)return'autumn';
    if(moisture<.24)return'barren';
    if(moisture<.31&&forestNoise>.56)return'pine_barrens';
    return'plains';
  }
  function surfaceBlockFor(biome,wx=0,wz=0){
    if(biome==='beach')return hash2i(wx,wz,0x505)>.82?B.SILT:B.SAND;
    if(biome==='red_barrens')return hash2i(wx,wz,0x506)>.32?B.RED_SAND:B.DRY_GRASS;
    if(biome==='chaparral'||biome==='barren'||biome==='pine_barrens')return hash2i(wx,wz,0x507)>.52?B.DRY_GRASS:B.GRAVEL;
    if(biome==='wet_shore'||biome==='riverlands')return hash2i(wx,wz,0x508)>.56?B.SILT:B.FOREST_GRASS;
    if(biome==='frozen_shore')return B.SNOW;
    if(['willow_swamp','swamp','marsh'].includes(biome))return hash2i(wx,wz,0x607)>.62?B.PEAT:B.MUD;
    if(['tundra','snow_peaks'].includes(biome))return B.SNOW;
    if(['taiga','spruce_valley'].includes(biome))return hash2i(wx,wz,0x719)>.42?B.FROST_GRASS:B.PODZOL;
    if(['highlands','rocky','alpine'].includes(biome))return hash2i(wx,wz,0x811)>.61?B.SLATE:B.RIVER_ROCK;
    if(['darkwood','old_growth','mist_forest'].includes(biome))return hash2i(wx,wz,0x912)>.42?B.MOSSY_DIRT:B.FOREST_GRASS;
    if(['forest','birch','poplar_grove','autumn'].includes(biome))return hash2i(wx,wz,0xa13)>.58?B.LOAM:B.FOREST_GRASS;
    return B.GRASS;
  }
  function underBlockFor(biome,wx=0,wz=0){
    if(biome==='beach'||biome==='red_barrens')return biome==='beach'?B.SAND:B.RED_SAND;
    if(biome==='wet_shore'||biome==='riverlands')return B.SILT;
    if(['willow_swamp','swamp','marsh'].includes(biome))return hash2i(wx,wz,0xb19)>.70?B.PEAT:B.MUD;
    if(['tundra','snow_peaks','frozen_shore','taiga','spruce_valley'].includes(biome))return B.DIRT;
    if(['highlands','rocky','alpine'].includes(biome))return B.SLATE;
    if(['barren','chaparral','pine_barrens'].includes(biome))return B.GRAVEL;
    if(['darkwood','old_growth','mist_forest'].includes(biome))return B.PODZOL;
    if(['forest','birch','poplar_grove','autumn'].includes(biome))return B.LOAM;
    return B.DIRT;
  }
  function caveMouthDepth(wx,wz,h){
    // Sparse surface mouths that widen toward the middle of a 52×52 cell.
    // They expose the underground cave noise and make caves discoverable from
    // the surface instead of being sealed below three blocks of soil.
    const cell=52,cx=floorDiv(wx,cell),cz=floorDiv(wz,cell);
    if(hash2i(cx,cz,worldSeed^0xcafe)<.68)return 0;
    const px=cx*cell+8+Math.floor(hash2i(cx,cz,worldSeed^0x91a2)*(cell-16));
    const pz=cz*cell+8+Math.floor(hash2i(cx,cz,worldSeed^0x72f1)*(cell-16));
    const dx=wx-px,dz=wz-pz,rx=3.0+hash2i(cx,cz,0x123)*3.2,rz=2.5+hash2i(cx,cz,0x456)*2.8;
    const d=(dx*dx)/(rx*rx)+(dz*dz)/(rz*rz);if(d>=1||h<=SEA+3)return 0;
    return 3+Math.floor((1-d)*9);
  }
  function mineshaftInfo(wx,wz){
    const cell=64,cx=floorDiv(wx,cell),cz=floorDiv(wz,cell);
    const centerX=cx*cell+16+Math.floor(hash2i(cx,cz,worldSeed^0x6a11)*32);
    const centerZ=cz*cell+16+Math.floor(hash2i(cx,cz,worldSeed^0x27b4)*32);
    const y=7+Math.floor(hash2i(cx,cz,worldSeed^0x9e71)*18);
    const enabled=hash2i(cx,cz,worldSeed^0x55f0)>.47;
    return{centerX,centerZ,y,enabled};
  }
  function mineshaftCell(wx,y,wz){
    const m=mineshaftInfo(wx,wz);if(!m.enabled)return 0;
    const dx=wx-m.centerX,dz=wz-m.centerZ,dy=y-m.y;
    const corridorX=Math.abs(dz)<=1&&Math.abs(dx)<=27&&dy>=0&&dy<=3;
    const corridorZ=Math.abs(dx)<=1&&Math.abs(dz)<=27&&dy>=0&&dy<=3;
    const room=Math.abs(dx)<=5&&Math.abs(dz)<=5&&dy>=0&&dy<=4;
    if(!(corridorX||corridorZ||room))return 0;
    // 1 air, 2 support beam. Supports appear periodically and make the tunnels
    // read as old mine shafts instead of natural caves.
    const supportLine=(Math.abs(dx)%7===0&&corridorX)||(Math.abs(dz)%7===0&&corridorZ);
    if(supportLine&&dy===3)return 2;
    if(supportLine&&dy<=2&&((corridorX&&Math.abs(dz)===1)||(corridorZ&&Math.abs(dx)===1)))return 2;
    return 1;
  }
  function caveIsOpen(wx,y,wz,h){
    if(y<=3||y>=h-3)return false;
    const c1=noise3(wx*.082,y*.105,wz*.082);
    const c2=noise3(wx*.038+14,y*.057-8,wz*.038-17);
    const c3=noise3(wx*.018-31,y*.033+11,wz*.018+44);
    const cave=c1*.55+c2*.30+c3*.15;
    const tunnel=Math.abs(Math.sin(wx*.043+wz*.021+y*.065+noise2(wx*.018,wz*.018)*5.4));
    const threshold=.718-(y<12?.025:0)+(h>44?.012:0);
    return cave>threshold||(cave>.655&&tunnel<.075);
  }
  function deepRockAt(wx,y,wz,biome){
    const strata=noise3(wx*.035,y*.045,wz*.035);
    if(y<10&&strata>.61)return B.BASALT;
    if(strata<.18)return B.LIMESTONE;
    if(strata>.82)return B.GRANITE;
    if(strata>.66&&y<26)return B.DARKSTONE;
    if((biome==='highlands'||biome==='rocky'||biome==='alpine'||y>43)&&hash3i(wx,y,wz,0x423)>.48)return B.SLATE;
    if(strata>.46&&strata<.50&&y<26)return B.MARBLE;
    if(y>SEA-2&&strata>.54&&strata<.61)return B.MOSSY_STONE;
    if(y>SEA-5&&strata>.29&&strata<.34)return B.CAVE_DIRT;
    return B.STONE;
  }
  function oreAt(wx,y,wz,baseRock){
    // coherent veins instead of isolated ore pixels
    const coal=noise3(wx*.19+70,y*.17-20,wz*.19+11);
    const iron=noise3(wx*.22-39,y*.20+33,wz*.22-61);
    const gold=noise3(wx*.235+91,y*.23-47,wz*.235+73);
    if(y<44&&coal>.78&&hash3i(wx>>1,y>>1,wz>>1,0xc011)>.22)return B.COAL;
    if(y<22&&gold>.852&&hash3i(wx>>1,y>>1,wz>>1,0x6f1d)>.48)return B.GOLD;
    if(y<38&&iron>.805&&hash3i(wx>>1,y>>1,wz>>1,0x1f30)>.31)return B.IRON;
    return baseRock;
  }
  const RUIN_TYPES=[
    'crumbled_tower','broken_cottage','stone_arch','graveyard','stone_circle','roadside_shrine','watchpost','collapsed_hall',
    'cellar_mouth','broken_wall','ash_camp','rune_altar','old_well','gatehouse','buried_temple','fallen_monument'
  ];
  const RUIN_CELL=88;
  function ruinCandidateForCell(cellX,cellZ){
    const roll=hash2i(cellX,cellZ,worldSeed^0x66a1);if(roll<.46)return null;
    const gx=cellX*RUIN_CELL+12+Math.floor(hash2i(cellX,cellZ,worldSeed^0x66a2)*(RUIN_CELL-24));
    const gz=cellZ*RUIN_CELL+12+Math.floor(hash2i(cellX,cellZ,worldSeed^0x66a3)*(RUIN_CELL-24));
    const y=terrainHeight(gx,gz),biome=biomeAt(gx,gz,y);if(y<=SEA+2||['beach','wet_shore','riverlands','swamp','marsh','willow_swamp','snow_peaks'].includes(biome))return null;
    let lo=999,hi=-999;for(const[dx,dz]of[[-6,-6],[6,-6],[-6,6],[6,6],[0,0]]){const h=terrainHeight(gx+dx,gz+dz);lo=Math.min(lo,h);hi=Math.max(hi,h);}if(hi-lo>7)return null;
    const type=RUIN_TYPES[Math.floor(hash2i(cellX,cellZ,worldSeed^0x66a4)*RUIN_TYPES.length)%RUIN_TYPES.length];
    return{cellX,cellZ,gx,gz,y,biome,type,rot:Math.floor(hash2i(cellX,cellZ,worldSeed^0x66a5)*4)%4};
  }

  function generateChunkData(cx,cz){
    const data=new Uint8Array(CHUNK*WORLD_H*CHUNK),topCache=new Int16Array(CHUNK*CHUNK),bioCache=[];
    for(let lz=0;lz<CHUNK;lz++)for(let lx=0;lx<CHUNK;lx++){
      const wx=cx*CHUNK+lx,wz=cz*CHUNK+lz,h=terrainHeight(wx,wz),biome=biomeAt(wx,wz,h);topCache[lz*CHUNK+lx]=h;bioCache[lz*CHUNK+lx]=biome;
      const soilDepth=3+Math.floor(hash2i(wx,wz,0xd17)*3),mouth=caveMouthDepth(wx,wz,h);
      for(let y=0;y<WORLD_H;y++){
        let id=B.AIR;
        if(y===0)id=B.BEDROCK;
        else if(mouth>0&&y>=h-mouth&&y<h)id=B.AIR;
        else if(y<h-soilDepth){
          const mine=mineshaftCell(wx,y,wz);
          if(mine===1)id=B.AIR;
          else if(mine===2)id=B.PINEWOOD;
          else if(caveIsOpen(wx,y,wz,h))id=B.AIR;
          else id=oreAt(wx,y,wz,deepRockAt(wx,y,wz,biome));
        }else if(y<h-1){
          if((biome==='beach'||biome==='red_barrens')&&y<h-3)id=B.SANDSTONE;else id=underBlockFor(biome,wx,wz);
        }else if(y===h-1)id=surfaceBlockFor(biome,wx,wz);
        else if(y>=h&&y<=SEA)id=(biome==='frozen_shore'&&y===SEA)?B.ICE:B.WATER;
        data[idx3(lx,y,lz)]=id;
      }
    }
    const put=(x,y,z,id,overwrite=false)=>{if(x>=0&&x<CHUNK&&z>=0&&z<CHUNK&&y>0&&y<WORLD_H&&(overwrite||data[idx3(x,y,z)]===B.AIR))data[idx3(x,y,z)]=id;};
    const putW=(wx,y,wz,id,overwrite=true)=>{if(floorDiv(wx,CHUNK)!==cx||floorDiv(wz,CHUNK)!==cz||y<=0||y>=WORLD_H)return;put(mod(wx,CHUNK),y,mod(wz,CHUNK),id,overwrite);};
    const placeRuin=(r)=>{
      const rot=(dx,dz)=>r.rot===0?[dx,dz]:r.rot===1?[-dz,dx]:r.rot===2?[-dx,-dz]:[dz,-dx];
      const at=(dx,dz)=>{const[a,b]=rot(dx,dz);return[r.gx+a,r.gz+b];};
      const gy=(dx,dz)=>{const[x,z]=at(dx,dz);return terrainHeight(x,z);};
      const block=(dx,dy,dz,id,overwrite=true,baseOverride=null)=>{const[x,z]=at(dx,dz),base=baseOverride==null?gy(dx,dz):baseOverride;putW(x,base+dy,z,id,overwrite);};
      const col=(dx,dz,h,id,holes=0)=>{const base=gy(dx,dz);for(let yy=0;yy<h;yy++)if(!holes||hash3i(r.gx+dx,yy,r.gz+dz,worldSeed^0x6b11)>holes)block(dx,yy,dz,id,true,base);};
      const floorRect=(x0,x1,z0,z1,id,skip=.0)=>{for(let dz=z0;dz<=z1;dz++)for(let dx=x0;dx<=x1;dx++)if(!skip||hash3i(r.gx+dx,0,r.gz+dz,worldSeed^0x6b12)>skip)block(dx,0,dz,id,true);};
      const wallRect=(rx,rz,h,id,gap=.15)=>{for(let dz=-rz;dz<=rz;dz++)for(let dx=-rx;dx<=rx;dx++){if(Math.abs(dx)!==rx&&Math.abs(dz)!==rz)continue;if(dz===-rz&&Math.abs(dx)<=1)continue;col(dx,dz,h-(hash3i(r.gx+dx,1,r.gz+dz,0x6b13)>.72?1:0),id,gap);}};
      switch(r.type){
        case'crumbled_tower':{floorRect(-4,4,-4,4,B.RUBBLE,.36);wallRect(4,4,5,B.WEATHERED_BRICKS,.22);for(const[dx,dz]of[[-3,-3],[3,-3],[-3,3],[3,3]])col(dx,dz,7,B.STONE_BRICKS,.12);block(0,0,0,B.RUNE_STONE,true);break;}
        case'broken_cottage':{floorRect(-4,4,-3,3,B.OLD_PLANKS,.18);for(let dx=-4;dx<=4;dx++){if(Math.abs(dx)>1)col(dx,-3,3,B.WEATHERED_BRICKS,.08);if(hash2i(dx,r.cellZ,0x6b14)>.2)col(dx,3,2,B.MOSSY_BRICKS,.15);}for(let dz=-2;dz<=2;dz++){col(-4,dz,2,B.CRACKED_BRICKS,.12);col(4,dz,3,B.CRACKED_BRICKS,.18);}for(let dx=-3;dx<=3;dx++)if(Math.abs(dx)%2===1)block(dx,3,-1,B.OLD_TILES,true);break;}
        case'stone_arch':{for(const dx of[-3,3])col(dx,0,6,B.STONE_BRICKS,.04);for(let dx=-3;dx<=3;dx++)block(dx,5,0,hash2i(dx,r.gx,0x6b15)>.22?B.CHISELED_STONE:B.CRACKED_BRICKS,true);for(const dx of[-4,4])col(dx,0,2,B.RUBBLE,.25);break;}
        case'graveyard':{for(let dz=-5;dz<=5;dz+=5)for(let dx=-4;dx<=4;dx+=2){if(dx===0&&dz===-5)continue;block(dx,0,dz,B.GRAVE_STONE,true);if(hash3i(dx,0,dz,worldSeed^0x6b16)>.38)block(dx,1,dz,B.GRAVE_STONE,true);}for(let x=-6;x<=6;x++)if(Math.abs(x)>1)block(x,0,-6,B.MOSSY_BRICKS,true);for(let z=-6;z<=6;z++){block(-6,0,z,B.MOSSY_BRICKS,true);block(6,0,z,B.MOSSY_BRICKS,true);}break;}
        case'stone_circle':{for(let i=0;i<12;i++){const a=i/12*Math.PI*2,dx=Math.round(Math.cos(a)*5),dz=Math.round(Math.sin(a)*5);col(dx,dz,2+(i%3===0?1:0),i%2?B.RUNE_STONE:B.CHISELED_STONE,.06);}block(0,0,0,B.RUNE_STONE,true);break;}
        case'roadside_shrine':{floorRect(-2,2,-2,2,B.STONE_BRICKS,.1);for(const[dx,dz]of[[-2,-2],[2,-2],[-2,2],[2,2]])col(dx,dz,4,B.CHISELED_STONE,.05);block(0,1,0,B.RUNE_STONE,true);for(let dx=-2;dx<=2;dx++)block(dx,4,0,B.OLD_TILES,true);break;}
        case'watchpost':{floorRect(-3,3,-3,3,B.OLD_PLANKS,.24);for(const[dx,dz]of[[-3,-3],[3,-3],[-3,3],[3,3]])col(dx,dz,7,B.OLD_PLANKS,.06);for(let dx=-3;dx<=3;dx++){block(dx,5,-3,B.DARK_PLANKS,true);block(dx,5,3,B.DARK_PLANKS,true);}for(let dz=-2;dz<=2;dz++){block(-3,5,dz,B.DARK_PLANKS,true);block(3,5,dz,B.DARK_PLANKS,true);}break;}
        case'collapsed_hall':{floorRect(-6,6,-3,3,B.WEATHERED_BRICKS,.28);for(let dx=-6;dx<=6;dx++){if(Math.abs(dx)>1)col(dx,-3,2+(Math.abs(dx)%3===0?2:0),B.CRACKED_BRICKS,.22);}for(let dz=-2;dz<=2;dz++)if(Math.abs(dz)%2===0){col(-6,dz,3,B.MOSSY_BRICKS,.18);col(6,dz,2,B.MOSSY_BRICKS,.25);}break;}
        case'cellar_mouth':{floorRect(-3,3,-3,3,B.STONE_BRICKS,.0);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const[x,z]=at(dx,dz),base=gy(0,0);for(let yy=-1;yy>=-5;yy--)putW(x,base+yy,z,B.AIR,true);}for(let k=0;k<5;k++){const[x,z]=at(0,-1-k%2);putW(x,gy(0,0)-k,z,B.OLD_PLANKS,true);}break;}
        case'broken_wall':{for(let dx=-8;dx<=8;dx++){const h=1+Math.floor(hash2i(r.gx+dx,r.gz,0x6b17)*4);if(hash2i(dx,r.cellX,0x6b18)>.14)col(dx,0,h,dx%4===0?B.MOSSY_BRICKS:B.WEATHERED_BRICKS,.08);}break;}
        case'ash_camp':{floorRect(-5,5,-5,5,B.ASH_BLOCK,.38);for(const[dx,dz]of[[-3,-2],[2,-3],[3,2],[-2,3]]){block(dx,0,dz,B.OLD_PLANKS,true);block(dx+1,0,dz,B.OLD_PLANKS,true);}block(0,0,0,B.RUBBLE,true);block(1,0,0,B.RUBBLE,true);break;}
        case'rune_altar':{floorRect(-4,4,-4,4,B.MOSSY_BRICKS,.18);for(const[dx,dz]of[[-4,0],[4,0],[0,-4],[0,4]])col(dx,dz,4,B.RUNE_STONE,.04);block(0,0,0,B.CHISELED_STONE,true);block(0,1,0,B.RUNE_STONE,true);break;}
        case'old_well':{for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))===2)block(dx,0,dz,B.STONE_BRICKS,true);}for(const dx of[-2,2]){col(dx,0,4,B.OLD_PLANKS,.0);block(dx,4,0,B.DARK_PLANKS,true);}for(let dx=-2;dx<=2;dx++)block(dx,4,0,B.OLD_TILES,true);break;}
        case'gatehouse':{for(const dx of[-5,-4,4,5])for(let dz=-2;dz<=2;dz++)col(dx,dz,4,B.WEATHERED_BRICKS,.06);for(let dx=-5;dx<=5;dx++)if(Math.abs(dx)>1)block(dx,4,0,B.CRACKED_BRICKS,true);for(const dx of[-5,5])col(dx,0,7,B.CHISELED_STONE,.06);break;}
        case'buried_temple':{floorRect(-5,5,-5,5,B.STONE_BRICKS,.08);for(let i=-4;i<=4;i+=2){col(-5,i,3,B.MOSSY_BRICKS,.12);col(5,i,3,B.MOSSY_BRICKS,.12);}for(let i=-3;i<=3;i++){block(i,0,-5,B.RUNE_STONE,true);if(Math.abs(i)>1)block(i,1,-5,B.RUNE_STONE,true);}for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(Math.abs(dx)+Math.abs(dz)<=2)block(dx,1,dz,B.CHISELED_STONE,true);break;}
        case'fallen_monument':{floorRect(-3,3,-3,3,B.RUBBLE,.30);for(let i=-4;i<=4;i++){block(i,0,0,i%3===0?B.RUNE_STONE:B.GRAVE_STONE,true);if(i>-2&&i<3)block(i,1,0,B.GRAVE_STONE,true);}col(-4,0,2,B.CHISELED_STONE,.0);col(4,0,3,B.CHISELED_STONE,.0);break;}
      }
    };
    const leafBlob=(lx,h,lz,leaf,wx,wz,wide=2,tall=2)=>{
      for(let dy=-tall;dy<=tall;dy++)for(let dz=-wide;dz<=wide;dz++)for(let dx=-wide;dx<=wide;dx++){
        const d=Math.sqrt(dx*dx+dz*dz+(dy*1.15)*(dy*1.15));
        if(d<=wide+.72&&hash3i(wx+dx,h+dy,wz+dz,worldSeed^0x111)>.065)put(lx+dx,h+dy,lz+dz,leaf);
      }
    };
    const branch=(lx,y,lz,dx,dz,len,wood)=>{for(let i=1;i<=len;i++)put(lx+dx*i,y+(i===len?1:0),lz+dz*i,wood);};
    // Trees are evaluated in a 4-block halo around the chunk. This is important:
    // canopies and branches now continue across chunk borders instead of leaving
    // obvious empty 6-block grid lines between forests.
    for(let lz=-4;lz<CHUNK+4;lz++)for(let lx=-4;lx<CHUNK+4;lx++){
      const wx=cx*CHUNK+lx,wz=cz*CHUNK+lz,h=terrainHeight(wx,wz),biome=biomeAt(wx,wz,h),roll=hash2i(wx,wz,worldSeed^0x55aa);
      const grove=.45+.95*fbm2(wx*.021+19,wz*.021-31);
      let chance={forest:.078,old_growth:.105,mist_forest:.112,darkwood:.094,birch:.073,poplar_grove:.080,taiga:.086,spruce_valley:.118,mountain_forest:.062,autumn:.066,willow_swamp:.070,swamp:.046,marsh:.020,flower_meadow:.012,meadow:.014,plains:.010,cold_plains:.012,pine_barrens:.049,chaparral:.033,barren:.003,tundra:.004}[biome]??.005;
      chance*=grove;if(h<=SEA+1||roll>=chance||caveMouthDepth(wx,wz,h)>0)continue;
      if(['taiga','spruce_valley','tundra','snow_peaks','mountain_forest','pine_barrens'].includes(biome)){
        const tall=(biome==='spruce_valley'&&hash2i(wx,wz,0x711)>.40)||(biome==='old_growth'&&hash2i(wx,wz,0x712)>.82);
        const giant=tall&&hash2i(wx,wz,0x713)>.72;
        const th=(giant?20:tall?13:8)+Math.floor(hash2i(wx,wz,worldSeed^0x9911)*(giant?8:tall?7:6));
        for(let y=h;y<Math.min(WORLD_H-2,h+th);y++)put(lx,y,lz,B.PINEWOOD);
        const top=h+th-1;for(let dy=-(giant?12:tall?8:6);dy<=0;dy++){const rad=Math.max(1,Math.floor((1-dy)*(giant?.29:tall?.34:.42)));for(let dz=-rad;dz<=rad;dz++)for(let dx=-rad;dx<=rad;dx++)if(Math.abs(dx)+Math.abs(dz)<=rad+1&&hash3i(wx+dx,top+dy,wz+dz,0x822)>.10)put(lx+dx,top+dy,lz+dz,B.PINELEAVES);}
      }else if(biome==='birch'){
        const th=6+Math.floor(hash2i(wx,wz,0x514)*5);for(let y=h;y<h+th;y++)put(lx,y,lz,B.BIRCHWOOD);if(th>7)branch(lx,h+th-3,lz,1,0,1,B.BIRCHWOOD);leafBlob(lx,h+th-1,lz,B.BIRCHLEAVES,wx,wz,2,2);
      }else if(biome==='poplar_grove'||biome==='riverlands'){
        const th=9+Math.floor(hash2i(wx,wz,0x625)*6);for(let y=h;y<h+th;y++)put(lx,y,lz,B.POPLARWOOD);
        for(let dy=-4;dy<=2;dy++){const rad=dy>0?1:2;for(let dz=-rad;dz<=rad;dz++)for(let dx=-rad;dx<=rad;dx++)if(Math.abs(dx)+Math.abs(dz)<=rad+1&&hash3i(wx+dx,h+th+dy-2,wz+dz,0x626)>.12)put(lx+dx,h+th+dy-2,lz+dz,B.POPLARLEAVES);}
      }else if(biome==='chaparral'){
        const th=4+Math.floor(hash2i(wx,wz,0x631)*3);for(let y=h;y<h+th;y++)put(lx,y,lz,B.MIMOSAWOOD);branch(lx,h+th-2,lz,1,0,2,B.MIMOSAWOOD);branch(lx,h+th-2,lz,-1,0,2,B.MIMOSAWOOD);leafBlob(lx,h+th-1,lz,B.MIMOSALEAVES,wx,wz,3,1);
      }else if(['darkwood','old_growth','mist_forest'].includes(biome)){
        const huge=biome==='old_growth'||biome==='mist_forest';const th=(huge?9:6)+Math.floor(hash2i(wx,wz,0x918)*6);for(let y=h;y<h+th;y++)put(lx,y,lz,B.DARKWOOD);
        if(th>8){branch(lx,h+th-4,lz,1,0,2,B.DARKWOOD);branch(lx,h+th-5,lz,0,-1,2,B.DARKWOOD);if(huge)branch(lx,h+th-6,lz,-1,1,2,B.DARKWOOD);}
        leafBlob(lx,h+th-1,lz,B.DARKLEAVES,wx,wz,huge?4:3,3);
      }else if(biome==='willow_swamp'){
        const th=5+Math.floor(hash2i(wx,wz,0x271)*3);for(let y=h;y<h+th;y++)put(lx,y,lz,B.WILLOWWOOD);leafBlob(lx,h+th-1,lz,B.WILLOWLEAVES,wx,wz,3,2);
        for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)if(Math.abs(dx)+Math.abs(dz)>2&&hash3i(wx+dx,h,wz+dz,0x761)>.7)for(let q=0;q<2;q++)put(lx+dx,h+th-2-q,lz+dz,B.WILLOWLEAVES);
      }else if(biome==='autumn'){
        const th=5+Math.floor(hash2i(wx,wz,0x515)*4);for(let y=h;y<h+th;y++)put(lx,y,lz,B.WOOD);leafBlob(lx,h+th-1,lz,B.AUTUMNLEAVES,wx,wz,3,2);
      }else if(biome==='barren'){
        const th=3+Math.floor(hash2i(wx,wz,0x818)*4);for(let y=h;y<h+th;y++)put(lx,y,lz,B.DEADWOOD);if(hash2i(wx,wz,0x199)>.5)put(lx+1,h+th-2,lz,B.DEADWOOD);
      }else{
        const swampy=biome==='swamp'||biome==='marsh',trunk=swampy?B.DEADWOOD:B.WOOD,leaf=swampy?B.DARKLEAVES:B.LEAVES;
        const th=5+Math.floor(hash2i(wx,wz,worldSeed^0x9911)*5);for(let y=h;y<Math.min(WORLD_H-2,h+th);y++)put(lx,y,lz,trunk);
        if(th>7&&hash2i(wx,wz,0x181)>.45){branch(lx,h+th-3,lz,1,0,1,trunk);branch(lx,h+th-4,lz,0,1,1,trunk);}
        leafBlob(lx,h+th-1,lz,leaf,wx,wz,biome==='forest'?3:2,2);
      }
    }
    // Dense but clustered undergrowth; flowers form patches instead of a uniform
    // distribution so a random seed can look like the lush screenshots.
    for(let lz=1;lz<CHUNK-1;lz++)for(let lx=1;lx<CHUNK-1;lx++){
      const wx=cx*CHUNK+lx,wz=cz*CHUNK+lz,h=topCache[lz*CHUNK+lx],biome=bioCache[lz*CHUNK+lx],r=hash2i(wx,wz,worldSeed^0x77),patch=fbm2(wx*.075+7,wz*.075-13),above=idx3(lx,h,lz);
      if(h<=SEA+1||!blockDefs[data[idx3(lx,Math.max(1,h-1),lz)]]?.solid)continue;const empty=data[above]===B.AIR;if(empty){
        let decor=B.AIR;
        if(['forest','birch','poplar_grove','darkwood','old_growth','mist_forest','autumn','mountain_forest'].includes(biome)){
          if(r<.13+.09*patch)decor=B.TALLGRASS;else if(r<.21+.06*patch)decor=B.FERN;else if(r<.245&&patch>.58)decor=B.BUSH;else if(r>.982)decor=B.MUSHROOM;else if(r>.955&&patch>.58)decor=B.BLUE_FLOWER;
        }else if(biome==='flower_meadow'){
          if(r<.25)decor=B.TALLGRASS;else if(r<.315)decor=B.RED_FLOWER;else if(r<.38)decor=B.WHITE_FLOWER;else if(r<.445)decor=B.BLUE_FLOWER;else if(r<.51)decor=B.YELLOW_FLOWER;
        }else if(biome==='meadow'||biome==='riverlands'){
          if(r<.20)decor=B.TALLGRASS;else if(r<.235)decor=B.RED_FLOWER;else if(r<.27)decor=B.WHITE_FLOWER;else if(r<.305)decor=B.YELLOW_FLOWER;else if(r<.33)decor=B.BUSH;
        }else if(['plains','cold_plains'].includes(biome)){if(r<.15)decor=B.TALLGRASS;else if(r>.982)decor=B.WHITE_FLOWER;else if(r>.958&&patch>.62)decor=B.HEATHER;else if(r<.175&&patch>.68)decor=B.BUSH;}
        else if(['willow_swamp','swamp','marsh'].includes(biome)){if(r<.18)decor=B.FERN;else if(r<.29&&h<=SEA+4)decor=B.REEDS;else if(r<.33)decor=B.BUSH;else if(r>.975)decor=B.MUSHROOM;}
        else if(['taiga','spruce_valley','tundra','pine_barrens'].includes(biome)){if(r<.09)decor=B.FERN;else if(r>.968)decor=B.HEATHER;else if(r<.12&&patch>.63)decor=B.BUSH;}
        else if(['chaparral','barren','red_barrens'].includes(biome)){if(r<.07)decor=B.DRY_BUSH;}
        if(decor!==B.AIR)data[above]=decor;
      }
      if(r>.978&&r<.989&&data[above]===B.AIR)data[above]=['highlands','rocky','snow_peaks','alpine'].includes(biome)?B.DARKSTONE:B.GRAVEL;
      if(['beach','wet_shore'].includes(biome)&&hash2i(wx,wz,0x313)>.985&&h<SEA+2)data[idx3(lx,Math.max(1,h-2),lz)]=B.CLAY;
      if(biome==='frozen_shore'&&h<=SEA+1){for(let yy=h;yy<=SEA;yy++)if(data[idx3(lx,yy,lz)]===B.WATER)data[idx3(lx,yy,lz)]=B.ICE;}
    }
    // Micro-features: boulders, fallen logs, pumpkins and cacti make traversal
    // visually busy without turning every surface block into decoration.
    for(let lz=2;lz<CHUNK-2;lz++)for(let lx=2;lx<CHUNK-2;lx++){
      const wx=cx*CHUNK+lx,wz=cz*CHUNK+lz,h=topCache[lz*CHUNK+lx],biome=bioCache[lz*CHUNK+lx],r=hash2i(wx,wz,worldSeed^0x4f33);
      if(data[idx3(lx,h,lz)]!==B.AIR||!blockDefs[data[idx3(lx,Math.max(1,h-1),lz)]]?.solid)continue;
      if(r>.994&&['forest','old_growth','mist_forest','taiga','spruce_valley','highlands','rocky'].includes(biome)){
        const rock=biome==='highlands'||biome==='rocky'?B.RIVER_ROCK:B.MOSSY_STONE;put(lx,h,lz,rock);if(hash2i(wx,wz,0x4f34)>.56)put(lx+1,h,lz,rock);if(hash2i(wx,wz,0x4f35)>.63)put(lx,h+1,lz,rock);
      }else if(r>.988&&r<=.994&&['forest','old_growth','mist_forest','darkwood','taiga','spruce_valley'].includes(biome)){
        const axis=hash2i(wx,wz,0x4f36)>.5;const wood=['taiga','spruce_valley'].includes(biome)?B.PINEWOOD:B.DEADWOOD;for(let i=-1;i<=2;i++)put(lx+(axis?i:0),h,lz+(axis?0:i),wood);
      }else if(r>.985&&r<=.988&&['forest','meadow','flower_meadow','plains'].includes(biome))put(lx,h,lz,B.PUMPKIN);
      else if(r>.986&&['red_barrens','chaparral'].includes(biome)){const ch=2+Math.floor(hash2i(wx,wz,0x4f37)*3);for(let yy=0;yy<ch;yy++)put(lx,h+yy,lz,B.CACTUS);}
    }
    // V7 landmark pass: sixteen deterministic ruin archetypes. Each structure
    // is generated from world-space coordinates, so it can cross chunk borders
    // without being chopped at chunk seams.
    const chunkMinX=cx*CHUNK-18,chunkMaxX=(cx+1)*CHUNK+18,chunkMinZ=cz*CHUNK-18,chunkMaxZ=(cz+1)*CHUNK+18;
    const c0x=floorDiv(chunkMinX,RUIN_CELL),c1x=floorDiv(chunkMaxX,RUIN_CELL),c0z=floorDiv(chunkMinZ,RUIN_CELL),c1z=floorDiv(chunkMaxZ,RUIN_CELL);
    for(let rzCell=c0z;rzCell<=c1z;rzCell++)for(let rxCell=c0x;rxCell<=c1x;rxCell++){
      const ruin=ruinCandidateForCell(rxCell,rzCell);if(!ruin)continue;
      if(ruin.gx<chunkMinX||ruin.gx>chunkMaxX||ruin.gz<chunkMinZ||ruin.gz>chunkMaxZ)continue;
      placeRuin(ruin);
    }
    for(const [key,val] of edits){const [x,y,z]=key.split(',').map(Number);if(floorDiv(x,CHUNK)===cx&&floorDiv(z,CHUNK)===cz&&y>=0&&y<WORLD_H)data[idx3(mod(x,CHUNK),y,mod(z,CHUNK))]=val;}
    return data;
  }

  function ensureChunk(cx,cz){
    const key=chunkKey(cx,cz);let c=chunks.get(key);
    if(!c){c={cx,cz,data:generateChunkData(cx,cz),opaque:null,water:null,dirty:true};chunks.set(key,c);}
    return c;
  }
  function getBlock(x,y,z){
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0||y>=WORLD_H)return B.AIR;
    const cx=floorDiv(x,CHUNK),cz=floorDiv(z,CHUNK);const c=ensureChunk(cx,cz);return c.data[idx3(mod(x,CHUNK),y,mod(z,CHUNK))];
  }
  function setBlock(x,y,z,id,record=true){
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<=0||y>=WORLD_H-1)return false;
    const cx=floorDiv(x,CHUNK),cz=floorDiv(z,CHUNK),c=ensureChunk(cx,cz);c.data[idx3(mod(x,CHUNK),y,mod(z,CHUNK))]=id;
    if(record)edits.set(editKey(x,y,z),id);
    markDirty(cx,cz);
    if(mod(x,CHUNK)===0)markDirty(cx-1,cz);if(mod(x,CHUNK)===CHUNK-1)markDirty(cx+1,cz);
    if(mod(z,CHUNK)===0)markDirty(cx,cz-1);if(mod(z,CHUNK)===CHUNK-1)markDirty(cx,cz+1);
    const key=editKey(x,y,z);if(id!==B.FURNACE&&furnaces.has(key))furnaces.delete(key);if(!isUpgradeableBlockId(id)&&fortifications.has(key))fortifications.delete(key);
    return true;
  }
  function markDirty(cx,cz){const c=chunks.get(chunkKey(cx,cz));if(c){c.dirty=true;dirtyChunks.add(chunkKey(cx,cz));}}

  const faces=[
    {n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,0],[1,1,1],[1,0,1]],side:'side',uv:[[0,1],[0,0],[1,0],[0,1],[1,0],[1,1]]},
    {n:[-1,0,0],v:[[0,0,1],[0,1,1],[0,1,0],[0,0,1],[0,1,0],[0,0,0]],side:'side',uv:[[0,1],[0,0],[1,0],[0,1],[1,0],[1,1]]},
    {n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,1],[1,1,0],[0,1,0]],side:'top',uv:[[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]]},
    {n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,0],[1,0,1],[0,0,1]],side:'bottom',uv:[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]},
    {n:[0,0,1],v:[[1,0,1],[1,1,1],[0,1,1],[1,0,1],[0,1,1],[0,0,1]],side:'side',uv:[[1,1],[1,0],[0,0],[1,1],[0,0],[0,1]]},
    {n:[0,0,-1],v:[[0,0,0],[0,1,0],[1,1,0],[0,0,0],[1,1,0],[1,0,0]],side:'side',uv:[[0,1],[0,0],[1,0],[0,1],[1,0],[1,1]]}
  ];
  const faceUV=[[0,1],[1,1],[1,0],[0,1],[1,0],[0,0]];
  function tileUV(tileIndex,u,v){const col=tileIndex%atlas.cols,row=Math.floor(tileIndex/atlas.cols),pad=.03/atlas.tile;return[(col+pad+u*(1-2*pad))/atlas.cols,(row+pad+v*(1-2*pad))/atlas.rows];}
  function tileFor(id,side){const t=blockTile[id];if(typeof t==='number')return t;if(t)return t[side]??t.side;return 3;}
  // Textured first-person block renderer. Held blocks use the same atlas/face UVs
  // as the world instead of a flat colored cube, so grass, logs, ores, planks etc.
  // visually match what the player is looking at.
  const heldBlockProgram=makeProgram(`
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; uniform mat4 uMVP; varying vec3 vN; varying vec2 vUV;
    void main(){vN=aNormal;vUV=aUV;gl_Position=uMVP*vec4(aPos,1.0);}
  `,`
    precision mediump float; varying vec3 vN; varying vec2 vUV; uniform sampler2D uTex;
    void main(){vec4 t=texture2D(uTex,vUV);if(t.a<.12)discard;vec3 n=normalize(vN);float l=.72+max(0.0,dot(n,normalize(vec3(-.4,.82,.32))))*.28;gl_FragColor=vec4(t.rgb*l,t.a);}
  `);
  const HBL={pos:gl.getAttribLocation(heldBlockProgram,'aPos'),normal:gl.getAttribLocation(heldBlockProgram,'aNormal'),uv:gl.getAttribLocation(heldBlockProgram,'aUV'),mvp:gl.getUniformLocation(heldBlockProgram,'uMVP'),tex:gl.getUniformLocation(heldBlockProgram,'uTex')};
  const heldBlockMeshes=new Map();
  function heldBlockMeshFor(id){
    if(heldBlockMeshes.has(id))return heldBlockMeshes.get(id);const P=[],N=[],U=[];
    for(const f of faces){const tile=tileFor(id,f.side),fuv=f.uv||faceUV;for(let i=0;i<6;i++){const v=f.v[i];P.push(v[0]-.5,v[1]-.5,v[2]-.5);N.push(f.n[0],f.n[1],f.n[2]);const uv=tileUV(tile,fuv[i][0],fuv[i][1]);U.push(uv[0],uv[1]);}}
    const m=makeMeshBuffers(P,N,U);heldBlockMeshes.set(id,m);return m;
  }
  function drawHeldTexturedBlock(VP,pos,scale,id,ry=0,rx=0,rz=0){
    const m=heldBlockMeshFor(id);if(!m)return;const mvp=M4.multiply(VP,modelMatrix(pos,scale,ry,rx,rz));gl.useProgram(heldBlockProgram);gl.uniformMatrix4fv(HBL.mvp,false,mvp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlas.tex);gl.uniform1i(HBL.tex,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.enableVertexAttribArray(HBL.pos);gl.vertexAttribPointer(HBL.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.enableVertexAttribArray(HBL.normal);gl.vertexAttribPointer(HBL.normal,3,gl.BYTE,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.u);gl.enableVertexAttribArray(HBL.uv);gl.vertexAttribPointer(HBL.uv,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  function shouldExpose(id,nid){if(id===B.WATER)return nid!==B.WATER&&nid===B.AIR;if(id===B.GLASS)return nid!==B.GLASS&&(nid===B.AIR||nid===B.WATER||blockDefs[nid]?.transparent);if(isFoliage(id))return nid===B.AIR||nid===B.WATER||nid===B.TORCH||blockDefs[nid]?.decor;if(id===B.TORCH||blockDefs[id]?.decor)return false;return nid===B.AIR||nid===B.WATER||nid===B.TORCH||blockDefs[nid]?.decor||isFoliage(nid);}

  function makeMeshBuffers(pos,nor,uv){
    if(!pos.length)return null;
    const obj={count:pos.length/3};
    obj.p=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,obj.p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
    obj.n=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,obj.n);gl.bufferData(gl.ARRAY_BUFFER,new Int8Array(nor),gl.STATIC_DRAW);
    obj.u=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,obj.u);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
    return obj;
  }
  function deleteMesh(m){if(!m)return;gl.deleteBuffer(m.p);gl.deleteBuffer(m.n);gl.deleteBuffer(m.u);}
  function pushDecorMesh(P,N,U,wx,y,wz,id){
    const tile=tileFor(id,'side'), eps=.03;
    const planes=[[[eps,0,eps],[1-eps,0,1-eps],[1-eps,1,1-eps],[eps,0,eps],[1-eps,1,1-eps],[eps,1,eps]],[[1-eps,0,eps],[eps,0,1-eps],[eps,1,1-eps],[1-eps,0,eps],[eps,1,1-eps],[1-eps,1,eps]]];
    for(const plane of planes){for(let i=0;i<6;i++){const v=plane[i];P.push(wx+v[0],y+v[1],wz+v[2]);N.push(0,1,0);const tuv=tileUV(tile,faceUV[i][0],faceUV[i][1]);U.push(tuv[0],tuv[1]);}}
  }
  function rebuildChunk(c){
    deleteMesh(c.opaque);deleteMesh(c.water);
    const op=[],on=[],ou=[],wp=[],wn=[],wu=[];
    const ox=c.cx*CHUNK,oz=c.cz*CHUNK;
    for(let y=0;y<WORLD_H;y++)for(let lz=0;lz<CHUNK;lz++)for(let lx=0;lx<CHUNK;lx++){
      const id=c.data[idx3(lx,y,lz)];if(id===B.AIR||id===B.TORCH||id===B.WOOD_DOOR||id===B.WOOD_STAIRS||id===B.WOOD_FENCE)continue;
      const wx=ox+lx,wz=oz+lz,isWater=id===B.WATER;const P=isWater?wp:op,N=isWater?wn:on,U=isWater?wu:ou;
      if(blockDefs[id]?.decor){pushDecorMesh(P,N,U,wx,y,wz,id);continue;}
      for(const f of faces){
        const nid=getBlock(wx+f.n[0],y+f.n[1],wz+f.n[2]);if(!shouldExpose(id,nid))continue;
        const tile=tileFor(id,f.side);
        for(let i=0;i<6;i++){const v=f.v[i];P.push(wx+v[0],y+v[1],wz+v[2]);N.push(f.n[0],f.n[1],f.n[2]);const fuv=f.uv||faceUV,tuv=tileUV(tile,fuv[i][0],fuv[i][1]);U.push(tuv[0],tuv[1]);}
      }
    }
    c.opaque=makeMeshBuffers(op,on,ou);c.water=makeMeshBuffers(wp,wn,wu);c.dirty=false;dirtyChunks.delete(chunkKey(c.cx,c.cz));
  }
  function processDirty(max=2){let n=0;for(const key of [...dirtyChunks]){const c=chunks.get(key);if(c&&c.dirty){rebuildChunk(c);if(++n>=max)break;}else dirtyChunks.delete(key);}}
  function updateStreaming(px,pz,force=false){
    const pcx=floorDiv(px,CHUNK),pcz=floorDiv(pz,CHUNK),keep=renderDistance+1;
    for(let dz=-renderDistance;dz<=renderDistance;dz++)for(let dx=-renderDistance;dx<=renderDistance;dx++){
      if(dx*dx+dz*dz>(renderDistance+.6)*(renderDistance+.6))continue;const c=ensureChunk(pcx+dx,pcz+dz);if(c.dirty)dirtyChunks.add(chunkKey(c.cx,c.cz));
    }
    for(const [key,c] of chunks){if(Math.abs(c.cx-pcx)>keep||Math.abs(c.cz-pcz)>keep){deleteMesh(c.opaque);deleteMesh(c.water);chunks.delete(key);dirtyChunks.delete(key);}}
    if(force){let guard=0;while(dirtyChunks.size&&guard++<1000)processDirty(8);}
  }
  function findSurface(x,z){
    for(let y=WORLD_H-2;y>=1;y--){const b=getBlock(x,y,z);if(blockDefs[b]?.solid&&!isFoliage(b))return y+1;}return SEA+2;
  }
  function spawnPointIsSafe(pos){
    const [px,py,pz]=pos,x=Math.floor(px),z=Math.floor(pz),groundY=Math.floor(py-.12),ground=getBlock(x,groundY,z);
    if(!blockDefs[ground]?.solid||ground===B.WATER||ground===B.ICE||isFoliage(ground))return false;
    const feet=getBlock(x,Math.floor(py+.10),z),body=getBlock(x,Math.floor(py+.95),z),head=getBlock(x,Math.floor(py+1.72),z);
    if(feet===B.WATER||body===B.WATER||head===B.WATER)return false;
    return !aabbHitsWorld(playerAabbAt(px,py,pz));
  }
  function clearSpawnPocket(x,y,z){
    // Emergency-only fallback. It is better to trim a fern/one obstructing block than
    // respawn the player inside geometry with zero movement available.
    for(let yy=y;yy<=Math.min(WORLD_H-2,y+2);yy++){const id=getBlock(x,yy,z);if(id!==B.AIR&&id!==B.BEDROCK&&id!==B.WATER)setBlock(x,yy,z,B.AIR);}
    const floor=getBlock(x,y-1,z);if(!blockDefs[floor]?.solid||floor===B.WATER||floor===B.ICE||isFoliage(floor))setBlock(x,y-1,z,B.COBBLE);
    return[x+.5,y+.08,z+.5];
  }
  function findSafeSpawn(cx=0,cz=0,maxRadius=18){
    const candidates=[];
    for(let r=0;r<=maxRadius;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
      if(r>0&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;
      const x=Math.floor(cx+dx),z=Math.floor(cz+dz),y=findSurface(x,z),ground=getBlock(x,y-1,z);
      if(y<2||y>=WORLD_H-3||!blockDefs[ground]?.solid||ground===B.WATER||ground===B.ICE||isFoliage(ground)||blockDefs[ground]?.material==='wood')continue;
      const pos=[x+.5,y+.08,z+.5],ids=[getBlock(x,y,z),getBlock(x,y+1,z),getBlock(x,y+2,z)];
      if(ids.some(id=>id===B.WATER||id===B.BEDROCK))continue;
      // Remove only soft decoration / foliage before the collision check.
      for(let yy=y;yy<=y+2;yy++){const id=getBlock(x,yy,z);if(blockDefs[id]?.decor||isFoliage(id))setBlock(x,yy,z,B.AIR);}
      if(!spawnPointIsSafe(pos))continue;
      const h0=terrainHeight(x,z),h1=terrainHeight(x+1,z),h2=terrainHeight(x-1,z),h3=terrainHeight(x,z+1),h4=terrainHeight(x,z-1),slope=Math.max(Math.abs(h0-h1),Math.abs(h0-h2),Math.abs(h0-h3),Math.abs(h0-h4));
      candidates.push({pos,score:r*2+slope*.7});
      if(candidates.length>=8&&r>3)break;
    }
    if(candidates.length){candidates.sort((a,b)=>a.score-b.score);return candidates[0].pos;}
    const x=Math.floor(cx),z=Math.floor(cz),y=clamp(findSurface(x,z),2,WORLD_H-4);return clearSpawnPocket(x,y,z);
  }
  function resolvePlayerSpawnCollision(preferred,maxRadius=24){
    let p=[...preferred];if(spawnPointIsSafe(p))return p;
    p=findSafeSpawn(preferred[0],preferred[2],maxRadius);if(spawnPointIsSafe(p))return p;
    const x=Math.floor(preferred[0]),z=Math.floor(preferred[2]),y=clamp(findSurface(x,z),2,WORLD_H-4);p=clearSpawnPocket(x,y,z);
    // Absolute final guarantee: if an edited/fortified neighboring shape still overlaps,
    // scan a tiny local lattice for the first collision-free player AABB.
    if(!spawnPointIsSafe(p))for(let r=1;r<=4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const q=findSafeSpawn(x+dx,z+dz,2);if(spawnPointIsSafe(q))return q;}
    return p;
  }
  function findScenicSpawn(){
    // Sample a small deterministic set of candidates spread across a wide area.
    // This gives each seed a scenic start without making world creation expensive.
    let best={x:0,z:0,score:-1e9};
    const preferred=new Set(['forest','birch','poplar_grove','flower_meadow','meadow','old_growth','mist_forest','spruce_valley','taiga','autumn','riverlands','mountain_forest']);
    const candidates=[[0,0]];for(let i=0;i<34;i++){const rx=hash2i(i,worldSeed&65535,0x5ce1),rz=hash2i(i,(worldSeed>>>16)&65535,0x5ce2);candidates.push([Math.round((rx-.5)*1024/8)*8,Math.round((rz-.5)*1024/8)*8]);}
    for(const [wx,wz] of candidates){const h=terrainHeight(wx,wz),b=biomeAt(wx,wz,h);if(h<=SEA+2||h>72||['swamp','marsh','willow_swamp','red_barrens','barren','snow_peaks'].includes(b))continue;let lo=999,hi=-999,water=0,forest=0,slope=0;for(const [dx,dz] of [[-16,0],[16,0],[0,-16],[0,16],[-12,-12],[12,-12],[-12,12],[12,12]]){const hh=terrainHeight(wx+dx,wz+dz);lo=Math.min(lo,hh);hi=Math.max(hi,hh);if(hh<=SEA+1)water++;const bb=biomeAt(wx+dx,wz+dz,hh);if(preferred.has(bb))forest++;slope=Math.max(slope,Math.abs(h-hh));}const relief=hi-lo;let score=Math.min(relief,22)*2.4+water*3.5+forest*1.3+(preferred.has(b)?7.5:0)-Math.max(0,slope-15)*2.2-Math.abs(h-36)*.10;if(relief<4)score-=8;if(water>0&&water<6)score+=5.5;score+=(hash2i(wx,wz,worldSeed^0x5ce9)-.5)*3.5;if(score>best.score)best={x:wx,z:wz,score};}
    return findSafeSpawn(best.x,best.z,6);
  }

  // ---------------------------------------------------------------------------
  // Entity cube renderer
  // ---------------------------------------------------------------------------
  const cubeVerts=[];
  for(const f of faces)for(const v of f.v)cubeVerts.push(v[0]-.5,v[1]-.5,v[2]-.5);
  const cubeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cubeBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cubeVerts),gl.STATIC_DRAW);
  function modelMatrix(pos,scale,ry=0,rx=0,rz=0){let m=M4.translation(pos[0],pos[1],pos[2]);if(ry)m=M4.multiply(m,M4.rotY(ry));if(rx)m=M4.multiply(m,M4.rotX(rx));if(rz)m=M4.multiply(m,M4.rotZ(rz));m=M4.multiply(m,M4.scale(scale[0],scale[1],scale[2]));return m;}

  const outlineVerts=[0,0,0,1,0,0, 1,0,0,1,1,0, 1,1,0,0,1,0, 0,1,0,0,0,0, 0,0,1,1,0,1, 1,0,1,1,1,1, 1,1,1,0,1,1, 0,1,1,0,0,1, 0,0,0,0,0,1, 1,0,0,1,0,1, 1,1,0,1,1,1, 0,1,0,0,1,1];
  const outlineBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,outlineBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(outlineVerts),gl.STATIC_DRAW);
  const crackVerts=[];(()=>{
    const facesC=[['z',.0015],['z',.9985],['x',.0015],['x',.9985],['y',.0015],['y',.9985]];
    const ribbon=(axis,v,a,b,c,d,w)=>{
      const dx=c-a,dy=d-b,len=Math.hypot(dx,dy)||1,px=-dy/len*w,py=dx/len*w;
      const q=[[a+px,b+py],[a-px,b-py],[c-px,d-py],[a+px,b+py],[c-px,d-py],[c+px,d+py]];
      for(const[u,t]of q){if(axis==='z')crackVerts.push(u,t,v);else if(axis==='x')crackVerts.push(v,u,t);else crackVerts.push(u,v,t);}
    };
    for(let f=0;f<facesC.length;f++){const[axis,v]=facesC[f];for(let i=0;i<18;i++){
      const a=.07+((i*37+f*11)%84)/100,b=.07+((i*53+f*17)%84)/100,c=.07+((i*29+f*23)%84)/100,d=.07+((i*71+f*7)%84)/100;
      ribbon(axis,v,a,b,c,d,.036+(i%4===0?.018:0));
      if(i%3===0){const mx=(a+c)*.5,my=(b+d)*.5,ex=clamp(mx+(((i*19+f*13)%31)-15)/100,.06,.94),ey=clamp(my+(((i*23+f*7)%31)-15)/100,.06,.94);ribbon(axis,v,mx,my,ex,ey,.026);}
    }}
  })();
  const crackBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,crackBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(crackVerts),gl.STATIC_DRAW);

  const particleProgram=makeProgram(`
    attribute vec3 aPos; attribute vec4 aColor; attribute float aSize; uniform mat4 uVP; varying vec4 vColor;
    void main(){vColor=aColor;gl_Position=uVP*vec4(aPos,1.0);gl_PointSize=aSize;}
  `,`
    precision mediump float; varying vec4 vColor;
    void main(){vec2 p=gl_PointCoord-vec2(.5);if(dot(p,p)>.25)discard;gl_FragColor=vColor;}
  `);
  const PL={pos:gl.getAttribLocation(particleProgram,'aPos'),color:gl.getAttribLocation(particleProgram,'aColor'),size:gl.getAttribLocation(particleProgram,'aSize'),vp:gl.getUniformLocation(particleProgram,'uVP')};
  const particlePosBuffer=gl.createBuffer(),particleColorBuffer=gl.createBuffer(),particleSizeBuffer=gl.createBuffer();
  const particles=[];
  const blockParticlePalette={
    [B.GRASS]:[.23,.34,.18,1],[B.DIRT]:[.34,.25,.16,1],[B.STONE]:[.34,.36,.35,1],[B.SAND]:[.46,.42,.31,1],[B.WOOD]:[.28,.18,.11,1],[B.LEAVES]:[.12,.25,.13,1],[B.COAL]:[.08,.09,.085,1],[B.IRON]:[.48,.31,.24,1],[B.PLANKS]:[.39,.27,.16,1],[B.MOSS]:[.18,.29,.18,1],[B.GRAVEL]:[.34,.33,.30,1],[B.MUD]:[.20,.18,.13,1],[B.DARKSTONE]:[.18,.20,.21,1],[B.PINEWOOD]:[.23,.16,.11,1],[B.PINELEAVES]:[.08,.20,.11,1],[B.DEADWOOD]:[.18,.13,.10,1],[B.SNOW]:[.67,.69,.66,1],[B.CLAY]:[.42,.38,.33,1],[B.SLATE]:[.22,.25,.27,1],[B.ROOTS]:[.24,.16,.10,1]
  };
  function spawnParticle(pos,vel,life,color,size=4,gravity=6,drag=.4){if(particles.length>420)particles.splice(0,particles.length-420);particles.push({pos:[...pos],vel:[...vel],life,maxLife:life,color:[...color],size,gravity,drag});}
  function spawnDebris(x,y,z,id,count=10,violent=false){const mat=soundMaterialForBlock(id),fallback=mat==='wood'?[.32,.21,.12,1]:mat==='dirt'?[.33,.24,.15,1]:mat==='grass'||mat==='leaves'?[.17,.29,.14,1]:mat==='sand'?[.50,.44,.31,1]:mat==='snow'?[.72,.75,.72,1]:mat==='glass'?[.48,.64,.66,1]:mat==='metal'?[.48,.50,.49,1]:mat==='ore'?(id===B.GOLD?[.54,.42,.16,1]:id===B.IRON?[.48,.31,.24,1]:[.10,.10,.09,1]):mat==='gravel'?[.38,.36,.32,1]:[.35,.36,.35,1],c=blockParticlePalette[id]||fallback;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(violent?2.8:1.5)*(0.35+Math.random());spawnParticle([x+.5+(Math.random()-.5)*.6,y+.5+(Math.random()-.5)*.6,z+.5+(Math.random()-.5)*.6],[Math.cos(a)*s,(violent?2.0:1.1)+Math.random()*2.0,Math.sin(a)*s],.35+Math.random()*.55,[c[0]*(.75+Math.random()*.4),c[1]*(.75+Math.random()*.4),c[2]*(.75+Math.random()*.4),1],3+Math.random()*3,8,.8);}}
  function spawnBlood(pos,count=8){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=.6+Math.random()*2.2;spawnParticle([pos[0],pos[1]+.9,pos[2]],[Math.cos(a)*s,.7+Math.random()*2.3,Math.sin(a)*s],.3+Math.random()*.35,[.38+.18*Math.random(),.025,.02,.95],3+Math.random()*3,9,1.2);}}
  function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.vel[1]-=p.gravity*dt;const drag=Math.max(0,1-p.drag*dt);p.vel[0]*=drag;p.vel[2]*=drag;p.pos[0]+=p.vel[0]*dt;p.pos[1]+=p.vel[1]*dt;p.pos[2]+=p.vel[2]*dt;if(p.gravity>0&&blockDefs[getBlock(p.pos[0],p.pos[1],p.pos[2])]?.solid){p.life=Math.min(p.life,.06);}}}

  // Minecraft-like world item entities. Broken blocks pop out, bounce, spin, then
  // get pulled into the player after a short pickup delay. Full inventories leave
  // the remaining stack on the ground instead of silently deleting/duplicating it.
  const droppedItems=[];
  function inventoryCapacity(id){const max=maxStackFor(id);let cap=0;for(const st of player.slots){if(!st)cap+=max;else if(st.id===id)cap+=Math.max(0,max-st.count);}return cap;}
  function canStoreStacks(stacks){
    const sim=player.slots.map(cloneStack);
    for(const raw of stacks){const st=normalizeStack(raw);if(!st)continue;let left=st.count,max=maxStackFor(st.id);
      for(let i=0;i<sim.length&&left>0;i++){const q=sim[i];if(q?.id===st.id&&q.count<max){const take=Math.min(max-q.count,left);q.count+=take;left-=take;}}
      for(let i=0;i<sim.length&&left>0;i++)if(!sim[i]){const take=Math.min(max,left);sim[i]={id:st.id,count:take};left-=take;}
      if(left>0)return false;
    }return true;
  }
  function spawnItemDrop(id,count,pos,vel=null,pickupDelay=.45){
    if(!itemDefs[id]||count<=0)return null;let left=Math.floor(count),max=maxStackFor(id);
    for(const d of droppedItems){if(d.id!==id||d.count>=max||dist3(d.pos,pos)>1.15||d.age>.8)continue;const take=Math.min(max-d.count,left);d.count+=take;left-=take;if(left<=0)return d;}
    let first=null;while(left>0){const take=Math.min(max,left),a=Math.random()*Math.PI*2,v=vel?[...vel]:[Math.cos(a)*(.45+Math.random()*.55),2.1+Math.random()*1.4,Math.sin(a)*(.45+Math.random()*.55)];const d={id,count:take,pos:[...pos],vel:v,age:0,pickupDelay,spin:Math.random()*Math.PI*2,bob:Math.random()*Math.PI*2,onGround:false};droppedItems.push(d);if(!first)first=d;left-=take;}if(droppedItems.length>180)droppedItems.splice(0,droppedItems.length-180);return first;
  }
  function tryPickupDrop(d){
    const cap=inventoryCapacity(d.id);if(cap<=0)return false;const take=Math.min(cap,d.count),before=d.count;if(!addItem(d.id,take))return false;d.count-=take;if(before!==d.count)sfx('pickup',.74);return d.count<=0;
  }
  function updateDroppedItems(dt){
    for(let i=droppedItems.length-1;i>=0;i--){const d=droppedItems[i];d.age+=dt;d.spin+=dt*(1.65+Math.min(1,Math.hypot(...(d.vel||[0,0,0]))));if(d.age>300){droppedItems.splice(i,1);continue;}
      const bx=Math.floor(d.pos[0]),by=Math.floor(d.pos[1]-.17),bz=Math.floor(d.pos[2]),here=getBlock(bx,Math.floor(d.pos[1]),bz),below=getBlock(bx,by,bz);const inWater=here===B.WATER;
      if(inWater){d.vel[1]+=8.5*dt;d.vel[0]*=Math.pow(.35,dt);d.vel[2]*=Math.pow(.35,dt);d.vel[1]*=Math.pow(.28,dt);}else d.vel[1]-=16.5*dt;
      d.pos[0]+=d.vel[0]*dt;d.pos[1]+=d.vel[1]*dt;d.pos[2]+=d.vel[2]*dt;d.vel[0]*=Math.pow(.55,dt);d.vel[2]*=Math.pow(.55,dt);
      const gy=Math.floor(d.pos[1]-.18),gid=getBlock(Math.floor(d.pos[0]),gy,Math.floor(d.pos[2]));if(blockDefs[gid]?.solid&&gid!==B.WATER&&d.vel[1]<=0){const top=gy+1+.18;if(d.pos[1]<top+.08){d.pos[1]=top;d.vel[1]*=-.10;d.vel[0]*=.68;d.vel[2]*=.68;d.onGround=true;}}
      const dx=player.pos[0]-d.pos[0],dy=(player.pos[1]+.75)-d.pos[1],dz=player.pos[2]-d.pos[2],dist=Math.hypot(dx,dy,dz);
      if(d.age>d.pickupDelay&&dist<2.75){const pull=clamp((2.8-dist)*5.4,2.2,12)*dt;d.pos[0]+=dx/(dist||1)*pull;d.pos[1]+=dy/(dist||1)*pull;d.pos[2]+=dz/(dist||1)*pull;if(dist<.72&&tryPickupDrop(d)){droppedItems.splice(i,1);continue;}}
    }
  }

  // ---------------------------------------------------------------------------
  // Audio — real local WAV assets + WebAudio mixer + HTMLAudio emergency path.
  // ---------------------------------------------------------------------------
  const audio={
    ctx:null,master:null,sfxGain:null,ambientGain:null,musicGain:null,volume:.82,
    buffers:{},sampleLoadStarted:false,sampleLoadDone:false,eveningLoop:null,musicLoop:null,
    ambientClock:1.5,unlocked:false,htmlVoices:new Set()
  };
  const audioFiles={
    step_grass:'assets/audio/step_grass.wav',step_dirt:'assets/audio/step_dirt.wav',step_stone:'assets/audio/step_stone.wav',
    step_wood:'assets/audio/step_wood.wav',step_sand:'assets/audio/step_sand.wav',step_snow:'assets/audio/step_snow.wav',
    block_hit:'assets/audio/block_hit.wav',block_break:'assets/audio/block_break.wav',block_place:'assets/audio/block_place.wav',torch_place:'assets/audio/torch_place.wav',
    splash:'assets/audio/splash.wav',swim:'assets/audio/swim.wav',hurt:'assets/audio/hurt.wav',mob_hit:'assets/audio/mob_hit.wav',
    thunder:'assets/audio/thunder.wav',howl:'assets/audio/howl.wav',growl:'assets/audio/growl.wav',
    evening:'assets/audio/evening_ambience.wav',music:'assets/audio/dark_ambient_music.wav',bird:'assets/audio/bird.wav',crow:'assets/audio/crow.wav',
    wind:'assets/audio/wind_gust.wav',drip:'assets/audio/cave_drip.wav',creak:'assets/audio/wood_creak.wav',inventory:'assets/audio/inventory_click.wav',
    craft:'assets/audio/craft.wav',eat:'assets/audio/eat.wav',chest:'assets/audio/chest.wav',heartbeat:'assets/audio/heartbeat.wav',fire:'assets/audio/fire_crackle.wav',water_lap:'assets/audio/water_lap.wav',pickup1:'assets/audio/item_pickup_1.wav',pickup2:'assets/audio/item_pickup_2.wav'
  };
  const BLOCK_SOUND_MATERIALS=['grass','dirt','mud','clay','stone','cobble','brick','wood','plank','sand','snow','gravel','leaves','glass','metal','ore'];
  for(const mat of BLOCK_SOUND_MATERIALS)for(const action of['hit','break','place'])for(let v=1;v<=2;v++)audioFiles[`block_${action}_${mat}_${v}`]=`assets/audio/block_${action}_${mat}_${v}.wav`;
  for(const mat of BLOCK_SOUND_MATERIALS)for(let v=1;v<=2;v++)audioFiles[`step_${mat}_${v}`]=`assets/audio/step_${mat}_${v}.wav`;
  function soundMaterialForBlock(id){
    if([B.LEAVES,B.PINELEAVES,B.BIRCHLEAVES,B.DARKLEAVES,B.AUTUMNLEAVES,B.WILLOWLEAVES,B.POPLARLEAVES,B.MIMOSALEAVES,B.TALLGRASS,B.FERN,B.BUSH,B.DRY_BUSH,B.HEATHER,B.REEDS,B.RED_FLOWER,B.WHITE_FLOWER,B.BLUE_FLOWER,B.YELLOW_FLOWER].includes(id))return'leaves';
    if([B.GRASS,B.MOSSY_DIRT,B.DRY_GRASS,B.FOREST_GRASS,B.FROST_GRASS].includes(id))return'grass';
    if([B.MUD,B.PEAT,B.SILT].includes(id))return'mud';
    if([B.CLAY].includes(id))return'clay';
    if([B.DIRT,B.LOAM,B.PODZOL,B.CAVE_DIRT].includes(id))return'dirt';
    if([B.GRAVEL,B.RUBBLE].includes(id))return'gravel';
    if([B.SAND,B.RED_SAND,B.ASH_BLOCK,B.SANDSTONE].includes(id))return'sand';
    if([B.SNOW].includes(id))return'snow';
    if([B.GLASS,B.ICE].includes(id))return'glass';
    if([B.IRON_BLOCK,B.GOLD_BLOCK].includes(id))return'metal';
    if([B.COAL,B.IRON,B.GOLD].includes(id))return'ore';
    if([B.PLANKS,B.OLD_PLANKS,B.DARK_PLANKS,B.CHEST,B.WOOD_DOOR,B.WOOD_STAIRS,B.WOOD_FENCE].includes(id))return'plank';
    if([B.WOOD,B.PINEWOOD,B.BIRCHWOOD,B.DARKWOOD,B.WILLOWWOOD,B.POPLARWOOD,B.MIMOSAWOOD,B.DEADWOOD].includes(id))return'wood';
    if([B.COBBLE,B.RIVER_ROCK].includes(id))return'cobble';
    if([B.STONE_BRICKS,B.CRACKED_BRICKS,B.MOSSY_BRICKS,B.CHISELED_STONE,B.WEATHERED_BRICKS,B.OLD_TILES,B.GRAVE_STONE,B.RUNE_STONE].includes(id))return'brick';
    const m=blockDefs[id]?.material;
    return m==='wood'?'wood':m==='sand'?'sand':m==='snow'?'snow':m==='glass'?'glass':m==='metal'?'metal':m==='dirt'?'dirt':'stone';
  }
  function makeNoiseBuffer(seconds=.5){const c=audio.ctx,len=Math.max(1,Math.floor(c.sampleRate*seconds)),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return buf;}
  function tone(freq,dur,gain=.04,type='sine',slide=.8,when=0){if(!audio.ctx)return;const c=audio.ctx,t=c.currentTime+when,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(18,freq*slide),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audio.sfxGain||audio.master);o.start(t);o.stop(t+dur+.03);}
  function noiseBurst(dur=.08,gain=.04,cut=700,when=0){if(!audio.ctx)return;const c=audio.ctx,t=c.currentTime+when,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=makeNoiseBuffer(Math.max(.12,dur));f.type='lowpass';f.frequency.value=cut;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(f);f.connect(g);g.connect(audio.sfxGain||audio.master);src.start(t);src.stop(t+dur+.02);}
  function htmlPlay(name,gain=1,rate=1){
    const url=audioFiles[name];if(!url||typeof Audio==='undefined')return false;
    try{const a=new Audio(url);a.preload='auto';a.volume=clamp(audio.volume*gain*.95,0,1);a.playbackRate=clamp(rate,.65,1.55);audio.htmlVoices.add(a);const done=()=>audio.htmlVoices.delete(a);a.addEventListener('ended',done,{once:true});a.addEventListener('error',done,{once:true});const pr=a.play();if(pr?.catch)pr.catch(done);return true;}catch{return false;}
  }
  function playSample(name,gain=1,rate=1,detune=0){
    if(audio.ctx&&audio.buffers[name]){const src=audio.ctx.createBufferSource(),g=audio.ctx.createGain();src.buffer=audio.buffers[name];src.playbackRate.value=rate;src.detune.value=detune;g.gain.value=gain;src.connect(g);g.connect(audio.sfxGain||audio.master);src.start();return true;}
    return htmlPlay(name,gain,rate);
  }
  function startAmbientLoops(){
    if(!audio.ctx)return;
    if(audio.buffers.evening&&!audio.eveningLoop){const src=audio.ctx.createBufferSource(),g=audio.ctx.createGain();src.buffer=audio.buffers.evening;src.loop=true;g.gain.value=.0001;src.connect(g);g.connect(audio.ambientGain);src.start();audio.eveningLoop={src,g};}
    if(audio.buffers.music&&!audio.musicLoop){const src=audio.ctx.createBufferSource(),g=audio.ctx.createGain();src.buffer=audio.buffers.music;src.loop=true;g.gain.value=.0001;src.connect(g);g.connect(audio.musicGain);src.start();audio.musicLoop={src,g};}
  }
  async function loadAudioSamples(){
    if(audio.sampleLoadStarted||!audio.ctx)return;audio.sampleLoadStarted=true;
    const loadOne=async([key,url])=>{try{const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw new Error(String(res.status));const arr=await res.arrayBuffer();audio.buffers[key]=await audio.ctx.decodeAudioData(arr);}catch(err){console.warn('Audio asset fallback:',key,err);}};
    // Decode a small high-priority set first, then the large material library in
    // batches. This avoids a one-frame storm of ~160 simultaneous decodes while
    // HTMLAudio remains a fallback for a sample requested before its buffer exists.
    const priorityKeys=new Set(['evening','music','hurt','heartbeat','thunder','splash','swim','pickup1','pickup2','step_grass_1','step_grass_2','step_stone_1','step_stone_2','block_hit_dirt_1','block_break_dirt_1','block_place_dirt_1']);
    const entries=Object.entries(audioFiles),priority=entries.filter(([k])=>priorityKeys.has(k)),rest=entries.filter(([k])=>!priorityKeys.has(k));
    await Promise.all(priority.map(loadOne));startAmbientLoops();
    for(let i=0;i<rest.length;i+=12){await Promise.all(rest.slice(i,i+12).map(loadOne));await Promise.resolve();}
    audio.sampleLoadDone=true;startAmbientLoops();
  }
  function initAudio(){
    if(audio.ctx){audio.ctx.resume?.();startAmbientLoops();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    audio.ctx=new AC();
    const comp=audio.ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=16;comp.ratio.value=2.7;comp.attack.value=.003;comp.release.value=.22;
    audio.master=audio.ctx.createGain();audio.sfxGain=audio.ctx.createGain();audio.ambientGain=audio.ctx.createGain();audio.musicGain=audio.ctx.createGain();
    audio.master.gain.value=audio.volume;audio.sfxGain.gain.value=1.35;audio.ambientGain.gain.value=.98;audio.musicGain.gain.value=.72;
    audio.sfxGain.connect(comp);audio.ambientGain.connect(comp);audio.musicGain.connect(comp);comp.connect(audio.master);audio.master.connect(audio.ctx.destination);
    void loadAudioSamples();
  }
  function unlockAudio(){
    initAudio();audio.unlocked=true;
    if(audio.ctx?.state!=='running')audio.ctx?.resume?.();
    startAmbientLoops();
  }
  window.addEventListener('pointerdown',unlockAudio,{capture:true,passive:true});
  window.addEventListener('keydown',unlockAudio,{capture:true});
  function sfx(type,amount=1,material='generic'){
    unlockAudio();const a=amount;
    if(type==='step'){const mat=BLOCK_SOUND_MATERIALS.includes(material)?material:'stone',key=`step_${mat}_${1+(Math.random()>.5?1:0)}`;if(playSample(key,1.02*a,.88+Math.random()*.22,(Math.random()-.5)*110))return;const legacy='step_'+(['grass','dirt','stone','wood','sand','snow'].includes(mat)?mat:'stone');if(playSample(legacy,.95*a,.9+Math.random()*.18))return;noiseBurst(.10,.09*a,mat==='stone'||mat==='metal'?1800:1050);return;}
    if(type==='splash'){if(playSample('splash',1.0*a,.93+Math.random()*.10))return;noiseBurst(.24,.13*a,1200);return;}
    if(type==='swim'){if(playSample('swim',.78*a,.88+Math.random()*.18))return;noiseBurst(.15,.08*a,760);return;}
    if(type==='mine'||type==='break'||type==='place'){const mat=BLOCK_SOUND_MATERIALS.includes(material)?material:'stone',action=type==='mine'?'hit':type,variant=1+(Math.random()>.5?1:0),key=`block_${action}_${mat}_${variant}`,gain=(type==='mine'?.88:type==='break'?1.04:.94)*a,rate=(type==='break'?.93:.97)+(Math.random()-.5)*.12;if(playSample(key,gain,rate,(Math.random()-.5)*55))return;const fallback=type==='mine'?'block_hit':type==='break'?'block_break':'block_place';if(playSample(fallback,gain,rate))return;noiseBurst(type==='break'?.20:.09,.11*a,mat==='metal'||mat==='glass'?1900:1250);return;}
    if(type==='torch'){if(playSample('torch_place',1.05*a,.91+Math.random()*.14))return;tone(720,.09,.07*a,'sine',1.18);return;}
    if(type==='pickup'){if(playSample(Math.random()>.5?'pickup1':'pickup2',.85*a,.94+Math.random()*.12))return;tone(520,.08,.05*a,'sine',1.42);return;}
    if(type==='hit'){if(playSample('mob_hit',1.04*a,.86+Math.random()*.21))return;noiseBurst(.11,.12*a,1600);return;}
    if(type==='hurt'){if(playSample('hurt',1.08*a,.92+Math.random()*.12))return;noiseBurst(.16,.14*a,900);return;}
    if(type==='howl'){if(playSample('howl',.88*a,.92+Math.random()*.10))return;tone(175,.85,.10*a,'sine',2.05);return;}
    if(type==='growl'){if(playSample('growl',.84*a,.84+Math.random()*.18))return;noiseBurst(.26,.11*a,420);return;}
    if(type==='thunder'){if(playSample('thunder',1.1*a,.90+Math.random()*.09))return;noiseBurst(1.45,.26*a,520);return;}
    if(type==='bird'){playSample('bird',.45*a,.88+Math.random()*.30);return;}
    if(type==='crow'){playSample('crow',.52*a,.88+Math.random()*.18);return;}
    if(type==='wind'){playSample('wind',.38*a,.85+Math.random()*.22);return;}
    if(type==='drip'){playSample('drip',.34*a,.88+Math.random()*.28);return;}
    if(type==='creak'){playSample('creak',.34*a,.82+Math.random()*.22);return;}
    if(type==='craft'){if(playSample('craft',.70*a,.95+Math.random()*.08))return;tone(420,.08,.06*a,'sine',1.32);return;}
    if(type==='eat'){if(playSample('eat',.72*a,.91+Math.random()*.18))return;noiseBurst(.09,.055*a,1400);return;}
    if(type==='inventory'){if(playSample('inventory',.52*a,.92+Math.random()*.16))return;tone(260,.045,.018*a,'square',1.08);return;}
    if(type==='chest'){if(playSample('chest',.78*a,.95+Math.random()*.08))return;tone(118,.16,.05*a,'triangle',.62);return;}
    if(type==='fire'){playSample('fire',.36*a,.94+Math.random()*.10);return;}
    if(type==='water_lap'){playSample('water_lap',.34*a,.91+Math.random()*.14);return;}
  }
  function ambientAudioTick(dt,night){
    if(!audio.ctx)return;
    const ph=(worldSeconds%DAY_SECONDS)/DAY_SECONDS,dusk=Math.max(0,1-Math.abs(ph-.73)/.20),dawn=Math.max(0,1-Math.abs(ph-.23)/.14);
    const underground=player.pos[1]<terrainHeight(Math.floor(player.pos[0]),Math.floor(player.pos[2]))-4;
    const eveningLevel=clamp(.22+dusk*.90+night*.32+dawn*.18,0,1)*(underground?.22:1);
    if(audio.eveningLoop)audio.eveningLoop.g.gain.value=lerp(audio.eveningLoop.g.gain.value,.46*eveningLevel,.025);
    if(audio.musicLoop)audio.musicLoop.g.gain.value=lerp(audio.musicLoop.g.gain.value,.13*(.3+night*.95),.018);
    audio.ambientClock-=dt;if(audio.ambientClock>0)return;
    audio.ambientClock=1.9+Math.random()*5.2;const r=Math.random();
    if(hasHeldTorch()||nearestPlacedTorch())if(Math.random()<.42)sfx('fire',.6);
    const px=Math.floor(player.pos[0]),py=Math.floor(player.pos[1]),pz=Math.floor(player.pos[2]);let shore=false;for(const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3],[6,0],[-6,0],[0,6],[0,-6]])if(getBlock(px+dx,Math.max(1,Math.min(SEA,py)),pz+dz)===B.WATER||terrainHeight(px+dx,pz+dz)<=SEA){shore=true;break;}if(shore&&Math.random()<.26)sfx('water_lap',.6);
    if(underground){if(r<.52)sfx('drip',.7);else if(r<.66)sfx('creak',.45);return;}
    if(night>.64){if(r<.14)sfx('growl',.20);else if(r<.23)sfx('howl',.16);else if(r<.36)sfx('wind',.45);}
    else{if(r<.33)sfx('bird',.8);else if(r<.43)sfx('crow',.75);else if(r<.54)sfx('wind',.35);}
  }
  function setAudioVolume(v){audio.volume=clamp(Number(v)||0,0,1);if(audio.master)audio.master.gain.value=audio.volume;for(const a of audio.htmlVoices)a.volume=clamp(audio.volume*.8,0,1);}

  // ---------------------------------------------------------------------------
  // Buildable fortifications / upgrade ladder
  // ---------------------------------------------------------------------------
  const FORT_TIERS=[
    {name:'DREWNO',maxHp:80,hard:1.0,cost:null,color:[.34,.23,.14,1]},
    {name:'WZMOCNIONE DREWNO',maxHp:135,hard:1.35,cost:{id:'planks',count:1},color:[.45,.31,.18,1]},
    {name:'BRUK',maxHp:220,hard:1.9,cost:{id:'cobble',count:1},color:[.34,.35,.33,1]},
    {name:'PRZEPALONY KAMIEŃ',maxHp:320,hard:2.5,cost:{id:'smooth_stone',count:1},color:[.43,.45,.43,1]},
    {name:'KAMIENNA CEGŁA',maxHp:455,hard:3.2,cost:{id:'stone_bricks',count:1},color:[.39,.40,.37,1]},
    {name:'ŻELAZO',maxHp:700,hard:4.4,cost:{id:'iron_ingot',count:1},color:[.40,.43,.42,1]}
  ];
  const UPGRADEABLE_BLOCKS=new Set([B.PLANKS,B.OLD_PLANKS,B.DARK_PLANKS,B.WOOD,B.PINEWOOD,B.BIRCHWOOD,B.DARKWOOD,B.WILLOWWOOD,B.POPLARWOOD,B.MIMOSAWOOD,B.DEADWOOD,B.WOOD_DOOR,B.WOOD_STAIRS,B.WOOD_FENCE]);
  function fortKey(x,y,z){return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;}
  function isUpgradeableBlockId(id){return UPGRADEABLE_BLOCKS.has(id);}
  function ensureFortification(x,y,z,id=getBlock(x,y,z),create=true){const key=fortKey(x,y,z);let f=fortifications.get(key);if(f)return f;if(!create||!isUpgradeableBlockId(id)||!edits.has(key))return null;const t=FORT_TIERS[0];f={tier:0,hp:t.maxHp,maxHp:t.maxHp,type:blockDefs[id]?.construction||'wall',orientation:0,open:false,lastHit:0};fortifications.set(key,f);return f;}
  function fortTierAt(x,y,z){return ensureFortification(x,y,z,getBlock(x,y,z),false)?.tier||0;}
  function blockHardnessAt(x,y,z,id){const f=ensureFortification(x,y,z,id,false);return (blockDefs[id]?.hard||1)*(f?FORT_TIERS[f.tier].hard:1);}
  function damageFortification(x,y,z,amount,source='drapieżnik'){const key=fortKey(x,y,z),id=getBlock(x,y,z),f=ensureFortification(x,y,z,id,true);if(!f)return false;f.hp-=amount;f.lastHit=performance.now();spawnDebris(x,y,z,id,4,false);sfx('mine',.45,soundMaterialForBlock(id));if(f.hp<=0){fortifications.delete(key);if(id===B.FURNACE)furnaces.delete(key);setBlock(x,y,z,B.AIR);spawnDebris(x,y,z,id,16,true);sfx('break',1,soundMaterialForBlock(id));showMessage(`${source.toUpperCase()} PRZEBIŁ KONSTRUKCJĘ`,1.2);}return true;}
  function constructionStateAt(x,y,z){return fortifications.get(fortKey(x,y,z))||null;}
  function constructionColor(f){return FORT_TIERS[clamp(f?.tier||0,0,FORT_TIERS.length-1)].color;}
  let upgradeTargetKey='',upgradeHold=0,upgradeMessageCooldown=0;
  function updateFortifyHud(hit=null){if(!UI.fortifyHud)return;if(!hit){UI.fortifyHud.classList.add('hidden');return;}const f=ensureFortification(hit.x,hit.y,hit.z,hit.id,false);if(!f){UI.fortifyHud.classList.add('hidden');return;}const tier=FORT_TIERS[f.tier],next=FORT_TIERS[f.tier+1];UI.fortifyHud.classList.remove('hidden');UI.fortifyHud.classList.toggle('upgrading',input.mouseMiddle&&upgradeTargetKey===fortKey(hit.x,hit.y,hit.z));UI.fortifyName.textContent=`${tier.name} · LVL ${f.tier}`;UI.fortifyHp.textContent=`${Math.max(0,Math.ceil(f.hp))} / ${f.maxHp}`;UI.fortifyFill.style.width=`${clamp(f.hp/f.maxHp*100,0,100)}%`;UI.fortifyNext.textContent=next?`ŚPM przytrzymaj: ${itemDefs[next.cost.id]?.name||next.cost.id} ×${next.cost.count} · ${(upgradeHold/.72*100|0)}%`:'MAKSYMALNE WZMOCNIENIE';}
  function updateUpgrade(dt){upgradeMessageCooldown=Math.max(0,upgradeMessageCooldown-dt);if(!input.mouseMiddle||paused){upgradeHold=0;upgradeTargetKey='';updateFortifyHud(currentTarget);return;}const hit=voxelRaycast(eyePos(),lookDir(),6);if(!hit){upgradeHold=0;upgradeTargetKey='';updateFortifyHud(null);return;}const key=fortKey(hit.x,hit.y,hit.z),f=ensureFortification(hit.x,hit.y,hit.z,hit.id,true);if(!f){upgradeHold=0;upgradeTargetKey='';updateFortifyHud(null);return;}if(key!==upgradeTargetKey){upgradeTargetKey=key;upgradeHold=0;}const next=FORT_TIERS[f.tier+1];if(!next){upgradeHold=0;updateFortifyHud(hit);return;}if(countItem(next.cost.id)<next.cost.count){if(upgradeMessageCooldown<=0){showMessage(`Potrzebujesz: ${itemDefs[next.cost.id]?.name||next.cost.id} ×${next.cost.count}`,1.2);upgradeMessageCooldown=.9;}upgradeHold=0;updateFortifyHud(hit);return;}upgradeHold+=dt;if(upgradeHold>=.72){removeItem(next.cost.id,next.cost.count);f.tier++;f.maxHp=FORT_TIERS[f.tier].maxHp;f.hp=f.maxHp;upgradeHold=0;player.toolSwing=1;sfx('place',1,f.tier===1?'plank':f.tier===2?'cobble':f.tier===4?'brick':f.tier===5?'metal':'stone');spawnDebris(hit.x,hit.y,hit.z,hit.id,10,true);showMessage(`ULEPSZONO: ${FORT_TIERS[f.tier].name} · ${f.maxHp} HP`,1.5);}updateFortifyHud(hit);}

  // ---------------------------------------------------------------------------
  // Player, inventory, controls
  // ---------------------------------------------------------------------------
  const INVENTORY_SIZE=36,HOTBAR_SIZE=9,DEFAULT_STACK=64;
  const player={
    pos:[0,26,0],vel:[0,0,0],yaw:0,pitch:-.1,height:1.8,eye:1.62,width:.31,
    health:100,hunger:100,stamina:100,sanity:100,grounded:false,inWater:false,
    selected:0,offhand:null,slots:Array(INVENTORY_SIZE).fill(null),craftSlots:Array(9).fill(null),
    torchRaised:false,attackCooldown:0,damageCooldown:0,fallSpeed:0,kills:0,blocksMined:0,days:0,stepTimer:0,
    movePhase:0,bob:0,sway:0,impact:0,toolSwing:0,toolSwingSide:1,lastGroundY:0,wasInWater:false,swimSound:0,stepDistance:0,threat:0,cameraShake:0,heartbeat:0
  };
  const input={keys:new Set(),mouseLeft:false,mouseRight:false,mouseMiddle:false,locked:false,sensitivity:.0115};
  let inventoryOpen=false,adminOpen=false,furnaceOpen=false,mapOpen=false,paused=true,dead=false,running=false,debug=false,adminMode=false;
  let currentTarget=null,mineTargetKey='',mineAmount=0,messageTimer=0,cursorStack=null,dragSource=null;
  let cursorX=innerWidth*.5,cursorY=innerHeight*.5,slotPaint={active:false,visited:new Set()};
  let starterChestPos=null,starterChestLoot=Array(9).fill(null),chestOpen=false,furnaceActiveKey=null;

  const cloneStack=(st)=>st?{id:st.id,count:st.count}:null;
  const maxStackFor=(id)=>itemDefs[id]?.maxStack||DEFAULT_STACK;
  function normalizeStack(st){if(!st||!st.id||st.count<=0)return null;return{id:st.id,count:Math.max(1,Math.floor(st.count))};}
  function countItem(id){let n=0;for(const st of player.slots)if(st?.id===id)n+=st.count;if(player.offhand?.id===id)n+=player.offhand.count;return n;}
  function firstEmptySlot(rangeStart=0,rangeEnd=INVENTORY_SIZE){for(let i=rangeStart;i<rangeEnd;i++)if(!player.slots[i])return i;return-1;}
  function addItem(id,count=1,preferredSlot=-1){
    if(!itemDefs[id]||count<=0)return false;count=Math.floor(count);if(inventoryCapacity(id)<count)return false;let left=count,max=maxStackFor(id);
    if(preferredSlot>=0&&preferredSlot<INVENTORY_SIZE){
      const st=player.slots[preferredSlot];
      if(!st){const take=Math.min(max,left);player.slots[preferredSlot]={id,count:take};left-=take;}
      else if(st.id===id&&st.count<max){const take=Math.min(max-st.count,left);st.count+=take;left-=take;}
    }
    for(let i=0;i<INVENTORY_SIZE&&left>0;i++){const st=player.slots[i];if(st?.id===id&&st.count<max){const take=Math.min(max-st.count,left);st.count+=take;left-=take;}}
    for(let i=0;i<INVENTORY_SIZE&&left>0;i++)if(!player.slots[i]){const take=Math.min(max,left);player.slots[i]={id,count:take};left-=take;}
    refreshInventoryUI();refreshHotbar();return left===0;
  }
  function removeItem(id,count=1){
    if(countItem(id)<count)return false;let left=count;
    for(let i=INVENTORY_SIZE-1;i>=0&&left>0;i--){const st=player.slots[i];if(st?.id===id){const take=Math.min(st.count,left);st.count-=take;left-=take;if(st.count<=0)player.slots[i]=null;}}
    if(left>0&&player.offhand?.id===id){const take=Math.min(player.offhand.count,left);player.offhand.count-=take;left-=take;if(player.offhand.count<=0)player.offhand=null;}
    refreshInventoryUI();refreshHotbar();return left===0;
  }
  function selectedStack(){return normalizeStack(player.slots[player.selected]);}
  function selectedItem(){return selectedStack()?.id||null;}
  function offhandItem(){return normalizeStack(player.offhand)?.id||null;}
  function hasHeldTorch(){return selectedItem()==='torch'||offhandItem()==='torch'||(player.torchRaised&&countItem('torch')>0);}
  function equippedPowerFor(blockId){
    const item=itemDefs[selectedItem()]||{},need=blockDefs[blockId]?.tool;
    if(!need)return item.tool?1.10:.92;
    if(item.tool===need)return item.power||2.6;
    // Wrong tool and bare hand always work, but they are clearly slower. Wooden
    // tools are deliberately early-game tools instead of instant block erasers.
    if(item.tool)return .88;
    return .68;
  }
  function miningSecondsFor(blockId,x=0,y=0,z=0){return Math.max(.11,blockHardnessAt(x,y,z,blockId)*1.12/Math.max(.05,equippedPowerFor(blockId)));}
  function heldDamage(){const it=itemDefs[selectedItem()]||{};return it.damage||3;}
  function lookDir(){const cp=Math.cos(player.pitch);return [Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp];}
  function eyePos(){return[player.pos[0],player.pos[1]+player.eye,player.pos[2]];}
  function cameraEyePos(){const base=eyePos(),right=[Math.cos(player.yaw),0,Math.sin(player.yaw)],sh=player.cameraShake||0,t=performance.now()*.045;return[base[0]+right[0]*player.sway*.45+Math.sin(t*1.7)*sh*.045,base[1]+player.bob-player.impact*.028+Math.cos(t*2.1)*sh*.028,base[2]+right[2]*player.sway*.45+Math.cos(t*1.3)*sh*.045];}
  function playerAabbAt(x,y,z){return[x-player.width,y,z-player.width,x+player.width,y+player.height,z+player.width];}
  function blockSolidAt(x,y,z){const b=getBlock(x,y,z);if(b===B.WOOD_DOOR){const f=fortifications.get(fortKey(x,y,z));return !f?.open;}return !!blockDefs[b]?.solid;}
  function aabbOverlap(a,b){return a[0]<b[3]&&a[3]>b[0]&&a[1]<b[4]&&a[4]>b[1]&&a[2]<b[5]&&a[5]>b[2];}
  function constructionCollisionBoxes(x,y,z,id){
    const f=ensureFortification(x,y,z,id,true),q=((Math.round((f?.orientation||0)/(Math.PI/2))%4)+4)%4;
    if(id===B.WOOD_DOOR){if(f?.open)return[];const alongX=(q%2)===0;return[alongX?[x+.08,y,z+.445,x+.92,y+1.9,z+.555]:[x+.445,y,z+.08,x+.555,y+1.9,z+.92]];}
    if(id===B.WOOD_FENCE){return[[x+.41,y,z+.41,x+.59,y+1.08,z+.59],[x+.04,y+.28,z+.435,x+.96,y+.76,z+.565],[x+.435,y+.28,z+.04,x+.565,y+.76,z+.96]];}
    if(id===B.WOOD_STAIRS){const boxes=[[x,y,z,x+1,y+.50,z+1]];if(q===0)boxes.push([x,y+.50,z,x+1,y+1,z+.50]);else if(q===2)boxes.push([x,y+.50,z+.50,x+1,y+1,z+1]);else if(q===1)boxes.push([x,y+.50,z,x+.50,y+1,z+1]);else boxes.push([x+.50,y+.50,z,x+1,y+1,z+1]);return boxes;}
    return[[x,y,z,x+1,y+1,z+1]];
  }
  function aabbHitsWorld(a){
    const minX=Math.floor(a[0]),minY=Math.floor(a[1]+1e-5),minZ=Math.floor(a[2]),maxX=Math.floor(a[3]-1e-5),maxY=Math.floor(a[4]-1e-5),maxZ=Math.floor(a[5]-1e-5);
    for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const id=getBlock(x,y,z);if(!blockSolidAt(x,y,z))continue;if(id===B.WOOD_DOOR||id===B.WOOD_STAIRS||id===B.WOOD_FENCE){for(const box of constructionCollisionBoxes(x,y,z,id))if(aabbOverlap(a,box))return true;}else return true;}return false;
  }
  function playerGroundedAt(pos=player.pos){return aabbHitsWorld(playerAabbAt(pos[0],pos[1]-.13,pos[2]));}
  function movePlayerAxis(axis,delta){if(!delta)return;const p=[...player.pos];p[axis]+=delta;if(!aabbHitsWorld(playerAabbAt(p[0],p[1],p[2]))){player.pos[axis]=p[axis];return;}
    if((axis===0||axis===2)&&player.grounded&&!player.inWater){for(const rise of[.22,.34,.51]){const step=[...player.pos];step[1]+=rise;step[axis]+=delta;if(!aabbHitsWorld(playerAabbAt(step[0],step[1],step[2]))){player.pos[1]=step[1];player.pos[axis]=step[axis];return;}}}
    if((axis===0||axis===2)&&player.inWater){
      // Water-edge mantle: test several heights, not one fixed 0.72 step. This
      // prevents the classic “stuck forever at the shore” bug.
      for(const rise of[.55,.82,1.04,1.22]){const climb=[...player.pos];climb[1]+=rise;climb[axis]+=delta*1.45;if(!aabbHitsWorld(playerAabbAt(climb[0],climb[1],climb[2]))){player.pos[1]=climb[1];player.pos[axis]=climb[axis];player.vel[1]=Math.max(player.vel[1],4.6);return;}}
    }
    if((axis===0||axis===2)&&Math.abs(delta)>.015){player.impact=Math.min(1,player.impact+.34);if(Math.random()<.08)sfx('step',.35,'stone');}player.vel[axis]=0;
  }
  function voxelRaycast(origin,dir,maxDist=6){
    let x=Math.floor(origin[0]),y=Math.floor(origin[1]),z=Math.floor(origin[2]);const sx=dir[0]>=0?1:-1,sy=dir[1]>=0?1:-1,sz=dir[2]>=0?1:-1;
    const invX=dir[0]===0?1e30:Math.abs(1/dir[0]),invY=dir[1]===0?1e30:Math.abs(1/dir[1]),invZ=dir[2]===0?1e30:Math.abs(1/dir[2]);
    let tX=dir[0]===0?1e30:((sx>0?x+1-origin[0]:origin[0]-x)*invX),tY=dir[1]===0?1e30:((sy>0?y+1-origin[1]:origin[1]-y)*invY),tZ=dir[2]===0?1e30:((sz>0?z+1-origin[2]:origin[2]-z)*invZ);let t=0,normal=[0,0,0];
    for(let i=0;i<128&&t<=maxDist;i++){
      const b=getBlock(x,y,z);if(b!==B.AIR&&b!==B.WATER){return{x,y,z,id:b,normal,distance:t};}
      if(tX<tY&&tX<tZ){x+=sx;t=tX;tX+=invX;normal=[-sx,0,0];}else if(tY<tZ){y+=sy;t=tY;tY+=invY;normal=[0,-sy,0];}else{z+=sz;t=tZ;tZ+=invZ;normal=[0,0,-sz];}
    }return null;
  }
  function rayAABB(origin,dir,min,max,maxDist){
    let tmin=0,tmax=maxDist;
    for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-8){if(origin[i]<min[i]||origin[i]>max[i])return null;}else{let t1=(min[i]-origin[i])/dir[i],t2=(max[i]-origin[i])/dir[i];if(t1>t2){const q=t1;t1=t2;t2=q;}tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null;}}
    return tmin;
  }

  function useSelected(){
    const hit=voxelRaycast(eyePos(),lookDir(),6);
    if(hit?.id===B.CHEST&&starterChestPos&&hit.x===starterChestPos[0]&&hit.y===starterChestPos[1]&&hit.z===starterChestPos[2]){openStarterChest();return;}
    if(hit?.id===B.FURNACE){openFurnace(hit);return;}
    if(hit?.id===B.WOOD_DOOR){const f=ensureFortification(hit.x,hit.y,hit.z,hit.id,true);f.open=!f.open;sfx('creak',.65);showMessage(f.open?'Drzwi otwarte.':'Drzwi zamknięte.',.8);return;}
    const id=selectedItem(),def=itemDefs[id];if(!def)return;
    if(def.food&&countItem(id)>0){removeItem(id,1);player.hunger=clamp(player.hunger+def.food,0,100);player.health=clamp(player.health+(def.heal||0)-(def.hurt||0),0,100);sfx('eat');showMessage(`${def.name}: głód +${def.food}`);return;}
    if(def.heal&&countItem(id)>0){removeItem(id,1);player.health=clamp(player.health+def.heal,0,100);sfx('eat');showMessage(`${def.name}: HP +${def.heal}`);return;}
    if(def.place&&countItem(id)>0){
      if(!hit)return;const x=hit.x+hit.normal[0],y=hit.y+hit.normal[1],z=hit.z+hit.normal[2];
      if(y<=0||y>=WORLD_H-1)return;const a=playerAabbAt(player.pos[0],player.pos[1],player.pos[2]);if(x+1>a[0]&&x<a[3]&&y+1>a[1]&&y<a[4]&&z+1>a[2]&&z<a[5]){showMessage('Nie możesz postawić bloku w sobie.');return;}
      if(getBlock(x,y,z)===B.AIR||getBlock(x,y,z)===B.WATER){setBlock(x,y,z,def.place);removeItem(id,1);const key=fortKey(x,y,z);if(isUpgradeableBlockId(def.place)){const t=FORT_TIERS[0];fortifications.set(key,{tier:0,hp:t.maxHp,maxHp:t.maxHp,type:blockDefs[def.place]?.construction||'wall',orientation:Math.round(player.yaw/(Math.PI/2))*(Math.PI/2),open:false,lastHit:0});}if(def.place===B.FURNACE&&!furnaces.has(key))furnaces.set(key,{input:null,fuel:null,output:null,burn:0,burnMax:0,progress:0});sfx(def.place===B.TORCH?'torch':'place',1.0,soundMaterialForBlock(def.place));}
    }
  }

  function hurtPlayer(amount,source='coś w ciemności'){
    if(player.damageCooldown>0||dead)return;player.damageCooldown=.45;player.health-=amount;player.cameraShake=Math.max(player.cameraShake,.72);player.threat=Math.max(player.threat,.88);UI.damageFlash.style.opacity='.88';setTimeout(()=>UI.damageFlash.style.opacity='0',145);canvas.classList.remove('shake');void canvas.offsetWidth;canvas.classList.add('shake');sfx('hurt');
    if(player.health<=0)killPlayer(source);
  }
  function killPlayer(source){
    dead=true;paused=true;input.mouseLeft=false;document.exitPointerLock?.();player.health=0;UI.deathTitle.textContent=Math.random()<.5?'LAS CIĘ ZNALAZŁ':'ZOSTAŁEŚ POŻARTY';UI.deathStats.textContent=`Przyczyna: ${source}. Zabici wrogowie: ${player.kills}. Wykopane bloki: ${player.blocksMined}. Przetrwane dni: ${Math.floor(player.days)}.`;UI.deathMenu.classList.add('active');
  }
  function respawn(){
    dead=false;UI.deathMenu.classList.remove('active');player.health=75;player.hunger=65;player.sanity=70;player.stamina=100;player.vel=[0,0,0];const base=worldSpawn||starterChestPos||player.pos;
    updateStreaming(base[0],base[2],true);let next=resolvePlayerSpawnCollision(findSafeSpawn(base[0],base[2],12),24);player.pos=next;if(aabbHitsWorld(playerAabbAt(...player.pos)))player.pos=resolvePlayerSpawnCollision(base,28);player.vel=[0,0,0];player.grounded=playerGroundedAt();player.wasInWater=false;player.inWater=false;
    const lose=(id,f)=>{const n=countItem(id),keep=Math.floor(n*f);if(n>keep)removeItem(id,n-keep);};lose('rawmeat',.5);lose('stone',.7);lose('wood',.7);
    saveGame();resumeGame();
  }

  // ---------------------------------------------------------------------------
  // Hostile creatures - original dark fauna, pack AI and hard despawn rules
  // ---------------------------------------------------------------------------
  const enemies=[];
  const enemyDefs={
    wolf:{name:'wilk popielny',hp:30,speed:4.15,damage:12,aggro:25,color:[.19,.18,.17,1],night:false,radius:.42,height:.58,drop:1},
    boar:{name:'dzik bagienny',hp:44,speed:3.05,damage:16,aggro:18,color:[.18,.105,.07,1],night:false,radius:.58,height:.58,drop:2},
    deer:{name:'jeleń',hp:34,speed:4.25,damage:0,aggro:0,color:[.30,.18,.10,1],night:false,radius:.46,height:.78,drop:2,passive:true},
    doe:{name:'sarna',hp:26,speed:4.45,damage:0,aggro:0,color:[.36,.23,.14,1],night:false,radius:.39,height:.66,drop:1,passive:true},
    rabbit:{name:'królik',hp:10,speed:3.85,damage:0,aggro:0,color:[.42,.39,.34,1],night:false,radius:.22,height:.28,drop:1,passive:true},
    chicken:{name:'dziki kurak',hp:12,speed:2.25,damage:0,aggro:0,color:[.55,.49,.39,1],night:false,radius:.24,height:.32,drop:1,passive:true},
    cow:{name:'dzikie bydło',hp:48,speed:2.45,damage:0,aggro:0,color:[.28,.22,.17,1],night:false,radius:.58,height:.72,drop:3,passive:true},
    horse:{name:'dziki koń',hp:45,speed:4.35,damage:0,aggro:0,color:[.34,.20,.11,1],night:false,radius:.52,height:.82,drop:2,passive:true},
    moose:{name:'łoś',hp:68,speed:3.55,damage:0,aggro:0,color:[.25,.16,.10,1],night:false,radius:.62,height:1.02,drop:3,passive:true},
    sheep:{name:'owca',hp:28,speed:2.9,damage:0,aggro:0,color:[.62,.61,.55,1],night:false,radius:.46,height:.60,drop:2,passive:true},
    fox:{name:'lis',hp:18,speed:4.65,damage:0,aggro:0,color:[.55,.24,.09,1],night:false,radius:.31,height:.42,drop:1,passive:true},
    hyena:{name:'hiena',hp:36,speed:4.25,damage:11,aggro:21,color:[.39,.31,.18,1],night:false,radius:.40,height:.54,drop:1},
    bear:{name:'czarny niedźwiedź',hp:78,speed:3.25,damage:23,aggro:16,color:[.075,.068,.06,1],night:false,radius:.72,height:.9,drop:3},
    crawler:{name:'pełzacz',hp:38,speed:4.7,damage:14,aggro:30,color:[.055,.07,.061,1],night:true,radius:.46,height:.42,drop:1},
    watcher:{name:'obserwator',hp:62,speed:3.75,damage:20,aggro:40,color:[.025,.029,.027,1],night:true,radius:.34,height:1.45,drop:1},
    wraith:{name:'głodny cień',hp:46,speed:5.2,damage:17,aggro:36,color:[.035,.04,.052,1],night:true,radius:.36,height:1.1,drop:0}
  };
  function spawnEnemy(type,x,z,adminSpawned=false){const d=enemyDefs[type];if(!d)return;const y=findSurface(Math.floor(x),Math.floor(z));if(y>=WORLD_H-2)return;enemies.push({type,pos:[x,y,z],velY:0,hp:d.hp,maxHp:d.hp,attack:0,wander:Math.random()*Math.PI*2,wanderTimer:1+Math.random()*4,flash:0,phase:Math.random()*Math.PI*2,gait:0,age:0,stuck:0,last:[x,z],facing:Math.random()*Math.PI*2,voice:1+Math.random()*4,adminSpawned});}
  function chooseSpawnType(nightFactor,x,z){
    const biome=biomeAt(Math.floor(x),Math.floor(z)),r=Math.random();
    if(nightFactor>.62){if(playSeconds<95)return r<.56?'wolf':r<.82?'boar':'hyena';if(r<.15)return'crawler';if(r<.27)return'watcher';if(r<.37)return'wraith';if(r<.62)return'wolf';if(r<.76)return'boar';if(r<.88)return'hyena';return'bear';}
    if(r<.58){
      if(['forest','birch','poplar_grove','autumn','darkwood','old_growth','mist_forest'].includes(biome))return r<.13?'deer':r<.24?'doe':r<.32?'fox':r<.40?'rabbit':r<.49?'horse':'chicken';
      if(['meadow','flower_meadow','plains','riverlands'].includes(biome))return r<.13?'cow':r<.24?'horse':r<.34?'deer':r<.43?'sheep':r<.51?'rabbit':'chicken';
      if(['taiga','spruce_valley','cold_plains','tundra'].includes(biome))return r<.20?'moose':r<.34?'deer':r<.46?'rabbit':'fox';
      if(['swamp','marsh','willow_swamp'].includes(biome))return r<.29?'boar':r<.43?'rabbit':'deer';
      if(['chaparral','red_barrens','barren'].includes(biome))return r<.26?'hyena':r<.42?'horse':'rabbit';
      return r<.30?'rabbit':'deer';
    }
    if(['swamp','marsh','willow_swamp'].includes(biome))return r<.80?'boar':'wolf';
    if(['forest','darkwood','old_growth','mist_forest','taiga','spruce_valley','mountain_forest'].includes(biome))return r<.78?'wolf':'bear';
    if(['chaparral','red_barrens','barren'].includes(biome))return r<.82?'hyena':'wolf';
    return r<.82?'wolf':'boar';
  }
  function spawnAroundPlayer(nightFactor){
    const base=difficulty==='insane'?18:difficulty==='nightmare'?14:11,grace=playSeconds<95?Math.min(base,8):base,max=grace+Math.floor(nightFactor*(playSeconds<95?2:7));if(enemies.length>=max)return;
    let tries=5;while(tries--){const ang=Math.random()*Math.PI*2,dist=22+Math.random()*30,x=player.pos[0]+Math.cos(ang)*dist,z=player.pos[2]+Math.sin(ang)*dist;if(Math.abs(terrainHeight(x,z)-player.pos[1])>26)continue;spawnEnemy(chooseSpawnType(nightFactor,x,z),x,z);break;}
  }
  function enemyAABB(e){const d=enemyDefs[e.type];return[[e.pos[0]-d.radius,e.pos[1],e.pos[2]-d.radius],[e.pos[0]+d.radius,e.pos[1]+d.height*2,e.pos[2]+d.radius]];}
  function enemyRayHit(maxDist=3.65){const o=eyePos(),d=lookDir();let best=null;for(const e of enemies){const [mn,mx]=enemyAABB(e),t=rayAABB(o,d,mn,mx,maxDist);if(t!==null&&(!best||t<best.t))best={e,t};}return best;}
  function attackEnemy(){
    if(player.attackCooldown>0)return false;const h=enemyRayHit(3.65);if(!h)return false;player.attackCooldown=.34;player.toolSwing=1;player.toolSwingSide*=-1;const held=itemDefs[selectedItem()]||{};let dmg=heldDamage();if(held.tool==='sword')dmg=held.damage||7;else if(held.tool==='axe')dmg=held.damage||5;h.e.hp-=dmg;h.e.flash=.15;spawnBlood(h.e.pos,8+Math.floor(dmg*.35));sfx('hit');
    if(h.e.hp<=0){const deadType=h.e.type,i=enemies.indexOf(h.e);if(i>=0)enemies.splice(i,1);player.kills++;const def=enemyDefs[deadType];if(def.drop>0)spawnItemDrop('rawmeat',def.drop+Math.floor(Math.random()*2),[h.e.pos[0],h.e.pos[1]+.55,h.e.pos[2]],null,.65);if(Math.random()<.22)spawnItemDrop('coal',1,[h.e.pos[0],h.e.pos[1]+.55,h.e.pos[2]],null,.65);for(let n=0;n<16;n++)spawnParticle([h.e.pos[0],h.e.pos[1]+.7,h.e.pos[2]],[(Math.random()-.5)*2.5,1+Math.random()*2,(Math.random()-.5)*2.5],.35+Math.random()*.45,[def.color[0]*1.3,def.color[1]*1.1,def.color[2]*1.1,1],3+Math.random()*3,8,.9);showMessage(`${def.name.toUpperCase()} PADŁ`);}
    return true;
  }
  function entityCollides(x,y,z,r=.34,h=.9){return aabbHitsWorld([x-r,y,z-r,x+r,y+h*2,z+r]);}
  function fortificationInPath(e,mx,mz){const sx=e.pos[0]+mx*1.3,sz=e.pos[2]+mz*1.3;for(const yy of[e.pos[1]+.15,e.pos[1]+.8]){const x=Math.floor(sx),y=Math.floor(yy),z=Math.floor(sz),id=getBlock(x,y,z);if(isUpgradeableBlockId(id)&&ensureFortification(x,y,z,id,true))return{x,y,z,id};}return null;}
  function cleanupEnemies(nightFactor){for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],d=enemyDefs[e.type],dist=Math.hypot(player.pos[0]-e.pos[0],player.pos[2]-e.pos[2]);if(dist>82||e.pos[1]<-5||e.age>240||(d.night&&nightFactor<.28&&dist>34))enemies.splice(i,1);}const hardMax=difficulty==='insane'?34:difficulty==='nightmare'?29:24;if(enemies.length>hardMax)enemies.sort((a,b)=>Math.hypot(a.pos[0]-player.pos[0],a.pos[2]-player.pos[2])-Math.hypot(b.pos[0]-player.pos[0],b.pos[2]-player.pos[2])).splice(hardMax);}
  function updateEnemies(dt,nightFactor){
    for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],def=enemyDefs[e.type];e.age+=dt;e.attack=Math.max(0,e.attack-dt);e.flash=Math.max(0,e.flash-dt);e.gait+=dt*def.speed*2.1;const dx=player.pos[0]-e.pos[0],dz=player.pos[2]-e.pos[2],dist=Math.hypot(dx,dz),vertical=Math.abs((player.pos[1]+.8)-(e.pos[1]+def.height));const active=!def.passive&&((e.adminSpawned&&dist<45&&vertical<10)||(dist<def.aggro&&vertical<8)||(def.night&&nightFactor>.5&&dist<def.aggro*1.25));const fleeing=!!def.passive&&dist<6.5;let ang;
      if(active){ang=Math.atan2(dx,-dz);if(e.type==='watcher'&&dist>7&&dist<15)ang+=Math.sin(e.age*1.6)*.22;}else if(fleeing){ang=Math.atan2(-dx,dz);}else{e.wanderTimer-=dt;if(e.wanderTimer<=0){e.wander+=(-1.1+Math.random()*2.2);e.wanderTimer=1.5+Math.random()*5.5;}ang=e.wander;}
      e.facing=ang;e.voice-=dt;if(active&&e.voice<=0&&dist<22){sfx('growl',clamp(1-dist/28,.16,.8));e.voice=2.4+Math.random()*5.5;}
      let speed=def.speed*(active?1:fleeing?.9:.22)*(def.night?(.44+nightFactor*.72):1);if(e.type==='bear'&&active&&dist<7)speed*=1.22;if(e.type==='crawler')speed*=1+Math.sin(e.gait)*.07;const mx=Math.sin(ang)*speed*dt,mz=-Math.cos(ang)*speed*dt,r=def.radius*.84,h=Math.max(.38,def.height*.82);
      const beforeX=e.pos[0],beforeZ=e.pos[2];let barrier=null;
      if(!entityCollides(e.pos[0]+mx,e.pos[1],e.pos[2],r,h))e.pos[0]+=mx;else if(active&&(barrier=fortificationInPath(e,mx,0))){if(e.attack<=0){e.attack=1.0+Math.random()*.35;damageFortification(barrier.x,barrier.y,barrier.z,Math.max(4,def.damage*.48),def.name);}}else e.velY=Math.max(e.velY,4.8);
      barrier=null;if(!entityCollides(e.pos[0],e.pos[1],e.pos[2]+mz,r,h))e.pos[2]+=mz;else if(active&&(barrier=fortificationInPath(e,0,mz))){if(e.attack<=0){e.attack=1.0+Math.random()*.35;damageFortification(barrier.x,barrier.y,barrier.z,Math.max(4,def.damage*.48),def.name);}}else e.velY=Math.max(e.velY,4.8);
      const moved=Math.hypot(e.pos[0]-beforeX,e.pos[2]-beforeZ);e.stuck=moved<.003&&active?e.stuck+dt:Math.max(0,e.stuck-dt*2);if(e.stuck>.8){e.wander+=Math.PI*(.55+Math.random()*.5);e.velY=5.3;e.stuck=0;}
      e.velY-=17*dt;const ny=e.pos[1]+e.velY*dt;if(!entityCollides(e.pos[0],ny,e.pos[2],r,h))e.pos[1]=ny;else{if(e.velY<0)e.pos[1]=Math.floor(e.pos[1]+.001);e.velY=0;}
      const reach=e.type==='bear'?1.8:e.type==='watcher'?1.65:1.45;if(!def.passive&&active&&dist<reach&&vertical<2.2&&e.attack<=0){e.attack=e.type==='crawler'?.78:e.type==='wraith'?.72:e.type==='bear'?1.35:1.05;hurtPlayer(def.damage*(difficulty==='insane'?1.25:difficulty==='nightmare'?1.08:1),def.name);}
    }
    cleanupEnemies(nightFactor);
  }


  // ---------------------------------------------------------------------------
  // Ambient birds — small independent flying fauna (gulls/ducks/ravens)
  // ---------------------------------------------------------------------------
  const birds=[];
  const birdDefs={
    raven:{name:'kruk',color:[.055,.06,.065,1],wing:[.035,.04,.045,1],speed:5.4,size:.82,sound:'crow'},
    gull:{name:'mewa',color:[.70,.72,.69,1],wing:[.82,.83,.79,1],speed:5.9,size:.88,sound:'bird'},
    duck:{name:'dzika kaczka',color:[.20,.25,.18,1],wing:[.27,.31,.20,1],speed:4.7,size:.90,sound:'bird'}
  };
  let birdSpawnTimer=2.2;
  function chooseBirdType(x,z){
    const b=biomeAt(Math.floor(x),Math.floor(z)),wet=['beach','wet_shore','frozen_shore','riverlands','swamp','marsh','willow_swamp'].includes(b),r=Math.random();
    if(wet)return r<.42?'gull':r<.76?'duck':'raven';
    return r<.73?'raven':r<.86?'gull':'duck';
  }
  function spawnBird(type,x,z){
    const d=birdDefs[type];if(!d)return;const surface=findSurface(Math.floor(x),Math.floor(z)),alt=type==='duck'?5+Math.random()*4:8+Math.random()*10;
    birds.push({type,pos:[x,Math.min(WORLD_H-5,surface+alt),z],angle:Math.random()*Math.PI*2,turn:(Math.random()-.5)*.26,phase:Math.random()*Math.PI*2,age:0,voice:3+Math.random()*13});
  }
  function updateBirds(dt,night){
    birdSpawnTimer-=dt;
    const maxBirds=night>.68?3:9;
    if(birdSpawnTimer<=0&&birds.length<maxBirds){
      birdSpawnTimer=1.8+Math.random()*4.4;const a=Math.random()*Math.PI*2,d=18+Math.random()*38,x=player.pos[0]+Math.cos(a)*d,z=player.pos[2]+Math.sin(a)*d;spawnBird(chooseBirdType(x,z),x,z);
    }
    for(let i=birds.length-1;i>=0;i--){
      const b=birds[i],d=birdDefs[b.type];b.age+=dt;b.phase+=dt*(7+d.speed*.45);b.voice-=dt;
      const pd=Math.hypot(player.pos[0]-b.pos[0],player.pos[2]-b.pos[2]);
      if(pd>96||b.age>150){birds.splice(i,1);continue;}
      // gentle circling with avoidance of world ceiling / terrain
      b.angle+=b.turn*dt+Math.sin(b.age*.31+b.phase*.1)*.025*dt;
      b.pos[0]+=Math.sin(b.angle)*d.speed*dt;b.pos[2]+=-Math.cos(b.angle)*d.speed*dt;
      const floor=findSurface(Math.floor(b.pos[0]),Math.floor(b.pos[2]));
      const targetAlt=(b.type==='duck'?4.6:9.5)+(Math.sin(b.age*.27+b.phase)*2.2);
      b.pos[1]=lerp(b.pos[1],Math.min(WORLD_H-4,floor+targetAlt),clamp(dt*.42,0,1));
      if(b.voice<=0&&pd<42&&night<.78){sfx(d.sound,clamp(1-pd/48,.16,.5));b.voice=8+Math.random()*18;}
    }
  }
  function renderBird(b,VP,fogColor,cam){
    const d=birdDefs[b.type],ry=b.angle,flap=Math.sin(b.phase),s=d.size,body=[b.pos[0],b.pos[1],b.pos[2]],head=rotatedOffset(body,[0,.09,-.28*s],ry);
    drawBox(VP,body,[.34*s,.18*s,.56*s],d.color,ry,fogColor,cam,0,flap*.04);
    drawBox(VP,head,[.20*s,.19*s,.22*s],d.color,ry,fogColor,cam);
    const beak=b.type==='raven'?[.16,.13,.07,1]:[.65,.48,.14,1];
    drawBox(VP,rotatedOffset(head,[0,-.02,-.16*s],ry),[.09*s,.055*s,.20*s],beak,ry,fogColor,cam);
    for(const side of[-1,1]){
      const wing=rotatedOffset(body,[side*.27*s,.02,.02],ry),rz=side*(.30+flap*.58);
      drawBox(VP,wing,[.58*s,.045*s,.27*s],d.wing,ry,fogColor,cam,0,rz);
    }
    drawBox(VP,rotatedOffset(body,[0,.01,.32*s],ry),[.22*s,.05*s,.28*s],d.wing,ry,fogColor,cam,.15);
  }

  // ---------------------------------------------------------------------------
  // Inventory / crafting UI — V5 real slot inventory
  // ---------------------------------------------------------------------------
  const ingredientIds=spec=>Array.isArray(spec)?spec:[spec];
  const ingredientMatches=(id,spec)=>ingredientIds(spec).includes(id);
  function ingredientCountInInventory(spec){let n=0;for(const id of ingredientIds(spec))n+=countItem(id);return n;}
  function ingredientCountEverywhere(spec){let n=ingredientCountInInventory(spec);for(const st of player.craftSlots)if(st&&ingredientMatches(st.id,spec))n+=st.count;return n;}
  function chooseIngredient(spec){let best=null,bestCount=-1;for(const id of ingredientIds(spec)){const n=countItem(id);if(n>bestCount){best=id;bestCount=n;}}return bestCount>0?best:ingredientIds(spec)[0];}
  function recipeIngredients(r){
    const groups=[];
    const add=(spec,n=1)=>{const ids=ingredientIds(spec),key=ids.slice().sort().join('|');let g=groups.find(x=>x.key===key);if(g)g.count+=n;else groups.push({key,spec,count:n});};
    if(r.shapeless){for(const[id,n]of Object.entries(r.shapeless))add(id,n);return groups;}
    for(const row of r.pattern||[])for(const ch of row)if(ch!==' '&&r.key?.[ch])add(r.key[ch],1);
    return groups;
  }
  function recipeLabel(spec){const ids=ingredientIds(spec);if(ids===LOG_INGREDIENTS||ids.length===LOG_INGREDIENTS.length&&ids.every(x=>LOG_INGREDIENTS.includes(x)))return'Dowolne drewno';return ids.map(id=>itemDefs[id]?.name||id).join(' / ');}
  function requirementTextForRecipe(r){return recipeIngredients(r).map(g=>`${recipeLabel(g.spec)} ${ingredientCountEverywhere(g.spec)}/${g.count}`).join(' · ');}
  function canCraft(r){return recipeIngredients(r).every(g=>ingredientCountInInventory(g.spec)>=g.count);}
  function canFillCraftRecipe(r){return recipeIngredients(r).every(g=>ingredientCountEverywhere(g.spec)>=g.count);}
  function removeIngredientFromInventory(spec,count){let left=count;for(const id of ingredientIds(spec)){if(left<=0)break;const have=countItem(id);if(have<=0)continue;const take=Math.min(have,left);removeItem(id,take);left-=take;}return left===0;}
  function quickCraft(r){
    if(!canCraft(r)){showMessage('Brakuje materiałów.');return;}
    const [outId,outCount]=Object.entries(r.out)[0];if(inventoryCapacity(outId)<outCount){showMessage('Brak miejsca na wynik craftingu.');return;}
    for(const g of recipeIngredients(r))removeIngredientFromInventory(g.spec,g.count);addItem(outId,outCount);sfx('craft');showMessage(`Wytworzono: ${r.name}`);refreshInventoryUI();
  }
  function itemIconCanvas(id,cssClass='inv-icon'){
    const c=document.createElement('canvas');c.width=32;c.height=32;c.className=cssClass;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,32,32);const def=itemDefs[id]||{};
    const drawTile=(tile,dx=4,dy=4,dw=24,dh=24)=>{const sx=(tile%atlas.cols)*atlas.tile,sy=Math.floor(tile/atlas.cols)*atlas.tile;x.drawImage(atlas.canvas,sx,sy,atlas.tile,atlas.tile,dx,dy,dw,dh);};
    const drawBlockIcon=(bid)=>{const top=tileFor(bid,'top'),side=tileFor(bid,'side');x.save();x.beginPath();x.moveTo(16,3);x.lineTo(29,10);x.lineTo(16,17);x.lineTo(3,10);x.closePath();x.clip();drawTile(top,3,3,26,14);x.restore();x.save();x.beginPath();x.moveTo(3,10);x.lineTo(16,17);x.lineTo(16,30);x.lineTo(3,23);x.closePath();x.clip();drawTile(side,3,10,13,20);x.fillStyle='rgba(0,0,0,.12)';x.fillRect(3,10,13,20);x.restore();x.save();x.beginPath();x.moveTo(16,17);x.lineTo(29,10);x.lineTo(29,23);x.lineTo(16,30);x.closePath();x.clip();drawTile(side,16,10,13,20);x.fillStyle='rgba(0,0,0,.28)';x.fillRect(16,10,13,20);x.restore();x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=1;x.strokeRect(3.5,10.5,0,0);};
    if(def.place&&def.place!==B.TORCH){drawBlockIcon(def.place);return c;}
    if(id==='coal'){drawTile(7);return c;}if(id==='iron'){drawTile(8);return c;}if(id==='gold_ore'){drawTile(88);return c;}if(id==='iron_ingot'||id==='gold_ingot'){x.fillStyle=id==='iron_ingot'?'#aeb6b2':'#d2ad43';x.fillRect(6,11,20,10);x.fillStyle='rgba(255,255,255,.24)';x.fillRect(8,12,16,2);return c;}
    x.save();x.translate(16,16);x.rotate(-.42);
    if(def.tool){const wood=def.tier==='wood',gold=def.tier==='gold';x.fillStyle=wood?'#6b472a':'#573d27';x.fillRect(-2,-11,4,23);x.fillStyle=wood?'#8a6239':gold?'#d6ad35':(def.tool==='sword'?'#a2a8a4':'#747a76');if(def.tool==='pickaxe'){x.fillRect(-11,-11,22,5);x.fillRect(-11,-9,4,7);}else if(def.tool==='axe'){x.fillRect(-3,-11,12,8);x.fillRect(5,-9,6,5);}else if(def.tool==='shovel'){x.fillRect(-4,-13,8,10);x.fillRect(-6,-14,12,5);}else{x.fillRect(-3,-14,6,22);x.fillStyle=wood?'#5f4027':'#3b3128';x.fillRect(-7,7,14,3);}x.restore();return c;}
    if(id==='torch'){x.restore();x.fillStyle='#4b321d';x.fillRect(14,11,4,17);x.fillStyle='#a46b25';x.fillRect(12,8,8,6);x.fillStyle='#dca33e';x.fillRect(13,5,6,7);x.fillStyle='#f2c76b';x.fillRect(15,3,3,5);return c;}
    x.restore();if(id==='rawmeat'||id==='cookedmeat'){x.fillStyle=id==='rawmeat'?'#6d2425':'#704123';x.fillRect(8,9,17,14);x.fillRect(11,6,12,4);x.fillStyle=id==='rawmeat'?'#b56a66':'#a77b4f';x.fillRect(11,11,5,4);}
    else if(id==='berries'){x.fillStyle='#403757';for(const [bx,by]of[[10,12],[15,9],[20,13],[13,18],[19,19]])x.fillRect(bx,by,6,6);x.fillStyle='#385135';x.fillRect(15,5,3,6);}
    else if(id==='bandage'){x.fillStyle='#b9b7a8';x.fillRect(7,12,18,8);x.fillRect(12,7,8,18);x.fillStyle='#6f2d2d';x.fillRect(13,13,6,6);}else if(id==='stick'){x.fillStyle='#6a472b';x.save();x.translate(16,16);x.rotate(-.55);x.fillRect(-2,-12,4,24);x.restore();}else{x.fillStyle='#7c857d';x.fillRect(8,8,16,16);}return c;
  }
  function itemTypeLabel(id,def){return def?.tool?'narzędzie':def?.food?'jedzenie':def?.heal?'medyczne':def?.kind==='light'?'światło':def?.place?'blok':'surowiec';}
  function getSlotRef(source,index=0){
    if(source==='inventory')return player.slots[index]||null;
    if(source==='craft')return player.craftSlots[index]||null;
    if(source==='chest')return starterChestLoot[index]||null;
    if(source==='offhand')return player.offhand||null;
    if(source==='mainhand')return player.slots[player.selected]||null;
    const fu=furnaceActiveKey?furnaces.get(furnaceActiveKey):null;if(source==='furnace_input')return fu?.input||null;if(source==='furnace_fuel')return fu?.fuel||null;if(source==='furnace_output')return fu?.output||null;
    return null;
  }
  function setSlotRef(source,index,st){
    st=normalizeStack(st);
    if(source==='inventory')player.slots[index]=st;
    else if(source==='craft')player.craftSlots[index]=st;
    else if(source==='chest')starterChestLoot[index]=st;
    else if(source==='offhand')player.offhand=st;
    else if(source==='mainhand')player.slots[player.selected]=st;
    else if(furnaceActiveKey&&source==='furnace_input'){const f=furnaces.get(furnaceActiveKey);if(f)f.input=st;}
    else if(furnaceActiveKey&&source==='furnace_fuel'){const f=furnaces.get(furnaceActiveKey);if(f)f.fuel=st;}
    else if(furnaceActiveKey&&source==='furnace_output'){const f=furnaces.get(furnaceActiveKey);if(f)f.output=st;}
  }
  function slotAccepts(source,st){
    if(!st)return true;
    if(source==='furnace_output')return false;
    if(source==='furnace_input')return !!SMELT_RECIPES[st.id];
    if(source==='furnace_fuel')return fuelSeconds(st.id)>0;
    return true;
  }
  function mergeOrSwap(source,index,targetSource,targetIndex){
    if(source===targetSource&&index===targetIndex)return;
    let a=cloneStack(getSlotRef(source,index)),b=cloneStack(getSlotRef(targetSource,targetIndex));if(!a||!slotAccepts(targetSource,a))return;if(b&&!slotAccepts(source,b))return;
    const max=maxStackFor(a.id);
    if(b?.id===a.id&&b.count<max){const take=Math.min(max-b.count,a.count);b.count+=take;a.count-=take;setSlotRef(targetSource,targetIndex,b);setSlotRef(source,index,a.count>0?a:null);}
    else{setSlotRef(targetSource,targetIndex,a);setSlotRef(source,index,b);}
    sfx('inventory',.6);refreshInventoryUI();refreshHotbar();
  }
  function moveInventoryRange(index){
    const st=player.slots[index];if(!st)return;
    const start=index>=HOTBAR_SIZE?0:HOTBAR_SIZE,end=index>=HOTBAR_SIZE?HOTBAR_SIZE:INVENTORY_SIZE,max=maxStackFor(st.id);let left=st.count;
    for(let i=start;i<end&&left>0;i++){const dst=player.slots[i];if(dst?.id===st.id&&dst.count<max){const take=Math.min(max-dst.count,left);dst.count+=take;left-=take;}}
    for(let i=start;i<end&&left>0;i++)if(!player.slots[i]){const take=Math.min(max,left);player.slots[i]={id:st.id,count:take};left-=take;}
    player.slots[index]=left>0?{id:st.id,count:left}:null;sfx('inventory',.6);refreshInventoryUI();refreshHotbar();
  }
  function positionCursorStack(x=cursorX,y=cursorY){cursorX=x;cursorY=y;if(!UI.cursorStack)return;UI.cursorStack.style.left=`${x}px`;UI.cursorStack.style.top=`${y}px`;}
  function leftClickSlot(source,index,shift=false,x=cursorX,y=cursorY){positionCursorStack(x,y);
    if(cursorStack&&!slotAccepts(source,cursorStack))return;
    if(source==='furnace_output'&&cursorStack){const slot=cloneStack(getSlotRef(source,index));if(!slot||slot.id!==cursorStack.id||cursorStack.count>=maxStackFor(slot.id))return;}
    if(shift){if(source==='inventory'){moveInventoryRange(index);return;}const moving=cloneStack(getSlotRef(source,index));if(moving&&addItem(moving.id,moving.count)){setSlotRef(source,index,null);sfx('inventory',.65);refreshInventoryUI();refreshHotbar();}return;}
    const slot=cloneStack(getSlotRef(source,index));
    if(!cursorStack){if(slot){cursorStack=slot;setSlotRef(source,index,null);sfx('inventory',.55);}}
    else if(!slot){setSlotRef(source,index,cursorStack);cursorStack=null;sfx('inventory',.55);}
    else if(slot.id===cursorStack.id&&slot.count<maxStackFor(slot.id)){const take=Math.min(maxStackFor(slot.id)-slot.count,cursorStack.count);slot.count+=take;cursorStack.count-=take;setSlotRef(source,index,slot);if(cursorStack.count<=0)cursorStack=null;sfx('inventory',.55);}
    else{setSlotRef(source,index,cursorStack);cursorStack=slot;sfx('inventory',.55);}
    refreshInventoryUI();refreshHotbar();
  }
  function rightClickSlot(source,index,x=cursorX,y=cursorY,deferRefresh=false){
    positionCursorStack(x,y);const slot=cloneStack(getSlotRef(source,index));if(cursorStack&&!slotAccepts(source,cursorStack))return;if(source==='furnace_output'&&cursorStack)return;
    if(!cursorStack&&slot){const take=Math.ceil(slot.count/2);cursorStack={id:slot.id,count:take};slot.count-=take;setSlotRef(source,index,slot.count>0?slot:null);sfx('inventory',.45);}
    else if(cursorStack&&!slot){setSlotRef(source,index,{id:cursorStack.id,count:1});cursorStack.count--;if(cursorStack.count<=0)cursorStack=null;sfx('inventory',.45);}
    else if(cursorStack&&slot?.id===cursorStack.id&&slot.count<maxStackFor(slot.id)){slot.count++;cursorStack.count--;setSlotRef(source,index,slot);if(cursorStack.count<=0)cursorStack=null;sfx('inventory',.45);}
    if(deferRefresh){renderCursorStack();return;}
    refreshInventoryUI();refreshHotbar();
  }
  function showItemTooltip(st,x,y,source='inventory'){
    if(!UI.itemTooltip||!st){hideItemTooltip();return;}const def=itemDefs[st.id]||{};
    UI.itemTooltip.innerHTML=`<strong>${def.name||st.id}</strong><span>${itemTypeLabel(st.id,def)} · ${st.count} szt.</span>${source==='chest'?'<em>SKRZYNIA STARTOWA</em>':''}`;
    UI.itemTooltip.classList.remove('hidden');moveItemTooltip(x,y);
  }
  function moveItemTooltip(x,y){if(!UI.itemTooltip||UI.itemTooltip.classList.contains('hidden'))return;const pad=14,w=UI.itemTooltip.offsetWidth||170,h=UI.itemTooltip.offsetHeight||50;UI.itemTooltip.style.left=`${Math.min(innerWidth-w-pad,x+16)}px`;UI.itemTooltip.style.top=`${Math.min(innerHeight-h-pad,y+16)}px`;}
  function hideItemTooltip(){UI.itemTooltip?.classList.add('hidden');}
  function makeSlotElement(source,index,st,extraClass=''){
    const el=document.createElement('div');el.className=`inv-item ${extraClass}`.trim();el.dataset.source=source;el.dataset.index=String(index);el.draggable=!!st;
    if(source==='inventory'&&index<HOTBAR_SIZE)el.classList.add('slot-hotbar');if(source==='inventory'&&index===player.selected)el.classList.add('slot-selected');
    const idx=document.createElement('span');idx.className='inv-slot-index';idx.textContent=source==='inventory'&&index<HOTBAR_SIZE?String(index+1):'';el.appendChild(idx);
    if(st){const icon=itemIconCanvas(st.id,'');const count=document.createElement('b');count.className='inv-count';count.textContent=st.count>1?String(st.count):'';el.append(icon,count);el.title=`${itemDefs[st.id]?.name||st.id} · ${itemTypeLabel(st.id,itemDefs[st.id])}`;}
    el.addEventListener('click',ev=>{if(ev.button!==0)return;leftClickSlot(source,index,ev.shiftKey,ev.clientX,ev.clientY);});
    el.addEventListener('pointerdown',ev=>{if(ev.button!==2)return;ev.preventDefault();rightClickSlot(source,index,ev.clientX,ev.clientY,true);slotPaint.active=true;slotPaint.visited=new Set([`${source}:${index}`]);});
    el.addEventListener('pointerenter',ev=>{if(!slotPaint.active||!(ev.buttons&2)||!cursorStack)return;const key=`${source}:${index}`;if(slotPaint.visited.has(key))return;slotPaint.visited.add(key);rightClickSlot(source,index,ev.clientX,ev.clientY,true);});
    el.addEventListener('contextmenu',ev=>ev.preventDefault());
    el.addEventListener('dragstart',ev=>{if(!getSlotRef(source,index)){ev.preventDefault();return;}dragSource={source,index};ev.dataTransfer?.setData('text/plain',`${source}:${index}`);});
    el.addEventListener('dragover',ev=>ev.preventDefault());
    el.addEventListener('drop',ev=>{ev.preventDefault();if(dragSource)mergeOrSwap(dragSource.source,dragSource.index,source,index);dragSource=null;});
    el.addEventListener('mouseenter',ev=>{const cur=getSlotRef(source,index);if(cur)showItemTooltip(cur,ev.clientX,ev.clientY,source);});
    el.addEventListener('mousemove',ev=>{positionCursorStack(ev.clientX,ev.clientY);moveItemTooltip(ev.clientX,ev.clientY);});
    el.addEventListener('mouseleave',hideItemTooltip);
    return el;
  }
  function trimmedPattern(r,mirror=false){
    const raw=(r.pattern||[]).map(row=>String(row));if(!raw.length)return[];let minX=99,maxX=-1,minY=99,maxY=-1;
    for(let y=0;y<raw.length;y++)for(let x=0;x<raw[y].length;x++)if(raw[y][x]&&raw[y][x]!==' '){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    if(maxX<0)return[];const out=[];for(let y=minY;y<=maxY;y++){let row='';for(let x=minX;x<=maxX;x++)row+=(raw[y][x]||' ');if(mirror)row=row.split('').reverse().join('');out.push(row);}return out;
  }
  function findCraftMatch(){
    // Shapeless mod recipes still work, but normal items use Minecraft-shaped recipes.
    for(const r of recipes){
      if(r.shapeless){const actual={};for(const st of player.craftSlots)if(st)actual[st.id]=(actual[st.id]||0)+1;const want=r.shapeless,ak=Object.keys(actual).sort(),wk=Object.keys(want).sort();if(ak.length===wk.length&&ak.every((k,i)=>k===wk[i]&&actual[k]===want[k]))return{recipe:r,slots:player.craftSlots.map((st,i)=>st?i:-1).filter(i=>i>=0),shapeless:true};continue;}
      for(const mirror of [false,...(r.mirror?[true]:[])]){const p=trimmedPattern(r,mirror),h=p.length,w=Math.max(0,...p.map(x=>x.length));if(!w||w>3||h>3)continue;
        for(let oy=0;oy<=3-h;oy++)for(let ox=0;ox<=3-w;ox++){
          let ok=true,slots=[];for(let gy=0;gy<3&&ok;gy++)for(let gx=0;gx<3;gx++){const idx=gy*3+gx,st=player.craftSlots[idx],inside=gy>=oy&&gy<oy+h&&gx>=ox&&gx<ox+w,ch=inside?(p[gy-oy][gx-ox]||' '):' ',spec=ch===' '?null:r.key?.[ch];if(spec){if(!st||!ingredientMatches(st.id,spec)){ok=false;break;}slots.push(idx);}else if(st){ok=false;break;}}
          if(ok)return{recipe:r,slots,ox,oy,mirror,pattern:p};
        }
      }
    }return null;
  }
  function matchingCraftRecipe(){return findCraftMatch()?.recipe||null;}
  function craftBatchCount(r){const m=findCraftMatch();if(!m||m.recipe!==r)return 0;if(m.shapeless){let n=Infinity;for(const[id,need]of Object.entries(r.shapeless)){let count=0;for(const st of player.craftSlots)if(st?.id===id)count+=st.count;n=Math.min(n,Math.floor(count/need));}return Number.isFinite(n)?n:0;}let n=Infinity;for(const i of m.slots)n=Math.min(n,player.craftSlots[i]?.count||0);return Number.isFinite(n)?Math.max(0,n):0;}
  function consumeCraftMatch(m,batches=1){if(m.shapeless){for(const[id,need]of Object.entries(m.recipe.shapeless)){let left=need*batches;for(let i=0;i<9&&left>0;i++){const st=player.craftSlots[i];if(st?.id===id){const take=Math.min(left,st.count);st.count-=take;left-=take;if(st.count<=0)player.craftSlots[i]=null;}}}return;}for(const i of m.slots){const st=player.craftSlots[i];if(!st)continue;st.count-=batches;if(st.count<=0)player.craftSlots[i]=null;}}
  function takeCraftOutput(shift=false){
    const m=findCraftMatch();if(!m)return;const r=m.recipe,[outId,outCount]=Object.entries(r.out)[0],max=maxStackFor(outId);
    if(shift){const batches=Math.min(craftBatchCount(r),Math.floor(inventoryCapacity(outId)/outCount));if(batches<=0){showMessage('Brak miejsca albo materiałów.');return;}consumeCraftMatch(m,batches);addItem(outId,outCount*batches);sfx('craft',.9);refreshInventoryUI();return;}
    if(cursorStack&&cursorStack.id!==outId){showMessage('Kursor trzyma inny przedmiot.');return;}if(cursorStack&&cursorStack.count+outCount>max){showMessage('Brak miejsca w stosie.');return;}
    consumeCraftMatch(m,1);if(cursorStack)cursorStack.count+=outCount;else cursorStack={id:outId,count:outCount};sfx('craft');refreshInventoryUI();
  }
  function clearCraftToInventory(){const stacks=player.craftSlots.filter(Boolean).map(cloneStack);if(!canStoreStacks(stacks))return false;for(let i=0;i<player.craftSlots.length;i++){const st=player.craftSlots[i];if(st){if(!addItem(st.id,st.count))return false;player.craftSlots[i]=null;}}return true;}
  function fillCraftFromRecipe(r){
    if(!canCraft(r)){showMessage('Brakuje materiałów.');return;}if(!clearCraftToInventory()){showMessage('Brak miejsca, żeby opróżnić crafting.');return;}
    if(r.shapeless){let idx=0;for(const[id,n]of Object.entries(r.shapeless))for(let k=0;k<n;k++){removeItem(id,1);player.craftSlots[idx++]={id,count:1};}}
    else{const p=trimmedPattern(r,false),h=p.length,w=Math.max(...p.map(x=>x.length)),ox=Math.floor((3-w)/2),oy=Math.floor((3-h)/2);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=p[y][x]||' ';if(ch===' ')continue;const spec=r.key[ch],id=chooseIngredient(spec);if(!removeIngredientFromInventory(id,1))continue;player.craftSlots[(oy+y)*3+ox+x]={id,count:1};}}
    sfx('inventory',.7);refreshInventoryUI();showMessage('Receptura ułożona w 3×3 — kliknij wynik.',1.2);
  }
  function fillEquipSlot(el,st,source='offhand'){
    if(!el)return;el.innerHTML='';const clone=cloneStack(st);if(clone){const icon=itemIconCanvas(clone.id,''),count=document.createElement('span');count.className='inv-count';count.textContent=clone.count>1?String(clone.count):'';el.append(icon,count);el.title=itemDefs[clone.id]?.name||clone.id;}else el.title='Pusty slot';
    if(source==='offhand'||source==='mainhand'){const idx=0;el.onclick=(ev)=>leftClickSlot(source,idx,ev.shiftKey,ev.clientX,ev.clientY);el.onpointerdown=(ev)=>{if(ev.button===2){ev.preventDefault();rightClickSlot(source,idx,ev.clientX,ev.clientY);}};el.oncontextmenu=(ev)=>ev.preventDefault();el.draggable=!!clone;el.ondragstart=ev=>{if(!getSlotRef(source,idx)){ev.preventDefault();return;}dragSource={source,index:idx};ev.dataTransfer?.setData('text/plain',`${source}:${idx}`);};el.ondragover=ev=>ev.preventDefault();el.ondrop=ev=>{ev.preventDefault();if(dragSource)mergeOrSwap(dragSource.source,dragSource.index,source,idx);dragSource=null;};el.onmouseenter=ev=>{const cur=getSlotRef(source,idx);if(cur)showItemTooltip(cur,ev.clientX,ev.clientY,source);};el.onmousemove=ev=>moveItemTooltip(ev.clientX,ev.clientY);el.onmouseleave=hideItemTooltip;}
  }
  function renderCursorStack(){
    if(!UI.cursorStack)return;UI.cursorStack.innerHTML='';if(!cursorStack){UI.cursorStack.classList.add('hidden');return;}UI.cursorStack.classList.remove('hidden');UI.cursorStack.append(itemIconCanvas(cursorStack.id,''));const b=document.createElement('b');b.textContent=cursorStack.count>1?String(cursorStack.count):'';UI.cursorStack.appendChild(b);
  }
  const SMELT_RECIPES={iron:{out:'iron_ingot',time:7.5},gold_ore:{out:'gold_ingot',time:8.5},sand:{out:'glass',time:6.5},redsand:{out:'glass',time:6.5},cobble:{out:'smooth_stone',time:7.0},rawmeat:{out:'cookedmeat',time:6.0}};
  const FUEL_TIME={coal:64,wood:12,pinewood:12,birchwood:12,darkwood:14,willowwood:11,poplarwood:11,mimosawood:11,deadwood:8,planks:9,old_planks:8,dark_planks:10,stick:3.5};
  function furnaceState(key=furnaceActiveKey){if(!key)return null;let f=furnaces.get(key);if(!f){f={input:null,fuel:null,output:null,burn:0,burnMax:0,progress:0};furnaces.set(key,f);}return f;}
  function canFurnaceOutput(f,recipe){if(!f||!recipe)return false;return !f.output||(f.output.id===recipe.out&&f.output.count<maxStackFor(recipe.out));}
  function consumeOneStackField(f,field){const st=f[field];if(!st)return;st.count--;if(st.count<=0)f[field]=null;}
  function updateFurnaces(dt){for(const [key,f] of furnaces){const[x,y,z]=key.split(',').map(Number);if(getBlock(x,y,z)!==B.FURNACE){furnaces.delete(key);continue;}const recipe=f.input?SMELT_RECIPES[f.input.id]:null;if(f.burn<=0&&recipe&&canFurnaceOutput(f,recipe)&&f.fuel&&FUEL_TIME[f.fuel.id]){f.burn=f.burnMax=FUEL_TIME[f.fuel.id];consumeOneStackField(f,'fuel');sfx('fire',.22);}if(f.burn>0){f.burn=Math.max(0,f.burn-dt);if(Math.hypot(x+.5-player.pos[0],z+.5-player.pos[2])<18&&Math.random()<dt*1.6)spawnParticle([x+.5,y+1.02,z+.5],[(Math.random()-.5)*.09,.22+Math.random()*.16,(Math.random()-.5)*.09],1.7,[.15,.14,.13,.34],3.1,0,.025);if(recipe&&canFurnaceOutput(f,recipe)){f.progress+=dt;if(f.progress>=recipe.time){f.progress=0;consumeOneStackField(f,'input');if(f.output?.id===recipe.out)f.output.count++;else f.output={id:recipe.out,count:1};sfx('craft',.55);}}else f.progress=0;}else if(!recipe)f.progress=0;}if(furnaceOpen)refreshFurnaceUI();}
  function fillFurnaceSlot(el,source){if(!el)return;el.innerHTML='';const st=cloneStack(getSlotRef(source,0));if(st){el.append(itemIconCanvas(st.id,''));const b=document.createElement('b');b.className='inv-count';b.textContent=st.count>1?String(st.count):'';el.appendChild(b);el.title=itemDefs[st.id]?.name||st.id;}else el.title='Pusty slot';el.onclick=ev=>leftClickSlot(source,0,ev.shiftKey,ev.clientX,ev.clientY);el.onpointerdown=ev=>{if(ev.button===2){ev.preventDefault();rightClickSlot(source,0,ev.clientX,ev.clientY);}};el.oncontextmenu=ev=>ev.preventDefault();el.onmouseenter=ev=>{const cur=getSlotRef(source,0);if(cur)showItemTooltip(cur,ev.clientX,ev.clientY,source);};el.onmouseleave=hideItemTooltip;}
  function refreshFurnaceUI(){if(!furnaceOpen||!furnaceActiveKey)return;const f=furnaceState();fillFurnaceSlot(UI.furnaceInput,'furnace_input');fillFurnaceSlot(UI.furnaceFuel,'furnace_fuel');fillFurnaceSlot(UI.furnaceOutput,'furnace_output');const recipe=f.input?SMELT_RECIPES[f.input.id]:null;UI.furnaceBurnFill.style.height=`${f.burnMax?clamp(f.burn/f.burnMax*100,0,100):0}%`;UI.furnaceProgressFill.style.width=`${recipe?clamp(f.progress/recipe.time*100,0,100):0}%`;UI.furnaceStatus.textContent=!f.input?'Włóż rudę żelaza/złota, piasek, bruk albo mięso.':!recipe?'Tego przedmiotu nie da się przetopić.':!f.fuel&&f.burn<=0?'Dodaj paliwo: najlepiej węgiel.':`Przetapianie: ${itemDefs[f.input.id]?.name||f.input.id} → ${itemDefs[recipe.out]?.name||recipe.out}`;}
  function openFurnace(hit){if(dead||!running)return;const key=fortKey(hit.x,hit.y,hit.z);furnaceActiveKey=key;furnaceState(key);furnaceOpen=true;inventoryOpen=false;chestOpen=false;adminOpen=false;mapOpen=false;paused=true;document.exitPointerLock?.();UI.inventoryPanel.classList.add('hidden');UI.adminPanel.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');UI.furnacePanel.classList.remove('hidden');refreshFurnaceUI();sfx('creak',.45);}
  function closeFurnace(resume=true){furnaceOpen=false;furnaceActiveKey=null;UI.furnacePanel?.classList.add('hidden');if(resume)resumeGame();}

  function refreshInventoryUI(){
    if(!UI.inventoryGrid)return;
    UI.inventoryGrid.innerHTML='';
    for(let i=HOTBAR_SIZE;i<INVENTORY_SIZE;i++)UI.inventoryGrid.appendChild(makeSlotElement('inventory',i,player.slots[i]));
    const sep=document.createElement('div');sep.className='inventory-hotbar-separator';sep.textContent='HOTBAR';UI.inventoryGrid.appendChild(sep);
    for(let i=0;i<HOTBAR_SIZE;i++)UI.inventoryGrid.appendChild(makeSlotElement('inventory',i,player.slots[i]));
    fillEquipSlot(UI.mainHandSlot,selectedStack(),'mainhand');fillEquipSlot(UI.offhandSlot,player.offhand,'offhand');renderCursorStack();
    if(UI.chestSection){UI.chestSection.classList.toggle('hidden',!chestOpen);UI.chestGrid.innerHTML='';if(chestOpen)for(let i=0;i<starterChestLoot.length;i++)UI.chestGrid.appendChild(makeSlotElement('chest',i,starterChestLoot[i]));}
    if(UI.craftGrid){UI.craftGrid.innerHTML='';for(let i=0;i<9;i++)UI.craftGrid.appendChild(makeSlotElement('craft',i,player.craftSlots[i]));}
    if(UI.craftOutput){
      const r=matchingCraftRecipe();UI.craftOutput.innerHTML='';UI.craftOutput.classList.toggle('ready',!!r);
      if(r){const[id,n]=Object.entries(r.out)[0];UI.craftOutput.append(itemIconCanvas(id,''));const b=document.createElement('b');b.className='inv-count';b.textContent=n>1?String(n):'';UI.craftOutput.appendChild(b);UI.craftOutput.title=itemDefs[id]?.name||id;UI.craftStatus.textContent=`Gotowe: ${r.name}. Kliknij wynik · Shift+klik = maksimum.`;}
      else UI.craftStatus.textContent='Ułóż recepturę w siatce 3×3 jak w Minecraft.';
      UI.craftOutput.onclick=ev=>takeCraftOutput(!!ev.shiftKey);
    }
    const q=(UI.craftSearch?.value||'').toLowerCase().trim();UI.recipeList.innerHTML='';
    for(const r of recipes){const reqText=requirementTextForRecipe(r),hay=(r.name+' '+reqText).toLowerCase();if(q&&!hay.includes(q))continue;const el=document.createElement('div');el.className=`recipe ${canCraft(r)?'':'cant'}`;const left=document.createElement('div');left.innerHTML=`<strong>${r.name}</strong><small>${reqText}</small>`;const acts=document.createElement('div');acts.className='recipe-actions';const fill=document.createElement('button');fill.textContent='UŁÓŻ 3×3';fill.disabled=!canCraft(r);fill.onclick=()=>fillCraftFromRecipe(r);acts.append(fill);el.append(left,acts);UI.recipeList.appendChild(el);}
  }
  function refreshHotbar(){
    UI.hotbar.innerHTML='';for(let i=0;i<HOTBAR_SIZE;i++){const st=player.slots[i],el=document.createElement('div');el.className='slot'+(i===player.selected?' selected':'');const num=document.createElement('span');num.className='num';num.textContent=String(i+1);el.appendChild(num);if(st){const icon=itemIconCanvas(st.id,''),count=document.createElement('span');count.className='count';count.textContent=st.count>1?String(st.count):'';el.append(icon,count);}el.onclick=()=>setSelected(i);UI.hotbar.appendChild(el);}const st=selectedStack(),sel=st?itemDefs[st.id]:null;UI.selectedLabel.textContent=st?`${sel?.name||st.id} · ${st.count}`:'Pusta ręka';
  }
  function setSelected(i){player.selected=(i+HOTBAR_SIZE)%HOTBAR_SIZE;refreshHotbar();refreshInventoryUI();player.toolSwing=.28;}
  function showMessage(txt,dur=1.6){UI.message.textContent=txt;UI.message.style.opacity='1';messageTimer=dur;}
  function openInventory(){if(dead||!running)return;inventoryOpen=true;adminOpen=false;furnaceOpen=false;mapOpen=false;chestOpen=false;paused=true;document.exitPointerLock?.();UI.adminPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');UI.inventoryPanel.classList.remove('hidden');refreshInventoryUI();sfx('inventory',.6);}
  function openStarterChest(){if(dead||!running)return;inventoryOpen=true;adminOpen=false;furnaceOpen=false;mapOpen=false;chestOpen=true;paused=true;document.exitPointerLock?.();UI.adminPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');UI.inventoryPanel.classList.remove('hidden');refreshInventoryUI();sfx('chest',.9);}
  function closeInventory(resume=true){
    if(cursorStack){const st=cloneStack(cursorStack);if(!addItem(st.id,st.count)){showMessage('Brak miejsca — odłóż przedmiot do slotu.');refreshInventoryUI();return;}cursorStack=null;}
    inventoryOpen=false;chestOpen=false;UI.inventoryPanel.classList.add('hidden');refreshInventoryUI();if(resume)resumeGame();
  }
  document.addEventListener('mousemove',e=>{positionCursorStack(e.clientX,e.clientY);moveItemTooltip(e.clientX,e.clientY);});
  document.addEventListener('pointerup',e=>{if(e.button===2&&slotPaint.active){slotPaint.active=false;slotPaint.visited.clear();refreshInventoryUI();refreshHotbar();}});

  function renderFullMap(){if(!UI.fullMap)return;const c=UI.fullMap,ctx=c.getContext('2d'),W=c.width,H=c.height,steps=90,radius=360,cell=W/steps;ctx.clearRect(0,0,W,H);ctx.save();ctx.beginPath();ctx.arc(W/2,H/2,W/2-4,0,Math.PI*2);ctx.clip();for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const dx=(i-(steps-1)/2)/(steps-1)*radius*2,dz=(j-(steps-1)/2)/(steps-1)*radius*2,wx=Math.floor(player.pos[0]+dx),wz=Math.floor(player.pos[2]+dz),h=terrainHeight(wx,wz),b=biomeAt(wx,wz,h);let col=biomeMapColor[b]||'#526a4a';if(h<=SEA)col='#244d58';ctx.fillStyle=col;ctx.fillRect(i*cell,j*cell,Math.ceil(cell)+1,Math.ceil(cell)+1);if(h>58){ctx.fillStyle='rgba(230,235,231,.13)';ctx.fillRect(i*cell,j*cell,Math.ceil(cell)+1,Math.ceil(cell)+1);}}const mark=(pos,col,size,shape='square')=>{if(!pos)return;const dx=(pos[0]-player.pos[0])/radius*(W/2),dz=(pos[2]-player.pos[2])/radius*(H/2);if(Math.hypot(dx,dz)>W*.49)return;ctx.fillStyle=col;if(shape==='diamond'){ctx.save();ctx.translate(W/2+dx,H/2+dz);ctx.rotate(Math.PI/4);ctx.fillRect(-size/2,-size/2,size,size);ctx.restore();}else{ctx.fillRect(W/2+dx-size/2,H/2+dz-size/2,size,size);}};mark(worldSpawn,'#e4d6a6',10,'diamond');mark(starterChestPos,'#d7ad50',8);for(const e of enemies){if(enemyDefs[e.type].passive)continue;mark(e.pos,'#9f2e31',5);}ctx.restore();ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-player.yaw);ctx.fillStyle='#eef2ed';ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(9,11);ctx.lineTo(0,7);ctx.lineTo(-9,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.strokeStyle='rgba(225,236,227,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H/2,W/2-4,0,Math.PI*2);ctx.stroke();if(UI.mapStats)UI.mapStats.textContent=`Przebyto: ${(player.distanceWalked||0).toFixed(1)} m · X ${Math.floor(player.pos[0])} · Z ${Math.floor(player.pos[2])} · zasięg mapy ±${radius} m`;}
  function openFullMap(){if(!running||dead)return;mapOpen=true;paused=true;inventoryOpen=false;adminOpen=false;furnaceOpen=false;document.exitPointerLock?.();UI.inventoryPanel.classList.add('hidden');UI.adminPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel.classList.remove('hidden');renderFullMap();}
  function closeFullMap(resume=true){mapOpen=false;UI.fullMapPanel?.classList.add('hidden');if(resume)resumeGame();}

  // ---------------------------------------------------------------------------
  // Admin catalogue
  // ---------------------------------------------------------------------------
  let adminTab='blocks';
  function mobIconElement(type,def){
    const c=document.createElement('canvas');c.width=64;c.height=64;c.className='mob-head-icon';const x=c.getContext('2d');x.imageSmoothingEnabled=false;
    const col=def.passive?'#776b55':'#342a27',dark=def.passive?'#2d2922':'#100f0e',eye=def.passive?'#e0c45d':'#e24736';
    x.fillStyle='rgba(0,0,0,.28)';x.fillRect(7,50,50,6);x.fillStyle=col;x.fillRect(14,16,36,34);x.fillStyle=dark;x.fillRect(10,11,10,14);x.fillRect(44,11,10,14);
    if(['boar','bear','wolf','fox','hyena','cow','moose','deer','doe'].includes(type)){x.fillStyle=col;x.fillRect(20,39,24,13);}if(type==='watcher'){x.fillStyle=dark;x.fillRect(22,4,20,50);}if(type==='crawler'){x.fillStyle=dark;x.fillRect(9,29,46,18);}
    x.fillStyle=eye;x.fillRect(21,28,5,4);x.fillRect(38,28,5,4);x.fillStyle='#080706';x.fillRect(23,29,2,2);x.fillRect(40,29,2,2);
    if(type==='boar'){x.fillStyle='#d7cfb4';x.fillRect(15,43,5,11);x.fillRect(44,43,5,11);}if(type==='deer'||type==='moose'){x.fillStyle='#56412c';x.fillRect(16,3,4,15);x.fillRect(44,3,4,15);}
    return c;
  }
  function refreshAdminGrid(){
    if(!UI.adminGrid)return;UI.adminGrid.innerHTML='';const q=(UI.adminSearch?.value||'').trim().toLowerCase();
    if(adminTab==='blocks'){
      for(const [num,def] of Object.entries(blockDefs)){const bid=Number(num);if(bid===B.AIR||bid===B.BEDROCK||bid===B.WATER||def.decor)continue;const id=blockItemById[bid];if(!id)continue;if(q&&!def.name.toLowerCase().includes(q))continue;
        const el=document.createElement('div');el.className='admin-card';el.appendChild(itemIconCanvas(id,''));const t=document.createElement('strong');t.textContent=def.name;const sm=document.createElement('small');sm.textContent='DODAJ ×64';el.append(t,sm);el.onclick=()=>{const n=maxStackFor(id)===1?1:64;if(addItem(id,n)){sfx('inventory',.8);showMessage(`${def.name}: dodano.`);}else showMessage('Brak miejsca w ekwipunku.');};UI.adminGrid.appendChild(el);}
    }else{
      for(const [type,def] of Object.entries(enemyDefs)){if(q&&!def.name.toLowerCase().includes(q)&&!type.includes(q))continue;const el=document.createElement('div');el.className='admin-card';const icon=mobIconElement(type,def);const t=document.createElement('strong');t.textContent=def.name;const sm=document.createElement('small');sm.textContent=`HP ${def.hp} · PRZYWOŁAJ`;el.append(icon,t,sm);el.onclick=()=>{const d=lookDir(),x=player.pos[0]+d[0]*5,z=player.pos[2]+d[2]*5;spawnEnemy(type,x,z,true);sfx(def.passive?'bird':'growl',.35);showMessage(`${def.name}: przywołano${def.passive?'':' — agresja aktywna'}.`);};UI.adminGrid.appendChild(el);}
    }
  }
  function openAdmin(){if(!adminMode||!running||dead)return;adminOpen=true;inventoryOpen=false;furnaceOpen=false;mapOpen=false;paused=true;furnaceActiveKey=null;document.exitPointerLock?.();UI.inventoryPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');UI.pauseMenu.classList.remove('active');UI.adminPanel.classList.remove('hidden');refreshAdminGrid();}
  function closeAdmin(resume=true){adminOpen=false;UI.adminPanel.classList.add('hidden');if(resume)resumeGame();}


  // ---------------------------------------------------------------------------
  // Save game / new world / starter chest
  // ---------------------------------------------------------------------------
  const SAVE_KEY='nightcraft-cold-forest-save-v15', LEGACY_SAVE_KEYS=['nightcraft-cold-forest-save-v14','nightcraft-cold-forest-save-v13','nightcraft-cold-forest-save-v12','nightcraft-cold-forest-save-v11','nightcraft-cold-forest-save-v10','nightcraft-cold-forest-save-v9','nightcraft-cold-forest-save-v8','nightcraft-cold-forest-save-v7','nightcraft-cold-forest-save-v6','nightcraft-cold-forest-save-v5','nightcraft-cold-forest-save-v4','nightcraft-the-hunt-save-v3'];
  const DAY_SECONDS=1200;
  let difficulty='nightmare', worldSeconds=(16/24)*DAY_SECONDS, playSeconds=0, autoSave=0, spawnTimer=4, lightning=0, lightningCooldown=20;
  function getAnySave(){try{return localStorage.getItem(SAVE_KEY)||LEGACY_SAVE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean)||null;}catch{return null;}}
  function hasSave(){return!!getAnySave();}
  function saveGame(){
    if(!running)return;
    try{
      const data={
        version:14,seed:worldSeed,seedText:UI.seedInput.value||String(worldSeed),difficulty,worldSeconds,playSeconds,worldSpawn,distanceWalked:player.distanceWalked||0,
        pos:player.pos,yaw:player.yaw,pitch:player.pitch,health:player.health,hunger:player.hunger,stamina:player.stamina,sanity:player.sanity,
        slots:player.slots,craftSlots:player.craftSlots,offhand:player.offhand,kills:player.kills,blocksMined:player.blocksMined,
        starterChestPos,starterChestLoot,adminMode,edits:[...edits.entries()],fortifications:[...fortifications.entries()],furnaces:[...furnaces.entries()],droppedItems:droppedItems.slice(-120).map(d=>({id:d.id,count:d.count,pos:d.pos,vel:d.vel,age:d.age,pickupDelay:d.pickupDelay,spin:d.spin,bob:d.bob})),
        settings:{sensitivity:input.sensitivity,volume:audio.volume,renderDistance}
      };
      localStorage.setItem(SAVE_KEY,JSON.stringify(data));UI.continueBtn.disabled=false;showMessage('Świat zapisany.',1.1);
    }catch(err){console.warn('Save failed',err);showMessage('Nie udało się zapisać świata.');}
  }
  function clearWorldRuntime(){
    for(const c of chunks.values()){deleteMesh(c.opaque);deleteMesh(c.water);}
    chunks.clear();dirtyChunks.clear();edits.clear();fortifications.clear();furnaces.clear();enemies.length=0;if(typeof birds!=='undefined')birds.length=0;particles.length=0;droppedItems.length=0;starterChestPos=null;starterChestLoot=Array(9).fill(null);cursorStack=null;player.craftSlots=Array(9).fill(null);worldSpawn=null;furnaceActiveKey=null;mapOpen=false;furnaceOpen=false;
  }
  function seedInitialInventory(){
    player.slots=Array(INVENTORY_SIZE).fill(null);
    player.slots[0]={id:'wood_pickaxe',count:1};
    player.slots[1]={id:'wood_axe',count:1};
    player.slots[2]={id:'wood_shovel',count:1};
    player.slots[3]={id:'wood_sword',count:1};
    player.slots[4]={id:'torch',count:24};
    player.slots[5]={id:'dirt',count:12};
    player.slots[6]={id:'cookedmeat',count:2};
    player.slots[7]={id:'berries',count:4};
    player.slots[8]={id:'planks',count:4};
  }
  function resetPlayer(){
    Object.assign(player,{pos:[0,26,0],vel:[0,0,0],yaw:0,pitch:-.1,health:100,hunger:100,stamina:100,sanity:100,grounded:false,inWater:false,selected:0,torchRaised:false,attackCooldown:0,damageCooldown:0,fallSpeed:0,kills:0,blocksMined:0,days:0,stepTimer:0,movePhase:0,bob:0,sway:0,impact:0,toolSwing:0,toolSwingSide:1,lastGroundY:0,wasInWater:false,swimSound:0,stepDistance:0,threat:0,cameraShake:0,heartbeat:0,distanceWalked:0});
    player.offhand=null;player.craftSlots=Array(9).fill(null);seedInitialInventory();input.sensitivity=.0115;UI.sensInput.value=String(input.sensitivity);audio.volume=.82;UI.volumeInput.value='0.82';setAudioVolume(audio.volume);
  }
  function migrateLegacyInventory(inv){
    player.slots=Array(INVENTORY_SIZE).fill(null);let idx=0;
    for(const [id,count] of Object.entries(inv||{})){let left=Math.floor(count||0);if(!itemDefs[id]||left<=0)continue;const max=maxStackFor(id);while(left>0&&idx<INVENTORY_SIZE){const take=Math.min(max,left);player.slots[idx++]={id,count:take};left-=take;}}
    if(!player.slots.some(Boolean))seedInitialInventory();
  }
  function randomStarterChestLoot(){
    const loot=Array(9).fill(null),roll=(salt)=>hash2i(worldSeed&0xffff,(worldSeed>>>16)&0xffff,salt),put=(slot,id,min,max)=>{const n=min+Math.floor(roll(0x500+slot)*(max-min+1));loot[slot]={id,count:n};};
    put(0,'torch',8,16);put(1,'planks',5,12);put(2,'coal',2,7);put(3,'cookedmeat',1,3);
    if(roll(0x811)>.35)loot[4]={id:'bandage',count:1+Math.floor(roll(0x812)*2)};
    if(roll(0x813)>.48)loot[5]={id:['axe','pickaxe','shovel'][Math.floor(roll(0x814)*3)],count:1};
    if(roll(0x815)>.42)loot[6]={id:'stone',count:4+Math.floor(roll(0x816)*8)};
    if(roll(0x817)>.58)loot[7]={id:'berries',count:2+Math.floor(roll(0x818)*5)};
    return loot;
  }
  function createStarterChestNear(spawn){
    const sx=Math.floor(spawn[0]),sz=Math.floor(spawn[2]);let best=null;
    for(let r=4;r<=10&&!best;r++)for(let i=0;i<16;i++){const a=(i/16)*Math.PI*2+hash2i(sx,sz,0x919)*1.7,x=sx+Math.round(Math.cos(a)*r),z=sz+Math.round(Math.sin(a)*r),y=findSurface(x,z);if(y<=SEA+1||y>=WORLD_H-3)continue;const ground=getBlock(x,y-1,z);if([B.WATER,B.ICE].includes(ground))continue;const h0=terrainHeight(x,z),h1=terrainHeight(x+1,z),h2=terrainHeight(x,z+1);if(Math.max(Math.abs(h0-h1),Math.abs(h0-h2))>2)continue;if(getBlock(x,y,z)===B.AIR){best=[x,y,z];break;}}
    if(!best){const x=sx+3,z=sz+3,y=findSurface(x,z);best=[x,y,z];}
    starterChestPos=best;starterChestLoot=randomStarterChestLoot();setBlock(best[0],best[1],best[2],B.CHEST);
    // Four tiny cobble pads + torches form a visible starter camp. Keeping the
    // lamps on the chest level guarantees they exist even on slopes / shoreline.
    for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){const tx=best[0]+dx,tz=best[2]+dz,ty=best[1];setBlock(tx,ty-1,tz,B.COBBLE);setBlock(tx,ty,tz,B.TORCH);if(blockDefs[getBlock(tx,ty+1,tz)]?.decor||isFoliage(getBlock(tx,ty+1,tz)))setBlock(tx,ty+1,tz,B.AIR);}
    return best;
  }
  function startNewGame(){
    initAudio();clearWorldRuntime();resetPlayer();
    const seedText=(UI.seedInput.value.trim()||`${Date.now()}-${Math.floor(Math.random()*9999)}`);UI.seedInput.value=seedText;worldSeed=hashString(seedText);difficulty=UI.difficultySelect.value;
    worldSeconds=(16/24)*DAY_SECONDS;playSeconds=0;spawnTimer=5;lightning=0;lightningCooldown=12+Math.random()*34;adminMode=false;updateAdminButton();
    player.pos=findScenicSpawn();worldSpawn=[...player.pos];updateStreaming(player.pos[0],player.pos[2],true);createStarterChestNear(player.pos);
    running=true;dead=false;paused=true;UI.mainMenu.classList.remove('active');UI.hud.classList.remove('hidden');refreshHotbar();refreshInventoryUI();saveGame();resumeGame();
  }
  function loadGame(){
    initAudio();let d;try{d=JSON.parse(getAnySave()||'null');}catch{}if(!d){startNewGame();return;}
    clearWorldRuntime();resetPlayer();worldSeed=d.seed>>>0;UI.seedInput.value=d.seedText||String(worldSeed);difficulty=d.difficulty||'nightmare';UI.difficultySelect.value=difficulty;
    {const raw=d.worldSeconds??((16/24)*720);if((d.version||0)<8){const oldDay=Math.floor(raw/720),oldPh=(raw%720)/720;worldSeconds=(oldDay+oldPh)*DAY_SECONDS;}else worldSeconds=raw;}playSeconds=d.playSeconds||0;if(Array.isArray(d.edits))for(const [k,v]of d.edits)edits.set(k,v);
    player.pos=Array.isArray(d.pos)?d.pos:[0,26,0];worldSpawn=Array.isArray(d.worldSpawn)?d.worldSpawn:(Array.isArray(d.starterChestPos)?[d.starterChestPos[0],findSurface(d.starterChestPos[0],d.starterChestPos[2]),d.starterChestPos[2]]:[...player.pos]);player.distanceWalked=Number(d.distanceWalked)||0;player.yaw=d.yaw||0;player.pitch=d.pitch||-.1;player.health=clamp(d.health??100,1,100);player.hunger=clamp(d.hunger??100,0,100);player.stamina=clamp(d.stamina??100,0,100);player.sanity=clamp(d.sanity??100,0,100);
    if(Array.isArray(d.slots)){player.slots=Array(INVENTORY_SIZE).fill(null);for(let i=0;i<Math.min(INVENTORY_SIZE,d.slots.length);i++)player.slots[i]=normalizeStack(d.slots[i]);}else migrateLegacyInventory(d.inventory);
    player.craftSlots=Array.isArray(d.craftSlots)?d.craftSlots.slice(0,9).map(normalizeStack):Array(9).fill(null);while(player.craftSlots.length<9)player.craftSlots.push(null);
    player.offhand=normalizeStack(typeof d.offhand==='string'?{id:d.offhand,count:1}:d.offhand);player.kills=d.kills||0;player.blocksMined=d.blocksMined||0;starterChestPos=Array.isArray(d.starterChestPos)?d.starterChestPos:null;starterChestLoot=Array.isArray(d.starterChestLoot)?d.starterChestLoot.slice(0,9).map(normalizeStack):Array(9).fill(null);while(starterChestLoot.length<9)starterChestLoot.push(null);if(Array.isArray(d.fortifications))for(const[k,v]of d.fortifications)fortifications.set(k,v);if(Array.isArray(d.furnaces))for(const[k,v]of d.furnaces)furnaces.set(k,v);if(Array.isArray(d.droppedItems))for(const q of d.droppedItems.slice(-120)){const st=normalizeStack(q);if(!st||!Array.isArray(q.pos))continue;droppedItems.push({id:st.id,count:st.count,pos:q.pos.slice(0,3).map(Number),vel:Array.isArray(q.vel)?q.vel.slice(0,3).map(Number):[0,0,0],age:Math.max(.5,Number(q.age)||0),pickupDelay:Number.isFinite(Number(q.pickupDelay))?Number(q.pickupDelay):.45,spin:Number(q.spin)||0,bob:Number(q.bob)||0,onGround:false});}
    adminMode=!!d.adminMode;updateAdminButton();
    updateStreaming(worldSpawn?.[0]||player.pos[0],worldSpawn?.[2]||player.pos[2],true);if(!spawnPointIsSafe(player.pos))player.pos=findSafeSpawn(worldSpawn?.[0]||player.pos[0],worldSpawn?.[2]||player.pos[2],28);if(!spawnPointIsSafe(player.pos)){const bx=Math.floor(worldSpawn?.[0]||player.pos[0]),bz=Math.floor(worldSpawn?.[2]||player.pos[2]);player.pos=clearSpawnPocket(bx,clamp(findSurface(bx,bz),2,WORLD_H-4),bz);}
    if(d.settings){const oldSens=Number(d.settings.sensitivity)||.0095;input.sensitivity=clamp(d.version>=5?oldSens:Math.max(.0105,oldSens*1.18),.002,.022);audio.volume=clamp(d.settings.volume??.7,0,1);renderDistance=clamp(Number(d.settings.renderDistance)||4,2,6);UI.sensInput.value=String(input.sensitivity);UI.volumeInput.value=String(audio.volume);UI.renderDistanceSelect.value=String(renderDistance);setAudioVolume(audio.volume);}
    updateStreaming(player.pos[0],player.pos[2],true);if(!starterChestPos)createStarterChestNear(player.pos);
    running=true;dead=false;paused=true;UI.mainMenu.classList.remove('active');UI.hud.classList.remove('hidden');refreshHotbar();refreshInventoryUI();saveGame();resumeGame();
  }

  // ---------------------------------------------------------------------------
  // Input / pointer lock / admin toggle
  // ---------------------------------------------------------------------------
  function updateAdminButton(){if(!UI.adminToggleBtn)return;UI.adminToggleBtn.classList.toggle('active',adminMode);UI.adminToggleBtn.textContent=`TRYB ADMINISTRATORA: ${adminMode?'ON':'OFF'}`;}
  function resumeGame(){if(!running||dead)return;paused=false;inventoryOpen=false;adminOpen=false;furnaceOpen=false;mapOpen=false;chestOpen=false;furnaceActiveKey=null;UI.pauseMenu.classList.remove('active');UI.inventoryPanel.classList.add('hidden');UI.adminPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');canvas.requestPointerLock?.();initAudio();audio.ctx?.resume?.();}
  function pauseGame(){if(!running||dead||inventoryOpen||adminOpen||furnaceOpen||mapOpen)return;paused=true;input.mouseLeft=false;input.mouseMiddle=false;mineAmount=0;upgradeHold=0;setMiningHud(false);UI.pauseMenu.classList.add('active');}
  function quitToMenu(){saveGame();running=false;paused=true;document.exitPointerLock?.();UI.pauseMenu.classList.remove('active');UI.deathMenu.classList.remove('active');UI.inventoryPanel.classList.add('hidden');UI.adminPanel.classList.add('hidden');UI.furnacePanel?.classList.add('hidden');UI.fullMapPanel?.classList.add('hidden');UI.hud.classList.add('hidden');UI.mainMenu.classList.add('active');UI.continueBtn.disabled=!hasSave();}
  document.addEventListener('pointerlockchange',()=>{input.locked=document.pointerLockElement===canvas;if(running&&!dead&&!inventoryOpen&&!adminOpen&&!furnaceOpen&&!mapOpen&&!input.locked&&!paused)pauseGame();});
  document.addEventListener('mousemove',e=>{if(!input.locked||paused)return;player.yaw+=e.movementX*input.sensitivity;player.pitch-=e.movementY*input.sensitivity;player.sway=clamp(player.sway+e.movementX*0.0008,-.08,.08);player.pitch=clamp(player.pitch,-1.53,1.53);});
  document.addEventListener('keydown',e=>{
    if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft'].includes(e.code))e.preventDefault();input.keys.add(e.code);
    if(e.code==='Escape'&&running&&!dead){e.preventDefault();input.keys.delete(e.code);if(mapOpen)closeFullMap(true);else if(furnaceOpen)closeFurnace(true);else if(adminOpen)closeAdmin(true);else if(inventoryOpen)closeInventory(true);else if(paused)resumeGame();else{paused=true;document.exitPointerLock?.();UI.pauseMenu.classList.add('active');}return;}
    if(e.code==='KeyE'&&running&&!dead){e.preventDefault();if(furnaceOpen)closeFurnace(true);else if(mapOpen)closeFullMap(true);else if(adminOpen)closeAdmin(true);else if(inventoryOpen)closeInventory(true);else openInventory();}
    if(e.code==='KeyM'&&running&&!dead){e.preventDefault();if(mapOpen)closeFullMap(true);else openFullMap();}
    if(e.code==='KeyT'&&running&&!dead&&adminMode){e.preventDefault();if(adminOpen)closeAdmin(true);else openAdmin();}
    if(e.code==='F3'){e.preventDefault();debug=!debug;UI.debugPanel.classList.toggle('hidden',!debug);}
    if(/^Digit[1-9]$/.test(e.code)&&running&&!inventoryOpen&&!adminOpen&&!furnaceOpen&&!mapOpen)setSelected(Number(e.code.slice(5))-1);
  });
  document.addEventListener('keyup',e=>input.keys.delete(e.code));
  canvas.addEventListener('mousedown',e=>{if(!input.locked||paused)return;if(e.button===0)input.mouseLeft=true;if(e.button===1){e.preventDefault();input.mouseMiddle=true;upgradeHold=0;}if(e.button===2){input.mouseRight=true;useSelected();}});
  document.addEventListener('mouseup',e=>{if(e.button===0){input.mouseLeft=false;mineAmount=0;mineTargetKey='';setMiningHud(false);}if(e.button===1){input.mouseMiddle=false;upgradeHold=0;upgradeTargetKey='';}if(e.button===2)input.mouseRight=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{if(running&&!paused){setSelected(player.selected+(e.deltaY>0?1:-1));e.preventDefault();}},{passive:false});
  window.addEventListener('blur',()=>{if(running&&!dead&&!paused&&!inventoryOpen&&!adminOpen&&!furnaceOpen&&!mapOpen){document.exitPointerLock?.();pauseGame();}});
  window.addEventListener('beforeunload',()=>{if(running)saveGame();});

  UI.newGameBtn.onclick=startNewGame;UI.continueBtn.onclick=loadGame;UI.resumeBtn.onclick=resumeGame;UI.saveBtn.onclick=saveGame;UI.quitBtn.onclick=quitToMenu;UI.respawnBtn.onclick=respawn;UI.deathQuitBtn.onclick=quitToMenu;UI.closeInventoryBtn.onclick=()=>closeInventory(true);if(UI.closeFurnaceBtn)UI.closeFurnaceBtn.onclick=()=>closeFurnace(true);if(UI.closeMapBtn)UI.closeMapBtn.onclick=()=>closeFullMap(true);
  UI.adminToggleBtn.onclick=()=>{adminMode=!adminMode;updateAdminButton();sfx('inventory',.7);showMessage(adminMode?'Tryb administratora włączony. T otwiera katalog.':'Tryb administratora wyłączony.',1.5);saveGame();};
  UI.closeAdminBtn.onclick=()=>closeAdmin(true);UI.adminBlocksTab.onclick=()=>{adminTab='blocks';UI.adminBlocksTab.classList.add('active');UI.adminMobsTab.classList.remove('active');refreshAdminGrid();};UI.adminMobsTab.onclick=()=>{adminTab='mobs';UI.adminMobsTab.classList.add('active');UI.adminBlocksTab.classList.remove('active');refreshAdminGrid();};UI.adminSearch.oninput=refreshAdminGrid;
  UI.sensInput.oninput=()=>input.sensitivity=Number(UI.sensInput.value);UI.volumeInput.oninput=()=>setAudioVolume(Number(UI.volumeInput.value));UI.renderDistanceSelect.onchange=()=>{renderDistance=Number(UI.renderDistanceSelect.value);updateStreaming(player.pos[0],player.pos[2],true);};if(UI.craftSearch)UI.craftSearch.oninput=refreshInventoryUI;
  UI.continueBtn.disabled=!hasSave();updateAdminButton();

  // ---------------------------------------------------------------------------
  // Core simulation
  // ---------------------------------------------------------------------------
  function sunLevel(){const ph=(worldSeconds%DAY_SECONDS)/DAY_SECONDS;return clamp((Math.sin((ph-.25)*Math.PI*2)+.16)/1.16,0,1);}
  function nightLevel(){return 1-sunLevel();}
  let mineParticleTimer=0,weatherTimer=0,weatherMode='mist',weatherIntensity=.35,lastVP=null;
  function projectWorldToScreen(pos){
    if(!lastVP)return null;const m=lastVP,x=pos[0],y=pos[1],z=pos[2];
    const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];
    if(cw<=.01)return null;const nx=cx/cw,ny=cy/cw;if(nx<-1.2||nx>1.2||ny<-1.2||ny>1.2)return null;
    return[(nx*.5+.5)*innerWidth,(-ny*.5+.5)*innerHeight];
  }
  function setMiningHud(active,hit=null){
    if(UI.mineProgress)UI.mineProgress.style.opacity='0';if(UI.mineHud)UI.mineHud.classList.remove('active');
    if(!active||!hit){UI.worldMineBar?.classList.add('hidden');if(UI.worldMineFill)UI.worldMineFill.style.width='0%';return;}
    const pct=Math.round(clamp(mineAmount,0,1)*100),scr=projectWorldToScreen([hit.x+.5,hit.y+1.12,hit.z+.5]);
    UI.worldMineBar.classList.remove('hidden');UI.worldMineFill.style.width=`${pct}%`;UI.worldMinePct.textContent=`${pct}%`;UI.worldMineName.textContent=blockDefs[hit.id]?.name||'BLOK';
    if(scr){UI.worldMineBar.style.left=`${scr[0]}px`;UI.worldMineBar.style.top=`${scr[1]}px`;}else{UI.worldMineBar.style.left='50%';UI.worldMineBar.style.top='50%';}
  }
  function dropStackFromBlock(st,x,y,z,boost=1){if(!st||!st.id||st.count<=0)return;const a=Math.random()*Math.PI*2;spawnItemDrop(st.id,st.count,[x+.5,y+.58,z+.5],[Math.cos(a)*(.45+.45*Math.random())*boost,2.25+Math.random()*1.15*boost,Math.sin(a)*(.45+.45*Math.random())*boost],.52);}
  function breakBlockByPlayer(hit){
    const def=blockDefs[hit.id];if(!def)return false;const brokenKey=fortKey(hit.x,hit.y,hit.z);
    if(hit.id===B.CHEST&&starterChestPos&&hit.x===starterChestPos[0]&&hit.y===starterChestPos[1]&&hit.z===starterChestPos[2]){for(const st of starterChestLoot)if(st)dropStackFromBlock(st,hit.x,hit.y,hit.z,.85);starterChestLoot=Array(9).fill(null);starterChestPos=null;showMessage('Skrzynia rozbita — loot wypadł na ziemię.',1.5);}
    if(hit.id===B.FURNACE){const fu=furnaces.get(brokenKey);if(fu){for(const st of[fu.input,fu.fuel,fu.output])if(st)dropStackFromBlock(st,hit.x,hit.y,hit.z,.8);furnaces.delete(brokenKey);}}
    fortifications.delete(brokenKey);setBlock(hit.x,hit.y,hit.z,B.AIR);player.blocksMined++;
    if(def.drop)dropStackFromBlock({id:def.drop,count:1},hit.x,hit.y,hit.z,1);
    if([B.LEAVES,B.PINELEAVES,B.BIRCHLEAVES,B.DARKLEAVES,B.AUTUMNLEAVES,B.WILLOWLEAVES,B.POPLARLEAVES,B.MIMOSALEAVES].includes(hit.id)&&Math.random()<.24)dropStackFromBlock({id:'berries',count:1},hit.x,hit.y,hit.z,.75);
    spawnDebris(hit.x,hit.y,hit.z,hit.id,22,true);sfx('break',1,soundMaterialForBlock(hit.id));player.impact=Math.min(1,player.impact+.18);player.toolSwing=1;return true;
  }
  function updateMining(dt){
    currentTarget=voxelRaycast(eyePos(),lookDir(),6);
    if(!input.mouseLeft||paused){mineAmount=0;mineTargetKey='';setMiningHud(false);return;}
    if(enemyRayHit(3.65)){attackEnemy();mineAmount=0;mineTargetKey='';setMiningHud(false);return;}
    const hit=currentTarget;if(!hit||hit.id===B.BEDROCK||hit.id===B.WATER){mineAmount=0;mineTargetKey='';setMiningHud(false);return;}
    const key=editKey(hit.x,hit.y,hit.z);if(key!==mineTargetKey){mineTargetKey=key;mineAmount=0;mineParticleTimer=0;player.toolSwing=.45;}
    const def=blockDefs[hit.id],need=miningSecondsFor(hit.id,hit.x,hit.y,hit.z);mineAmount+=dt/need;setMiningHud(true,hit);mineParticleTimer-=dt;player.toolSwing=Math.max(player.toolSwing,.24+Math.sin(performance.now()*.02)*.05);
    if(mineParticleTimer<=0){mineParticleTimer=.065+Math.random()*.045;spawnDebris(hit.x,hit.y,hit.z,hit.id,mineAmount<.12?4:2,false);sfx('mine',.72,soundMaterialForBlock(hit.id));}
    if(mineAmount>=1){breakBlockByPlayer(hit);mineAmount=0;mineTargetKey='';setMiningHud(false);}
  }

  let lastNightState=false,whisperTimer=8;
  function updateWeather(dt,night){
    weatherTimer-=dt;if(weatherTimer<=0){weatherTimer=20+Math.random()*45;const biome=biomeAt(Math.floor(player.pos[0]),Math.floor(player.pos[2])),r=Math.random();if(['tundra','snow_peaks','frozen_shore'].includes(biome))weatherMode=r<.72?'snow':'mist';else if(['swamp','marsh','forest','birch','darkwood','taiga','mountain_forest'].includes(biome))weatherMode=r<.48?'rain':r<.72?'mist':'ash';else if(biome==='highlands'||biome==='barren')weatherMode=r<.55?'ash':'mist';else weatherMode=r<.3?'rain':r<.55?'ash':'mist';weatherIntensity=.25+Math.random()*.7;}
    const count=Math.floor((weatherMode==='mist'?1:weatherMode==='rain'?7:weatherMode==='snow'?4:3)*weatherIntensity*dt*60);
    for(let i=0;i<count;i++){
      const x=player.pos[0]+(Math.random()-.5)*24,z=player.pos[2]+(Math.random()-.5)*24,y=player.pos[1]+6+Math.random()*10;
      if(weatherMode==='rain')spawnParticle([x,y,z],[-.35+Math.random()*.2,-12-Math.random()*6,.1+Math.random()*.3],1.0,[.34,.43,.45,.6],2.2,0,0);
      else if(weatherMode==='snow')spawnParticle([x,y,z],[(Math.random()-.5)*.65,-1.2-Math.random()*1.2,(Math.random()-.5)*.65],4.5,[.72,.76,.73,.72],3.2+Math.random()*2,0,.05);
      else if(weatherMode==='ash')spawnParticle([x,y,z],[(Math.random()-.5)*.8,-.65-Math.random()*.8,(Math.random()-.5)*.8],5.0,[.24,.25,.23,.54],2.3+Math.random()*2,0,.06);
      else if(Math.random()<.25)spawnParticle([x,y,z],[(Math.random()-.5)*.22,-.08,(Math.random()-.5)*.22],7,[.48,.54,.5,.16],5,0,.02);
    }
    if(hasHeldTorch()&&Math.random()<dt*18){const cam=eyePos(),d=lookDir(),right=[Math.cos(player.yaw),0,Math.sin(player.yaw)];spawnParticle([cam[0]+right[0]*.42+d[0]*.45,cam[1]-.34+d[1]*.25,cam[2]+right[2]*.42+d[2]*.45],[(Math.random()-.5)*.3,.5+Math.random()*.8,(Math.random()-.5)*.3],.35+Math.random()*.35,[1,.48+.25*Math.random(),.12,.9],2.5+Math.random()*2,1.2,.2);}
    const ph=(worldSeconds%DAY_SECONDS)/DAY_SECONDS,dusk=Math.max(0,1-Math.abs(ph-.73)/.10),bio=biomeAt(Math.floor(player.pos[0]),Math.floor(player.pos[2]));
    if(['forest','old_growth','mist_forest','darkwood','birch','autumn','taiga','spruce_valley'].includes(bio)&&weatherMode!=='rain'&&Math.random()<dt*(.55+weatherIntensity*.8)){const a=Math.random()*Math.PI*2,r=3+Math.random()*12,col=bio==='autumn'?[.50,.24,.08,.72]:[.24,.34,.15,.60];spawnParticle([player.pos[0]+Math.cos(a)*r,player.pos[1]+4+Math.random()*6,player.pos[2]+Math.sin(a)*r],[(Math.random()-.5)*.45,-.32-Math.random()*.55,(Math.random()-.5)*.45],5+Math.random()*4,col,2.2+Math.random()*2,0,.03);}
    if(dusk>.25&&weatherMode!=='rain'&&['forest','old_growth','mist_forest','willow_swamp','swamp','marsh','flower_meadow'].includes(bio)&&Math.random()<dt*2.1*dusk){const a=Math.random()*Math.PI*2,r=3+Math.random()*10;spawnParticle([player.pos[0]+Math.cos(a)*r,player.pos[1]+.6+Math.random()*2.6,player.pos[2]+Math.sin(a)*r],[(Math.random()-.5)*.18,(Math.random()-.5)*.08,(Math.random()-.5)*.18],3.5+Math.random()*3,[.72,.82,.38,.82],3+Math.random()*2,0,.05);}
    UI.weatherInfo.textContent=weatherMode==='rain'?'ULEWA · MOKRY TEREN':weatherMode==='snow'?'ŚNIEG · ZIMNO':weatherMode==='ash'?'POPIÓŁ W POWIETRZU':'CIĘŻKA MGŁA';UI.weatherInfo.style.opacity=String(.45+weatherIntensity*.4+night*.12);
  }
  function footstepMaterial(id=null){
    if(id==null){const gx=Math.floor(player.pos[0]),gz=Math.floor(player.pos[2]),gy=Math.floor(player.pos[1]-.12);id=getBlock(gx,gy,gz);}
    if(id===B.WATER)return'water';
    return soundMaterialForBlock(id);
  }
  function updatePlayer(dt,night){
    player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.damageCooldown=Math.max(0,player.damageCooldown-dt);player.toolSwing=Math.max(0,player.toolSwing-dt*3.7);player.impact=Math.max(0,player.impact-dt*4.8);player.cameraShake=Math.max(0,player.cameraShake-dt*3.3);player.sway=lerp(player.sway,0,clamp(dt*6,0,1));
    const feet=getBlock(Math.floor(player.pos[0]),Math.floor(player.pos[1]+.2),Math.floor(player.pos[2])),chest=getBlock(Math.floor(player.pos[0]),Math.floor(player.pos[1]+1.05),Math.floor(player.pos[2])),head=getBlock(Math.floor(player.pos[0]),Math.floor(player.pos[1]+1.72),Math.floor(player.pos[2]));player.inWater=(feet===B.WATER||chest===B.WATER);if(player.inWater!==player.wasInWater){sfx('splash',player.inWater?1:.7);player.wasInWater=player.inWater;}
    let ix=(input.keys.has('KeyD')?1:0)-(input.keys.has('KeyA')?1:0),iz=(input.keys.has('KeyW')?1:0)-(input.keys.has('KeyS')?1:0);const il=Math.hypot(ix,iz)||1;ix/=il;iz/=il;
    const sprint=(input.keys.has('ShiftLeft')||input.keys.has('ShiftRight'))&&iz>0&&player.stamina>2&&!player.inWater;let speed=player.inWater?2.95:sprint?7.0:4.55;if(player.hunger<15)speed*=.8;if(feet===B.MUD)speed*=.72;if(feet===B.SNOW)speed*=.9;
    const fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=Math.sin(player.yaw),vx=(fx*iz+rx*ix)*speed,vz=(fz*iz+rz*ix)*speed;
    const accel=player.grounded?18:player.inWater?7:6.5;player.vel[0]=lerp(player.vel[0],vx,clamp(accel*dt,0,1));player.vel[2]=lerp(player.vel[2],vz,clamp(accel*dt,0,1));
    if(player.inWater){player.vel[1]+=9.8*dt;if(input.keys.has('Space'))player.vel[1]+=17.0*dt;if(head!==B.WATER&&input.keys.has('Space'))player.vel[1]=Math.max(player.vel[1],6.5);player.vel[1]*=Math.pow(.34,dt);player.swimSound-=dt;if((Math.hypot(player.vel[0],player.vel[2])>1||input.keys.has('Space'))&&player.swimSound<=0){sfx('swim',.7);player.swimSound=.45;}}else{player.vel[1]-=19.2*dt;player.swimSound=0;}
    player.grounded=playerGroundedAt();if(player.grounded&&input.keys.has('Space')&&!player.inWater){player.vel[1]=7.35;player.grounded=false;player.impact=.1;sfx('step',.65,footstepMaterial());}
    const preVy=player.vel[1],preMoveX=player.pos[0],preMoveZ=player.pos[2];movePlayerAxis(0,player.vel[0]*dt);movePlayerAxis(2,player.vel[2]*dt);movePlayerAxis(1,player.vel[1]*dt);const travelled=Math.hypot(player.pos[0]-preMoveX,player.pos[2]-preMoveZ);if(travelled<2.5)player.distanceWalked=(player.distanceWalked||0)+travelled;
    const nowGround=playerGroundedAt();if(nowGround&&preVy<0){if(preVy<-11.5)hurtPlayer(Math.min(55,(Math.abs(preVy)-10.5)*5),'upadek');player.grounded=true;player.vel[1]=0;player.impact=Math.min(1,player.impact+clamp((Math.abs(preVy)-3)/12,0,.6));}
    if(player.pos[1]<-8)hurtPlayer(999,'otchłań');
    const planar=Math.hypot(player.vel[0],player.vel[2]),moving=planar>.65;if(player.grounded&&moving){player.movePhase+=dt*(sprint?12:8.3)*(planar/Math.max(speed,.01));player.stepDistance+=planar*dt;const stride=sprint?.92:1.12;if(player.stepDistance>=stride){player.stepDistance%=stride;sfx('step',sprint?1.14:1.0,footstepMaterial());}}else if(!player.inWater)player.stepDistance=0;
    const targetBob=player.grounded&&moving?Math.sin(player.movePhase*2)*(.035+(sprint?.018:0)):player.inWater?Math.sin(performance.now()*.003)*.025:0;player.bob=lerp(player.bob,targetBob,clamp(dt*14,0,1));if(moving)player.sway+=Math.sin(player.movePhase)*.0025;
    if(sprint&&moving){player.stamina=clamp(player.stamina-13.5*dt,0,100);player.hunger=clamp(player.hunger-.05*dt,0,100);}else player.stamina=clamp(player.stamina+(player.hunger>10?17:8)*dt,0,100);
    player.hunger=clamp(player.hunger-(.018+(moving?.014:0))*dt,0,100);if(player.hunger<=0&&player.damageCooldown<=0)hurtPlayer(4,'głód');if(player.hunger>76&&player.health<100)player.health=clamp(player.health+.46*dt,0,100);
    const hasLight=hasHeldTorch(),sanityDelta=night>.62&&!hasLight?-(.24+.34*night):(.085*(1-night));player.sanity=clamp(player.sanity+sanityDelta*dt,0,100);if(player.sanity<=0&&player.damageCooldown<=0)hurtPlayer(3,'panika');
    whisperTimer-=dt;if(player.sanity<32&&whisperTimer<=0){const msgs=['Coś idzie za tobą.','Nie patrz długo w las.','Słyszysz kroki, ale nie swoje.','W lesie coś oddycha razem z tobą.','Nie każda sylwetka jest drzewem.'];showMessage(msgs[Math.floor(Math.random()*msgs.length)],2.3);whisperTimer=5+Math.random()*8;sfx('howl',.3);}
    UI.vignette.style.opacity=String(.7+(100-player.sanity)/250+night*.16);
  }

  function lineOfSightToEnemy(e){
    const o=eyePos(),target=[e.pos[0],e.pos[1]+enemyDefs[e.type].height,e.pos[2]],v=[target[0]-o[0],target[1]-o[1],target[2]-o[2]],d=Math.hypot(...v);if(d<.01)return true;const dir=[v[0]/d,v[1]/d,v[2]/d],hit=voxelRaycast(o,dir,Math.max(.2,d-.45));return !hit;
  }
  function updateThreatSense(dt){
    let nearest=999,visible=false,attacker=false;
    for(const e of enemies){const def=enemyDefs[e.type];if(def.passive)continue;const d=Math.hypot(e.pos[0]-player.pos[0],e.pos[2]-player.pos[2]);if(d<nearest){nearest=d;visible=d<22&&lineOfSightToEnemy(e);}if(d<def.aggro*.75)attacker=true;}
    let target=0;if(nearest<26)target=clamp((26-nearest)/22,0,1)*.62;if(visible)target=Math.max(target,clamp((22-nearest)/18,0,1)*.88);if(attacker)target=Math.max(target,.60);if(nearest<5)target=1;
    const rate=target>player.threat?dt*1.55:dt*.55;player.threat=lerp(player.threat,target,clamp(rate,0,1));
    if(UI.threatPulse){UI.threatPulse.style.opacity=String(clamp((player.threat-.10)*.88,0,.78));UI.threatPulse.style.setProperty?.('--pulse',String(player.threat));}
    player.heartbeat-=dt;if(player.threat>.42&&player.heartbeat<=0){if(!playSample('heartbeat',.48+player.threat*.42,.94+player.threat*.08)){tone(56,.11,.055+player.threat*.035,'sine',.72);tone(42,.13,.040+player.threat*.025,'sine',.66,.12);}player.heartbeat=lerp(1.25,.42,player.threat);}
    if(player.threat>.68)player.sanity=clamp(player.sanity-dt*.18*player.threat,0,100);
  }
  function updateWorld(dt){
    if(paused||!running||dead)return;worldSeconds+=dt;playSeconds+=dt;player.days=worldSeconds/DAY_SECONDS;const night=nightLevel();
    updatePlayer(dt,night);updateMining(dt);updateUpgrade(dt);updateFurnaces(dt);updateEnemies(dt,night);updateThreatSense(dt);updateBirds(dt,night);updateWeather(dt,night);updateParticles(dt);updateDroppedItems(dt);ambientAudioTick(dt,night);
    spawnTimer-=dt;if(spawnTimer<=0){spawnAroundPlayer(night);spawnTimer=(night>.5?3.5+Math.random()*3.5:7+Math.random()*5.5)*(difficulty==='insane'?.66:difficulty==='nightmare'?.82:1);}
    const isNight=night>.68;if(isNight&&!lastNightState){UI.nightWarning.classList.remove('hidden');void UI.nightWarning.offsetWidth;UI.nightWarning.classList.add('hidden');requestAnimationFrame(()=>UI.nightWarning.classList.remove('hidden'));setTimeout(()=>UI.nightWarning.classList.add('hidden'),3100);sfx('howl');}lastNightState=isNight;
    lightning=Math.max(0,lightning-dt*3.2);lightningCooldown-=dt;if(isNight&&lightningCooldown<=0){lightning=1;sfx('thunder');lightningCooldown=15+Math.random()*48;}
    autoSave+=dt;if(autoSave>18){autoSave=0;saveGame();}if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)UI.message.style.opacity='0';}
    updateStreaming(player.pos[0],player.pos[2]);processDirty(3);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function resize(){const dpr=Math.min(1.5,window.devicePixelRatio||1),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
  function drawVoxelMesh(m,alpha,VP,cam,fogColor,fogNear,fogFar,day,torchPos,torchPower,waterMode=0){
    if(!m)return;gl.useProgram(voxelProgram);gl.uniformMatrix4fv(VL.vp,false,VP);gl.uniform3fv(VL.cam,cam);gl.uniform3fv(VL.fogColor,fogColor);gl.uniform1f(VL.fogNear,fogNear);gl.uniform1f(VL.fogFar,fogFar);gl.uniform1f(VL.day,day);gl.uniform3fv(VL.torch,torchPos);gl.uniform1f(VL.torchPower,torchPower);gl.uniform1f(VL.alpha,alpha);gl.uniform1f(VL.time,performance.now()/1000);gl.uniform1f(VL.water,waterMode);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlas.tex);gl.uniform1i(VL.tex,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.enableVertexAttribArray(VL.pos);gl.vertexAttribPointer(VL.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.enableVertexAttribArray(VL.normal);gl.vertexAttribPointer(VL.normal,3,gl.BYTE,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.u);gl.enableVertexAttribArray(VL.uv);gl.vertexAttribPointer(VL.uv,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  function drawBox(VP,pos,scale,color,ry,fogColor,cam,rx=0,rz=0){
    const model=modelMatrix(pos,scale,ry||0,rx||0,rz||0),mvp=M4.multiply(VP,model),fog=clamp((dist3(pos,cam)-14)/(renderDistance*CHUNK-10),0,1);gl.useProgram(colorProgram);gl.uniformMatrix4fv(CL.mvp,false,mvp);gl.uniform4fv(CL.color,color);gl.uniform1f(CL.fog,fog);gl.uniform3fv(CL.fogColor,fogColor);gl.bindBuffer(gl.ARRAY_BUFFER,cubeBuffer);gl.enableVertexAttribArray(CL.pos);gl.vertexAttribPointer(CL.pos,3,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,36);
  }
  function rotatedOffset(base,off,ry){const c=Math.cos(ry),s=Math.sin(ry);return[base[0]+off[0]*c+off[2]*s,base[1]+off[1],base[2]-off[0]*s+off[2]*c];}
  const shadowDiscVerts=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;shadowDiscVerts.push(0,0,0,Math.cos(a),0,Math.sin(a),Math.cos(b),0,Math.sin(b));}
  const shadowDiscBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,shadowDiscBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(shadowDiscVerts),gl.STATIC_DRAW);
  function drawShadowDisc(VP,pos,rx,rz,alpha,fogColor,cam){const model=M4.multiply(M4.translation(pos[0],pos[1],pos[2]),M4.scale(rx,.012,rz)),mvp=M4.multiply(VP,model),fog=clamp((dist3(pos,cam)-12)/(renderDistance*CHUNK-8),0,1);gl.useProgram(colorProgram);gl.uniformMatrix4fv(CL.mvp,false,mvp);gl.uniform4fv(CL.color,new Float32Array([.012,.016,.018,alpha]));gl.uniform1f(CL.fog,fog);gl.uniform3fv(CL.fogColor,fogColor);gl.bindBuffer(gl.ARRAY_BUFFER,shadowDiscBuffer);gl.enableVertexAttribArray(CL.pos);gl.vertexAttribPointer(CL.pos,3,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,shadowDiscVerts.length/3);}
  function renderContactShadows(VP,fogColor,cam,day){
    const strength=.18+.26*clamp(day,0,1);let drawn=0;
    for(const e of enemies){if(drawn>48)break;const def=enemyDefs[e.type],dx=e.pos[0]-cam[0],dz=e.pos[2]-cam[2],dist=Math.hypot(dx,dz);if(dist>48)continue;const gy=e.pos[1]+.018,base=Math.max(.42,(def.width||.75)*.82);for(const [sc,a] of [[1,.20],[1.35,.085],[1.75,.035]])drawShadowDisc(VP,[e.pos[0],gy,e.pos[2]],base*sc,base*.70*sc,a*strength,fogColor,cam);drawn++;}
    for(const d of droppedItems){if(drawn>72)break;if(Math.hypot(d.pos[0]-cam[0],d.pos[2]-cam[2])>32)continue;const gy=findSurface(Math.floor(d.pos[0]),Math.floor(d.pos[2]))+.014;drawShadowDisc(VP,[d.pos[0],gy,d.pos[2]],.22,.16,.16*strength,fogColor,cam);drawn++;}
  }
  function renderEnemy(e,VP,fogColor,cam){
    const def=enemyDefs[e.type],ry=e.facing??Math.atan2(player.pos[0]-e.pos[0],-(player.pos[2]-e.pos[2])),flash=e.flash>0?[.72,.10,.08,1]:def.color,g=Math.sin(e.gait),g2=Math.sin(e.gait+Math.PI),breath=Math.sin(e.age*2.2)*.035;
    const eyeColor=e.type==='wraith'?[.35,.55,1,1]:e.type==='watcher'||e.type==='crawler'?[1,.04,.025,1]:[.82,.66,.22,1];
    if(['deer','doe','moose','horse'].includes(e.type)){
      const scale=e.type==='moose'?1.22:e.type==='horse'?1.08:e.type==='deer'?1:.86,body=[e.pos[0],e.pos[1]+.78*scale+breath,e.pos[2]],neck=rotatedOffset(e.pos,[0,1.14*scale,-.56*scale],ry),head=rotatedOffset(e.pos,[0,1.48*scale,-.82*scale],ry);
      drawBox(VP,body,[1.02*scale,.62*scale,.48*scale],flash,ry,fogColor,cam);drawBox(VP,neck,[.28*scale,.72*scale,.28*scale],flash,ry,fogColor,cam,-.35);drawBox(VP,head,[.42*scale,.38*scale,.48*scale],flash,ry,fogColor,cam);
      for(const [ox,oz,ph] of [[-.28,-.30,g],[.28,-.30,g2],[-.28,.30,g2],[.28,.30,g]])drawBox(VP,rotatedOffset(e.pos,[ox,.31*scale,oz+ph*.10],ry),[.10*scale,.70*scale,.10*scale],flash,ry,fogColor,cam,ph*.12);
      drawBox(VP,rotatedOffset(head,[-.18*scale,.25*scale,0],ry),[.07,.22,.06],flash,ry,fogColor,cam,0,-.3);drawBox(VP,rotatedOffset(head,[.18*scale,.25*scale,0],ry),[.07,.22,.06],flash,ry,fogColor,cam,0,.3);
      if(e.type==='deer'||e.type==='moose'){for(const side of[-1,1]){const a=rotatedOffset(head,[side*.12,.30,-.02],ry);drawBox(VP,a,[.035,.48,.035],[.29,.21,.14,1],ry,fogColor,cam,0,side*.2);drawBox(VP,rotatedOffset(a,[side*.09,.20,0],ry),[.025,.22,.025],[.29,.21,.14,1],ry,fogColor,cam,0,side*.55);}}
      const ep=rotatedOffset(head,[0,.03,-.25],ry);for(const ex of[-.11,.11])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.035,.035,.02],[.06,.05,.04,1],ry,fogColor,cam);
    }else if(e.type==='cow'||e.type==='sheep'){
      const cs=e.type==='sheep'?.78:1,body=[e.pos[0],e.pos[1]+.66*cs+breath,e.pos[2]];
      drawBox(VP,body,[1.38*cs,.86*cs,.66*cs],flash,ry,fogColor,cam);if(e.type==='sheep')drawBox(VP,[body[0],body[1]+.05,body[2]],[1.48*cs,.93*cs,.72*cs],[.70,.69,.63,1],ry,fogColor,cam);
      const hd=rotatedOffset(e.pos,[0,.75*cs,-.92*cs],ry);drawBox(VP,hd,[.62*cs,.58*cs,.54*cs],e.type==='sheep'?[.28,.25,.22,1]:flash,ry,fogColor,cam);
      for(const [ox,oz,ph] of [[-.42,-.34,g],[.42,-.34,g2],[-.42,.34,g2],[.42,.34,g]])drawBox(VP,rotatedOffset(e.pos,[ox*cs,.25*cs,oz*cs+ph*.06],ry),[.17*cs,.62*cs,.17*cs],e.type==='sheep'?[.24,.22,.20,1]:flash,ry,fogColor,cam,ph*.08);
      for(const side of[-1,1])drawBox(VP,rotatedOffset(hd,[side*.33*cs,.18*cs,-.03],ry),[.07,.20,.06],[.58,.51,.39,1],ry,fogColor,cam,0,side*.55);
      if(e.type==='cow'){const sn=rotatedOffset(hd,[0,-.08,-.34*cs],ry);drawBox(VP,sn,[.35*cs,.20*cs,.22*cs],[.45,.30,.25,1],ry,fogColor,cam);for(const side of[-1,1])drawBox(VP,rotatedOffset(hd,[side*.24*cs,.30*cs,-.04],ry),[.035,.19,.035],[.68,.61,.45,1],ry,fogColor,cam,0,side*.48);}
      const ep=rotatedOffset(hd,[0,.06,-.29*cs],ry);for(const ex of[-.16,.16])drawBox(VP,rotatedOffset(ep,[ex*cs,0,0],ry),[.04,.04,.025],[.04,.035,.03,1],ry,fogColor,cam);
    }else if(e.type==='rabbit'){
      drawBox(VP,[e.pos[0],e.pos[1]+.25+Math.abs(g)*.05,e.pos[2]],[.50,.40,.55],flash,ry,fogColor,cam);const hd=rotatedOffset(e.pos,[0,.43,-.34],ry);drawBox(VP,hd,[.38,.34,.36],flash,ry,fogColor,cam);for(const side of[-1,1])drawBox(VP,rotatedOffset(hd,[side*.11,.26,.04],ry),[.08,.42,.09],flash,ry,fogColor,cam,0,side*.08);drawBox(VP,rotatedOffset(e.pos,[0,.34,.38],ry),[.18,.18,.18],[.68,.66,.60,1],ry,fogColor,cam);const ep=rotatedOffset(hd,[0,.03,-.20],ry);for(const ex of[-.10,.10])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.035,.035,.02],[.05,.04,.035,1],ry,fogColor,cam);
    }else if(e.type==='chicken'){
      const body=[e.pos[0],e.pos[1]+.32+Math.abs(g)*.03,e.pos[2]];drawBox(VP,body,[.45,.50,.40],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(body,[-.28,.02,.02],ry),[.18,.34,.31],[flash[0]*.92,flash[1]*.92,flash[2]*.90,1],ry,fogColor,cam,0,-.25+g*.08);drawBox(VP,rotatedOffset(body,[.28,.02,.02],ry),[.18,.34,.31],[flash[0]*.92,flash[1]*.92,flash[2]*.90,1],ry,fogColor,cam,0,.25-g*.08);const hd=rotatedOffset(e.pos,[0,.65,-.22],ry);drawBox(VP,hd,[.28,.28,.28],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(hd,[0,-.02,-.20],ry),[.10,.08,.20],[.73,.46,.18,1],ry,fogColor,cam);drawBox(VP,rotatedOffset(hd,[0,.18,.02],ry),[.10,.14,.08],[.65,.10,.08,1],ry,fogColor,cam);for(const side of[-1,1])drawBox(VP,rotatedOffset(e.pos,[side*.12,.08,.03],ry),[.035,.22,.035],[.58,.40,.15,1],ry,fogColor,cam,g*side*.08);const ep=rotatedOffset(hd,[0,.04,-.15],ry);for(const ex of[-.08,.08])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.025,.025,.018],[.03,.03,.025,1],ry,fogColor,cam);
    }else if(e.type==='wolf'||e.type==='fox'||e.type==='hyena'){
      const ws=e.type==='fox'?.72:e.type==='hyena'?.92:1;
      drawBox(VP,[e.pos[0],e.pos[1]+.53*ws+breath,e.pos[2]],[1.22*ws,.68*ws,.52*ws],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,.65*ws,-.72*ws],ry),[.60*ws,.57*ws,.54*ws],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,.54*ws,-1.04*ws],ry),[.38*ws,.28*ws,.48*ws],[flash[0]*.82,flash[1]*.82,flash[2]*.82,1],ry,fogColor,cam);
      for(const [ox,oz,phase] of [[-.38,-.34,g],[.38,-.34,g2],[-.38,.36,g2],[.38,.36,g]]){const swing=phase*.12;drawBox(VP,rotatedOffset(e.pos,[ox,.22+Math.abs(phase)*.03,oz+swing],ry),[.17,.58,.17],flash,ry,fogColor,cam,phase*.09);}
      drawBox(VP,rotatedOffset(e.pos,[-.24,.91,-.73],ry),[.16,.34,.12],flash,ry,fogColor,cam,0,-.28);drawBox(VP,rotatedOffset(e.pos,[.24,.91,-.73],ry),[.16,.34,.12],flash,ry,fogColor,cam,0,.28);drawBox(VP,rotatedOffset(e.pos,[0,.65,.78],ry),[.14,.14,.72],flash,ry,fogColor,cam,.34+g*.12);
      const ep=rotatedOffset(e.pos,[0,.73,-1.02],ry);for(const ex of[-.13,.13])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.055,.055,.028],eyeColor,ry,fogColor,cam);
    }else if(e.type==='boar'){
      drawBox(VP,[e.pos[0],e.pos[1]+.52+breath,e.pos[2]],[1.48,.83,.78],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,.55,-.91],ry),[.78,.70,.62],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,.43,-1.27],ry),[.56,.34,.48],[flash[0]*.88,flash[1]*.8,flash[2]*.72,1],ry,fogColor,cam);
      for(const [ox,oz,ph] of [[-.46,-.32,g],[.46,-.32,g2],[-.46,.35,g2],[.46,.35,g]])drawBox(VP,rotatedOffset(e.pos,[ox,.18,oz+ph*.08],ry),[.20,.52,.20],flash,ry,fogColor,cam,ph*.07);
      drawBox(VP,rotatedOffset(e.pos,[-.38,.38,-1.48],ry),[.085,.08,.42],[.73,.68,.53,1],ry,fogColor,cam,0,-.12);drawBox(VP,rotatedOffset(e.pos,[.38,.38,-1.48],ry),[.085,.08,.42],[.73,.68,.53,1],ry,fogColor,cam,0,.12);
      const ep=rotatedOffset(e.pos,[0,.68,-1.18],ry);for(const ex of[-.17,.17])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.05,.05,.025],eyeColor,ry,fogColor,cam);
    }else if(e.type==='bear'){
      drawBox(VP,[e.pos[0],e.pos[1]+.72+breath,e.pos[2]],[1.55,1.22,.96],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,1.08,-.83],ry),[.88,.82,.76],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[0,.91,-1.32],ry),[.60,.45,.55],[flash[0]*.8,flash[1]*.8,flash[2]*.78,1],ry,fogColor,cam);
      for(const [ox,oz,ph] of [[-.54,-.3,g],[.54,-.3,g2],[-.54,.4,g2],[.54,.4,g]])drawBox(VP,rotatedOffset(e.pos,[ox,.28,oz+ph*.08],ry),[.30,.72,.31],flash,ry,fogColor,cam,ph*.05);
      drawBox(VP,rotatedOffset(e.pos,[-.31,1.49,-.78],ry),[.24,.25,.18],flash,ry,fogColor,cam);drawBox(VP,rotatedOffset(e.pos,[.31,1.49,-.78],ry),[.24,.25,.18],flash,ry,fogColor,cam);const ep=rotatedOffset(e.pos,[0,1.18,-1.19],ry);for(const ex of[-.19,.19])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.06,.06,.03],eyeColor,ry,fogColor,cam);
    }else if(e.type==='crawler'){
      const body=[e.pos[0],e.pos[1]+.53+Math.abs(g)*.06,e.pos[2]];drawBox(VP,body,[.72,.43,1.08],flash,ry,fogColor,cam,.12+g*.08);drawBox(VP,rotatedOffset(e.pos,[0,.61,-.73],ry),[.55,.42,.48],flash,ry,fogColor,cam,.28);
      for(const [ox,oz,ph,rz] of [[-.43,-.25,g,-.42],[.43,-.25,g2,.42],[-.45,.39,g2,-.48],[.45,.39,g,.48]]){drawBox(VP,rotatedOffset(e.pos,[ox,.27,oz+ph*.16],ry),[.15,.83,.14],flash,ry,fogColor,cam,ph*.32,rz);drawBox(VP,rotatedOffset(e.pos,[ox*1.25,.08,oz+ph*.28],ry),[.13,.58,.13],flash,ry,fogColor,cam,-ph*.25,rz*.7);}
      const ep=rotatedOffset(e.pos,[0,.69,-1.02],ry);for(const ex of[-.13,.13])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.075,.055,.03],eyeColor,ry,fogColor,cam);
    }else if(e.type==='watcher'){
      drawBox(VP,[e.pos[0],e.pos[1]+1.48+breath,e.pos[2]],[.43,2.05,.34],flash,ry,fogColor,cam);drawBox(VP,[e.pos[0],e.pos[1]+2.71+breath,e.pos[2]],[.55,.68,.49],[flash[0]*.92,flash[1]*.94,flash[2]*.92,1],ry,fogColor,cam);
      drawBox(VP,rotatedOffset(e.pos,[-.42,1.42,.02],ry),[.14,1.92,.14],flash,ry,fogColor,cam,g*.12,-.05);drawBox(VP,rotatedOffset(e.pos,[.42,1.42,.02],ry),[.14,1.92,.14],flash,ry,fogColor,cam,g2*.12,.05);drawBox(VP,rotatedOffset(e.pos,[-.17,.52,.02],ry),[.16,1.03,.16],flash,ry,fogColor,cam,g*.15);drawBox(VP,rotatedOffset(e.pos,[.17,.52,.02],ry),[.16,1.03,.16],flash,ry,fogColor,cam,g2*.15);
      const ep=rotatedOffset(e.pos,[0,2.78,-.26],ry);for(const ex of[-.14,.14])drawBox(VP,rotatedOffset(ep,[ex,0,0],ry),[.072,.055,.025],eyeColor,ry,fogColor,cam);
    }else{
      const floatY=.25+Math.sin(e.age*3.2)*.18;drawBox(VP,[e.pos[0],e.pos[1]+1.25+floatY,e.pos[2]],[.46,1.58,.34],flash,ry,fogColor,cam,Math.sin(e.age*1.4)*.08);drawBox(VP,[e.pos[0],e.pos[1]+2.18+floatY,e.pos[2]],[.53,.62,.48],flash,ry,fogColor,cam);for(const side of[-1,1])drawBox(VP,rotatedOffset(e.pos,[side*.43,1.28+floatY,0],ry),[.12,1.55,.12],flash,ry,fogColor,cam,side*.28+Math.sin(e.age*2)*.12,side*.15);const ep=rotatedOffset(e.pos,[0,2.23+floatY,-.25],ry);drawBox(VP,ep,[.19,.065,.025],eyeColor,ry,fogColor,cam);
    }
  }
  function renderParticles(VP){if(!particles.length)return;const ps=[],cs=[],ss=[];for(const p of particles){const alpha=clamp(p.life/p.maxLife,0,1);ps.push(...p.pos);cs.push(p.color[0],p.color[1],p.color[2],p.color[3]*Math.min(1,alpha*2.2));ss.push(p.size);}if(!ps.length)return;gl.useProgram(particleProgram);gl.uniformMatrix4fv(PL.vp,false,VP);gl.bindBuffer(gl.ARRAY_BUFFER,particlePosBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ps),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(PL.pos);gl.vertexAttribPointer(PL.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,particleColorBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cs),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(PL.color);gl.vertexAttribPointer(PL.color,4,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,particleSizeBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ss),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(PL.size);gl.vertexAttribPointer(PL.size,1,gl.FLOAT,false,0,0);gl.drawArrays(gl.POINTS,0,ps.length/3);}
  function renderTargetOutline(VP,fogColor,cam){
    if(!currentTarget||currentTarget.id===B.WATER||blockDefs[currentTarget.id]?.decor)return;const f=constructionStateAt(currentTarget.x,currentTarget.y,currentTarget.z),structuralDamage=f?clamp(1-f.hp/Math.max(1,f.maxHp),0,1):0,damage=Math.max(clamp(mineAmount,0,1),structuralDamage),model=M4.multiply(M4.translation(currentTarget.x-.003,currentTarget.y-.003,currentTarget.z-.003),M4.scale(1.006,1.006,1.006)),mvp=M4.multiply(VP,model);gl.useProgram(colorProgram);gl.uniformMatrix4fv(CL.mvp,false,mvp);gl.uniform1f(CL.fog,0);gl.uniform3fv(CL.fogColor,fogColor);
    gl.bindBuffer(gl.ARRAY_BUFFER,outlineBuffer);gl.enableVertexAttribArray(CL.pos);gl.vertexAttribPointer(CL.pos,3,gl.FLOAT,false,0,0);gl.uniform4fv(CL.color,new Float32Array([.65,.70,.66,.18+.18*damage]));gl.drawArrays(gl.LINES,0,outlineVerts.length/3);
    if((input.mouseLeft||structuralDamage>.002)&&damage>.001){const visual=Math.max(.16,Math.pow(clamp(damage,0,1),.62));gl.bindBuffer(gl.ARRAY_BUFFER,crackBuffer);gl.vertexAttribPointer(CL.pos,3,gl.FLOAT,false,0,0);gl.uniform4fv(CL.color,new Float32Array([.012,.008,.006,.82+.17*visual]));const count=Math.max(18,Math.floor((crackVerts.length/3)*visual));gl.drawArrays(gl.TRIANGLES,0,count-count%6);}
  }
  function renderHeldItem(VP,fogColor,cam){
    const id=selectedItem(),def=itemDefs[id];if(!def||countItem(id)<=0)return;const dir=lookDir(),right=[Math.cos(player.yaw),0,Math.sin(player.yaw)],swing=Math.sin(clamp(player.toolSwing,0,1)*Math.PI),bob=Math.sin(player.movePhase)*.025;const base=[cam[0]+dir[0]*.78+right[0]*(.41+player.sway*.16),cam[1]-.47+bob-swing*.065,cam[2]+dir[2]*.78+right[2]*(.41+player.sway*.16)],ry=player.yaw+.08+swing*.25*player.toolSwingSide,rx=-.18-player.pitch*.32+swing*.55;
    const fore=[base[0]-right[0]*.10,base[1]-.24,base[2]-right[2]*.10];drawBox(VP,fore,[.085,.30,.085],[.16,.105,.072,1],ry,fogColor,cam,rx-.22,.12);drawBox(VP,[base[0],base[1]-.035,base[2]],[.115,.115,.115],[.27,.18,.12,1],ry,fogColor,cam,rx,.12);
    if(id==='torch'){
      drawBox(VP,base,[.032,.36,.032],[.24,.145,.07,1],ry,fogColor,cam,rx,.12);const top=[base[0]+dir[0]*.02,base[1]+.22,base[2]+dir[2]*.02];drawBox(VP,top,[.062,.075,.062],[.66,.24,.045,1],ry,fogColor,cam);drawBox(VP,[top[0],top[1]+.055,top[2]],[.038,.055,.038],[1,.66,.13,.92],ry,fogColor,cam);
    }else if(def.tool){
      const wooden=def.tier==='wood',golden=def.tier==='gold',metal=wooden?[.47,.31,.18,1]:golden?[.78,.58,.15,1]:[.39,.42,.41,1],handle=wooden?[.34,.22,.13,1]:[.31,.22,.14,1];drawBox(VP,base,[.034,.40,.034],handle,ry,fogColor,cam,rx,.22);const head=[base[0]+dir[0]*.04,base[1]+.27,base[2]+dir[2]*.04];if(def.tool==='pickaxe'){drawBox(VP,head,[.42,.085,.08],metal,ry,fogColor,cam,rx,.2);drawBox(VP,rotatedOffset(head,[-.22,0,0],ry),[.10,.15,.07],metal,ry,fogColor,cam,rx,.2);}else if(def.tool==='axe'){drawBox(VP,head,[.30,.28,.075],metal,ry,fogColor,cam,rx,.2);drawBox(VP,rotatedOffset(head,[.18,.03,0],ry),[.17,.36,.055],metal,ry,fogColor,cam,rx,.2);}else if(def.tool==='shovel'){drawBox(VP,[head[0],head[1]+.03,head[2]],[.22,.29,.07],metal,ry,fogColor,cam,rx,.12);}else{drawBox(VP,[head[0],head[1]+.08,head[2]],[.075,.62,.055],metal,ry,fogColor,cam,rx,.12);drawBox(VP,rotatedOffset(base,[0,.20,0],ry),[.23,.055,.055],handle,ry,fogColor,cam,rx,.1);}
    }else if(def.place){drawHeldTexturedBlock(VP,base,[.30,.30,.30],def.place,ry,rx,.12);}else if(id==='berries'){for(const [ox,oy] of [[-.06,.03],[.04,.07],[.08,-.02],[-.02,-.05]])drawBox(VP,rotatedOffset(base,[ox,oy,0],ry),[.055,.055,.055],[.20,.10,.28,1],ry,fogColor,cam,rx,.12);drawBox(VP,rotatedOffset(base,[0,.10,0],ry),[.025,.08,.025],[.18,.30,.16,1],ry,fogColor,cam,rx,.12);}else if(id==='rawmeat'||id==='cookedmeat'){drawBox(VP,base,[.18,.11,.24],id==='rawmeat'?[.42,.14,.14,1]:[.36,.22,.12,1],ry,fogColor,cam,rx,.12);drawBox(VP,rotatedOffset(base,[.09,.01,0],ry),[.055,.06,.16],[.70,.60,.48,1],ry,fogColor,cam,rx,.12);}else if(id==='bandage'){drawBox(VP,base,[.20,.09,.12],[.72,.72,.66,1],ry,fogColor,cam,rx,.12);drawBox(VP,base,[.08,.10,.13],[.30,.12,.12,1],ry,fogColor,cam,rx,.12);}else if(['coal','iron','gold_ore','iron_ingot','gold_ingot'].includes(id)){const c=id==='coal'?[.08,.085,.08,1]:id==='iron'?[.44,.30,.23,1]:id==='gold_ore'?[.50,.39,.16,1]:id==='iron_ingot'?[.58,.62,.60,1]:[.76,.61,.18,1];drawBox(VP,base,[.13,.12,.15],c,ry,fogColor,cam,rx,.12);drawBox(VP,rotatedOffset(base,[.06,.05,-.03],ry),[.045,.035,.05],[Math.min(1,c[0]*1.35),Math.min(1,c[1]*1.35),Math.min(1,c[2]*1.35),1],ry,fogColor,cam,rx,.12);}else{drawBox(VP,base,[.11,.11,.11],[.32,.33,.31,1],ry,fogColor,cam,rx,.12);}
  }

  function renderOffhandItem(VP,fogColor,cam){
    const id=offhandItem();if(!id)return;const def=itemDefs[id],dir=lookDir(),right=[Math.cos(player.yaw),0,Math.sin(player.yaw)],bob=Math.sin(player.movePhase)*.018,base=[cam[0]+dir[0]*.68-right[0]*.42,cam[1]-.42+bob,cam[2]+dir[2]*.68-right[2]*.42],ry=player.yaw-.08,rx=-.12-player.pitch*.22;
    drawBox(VP,[base[0]+right[0]*.08,base[1]-.23,base[2]+right[2]*.08],[.08,.28,.08],[.16,.105,.072,1],ry,fogColor,cam,rx+.18,-.1);
    if(id==='torch'){drawBox(VP,base,[.03,.34,.03],[.24,.145,.07,1],ry,fogColor,cam,rx,-.1);const top=[base[0],base[1]+.22,base[2]];drawBox(VP,top,[.06,.07,.06],[.72,.27,.05,1],ry,fogColor,cam);drawBox(VP,[top[0],top[1]+.06,top[2]],[.035,.06,.035],[1,.72,.18,.96],ry,fogColor,cam);}
    else if(def?.tool){const wooden=def.tier==='wood',golden=def.tier==='gold',headCol=wooden?[.47,.31,.18,1]:golden?[.78,.58,.15,1]:[.40,.43,.42,1],handle=wooden?[.35,.23,.14,1]:[.31,.22,.14,1];drawBox(VP,base,[.03,.32,.03],handle,ry,fogColor,cam,rx,-.14);const h=rotatedOffset(base,[0,.23,0],ry);if(def.tool==='pickaxe')drawBox(VP,h,[.31,.07,.07],headCol,ry,fogColor,cam,rx,-.14);else if(def.tool==='axe')drawBox(VP,h,[.22,.23,.07],headCol,ry,fogColor,cam,rx,-.14);else if(def.tool==='shovel')drawBox(VP,h,[.16,.22,.065],headCol,ry,fogColor,cam,rx,-.14);else drawBox(VP,h,[.065,.48,.05],headCol,ry,fogColor,cam,rx,-.14);}
    else if(def?.place){drawHeldTexturedBlock(VP,base,[.27,.27,.27],def.place,ry,rx,-.1);}
    else if(id==='rawmeat'||id==='cookedmeat')drawBox(VP,base,[.15,.09,.20],id==='rawmeat'?[.42,.14,.14,1]:[.36,.22,.12,1],ry,fogColor,cam,rx,-.1);
    else if(id==='berries'){for(const ox of[-.05,.03,.08])drawBox(VP,rotatedOffset(base,[ox,Math.abs(ox)*.45,0],ry),[.05,.05,.05],[.20,.10,.28,1],ry,fogColor,cam,rx,-.1);}
    else if(id==='bandage')drawBox(VP,base,[.18,.08,.11],[.72,.72,.66,1],ry,fogColor,cam,rx,-.1);
    else drawBox(VP,base,[.11,.11,.11],[.34,.31,.27,1],ry,fogColor,cam,rx,-.1);
  }
  function renderPlacedTorches(VP,fogColor,cam){let n=0;for(const[k,v]of edits){if(v!==B.TORCH)continue;const[x,y,z]=k.split(',').map(Number);if(Math.hypot(x+.5-player.pos[0],z+.5-player.pos[2])>Math.min(46,renderDistance*CHUNK))continue;const flick=.85+.15*Math.sin(performance.now()*.017+x*2.1+z);drawBox(VP,[x+.5,y+.28,z+.5],[.055,.52,.055],[.30,.19,.09,1],0,fogColor,cam,0,.04);drawBox(VP,[x+.5,y+.62,z+.5],[.095,.12,.095],[.72*flick,.25,.04,1],0,fogColor,cam);drawBox(VP,[x+.5,y+.73,z+.5],[.055,.13,.055],[1,.66*flick,.12,.90],0,fogColor,cam);if(++n>80)break;}}
  function droppedItemColor(id){if(id==='coal')return[.08,.085,.08,1];if(id==='iron'||id==='iron_ingot')return[.53,.47,.42,1];if(id==='gold_ore'||id==='gold_ingot')return[.72,.55,.16,1];if(id==='berries')return[.23,.08,.28,1];if(id==='rawmeat')return[.44,.13,.13,1];if(id==='cookedmeat')return[.38,.23,.12,1];if(id==='bandage')return[.74,.73,.66,1];return[.34,.31,.27,1];}
  function renderDroppedItems(VP,fogColor,cam){
    let shown=0;for(const d of droppedItems){if(dist3(d.pos,player.pos)>Math.min(42,renderDistance*CHUNK))continue;const bob=Math.sin(d.age*3.6+d.bob)*.055,pos=[d.pos[0],d.pos[1]+bob,d.pos[2]],def=itemDefs[d.id]||{},ry=d.spin;
      if(def.place&&def.place!==B.TORCH)drawHeldTexturedBlock(VP,pos,[.23,.23,.23],def.place,ry,.10,0);
      else if(def.place===B.TORCH){drawBox(VP,pos,[.032,.22,.032],[.29,.18,.09,1],ry,fogColor,cam,.12,.06);drawBox(VP,[pos[0],pos[1]+.15,pos[2]],[.075,.075,.075],[.94,.48,.12,1],ry,fogColor,cam);}
      else if(def.tool){const wood=def.tier==='wood',gold=def.tier==='gold',head=wood?[.47,.31,.18,1]:gold?[.78,.58,.15,1]:[.42,.45,.44,1],handle=[.31,.21,.13,1];drawBox(VP,pos,[.025,.27,.025],handle,ry,fogColor,cam,.35,.15);const h=rotatedOffset(pos,[0,.18,0],ry);if(def.tool==='pickaxe')drawBox(VP,h,[.24,.055,.055],head,ry,fogColor,cam,.35,.15);else if(def.tool==='axe')drawBox(VP,h,[.17,.17,.055],head,ry,fogColor,cam,.35,.15);else if(def.tool==='shovel')drawBox(VP,h,[.13,.17,.05],head,ry,fogColor,cam,.35,.15);else drawBox(VP,h,[.045,.35,.04],head,ry,fogColor,cam,.35,.15);}
      else drawBox(VP,pos,[.10,.10,.10],droppedItemColor(d.id),ry,fogColor,cam,.12,.08);
      if(++shown>110)break;
    }
  }
  let torchCacheTimer=0,cachedTorch=null;
  function nearestPlacedTorch(){let best=null,bd=999;for(const[k,v]of edits){if(v!==B.TORCH)continue;const[x,y,z]=k.split(',').map(Number),d=Math.hypot(x+.5-player.pos[0],y+.5-(player.pos[1]+1),z+.5-player.pos[2]);if(d<bd&&d<Math.min(14,renderDistance*CHUNK)){bd=d;best=[x+.5,y+.6,z+.5];}}return best;}
  function renderCloudLayer(VP,fogColor,cam,day){
    const drift=worldSeconds*.34,cell=28,baseX=Math.floor((player.pos[0]+drift)/cell),baseZ=Math.floor(player.pos[2]/cell),night=1-day;
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
      const gx=baseX+dx,gz=baseZ+dz,r=hash2i(gx,gz,worldSeed^0xc10d);if(r<.61)continue;
      const cx=gx*cell-drift+(hash2i(gx,gz,0x811)-.5)*12,cz=gz*cell+(hash2i(gx,gz,0x912)-.5)*12,cy=76+hash2i(gx,gz,0xa13)*8;
      const shade=.72-day*.05-night*.36,alpha=.84;
      const col=[shade*.92,shade*.98,shade,alpha],w=6+hash2i(gx,gz,0x414)*7,d=3.2+hash2i(gx,gz,0x515)*5;
      drawBox(VP,[cx,cy,cz],[w,.65,d],col,0,fogColor,cam);
      if(r>.81)drawBox(VP,[cx+w*.42,cy+.38,cz-d*.08],[w*.58,.82,d*.72],[col[0]*.96,col[1]*.98,col[2],alpha],0,fogColor,cam);
      if(r>.91)drawBox(VP,[cx-w*.38,cy+.24,cz+d*.18],[w*.44,.58,d*.55],[col[0]*.93,col[1]*.96,col[2]*.98,alpha],0,fogColor,cam);
    }
  }

  function renderConstructions(VP,fogColor,cam){
    let n=0;
    for(const[k,id]of edits){
      if(id!==B.WOOD_DOOR&&id!==B.WOOD_STAIRS&&id!==B.WOOD_FENCE)continue;
      const[x,y,z]=k.split(',').map(Number);if(Math.hypot(x+.5-player.pos[0],z+.5-player.pos[2])>renderDistance*CHUNK+6)continue;
      const f=ensureFortification(x,y,z,id,true),col=constructionColor(f),ry=(f.orientation||0)+(id===B.WOOD_DOOR&&f.open?Math.PI/2:0);
      if(id===B.WOOD_DOOR){
        drawBox(VP,[x+.5,y+.93,z+.5],[.82,1.86,.11],col,ry,fogColor,cam);
        drawBox(VP,rotatedOffset([x+.5,y+.93,z+.5],[.31,.03,-.075],ry),[.08,.08,.07],[.66,.52,.24,1],ry,fogColor,cam);
        if(f.tier>=1){const band=f.tier===5?[.58,.61,.59,1]:f.tier>=4?[.46,.47,.44,1]:f.tier>=2?[.34,.35,.33,1]:[.49,.33,.18,1];for(const oy of[-.48,.16,.53])drawBox(VP,rotatedOffset([x+.5,y+.93,z+.5],[0,oy,-.071],ry),[.72,.065,.035],band,ry,fogColor,cam);}
      }else if(id===B.WOOD_STAIRS){
        drawBox(VP,rotatedOffset([x+.5,y+.25,z+.5],[0,0,.20],ry),[.96,.50,.56],col,ry,fogColor,cam);
        drawBox(VP,rotatedOffset([x+.5,y+.65,z+.5],[0,0,-.22],ry),[.96,.30,.48],col,ry,fogColor,cam);
        if(f.tier>=1){const band=f.tier===5?[.58,.61,.59,1]:f.tier>=2?[.37,.38,.36,1]:[.50,.34,.18,1];drawBox(VP,rotatedOffset([x+.5,y+.51,z+.5],[0,0,.18],ry),[.90,.055,.54],band,ry,fogColor,cam);}
      }else{
        drawBox(VP,[x+.5,y+.5,z+.5],[.16,1.05,.16],col,ry,fogColor,cam);
        drawBox(VP,[x+.5,y+.68,z+.5],[1.02,.13,.14],col,ry,fogColor,cam);
        drawBox(VP,[x+.5,y+.34,z+.5],[1.02,.11,.12],col,ry,fogColor,cam);
        if(f.tier>=1){const band=f.tier===5?[.58,.61,.59,1]:f.tier>=2?[.37,.38,.36,1]:[.50,.34,.18,1];drawBox(VP,[x+.5,y+.51,z+.5],[1.04,.055,.17],band,ry,fogColor,cam);}
      }
      if(++n>180)break;
    }
    // Regular wooden walls/logs stay in the chunk mesh, but upgraded pieces get
    // visible reinforcement bands/corner plates so every tier is readable.
    let overlays=0;
    for(const[k,f]of fortifications){
      if(f.tier<1)continue;const[x,y,z]=k.split(',').map(Number),id=getBlock(x,y,z);if(id===B.WOOD_DOOR||id===B.WOOD_STAIRS||id===B.WOOD_FENCE||!isUpgradeableBlockId(id))continue;if(Math.hypot(x+.5-player.pos[0],z+.5-player.pos[2])>Math.min(48,renderDistance*CHUNK+4))continue;
      const band=f.tier===5?[.58,.61,.59,1]:f.tier===4?[.43,.44,.41,1]:f.tier>=2?[.34,.35,.33,1]:[.49,.33,.18,1],c=.048;
      drawBox(VP,[x+.5,y+.12,z+.018],[.92,.07,c],band,0,fogColor,cam);drawBox(VP,[x+.5,y+.88,z+.018],[.92,.07,c],band,0,fogColor,cam);
      drawBox(VP,[x+.018,y+.5,z+.5],[c,.78,.92],band,0,fogColor,cam);drawBox(VP,[x+.982,y+.5,z+.5],[c,.78,.92],band,0,fogColor,cam);
      if(f.tier>=3){drawBox(VP,[x+.5,y+.50,z+.982],[.90,.055,c],band,0,fogColor,cam);drawBox(VP,[x+.5,y+.982,z+.5],[.90,c,.90],band,0,fogColor,cam);}
      if(++overlays>120)break;
    }
    // A burning furnace gets a small emissive-looking mouth, while smoke is
    // emitted by updateFurnaces().
    let lit=0;for(const[k,f]of furnaces){if(f.burn<=0)continue;const[x,y,z]=k.split(',').map(Number);if(Math.hypot(x+.5-player.pos[0],z+.5-player.pos[2])>40)continue;const flick=.80+.20*Math.sin(performance.now()*.02+x*3+z);drawBox(VP,[x+.5,y+.43,z+.992],[.38,.24,.026],[.78*flick,.27,.045,1],0,fogColor,cam);drawBox(VP,[x+.5,y+.43,z+1.008],[.20,.11,.018],[1,.58*flick,.10,.92],0,fogColor,cam);if(++lit>24)break;}
  }


  function render(){
    resize();gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthFunc(gl.LEQUAL);
    const day=sunLevel(),night=1-day,lf=lightning*.62,biome=biomeAt(Math.floor(player.pos[0]),Math.floor(player.pos[2]));let sky=[lerp(.005,.22,day)+lf,lerp(.008,.29,day)+lf,lerp(.010,.33,day)+lf];if(biome==='swamp'){sky[0]*=.78;sky[1]*=.9;}if(weatherMode==='rain'||weatherMode==='mist')sky=sky.map(v=>v*.78);if(player.inWater)sky=[.018,.092,.105];let fogColor=player.inWater?[.018,.102,.112]:[sky[0]*.67,sky[1]*.71,sky[2]*.69];gl.clearColor(sky[0],sky[1],sky[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!running)return;
    const cam=cameraEyePos(),dir=lookDir(),target=[cam[0]+dir[0],cam[1]+dir[1],cam[2]+dir[2]],speed=Math.hypot(player.vel[0],player.vel[2]),fov=Math.PI/3+clamp((speed-5)*.014,0,.07),proj=M4.perspective(fov,canvas.width/canvas.height,.055,renderDistance*CHUNK+35),view=M4.lookAt(cam,target),VP=M4.multiply(proj,view);lastVP=VP;let fogNear=Math.max(7,renderDistance*CHUNK*(weatherMode==='mist'?.21:.34)),fogFar=renderDistance*CHUNK*(weatherMode==='mist'?.72:.95);if(player.inWater){fogNear=1.5;fogFar=20;}
    torchCacheTimer-=1/60;if(torchCacheTimer<=0){cachedTorch=nearestPlacedTorch();torchCacheTimer=.2;}const heldTorch=hasHeldTorch();let torchPos=cachedTorch||cam,torchPower=cachedTorch?1.08:0;if(heldTorch){torchPos=[cam[0]+dir[0]*.35,cam[1]-.18,cam[2]+dir[2]*.35];torchPower=1.45;}
    gl.disable(gl.BLEND);renderCloudLayer(VP,fogColor,cam,day);for(const c of chunks.values())drawVoxelMesh(c.opaque,1,VP,cam,fogColor,fogNear,fogFar,clamp(day+lightning,0,1),torchPos,torchPower,0);renderPlacedTorches(VP,fogColor,cam);renderConstructions(VP,fogColor,cam);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);renderContactShadows(VP,fogColor,cam,day);gl.depthMask(true);gl.disable(gl.BLEND);renderDroppedItems(VP,fogColor,cam);for(const e of enemies)renderEnemy(e,VP,fogColor,cam);for(const b of birds)renderBird(b,VP,fogColor,cam);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);for(const c of chunks.values())drawVoxelMesh(c.water,.68,VP,cam,fogColor,fogNear,fogFar,clamp(day+lightning,0,1),torchPos,torchPower,1);renderParticles(VP);renderTargetOutline(VP,fogColor,cam);gl.depthMask(true);gl.disable(gl.BLEND);
    gl.clear(gl.DEPTH_BUFFER_BIT);renderHeldItem(VP,fogColor,cam);renderOffhandItem(VP,fogColor,cam);
  }

  // ---------------------------------------------------------------------------
  // Circular terrain minimap — coarse sampling, throttled so it does not hurt FPS.
  // ---------------------------------------------------------------------------
  let minimapTimer=0;
  const biomeMapColor={beach:'#9a8d68',wet_shore:'#596d50',riverlands:'#4d725d',frozen_shore:'#aeb9b3',willow_swamp:'#344b35',swamp:'#30452f',marsh:'#415844',tundra:'#778078',snow_peaks:'#c6cbc7',alpine:'#828883',taiga:'#314b39',spruce_valley:'#284235',cold_plains:'#687462',red_barrens:'#7d4b35',chaparral:'#6f6647',mist_forest:'#294032',old_growth:'#203429',darkwood:'#1d3026',forest:'#315237',poplar_grove:'#486343',birch:'#4f6847',flower_meadow:'#64835a',meadow:'#607b53',autumn:'#665235',barren:'#605b4c',pine_barrens:'#4d5b43',plains:'#5e7650',mountain_forest:'#354c3b',highlands:'#5e655b',rocky:'#66645f'};
  function updateMinimap(dt){
    if(!UI.minimap||!running)return;minimapTimer-=dt;if(minimapTimer>0)return;minimapTimer=.28;
    const c=UI.minimap,ctx=c.getContext('2d'),W=c.width,H=c.height,steps=29,radius=58,cell=W/steps;ctx.clearRect(0,0,W,H);ctx.save();ctx.beginPath();ctx.arc(W/2,H/2,W/2-2,0,Math.PI*2);ctx.clip();
    for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const dx=(i-(steps-1)/2)/(steps-1)*radius*2,dz=(j-(steps-1)/2)/(steps-1)*radius*2,wx=Math.floor(player.pos[0]+dx),wz=Math.floor(player.pos[2]+dz),h=terrainHeight(wx,wz),b=biomeAt(wx,wz,h);let col=biomeMapColor[b]||'#526a4a';if(h<=SEA)col='#244d58';ctx.fillStyle=col;ctx.fillRect(i*cell,j*cell,Math.ceil(cell)+1,Math.ceil(cell)+1);if(h>SEA+22){ctx.fillStyle='rgba(225,232,226,.12)';ctx.fillRect(i*cell,j*cell,Math.ceil(cell)+1,Math.ceil(cell)+1);}}
    // chest + nearby hostile markers
    if(starterChestPos){const dx=(starterChestPos[0]+.5-player.pos[0])/radius*(W/2),dz=(starterChestPos[2]+.5-player.pos[2])/radius*(H/2);if(Math.hypot(dx,dz)<W*.48){ctx.fillStyle='#d4ae58';ctx.fillRect(W/2+dx-2,H/2+dz-2,4,4);}}
    for(const e of enemies){const def=enemyDefs[e.type];if(def.passive)continue;const dx=(e.pos[0]-player.pos[0])/radius*(W/2),dz=(e.pos[2]-player.pos[2])/radius*(H/2);if(Math.hypot(dx,dz)<W*.47){ctx.fillStyle='#9d302d';ctx.beginPath();ctx.arc(W/2+dx,H/2+dz,1.8,0,Math.PI*2);ctx.fill();}}
    ctx.restore();ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-player.yaw);ctx.fillStyle='#edf1e9';ctx.strokeStyle='#0b0d0b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(6,8);ctx.lineTo(0,5);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(225,236,227,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,W/2-2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(235,240,234,.86)';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('N',W/2,12);if(UI.minimapBiome)UI.minimapBiome.textContent=biomeAt(Math.floor(player.pos[0]),Math.floor(player.pos[2])).replaceAll('_',' ');
  }

  // ---------------------------------------------------------------------------
  // HUD and loop
  // ---------------------------------------------------------------------------
  let fps=0,fpsAcc=0,fpsFrames=0,lastTime=performance.now();
  function renderHearts(){
    if(!UI.heartHud)return;
    const hearts=10, hp=clamp(player.health,0,100);
    UI.heartHud.innerHTML='';
    for(let i=0;i<hearts;i++){
      const span=document.createElement('span');
      const value=clamp(hp-i*10,0,10);
      span.className='heart '+(value>=7?'full':value>0?'half':'empty');
      span.textContent=value>=7?'♥':value>0?'◐':'♡';
      span.title=`HP ${Math.ceil(hp)}/100`;
      UI.heartHud.appendChild(span);
    }
  }
  function updateHUD(dt){
    if(!running)return;
    const ph=(worldSeconds%DAY_SECONDS)/DAY_SECONDS,hours=ph*24,hh=Math.floor(hours)%24,mm=Math.floor((hours-hh)*60),dayNo=Math.floor(worldSeconds/DAY_SECONDS)+1,night=nightLevel();
    const biome=biomeAt(Math.floor(player.pos[0]),Math.floor(player.pos[2]));
    if(UI.worldClock)UI.worldClock.textContent=`DZIEŃ ${dayNo} · ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    if(UI.worldBiome)UI.worldBiome.textContent=biome.replaceAll('_',' ').toUpperCase();
    const threat=player.threat>.82?'PANIKA':player.threat>.56?'BLISKO':night>.7?'EKSTREMALNE':night>.42?'wysokie':player.threat>.20?'kontakt':'czujność';
    UI.threatInfo.textContent=`Zagrożenie: ${threat}`;UI.threatInfo.style.color=night>.7?'#d16b6e':'';
    renderHearts();
    UI.hungerBar.style.width=`${clamp(player.hunger,0,100)}%`;UI.hungerText.textContent=String(Math.round(player.hunger));
    UI.staminaBar.style.width=`${clamp(player.stamina,0,100)}%`;UI.staminaText.textContent=String(Math.round(player.stamina));
    UI.sanityBar.style.width=`${clamp(player.sanity,0,100)}%`;UI.sanityText.textContent=String(Math.round(player.sanity));
    const focus=enemyRayHit(14);if(focus){const d=enemyDefs[focus.e.type];UI.enemyHud.classList.remove('hidden');UI.enemyName.textContent=d.name.toUpperCase();UI.enemyHpText.textContent=`${Math.max(0,Math.ceil(focus.e.hp))} / ${focus.e.maxHp}`;UI.enemyHpFill.style.width=`${clamp(focus.e.hp/focus.e.maxHp*100,0,100)}%`;}else UI.enemyHud.classList.add('hidden');
    fpsAcc+=dt;fpsFrames++;if(fpsAcc>=.5){fps=Math.round(fpsFrames/fpsAcc);fpsAcc=0;fpsFrames=0;}
    if(debug)UI.debugPanel.textContent=`FPS ${fps}\nXYZ ${player.pos.map(v=>v.toFixed(2)).join(' ')}\nchunk ${floorDiv(player.pos[0],CHUNK)}, ${floorDiv(player.pos[2],CHUNK)}\nchunks ${chunks.size} · meshQ ${dirtyChunks.size}\nenemies ${enemies.length} · birds ${birds.length} · drops ${droppedItems.length} · particles ${particles.length}\nmined ${player.blocksMined} · kills ${player.kills} · walked ${(player.distanceWalked||0).toFixed(1)}m\nweather ${weatherMode}\nseed ${worldSeed}\nnight ${(night*100).toFixed(0)}%\nWebGL ${gl.getParameter(gl.VERSION)}`;
  }
  function frame(now){const dt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;if(running&&!paused&&!dead)updateWorld(dt);render();updateHUD(dt);updateMinimap(dt);if(mapOpen)renderFullMap();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  // Read-only hook used by the local smoke/integration harness.
  window.__NIGHTCRAFT_TEST__={
    version:15,B,terrainHeight,biomeAt,caveMouthDepth,mineshaftInfo,mineshaftCell,ruinTypes:RUIN_TYPES,ruinCandidateForCell,blockDefs,itemDefs,recipes,enemyDefs,birdDefs,equippedPowerFor,miningSecondsFor,getBlock,setBlock,spawnPointIsSafe,findSafeSpawn,resolvePlayerSpawnCollision,playerGroundedAt,soundMaterialForBlock,footstepMaterialForTest:footstepMaterial,matchingCraftRecipeForTest:matchingCraftRecipe,takeCraftOutputForTest:takeCraftOutput,setCraftSlotsForTest:slots=>{player.craftSlots=slots.slice(0,9).map(normalizeStack);while(player.craftSlots.length<9)player.craftSlots.push(null);refreshInventoryUI();},breakBlockForTest:(x,y,z)=>breakBlockByPlayer({x,y,z,id:getBlock(x,y,z)}),spawnItemDropForTest:spawnItemDrop,updateDroppedItemsForTest:updateDroppedItems,openStarterChestForTest:openStarterChest,openFurnaceForTest:(x,y,z)=>openFurnace({x,y,z,id:B.FURNACE}),setFurnaceStateForTest:(x,y,z,state)=>{setBlock(x,y,z,B.FURNACE);const key=fortKey(x,y,z);furnaces.set(key,{input:null,fuel:null,output:null,burn:0,burnMax:0,progress:0,...state});return furnaces.get(key);},getFurnaceForTest:(x,y,z)=>furnaces.get(fortKey(x,y,z))||null,updateFurnacesForTest:updateFurnaces,respawnForTest:respawn,setPlayerPosForTest:p=>{player.pos=[...p];},nudgePlayerForTest:(dx,dz)=>{movePlayerAxis(0,dx);movePlayerAxis(2,dz);return[...player.pos];},openInventoryForTest:openInventory,openFullMapForTest:openFullMap,constructionCollisionBoxesForTest:constructionCollisionBoxes,ensureFortification,damageFortification,FORT_TIERS,SMELT_RECIPES,
    getState:()=>({running,paused,inventoryOpen,furnaceOpen,mapOpen,worldSeed,renderDistance,worldSeconds,daySeconds:DAY_SECONDS,worldSpawn:worldSpawn?[...worldSpawn]:null,enemyCount:enemies.length,birdCount:birds.length,starterChestPos:starterChestPos?[...starterChestPos]:null,starterTorchCount:starterChestPos?[...edits].filter(([k,v])=>{if(v!==B.TORCH)return false;const[x,y,z]=k.split(',').map(Number);return Math.hypot(x-starterChestPos[0],z-starterChestPos[2])<=4.6;}).length:0,starterTorchPositions:starterChestPos?[...edits].filter(([k,v])=>v===B.TORCH).map(([k])=>k):[],fortifications:[...fortifications.entries()],furnaces:[...furnaces.entries()],droppedItems:droppedItems.map(d=>({id:d.id,count:d.count,pos:[...d.pos],age:d.age})),playerColliding:aabbHitsWorld(playerAabbAt(player.pos[0],player.pos[1],player.pos[2])),player:{...player,pos:[...player.pos],slots:player.slots.map(cloneStack),craftSlots:player.craftSlots.map(cloneStack)},cursorStack:cloneStack(cursorStack)})
  };

  // Pre-fill a memorable default seed and expose a tiny health marker for tests.
  UI.seedInput.value='black-forest-666';
  document.body.dataset.gameBooted='true';
})();
