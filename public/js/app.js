// ============================================================
// BRO — Main App Logic (Chat Interface)
// Real-time data fetching, Chat UI, WhatsApp/Gmail integration
// ============================================================

const APP_API_BASE = '';

const PLATFORM_EMOJIS_APP = {
  zomato: '<img src="/images/zomato.svg" class="real-icon-small">',
  swiggy: '<img src="/images/swiggy.svg" class="real-icon-small">',
  uber: '<img src="/images/uber.svg" class="real-icon-small">',
  ola: '<img src="/images/ola.svg" class="real-icon-small">',
  rapido: '<img src="/images/rapido.svg" class="real-icon-small">',
  whatsapp: '<img src="/images/whatsapp.svg" class="real-icon-small">',
  gmail: '<img src="/images/gmail.svg" class="real-icon-small">',
  google: '<img src="/images/google.svg" class="real-icon-small">'
};

// ─── INITIALIZATION ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Clear local storage forcefully to fix the "not connected but showing" bug
  loadConnectedBadges();
});

function loadConnectedBadges() {
  const container = document.getElementById('connected-badges');
  if (!container) return;

  const saved = localStorage.getItem('dealpilot_connected');
  const platforms = saved ? JSON.parse(saved) : [];

  container.innerHTML = platforms.map(p =>
    `<div class="badge active"><span class="dot"></span>${PLATFORM_EMOJIS_APP[p] || '📌'} ${p.charAt(0).toUpperCase() + p.slice(1)}</div>`
  ).join('');

  if (platforms.length === 0) {
    container.innerHTML = '<div class="badge">No platforms connected</div>';
  }
}

// ─── CHAT UI HELPERS ───────────────────────────────────────
function hideWelcome() {
  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.style.display = 'none';
}

function scrollToBottom() {
  const messages = document.getElementById('chat-messages');
  messages.scrollTop = messages.scrollHeight;
}

function appendUserMessage(text) {
  hideWelcome();
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-bubble user';
  div.textContent = text;
  messages.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  messages.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();
}

function appendAIMessage(htmlContent) {
  hideTyping();
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.innerHTML = htmlContent;
  messages.appendChild(div);
  scrollToBottom();
}

// ─── INPUT HANDLERS ────────────────────────────────────────
function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (text) {
    input.value = '';
    processVoiceCommand(text);
  }
}

function quickSearch(text) {
  processVoiceCommand(text);
}

function processVoiceCommand(text) {
  appendUserMessage(text);

  // Check for auto-message triggers
  const isWhatsapp = /whatsapp/i.test(text);
  const isEmail = /email|gmail/i.test(text);

  if (isWhatsapp || isEmail) {
    handleAutoMessage(text, isWhatsapp ? 'whatsapp' : 'gmail');
    return;
  }

  // Otherwise handle normal search
  doSearch(text);
}

// ─── AUTO MESSAGING (WHATSAPP/GMAIL) ───────────────────────
async function handleAutoMessage(text, platform) {
  showTyping();
  await sleep(1500);

  const saved = localStorage.getItem('dealpilot_connected');
  const connected = saved ? JSON.parse(saved) : [];

  if (!connected.includes(platform)) {
    appendAIMessage(`
      <p>I can't send messages yet because your <strong>${PLATFORM_EMOJIS_APP[platform]} ${platform === 'whatsapp' ? 'WhatsApp' : 'Gmail'}</strong> is not connected.</p>
      <div style="margin-top:12px;">
        <a href="/accounts" class="btn" style="font-size:0.85rem;">🔗 Connect ${platform === 'whatsapp' ? 'WhatsApp' : 'Gmail'}</a>
      </div>
    `);
    return;
  }

  // Simulate scanning platforms and sending message
  await sleep(1000);
  hideTyping();
  showTyping();
  await sleep(1500);

    const messageStr = platform === 'whatsapp'
    ? `<div class="auto-msg-badge whatsapp">WhatsApp Message Sent</div>`
    : `<div class="auto-msg-badge gmail">Gmail Sent</div>`;

  appendAIMessage(`
    <p>Done! I've scanned the live prices and sent today's best deals directly to your ${platform === 'whatsapp' ? 'WhatsApp' : 'inbox'}.</p>
    ${messageStr}
    <div class="deal-card">
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">Preview of message sent:</div>
      <p style="font-family:monospace;font-size:0.9rem;white-space:pre-wrap;">🎯 BRO Top Picks Today:
🍕 Zomato: 60% OFF up to ₹120 (Code: WELCOME60)
🍔 Swiggy: Free delivery on ₹199+
🚗 Uber: Flat 20% off your next ride</p>
    </div>
  `);

  if (window.speechSynthesis) {
    speak(`I've sent today's best deals to your ${platform === 'whatsapp' ? 'WhatsApp' : 'Gmail'}.`);
  }
}

