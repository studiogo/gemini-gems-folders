# Gemini Gems Folders

Skrypt Tampermonkey dodający system folderów do strony Gemów w Google Gemini.

Masz dziesiątki Gemów i żadnego sposobu, żeby je pogrupować? Ten skrypt dodaje pasek z chipami folderów, wyszukiwarką i przypisywaniem Gemów do kategorii, bezpośrednio w natywnym interfejsie Gemini.

![Gemini Gems Folders toolbar](https://img.shields.io/badge/wersja-3.0-blue) ![Licencja: MIT](https://img.shields.io/badge/licencja-MIT-green)

## Funkcje

- **Chipy folderów** - twórz nazwane foldery, filtruj Gemy klikając w chip
- **Filtr "Bez folderu"** - szybko znajdź Gemy, które nie są przypisane do żadnego folderu
- **Wyszukiwarka** - filtrowanie w czasie rzeczywistym po tytułach Gemów
- **Przycisk przypisania (📁)** - pojawia się przy każdym Gemie, otwiera dropdown do przypisywania/usuwania z folderów
- **Etykiety folderów** - małe badge'e obok tytułów Gemów pokazujące, do których folderów należą
- **Trwały zapis** - foldery i przypisania przetrwają przeładowanie strony (używa `GM_getValue` / `GM_setValue` z Tampermonkey)
- **Eksport / Import** - funkcje `ggfExport()` i `ggfImport(json)` dostępne w konsoli przeglądarki
- **Bezpieczne dla Trusted Types** - brak użycia `innerHTML`, działa z restrykcyjną polityką CSP Google Gemini

## Instalacja

1. Zainstaluj [Tampermonkey](https://www.tampermonkey.net/) w swojej przeglądarce
2. Kliknij poniższy link (lub stwórz nowy skrypt w Tampermonkey i wklej zawartość):

   **[Zainstaluj gemini-gems-folders.user.js](gemini-gems-folders.user.js)**

3. Otwórz [gemini.google.com/gems/view](https://gemini.google.com/gems/view)
4. Pasek folderów pojawi się między nagłówkiem "Moje Gemy" a listą Gemów

## Jak to działa

Skrypt czeka, aż Angular SPA Gemini załaduje zawartość, a następnie wstawia inline toolbar bezpośrednio do DOM strony. `MutationObserver` obsługuje dynamicznie ładowane Gemy.

ID Gemów jest wyciągane z atrybutu `href` każdego wiersza (`/gem/{hex_id}`). Przypisania do folderów są przechowywane jako prosta mapa JSON: `{ "nazwa_folderu": ["gem_id_1", "gem_id_2"] }`.

## Eksport / Import

Otwórz konsolę przeglądarki na stronie Gemów:

```js
// Eksportuj foldery do JSON
ggfExport()

// Importuj foldery z JSON
ggfImport('{"Praca": ["abc123", "def456"], "Zabawa": ["789ghi"]}')
```

## Szczegóły techniczne

- Czysty vanilla JS, zero zależności
- Wyłącznie `document.createElement()` (Gemini wymusza Trusted Types CSP, które blokuje `innerHTML`)
- Polling z ponowieniem (`1.5s × 40 prób`) czekając na zawartość SPA
- Zdebounce'owany `MutationObserver` do obsługi dynamicznych aktualizacji
- Ciemny motyw dopasowany do natywnego designu Gemini

## Kompatybilność

- Testowane na Google Gemini (marzec 2026)
- Wymaga Tampermonkey (lub kompatybilnego menedżera userscriptów)
- Działa w Chrome, Firefox, Edge

## Licencja

[MIT](LICENSE)
