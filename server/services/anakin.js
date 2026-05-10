// ============================================================
// DealPilot — Anakin.io Service Layer
// All Anakin API integrations: Browser Sessions, Scraping,
// AI Extraction, Agentic Search, Batch Scraping
// ============================================================

const axios = require('axios');

const API_KEY = () => process.env.ANAKIN_API_KEY;
const BASE_URL = 'https://api.anakin.io/v1';

// Helper for Anakin API requests
function anakinRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'X-API-Key': API_KEY(),
      'Content-Type': 'application/json'
    }
  };
  if (data) config.data = data;
  return axios(config);
}

// ─── 1. BROWSER SESSIONS ───────────────────────────────────
// Create a cloud browser session for user to login to a platform

async function createBrowserSession(platformName) {
  try {
    const response = await anakinRequest('POST', '/browser-sessions', {
      name: `dealpilot-${platformName}-${Date.now()}`,
      persistent: true
    });
    // Expected: { sessionId, wsEndpoint, liveUrl }
    return {
      success: true,
      sessionId: response.data.sessionId || response.data.id,
      liveUrl: response.data.liveUrl || response.data.connectUrl,
      wsEndpoint: response.data.wsEndpoint,
      raw: response.data
    };
  } catch (error) {
    console.error(`[Anakin] Browser session error for ${platformName}:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// Get session status
async function getSessionStatus(sessionId) {
  try {
    const response = await anakinRequest('GET', `/browser-sessions/${sessionId}`);
    return { success: true, ...response.data };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

// ─── 2. URL SCRAPER (AUTHENTICATED) ────────────────────────
// Scrape a URL using a saved browser session

async function scrapeUrl(url, options = {}) {
  try {
    const payload = {
      url,
      useBrowser: true,
      format: options.format || 'markdown'
    };

    // Use authenticated session if provided
    if (options.sessionId) {
      payload.sessionId = options.sessionId;
    }

    // Enable AI JSON extraction
    if (options.extractJson) {
      payload.generateJson = true;
      payload.format = 'json';
    }

    const response = await anakinRequest('POST', '/url-scraper', payload);

    // Handle async job polling if needed
    if (response.data.jobId && !response.data.content) {
      return await pollJobResult(response.data.jobId);
    }

    return { success: true, ...response.data };
  } catch (error) {
    console.error(`[Anakin] Scrape error for ${url}:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// ─── 3. BATCH SCRAPING ─────────────────────────────────────

async function batchScrape(urls, options = {}) {
  try {
    const payload = {
      urls: urls.slice(0, 10), // Max 10 URLs
      useBrowser: true,
      format: options.format || 'markdown'
    };
    if (options.sessionId) payload.sessionId = options.sessionId;
    if (options.extractJson) {
      payload.generateJson = true;
      payload.format = 'json';
    }

    const response = await anakinRequest('POST', '/url-scraper/batch', payload);
    return { success: true, ...response.data };
  } catch (error) {
    console.error('[Anakin] Batch scrape error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// ─── 4. AGENTIC SEARCH ─────────────────────────────────────

async function agenticSearch(query) {
  try {
    const response = await anakinRequest('POST', '/agentic-search', { query });
    return { success: true, ...response.data };
  } catch (error) {
    console.error('[Anakin] Agentic search error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// ─── 5. JOB POLLING ────────────────────────────────────────

async function pollJobResult(jobId, maxAttempts = 15, interval = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await anakinRequest('GET', `/url-scraper/${jobId}`);
      if (response.data.status === 'completed' || response.data.content) {
        return { success: true, ...response.data };
      }
      if (response.data.status === 'failed') {
        return { success: false, error: 'Job failed', details: response.data };
      }
    } catch (error) {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return { success: false, error: 'Job timed out' };
}

// ─── PLATFORM-SPECIFIC HELPERS ─────────────────────────────

const PLATFORM_URLS = {
  zomato: {
    search: (query, city = 'bangalore') =>
      `https://www.zomato.com/${city}/delivery?q=${encodeURIComponent(query)}`,
    base: 'https://www.zomato.com'
  },
  swiggy: {
    search: (query) =>
      `https://www.swiggy.com/search?query=${encodeURIComponent(query)}`,
    base: 'https://www.swiggy.com'
  },
  uber: {
    base: 'https://www.uber.com',
    estimate: (pickup, dropoff) =>
      `https://www.uber.com/go/product-selection`
  },
  ola: {
    base: 'https://www.olacabs.com',
    estimate: () => 'https://www.olacabs.com'
  }
};

async function searchPlatform(platform, query, sessionId, city = 'bangalore') {
  const urls = PLATFORM_URLS[platform];
  if (!urls) return { success: false, error: `Unknown platform: ${platform}` };

  const searchUrl = urls.search
    ? urls.search(query, city)
    : urls.base;

  return scrapeUrl(searchUrl, {
    sessionId,
    extractJson: true
  });
}

module.exports = {
  createBrowserSession,
  getSessionStatus,
  scrapeUrl,
  batchScrape,
  agenticSearch,
  searchPlatform,
  PLATFORM_URLS
};