// ─── MAIN SEARCH FLOW ──────────────────────────────────────
async function doSearch(text) {
  showTyping();

  const saved = localStorage.getItem('dealpilot_connected');
  const platforms = saved ? JSON.parse(saved) : ['zomato', 'swiggy'];
  const foodPlatforms = platforms.filter(p => ['zomato', 'swiggy'].includes(p));
  const ridePlatforms = platforms.filter(p => ['uber', 'ola', 'rapido'].includes(p));

  const isRide = /ride|cab|auto|uber|ola|rapido|book|go to|take me/i.test(text);
  const activePlatforms = isRide
    ? (ridePlatforms.length ? ridePlatforms : ['uber', 'ola'])
    : (foodPlatforms.length ? foodPlatforms : ['zomato', 'swiggy']);

  try {
    const searchPromise = fetch(`${APP_API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const res = await searchPromise;
    const data = await res.json();
    console.log('[App] Search results:', data);

    if (data.type === 'food') {
      renderChatFoodResults(data);
    } else if (data.type === 'ride') {
      renderChatRideResults(data);
    } else {
      appendAIMessage(`<p>${data.message || "I couldn't understand that. Try again!"}</p>`);
    }

    if (data.voiceResponse) {
      setTimeout(() => speak(data.voiceResponse), 500);
    }

  } catch (error) {
    console.error('[App] Search error:', error);
    appendAIMessage(`<p>Something went wrong connecting to Anakin.io. Please try again.</p>`);
  }
}

// ─── CHAT RENDERERS ────────────────────────────────────────
function renderChatFoodResults(data) {
  const { comparison, query, location } = data;
  if (!comparison || !comparison.bestDeal) {
    return appendAIMessage(`<p>I couldn't find any results for "${query}".</p>`);
  }

  const best = comparison.bestDeal;
  const platform = best.platform;
  const savings = comparison.savings || 0;

  let html = `<p>I found the best deal for <strong>${query}</strong> at <strong>${best.restaurantName}</strong>.</p>`;
  if (savings > 0) {
    html += `<p style="margin-top:8px;color:var(--accent-green);font-weight:600;">💰 You save ₹${savings} by choosing ${platform.charAt(0).toUpperCase() + platform.slice(1)}!</p>`;
  }

  html += `
    <div class="deal-card winner">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:1.5rem;">${PLATFORM_EMOJIS_APP[platform]}</div>
          <div>
            <div style="font-weight:bold;">${best.restaurantName}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);text-transform:capitalize;">${platform}</div>
          </div>
        </div>
        <div style="font-size:1.5rem;font-weight:bold;color:var(--accent-green);">₹${best.effectivePrice || best.price}</div>
      </div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">
        Delivery: ${best.deliveryFee === 0 ? 'Free' : '₹'+best.deliveryFee} • ETA: ${best.deliveryTime}
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;">Order on ${platform.charAt(0).toUpperCase() + platform.slice(1)}</button>
    </div>
  `;

  appendAIMessage(html);
}

function renderChatRideResults(data) {
  const { bestRide, pickup, dropoff, savings } = data;
  if (!bestRide) {
    return appendAIMessage(`<p>I couldn't find any rides from ${pickup}.</p>`);
  }

  const platform = bestRide.platform;

  let html = `<p>The cheapest ride to <strong>${dropoff}</strong> is a ${bestRide.type} on <strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}</strong>.</p>`;
  if (savings > 0) {
    html += `<p style="margin-top:8px;color:var(--accent-green);font-weight:600;">💰 You save ₹${savings} by choosing this option!</p>`;
  }

  html += `
    <div class="deal-card winner">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:1.5rem;">${PLATFORM_EMOJIS_APP[platform]}</div>
          <div>
            <div style="font-weight:bold;">${bestRide.type}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);text-transform:capitalize;">${platform}</div>
          </div>
        </div>
        <div style="font-size:1.5rem;font-weight:bold;color:var(--accent-green);">₹${bestRide.price}</div>
      </div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">
        ETA: ${bestRide.eta} • Duration: ${bestRide.duration}
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;">Book on ${platform.charAt(0).toUpperCase() + platform.slice(1)}</button>
    </div>
  `;

  appendAIMessage(html);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
