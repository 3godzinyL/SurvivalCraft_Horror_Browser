// NightCraft V15 · native ES module (audio/mixer.js); installs into the explicit shared state.
export function install(S) {
S.audio = {
    ctx: null, master: null, sfxGain: null, ambientGain: null, musicGain: null, volume: .82,
    buffers: {}, sampleLoadStarted: false, sampleLoadDone: false, eveningLoop: null, musicLoop: null, rainLoop: null, windLoop: null,
    ambientClock: 1.5, unlocked: false, htmlVoices: new Set()
};

S.audioFiles = S.GAME_DATA.audio;

S.BLOCK_SOUND_MATERIALS = ['grass', 'dirt', 'mud', 'clay', 'stone', 'cobble', 'brick', 'wood', 'plank', 'sand', 'snow', 'gravel', 'leaves', 'glass', 'metal', 'ore'];

S.soundMaterialForBlock = function soundMaterialForBlock(id) {
    if ([S.B.LEAVES, S.B.PINELEAVES, S.B.BIRCHLEAVES, S.B.DARKLEAVES, S.B.AUTUMNLEAVES, S.B.WILLOWLEAVES, S.B.POPLARLEAVES, S.B.MIMOSALEAVES, S.B.TALLGRASS, S.B.FERN, S.B.BUSH, S.B.DRY_BUSH, S.B.HEATHER, S.B.REEDS, S.B.RED_FLOWER, S.B.WHITE_FLOWER, S.B.BLUE_FLOWER, S.B.YELLOW_FLOWER].includes(id))
        return 'leaves';
    if ([S.B.GRASS, S.B.MOSSY_DIRT, S.B.DRY_GRASS, S.B.FOREST_GRASS, S.B.FROST_GRASS].includes(id))
        return 'grass';
    if ([S.B.MUD, S.B.PEAT, S.B.SILT].includes(id))
        return 'mud';
    if ([S.B.CLAY].includes(id))
        return 'clay';
    if ([S.B.DIRT, S.B.LOAM, S.B.PODZOL, S.B.CAVE_DIRT].includes(id))
        return 'dirt';
    if ([S.B.GRAVEL, S.B.RUBBLE].includes(id))
        return 'gravel';
    if ([S.B.SAND, S.B.RED_SAND, S.B.ASH_BLOCK, S.B.SANDSTONE].includes(id))
        return 'sand';
    if ([S.B.SNOW].includes(id))
        return 'snow';
    if ([S.B.GLASS, S.B.ICE].includes(id))
        return 'glass';
    if ([S.B.IRON_BLOCK, S.B.GOLD_BLOCK].includes(id))
        return 'metal';
    if ([S.B.COAL, S.B.IRON, S.B.GOLD].includes(id))
        return 'ore';
    if ([S.B.PLANKS, S.B.OLD_PLANKS, S.B.DARK_PLANKS, S.B.CHEST, S.B.WOOD_DOOR, S.B.WOOD_STAIRS, S.B.WOOD_FENCE].includes(id))
        return 'plank';
    if ([S.B.WOOD, S.B.PINEWOOD, S.B.BIRCHWOOD, S.B.DARKWOOD, S.B.WILLOWWOOD, S.B.POPLARWOOD, S.B.MIMOSAWOOD, S.B.DEADWOOD].includes(id))
        return 'wood';
    if ([S.B.COBBLE, S.B.RIVER_ROCK].includes(id))
        return 'cobble';
    if ([S.B.STONE_BRICKS, S.B.CRACKED_BRICKS, S.B.MOSSY_BRICKS, S.B.CHISELED_STONE, S.B.WEATHERED_BRICKS, S.B.OLD_TILES, S.B.GRAVE_STONE, S.B.RUNE_STONE].includes(id))
        return 'brick';
    const m = S.blockDefs[id]?.material;
    return m === 'wood' ? 'wood' : m === 'sand' ? 'sand' : m === 'snow' ? 'snow' : m === 'glass' ? 'glass' : m === 'metal' ? 'metal' : m === 'dirt' ? 'dirt' : 'stone';
};

S.makeNoiseBuffer = function makeNoiseBuffer(seconds = .5) { const c = S.audio.ctx, len = Math.max(1, Math.floor(c.sampleRate * seconds)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++)
    d[i] = Math.random() * 2 - 1; return buf; };

S.tone = function tone(freq, dur, gain = .04, type = 'sine', slide = .8, when = 0) { if (!S.audio.ctx)
    return; const c = S.audio.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(18, freq * slide), t + dur); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(S.audio.sfxGain || S.audio.master); o.start(t); o.stop(t + dur + .03); };

