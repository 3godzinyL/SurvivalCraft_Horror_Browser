# NightCraft — Cold Forest V15.1 · modular architecture

Pełna przeglądarkowa gra survival-horror oparta na WebGL1, bez bundlera. V15 przenosi runtime z jednego pliku `game.js` do **31 modułów ES**, dodaje deklaratywne dane, worker chunków, testy zgodności V14, zapis IndexedDB i poprawia AI/starter kit. Wszystkie istniejące światy bazują na **tych samych numerach bloków**.

## Uruchomienie (Windows / Windows Server)

1. Rozpakuj **cały** ZIP.
2. Uruchom `START_WINDOWS.bat` **z rozpakowanego folderu**, a nie z podglądu archiwum ZIP. Nie trzeba uruchamiać jako administrator.
3. Launcher wybierze automatycznie **Node.js 20+** (zalecany) albo wbudowany w Windows **PowerShell 5.1** (awaryjny serwer HTTP, nie wymaga instalacji Node). Nie trzeba `npm install` ani Rust.
4. Przeglądarka sama otworzy `http://127.0.0.1:8177/` po uruchomieniu serwera. Jeśli przeglądarka się nie otworzy, wklej adres ręcznie. **Pozostaw okno serwera otwarte podczas gry.**

Alternatywnie: `node server.cjs` albo `npm start`. W razie problemu otwórz `DIAGNOSTYKA_WINDOWS.bat`. Błędy serwera i launchera są zapisywane w `logs/server.log` i `logs/launcher.log` (powstają przy starcie). Jeśli port 8177 jest zajęty, zamknij poprzedni serwer. **Nie otwieraj `index.html` przez `file://`**, bo natywne moduły, worker, shadery i dane wymagają serwera HTTP. Dźwięk odblokowuje pierwszy gest użytkownika.

## Nowości w V15

- **Dwa różne, losowane skórzane elementy zbroi od razu założone** (hełm, pancerz, spodnie lub buty) z własnym początkowym zużyciem. Losowanie jest deterministyczne względem seeda. Każde z czterech startowych drewnianych narzędzi też ma inne zużycie i stopniowo je traci przy działaniu.
- **AI wilków i pozostałych mobów**: poprawka martwego zakrętu; bez wymuszonego obracania o ~140° przy braku drogi. Zatrzymanie, replanning A*, sprawdzanie wysokości stopnia, skok tylko przy możliwym wejściu. Test obejmuje zamknięty korytarz i skok na blok.
- **World streaming**: natywny worker ES generujący chunki JS, z przekazywaniem `ArrayBuffer`, kontrolą tokenu seeda, deduplikacją żądań, nakładaniem zapisanych edycji na wynik i awaryjną synchroniczną generacją. Wynik identyczny z V14 dla 9 chunków / 3 seedów (SHA-256 pełnych 24 576 bajtów każdego chunka).
- **Dane:** JSON dla bloków, itemów, craftingów, mobów, biomów, ruin, audio i lokalizacji PL. `data/ids.lock` blokuje zmianę istniejących ID. Meta bloków JS: solid / transparent / decor / top / side / bottom.
- **Render:** dwa programy WebGL mają źródła w czterech plikach `.glsl`; atlas pozostaje proceduralny, a `data/texture-overrides.json` pozwala podstawić PNG o danej nazwie `tile_NNN` bez zmiany indeksu/ID.
- **Zapis:** IndexedDB (`nightcraft-worlds`), kolejkowanie transakcji, import starych kluczy localStorage, migracje V7/V14 do wersji 19 bez zmiany edycji świata ani numerów bloków.
- **Rdzenny Rust:** prawdziwe pliki `Cargo.toml`, `crates/world-core/src/lib.rs`, `world-wasm` z eksportami `init`, `generate_chunk`, `mesh_chunk`; packed mesh 32-bit, 3D AO i flood-fill oświetlenia, testy jednostkowe w źródle.

