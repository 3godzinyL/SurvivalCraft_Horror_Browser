# NightCraft V22 — architektura i zmiany

- `worldgenVersion=22` tylko dla nowych światów. Outcrops / wrecks są deterministycznymi strukturami wielochunkowymi z kotwicą na siatce niezależnej od seeda. Światy 16–21 zachowują oryginalny generator.
- `data/ids.lock`: dopisano blok 94 `CAMPFIRE`; zaktualizowano generator ID i recepturę.
- `src/ui/inventory.js`, `ui/minimap.js`, `ui/hud.js`: centralne czyszczenie tooltipów, waypoint PPM z kierunkiem i odległością, wspólny zoom.
- `src/render/shaders/voxel.vert.glsl` i `.frag.glsl`: falowanie geometryczne wody i wielowarstwowy efekt rippli.
- `src/render/scene.js`: ognisko jako własne wieloelementowe modele, cząsteczki, dźwięk i światło. `render/equipment-models.js`: osobna sylwetka przedmiotu.
- `src/sim/mobs/navigation.js`: pounce wolf/boar jako windup, burst, ograniczony cooldown oraz pchnięcie i kontrreakcja.
- `src/save/migrations.js`: 24, bez utraty pozycji celu i edycji bloków; IndexedDB pozostaje magazynem świata.
- `tests/v22_features.mjs`: generator struktur + zachowanie starych seedów, nowy blok, skill X, shader, waypoint.
- Rust/WASM pozostaje eksperymentalnym kodem źródłowym, produkcyjne chunki tworzy istniejący JS worker / fallback.

---

# NightCraft V21 — zmiany architektoniczne i nowe mechaniki

- `src/sim/physics.js`: ciągłe, proporcjonalne do czasu kopania zużycie narzędzi; bardzo wysoki koszt pracy drewnianym kilofem na rudzie złota/żelaza.
- `src/ui/inventory.js` + `style.css`: wizualizacja trwałości każdego narzędzia w hotbarze, przedmiotach w EQ i slocie drugiej ręki.
- `src/world/worldgen.js`: `deepRockAt` od worldgenVersion 21 preferuje bruk i kamień zamiast DARKSTONE. Światy historyczne zachowują hash danych i stary generator.
- `src/sim/mobs/cave-hollowed.js`: oddzielne stany czujności wyłącznie przez `playerNoiseEvents` (brak wykrywania wzrokiem), bardzo wolny routing jaskiniowy; sprawdzanie spawnów tylko w istniejących chunkach. `definitions.js` i `navigation.js` integrują AI z główną symulacją.
- `src/render/scene.js`: model potwora jaskiniowego z pustymi oczodołami i zwisającymi oczami; render uszkodzeń przewróconych kłód.
- `src/render/entities.js`: 24 progresywne, smukłe rozgałęzienia na każdej z sześciu ścian; przyrost obrażeń równo związany z procentem kopania.
- `src/sim/falling-trees.js`: upadające kłody usuwają drobne rośliny z pola lądowania, otrzymują własne uszkodzenia 5–30%.
- `src/save/compat.js` + `src/save/migrations.js`: wersja 23; zapis pozycji ostatniej śmierci i procentu obrażeń poziomych kłód, migracja zgodna z V14–V20.
- `src/ui/minimap.js` + `src/ui/inventory.js`: mapa lokalna i eksploracji wskazuje miejsce ostatniej śmierci.
- `src/render/held-block.js`: strumieniowanie terenów z ograniczonym czasem przeglądania i odbudowy mesha.
- `tests/v21_features.mjs`: rzeczywiste testy ubytku trwałości, wolniejszego kopania rud, pochodni offhand, zniszczenia kwiatu, spawnów jaskiniowego AI, ślepoty, geometrii 6 ścian, audio i migracji.

Kompatybilność: niezmienne `data/ids.lock`, generacja istniejących światów identyczna, brak wymogu kompilacji Rust/WASM dla uruchomienia gry.

---

# NightCraft V19 — mapa architektury

## Wprowadzone w V19