S.noiseBurst = function noiseBurst(dur = .08, gain = .04, cut = 700, when = 0) { if (!S.audio.ctx)
    return; const c = S.audio.ctx, t = c.currentTime + when, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = S.makeNoiseBuffer(Math.max(.12, dur)); f.type = 'lowpass'; f.frequency.value = cut; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); src.connect(f); f.connect(g); g.connect(S.audio.sfxGain || S.audio.master); src.start(t); src.stop(t + dur + .02); };

S.htmlPlay = function htmlPlay(name, gain = 1, rate = 1) {
    const url = S.audioFiles[name];
    if (!url || typeof Audio === 'undefined')
        return false;
    try {
        const a = new Audio(url);
        a.preload = 'auto';
        a.volume = S.clamp(S.audio.volume * gain * .95, 0, 1);
        a.playbackRate = S.clamp(rate, .65, 1.55);
        S.audio.htmlVoices.add(a);
        const done = () => S.audio.htmlVoices.delete(a);
        a.addEventListener('ended', done, { once: true });
        a.addEventListener('error', done, { once: true });
        const pr = a.play();
        if (pr?.catch)
            pr.catch(done);
        return true;
    }
    catch {
        return false;
    }
};

S.playSample = function playSample(name, gain = 1, rate = 1, detune = 0) {
    if (S.audio.ctx && S.audio.buffers[name]) {
        const src = S.audio.ctx.createBufferSource(), g = S.audio.ctx.createGain();
        src.buffer = S.audio.buffers[name];
        src.playbackRate.value = rate;
        src.detune.value = detune;
        g.gain.value = gain;
        src.connect(g);
        g.connect(S.audio.sfxGain || S.audio.master);
        src.start();
        return true;
    }
    return S.htmlPlay(name, gain, rate);
};

S.playSpatialSample = function playSpatialSample(name, gain = 1, rate = 1, pan = 0, detune = 0) {
    if (S.audio.ctx && S.audio.buffers[name]) {
        const src = S.audio.ctx.createBufferSource(), g = S.audio.ctx.createGain();
        src.buffer = S.audio.buffers[name];
        src.playbackRate.value = rate;
        src.detune.value = detune;
        g.gain.value = gain;
        src.connect(g);
        if (typeof S.audio.ctx.createStereoPanner === 'function') {
            const p = S.audio.ctx.createStereoPanner();
            p.pan.value = S.clamp(pan, -1, 1);
            g.connect(p);
            p.connect(S.audio.sfxGain || S.audio.master);
        }
        else
            g.connect(S.audio.sfxGain || S.audio.master);
        src.start();
        return true;
    }
    return S.htmlPlay(name, gain, rate);
};

S.startAmbientLoops = function startAmbientLoops() {
    if (!S.audio.ctx)
        return;
    if (S.audio.buffers.evening && !S.audio.eveningLoop) {
        const src = S.audio.ctx.createBufferSource(), g = S.audio.ctx.createGain();
        src.buffer = S.audio.buffers.evening;
        src.loop = true;
        g.gain.value = .0001;
        src.connect(g);
        g.connect(S.audio.ambientGain);
        src.start();
        S.audio.eveningLoop = { src, g };
    }
    for (const [name, key] of [['rain_loop', 'rainLoop'], ['wind_loop', 'windLoop']])
        if (S.audio.buffers[name] && !S.audio[key]) {
            const src = S.audio.ctx.createBufferSource(), g = S.audio.ctx.createGain();
            src.buffer = S.audio.buffers[name];
            src.loop = true;
            g.gain.value = .00001;
            src.connect(g);
            g.connect(S.audio.ambientGain);
            src.start();
            S.audio[key] = { src, g };
        }
    if (S.audio.buffers.music && !S.audio.musicLoop) {
        const src = S.audio.ctx.createBufferSource(), g = S.audio.ctx.createGain();
        src.buffer = S.audio.buffers.music;
        src.loop = true;
        g.gain.value = .0001;
        src.connect(g);
        g.connect(S.audio.musicGain);
        src.start();
        S.audio.musicLoop = { src, g };
    }
};

