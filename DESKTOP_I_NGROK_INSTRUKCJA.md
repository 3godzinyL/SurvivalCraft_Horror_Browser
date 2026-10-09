# NightCraft V25 — własne okno gry + serwer przez ngrok

## Jak uzyskać pojedynczy EXE (Windows 10/11 x64)

**Najłatwiej bez instalowania czegokolwiek lokalnie:** wrzuć ROZPAKOWANY projekt na GitHub, przejdź do **Actions → Build NightCraft Windows EXE → Run workflow**. Po ukończeniu wejdź do ukończonego przebiegu i pobierz artefakt **NightCraft-V25-Windows-EXE**, a następnie rozpakuj go. W środku jest `NightCraft_V25_Desktop_25.0.0_Windows_x64.exe`. Taki EXE zawiera Chromium/Electron i nie wymaga Node.js u znajomych. Plik jest zwykłym portable EXE, a nie instalatorem. Windows SmartScreen może pokazać ostrzeżenie dla niepodpisanego pliku.

**Budowanie na swoim Windows:** zainstaluj Node.js 20+, uruchom `BUILD_WINDOWS_EXE.bat` z rozpakowanego projektu. Skrypt zainstaluje wersję Electron z `package.json`, uruchomi testy i wygeneruje EXE w `dist-desktop/`. Wymagany dostęp do npm / GitHub. Do szybkiego testu bez tworzenia EXE: `START_DESKTOP_DEV.bat`.

**Uwaga:** archiwum źródłowe nie zawiera już skompilowanego Windows EXE, ponieważ środowisko tworzenia paczki nie ma binariów Electrona ani dostępu do rejestru npm. Workflow GitHub Actions buduje rzeczywisty binarny EXE na Windows.

## Hostowanie

1. Uruchom EXE, wybierz **HOSTUJ GRĘ**.
2. Możesz podać seed. Przy istniejącym świecie zostanie użyty zapisany seed.
3. Jeśli masz `ngrok.exe` z tokenem skonfigurowanym komendą `ngrok config add-authtoken ...`, zaznacz **automatyczne uruchamianie ngroka**. Aplikacja uruchamia własny serwer multiplayer, a następnie próbuje utworzyć tunel i znaleźć jego HTTPS w lokalnym API ngroka.
4. Jeśli ngrok nie jest dostępny w PATH, uruchom go samodzielnie w konsoli poleceniem **`ngrok http PORT`**, gdzie PORT wyświetla menu hosta. Wklej otrzymany adres `https://...ngrok-free.app` i kliknij **ZAPISZ LINK**. To pole zapisuje adres do udostępnienia — nie aktywuje automatycznie tunelu.
5. Wyślij znajomym link HTTPS i kliknij **START GRY NA HOŚCIE**. Ty łączysz się z serwerem lokalnie; znajomi przez ngrok.
6. Gdy zamkniesz EXE albo klikniesz **ZATRZYMAJ SERWER**, host przestaje działać i wszyscy tracą połączenie. Nie wyłączaj aplikacji w trakcie gry.

## Dołączanie

Znajomy uruchamia swój EXE, klika **DOŁĄCZ DO GRY**, podaje nick oraz adres HTTPS ngrok, następnie **START · DOŁĄCZ** i **WEJDŹ DO GRY**. Pod przytrzymanym **Tab** widzi wszystkich graczy i ich współrzędne. Wszystkim potrzeba tej samej wersji V25.

## Gdzie są światy?

Host zapisuje wspólny teren w `AppData/Roaming/nightcraft-cold-forest/host-world/` (rzeczywista nazwa katalogu może zależeć od Electron). Nie usuwaj tego folderu, jeśli chcesz zachować multiplayer. Zapis prywatnego świata solo jest w profilu Chromium aplikacji Electron, osobnym od dotychczasowej Opery/Chrome. Przejście z przeglądarki na desktop **nie przenosi automatycznie starego lokalnego zapisu**.

## Techniczne granice multiplayera

W V25 synchronizowane są: seed, blokowe edycje świata, pozycje, kierunki, czas, czat, gracze pod Tab. **AI przeciwników, ekwipunki, loot i wspólna walka PvE nie mają jeszcze autorytatywnej synchronizacji serwerowej.** To nadal kooperacyjna wersja V24, a nie pełna gra MMO. Nie ma kont, własnego systemu szyfrowania ani zabezpieczenia hosta przed złośliwymi graczami. Udostępniaj adres tylko zaufanym osobom.

Nie trzeba stawiać osobno `START_SERVER.bat`, gdy hostujesz z desktopowego menu. `START_WINDOWS.bat` pozostaje działającym trybem przeglądarkowym. GitHub Pages nadal obsługuje klienta statycznego, ale nie może uruchamiać serwera multiplayer.

## Hotfix V25.1 – Windows ENOENT podczas budowania

Naprawiono niepoprawne użycie `URL.pathname` jako katalogu roboczego w teście `ngrok_direct_join`. Na Windows ścieżka `/C:/...` powodowała błąd `spawn ... ENOENT` po zaliczeniu wcześniejszych testów. Test używa teraz `fileURLToPath`, bezpiecznej absolutnej ścieżki do serwera i przechwytuje błąd startu procesu. Dodano test regresyjny `windows_spawn_paths.mjs`.

Aby utworzyć EXE, uruchom `BUILD_WINDOWS_EXE.bat` w rozpakowanym folderze; program wynikowy znajduje się w `dist-desktop`.