- `src/sim/falling-trees.js`: detekcja naturalnej podstawy (edits), selekcja pnia i korony, uśredniony kierunek cięcia, animacja upadku, lądowanie bez nadpisywania konstrukcji i dropy.
- `src/render/equipment-models.js`: jednolity model przedmiotów w 1. i 3. osobie, bez kopii geometrii w renderze.
- `src/render/entities.js` + `scene.js`: procentowo sterowane mikropęknięcia o jednakowym przyroście na 6 ścianach, poprawna orientacja trójkątów.
- `src/save/compat.js`: opcjonalny stan `fallingTrees` w istniejącym formacie V22, migrator nadal zachowuje starsze zapisy.

# NightCraft V18 — mapowanie i kontrakty

```text
data/{blocks,items,recipes,mobs,biomes,ruins,audio,lang/pl}.json
  └─ src/data/loader.js (JSON validation + localized names + packed 256*6 meta)
     └─ src/main.js → src/state.js [S] → install() per module (31 native ES modules)
        ├─ world/worldgen.js (V14-compatible JS math)
        ├─ world/worker/client.js ↔ world/worker/world-worker.js
        ├─ world/world-api.js + render/held-block.js (streaming)
        ├─ render/gl.js, render/shaders/*.glsl, render/atlas.js
        ├─ sim/{player,physics,mobs,skills,horror}
        ├─ ui/{hud,inventory,minimap,input,menu...}
        ├─ audio/mixer.js
        └─ save/{indexed-db,migrations,compat}.js

crates/world-core/ (Rust, platform independent, source only)
crates/world-wasm/ (FFI wasm adapter, source only)
```

## Gwarancja kompatybilności

**Nie zmieniać numerów bloków.** `data/ids.lock` jest zapisem stałych historycznych. `npm run check` odrzuca zmiany. Świat zapisuje `edits` jako mapę absolutnych XYZ i starych `u8` ID. V14 golden-check obejmuje pełne chunki, a nie tylko powierzchnię. Historyczną generację ruin, drzew i biomów zachowano dzięki `worldgenVersion=16` dla starych zapisów. Nowe światy startują z `worldgenVersion=18`, dodają polany, wzgórza, rampy i zróżnicowane kopalnie oraz zachowują archetypy domów; `seed`, `edits` i dawne ID bloków nie są przemapowywane.

## Worker

`init(gameData, seed, token)` → `ready(token)`; `generate(cx, cz, token)` → `chunk(token,cx,cz,buffer)` (transferable). Po wczytaniu innego świata rośnie token, stary wynik jest ignorowany. Worker generuje tylko chunk bazowy; główny wątek nakłada **aktualne** `edits`, tak że zmiany wprowadzone podczas obliczeń też są zachowane. W pobliżu gracza synchronizacja ma pierwszeństwo ze względu na fizykę/raycast. W wyjątkach działa oryginalne `ensureChunk()`.

## Kontrakt Rust (obecnie niedopuszczony do produkcji)

`core::generate_chunk(cx,cz,seed)->Vec<u8>`: długość 24 576, ale **obecnie inne wyniki niż legacy**. `core::mesh_chunk(center,neighbors,meta)->Mesh`: packed `u32`, pola X(5),Y(7),Z(5),normal(3),tile(8),AO(2); oddzielnie opaque i translucent. Strony: E/W/N/S, próbki spoza chunków. `flood_light(center,meta,sources)` propaguje jasność 0–15 przez dostępne voxele. `world-wasm` udostępnia `input_alloc`, `init`, `generate_chunk`, `chunk_len`, `mesh_chunk`, `opaque_ptr/len`, `translucent_ptr/len`.

**Przed aktywacją WASM:** odwzorować cały stary algorytm `terrainHeight`, `biomeAt`, jaskiń, ruin, drzew i surowców z JS, porównać golden hashe każdej kombinacji, skompilować/uruchomić `cargo test` oraz dopisać do WebGL shader dekodujący `u32` przez cztery bajty (f32 nie reprezentuje bezbłędnie 30-bitowego packed integer).

## Refaktor modułów

`S` jest jedynym wspólnym stanem runtime, bez `import`-binding mutation. Obecne `install(S)` umożliwia podział bez niezamierzonej zmiany logiki. **Dalsza faza:** stopniowo wymienić zależności S.* na jawne serwisy/funkcje wejściowe, izolując domenę `sim/` od operacji UI i DOM. Obecna dystrybucja zachowuje część istniejących wywołań S.showMessage()/S.sfx() w symulacji, czyli nie jest jeszcze w pełni izolowaną, czystą architekturą domenową.