## Ważne ograniczenie dotyczące Rust/WASM

**W tej paczce nie ma skompilowanego `.wasm`.** W środowisku budowania nie było `cargo`/`rustc` i nie mogłem ich pobrać ani wykonać `cargo test`. Rustowy generator jest na razie **eksperymentalnym szkieletem**, nie odtwarza jeszcze dokładnie generatora V14. Dlatego nie jest włączony w rozgrywce. Grę obsługuje sprawdzony golden-testami **generator JS w workerze**; w razie braku workerów działa synchroniczny JS. Nie wolno przełączyć świata na eksperymentalny Rust worldgen bez identycznych golden hashy, bo zepsuje to istniejące światy. Polecenie `tools/build-wasm.sh` na maszynie z Rust buduje prototyp; samo skompilowanie **nie aktywuje** go automatycznie.

Oznacza to, że podział projektu, JSON-y, shadery, worker, AI i IndexedDB są zaimplementowane, ale **pełny produkcyjny port worldgen+mesh pipeline do WASM i renderingu wierzchołków spakowanych nie jest jeszcze skończony**. Zobacz `ARCHITECTURE.md`.

## Testy

`npm run check` (Node.js, bez zależności z npm):

- kontrola składni modułów;
- spójność ID, danych, receptur, nazw, plików audio;
- głębokie porównanie definicji bloków / itemów / receptur / mobów z V14;
- **9 deterministycznych hashy chunków** z 3 seedów V14;
- roundtrip workera, transfer, odrzucenie starego seeda, edycje świata;
- nawigacja moba: zamknięty korytarz i skok przez jeden blok;
- migracja zapisów V7/V14, zgodność edycji oraz ekwipunku;
- kontrola launchera i HTTP serwera dla plików JS/GLSL/JSON/audio.

Dodatkowo przetestowano start gry w Chromium z zastępczym WebGL (weryfikacja HUD/startowego wyposażenia), lecz nie było możliwości pełnego testu grafiki na GPU ani uruchomienia bezpośrednich modułów HTTP w zablokowanym środowisku przeglądarki.

## Sterowanie i wcześniejsze systemy

WASD — ruch · Spacja — skok/pływanie · Shift — sprint · Ctrl — skradaj · LPM — kop/atak · PPM — użyj/stawiaj · E — ekwipunek/crafting · X — skan X-Ray (od poziomu 1) · 1–9 — hotbar · M — mapa · Esc — pauza · F3 — debug.

Zachowano deszcz z kolizjami i rozbryzgami, ambient i grzmoty, skrzynie i ruiny, dwuslotowy śpiwór, głód, crafting, pancerz, dropy mobów, wilcze zmysły, system poziomów i radar z HUD trwałości pancerza.

## Eksport atlasu

Po uruchomieniu serwera otwórz `http://127.0.0.1:8177/tools/bake-atlas.html`, a następnie kliknij **Zapisz atlas PNG**. Narzędzie działa w przeglądarce, więc nie wymaga osobnego pakietu canvas dla Node.

## Naprawa startu w V15.1

W V15 plik `.bat` otwierał osobne okno (`start ... cmd /k`) i sam kończył działanie, więc użytkownik nie widział błędów uruchomienia. W V15.1 serwer działa na pierwszym planie w tym samym oknie, a zakończenie działania wymaga potwierdzenia klawiszem. Jeśli brakuje Node 20+, serwer wystartuje przez PowerShell (`tools/serve-windows.ps1`), obsługując moduły ES, shadery, JSON, audio i żądania zakresowe WAV.

**Uwagi:** serwer PowerShell działa lokalnie tylko na `127.0.0.1` i może być wolniejszy od Node. Weryfikacja skryptów PowerShell na Windows musi zostać wykonana na komputerze z Windows; w środowisku testowym dostępny był tylko Node na Linux. Niezmienne pozostają światy, identyfikatory bloków, wszystkie dane gry i logika rozgrywki.
