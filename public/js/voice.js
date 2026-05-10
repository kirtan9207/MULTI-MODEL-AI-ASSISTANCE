// ============================================================
// DealPilot — Voice Module
// Web Speech API for voice input and speech synthesis output
// ============================================================

let recognition = null;
let isListening = false;
let speechSynthesis = window.speechSynthesis;

// Initialize Speech Recognition
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[Voice] Speech Recognition not supported in this browser');
    document.getElementById('mic-label').textContent = 'Voice not supported — use text input';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN'; // Indian English
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    updateMicUI(true);
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const box = document.getElementById('transcript-box');
    if (finalTranscript) {
      box.textContent = finalTranscript;
      box.classList.add('has-text');
      // Process the final command
      processVoiceCommand(finalTranscript);
    } else if (interimTranscript) {
      box.textContent = interimTranscript + '...';
      box.classList.add('has-text');
    }
  };

  recognition.onerror = (event) => {
    console.error('[Voice] Error:', event.error);
    isListening = false;
    updateMicUI(false);

    if (event.error === 'not-allowed') {
      document.getElementById('mic-label').textContent = 'Microphone access denied — use text input';
    }
  };

  recognition.onend = () => {
    isListening = false;
    updateMicUI(false);
  };
}

function toggleMic() {
  if (!recognition) {
    initVoice();
    if (!recognition) return;
  }

  if (isListening) {
    recognition.stop();
  } else {
    // Reset transcript
    const box = document.getElementById('transcript-box');
    box.textContent = 'Listening...';
    box.classList.remove('has-text');

    try {
      recognition.start();
    } catch (e) {
      console.error('[Voice] Start error:', e);
    }
  }
}

function updateMicUI(listening) {
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');

  if (listening) {
    micBtn.classList.add('listening');
    micLabel.textContent = 'Listening... Speak now';
    micLabel.classList.add('active');
  } else {
    micBtn.classList.remove('listening');
    micLabel.textContent = 'Tap to speak';
    micLabel.classList.remove('active');
  }
}

// Text-to-Speech output
function speak(text) {
  if (!speechSynthesis) return;

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to use an Indian English voice
  const voices = speechSynthesis.getVoices();
  const indianVoice = voices.find(v => v.lang === 'en-IN') ||
                      voices.find(v => v.lang.startsWith('en'));
  if (indianVoice) utterance.voice = indianVoice;

  // Show voice response UI
  const bar = document.getElementById('voice-response-bar');
  const textEl = document.getElementById('voice-response-text');
  if (bar && textEl) {
    textEl.textContent = text;
    bar.classList.add('active');
  }

  utterance.onend = () => {
    // Keep the bar visible
  };

  speechSynthesis.speak(utterance);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initVoice();
  // Pre-load voices
  if (speechSynthesis) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }
});