## Zasoby

Dźwięki są w `assets/audio`, a manifest w `data/audio.json`. Atlas domyślny powstaje proceduralnie, nazwa każdej płytki to `tile_NNN`, PNG-y z `assets/textures/` są opcjonalne i zadeklarowane w `data/texture-overrides.json`. GLSL jest pojedynczym źródłem w `src/render/shaders/*.glsl`.

## Dane i zapisy

Wszystkie definicje deklaratywne `data/*.json`. Narzędzia `tools/{gen-ids,validate-data,check-modules}` służą do generacji/kontraktów. IndexedDB `nightcraft-worlds/saves/main`, migrator `src/save/migrations.js`, fixtury `tests/fixtures`. Istniejące `localStorage` są tylko odczytywane do migracji.

## V16 — nowe subsystemy

- `src/sim/mobs/predator-tactics.js`: separation/formation, punching/breaking eligible blocks, persistent partial damage; audio and particles are callbacks of simulation events.
- `src/sim/mobs/flying.js`: night-only flying mobs, low-damage dive, signaling nearby wolves; separate from ground A* and block-breaking.
- `src/sim/structures.js`: 4 reinforced wall families, level0–3, HP scaling, costs 3/6/9, legacy fortification levels untouched.
- `src/ui/recipe-codex.js`: presentation-only data-driven book using existing recipe inventory APIs.
- `src/render/leaves.js`: multiple finite leaf motion modes and emitter budget.
- `src/render/scene.js`: 3D wall armor geometries and persistent block crack overlays.
- `src/save/compat.js`: saved `enemyBlockDamage` and family/level data in `fortifications` entries; migrations are versioned to V21.
- Tests `tests/v16_features.mjs`, `tests/v16_maze.mjs` focus on family-level upgrade economics, attacks and ground path finding.

Rust world generation remains experimental, not activated by V16; no breaking change to existing world generation/IDs. Full WebGL rendering and Windows `.bat` need local platform test; automated tests cover the Node-side logic and HTTP server.

## V17 — granice nowych systemów

- `src/render/shaders/voxel.vert.glsl` dodaje `aWind`/`uTime`; `src/render/held-block.js` tworzy jednobajtowy bufor wag dla liści i wysokiej trawy, nie przelicza go w pętli klatek. Kwiaty dostają wagę 0.
- `src/sim/player.js` oblicza położenie kamery F5 wraz z próbkami kolizji; `src/render/scene.js` renderuje postać oraz cztery części wyposażenia.
- `src/ui/input.js` obsługuje `pointerlockchange`, F5 oraz otwieranie/zamykanie UI; `src/render/weather.js` ma neutralną wyporność przy pływaniu.
- `src/sim/horror/events.js` przechowuje stan oczu i strachu w S, nie dotyka DOM; `src/ui/hud.js` rysuje wynik w warstwie interfejsu.
- `src/world/worldgen.js`: struktury V17 są odseparowane wyborem wersji, a identyczność V14 jest sprawdzana testem byte-for-byte.
- `src/save/migrations.js`: `CURRENT_SAVE_VERSION=21`, wspólna migracja dawnych wersji bez resetowania `worldgenVersion`, test idempotencji V17.
- `src/audio/mixer.js`: dodatkowe próbki w `assets/audio`, źródła w `data/audio.json` sprawdzane walidatorem.

**Niepotwierdzone:** rendering GPU w realnej przeglądarce i działanie `.bat` na Windows nie były testowane na docelowym sprzęcie.

## V17.1 — isolated, animated main-menu world

`src/render/menu-scene.js` owns a preview-only immutable voxel landscape (trees, grass and river) built from the existing `S.B`, `S.faces`, `S.tileFor()`, `S.tileUV()`, `S.makeMeshBuffers()` and `S.drawVoxelMesh()`. It shares the regular WebGL context, procedural atlas, fog and wind/water GLSL, but has **no access to** persistent `S.chunks`, seed generation, world edits, mob simulation or IndexedDB. `src/render/scene.js` branches before touching the active player when `!S.running`, allowing menu rendering even without a loaded world. The background mesh buffers are created once per page load. A small `#menuLeafFx` 2D overlay adds wind-driven leaves with a bounded particle budget and ~30 FPS update throttle.

