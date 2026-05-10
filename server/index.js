// ============================================================
// DealPilot — Express Server
// Main server with all API routes
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const anakin = require('./services/anakin');
const { parseIntent, INTENTS } = require('./services/voice-intent');
const { parseScrapedResults, findBestDeal, generateDemoData, generateRideDemoData } = require('./services/parser');
const sessionStore = require('./store/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── ROUTES ────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DealPilot',
    anakinConfigured: !!process.env.ANAKIN_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ─── BROWSER SESSIONS (Account Connection) ─────────────────

// Create a new browser session for a platform
app.post('/api/sessions/create', async (req, res) => {
  const { platform } = req.body;

  if (!platform) {
    return res.status(400).json({ error: 'Platform name is required' });
  }

  console.log(`[Session] Creating browser session for: ${platform}`);

  const result = await anakin.createBrowserSession(platform);

  if (result.success) {
    // Save session info
    sessionStore.savePlatformSession(platform, {
      sessionId: result.sessionId,
      liveUrl: result.liveUrl,
      wsEndpoint: result.wsEndpoint
    });

    res.json({
      success: true,
      platform,
      sessionId: result.sessionId,
      liveUrl: result.liveUrl, // URL to show to user for login
      message: `Browser session created for ${platform}. User can now login.`
    });
  } else {
    // Fallback: mark as connected in demo mode
    sessionStore.savePlatformSession(platform, {
      sessionId: `demo-${platform}-${Date.now()}`,
      demoMode: true
    });

    res.json({
      success: true,
      platform,
      sessionId: `demo-${platform}`,
      demoMode: true,
      message: `Connected to ${platform} in demo mode`
    });
  }
});

// Get session status
app.get('/api/sessions/:sessionId', async (req, res) => {
  const result = await anakin.getSessionStatus(req.params.sessionId);
  res.json(result);
});

// Get all connected platforms
app.get('/api/sessions', (req, res) => {
  const connected = sessionStore.getConnectedPlatforms();
  res.json({ platforms: connected });
});

// Mark platform as connected (after user completes login)
app.post('/api/sessions/confirm', (req, res) => {
  const { platform } = req.body;
  const session = sessionStore.getPlatformSession(platform);

  if (session) {
    sessionStore.savePlatformSession(platform, { ...session, loginComplete: true });
    res.json({ success: true, message: `${platform} login confirmed` });
  } else {
    // Still mark as connected in demo mode
    sessionStore.savePlatformSession(platform, {
      sessionId: `demo-${platform}-${Date.now()}`,
      loginComplete: true,
      demoMode: true
    });
    res.json({ success: true, message: `${platform} connected (demo mode)` });
  }
});

// Disconnect a platform
app.post('/api/sessions/disconnect', (req, res) => {
  const { platform } = req.body;
  sessionStore.disconnectPlatform(platform);
  res.json({ success: true, message: `${platform} disconnected` });
});

// ─── VOICE SEARCH (Main Feature) ───────────────────────────

app.post('/api/search', async (req, res) => {
  const { text, useDemoData } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Search text is required' });
  }

  console.log(`[Search] Processing: "${text}"`);

  // 1. Parse the voice command intent
  const intent = parseIntent(text);
  console.log('[Search] Parsed intent:', JSON.stringify(intent, null, 2));

  // 2. Handle based on intent type
  if (intent.intent === INTENTS.FOOD_ORDER) {
    const results = await handleFoodSearch(intent, useDemoData);
    return res.json({
      intent,
      ...results
    });
  }

  if (intent.intent === INTENTS.RIDE_BOOK) {
    const results = await handleRideSearch(intent, useDemoData);
    return res.json({
      intent,
      ...results
    });
  }

  if (intent.intent === INTENTS.CALENDAR_CHECK) {
    return res.json({
      intent,
      message: 'Calendar integration coming soon! Connect your Google account first.',
      events: []
    });
  }

  return res.json({
    intent,
    message: "I'm not sure what you need. Try saying something like 'Order biryani near Koramangala' or 'Book a ride to MG Road'."
  });
});

// ─── FOOD SEARCH HANDLER ───────────────────────────────────

async function handleFoodSearch(intent, useDemoData = false) {
  const { query, location } = intent;
  const connectedPlatforms = sessionStore.getConnectedPlatforms();

  console.log(`[Food] Searching for "${query}" in "${location}"`);
  console.log(`[Food] Connected platforms: ${connectedPlatforms.map(p => p.platform).join(', ')}`);

  let allResults = [];
  let scrapedData = {};
  let usedDemo = false;

  // Try live scraping first
  if (!useDemoData && process.env.ANAKIN_API_KEY && process.env.ANAKIN_API_KEY !== 'your_anakin_api_key_here') {
    try {
      // Scrape connected food platforms in parallel
      const foodPlatforms = ['zomato', 'swiggy'];
      const scrapePromises = foodPlatforms.map(async (platform) => {
        const session = sessionStore.getPlatformSession(platform);
        const sessionId = session?.sessionId;

        console.log(`[Food] Scraping ${platform}...`);
        const result = await anakin.searchPlatform(platform, query, sessionId, location);

        if (result.success) {
          const parsed = parseScrapedResults(platform, result);
          return { platform, results: parsed, live: true };
        }
        return { platform, results: [], live: false };
      });

      // Also run agentic search for deals
      const dealsPromise = anakin.agenticSearch(
        `best deals and offers for ${query} delivery in ${location} Zomato Swiggy today`
      );

      const [scrapeResults, dealsResult] = await Promise.all([
        Promise.all(scrapePromises),
        dealsPromise.catch(e => ({ success: false }))
      ]);

      // Collect results
      scrapeResults.forEach(({ platform, results, live }) => {
        if (results.length > 0) {
          scrapedData[platform] = results;
          allResults.push(...results);
        }
      });

      // If we got some results, great!
      if (allResults.length > 0) {
        const comparison = findBestDeal(allResults);
        return {
          type: 'food',
          query,
          location,
          platforms: scrapedData,
          comparison,
          deals: dealsResult.success ? dealsResult : null,
          isLiveData: true,
          voiceResponse: generateFoodVoiceResponse(comparison)
        };
      }
    } catch (error) {
      console.error('[Food] Live scraping failed, falling back to demo:', error.message);
    }
  }

  // Fallback to demo data
  console.log('[Food] Using demo data');
  usedDemo = true;
  const demoData = generateDemoData(query, location);

  Object.entries(demoData).forEach(([platform, results]) => {
    scrapedData[platform] = results;
    allResults.push(...results);
  });

  const comparison = findBestDeal(allResults);

  return {
    type: 'food',
    query,
    location,
    platforms: scrapedData,
    comparison,
    isLiveData: false,
    isDemoData: usedDemo,
    voiceResponse: generateFoodVoiceResponse(comparison)
  };
}

