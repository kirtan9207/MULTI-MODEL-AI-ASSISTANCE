// ============================================================
// DealPilot — Scraped Data Parser
// Parses raw scraped markdown/json into structured comparison data
// ============================================================

/**
 * Parse scraped results from Anakin into a unified format
 * for comparison across platforms
 */
function parseScrapedResults(platform, rawData) {
  try {
    // If Anakin returned structured JSON (generateJson: true)
    if (rawData && typeof rawData === 'object' && rawData.extractedData) {
      return normalizeExtractedData(platform, rawData.extractedData);
    }

    // If we got markdown content, try to parse it
    if (rawData && rawData.content) {
      return parseMarkdownContent(platform, rawData.content);
    }

    // If we got raw text/html
    if (typeof rawData === 'string') {
      return parseMarkdownContent(platform, rawData);
    }

    return [];
  } catch (error) {
    console.error(`[Parser] Error parsing ${platform} data:`, error.message);
    return [];
  }
}

function normalizeExtractedData(platform, data) {
  // Normalize AI-extracted JSON into our format
  const items = Array.isArray(data) ? data : [data];

  return items.map((item, index) => ({
    id: `${platform}-${index}`,
    platform,
    restaurantName: item.restaurant || item.name || item.restaurantName || 'Unknown',
    itemName: item.item || item.dish || item.foodItem || item.title || '',
    price: extractPrice(item.price || item.cost || item.amount),
    originalPrice: extractPrice(item.originalPrice || item.mrp),
    deliveryFee: extractPrice(item.deliveryFee || item.deliveryCharge || item.delivery),
    deliveryTime: item.deliveryTime || item.eta || item.time || '',
    rating: parseFloat(item.rating || item.stars || 0),
    ratingCount: item.ratingCount || item.reviews || '',
    discount: item.discount || item.offer || item.coupon || '',
    imageUrl: item.image || item.imageUrl || item.thumbnail || '',
    orderUrl: item.url || item.link || item.orderUrl || '',
    distance: item.distance || ''
  }));
}