Shaders with uniforms/varyings crossing stage boundaries explicitly specify matching precision qualifiers (`mediump`); `tests/v17_1_menu.mjs` checks this and performs a headless, mock-GL geometry build/draw. File routes for favicon SVG are served with the correct MIME type. Save format and old-world golden hashes are unchanged.

## V18 — strumieniowanie i świat

- `worldgenVersion` jest elementem zapisu i parametrem wejściowym workera. Stare światy używają bez zmian dawnych funkcji generacji i zablokowanych identyfikatorów. V18 rozszerza tylko nową gałąź.
- Przy `renderDistance=12` system planuje generację według dystansu do gracza; maksymalnie 12 nowych zgłoszeń worker w klatce. Pilnuje identyfikatorów już zgłoszonych, odrzuca przeterminowane wyniki i przelicza krawędzie siatek po dołączeniu sąsiednich chunków.
- `world-api.peekLoadedBlock()` służy tylko do budowania siatek (brak generowania chunków z wnętrza meshera); zwykłe `getBlock()` nadal udostępnia synchronizację dla mechanik wymagających obecności bloku.
- `render/held-block.js` koduje rośliny dwustronnie i oznacza kwiaty wagą wiatru 255; `voxel.vert.glsl` obraca je do `uCam.xz`, a inne rośliny mają niezależny ruch na wietrze.
- `world-api.js` i `scene.js` trzymają orientację mocowania pochodni jako wpis `torchMounts` z kluczem współrzędnych; format 22 jest migrowany w `save/migrations.js`.
- `ui/inventory.js` renderuje mapę odkryć z ograniczeniem częstotliwości, zapisanymi strukturami i przeciąganiem/przybliżaniem; nie generuje nowych chunków.
- `sim/mobs/navigation.js` planuje A* z dodatkowym kosztem zatłoczenia, a `predator-tactics.js` wyznacza odrębne cele flanki. Koszt obliczeń jest ograniczony do budżetu zapytań na klatkę.

**Ograniczenia:** WebGL1 i pamięć karty graficznej wyznaczają realne FPS przy 12 chunkach. Rust pozostaje niewłączony; walidacja GPU i Windows zależy od docelowej maszyny.

## V20: dynamic terrain sun-shadow + ecosystem AI

- `src/render/shadows.js`: 128×128 RGBA8 skyline texture covering 256×256 blocks around the player; updated in bounded batches (768 columns per frame) exclusively from loaded chunk buffers. No GPU extension, no extra 3D shadow pass or forced `ensureChunk`.
- `voxel.frag.glsl`: four hardcoded light-ray height probes + ambient fill. Provides approximate ground/canopy sun shadows. Not a full shadow map for overhangs, tiny props or creatures (those still use existing contact discs).
- `voxel.vert.glsl`: world-coordinate time-dependent foliage motion; no meshing or world simulation side effects.
- `src/render/leaves.js` + `src/sim/falling-trees.js`: canopy impact sparks and independent rotating leaves with bounded particle budgets.
- `src/sim/mobs/definitions.js` + `navigation.js`: daytime boars and an explicit wounded-herbivore flight state with remembered threat position, navigation and no idle pause.
- ID lock, old worldgen and IndexedDB schema unchanged. `tests/v20_features.mjs` covers the V20 invariants.

## V23 Multiplayer — niezależny transport WebSocket

