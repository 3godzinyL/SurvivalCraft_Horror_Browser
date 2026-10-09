# NightCraft Cold Forest · V25 — Desktop + multiplayer ngrok

## Główna wersja: Windows EXE z własnym Chromium

- **`BUILD_WINDOWS_EXE.bat`**: pobiera zależności na Windows i generuje przenośny plik EXE w `dist-desktop/`. Wymagany Node.js 20+ **tylko podczas budowania**, nie u gracza.
- **`.github/workflows/windows-desktop.yml`**: alternatywnie automatycznie buduje ten sam EXE na GitHub Actions (Windows). Wystarczy udostępnić projekt w repozytorium i pobrać artefakt z Actions.
- **`START_DESKTOP_DEV.bat`**: uruchomienie programistyczne przez Electron bez generowania EXE (wymaga npm i Internetu przy pierwszym uruchomieniu).
- **`DESKTOP_I_NGROK_INSTRUKCJA.md`**: pełna instrukcja hostowania z menu i dołączania po adresie ngrok.

## Menu desktop

**START OFFLINE**, **KONTYNUUJ OFFLINE**, **HOSTUJ GRĘ**, **DOŁĄCZ DO GRY**. Hostowanie uruchamia prywatny serwer Node w procesie pomocniczym bez dodatkowego terminala. Jeśli ngrok jest zainstalowany i skonfigurowany, aplikacja spróbuje wystartować tunel; w przeciwnym razie pokaże komendę z aktualnym portem. Host wpisuje lub kopiuje HTTPS ngroka, inni gracze wklejają go do menu. TAB: nicki i koordynaty. Host utrzymuje zapis współdzielonych bloków na swoim dysku.

**To nie jest jeszcze pełna synchronizacja AI, przedmiotów ani obrażeń PvE** — pozostała logika V24. Różnice w wydajności GPU nadal mogą wystąpić, ale wszystkie desktopowe kopie korzystają z tego samego Chromium.

## Pozostałe tryby

- `START_WINDOWS.bat`: dotychczasowy lokalny serwer i zwykła przeglądarka (bez zmian).
- `START_SERVER.bat`: ręczne uruchamianie serwera na Node bez Electrona (opcjonalne).
- GitHub Pages: statyczna wersja dla osób chcących grać w przeglądarce, nadal bez możliwości hostowania samego serwera na Pages.

## Struktura i testy

`electron/main.cjs` — okno Chromium i zabezpieczony IPC; `electron/preload.cjs` — wąski most do uruchamiania hosta; `electron/host-service.cjs` — start serwera i tunelu; `electron/static-server.cjs` — lokalne zasoby gry; `src/ui/desktop-host.js` — menu. `src/net/multiplayer.js` i `multiplayer/server.cjs` — istniejący protokół co-op.

`npm run check` uruchamia wszystkie testy V14–V24 i nowy test hostowania V25.

**Ważne:** dostarczany ZIP jest kompletnym projektem źródłowym, a nie już skompilowanym EXE. Środowisko tworzenia paczki nie ma dostępu do binariów Electron/npm. Po uruchomieniu workflow w GitHub Actions otrzymasz jeden przenośny Windows EXE do wysłania znajomym.

## Hotfix V25.1 – Windows ENOENT podczas budowania

Naprawiono niepoprawne użycie `URL.pathname` jako katalogu roboczego w teście `ngrok_direct_join`. Na Windows ścieżka `/C:/...` powodowała błąd `spawn ... ENOENT` po zaliczeniu wcześniejszych testów. Test używa teraz `fileURLToPath`, bezpiecznej absolutnej ścieżki do serwera i przechwytuje błąd startu procesu. Dodano test regresyjny `windows_spawn_paths.mjs`.

Aby utworzyć EXE, uruchom `BUILD_WINDOWS_EXE.bat` w rozpakowanym folderze; program wynikowy znajduje się w `dist-desktop`.

## Hotfix V25.2 – zapis hosta Windows i stabilne testy

Na Windows `ChildProcess.kill()` może natychmiast zakończyć proces Node bez uruchomienia procedury `SIGTERM`. Wtedy zmiana bloku przesłana do drugiego gracza niekoniecznie była zapisana w `SHAREDXX.json`, a `tests/desktop_host.mjs` zatrzymywał budowanie EXE. W V25.2 Electron wysyła lokalne, uwierzytelnione żądanie zamknięcia, czeka na zapis wszystkich pokojów i dopiero potem kończy proces. Sekret żądania jest losowy i nie jest dostępny z menu gry ani publicznego tunelu.

Test hosta buforuje teraz wiadomości WebSocket (bez gubienia szybkiego `ready`) i sprawdza zakończenie hosta **przy nadal podłączonych graczach** oraz odczyt zmian po ponownym uruchomieniu. Raport: `TEST_REPORT_V25_2.txt`. Szczegóły: `HOTFIX_WINDOWS_HOST_SAVE.md`.
