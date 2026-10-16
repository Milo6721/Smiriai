# Smiri

Struktura:
- `public/` — strona (jedyne, co widzą użytkownicy)
- `api/` — funkcje serwerowe (czat, notowania); klucz API żyje wyłącznie tutaj, jako zmienna środowiskowa
- `.env.example` — lista zmiennych do ustawienia (tylko dla właściciela projektu)

## Wdrożenie (Vercel)
1. Nowe repo na GitHubie z zawartością tego folderu, import na vercel.com.
2. Project → Settings → Environment Variables: `ANTHROPIC_API_KEY` (wymagane), `SITE_PASSWORD` (opcjonalny kod dostępu), `ALLOWED_MODELS` (opcjonalnie).
3. Deploy.

Lokalnie: `npm i -g vercel`, skopiuj `.env.example` do `.env`, uruchom `vercel dev`.