- `multiplayer/server.cjs` jest osobnym serwerem Node.js (brak zależności npm). GitHub Pages nie uruchamia tego procesu.
- `src/net/multiplayer.js` instaluje transport do wspólnego `state` dopiero po inicjalizacji starej gry i renderera. Tryb solo pozostaje bez połączenia sieciowego.
- `setBlock` jest opakowany do przesyłania edycji; odbiór używa bezpośredniej aktualizacji już załadowanych chunków i mapy `edits`, nie generuje odległych chunków przy każdej wiadomości.
- Pokój: generacja V22, seed, zegar, maksymalnie 12 graczy, dziennik edycji 100k bloków. Snapshot historii dzielony na paczki. Serwer zapisuje plik pokoju przez atomowe rename.
- Obecnie tryb **co-op foundation**: synchronizuje postaci/czat/bloki, a nie wszystkie encje, skrzynie i walkę. Kolejny etap: autorytatywny serwer ECS dla zwierząt, mobów, ekwipunku, dropów i obrażeń, synchronizacja wysyłkowa tylko do pobliskich chunków.
- `MULTIPLAYER_INSTRUKCJA.md` wyjaśnia publiczne wdrożenie i ograniczenia nietrwałych dysków.

## V24 — adres ngrok / wspólny świat

`START_SERVER.bat` -> `multiplayer/server.cjs` (Node.js, WebSocket `/ws`, HTTP status).
`ngrok http 8787` -> publiczne HTTPS + WSS, ten sam serwer na hoście.
`src/net/multiplayer.js` -> `normalizeServerAddress()`, `join_public`, ładowanie historii
edycji bloków, synchronizacja awatarów, czat i lista XYZ pod TAB. Serwer utrzymuje
stały pokój `SHAREDXX` w `multiplayer/room-data/SHAREDXX.json`. Każdy klient
odtwarza teren z tego samego seeda, bez transmisji całych chunków. Warstwa
sieciowa nie zastępuje jeszcze lokalnej symulacji NPC/ekwipunków.


## V25 · Desktop / Electron

Zachowano natywne ES modules i strukturę V24. `electron/main.cjs` obsługuje tylko okno Chromium, uruchamia lokalny HTTP z plikami gry, zablokowany na `127.0.0.1`, a następnie `electron/preload.cjs` wystawia bezpieczne metody IPC hostowania. W rendererze NodeIntegration pozostaje wyłączone, contextIsolation i sandbox pozostają włączone. `electron/host-service.cjs` jest testowalny przez zwykły Node, uruchamia `multiplayer/server.cjs` przez child process i opcjonalnie ngrok. W aplikacji spakowanej multiplayer/server.cjs jest kopią `extraResources` obok app.asar, a jego stan znajduje się w katalogu Electron userData, nie w plikach programu.

Strona offline korzysta z pamięci IndexedDB osobnego profilu aplikacji. Lokalny origin HTTP ma stały port 8177 (jeśli jest zajęty, aplikacja uruchamia inną lokalną instancję i informuje w logu). Wersje dla GitHub Pages i START_WINDOWS.bat wciąż są dostępne. W V25 nie został przeniesiony PvE na serwer; synchroniczne są tylko istniejące w V24 części protokołu.


## NightCraft V26 · rozdzielenie osady od starej generacji

`src/world/village-worldgen.js` zawiera czyste funkcje wybierania wyspy, kształtu terenu, wyznaczania zabudowy i niezależnego stampowania chunków. Nowy algorytm włącza się tylko przy `worldgenVersion >= 26`. `src/world/worker/world-worker.js` dostaje ten sam `villagePlan` co główny wątek, więc budynki nie powinny przecinać się na granicach chunków. Zachowane są ID wszystkich istniejących 95 bloków; nowe projekty budowlane są wyłącznie przedmiotami w JSON.

`src/sim/village.js` zawiera symulację mieszkańców, rajd nocny, automatyczne prace w osadzie, strażników i materiały konstrukcyjne. Każdy prefabrykat to wieloblokowa zmiana w tym samym world API; lokalne edycje i lista domów są zapisywane. `src/ui/village-ui.js` i `styles-village.css` zawierają niezależne UI dziennika/ warsztatu. Grafiki księgi to statyczne SVG w `assets/illustrations`, także do offline i Pages.

`src/net/multiplayer.js` wysyła prefabrykaty zbiorczo; `multiplayer/server.cjs` sprawdza liczbę, współrzędne i typy bloków, zapisuje edycje i rozsyła je współgraczom. **Serwer nie zarządza jeszcze AI osadników, zdarzeniami najazdu ani stanem surowców osady.** Te mechaniki pozostają symulacją lokalną. Niezależne testy: `tests/v26_village.mjs`, `tests/v26_network.mjs`.
