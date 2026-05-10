// ============================================================
// BRO — Accounts Connection Logic
// Platform-specific authentication flows:
//   Zomato/Swiggy/Rapido → Mobile + OTP
//   Uber → Email/Phone + OTP
//   Ola → Mobile + OTP
//   Google → Google Account (Email + Password)
// ============================================================

const API_BASE = '';
const connectedPlatforms = new Set();
let currentPlatform = null;
let otpTimerInterval = null;

const PLATFORM_INFO = {
  zomato: {
    name: 'Zomato', emoji: '<img src="/images/zomato.svg" class="real-icon">', type: 'Food Delivery',
    authType: 'phone',
    placeholder: 'Enter mobile number',
    loginLabel: 'Login with your Zomato account',
    otpMsg: 'Zomato will send an OTP to your mobile',
    verifyMsg: 'Verifying with Zomato servers...'
  },
  swiggy: {
    name: 'Swiggy', emoji: '<img src="/images/swiggy.svg" class="real-icon">', type: 'Food Delivery',
    authType: 'phone',
    placeholder: 'Enter mobile number',
    loginLabel: 'Login with your Swiggy account',
    otpMsg: 'Swiggy will send an OTP via SMS',
    verifyMsg: 'Connecting to your Swiggy account...'
  },
  uber: {
    name: 'Uber', emoji: '<img src="/images/uber.svg" class="real-icon">', type: 'Ride Booking',
    authType: 'email_phone',
    placeholder: 'Enter email or mobile number',
    loginLabel: 'Sign in to your Uber account',
    otpMsg: 'Uber will send a verification code',
    verifyMsg: 'Authenticating with Uber...'
  },
  ola: {
    name: 'Ola', emoji: '<img src="/images/ola.svg" class="real-icon">', type: 'Ride Booking',
    authType: 'phone',
    placeholder: 'Enter mobile number',
    loginLabel: 'Login with your Ola account',
    otpMsg: 'Ola will send an OTP to your number',
    verifyMsg: 'Connecting to your Ola account...'
  },
  rapido: {
    name: 'Rapido', emoji: '<img src="/images/rapido.svg" class="real-icon">', type: 'Bike & Auto',
    authType: 'phone',
    placeholder: 'Enter mobile number',
    loginLabel: 'Login with your Rapido account',
    otpMsg: 'Rapido will send an OTP via SMS',
    verifyMsg: 'Authenticating with Rapido...'
  },
  whatsapp: {
    name: 'WhatsApp', emoji: '<img src="/images/whatsapp.svg" class="real-icon">', type: 'Messaging',
    authType: 'phone',
    placeholder: 'Enter WhatsApp number',
    loginLabel: 'Connect your WhatsApp',
    otpMsg: 'WhatsApp will send OTP via SMS',
    verifyMsg: 'Linking WhatsApp for auto-messaging...'
  },
  gmail: {
    name: 'Gmail', emoji: '<img src="/images/gmail.svg" class="real-icon">', type: 'Email',
    authType: 'google',
    placeholder: 'Enter your Gmail address',
    loginLabel: 'Sign in to your Gmail',
    otpMsg: '',
    verifyMsg: 'Connecting Gmail for auto-emails...'
  },
  google: {
    name: 'Google Calendar', emoji: '<img src="/images/google.svg" class="real-icon">', type: 'Calendar',
    authType: 'google',
    placeholder: 'Enter your Gmail address',
    loginLabel: 'Sign in with Google',
    otpMsg: '',
    verifyMsg: 'Authenticating with Google...'
  }
};

// ─── INITIALIZATION ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const statusEl = document.getElementById('api-status');
    if (data.anakinConfigured) {
      statusEl.innerHTML = '<div class="dot green"></div> Anakin API Connected';
    } else {
      statusEl.innerHTML = '<div class="dot orange"></div> Demo Mode';
    }
  } catch {
    document.getElementById('api-status').innerHTML = '<div class="dot red"></div> Server Offline';
  }

  const saved = localStorage.getItem('dealpilot_connected');
  if (saved) {
    JSON.parse(saved).forEach(p => markConnected(p, false));
  }
});

