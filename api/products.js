// Vercel Serverless Function for Amazon Creators API
// Endpoint: /api/products?keyword=sports%20bra&category=Sports%20Bras&limit=6
// Keep credentials in Vercel Environment Variables only. Never expose them in index.html.

const MARKETPLACE_BY_CODE = {
  US: 'www.amazon.com',
  UK: 'www.amazon.co.uk',
  DE: 'www.amazon.de',
  FR: 'www.amazon.fr',
  IT: 'www.amazon.it',
  ES: 'www.amazon.es',
  CA: 'www.amazon.ca',
  JP: 'www.amazon.co.jp',
  IN: 'www.amazon.in',
  AU: 'www.amazon.com.au',
  BR: 'www.amazon.com.br',
  MX: 'www.amazon.com.mx'
};

const DEFAULT_RESOURCES = [
  'images.primary.medium',
  'images.primary.large',
  'itemInfo.title',
  'itemInfo.byLineInfo',
  'itemInfo.features',
  'offersV2.listings.availability',
  'offersV2.listings.condition',
  'offersV2.listings.merchantInfo',
  'offersV2.listings.price',
  'offersV2.listings.type'
];

function sendJson(res, statusCode, payload, cache = true) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cache && statusCode === 200) {
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(JSON.stringify(payload));
}

function pickMarketplace() {
  const raw = process.env.AMAZON_MARKETPLACE || process.env.CREATORS_API_MARKETPLACE || 'US';
  const key = String(raw).trim().toUpperCase();
  if (key.includes('AMAZON.')) return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return MARKETPLACE_BY_CODE[key] || MARKETPLACE_BY_CODE.US;
}

function firstListing(item) {
  const listings = item?.offersV2?.listings || item?.OffersV2?.Listings || item?.offers?.listings || [];
  return Array.isArray(listings) ? listings[0] : undefined;
}

function getImage(item) {
  return (
    item?.images?.primary?.large?.url ||
    item?.images?.primary?.large?.URL ||
    item?.images?.primary?.medium?.url ||
    item?.images?.primary?.medium?.URL ||
    item?.Images?.Primary?.Large?.URL ||
    item?.Images?.Primary?.Medium?.URL ||
    ''
  );
}

function getTitle(item) {
  return item?.itemInfo?.title?.displayValue || item?.ItemInfo?.Title?.DisplayValue || 'Amazon Product';
}

function getBrand(item) {
  return (
    item?.itemInfo?.byLineInfo?.brand?.displayValue ||
    item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ||
    'Amazon'
  );
}

function getFeatures(item) {
  const features = item?.itemInfo?.features?.displayValues || item?.ItemInfo?.Features?.DisplayValues || [];
  return Array.isArray(features) ? features.slice(0, 4) : [];
}

function getPrice(listing) {
  return (
    listing?.price?.money?.displayAmount ||
    listing?.Price?.Money?.DisplayAmount ||
    listing?.price?.displayAmount ||
    listing?.Price?.DisplayAmount ||
    'View on Amazon'
  );
}

function getAvailability(listing) {
  return listing?.availability?.message || listing?.Availability?.Message || listing?.availability?.type || listing?.Availability?.Type || '';
}

function normalizeItem(item, fallbackCategory) {
  const listing = firstListing(item);
  const features = getFeatures(item);
  return {
    asin: item?.asin || item?.ASIN || '',
    title: getTitle(item),
    brand: getBrand(item),
    category: fallbackCategory,
    image: getImage(item),
    price: getPrice(listing),
    availability: getAvailability(listing),
    description: features[0] || '',
    features,
    amazonUrl: item?.detailPageURL || item?.DetailPageURL || item?.detailPageUrl || ''
  };
}

function getItemsArray(response) {
  return (
    response?.searchResult?.items ||
    response?.SearchResult?.Items ||
    response?.items ||
    response?.Items ||
    []
  );
}

function simplifyError(error) {
  const raw = error?.response?.text || error?.response?.body || error?.body || error?.message || String(error);
  let parsed = raw;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {}
  return parsed;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' }, false);
  }

  const credentialId = process.env.AMAZON_CREATOR_CREDENTIAL_ID || process.env.CREATORS_API_CREDENTIAL_ID;
  const credentialSecret = process.env.AMAZON_CREATOR_CREDENTIAL_SECRET || process.env.CREATORS_API_CREDENTIAL_SECRET;
  const credentialVersion = process.env.AMAZON_CREATOR_CREDENTIAL_VERSION || process.env.CREATORS_API_CREDENTIAL_VERSION || '3.1';
  const partnerTag = process.env.AMAZON_PARTNER_TAG || 'vonderlanddd2-20';

  if (!credentialId || !credentialSecret || !credentialVersion || !partnerTag) {
    return sendJson(res, 500, {
      error: 'Amazon Creators API credentials are missing.',
      requiredEnvironmentVariables: [
        'AMAZON_CREATOR_CREDENTIAL_ID',
        'AMAZON_CREATOR_CREDENTIAL_SECRET',
        'AMAZON_CREATOR_CREDENTIAL_VERSION',
        'AMAZON_PARTNER_TAG'
      ]
    }, false);
  }

  const keyword = String(req.query.keyword || 'womens premium activewear').slice(0, 120);
  const category = String(req.query.category || 'Amazon Edit').slice(0, 60);
  const limit = Math.max(1, Math.min(Number(req.query.limit || 6), 10));
  const searchIndex = String(req.query.searchIndex || 'FashionWomen').slice(0, 60);
  const marketplace = pickMarketplace();

  try {
    const {
      ApiClient,
      DefaultApi,
      SearchItemsRequestContent
    } = require('amazon-creators-api');

    const apiClient = new ApiClient();
    apiClient.credentialId = credentialId;
    apiClient.credentialSecret = credentialSecret;
    apiClient.version = credentialVersion;

    const api = new DefaultApi(apiClient);
    const searchItemsRequest = new SearchItemsRequestContent();
    searchItemsRequest.partnerTag = partnerTag;
    searchItemsRequest.keywords = keyword;
    searchItemsRequest.searchIndex = searchIndex;
    searchItemsRequest.itemCount = limit;
    searchItemsRequest.resources = DEFAULT_RESOURCES;

    const data = await api.searchItems(marketplace, {
      searchItemsRequestContent: searchItemsRequest
    });

    const products = getItemsArray(data).map(item => normalizeItem(item, category));
    return sendJson(res, 200, {
      provider: 'amazon-creators-api',
      marketplace,
      keyword,
      category,
      count: products.length,
      products
    });
  } catch (error) {
    return sendJson(res, 502, {
      error: 'Amazon Creators API request failed',
      hint: 'If you see AssociateNotEligible, wait up to 48 hours after creating credentials or confirm the account has 10 qualifying sales in the last 30 days.',
      details: simplifyError(error)
    }, false);
  }
};
