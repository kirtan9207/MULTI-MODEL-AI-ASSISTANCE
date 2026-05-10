// ============================================================
// DealPilot — Voice Intent Parser
// Parses natural language voice commands into structured intents
// ============================================================

// Intent types
const INTENTS = {
  FOOD_ORDER: 'food_order',
  RIDE_BOOK: 'ride_book',
  CALENDAR_CHECK: 'calendar_check',
  UNKNOWN: 'unknown'
};

// Food-related keywords
const FOOD_KEYWORDS = [
  'order', 'food', 'eat', 'hungry', 'deliver', 'delivery',
  'restaurant', 'biryani', 'pizza', 'burger', 'chicken',
  'paneer', 'dosa', 'thali', 'noodles', 'rice', 'dal',
  'roti', 'curry', 'meal', 'lunch', 'dinner', 'breakfast',
  'snack', 'dessert', 'cake', 'ice cream', 'coffee', 'tea',
  'zomato', 'swiggy', 'want to eat', 'craving', 'butter',
  'masala', 'tandoori', 'kebab', 'momos', 'rolls', 'wrap',
  'sandwich', 'salad', 'soup', 'pasta', 'fries', 'samosa',
  'idli', 'vada', 'pav', 'bhaji', 'chaat'
];

// Ride-related keywords
const RIDE_KEYWORDS = [
  'ride', 'cab', 'taxi', 'auto', 'book', 'uber', 'ola',
  'rapido', 'drop', 'pick', 'pickup', 'travel', 'go to',
  'going to', 'take me', 'drive', 'commute', 'office',
  'home', 'airport', 'station', 'reach'
];

// Calendar-related keywords
const CALENDAR_KEYWORDS = [
  'calendar', 'schedule', 'meeting', 'event', 'appointment',
  'today', 'tomorrow', 'plan', 'plans', 'busy', 'free'
];

// Location keywords (Indian cities/areas)
const LOCATION_MARKERS = [
  'near', 'in', 'at', 'around', 'from', 'to',
  'koramangala', 'indiranagar', 'hsr', 'btm', 'whitefield',
  'electronic city', 'marathahalli', 'mg road', 'brigade road',
  'jayanagar', 'jp nagar', 'banashankari', 'malleshwaram',
  'rajajinagar', 'hebbal', 'yelahanka', 'bangalore', 'bengaluru'
];

function parseIntent(text) {
  const lowerText = text.toLowerCase().trim();

  // Count keyword matches for each category
  const foodScore = FOOD_KEYWORDS.filter(k => lowerText.includes(k)).length;
  const rideScore = RIDE_KEYWORDS.filter(k => lowerText.includes(k)).length;
  const calendarScore = CALENDAR_KEYWORDS.filter(k => lowerText.includes(k)).length;

  // Determine intent based on scores
  let intent = INTENTS.UNKNOWN;
  let maxScore = 0;

  if (foodScore > maxScore) { maxScore = foodScore; intent = INTENTS.FOOD_ORDER; }
  if (rideScore > maxScore) { maxScore = rideScore; intent = INTENTS.RIDE_BOOK; }
  if (calendarScore > maxScore) { maxScore = calendarScore; intent = INTENTS.CALENDAR_CHECK; }

  // Default to food if no clear intent (most common use case)
  if (intent === INTENTS.UNKNOWN && lowerText.length > 3) {
    intent = INTENTS.FOOD_ORDER;
  }

  // Extract details based on intent
  const details = extractDetails(lowerText, intent);

  return {
    intent,
    confidence: maxScore > 0 ? Math.min(maxScore / 3, 1) : 0.3,
    originalText: text,
    ...details
  };
}

function extractDetails(text, intent) {
  switch (intent) {
    case INTENTS.FOOD_ORDER:
      return extractFoodDetails(text);
    case INTENTS.RIDE_BOOK:
      return extractRideDetails(text);
    case INTENTS.CALENDAR_CHECK:
      return { timeframe: text.includes('tomorrow') ? 'tomorrow' : 'today' };
    default:
      return {};
  }
}

function extractFoodDetails(text) {
  // Remove common filler words to extract the food item
  const fillers = [
    'i want to', 'i wanna', 'can you', 'please', 'order',
    'find', 'search', 'get me', 'i need', 'i\'d like',
    'looking for', 'find me', 'show me', 'want', 'some',
    'delivery', 'deliver', 'food', 'best', 'cheapest',
    'nearby', 'near me', 'around here'
  ];

  let foodQuery = text;
  fillers.forEach(filler => {
    foodQuery = foodQuery.replace(new RegExp(filler, 'gi'), '');
  });

  // Extract location
  let location = 'bangalore';
  const locationMatch = text.match(/(?:near|in|at|around)\s+([a-zA-Z\s]+?)(?:\s*$|,|\.|for)/i);
  if (locationMatch) {
    location = locationMatch[1].trim();
    foodQuery = foodQuery.replace(locationMatch[0], '');
  }

  // Clean up the food query
  foodQuery = foodQuery.replace(/\s+/g, ' ').trim();

  // If food query is too short or empty, try to extract any noun-like words
  if (foodQuery.length < 2) {
    foodQuery = text.replace(/\b(i|want|to|order|please|can|you|me|some|the|a|an|get|find)\b/gi, '').trim();
  }

  return {
    query: foodQuery || text,
    location,
    type: 'food'
  };
}

function extractRideDetails(text) {
  let pickup = '';
  let dropoff = '';

  // Try to extract "from X to Y"
  const fromToMatch = text.match(/from\s+(.+?)\s+to\s+(.+?)(?:\s*$|,|\.)/i);
  if (fromToMatch) {
    pickup = fromToMatch[1].trim();
    dropoff = fromToMatch[2].trim();
  } else {
    // Try "to X"
    const toMatch = text.match(/(?:to|go to|going to|reach|take me to)\s+(.+?)(?:\s*$|,|\.)/i);
    if (toMatch) {
      dropoff = toMatch[1].trim();
      pickup = 'current location';
    }
  }

  return {
    pickup: pickup || 'current location',
    dropoff: dropoff || '',
    type: 'ride'
  };
}

module.exports = { parseIntent, INTENTS };