S.loadAudioSamples = async function loadAudioSamples() {
    if (S.audio.sampleLoadStarted || !S.audio.ctx)
        return;
    S.audio.sampleLoadStarted = true;
    const loadOne = async ([key, url]) => { try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok)
            throw new Error(String(res.status));
        const arr = await res.arrayBuffer();
        S.audio.buffers[key] = await S.audio.ctx.decodeAudioData(arr);
    }
    catch (err) {
        console.warn('Audio asset fallback:', key, err);
    } };
    // Decode a small high-priority set first, then the large material library in
    // batches. This avoids a one-frame storm of ~160 simultaneous decodes while
    // HTMLAudio remains a fallback for a sample requested before its buffer exists.
    const priorityKeys = new Set(['evening', 'music', 'hurt', 'heartbeat', 'thunder', 'rain_loop', 'wind_loop', 'thunder2', 'thunder3', 'splash', 'swim', 'swim_stroke_2', 'swim_stroke_3', 'pickup1', 'pickup2', 'chest_open', 'chest_close', 'jumpscare', 'wolf_bark_1', 'wolf_growl_2', 'bat_shriek_1', 'bat_wings', 'step_grass_1', 'step_grass_2', 'step_stone_1', 'step_stone_2', 'block_hit_dirt_1', 'block_break_dirt_1', 'block_place_dirt_1']);
    const entries = Object.entries(S.audioFiles), priority = entries.filter(([k]) => priorityKeys.has(k)), rest = entries.filter(([k]) => !priorityKeys.has(k));
    await Promise.all(priority.map(loadOne));
    S.startAmbientLoops();
    for (let i = 0; i < rest.length; i += 12) {
        await Promise.all(rest.slice(i, i + 12).map(loadOne));
        await Promise.resolve();
    }
    S.audio.sampleLoadDone = true;
    S.startAmbientLoops();
};

S.initAudio = function initAudio() {
    if (S.audio.ctx) {
        S.audio.ctx.resume?.();
        S.startAmbientLoops();
        return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC)
        return;
    S.audio.ctx = new AC();
    const comp = S.audio.ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 16;
    comp.ratio.value = 2.7;
    comp.attack.value = .003;
    comp.release.value = .22;
    S.audio.master = S.audio.ctx.createGain();
    S.audio.sfxGain = S.audio.ctx.createGain();
    S.audio.ambientGain = S.audio.ctx.createGain();
    S.audio.musicGain = S.audio.ctx.createGain();
    S.audio.master.gain.value = S.audio.volume;
    S.audio.sfxGain.gain.value = 1.35;
    S.audio.ambientGain.gain.value = .98;
    S.audio.musicGain.gain.value = .72;
    S.audio.sfxGain.connect(comp);
    S.audio.ambientGain.connect(comp);
    S.audio.musicGain.connect(comp);
    comp.connect(S.audio.master);
    S.audio.master.connect(S.audio.ctx.destination);
    void S.loadAudioSamples();
};

S.unlockAudio = function unlockAudio() {
    S.initAudio();
    S.audio.unlocked = true;
    if (S.audio.ctx?.state !== 'running')
        S.audio.ctx?.resume?.();
    S.startAmbientLoops();
};

window.addEventListener('pointerdown', S.unlockAudio, { capture: true, passive: true });

window.addEventListener('keydown', S.unlockAudio, { capture: true });

