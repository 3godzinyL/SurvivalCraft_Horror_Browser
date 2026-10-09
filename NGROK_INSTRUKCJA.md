# NightCraft V24 — hosting przez ngrok HTTP

## Host — Windows

1. Rozpakuj cały ZIP. Zainstaluj **Node.js 20+** z https://nodejs.org/ .
2. Zainstaluj **ngrok** ze strony https://ngrok.com/download i skonfiguruj konto/authtoken zgodnie z instrukcją ngroka.
3. Uruchom `START_SERVER.bat`. Wybierz uruchomienie `ngrok http 8787`, jeśli `ngrok.exe` jest dostępny w `PATH`. W przeciwnym wypadku otwórz inne okno terminala i wpisz `ngrok http 8787` ręcznie.
4. Z panelu ngrok skopiuj adres **HTTPS** (np. `https://abc.ngrok-free.app`). Wpisz go w oknie serwera albo po prostu przekaż znajomym.
5. **Nie zamykaj** terminala Node ani tunelu ngrok. Zamykanie serwera rozłącza graczy. Lokalne pliki pokojów i wspólnego świata znajdują się w `multiplayer/room-data/`. Rób kopie zapasowe tej lokalizacji.
6. Host może także zagrać: uruchamia `START_WINDOWS.bat`, w menu wybiera `START ONLINE`, a jako adres może podać `http://127.0.0.1:8787` (na lokalnym serwerze HTTP) albo swój publiczny adres ngrok.

**Uwaga:** `ngrok http 8787` tworzy publiczny tunel HTTP/HTTPS, który obsługuje również WebSocket. Klient automatycznie zamienia `https://...` na `wss://.../ws`. Nie wybieraj tunelu TCP. URL darmowego tunelu może się zmieniać po restarcie. Nie trzeba zakładać pokoju ani przepisywać kodu pokoju.

## Gracz — Windows lub GitHub Pages

1. Otwórz lokalną grę przez `START_WINDOWS.bat` **albo** stronę opublikowaną na GitHub Pages.
2. `START OFFLINE` — samodzielny świat w IndexedDB przeglądarki. `KONTYNUUJ OFFLINE` — przywrócenie zapisu solo.
3. `START ONLINE` — wpisz nick i adres HTTPS hosta ngrok. Kliknij `START · DOŁĄCZ DO ŚWIATA HOSTA`.
4. Poczekaj na wczytanie wspólnego świata i kliknij `WEJDŹ DO GRY` (przeglądarka wymaga interakcji do przechwycenia kursora).
5. Przytrzymaj **TAB**, aby zobaczyć pozycje XYZ graczy; naciśnij **Enter**, aby pisać na czacie.

## Zakres synchronizacji

Serwer trwale przechowuje seed wspólnego świata i edycje bloków; synchronizuje pozycje, obrót i HP awatarów oraz czat. Każdy klient lokalnie generuje identyczny teren z seeda. **Nie ma jeszcze pełnej autorytatywnej symulacji na serwerze**: AI mobów, ekwipunek, obrażenia w PvE i loot wciąż są lokalne; nie traktuj tego jako kompletnego współdzielonego survivalu z zabezpieczeniami antycheatowymi. Stan pokoju jest przechowywany na komputerze hosta, nie na GitHub Pages.

## Diagnostyka

- Nie możesz wejść przez stronę HTTPS? Użyj `https://...ngrok...` (nie `http://`, `ws://` ani portu lokalnego), sprawdź tunel oraz otwarte okno hosta.
- Sprawdź na hoście `http://127.0.0.1:8787/` — powinien zwrócić JSON ze statusem `ok`.
- Gdy strona GitHub Pages jest otwarta, adres `http://127.0.0.1:8787` hosta NIE oznacza twojego komputera — użyj publicznego ngroka.
- Gdy serwer nie rusza: sprawdź komunikaty w oknie `START_SERVER.bat`, czy port 8787 nie jest zajęty i czy Node.js jest w `PATH`.
- Jeśli nigdy wcześniej nie uruchamiałeś ngroka, sprawdź authtoken: `ngrok config add-authtoken TWOJ_TOKEN` (nie udostępniaj tokena innym).