// ─── OPEN LOGIN MODAL ──────────────────────────────────────
function connectPlatform(platform) {
  const card = document.querySelector(`[data-platform="${platform}"]`);
  if (card.classList.contains('connected')) {
    return disconnectPlatform(platform);
  }

  currentPlatform = platform;
  const info = PLATFORM_INFO[platform];
  const modal = document.getElementById('login-modal');
  const modalEl = modal.querySelector('.login-modal');

  // Set platform branding
  document.getElementById('modal-icon').innerHTML = info.emoji;
  document.getElementById('modal-title').textContent = `Connect ${info.name}`;
  document.getElementById('modal-subtitle').textContent = info.loginLabel;

  // Set platform class for accent colors
  modalEl.className = `login-modal ${platform}`;

  // Configure login UI based on auth type
  configureAuthUI(platform);

  // Show modal
  modal.classList.add('active');

  // Focus appropriate input
  setTimeout(() => {
    if (info.authType === 'google') {
      document.getElementById('email-input').focus();
    } else {
      document.getElementById('phone-input').focus();
    }
  }, 300);
}

// ─── CONFIGURE AUTH UI ─────────────────────────────────────
function configureAuthUI(platform) {
  const info = PLATFORM_INFO[platform];

  // Hide all steps first
  showStep('phone');

  // Show/hide appropriate sections
  const phoneSection = document.getElementById('phone-auth-section');
  const emailPhoneSection = document.getElementById('email-phone-auth-section');
  const googleSection = document.getElementById('google-auth-section');

  phoneSection.style.display = 'none';
  emailPhoneSection.style.display = 'none';
  googleSection.style.display = 'none';

  if (info.authType === 'google') {
    googleSection.style.display = 'block';
    document.getElementById('email-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('google-login-btn').disabled = false;
    document.getElementById('google-login-btn').textContent = 'Sign in with Google';
  } else if (info.authType === 'email_phone') {
    emailPhoneSection.style.display = 'block';
    document.getElementById('email-phone-input').value = '';
    document.getElementById('email-phone-input').placeholder = info.placeholder;
    document.getElementById('send-otp-btn-ep').disabled = true;
    document.getElementById('otp-note-ep').textContent = info.otpMsg;
  } else {
    phoneSection.style.display = 'block';
    document.getElementById('phone-input').value = '';
    document.getElementById('phone-input').placeholder = info.placeholder;
    document.getElementById('send-otp-btn').disabled = true;
    document.getElementById('otp-note').textContent = info.otpMsg;
  }

  // Reset OTP
  clearOTPBoxes();
  document.getElementById('verify-platform-name').textContent = info.name;
  document.getElementById('verify-subtext').textContent = `Setting up authenticated session via Anakin.io`;
}

// ─── MODAL CONTROLS ────────────────────────────────────────
function closeModal() {
  document.getElementById('login-modal').classList.remove('active');
  clearInterval(otpTimerInterval);
  currentPlatform = null;
}

function closeModalOutside(event) {
  if (event.target === event.currentTarget) closeModal();
}

function showStep(step) {
  ['phone', 'otp', 'verifying', 'success'].forEach(s => {
    document.getElementById(`step-${s}`).style.display = s === step ? 'block' : 'none';
  });
}

// ─── PHONE INPUT VALIDATION ────────────────────────────────
function validatePhone() {
  const phone = document.getElementById('phone-input').value.replace(/\D/g, '');
  document.getElementById('send-otp-btn').disabled = phone.length !== 10;
}

function validateEmailPhone() {
  const val = document.getElementById('email-phone-input').value.trim();
  const isEmail = val.includes('@') && val.includes('.');
  const isPhone = /^\d{10}$/.test(val.replace(/\D/g, ''));
  document.getElementById('send-otp-btn-ep').disabled = !(isEmail || isPhone);
}

function validateGoogleInputs() {
  const email = document.getElementById('email-input').value.trim();
  const pass = document.getElementById('password-input').value;
  const isValid = email.includes('@') && email.includes('.') && pass.length >= 4;
  document.getElementById('google-login-btn').disabled = !isValid;
}

// ─── SEND OTP (Phone) ──────────────────────────────────────
async function sendOTP() {
  const phone = document.getElementById('phone-input').value.replace(/\D/g, '');
  if (phone.length !== 10) return;

  const btn = document.getElementById('send-otp-btn');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  // Create Anakin browser session
  try {
    await fetch(`${API_BASE}/api/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: currentPlatform, phone: `+91${phone}` })
    });
  } catch (e) { console.log('[Login] Session:', e.message); }

  const masked = phone.substring(0, 2) + 'XXXXX' + phone.substring(7);
  document.getElementById('otp-sent-msg').innerHTML = `
    <span style="color:var(--accent-green)">✓ OTP sent by ${PLATFORM_INFO[currentPlatform].name}</span><br>
    <span style="font-size:0.82rem;color:var(--text-secondary)">to +91 ${masked}</span>
  `;

  await delay(800);
  showStep('otp');
  startOTPTimer();
  setTimeout(() => document.querySelector('.otp-box').focus(), 200);
  btn.textContent = 'Send OTP';

  // Auto-fill OTP after 2.5s (simulates receiving SMS)
  autoFillOTP();
}

// ─── SEND OTP (Email/Phone - Uber style) ───────────────────
async function sendOTPEmailPhone() {
  const val = document.getElementById('email-phone-input').value.trim();
  const btn = document.getElementById('send-otp-btn-ep');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    await fetch(`${API_BASE}/api/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: currentPlatform, credential: val })
    });
  } catch (e) { console.log('[Login] Session:', e.message); }

  const isEmail = val.includes('@');
  const masked = isEmail
    ? val.substring(0, 3) + '***@' + val.split('@')[1]
    : val.substring(0, 2) + 'XXXXX' + val.substring(7);

  document.getElementById('otp-sent-msg').innerHTML = `
    <span style="color:var(--accent-green)">✓ Verification code sent by ${PLATFORM_INFO[currentPlatform].name}</span><br>
    <span style="font-size:0.82rem;color:var(--text-secondary)">to ${masked}</span>
  `;

  await delay(800);
  showStep('otp');
  startOTPTimer();
  setTimeout(() => document.querySelector('.otp-box').focus(), 200);
  btn.textContent = `Send Code`;

  // Auto-fill OTP after 2.5s (simulates receiving code)
  autoFillOTP();
}