function parseMarkdownContent(platform, content) {
  // Basic markdown/text parser — extracts restaurant info from scraped content
  const results = [];
  const lines = content.split('\n');

  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for price patterns (₹XXX or Rs. XXX)
    const priceMatch = trimmed.match(/[₹₨][\s]*(\d+[\d,]*)/);
    const ratingMatch = trimmed.match(/(\d+\.?\d*)\s*(?:star|★|⭐|rating)/i);

    // Look for restaurant name patterns (typically bold or heading in markdown)
    if (trimmed.startsWith('#') || trimmed.startsWith('**')) {
      if (current && current.restaurantName) {
        results.push(current);
      }
      current = {
        id: `${platform}-${results.length}`,
        platform,
        restaurantName: trimmed.replace(/[#*]/g, '').trim(),
        itemName: '',
        price: 0,
        deliveryFee: 0,
        deliveryTime: '',
        rating: 0,
        discount: '',
        orderUrl: ''
      };
    }

    if (current) {
      if (priceMatch && !current.price) {
        current.price = parseInt(priceMatch[1].replace(/,/g, ''));
      }
      if (ratingMatch && !current.rating) {
        current.rating = parseFloat(ratingMatch[1]);
      }
      // Delivery time
      const timeMatch = trimmed.match(/(\d+)\s*(?:min|minutes)/i);
      if (timeMatch && !current.deliveryTime) {
        current.deliveryTime = `${timeMatch[1]} min`;
      }
      // Delivery fee
      const feeMatch = trimmed.match(/(?:delivery|del\.?)\s*(?:fee|charge)?[\s:]*[₹₨]?\s*(\d+)/i);
      if (feeMatch) {
        current.deliveryFee = parseInt(feeMatch[1]);
      }
      // Free delivery
      if (/free\s*delivery/i.test(trimmed)) {
        current.deliveryFee = 0;
      }
      // Discount
      const discountMatch = trimmed.match(/(\d+%\s*off|flat\s*₹?\d+\s*off|buy\s*\d+\s*get\s*\d+)/i);
      if (discountMatch) {
        current.discount = discountMatch[0];
      }
    }
  }

  // Push last item
  if (current && current.restaurantName) {
    results.push(current);
  }

  return results;
}

function extractPrice(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const match = String(value).match(/(\d+[\d,]*\.?\d*)/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
}

/**
 * Compare results across platforms and find the best deal
 */
function findBestDeal(allResults) {
  if (!allResults || allResults.length === 0) return null;

  // Calculate effective price (price + delivery fee - discount)
  const scored = allResults.map(item => {
    let effectivePrice = item.price + (item.deliveryFee || 0);

    // Subtract discount if it's a percentage
    const percentMatch = (item.discount || '').match(/(\d+)%/);
    if (percentMatch) {
      effectivePrice -= (item.price * parseInt(percentMatch[1]) / 100);
    }

    return { ...item, effectivePrice, savings: 0 };
  });

  // Sort by effective price
  scored.sort((a, b) => a.effectivePrice - b.effectivePrice);

  // Calculate savings compared to most expensive
  if (scored.length >= 2) {
    const maxPrice = scored[scored.length - 1].effectivePrice;
    scored[0].savings = Math.round(maxPrice - scored[0].effectivePrice);
  }

  return {
    bestDeal: scored[0],
    allResults: scored,
    totalOptions: scored.length
  };
}

/**
 * Generate demo data for fallback (in case live scraping fails during demo)
 */
function generateDemoData(query, location) {
  const foodItem = query || 'Butter Chicken';
  const restaurants = {
    zomato: [
      {
        id: 'zomato-0',
        platform: 'zomato',
        restaurantName: 'Paradise Biryani',
        itemName: foodItem,
        price: 349,
        originalPrice: 399,
        deliveryFee: 30,
        deliveryTime: '35 min',
        rating: 4.2,
        ratingCount: '10K+ ratings',
        discount: '15% off up to ₹60',
        imageUrl: '',
        orderUrl: 'https://www.zomato.com',
        distance: '2.5 km'
      },
      {
        id: 'zomato-1',
        platform: 'zomato',
        restaurantName: 'Meghana Foods',
        itemName: foodItem,
        price: 299,
        originalPrice: 299,
        deliveryFee: 40,
        deliveryTime: '40 min',
        rating: 4.5,
        ratingCount: '25K+ ratings',
        discount: '',
        imageUrl: '',
        orderUrl: 'https://www.zomato.com',
        distance: '3.1 km'
      }
    ],
    swiggy: [
      {
        id: 'swiggy-0',
        platform: 'swiggy',
        restaurantName: 'Empire Restaurant',
        itemName: foodItem,
        price: 289,
        originalPrice: 320,
        deliveryFee: 0,
        deliveryTime: '28 min',
        rating: 4.4,
        ratingCount: '15K+ ratings',
        discount: '20% off up to ₹100',
        imageUrl: '',
        orderUrl: 'https://www.swiggy.com',
        distance: '1.8 km'
      },
      {
        id: 'swiggy-1',
        platform: 'swiggy',
        restaurantName: 'Nandhini Deluxe',
        itemName: foodItem,
        price: 269,
        originalPrice: 269,
        deliveryFee: 25,
        deliveryTime: '32 min',
        rating: 4.1,
        ratingCount: '8K+ ratings',
        discount: 'Free delivery on ₹199+',
        imageUrl: '',
        orderUrl: 'https://www.swiggy.com',
        distance: '2.0 km'
      }
    ]
  };

  return restaurants;
}

function generateRideDemoData(pickup, dropoff) {
  return {
    uber: [
      {
        id: 'uber-0',
        platform: 'uber',
        type: 'UberGo',
        price: 189,
        surgeMultiplier: 1.0,
        eta: '3 min',
        duration: '22 min',
        distance: '8.5 km'
      },
      {
        id: 'uber-1',
        platform: 'uber',
        type: 'Uber Auto',
        price: 89,
        surgeMultiplier: 1.2,
        eta: '5 min',
        duration: '28 min',
        distance: '8.5 km'
      }
    ],
    ola: [
      {
        id: 'ola-0',
        platform: 'ola',
        type: 'Ola Mini',
        price: 175,
        surgeMultiplier: 1.0,
        eta: '4 min',
        duration: '22 min',
        distance: '8.5 km'
      },
      {
        id: 'ola-1',
        platform: 'ola',
        type: 'Ola Auto',
        price: 75,
        surgeMultiplier: 1.0,
        eta: '2 min',
        duration: '30 min',
        distance: '8.5 km'
      }
    ]
  };
}

module.exports = {
  parseScrapedResults,
  findBestDeal,
  generateDemoData,
  generateRideDemoData
};
