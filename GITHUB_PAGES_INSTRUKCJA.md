> **V24:** GitHub Pages publikuje tylko klienta. Serwer uruchamiaj z `START_SERVER.bat` na komputerze hosta, z tunelem `ngrok http 8787`; instrukcja: [NGROK_INSTRUKCJA.md](NGROK_INSTRUKCJA.md). Odwiedzający wkleja adres HTTPS do START ONLINE.

# NIGHTCRAFT V22 — publikacja gry na GitHub Pages

Ta paczka zawiera **jednocześnie** pełną grę działającą lokalnie na Windows i gotową konfigurację publikacji przez GitHub Actions. Nie potrzeba hostingu Node.js ani własnego VPS. **Każdy odwiedzający generuje i zapisuje osobny świat w swojej przeglądarce (IndexedDB)** — to gra jednoosobowa, bez kont i bez synchronizacji między urządzeniami.

## NAJPROŚCIEJ: GitHub Desktop (Windows)

1. **Rozpakuj ZIP** do normalnego katalogu, np. `C:\Gry\NightCraft`. W tym katalogu musisz widzieć bezpośrednio `index.html`, `START_WINDOWS.bat`, `src`, `assets`, `data` i `.github`. Nie wgrywaj samego ZIP-a na GitHub — GitHub Pages nie uruchomi gry z ZIP-a.
2. Zaloguj się do [GitHub](https://github.com) i otwórz [GitHub Desktop](https://desktop.github.com/).
3. W GitHub Desktop wybierz **File → Add local repository**, wskaż rozpakowany folder. Jeśli Desktop zaproponuje **Create a repository here**, kliknij to. Nazwij repo np. `nightcraft`.
4. Kliknij **Publish repository**, wybierz **Public** (na bezpłatnym GitHub Pages najprościej jest użyć publicznego repozytorium). Po publikacji odczekaj na wysłanie plików.
5. Otwórz repozytorium na GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. Otwórz zakładkę **Actions**: workflow `Publish NightCraft to GitHub Pages` uruchomi walidację, testy, skopiuje potrzebne pliki i wdroży stronę. Jeśli akcja uruchomiła się przed włączeniem Pages i zakończyła błędem, otwórz ją i wybierz **Re-run jobs** lub **Run workflow**.
7. Gotowy link będzie widoczny w **Settings → Pages**. Zazwyczaj: `https://TWOJ_LOGIN.github.io/nightcraft/`.

**WAŻNE:** W repozytorium `index.html` musi znajdować się bezpośrednio w katalogu głównym, nie w dodatkowym katalogu `NightCraft_V22_FULL/`. Projekt ma gotowy workflow `.github/workflows/deploy-pages.yml`. Nie wybieraj „Deploy from a branch”, gdy korzystasz z tego workflow.

## ALTERNATYWA: terminal / Git (bez Desktop)

1. Na GitHub utwórz **nowe publiczne, puste repozytorium** (bez automatycznego README), np. `nightcraft`.
2. Otwórz terminal w katalogu rozpakowanej gry i wykonaj:

```powershell
git init -b main
git add .
git commit -m "NightCraft V23 - przegladarka i GitHub Pages"
git remote add origin https://github.com/TWOJ_LOGIN/nightcraft.git
git push -u origin main
```

3. Włącz **Settings → Pages → Source: GitHub Actions**. Po zielonym wyniku workflow wejdź pod publiczny adres Pages.

## Jak to działa?

- **Lokalnie:** `START_WINDOWS.bat` uruchamia serwer pod `http://127.0.0.1:8177/`. Działa nadal także fallback PowerShell bez Node.js.
- **Publicznie:** GitHub Actions uruchamia `npm run check`, `npm run pages:build` i `npm run pages:test`, a następnie publikuje **tylko statyczną zawartość** `dist-pages/`: moduły JavaScript, shadery, JSON-y, CSS, tekstury, audio i HTML. U odbiorcy gra działa w Chromium/Firefox/Edge z WebGL.
- **Przykład URL:** zarówno `https://TWOJ_LOGIN.github.io/nightcraft/`, jak i instalacja w katalogu głównym `https://TWOJ_LOGIN.github.io/` są obsługiwane bez ręcznego ustawiania adresów.
- **Zapisy:** IndexedDB przechowuje świat osobno dla **każdego profilu przeglądarki i originu**. Różni ludzie mają oddzielne gry. Dwa repozytoria w tym samym `username.github.io` używają różnych kluczy zapisu. Dane lokalne (`127.0.0.1:8177`) i Pages mają **osobne** zapisy — nie kopiują się automatycznie.
- **Prywatność:** zapisy nie trafiają do Twojego repozytorium ani na serwer GitHub. Skasowanie danych strony, użycie incognito lub zmiana urządzenia może usunąć lub ukryć świat. Nie ma synchronizacji w chmurze ani multiplayera.
- **Zasięg:** duży render distance (12 chunków) jest obciążający, dlatego na słabszym laptopie warto ustawić niższą wartość.
- **Repozytorium jest publiczne:** źródła JS, definicje gry i assety są widoczne. Nie wkładaj tam prywatnych kluczy, haseł ani innych sekretów.

## Aktualizacja strony

Po modyfikacji plików: w GitHub Desktop kliknij `Commit to main` → `Push origin`. GitHub Actions automatycznie opublikuje nową wersję. W terminalu: `git add . && git commit -m "Aktualizacja gry" && git push`.

## Jeśli strona nie startuje

1. **Actions → workflow**: sprawdź błędy w krokach testów lub publikacji.
2. **Settings → Pages**: upewnij się, że Source to `GitHub Actions`.
3. **404 na `data/`, `src/`, GLSL lub CSS**: `index.html` musi leżeć w katalogu głównym repozytorium, nie w dodatkowym folderze; `src`, `data` i `assets` muszą być wrzucone w całości.
4. **Czarny ekran/WebGL:** uruchom stronę na aktualnym desktopowym Chrome/Edge/Firefox z WebGL oraz włączoną akceleracją GPU.
5. **Pusta Kontynuacja:** na innym urządzeniu/profilu (lub pod innym originem) nie ma jeszcze zapisu. Kliknij `NOWY ŚWIAT`.
6. **Zmieniasz nazwę repozytorium?** URL i izolowany klucz IndexedDB się zmienią. Zapis nie przeniesie się automatycznie.

## Kontrola paczki przed publikacją (opcjonalna)

Z zainstalowanym Node.js 20+ w folderze gry wykonaj:

```powershell
npm run check
npm run pages:build
npm run pages:test
```

To przeprowadza testy silnika i sprawdza, że wszystkie wymagane pliki są dostępne także spod `/nightcraft/`. Kompilacja Rust/WASM nie jest wymagana: aktywna gra używa JS i workera.
