# PoshCourts Amazon Product Advertising API Integration

This upgrade keeps PA-API credentials on the server and exposes a safe frontend endpoint at `/api/products`.

## Files

- `index.html` - upgraded frontend with Amazon API hydration and static fallback catalog.
- `api/products.js` - Vercel-style serverless endpoint for Amazon PA-API SearchItems.
- `package.json` - Node dependencies.
- `.env.example` - environment variable template.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Fill these values:

```bash
AMAZON_ACCESS_KEY=...
AMAZON_SECRET_KEY=...
AMAZON_PARTNER_TAG=vonderlanddd2-20
AMAZON_MARKETPLACE=US
```

4. Run locally with Vercel dev:

```bash
npm run dev
```

5. Open the local URL. The frontend will call `/api/products?keyword=...&category=...&limit=...`.

## Notes

- Do not put Amazon secret keys in `index.html`.
- PA-API SearchItems returns up to 10 items per request.
- The frontend keeps a static fallback catalog so the site still renders if the API is unavailable or credentials are missing.
- For production, add these environment variables in your hosting provider settings.
