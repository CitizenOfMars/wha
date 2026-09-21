const draft = document.querySelector("#draft");
const coachCard = document.querySelector("#coachCard");
const suggestionText = document.querySelector("#suggestionText");
const coachReason = document.querySelector("#coachReason");
const labelPill = document.querySelector("#labelPill");
const sendButton = document.querySelector("#sendButton");
const messages = document.querySelector("#messages");
const promptChips = document.querySelectorAll(".prompt-chip");
const resetButton = document.querySelector("#resetSession");
let timer;
let currentSuggestion = "";

const state = { messages: [] };

 async function loadMessages() {
  try {
    const response = await fetch('/api/messages');
    if (!response.ok) throw new Error('Failed to load messages');
    state.messages = await response.json();
    renderMessages();
  } catch (error) {
    console.error(error);
    state.messages = [];
    renderMessages();
  }
}

function now() {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function renderMessages() {
  const entries = state.messages || [];
  const html = [
    '<div class="date-divider"><span>Today</span></div>',
    ...entries.map((message) => {
      const isYou = message.you === true;
      const meta = isYou
        ? `<strong>G1P2 <span style="color:#8579de;font-size:10px">(you)</span></strong><time>${message.time || now()}</time>`
        : `<strong>${message.speaker}</strong><time>${message.time || now()}</time>`;

      return `
        <article class="message">
          <span class="avatar ${message.avatar || 'purple'}">${message.badge || 'P'}</span>
          <div>
            <div class="message-meta">${meta}</div>
            <p>${message.text}</p>
          </div>
        </article>
      `;
    })
  ].join('');

  messages.innerHTML = html;
  messages.scrollTop = messages.scrollHeight;
}

async function getCoachSuggestion(text) {
  const response = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft: text })
  });

  if (!response.ok) {
    throw new Error('Coach request failed');
  }

  return response.json();
}

async function showSuggestion() {
  const text = draft.value.trim();
  if (text.length < 4) {
    coachCard.classList.add('hidden');
    return;
  }

  try {
    const result = await getCoachSuggestion(text);
    currentSuggestion = result.suggestion;
    labelPill.textContent = result.label;
    coachReason.textContent = result.reason;
    suggestionText.textContent = `“${result.suggestion}”`;
    coachCard.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    coachCard.classList.add('hidden');
  }
}

async function sendMessage() {
  const text = draft.value.trim();
  if (!text) return;

  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker: 'G1P2' })
    });

    if (!response.ok) {
      throw new Error('Unable to save message');
    }

    const data = await response.json();
    state.messages.push(data.message);
    renderMessages();
  } catch (error) {
    console.error(error);
  }

  draft.value = '';
  sendButton.disabled = true;
  coachCard.classList.add('hidden');

  setTimeout(async () => {
    try {
      const response = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'That sounds good. Let’s make sure we also account for the people affected.' })
      });

      if (!response.ok) throw new Error('Reply failed');

      const data = await response.json();
      state.messages.push(data.message);
      renderMessages();
    } catch (error) {
      console.error(error);
    }
  }, 350);
}

draft.addEventListener('input', () => {
  sendButton.disabled = !draft.value.trim();
  clearTimeout(timer);
  timer = setTimeout(showSuggestion, 650);
});

promptChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    draft.value = chip.dataset.prompt;
    sendButton.disabled = false;
    showSuggestion();
    draft.focus();
  });
});

document.querySelector('#useButton').addEventListener('click', () => {
  draft.value = currentSuggestion;
  sendButton.disabled = false;
  coachCard.classList.add('hidden');
  draft.focus();
});

document.querySelector('#dismissButton').addEventListener('click', () => coachCard.classList.add('hidden'));

sendButton.addEventListener('click', sendMessage);
draft.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

resetButton.addEventListener('click', async () => {
  const confirmed = window.confirm('Reset the session and restore the original discussion?');
  if (!confirmed) return;

  try {
    const response = await fetch('/api/reset', { method: 'POST' });
    if (!response.ok) throw new Error('Reset failed');
    const payload = await response.json();
    state.messages = payload.messages || [];
    renderMessages();
  } catch (error) {
    console.error(error);
  }

  draft.value = '';
  sendButton.disabled = true;
  coachCard.classList.add('hidden');
});

const dialog = document.querySelector('#infoDialog');
document.querySelector('#infoButton').addEventListener('click', () => dialog.showModal());
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
document.querySelector('#gotIt').addEventListener('click', () => dialog.close());

loadMessages();
sendButton.disabled = true;
