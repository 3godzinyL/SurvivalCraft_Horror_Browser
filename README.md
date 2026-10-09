# NightCraft Cold Forest — V35.1

Pełny projekt aktualnej wersji: źródła, zasoby, testy, gotowa gra Windows i statyczna wersja przeglądarkowa.

## Uruchomienie

- Windows: `dist-desktop/NightCraft_V35_1_Desktop_35.1.0_Windows_x64.exe`. Nie wymaga instalowania Node.js.
- Przeglądarka lokalna: `START_WINDOWS.bat` lub `npm start`, następnie http://127.0.0.1:8177.
- Programowanie: `npm ci`, następnie `npm run desktop` albo `npm start`. Wymagany Node.js 20+.
- Budowanie EXE: `BUILD_WINDOWS_EXE.bat` lub `npm run desktop:win` po instalacji zależności.
- GitHub Pages: `npm run pages:build`, `npm run pages:test`; gotowe pliki znajdują się w `dist-pages/`. Szczegóły: [instrukcja Pages](GITHUB_PAGES_INSTRUKCJA.md).

## Grafika i sterowanie

Domyślny zasięg to 12 chunków, ustawienia grafiki pozwalają zwiększyć go do 24. Przytrzymanie C przybliża widok. Domyślny seed nowych światów: `hollow-pines-317`.

V35.1 zachowuje ostre tekstury z bliska i filtrowanie odległych materiałów, dodaje nieregularne prześwity liści oraz synchronizuje odbicia wody z ruchem kamery. Szczegóły i wyniki w [raporcie aktualnej wersji](V35_1_OSTROSC_I_ODBICIA_PL.md).

Księga w grze opisuje rozgrywkę. G otwiera misje, V warsztat osady, M mapę szlaku. Prawy przycisk myszy stawia wybrany blok lub prefabrykat.

## Multiplayer

Menu desktop pozwala hostować grę i dołączać do hosta. Instrukcja: [desktop i ngrok](DESKTOP_I_NGROK_INSTRUKCJA.md). Osobny serwer: `npm run multiplayer`.

Synchronizowane są gracze i wspólne zmiany świata. AI, przedmioty i obrażenia PvE nie mają jeszcze pełnej synchronizacji. GitHub Pages udostępnia klienta, serwer multiplayer wymaga osobnego hosta.

## Sprawdzenie projektu

`npm run check` uruchamia testy modułów, danych, generatora, migracji zapisów, mechanik, grafiki, multiplayer i hosta. Historyczne numery w nazwach testów oznaczają nadal potrzebne testy regresyjne.

Archiwum nie zawiera `node_modules`, prywatnych zapisów, logów, starych instalatorów ani roboczych katalogów budowania. `package-lock.json` umożliwia odtworzenie zależności przez `npm ci`.
