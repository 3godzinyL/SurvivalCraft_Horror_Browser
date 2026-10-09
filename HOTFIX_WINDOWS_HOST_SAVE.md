# NightCraft V25.2 — Windows build i trwały zapis hosta

## Co powodowało ostatni błąd

`tests/desktop_host.mjs` otrzymywał `edit` od drugiego klienta, a potem wykonywał `host.stop()`, zamykając Node.js z uruchomioną grą. Na Windows `child.kill()` kończy proces systemowym TerminateProcess, więc serwer nie ma gwarancji wykonania handlera `SIGTERM` i zapisania niezapisanych bloków. Stąd asercja `saved.edits.some(...)` mogła być fałszywa. To **nie** jest problem z Node.js ani npm.

Dodatkowo test czasem gubił `ready`: nasłuch tej wiadomości rozpoczynał się po `welcome`, a obie wiadomości serwer potrafił dostarczyć natychmiast.

## Naprawa

- `multiplayer/server.cjs`: prywatny endpoint `POST /__host/shutdown` dostępny tylko lokalnie, z losowym tokenem hosta. Odpowiedź `200` jest wysyłana dopiero po zapisaniu wszystkich zmienionych pokojów na dysk.
- `electron/host-service.cjs`: `await stop()` czeka na potwierdzenie zapisu i zamknięcie procesu. Twarde zatrzymanie pozostaje awaryjnym wyjściem, gdy proces już nie odpowiada.
- `electron/main.cjs`: zamykanie Electrona oraz przycisk zatrzymania hosta oczekują na zakończenie zapisu.
- `tests/desktop_host.mjs`: bufor WebSocket od otwarcia połączenia, autoryzacja shutdown, zapis z aktywnymi graczami, restart hosta, odczyt starego seeda i edycji.

## Uruchomienie

1. Rozpakuj tę wersję do osobnego folderu, bez nakładania na V25.1.
2. Uruchom `BUILD_WINDOWS_EXE.bat`.
3. Testy muszą zakończyć się `DESKTOP_HOST_PASS`; potem rozpocznie się budowanie Electrona.
4. Gotowe EXE, jeśli kompilacja się powiedzie, znajduje się w `dist-desktop`.

Jeśli jeszcze wystąpi błąd, prześlij **pełny komunikat** z końcówki konsoli. Ta paczka zawiera cały kod źródłowy, ale nie zawiera już skompilowanego Windows EXE.
