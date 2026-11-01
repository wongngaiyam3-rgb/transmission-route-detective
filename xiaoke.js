/* Public UI only. Gemini credentials and moderation stay on the existing server. */
(() => {
  'use strict';
  const API = 'https://science-curiosity-lab.ilovetsr089.chatgpt.site';
  const SOURCE = '【傳播路線偵探｜小四科學】\n';
  const byId = id => document.getElementById(id);
  const launcher = byId('xiaoke-launcher'), panel = byId('xiaoke-panel');
  const entry = byId('xiaoke-entry'), chat = byId('xiaoke-chat');
  const entryForm = byId('xiaoke-entry-form'), askForm = byId('xiaoke-ask-form');
  const classSelect = byId('xiaoke-class'), numberSelect = byId('xiaoke-number');
  const start = byId('xiaoke-start'), question = byId('xiaoke-question');
  const send = byId('xiaoke-send'), messages = byId('xiaoke-messages');
  const status = byId('xiaoke-status'), connection = byId('xiaoke-connection');
  const reconnect = byId('xiaoke-reconnect'), suggestions = byId('xiaoke-suggestions');
  let config = null, identity = null, busy = false, sequence = 0, controller = null;
  let configSequence = 0, connecting = false;

  for (let n = 1; n <= 25; n++) numberSelect.add(new Option(`${n} 號`, String(n)));
  const validEntry = () => ['4A', '4B', '4C'].includes(classSelect.value) && /^(?:[1-9]|1[0-9]|2[0-5])$/.test(numberSelect.value);
  function controls() {
    start.disabled = !config || connecting || !validEntry();
    send.disabled = !identity || busy || !question.value.trim();
    question.disabled = busy;
    suggestions.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    send.textContent = busy ? '安全檢查中…' : '問問小科 ↑';
    byId('xiaoke-counter').textContent = `${question.value.length} / 360 字`;
  }
  async function connect() {
    const turn = ++configSequence;
    connecting = true; config = null; connection.textContent = '正在連接小科…'; reconnect.hidden = true; controls();
    try {
      const response = await fetch(API + '/api/config', {credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(15000)});
      const data = await response.json();
      if (!response.ok || data.mode !== 'live' || !/^\d{4}-\d{4}$/.test(data.academicYear)) throw new Error('unavailable');
      if (turn !== configSequence) return;
      config = data; connection.textContent = '● 小科已連線・提問前後均設安全審查';
    } catch {
      if (turn !== configSequence) return;
      connection.textContent = '小科暫時未能連線。可以先繼續任務，稍後再試。'; reconnect.hidden = false;
    } finally {
      if (turn === configSequence) { connecting = false; controls(); }
    }
  }
  function open() {
    if (!panel.open) panel.showModal();
    launcher.setAttribute('aria-expanded', 'true');
    if (!identity && !connecting) connect();
    if (identity) question.focus(); else classSelect.focus();
  }
  launcher.addEventListener('click', open);
  byId('xiaoke-close').addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => { launcher.setAttribute('aria-expanded','false'); launcher.focus(); });
  reconnect.addEventListener('click', connect);
  [classSelect, numberSelect].forEach(select => select.addEventListener('change', controls));
  entryForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!config || !validEntry() || connecting) return;
    identity = Object.freeze({className:classSelect.value, number:Number(numberSelect.value), academicYear:config.academicYear});
    entry.hidden = true; chat.hidden = false; askForm.hidden = false;
    byId('xiaoke-student-label').textContent = `${identity.className} ・ ${identity.number} 號`;
    controls(); question.focus();
  });
  byId('xiaoke-switch').addEventListener('click', () => {
    sequence++; controller?.abort(); controller = null; identity = null; busy = false;
    messages.replaceChildren(); status.textContent = ''; question.value = '';
    classSelect.value = ''; numberSelect.value = ''; suggestions.hidden = false;
    chat.hidden = true; askForm.hidden = true; entry.hidden = false;
    connect(); classSelect.focus();
  });
  question.addEventListener('input', controls);
  suggestions.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || busy || !identity) return;
    question.value = button.textContent; controls(); question.focus();
  });
  function addMessage(kind, text) {
    const article = document.createElement('article');
    article.className = `xiaoke-message xiaoke-${kind}`;
    if (text) article.textContent = text;
    messages.append(article);
    // Keep only the latest questions in memory, never in local/session storage.
    while (messages.children.length > 24) messages.firstElementChild.remove();
    return article;
  }
  function scrollMessages() { const body = panel.querySelector('.xiaoke-body'); body.scrollTop = body.scrollHeight; }
  askForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = question.value.trim();
    if (!identity || busy || !text || text.length > 360) return;
    const enrollment = identity, turn = ++sequence, abort = new AbortController();
    controller = abort; busy = true; suggestions.hidden = true;
    addMessage('user', text); question.value = ''; status.textContent = '小科正在檢查提問、準備解說及審查回答…'; controls(); scrollMessages();
    const timeout = setTimeout(() => abort.abort(), 145000);
    try {
      const response = await fetch(API + '/api/ask', {method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'}, body:JSON.stringify({identity:enrollment, question:SOURCE + text}), signal:abort.signal});
      const data = await response.json();
      if (turn !== sequence || identity !== enrollment) return;
      if (!response.ok) {
        const message = typeof data.error === 'string' && data.error.length <= 700 ? data.error : '小科暫時未能完成安全檢查，請稍後再試。';
        addMessage('error', message);
        if (data.code === 'entry_required') { byId('xiaoke-switch').click(); return; }
      } else {
        if (data.mode !== 'live' || !data.answer || !['explanation','example','followup'].every(key => typeof data.answer[key] === 'string' && data.answer[key].trim() && data.answer[key].length <= 1600)) throw new Error('invalid_response');
        const article = addMessage('answer');
        for (const [key, title] of [['explanation','✦ 科學小解說'],['example','生活中的例子'],['followup','換你想一想']]) {
          const heading = document.createElement('h3'), paragraph = document.createElement('p');
          heading.textContent = title; paragraph.textContent = data.answer[key]; article.append(heading, paragraph);
        }
        const note = document.createElement('p'); note.className = 'xiaoke-answer-note'; note.textContent = 'AI 回答・請與老師一起核對'; article.append(note);
      }
    } catch {
      if (turn === sequence && identity === enrollment) addMessage('error', '連線或安全檢查暫時未能完成，本次不會顯示 AI 回答。請稍後再試。');
    } finally {
      clearTimeout(timeout);
      if (turn === sequence && identity === enrollment) { busy = false; controller = null; status.textContent = ''; controls(); scrollMessages(); if (panel.open) question.focus(); }
    }
  });
  window.addEventListener('pagehide', () => {
    sequence++; controller?.abort(); controller = null; busy = false;
    status.textContent = ''; controls();
  });
  controls();
})();
