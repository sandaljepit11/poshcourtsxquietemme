# PoshCourts Amazon Creators API Upgrade

This version replaces the old PA-API v5 integration with Amazon Creators API credentials.

## Files

- `index.html` - unchanged storefront. It still fetches `/api/products` and falls back to static products if the API fails.
- `api/products.js` - Vercel Serverless Function that calls Amazon Creators API SearchItems.
- `package.json` - uses `amazon-creators-api` instead of `paapi5-nodejs-sdk`.
- `.env.example` - environment variable template.

## Vercel Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```env
AMAZON_CREATOR_CREDENTIAL_ID=your_credential_id
AMAZON_CREATOR_CREDENTIAL_SECRET=your_credential_secret
AMAZON_CREATOR_CREDENTIAL_VERSION=3.1
AMAZON_PARTNER_TAG=vonderlanddd2-20
AMAZON_MARKETPLACE=US
```

Then redeploy the project.

## Test URL

```text
https://your-domain.vercel.app/api/products?keyword=sports%20bra&category=Sports%20Bras&limit=4
```

## Common errors

- `AssociateNotEligible`: Amazon has not granted live Creators API product access yet. Amazon says eligibility review can take up to 48 hours after credentials are created, and eligibility can depend on qualifying sales.
- `Invalid credentials`: check for extra spaces in Credential ID, Credential Secret, or Version.
- Empty products: try another keyword or searchIndex, for example `FashionWomen`, `Fashion`, or `All`.

## Security

Never put the credential secret in `index.html` or client-side JavaScript. Use Vercel Environment Variables only.