// ─── GOOGLE SIGN-IN ────────────────────────────────────────
async function googleSignIn() {
  const email = document.getElementById('email-input').value.trim();
  const pass = document.getElementById('password-input').value;

  if (!email.includes('@') || pass.length < 4) return;

  const btn = document.getElementById('google-login-btn');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  try {
    await fetch(`${API_BASE}/api/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'google', email })
    });
  } catch (e) { console.log('[Login] Google session:', e.message); }

  // Skip OTP for Google — go straight to verifying
  document.getElementById('verify-platform-name').textContent = 'Google';
  document.getElementById('verify-subtext').textContent = 'Authenticating with Google & syncing calendar...';
  showStep('verifying');

  try {
    await fetch(`${API_BASE}/api/sessions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'google' })
    });
  } catch (e) { console.log('[Login] Google confirm:', e.message); }

  await delay(2500);

  document.getElementById('success-text').textContent = 'Google Account Connected! ✨';
  document.getElementById('success-subtext').textContent = 'Calendar & account synced to BRO';
  showStep('success');
  markConnected('google', true);

  await delay(1500);
  closeModal();
}

// ─── OTP INPUT HANDLING ────────────────────────────────────
function handleOTPInput(input) {
  const value = input.value.replace(/\D/g, '');
  input.value = value;

  if (value) {
    input.classList.add('filled');
    const index = parseInt(input.dataset.index);
    const next = document.querySelector(`.otp-box[data-index="${index + 1}"]`);
    if (next) next.focus();
  } else {
    input.classList.remove('filled');
  }
  checkOTPComplete();
}

function handleOTPKeydown(event, input) {
  if (event.key === 'Backspace' && !input.value) {
    const index = parseInt(input.dataset.index);
    const prev = document.querySelector(`.otp-box[data-index="${index - 1}"]`);
    if (prev) { prev.focus(); prev.value = ''; prev.classList.remove('filled'); }
  }
}

function checkOTPComplete() {
  const boxes = document.querySelectorAll('.otp-box');
  const otp = Array.from(boxes).map(b => b.value).join('');
  document.getElementById('verify-otp-btn').disabled = otp.length !== 6;
}

function clearOTPBoxes() {
  document.querySelectorAll('.otp-box').forEach(box => {
    box.value = ''; box.classList.remove('filled');
  });
  document.getElementById('verify-otp-btn').disabled = true;
}

// ─── OTP TIMER ─────────────────────────────────────────────
function startOTPTimer() {
  let seconds = 30;
  const timerEl = document.getElementById('otp-timer');
  const resendBtn = document.getElementById('resend-btn');
  resendBtn.disabled = true;

  clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(() => {
    seconds--;
    timerEl.textContent = `00:${seconds.toString().padStart(2, '0')}`;
    if (seconds <= 0) {
      clearInterval(otpTimerInterval);
      timerEl.textContent = '';
      resendBtn.disabled = false;
    }
  }, 1000);
}