S.sfx = function sfx(type, amount = 1, material = 'generic') {
    S.unlockAudio();
    const a = amount;
    if (type === 'boar_grunt_1' || type === 'boar_grunt_2') {
        S.playSample(type,.80*a,.91+Math.random()*.16);
        return;
    }
    if (type === 'step') {
        const mat = S.BLOCK_SOUND_MATERIALS.includes(material) ? material : 'stone', key = `step_${mat}_${1 + (Math.random() > .5 ? 1 : 0)}`;
        if (S.playSample(key, 1.02 * a, .88 + Math.random() * .22, (Math.random() - .5) * 110))
            return;
        const legacy = 'step_' + (['grass', 'dirt', 'stone', 'wood', 'sand', 'snow'].includes(mat) ? mat : 'stone');
        if (S.playSample(legacy, .95 * a, .9 + Math.random() * .18))
            return;
        S.noiseBurst(.10, .09 * a, mat === 'stone' || mat === 'metal' ? 1800 : 1050);
        return;
    }
    if (type === 'splash') {
        if (S.playSample('splash', 1.0 * a, .93 + Math.random() * .10))
            return;
        S.noiseBurst(.24, .13 * a, 1200);
        return;
    }
    if (type === 'swim') {
        if (S.playSample(['swim','swim_stroke_2','swim_stroke_3'][(S.swimVoice=(S.swimVoice||0)+1)%3], .66 * a, .96 + Math.random() * .08))
            return;
        S.noiseBurst(.15, .08 * a, 760);
        return;
    }
    if (type === 'mine' || type === 'break' || type === 'place') {
        const mat = S.BLOCK_SOUND_MATERIALS.includes(material) ? material : 'stone', action = type === 'mine' ? 'hit' : type, variant = 1 + (Math.random() > .5 ? 1 : 0), key = `block_${action}_${mat}_${variant}`, gain = (type === 'mine' ? .63 : type === 'break' ? 1.04 : .94) * a, rate = (type === 'mine' ? .81 : type === 'break' ? .89 : .94) + (Math.random() - .5) * .09;
        if (S.playSample(key, gain, rate, (Math.random() - .5) * 55))
            return;
        const fallback = type === 'mine' ? 'block_hit' : type === 'break' ? 'block_break' : 'block_place';
        if (S.playSample(fallback, gain, rate))
            return;
        S.noiseBurst(type === 'break' ? .20 : .09, .11 * a, mat === 'metal' || mat === 'glass' ? 1900 : 1250);
        return;
    }
    if (type === 'torch') {
        if (S.playSample('torch_place', 1.05 * a, .91 + Math.random() * .14))
            return;
        S.tone(720, .09, .07 * a, 'sine', 1.18);
        return;
    }
    if (type === 'pickup') {
        if (S.playSample(Math.random() > .5 ? 'pickup1' : 'pickup2', .85 * a, .94 + Math.random() * .12))
            return;
        S.tone(520, .08, .05 * a, 'sine', 1.42);
        return;
    }
    if (type === 'hit') {
        if (S.playSample('mob_hit', 1.04 * a, .86 + Math.random() * .21))
            return;
        S.noiseBurst(.11, .12 * a, 1600);
        return;
    }
    if (type === 'hurt') {
        if (S.playSample('hurt', 1.08 * a, .92 + Math.random() * .12))
            return;
        S.noiseBurst(.16, .14 * a, 900);
        return;
    }
    if (type === 'howl') {
        if (S.playSample('howl', .88 * a, .92 + Math.random() * .10))
            return;
        S.tone(175, .85, .10 * a, 'sine', 2.05);
        return;
    }
    if (type === 'growl') {
        if (S.playSample(Math.random()<.50?'growl':'wolf_growl_2', .84 * a, .84 + Math.random() * .18))
            return;
        S.noiseBurst(.26, .11 * a, 420);
        return;
    }
    if (type === 'thunder') {
        const variant = Math.random() < .35 ? 'thunder' : Math.random() < .5 ? 'thunder2' : 'thunder3';
        if (S.playSample(variant, 1.1 * a, .90 + Math.random() * .09))
            return;
        S.noiseBurst(1.45, .26 * a, 520);
        return;
    }
    if (type === 'bird') {
        S.playSample('bird', .45 * a, .88 + Math.random() * .30);
        return;
    }
    if (type === 'crow') {
        S.playSample('crow', .52 * a, .88 + Math.random() * .18);
        return;
    }
    if (type === 'wind') {
        S.playSample('wind', .38 * a, .85 + Math.random() * .22);
        return;
    }
    if (type === 'drip') {
        S.playSample('drip', .34 * a, .88 + Math.random() * .28);
        return;
    }
    if (type === 'creak') {
        S.playSample('creak', .34 * a, .82 + Math.random() * .22);
        return;
    }
    if (type === 'craft') {
        if (S.playSample('craft', .70 * a, .95 + Math.random() * .08))
            return;
        S.tone(420, .08, .06 * a, 'sine', 1.32);
        return;
    }
    if (type === 'eat') {
        if (S.playSample('eat', .72 * a, .91 + Math.random() * .18))
            return;
        S.noiseBurst(.09, .055 * a, 1400);
        return;
    }
    if (type === 'inventory') {
        if (S.playSample('inventory', .52 * a, .92 + Math.random() * .16))
            return;
        S.tone(260, .045, .018 * a, 'square', 1.08);
        return;
    }
    if(type==='chest_close'){
        if(S.playSample('chest_close',.85*a,.92+Math.random()*.08))return;
        S.playSample('chest',.40*a,.75);return;
    }
    if(type==='bat_shriek'||type==='bat_wings'||type==='jumpscare'){
        if(S.playSample(type,type==='jumpscare'?.95*a:.60*a,.92+Math.random()*.14))return;
        S.noiseBurst(.18,.09*a,1400);return;
    }
    if(type==='wolf_bark'){
        if(S.playSample('wolf_bark_1',.72*a,.85+Math.random()*.22))return;
        S.playSample('growl',.52*a,.91);return;
    }
    if (type === 'chest') {
        if (S.playSample('chest_open', .9 * a, .95 + Math.random() * .08))
            return;
        S.tone(118, .16, .05 * a, 'triangle', .62);
        return;
    }
    if (type === 'fire') {
        S.playSample('fire', .36 * a, .94 + Math.random() * .10);
        return;
    }
    if (type === 'water_lap') {
        S.playSample('water_lap', .34 * a, .91 + Math.random() * .14);
        return;
    }
};

