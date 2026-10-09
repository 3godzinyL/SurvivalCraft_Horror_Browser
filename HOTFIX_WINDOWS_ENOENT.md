# NightCraft V25.1 — poprawka budowania EXE na Windows

## Przyczyna błędu z Twojego logu

Test `tests/ngrok_direct_join.mjs` konwertował URL pliku przez `.pathname`, co na Windows tworzy ścieżkę `/C:/...` zamiast poprawnej ścieżki systemowej `C:\...`. Taki niepoprawny *katalog roboczy procesu* powodował błąd `spawn C:\Program Files\nodejs\node.exe ENOENT`. To nie oznacza, że instalacja Node.js była uszkodzona. Poprzednie testy zdążyły użyć Node.js poprawnie.

## Poprawione

- Test korzysta z `fileURLToPath(new URL(...))` i z absolutnej ścieżki do `multiplayer/server.cjs`.
- Test `windows_spawn_paths.mjs` wykrywa cofnięcie tej poprawki.
- Przy błędzie uruchamiania test pokazuje rzeczywisty `cwd` i ścieżkę Node zamiast nieobsłużonego zdarzenia `error`.
- `BUILD_WINDOWS_EXE.bat` wyraźnie odróżnia błąd npm, testów i budowy EXE.

## Uruchamianie

1. Rozpakuj całą paczkę do osobnego folderu; najlepiej nie nakładaj jej na stare pliki V25.
2. Uruchom `BUILD_WINDOWS_EXE.bat`.
3. Gdy testy przejdą, skrypt automatycznie odpali `electron-builder`.
4. Gotowy EXE pojawi się w `dist-desktop` po pomyślnym zakończeniu buildu.

To pełny projekt źródłowy, nie gotowy plik EXE. Build Windows/Chromium należy wykonać na komputerze Windows lub w GitHub Actions.