function resendOTP() {
  clearOTPBoxes();
  startOTPTimer();
  const info = PLATFORM_INFO[currentPlatform];
  document.getElementById('otp-sent-msg').innerHTML += `<br><span style="font-size:0.78rem;color:var(--accent-orange)">OTP resent by ${info.name}</span>`;
  document.querySelector('.otp-box').focus();
  // Auto-fill again
  autoFillOTP();
}

// ─── AUTO-FILL OTP (Simulates receiving OTP) ───────────────
async function autoFillOTP() {
  // Wait 2.5 seconds to simulate SMS delivery
  await delay(2500);

  // Generate a random 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const boxes = document.querySelectorAll('.otp-box');

  // Check if we're still on the OTP step
  if (document.getElementById('step-otp').style.display === 'none') return;

  // Fill each box one by one with typing animation
  for (let i = 0; i < 6; i++) {
    await delay(120); // typing speed
    boxes[i].value = otp[i];
    boxes[i].classList.add('filled');
    // Trigger visual feedback
    boxes[i].style.transform = 'scale(1.1)';
    setTimeout(() => { boxes[i].style.transform = 'scale(1)'; }, 150);
  }

  // Enable verify button
  document.getElementById('verify-otp-btn').disabled = false;

  // Show a subtle notification
  const msgEl = document.getElementById('otp-sent-msg');
  const platformName = PLATFORM_INFO[currentPlatform]?.name || 'Platform';
  msgEl.innerHTML += `<br><span style="font-size:0.78rem;color:var(--accent-green);animation:fadeInUp 0.3s ease;">📱 OTP received from ${platformName}</span>`;
}

// ─── VERIFY OTP ────────────────────────────────────────────
async function verifyOTP() {
  const boxes = document.querySelectorAll('.otp-box');
  const otp = Array.from(boxes).map(b => b.value).join('');
  if (otp.length !== 6) return;

  clearInterval(otpTimerInterval);
  const info = PLATFORM_INFO[currentPlatform];

  // Show verifying with platform-specific message
  document.getElementById('verify-platform-name').textContent = info.name;
  document.getElementById('verify-subtext').textContent = info.verifyMsg;
  showStep('verifying');

  try {
    await fetch(`${API_BASE}/api/sessions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: currentPlatform, otp })
    });
  } catch (e) { console.log('[Login] Confirm:', e.message); }

  await delay(2000);

  document.getElementById('success-text').textContent = `${info.name} Connected! ✨`;
  document.getElementById('success-subtext').textContent = `Your ${info.name} account is now linked to BRO`;
  showStep('success');
  markConnected(currentPlatform, true);

  await delay(1500);
  closeModal();
}

// ─── MARK CONNECTED ────────────────────────────────────────
function markConnected(platform, animate = true) {
  const card = document.querySelector(`[data-platform="${platform}"]`);
  if (!card) return;
  if (animate) card.style.transition = 'all 0.5s ease';
  card.classList.add('connected');
  card.querySelector('.status-text').textContent = '✓ Connected';
  connectedPlatforms.add(platform);
  updateCTA();
  saveState();
}

async function disconnectPlatform(platform) {
  const card = document.querySelector(`[data-platform="${platform}"]`);
  card.classList.remove('connected');
  card.querySelector('.status-text').textContent = 'Connect';
  connectedPlatforms.delete(platform);
  try {
    await fetch(`${API_BASE}/api/sessions/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform })
    });
  } catch {}
  updateCTA();
  saveState();
}

// ─── HELPERS ───────────────────────────────────────────────
function updateCTA() {
  const btn = document.getElementById('continue-btn');
  const hint = document.getElementById('cta-hint');
  const count = connectedPlatforms.size;
  if (count >= 1) {
    if (btn) btn.disabled = false;
    if (hint) hint.textContent = `${count} platform${count > 1 ? 's' : ''} connected — you're ready!`;
  } else {
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = 'Connect at least 1 platform to continue';
  }
}

function saveState() {
  localStorage.setItem('dealpilot_connected', JSON.stringify([...connectedPlatforms]));
}

function saveState() {
  localStorage.setItem('dealpilot_connected', JSON.stringify([...connectedPlatforms]));
}

function goToDashboard() {
  if (connectedPlatforms.size >= 1) window.location.href = '/dashboard';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
