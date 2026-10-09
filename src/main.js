// Native ES bootstrap. No runtime bundler or eval.
import { state as S } from './state.js';
import { createChunkWorker } from './world/worker/client.js';
import { loadGameData } from './data/loader.js';
import { loadShaders } from './render/shaders/loader.js';
import { loadTextureOverrides } from './render/texture-overrides.js';
import { prefetchSave, saveWorld } from './save/indexed-db.js';
import {install as install0} from './ui/bootstrap.js';
import {install as install1} from './math/matrix.js';
import {install as install2} from './world/noise.js';
import {install as install3} from './data/registry.js';
import {install as install4} from './render/gl.js';
import {install as install5} from './render/atlas.js';
import {install as install6} from './world/worldgen.js';
import {install as install7} from './world/world-api.js';
import {install as install8} from './render/held-block.js';
import {install as installEquipment} from './render/equipment-models.js';
import {install as installSunShadows} from './render/shadows.js';
import {install as install9} from './render/chunks.js';
import {install as install10} from './render/entities.js';
import {install as install11} from './audio/mixer.js';
import {install as install12} from './sim/structures.js';
import {install as install13} from './sim/player.js';
import {install as install14} from './sim/mobs/definitions.js';
import {install as install15} from './sim/mobs/wolf-senses.js';
import {install as install16} from './sim/mobs/navigation.js';
import {install as installPredator} from './sim/mobs/predator-tactics.js';
import {install as installFlying} from './sim/mobs/flying.js';
import {install as installCaveHollowed} from './sim/mobs/cave-hollowed.js';
import {install as install17} from './sim/horror/events.js';
import {install as install18} from './render/leaves.js';
import {install as install19} from './sim/mobs/birds.js';
import {install as install20} from './ui/inventory.js';
import {install as install21} from './ui/admin.js';
import {install as install22} from './save/compat.js';
import {install as install23} from './sim/skills.js';
import {install as install24} from './ui/input.js';
import {install as install25} from './sim/physics.js';
import {install as installTrees} from './sim/falling-trees.js';
import {install as install26} from './render/weather.js';
import {install as install27} from './render/scene.js';
import {install as install28} from './ui/minimap.js';
import {install as install29} from './ui/hud.js';
import {install as install30} from './ui/test-api.js';
import {install as installMenuScene} from './render/menu-scene.js';
import {install as installCodex} from './ui/recipe-codex.js';
import {install as installMultiplayer} from './net/multiplayer.js';
import {install as installDesktopHost} from './ui/desktop-host.js';

try {
  const [data,shaders,textures]=await Promise.all([loadGameData(),loadShaders(),loadTextureOverrides()]);
  window.__NIGHTCRAFT_DATA__ = data;
  S.GAME_SHADERS = shaders;
  S.GAME_TEXTURE_OVERRIDES = textures;
  window.__NIGHTCRAFT_PRELOADED_SAVE__ = await prefetchSave();
  window.__NIGHTCRAFT_PERSIST_SAVE__ = saveWorld;
  install0(S); // ui/bootstrap.js
  install1(S); // math/matrix.js
  install2(S); // world/noise.js
  install3(S); // data/registry.js
  install4(S); // render/gl.js
  install5(S); // render/atlas.js
  install6(S); // world/worldgen.js
  install7(S); // world/world-api.js
  installSunShadows(S); // dynamic sun shadows on loaded voxels
  install8(S); // render/held-block.js
  installEquipment(S); // unified first/third person equipment silhouettes
  install9(S); // render/chunks.js
  install10(S); // render/entities.js
  install11(S); // audio/mixer.js
  install12(S); // sim/structures.js
  install13(S); // sim/player.js
  install14(S); // sim/mobs/definitions.js
  install15(S); // sim/mobs/wolf-senses.js
  installPredator(S); // pack separation and attack planning
  installFlying(S); // independent aerial AI
  installCaveHollowed(S); // blind sound-driven monster in underground chambers
  install16(S); // sim/mobs/navigation.js
  install17(S); // sim/horror/events.js
  install18(S); // render/leaves.js
  install19(S); // sim/mobs/birds.js
  install20(S); // ui/inventory.js
  install21(S); // ui/admin.js
  install22(S); // save/compat.js
  install23(S); // sim/skills.js
  install24(S); // ui/input.js
  install25(S); // sim/physics.js
  installTrees(S); // natural tree felling + weighted swing direction
  install26(S); // render/weather.js
  install27(S); // render/scene.js
  installMenuScene(S); // shared WebGL atlas + shader driven rotating voxel scene for the start menu
  install28(S); // ui/minimap.js
  install29(S); // ui/hud.js
  installCodex(S); // illustrated crafting handbook
  install30(S); // ui/test-api.js
  installMultiplayer(S); // co-op rooms, WebSocket sync, remote avatars, multiplayer UI
  installDesktopHost(S); // Electron only: server spawn, ngrok tunnel and host menu
  createChunkWorker(S,window.__NIGHTCRAFT_DATA__);
  if(!S.gl) throw new Error('WebGL unavailable');
  window.__NIGHTCRAFT_ENGINE__ = S; // Debug overlay can read, not own, state.
} catch(err) {
  console.error('NightCraft boot error',err);
  document.body.dataset.gameBootError = String(err);
  const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:12px auto auto 12px;background:#241c17;color:#ffdaaa;padding:16px;border:2px solid #bb8d40;font:14px monospace;z-index:999999';overlay.textContent='Błąd uruchamiania gry: '+err.message;document.body.append(overlay);
}
