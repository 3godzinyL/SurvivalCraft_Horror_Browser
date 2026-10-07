# NightCraft V10 — 3×3 Inventory Crafting + URP-like Visual Pass

V10 replaces the old 2×2 crafting grid with a full 3×3 grid directly inside the player inventory. Recipes are now spatial/shaped in the Minecraft style (including mirrored axe/stair layouts), there is no separate crafting-table requirement, and the recipe book lays the real shape into the grid instead of bypassing it. The renderer also gets a lightweight URP-inspired pass: moving cloud-light modulation, cooler color grading, stronger hemispheric face lighting, and soft layered contact shadows under creatures and dropped items.

# NightCraft: Cold Forest — V9

Samodzielny voxel survival-horror do uruchomienia w przeglądarce. V9 jest dużym pass-em jakościowym skupionym na fizyce gracza po odrodzeniu, zachowaniu inventory/craftingu, tempie kopania, feedbacku niszczenia, fizycznych dropach oraz pełniejszym systemie audio materiałów.

## Uruchomienie

Windows: uruchom `START_WINDOWS.bat`.

Ręcznie:

1. `node server.js`
2. wejdź na `http://127.0.0.1:8177`

Dźwięk w nowoczesnej przeglądarce zostaje odblokowany po pierwszym kliknięciu/klawiszu.

## V9 — najważniejsze poprawki

### Respawn i kolizje

- usunięty został błąd w bazowym teście AABB, przez który podłoże mogło być liczone jako kolizja całego gracza;
- respawn ładuje obszar wokół zapamiętanego punktu startowego i szuka faktycznie wolnej kapsuły dla całego modelu gracza;
- jeśli okolica spawnu została zabudowana, wybierane jest najbliższe bezpieczne miejsce;
- awaryjny resolver potrafi oczyścić kieszeń spawnu zamiast zostawić gracza zakleszczonego;
- test V9 celowo blokuje pierwotny spawn, respawnuje gracza, sprawdza brak kolizji i wykonuje realny mikro-ruch po respawnie.

### Crafting / inventory

- receptury 2×2 nie wymagają już identycznej liczby sztuk w stacku; przykładowo stack `5× drewno` poprawnie pokazuje recepturę `1× drewno -> 4× deski`;
- pojedyncze craftowanie zużywa tylko jedną porcję receptury i zostawia resztę stacka;
- Shift na wyniku craftuje maksymalną możliwą liczbę partii ograniczoną materiałami i miejscem w inventory;
- PPM dzieli stack, a PPM-przeciąganie rozkłada po jednej sztuce po kolejnych slotach;
- Shift+klik przy przenoszeniu inventory <-> hotbar najpierw uzupełnia istniejące stacki, dopiero potem zajmuje puste sloty;
- dodawanie przedmiotów jest atomowe: brak miejsca nie powoduje częściowego dodania i utraty/duplikacji;
- slot wejściowy pieca przyjmuje tylko rzeczy z receptur przepalania, paliwo tylko prawdziwe paliwo, a output nie przyjmuje ręcznie wkładanych itemów.

### Balans kopania

Drewniane narzędzia zostały spowolnione:

- drewniany kilof: `1.30`,
- drewniana siekiera: `1.28`,
- drewniana łopata: `1.42`.

Właściwe narzędzie nadal daje wyraźną przewagę, ale drewniany start nie topi terenu w absurdalnym tempie. Każdy zwykły blok pozostaje możliwy do wykopania niewłaściwym narzędziem lub ręką — trwa to po prostu dłużej.

### Niszczenie bloków

- pęknięcia pojawiają się praktycznie od początku (`>0.1%` progresu), nie dopiero pod koniec;
- wczesny etap cracków jest celowo mocniej widoczny dzięki nieliniowej krzywej;
- przy zmianie celu timer odłamków jest zerowany, więc pierwszy odprysk pojawia się od razu;
- cząsteczki korzystają z rodziny materiału bloku i mają różne kolory;
- po zniszczeniu blok NIE teleportuje się już bezpośrednio do inventory.

### Fizyczne dropy jak w voxel survivalu

Wykopany blok:

- wyskakuje z bloku z prędkością początkową,
- spada z grawitacją,
- odbija się od ziemi,
- obraca się i delikatnie bobbuje,
- po krótkim opóźnieniu jest przyciągany do gracza,
- odtwarza osobny pickup sound,
- jeśli inventory jest pełne, pozostała część stacka zostaje na ziemi,
- pobliskie stacki tego samego itemu mogą się łączyć,
- dropy są zapisywane razem ze światem.

Loot z rozbitej skrzyni, pieca oraz dropy części mobów również korzystają z tego systemu.

### Audio V9

System nie używa już jednego ogólnego odgłosu kamienia/drewna dla większości świata. V9 generuje i ładuje 16 rodzin materiałowych:

`grass`, `dirt`, `mud`, `clay`, `stone`, `cobble`, `brick`, `wood`, `plank`, `sand`, `snow`, `gravel`, `leaves`, `glass`, `metal`, `ore`.

Dla każdej rodziny są:

- 2 warianty `hit`,
- 2 warianty `break`,
- 2 warianty `place`,
- 2 warianty kroków.

To daje **128 material-specific WAV** tylko dla interakcji z blokami/podłożem, plus pickup i pozostałe ambienty/efekty z wcześniejszych wersji. Pnie i deski brzmią inaczej, bruk inaczej od gładkiego kamienia, cegły inaczej od skały, błoto inaczej od ziemi itd.

Wszystkie nowe sample są lokalnymi, oryginalnie syntetyzowanymi assetami tego projektu.

## Zachowane systemy

V9 zachowuje systemy V8/V7: pełny piec i przetapianie żelaza/złota/szkła/kamienia, węgiel/żelazo/złoto w świecie, crafting metalowych narzędzi, 6-poziomowe fortyfikacje niszczone przez agresywne stworzenia, drzwi/schody/płoty z własnymi kolizjami, pełnoekranową mapę `M`, licznik dystansu, starter chest, proceduralne ruiny, jaskinie/mineshafty, pogodę, noc, threat/stress, minimapę, ptaki, zwierzęta, horror mobs, pochodnie i zapis świata.

## Testy

Najważniejszy test V9:

`node tests/runtime_smoke_v9.js`

Wykonuje prawdziwy `src/game.js` w kontrolowanym harnessie DOM/WebGL i sprawdza zarówno regresję V8, jak i nowe zachowania V9, w tym:

- bezpieczny respawn bez kolizji,
- możliwość ruchu po respawnie,
- crafting z nadmiarowym stackiem,
- fizyczny drop i pickup,
- wolniejsze drewniane narzędzia,
- wczesne pęknięcia/odłamki,
- 128 material-specific plików audio,
- przepalanie, rudy, fortyfikacje, drzwi/schody/płoty, inventory, ruiny, mapę i starsze systemy.

`tests/generate_block_audio_v9.py` jest źródłem generatora nowych efektów materiałowych.
