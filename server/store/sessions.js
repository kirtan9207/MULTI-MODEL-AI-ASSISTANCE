// ============================================================
// DealPilot — In-Memory Session Store
// Stores user's connected platform sessions (sessionIds)
// ============================================================

// In a real app, this would be a database.
// For the hackathon, in-memory is fine.

const sessions = {
  // Structure:
  // userId: {
  //   zomato:  { sessionId, connected, connectedAt },
  //   swiggy:  { sessionId, connected, connectedAt },
  //   uber:    { sessionId, connected, connectedAt },
  //   ola:     { sessionId, connected, connectedAt },
  //   rapido:  { sessionId, connected, connectedAt },
  //   google:  { tokens, connected, connectedAt }
  // }
};

const DEFAULT_USER = 'demo-user';

function getUserSessions(userId = DEFAULT_USER) {
  if (!sessions[userId]) {
    sessions[userId] = {};
  }
  return sessions[userId];
}

function savePlatformSession(platform, sessionData, userId = DEFAULT_USER) {
  if (!sessions[userId]) sessions[userId] = {};
  sessions[userId][platform] = {
    ...sessionData,
    connected: true,
    connectedAt: new Date().toISOString()
  };
}

function getPlatformSession(platform, userId = DEFAULT_USER) {
  return sessions[userId]?.[platform] || null;
}

function getConnectedPlatforms(userId = DEFAULT_USER) {
  const userSessions = sessions[userId] || {};
  return Object.entries(userSessions)
    .filter(([_, data]) => data.connected)
    .map(([platform, data]) => ({
      platform,
      connectedAt: data.connectedAt
    }));
}

function disconnectPlatform(platform, userId = DEFAULT_USER) {
  if (sessions[userId]?.[platform]) {
    sessions[userId][platform].connected = false;
  }
}

module.exports = {
  getUserSessions,
  savePlatformSession,
  getPlatformSession,
  getConnectedPlatforms,
  disconnectPlatform
};
