// ============================================================
// DealPilot — Results Renderer
// Renders comparison cards, winner badges, and savings
// ============================================================

const PLATFORM_EMOJIS = {
  zomato: '🍕',
  swiggy: '🍔',
  uber: '🚗',
  ola: '🛺',
  rapido: '🛵'
};

const PLATFORM_COLORS = {
  zomato: '#e23744',
  swiggy: '#fc8019',
  uber: '#ffffff',
  ola: '#35b550',
  rapido: '#ffd500'
};

function renderFoodResults(data) {
  const grid = document.getElementById('results-grid');
  const title = document.getElementById('results-title');
  grid.innerHTML = '';

  title.innerHTML = `Results for <span class="highlight">"${data.query}"</span> near ${data.location}`;

  const bestDealId = data.comparison?.bestDeal?.id;

  // Flatten all platform results and sort
  const allItems = data.comparison?.allResults || [];

  allItems.forEach((item, index) => {
    const isWinner = item.id === bestDealId;
    const card = createFoodCard(item, isWinner, index);
    grid.appendChild(card);
  });

  // Show savings banner
  if (data.comparison?.bestDeal?.savings > 0) {
    const banner = document.getElementById('savings-banner');
    const amount = document.getElementById('savings-amount');
    amount.textContent = `₹${data.comparison.bestDeal.savings}`;
    banner.style.display = 'block';
    amount.style.animation = 'countUp 0.5s ease';
  }

  // Show demo data notice
  if (data.isDemoData) {
    const notice = document.createElement('div');
    notice.style.cssText = 'text-align:center;padding:12px;background:rgba(255,107,53,0.1);border:1px solid rgba(255,107,53,0.2);border-radius:12px;font-size:0.8rem;color:#ff6b35;margin-top:16px;';
    notice.innerHTML = '📊 Showing demo data — connect your Anakin.io API key for live scraping';
    grid.parentNode.appendChild(notice);
  }
}

function createFoodCard(item, isWinner, index) {
  const card = document.createElement('div');
  card.className = `result-card${isWinner ? ' winner' : ''}`;
  card.style.animation = `slideInRight 0.4s ease ${index * 0.1}s both`;

  const platform = item.platform;
  const emoji = PLATFORM_EMOJIS[platform] || '🍽️';
  const effectivePrice = item.effectivePrice || item.price;

  card.innerHTML = `
    ${isWinner ? '<div class="winner-badge">🏆 BEST DEAL</div>' : ''}
    <div class="result-card-header">
      <div class="result-platform-badge ${platform}">${emoji}</div>
      <div>
        <div class="result-restaurant-name">${item.restaurantName}</div>
        <div class="result-platform-name">${platform}</div>
      </div>
    </div>
    <div class="result-details">
      <div class="result-row">
        <span class="result-label">Price</span>
        <span class="result-value price">₹${item.price}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Delivery Fee</span>
        <span class="result-value ${item.deliveryFee === 0 ? 'free' : ''}">${item.deliveryFee === 0 ? 'FREE ✨' : '₹' + item.deliveryFee}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Delivery Time</span>
        <span class="result-value">${item.deliveryTime || 'N/A'}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Rating</span>
        <span class="result-value rating">⭐ ${item.rating || 'N/A'}${item.ratingCount ? ' (' + item.ratingCount + ')' : ''}</span>
      </div>
      ${item.discount ? `<div class="result-discount">🎉 ${item.discount}</div>` : ''}
    </div>
    <button class="btn btn-order" onclick="window.open('${item.orderUrl || '#'}', '_blank')">
      ${isWinner ? '🏆 Order Now — Best Price!' : 'Order on ' + platform.charAt(0).toUpperCase() + platform.slice(1)}
    </button>
  `;

  return card;
}

function renderRideResults(data) {
  const grid = document.getElementById('results-grid');
  const title = document.getElementById('results-title');
  grid.innerHTML = '';

  title.innerHTML = `Rides from <span class="highlight">${data.pickup}</span> to <span class="highlight">${data.dropoff}</span>`;

  const bestId = data.bestRide?.id;

  data.allRides.forEach((ride, index) => {
    const isWinner = ride.id === bestId;
    const card = document.createElement('div');
    card.className = `result-card${isWinner ? ' winner' : ''}`;
    card.style.animation = `slideInRight 0.4s ease ${index * 0.1}s both`;

    const emoji = PLATFORM_EMOJIS[ride.platform] || '🚗';

    card.innerHTML = `
      ${isWinner ? '<div class="winner-badge">🏆 CHEAPEST</div>' : ''}
      <div class="result-card-header">
        <div class="result-platform-badge ${ride.platform}">${emoji}</div>
        <div>
          <div class="result-restaurant-name">${ride.type}</div>
          <div class="result-platform-name">${ride.platform}</div>
        </div>
      </div>
      <div class="result-details">
        <div class="result-row">
          <span class="result-label">Fare</span>
          <span class="result-value price">₹${ride.price}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Arrives in</span>
          <span class="result-value">${ride.eta}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Trip Duration</span>
          <span class="result-value">${ride.duration}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Distance</span>
          <span class="result-value">${ride.distance}</span>
        </div>
        ${ride.surgeMultiplier > 1 ? `<div class="result-discount" style="background:rgba(244,63,94,0.1);border-color:rgba(244,63,94,0.2);color:var(--accent-red);">⚡ Surge ${ride.surgeMultiplier}x</div>` : ''}
      </div>
      <button class="btn btn-order" onclick="alert('Opening ${ride.platform}...')">
        ${isWinner ? '🏆 Book Now — Cheapest!' : 'Book on ' + ride.platform.charAt(0).toUpperCase() + ride.platform.slice(1)}
      </button>
    `;
    grid.appendChild(card);
  });

  if (data.savings > 0) {
    const banner = document.getElementById('savings-banner');
    const amount = document.getElementById('savings-amount');
    amount.textContent = `₹${data.savings}`;
    banner.style.display = 'block';
  }
}
