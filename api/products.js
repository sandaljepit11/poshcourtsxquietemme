const paapi = require('paapi5-nodejs-sdk');

const MARKETPLACES = {
  US: { host: 'webservices.amazon.com', region: 'us-east-1' },
  UK: { host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  DE: { host: 'webservices.amazon.de', region: 'eu-west-1' },
  FR: { host: 'webservices.amazon.fr', region: 'eu-west-1' },
  IT: { host: 'webservices.amazon.it', region: 'eu-west-1' },
  ES: { host: 'webservices.amazon.es', region: 'eu-west-1' },
  IN: { host: 'webservices.amazon.in', region: 'eu-west-1' },
  JP: { host: 'webservices.amazon.co.jp', region: 'us-west-2' },
  CA: { host: 'webservices.amazon.ca', region: 'us-east-1' },
  AU: { host: 'webservices.amazon.com.au', region: 'us-west-2' }
};

const DEFAULT_RESOURCES = [
  'Images.Primary.Large',
  'ItemInfo.Title',
  'ItemInfo.ByLineInfo',
  'ItemInfo.Features',
  'Offers.Listings.Price',
  'Offers.Listings.Availability.Message'
];

function getMarketplace() {
  const key = (process.env.AMAZON_MARKETPLACE || 'US').toUpperCase();
  return MARKETPLACES[key] || MARKETPLACES.US;
}

function configureClient() {
  const marketplace = getMarketplace();
  const defaultClient = paapi.ApiClient.instance;
  defaultClient.accessKey = process.env.AMAZON_ACCESS_KEY;
  defaultClient.secretKey = process.env.AMAZON_SECRET_KEY;
  defaultClient.host = marketplace.host;
  defaultClient.region = marketplace.region;
  return new paapi.DefaultApi();
}

function normalizeItem(item, fallbackCategory) {
  const listing = item.Offers && item.Offers.Listings && item.Offers.Listings[0];
  return {
    asin: item.ASIN,
    title: item.ItemInfo?.Title?.DisplayValue || 'Amazon Product',
    brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || 'Amazon',
    category: fallbackCategory,
    image: item.Images?.Primary?.Large?.URL || item.Images?.Primary?.Medium?.URL || '',
    price: listing?.Price?.DisplayAmount || 'View on Amazon',
    availability: listing?.Availability?.Message || '',
    description: item.ItemInfo?.Features?.DisplayValues?.[0] || '',
    features: item.ItemInfo?.Features?.DisplayValues?.slice(0, 4) || [],
    amazonUrl: item.DetailPageURL
  };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG || 'vonderlanddd2-20';

  if (!accessKey || !secretKey || !partnerTag) {
    return sendJson(res, 500, {
      error: 'Amazon PA-API credentials are missing. Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, and AMAZON_PARTNER_TAG.'
    });
  }

  const keyword = String(req.query.keyword || 'womens premium activewear').slice(0, 120);
  const category = String(req.query.category || 'Amazon Edit').slice(0, 60);
  const limit = Math.max(1, Math.min(Number(req.query.limit || 6), 10));

  try {
    const api = configureClient();
    const request = new paapi.SearchItemsRequest();
    request.PartnerTag = partnerTag;
    request.PartnerType = 'Associates';
    request.Keywords = keyword;
    request.SearchIndex = 'FashionWomen';
    request.ItemCount = limit;
    request.Resources = DEFAULT_RESOURCES;

    const data = await new Promise((resolve, reject) => {
      api.searchItems(request, (error, response) => {
        if (error) return reject(error);
        resolve(response);
      });
    });

    const products = data.SearchResult?.Items?.map(item => normalizeItem(item, category)) || [];
    return sendJson(res, 200, { keyword, category, count: products.length, products });
  } catch (error) {
    return sendJson(res, 502, {
      error: 'Amazon PA-API request failed',
      message: error.message || String(error)
    });
  }
};
