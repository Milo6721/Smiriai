# Smiri

Asystent AI w stylu Apple: czat z artefaktami (podgląd stron, grafik i dokumentów), projektami, pamięcią, uruchamianiem kodu, wykresami, schematami i narzędziami.

## Struktura
- `public/` — strona (jedyne, co widzą użytkownicy)
- `api/` — funkcje serwerowe (`chat`, `fx` kursy walut, `stock` notowania); klucz API jest wyłącznie tutaj, jako zmienna środowiskowa
- `.env.example` — lista zmiennych (tylko dla właściciela projektu)

## Wdrożenie (Vercel)
1. Repo na GitHubie, import na vercel.com.
2. Project → Settings → Environment Variables: `ANTHROPIC_API_KEY` (wymagane), `SITE_PASSWORD` (opcjonalny kod dostępu), `ALLOWED_MODELS` (opcjonalnie).
3. Deploy. Po dodaniu zmiennych zrób Redeploy.

Lokalnie: `npm i -g vercel`, skopiuj `.env.example` do `.env`, uruchom `vercel dev`.

## Skróty
Cmd/Ctrl+K paleta poleceń · Cmd/Ctrl+Shift+O nowy czat · `/` pole pisania · Esc zamknij
