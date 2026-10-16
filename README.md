# funnn.site

Strona z grami: kafelki z podglądem na żywo, a po kliknięciu gra otwiera się **na funnn.site** (w iframe), bez przenoszenia na adresy vercelowe.

## Pliki

```
index.html     cała strona (kafelki, odtwarzacz, routing /tycoon /skoczek /niebo /auta /bowshot)
games.json     lista gier, tu dodajesz nowe
api/check.js   sprawdza, czy gra pozwala na osadzenie; jeśli nie, strona przenosi gracza na jej adres
vercel.json    przekierowanie wszystkich ścieżek na index.html
```

## Wdrożenie (Vercel)

1. Wrzuć te pliki do nowego repozytorium na GitHubie (zachowaj folder `api`).
2. Vercel: Add New, Project, wybierz repozytorium, Framework: Other, Deploy.
3. Settings, Domains: dodaj `funnn.site`. Vercel pokaże dokładne rekordy DNS do wpisania u rejestratora domeny.

## Dodawanie gry

Dopisz obiekt w `games.json`:

```json
{
  "id": "nowa",
  "name": "Nazwa gry",
  "desc": "Jedno zdanie o grze.",
  "url": "https://adres-gry.vercel.app",
  "color": "#FF4F8B",
  "art": "fallback",
  "tags": ["3D", "coś o grze"],
  "controls": "WASD ruch, spacja skok."
}
```

Gra będzie pod `funnn.site/nowa`. Pole `art` może mieć wartość `tycoon`, `skoczek`, `niebo`, `auta`, `bowshot` albo `fallback` (ogólna ilustracja z klocków w kolorze `color`).

## Jak działa osadzanie

- Gra ładuje się w iframe na stronie `funnn.site/<id>`, z paskiem do powrotu, pełnym ekranem, podpowiedzią sterowania i otwarciem w nowej karcie.
- `api/check.js` odczytuje nagłówki gry (`X-Frame-Options`, `frame-ancestors`). Jeśli blokują osadzanie, strona sama przenosi gracza na adres gry.
- Zapisy gier w iframe są oddzielone od zapisów na adresach vercelowych (przeglądarki dzielą pamięć stron osadzonych). Postęp zapisany w grze otwartej przez funnn.site zostaje na funnn.site.

## Opcjonalnie: gry pod własną domeną

Jeśli skopiujesz plik gry do `games/<id>/index.html` i ustawisz `"url": "/games/<id>/"`, gra nie będzie już w obcej domenie: bez iframe'owych ograniczeń, z jednym wspólnym zapisem.