// ─── RIDE SEARCH HANDLER ───────────────────────────────────

async function handleRideSearch(intent, useDemoData = false) {
  const { pickup, dropoff } = intent;

  console.log(`[Ride] Searching from "${pickup}" to "${dropoff}"`);

  // For hackathon MVP, use demo data for rides
  const rideData = generateRideDemoData(pickup, dropoff);
  const allRides = [];

  Object.entries(rideData).forEach(([platform, rides]) => {
    allRides.push(...rides);
  });

  // Find cheapest ride
  allRides.sort((a, b) => a.price - b.price);
  const bestRide = allRides[0];
  const savings = allRides.length >= 2
    ? allRides[allRides.length - 1].price - bestRide.price
    : 0;

  return {
    type: 'ride',
    pickup,
    dropoff,
    platforms: rideData,
    bestRide,
    allRides,
    savings,
    isLiveData: false,
    voiceResponse: generateRideVoiceResponse(bestRide, savings, pickup, dropoff)
  };
}

// ─── AGENTIC SEARCH (Deals & Coupons) ──────────────────────

app.post('/api/deals', async (req, res) => {
  const { query, location } = req.body;

  if (!process.env.ANAKIN_API_KEY || process.env.ANAKIN_API_KEY === 'your_anakin_api_key_here') {
    return res.json({
      success: true,
      deals: [
        { platform: 'Zomato', offer: '60% off up to ₹120 on first order', code: 'WELCOME60' },
        { platform: 'Swiggy', offer: '50% off up to ₹100', code: 'SWIGGYIT' },
        { platform: 'Swiggy', offer: 'Free delivery on orders above ₹199', code: 'FREEDEL' }
      ],
      isDemoData: true
    });
  }

  const result = await anakin.agenticSearch(
    `current coupon codes and deals for ${query || 'food'} on Zomato Swiggy in ${location || 'Bangalore'} today`
  );

  res.json({
    success: result.success,
    deals: result.success ? result : [],
    isDemoData: false
  });
});

// ─── VOICE RESPONSE GENERATORS ─────────────────────────────

function generateFoodVoiceResponse(comparison) {
  if (!comparison || !comparison.bestDeal) {
    return "I couldn't find any results for your search. Please try again.";
  }

  const best = comparison.bestDeal;
  const platform = best.platform.charAt(0).toUpperCase() + best.platform.slice(1);
  const savings = best.savings;

  let response = `${platform} has the best deal! `;
  response += `${best.restaurantName} is offering ${best.itemName || 'your order'} `;
  response += `at rupees ${best.effectivePrice || best.price}`;

  if (best.deliveryFee === 0) {
    response += ' with free delivery';
  } else if (best.deliveryFee) {
    response += ` plus rupees ${best.deliveryFee} delivery`;
  }

  if (best.deliveryTime) {
    response += `, arriving in ${best.deliveryTime}`;
  }

  if (best.discount) {
    response += `. They also have a ${best.discount} offer`;
  }

  if (savings > 0) {
    response += `. You save rupees ${savings} compared to other platforms`;
  }

  response += '. Shall I open it for you?';

  return response;
}

function generateRideVoiceResponse(bestRide, savings, pickup, dropoff) {
  if (!bestRide) {
    return "I couldn't find any rides for your route. Please try again.";
  }

  const platform = bestRide.platform.charAt(0).toUpperCase() + bestRide.platform.slice(1);

  let response = `${platform} ${bestRide.type} is the cheapest option `;
  response += `at rupees ${bestRide.price}. `;
  response += `It will arrive in ${bestRide.eta} `;
  response += `and the ride will take about ${bestRide.duration}`;

  if (savings > 0) {
    response += `. You save rupees ${savings} compared to other options`;
  }

  response += '. Want me to open the app?';
  return response;
}

// ─── SERVE FRONTEND ────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/accounts', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'accounts.html'));
});

// Redirect old dashboard requests to home
app.get('/dashboard', (req, res) => {
  res.redirect('/');
});

// ─── START SERVER ──────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║                                          ║');
  console.log('  ║   🎙️  DealPilot is running!               ║');
  console.log(`  ║   🌐 http://localhost:${PORT}                ║`);
  console.log('  ║                                          ║');
  console.log('  ║   Powered by Anakin.io Scraping API      ║');
  console.log('  ║                                          ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Anakin API Key: ${process.env.ANAKIN_API_KEY ? '✅ Configured' : '❌ Not set (demo mode)'}`);
  console.log('');
});