S.ambientAudioTick = function ambientAudioTick(dt, night) {
    if (!S.audio.ctx)
        return;
    const ph = (S.worldSeconds % S.DAY_SECONDS) / S.DAY_SECONDS, dusk = Math.max(0, 1 - Math.abs(ph - .73) / .20), dawn = Math.max(0, 1 - Math.abs(ph - .23) / .14);
    const underground = S.player.pos[1] < S.terrainHeight(Math.floor(S.player.pos[0]), Math.floor(S.player.pos[2])) - 4;
    const eveningLevel = S.clamp(.22 + dusk * .90 + night * .32 + dawn * .18, 0, 1) * (underground ? .22 : 1);
    if (S.audio.eveningLoop)
        S.audio.eveningLoop.g.gain.value = S.lerp(S.audio.eveningLoop.g.gain.value, .46 * eveningLevel, .025);
    if (S.audio.musicLoop)
        S.audio.musicLoop.g.gain.value = S.lerp(S.audio.musicLoop.g.gain.value, .165 * (.72 + night * .36), .018);
    if (S.audio.rainLoop)
        S.audio.rainLoop.g.gain.value = S.lerp(S.audio.rainLoop.g.gain.value, S.weatherMode === 'rain' ? .18 + S.weatherIntensity * .60 : .00001, S.clamp(dt * 1.7, 0, 1));
    if (S.audio.windLoop)
        S.audio.windLoop.g.gain.value = S.lerp(S.audio.windLoop.g.gain.value, .10 + (S.weatherMode === 'rain' ? .20 : .08) + Math.sin(S.worldSeconds * .11) * .045, S.clamp(dt * .8, 0, 1));
    S.audio.ambientClock -= dt;
    if (S.audio.ambientClock > 0)
        return;
    S.audio.ambientClock = 1.9 + Math.random() * 5.2;
    const r = Math.random();
    if (S.hasHeldTorch() || S.nearestPlacedTorch())
        if (Math.random() < .42)
            S.sfx('fire', .6);
    const px = Math.floor(S.player.pos[0]), py = Math.floor(S.player.pos[1]), pz = Math.floor(S.player.pos[2]);
    let shore = false;
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [-6, 0], [0, 6], [0, -6]])
        if (S.getBlock(px + dx, Math.max(1, Math.min(S.SEA, py)), pz + dz) === S.B.WATER || S.terrainHeight(px + dx, pz + dz) <= S.SEA) {
            shore = true;
            break;
        }
    if (shore && Math.random() < .26)
        S.sfx('water_lap', .6);
    if (underground) {
        if (r < .52)
            S.sfx('drip', .7);
        else if (r < .66)
            S.sfx('creak', .45);
        return;
    }
    if (night > .64) {
        if (r < .14)
            S.sfx('growl', .20);
        else if (r < .23)
            S.sfx('howl', .16);
        else if (r < .36)
            S.sfx('wind', .45);
    }
    else {
        if (r < .33)
            S.sfx('bird', .8);
        else if (r < .43)
            S.sfx('crow', .75);
        else if (r < .54)
            S.sfx('wind', .35);
    }
};

S.setAudioVolume = function setAudioVolume(v) { S.audio.volume = S.clamp(Number(v) || 0, 0, 1); if (S.audio.master)
    S.audio.master.gain.value = S.audio.volume; for (const a of S.audio.htmlVoices)
    a.volume = S.clamp(S.audio.volume * .8, 0, 1); };
}
