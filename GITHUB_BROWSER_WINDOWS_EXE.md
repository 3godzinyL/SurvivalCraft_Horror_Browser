# Zbuduj pojedynczy Windows EXE bez GitHub Desktop

1. Zaloguj się w przeglądarce na https://github.com/new, utwórz **publiczne** repozytorium `nightcraft`. Możesz zaznaczyć README.
2. Rozpakuj wszystkie cztery paczki **NightCraft_V25_GITHUB_PACZKA_1_z_4.zip** … **4_z_4.zip** osobno. GitHub w przeglądarce pozwala wgrać najwyżej 100 plików w jednej operacji, dlatego paczki mają po maksymalnie 80 plików. Wgraj *zawartość* paczki przez **Add file → Upload files**, zachowując podfoldery, a potem **Commit changes**. Powtórz dla kolejnych paczek.
3. Upewnij się, że `index.html`, `package.json`, `electron/main.cjs` i `.github/workflows/windows-desktop.yml` znajdują się w prawidłowych lokalizacjach w repozytorium. **Nie wgrywaj ZIP-ów jako ZIP-ów.**
4. Wejdź w zakładkę **Actions → Build NightCraft Windows EXE → Run workflow** (wybierz gałąź `main` lub `master`). Jeśli Actions prosi o zatwierdzenie workflow, zaakceptuj je. Czekaj, aż zadanie `windows-portable` zakończy się na zielono.
5. Kliknij ukończony przebieg i pobierz **NightCraft-V25-Windows-EXE** w sekcji **Artifacts**. Rozpakuj małe archiwum GitHuba — otrzymasz jeden przenośny Windows EXE. Ten plik możesz wysłać znajomym, którym nie jest potrzebny Node.js ani żadna przeglądarka.

**Ważne:** pierwsze automatyczne buildy po wgraniu samej paczki 1 mogą się nie udać, bo repozytorium nie zawiera jeszcze pozostałych plików. Uruchom workflow ręcznie dopiero po wgraniu wszystkich czterech. Jeśli workflow jest niedostępny, odśwież Actions po wgraniu pliku `.github/workflows/windows-desktop.yml`.

**Uruchamianie gry:** offline to oddzielny prywatny świat. „Hostuj grę” uruchamia host lokalnie; ngrok służy do połączenia przez Internet. „Dołącz do gry” wymaga wklejenia linku HTTPS gospodarza. Przytrzymaj Tab, żeby zobaczyć nicki i XYZ.

Uwaga: pliki `.exe` z CI nie są podpisane cyfrowo, dlatego Windows może wyświetlić filtr SmartScreen. To nie daje gwarancji bezpieczeństwa — przed uruchomieniem programu pobranego z Internetu zawsze zweryfikuj źródło i zawartość projektu.
