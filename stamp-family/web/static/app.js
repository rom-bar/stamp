(() => {
  'use strict';
  const DB_NAME = 'stamp-family-cache-v1';
  const STORE = 'kv';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let db;
  let snapshot = null;
  let profile = null;
  let onlineSession = false;
  let sessionRequired = false;
  let syncPromise = null;
  let manualSyncing = false;
  let lastSyncAt = null;
  let queueChain = Promise.resolve();
  let audioContext = null;
  let celebrationTimer = null;
  let localJournals = [];
  let mediaCache = {};
  let selectedJournalMedia = [];
  let mediaProcessing = Promise.resolve();
  let calendarView = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = localDateValue();
  let drawingActive = false;
  let drawingInProgress = false;
  let canvasBackground = 'blank';
  let canvasErasing = false;
  let canvasHistory = [];
  let coloringTool = 'brush';
  let coloringColor = '#f05d8b';
  let coloringHistory = [];
  let coloringTemplateID = 'blank';
  let coloringHasChanges = false;
  let coloringInProgress = false;
  let coloringLoadToken = 0;
  const MAX_CANVAS_HISTORY = 20;
  const MAX_COLORING_HISTORY = 20;
  const reactionChoices = ['❤️', '👏', '😂', '🌟', '🤗', '👍'];
  const coloringCategories = window.STAMP_COLORING_CATEGORIES || [];
  const coloringTemplates = coloringCategories.flatMap(category => (category.templates || []).map(template => ({ ...template, category:category.name })));
  let activeColoringCategory = 'Semua';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function kvGet(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }
  function kvSet(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, value });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  function kvDelete(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  function withQueueLock(fn) {
    const task = queueChain.then(fn, fn);
    queueChain = task.catch(() => {});
    return task;
  }
  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
  function keyFor(type) { return `${type}:${profile.id}`; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID().replaceAll('-', '') : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function dateText(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }
  function notify(text, type = '') {
    const box = $('#notice');
    box.textContent = text;
    box.className = `notice ${type}`.trim();
    box.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => { box.hidden = true; }, 5000);
  }
  function prepareStampAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    } catch (_) { return null; }
  }
  function playStampSound(context) {
    if (!context || context.state === 'closed') return;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(.72, now);
    master.connect(context.destination);
    const note = (frequency, delay, duration, volume, type = 'sine') => {
      const start = now + delay;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + .025);
    };
    note(392, 0, .12, .055, 'triangle');
    note(659.25, .025, .23, .085);
    note(830.61, .105, .29, .07);
    note(987.77, .19, .36, .065);
    note(1318.51, .28, .48, .07);
    note(2637.02, .29, .3, .018);
  }
  function closeStampCelebration() {
    const overlay = $('#stamp-celebration');
    if (!overlay) return;
    clearTimeout(celebrationTimer);
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }
  function showStampCelebration(child, reason) {
    const overlay = $('#stamp-celebration');
    const icon = $('#celebration-stamp');
    if (!overlay || !icon) return;
    icon.textContent = reason?.emoji || '⭐';
    icon.style.setProperty('--stamp-color', '#f2eadb');
    $('#celebration-detail').textContent = `${child?.name || 'Anak'}${reason?.name ? ` · ${reason.name}` : ''}`;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(closeStampCelebration, 2600);
  }
  function showGate(message) {
    document.body.innerHTML = `<main class="login-page"><section class="login-card"><div class="brand-mark">✦</div><p class="eyebrow">BUKU KELUARGA</p><h1>${esc(message)}</h1><p class="muted">Login pertama memerlukan koneksi ke server. Setelah data dimuat di perangkat ini, aplikasi dapat dipakai offline.</p><p style="margin-top:24px"><a class="button primary" href="/">Kembali ke login</a></p></section></main>`;
  }
  function currentQueue() { return kvGet(keyFor('queue')); }
  async function persistSnapshot(s) {
    snapshot = s;
    if (s.user) profile = s.user;
    await kvSet(keyFor('snapshot'), s);
    if (s.user) {
      localStorage.setItem('stampFamilyProfile', JSON.stringify(profile));
    }
  }
  function projected() {
    if (!snapshot) return null;
    const state = deepCopy(snapshot);
    state.journals = state.journals || [];
    state.activities = state.activities || [];
    state.journalComments = state.journalComments || [];
    state.journalReactions = state.journalReactions || [];
    const queue = window.__pending || [];
    for (const op of queue) applyLocally(state, op);
    state.journals.push(...localJournals);
    return state;
  }
  function applyLocally(state, op) {
    const p = op.payload || {};
    const now = op.createdAt || new Date().toISOString();
    switch (op.kind) {
      case 'child.add': state.children.push({ id:p.id, name:p.name, color:p.color, createdAt:now }); break;
      case 'reason.add': state.reasons.push({ id:p.id, name:p.name, emoji:p.emoji || '⭐', active:true }); break;
      case 'design.add': state.designs.push({ id:p.id, name:p.name, emoji:p.emoji || '⭐', color:p.color || '#F2B66D', active:true }); break;
      case 'reward.add': state.rewards.push({ id:p.id, name:p.name, description:p.description || '', goal:Number(p.goal), active:true }); break;
      case 'stamp.give': state.stamps.push({ id:p.id, childId:p.childId, reasonId:p.reasonId, designId:p.designId, createdBy:profile.id, createdAt:now, pending:true }); break;
      case 'reward.redeem': {
        const reward = state.rewards.find(x => x.id === p.rewardId);
        if (reward) state.redemptions.push({ id:p.id, childId:p.childId, rewardId:p.rewardId, cost:reward.goal, createdBy:profile.id, createdAt:now, pending:true });
        break;
      }
      case 'journal.add':
        state.journals.push({ id:p.id, date:p.date, title:p.title || '', body:p.body || '', drawing:p.drawing || '', media:p.media || [], activityId:p.activityId || '', createdBy:profile.id, createdByName:profile.username, createdAt:now, shared:true, pending:true });
        break;
      case 'activity.add':
        state.activities.push({ id:p.id, date:p.date, title:p.title || '', prompt:p.prompt || '', kind:'challenge', time:'', assigneeId:'all', createdBy:profile.id, createdAt:now, pending:true });
        break;
      case 'calendar.add':
        state.activities.push({ id:p.id, date:p.date, time:p.time, title:p.title || '', prompt:p.description || '', kind:p.kind, assigneeId:p.assigneeId || 'all', createdBy:profile.id, createdAt:now, pending:true });
        break;
      case 'journal.comment.add':
        state.journalComments.push({ id:p.id, journalId:p.journalId, userId:profile.id, username:profile.username, body:p.body, createdAt:now, pending:true });
        break;
      case 'journal.react.toggle': {
        const index = state.journalReactions.findIndex(x => x.journalId === p.journalId && x.userId === profile.id && x.emoji === p.emoji);
        if (index >= 0) state.journalReactions.splice(index, 1);
        else state.journalReactions.push({ id:p.id, journalId:p.journalId, userId:profile.id, username:profile.username, emoji:p.emoji, createdAt:now, pending:true });
        break;
      }
    }
  }
  function childTotals(state, childId) {
    const earned = state.stamps.filter(x => x.childId === childId).length;
    const spent = state.redemptions.filter(x => x.childId === childId).reduce((n,x) => n + Number(x.cost || 0), 0);
    return { earned, spent, available: Math.max(0, earned - spent) };
  }
  function updateSyncStatus(message) {
    const pill = $('#sync-pill');
    if (!pill) return;
    const pending = (window.__pending || []).length;
    pill.classList.toggle('offline', !navigator.onLine || !onlineSession);
    pill.classList.toggle('error', sessionRequired || (!!message && message.includes('gagal')));
    $('#sync-label').textContent = sessionRequired ? 'Login ulang diperlukan' : ((!navigator.onLine || !onlineSession) ? (pending ? `${pending} perubahan offline` : 'Offline · data tersimpan') : (pending ? `${pending} menunggu sinkron` : (message || 'Tersinkron')));
    $('#pending-footer').textContent = pending ? `${pending} perubahan menunggu sinkronisasi` : 'Perubahan tersinkron';
    const moreStatus = $('#more-sync-status');
    if (moreStatus) moreStatus.textContent = sessionRequired ? 'Perlu login ulang' : ((!navigator.onLine || !onlineSession) ? 'Offline' : (pending ? 'Menunggu sinkronisasi' : 'Tersinkron'));
  }
  function setManualSyncStatus(message, tone = '') {
    const status = $('#manual-sync-status');
    if (!status) return;
    status.textContent = message;
    status.className = `sync-control-status ${tone}`.trim();
  }
  function renderManualSyncInfo() {
    const last = $('#manual-sync-last-sync');
    if (!last) return;
    if (!lastSyncAt) {
      last.textContent = 'Sinkronisasi terakhir: belum ada di perangkat ini.';
      return;
    }
    const date = new Date(lastSyncAt);
    last.textContent = Number.isNaN(date.getTime())
      ? 'Sinkronisasi terakhir: waktu tidak diketahui.'
      : `Sinkronisasi terakhir: ${new Intl.DateTimeFormat('id-ID', { dateStyle:'medium', timeStyle:'short' }).format(date)}`;
  }
  function fillSelects(state) {
    const children = state.children || [];
    const reasons = state.reasons.filter(x => x.active !== false);
    const fill = (selector, values, label, placeholder) => {
      $$(selector).forEach(el => {
        const old = el.value;
        el.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.map(x => `<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('');
        if (values.some(x => x.id === old)) el.value = old;
      });
    };
    fill('[data-child-select]', children, x => x.name, children.length ? 'Pilih anak' : 'Tambahkan anak dulu');
    fill('[data-reason-select]', reasons, x => `${x.emoji || '⭐'} ${x.name}`, reasons.length ? 'Pilih alasan' : 'Tambahkan alasan dulu');
  }
  function render() {
    const state = projected();
    if (!state) return;
    $('#family-label').textContent = state.family?.name || 'Keluarga';
    $('#welcome-title').textContent = `Halo, ${state.user?.username || 'keluarga'}!`;
    $('#welcome-subtitle').textContent = `${state.family?.name || 'Keluarga'} · ${state.user?.role === 'admin' ? 'Admin keluarga' : 'Anggota'}`;
    $('#more-family-name').textContent = state.family?.name || 'Keluarga';
    $('#more-user-name').textContent = `${state.user?.username || 'Akun'} · ${state.user?.role === 'admin' ? 'Admin keluarga' : 'Anggota'}`;
    $('#child-count').textContent = `${state.children.length} ${state.children.length === 1 ? 'anak' : 'anak'}`;
    const isAdmin = state.user?.role === 'admin';
    $$('[data-admin-only], [data-admin-tab]').forEach(el => el.hidden = !isAdmin);
    $$('[data-member-only]').forEach(el => el.hidden = isAdmin);
    if (!isAdmin) $$('.setup-card .compact-form').forEach(el => el.hidden = true);
    fillSelects(state);
    renderDashboard(state);
    renderCollection(state);
    renderRewards(state);
    renderSetup(state);
    renderJournal(state);
    renderActivities(state);
    renderCalendar(state);
    renderWeeklyMemories(state);
    updateSyncStatus();
  }
  function renderDashboard(state) {
    const root = $('#dashboard-children');
    $('#dashboard-empty').hidden = state.children.length > 0;
    root.innerHTML = state.children.map(child => {
      const { earned, available } = childTotals(state, child.id);
      const target = state.rewards.filter(x => x.active).map(x => x.goal).sort((a,b) => a-b)[0] || 5;
      const progress = Math.min(100, Math.round((available % target) / target * 100));
      return `<article class="child-card" style="--child-color:${esc(child.color || '#f2b66d')}"><div class="child-head"><div class="child-avatar">${esc((child.name || '?').slice(0,1).toUpperCase())}</div><div><div class="child-name">${esc(child.name)}</div><div class="muted" style="font-size:11px">${available} tersedia · ${earned} terkumpul</div></div></div><div class="child-stats"><div><span class="big-number">${available}<small> stamp</small></span><div class="child-progress"><span style="width:${progress}%"></span></div></div><button class="button secondary" data-focus-child="${esc(child.id)}">Lihat koleksi</button></div></article>`;
    }).join('');
    $$('[data-focus-child]').forEach(btn => btn.onclick = () => { $('#collection-child').value = btn.dataset.focusChild; switchTab('collection'); renderCollection(state); });
  }
  function renderCollection(state) {
    const select = $('#collection-child');
    const childId = select?.value || state.children[0]?.id || '';
    if (!select || !childId) { $('#collection-summary').innerHTML = ''; $('#stamp-list').innerHTML = '<div class="empty-state compact">Tambahkan anak dan beri stamp untuk mulai mengisi koleksi.</div>'; $('#collection-total').textContent = '0 stamp'; return; }
    select.value = childId;
    const child = state.children.find(x => x.id === childId);
    const list = state.stamps.filter(x => x.childId === childId).slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totals = childTotals(state, childId);
    $('#collection-total').textContent = `${list.length} stamp`;
    $('#collection-summary').innerHTML = `<div><strong>${esc(child?.name || '')}</strong><div class="muted" style="font-size:11px">${totals.earned} terkumpul · ${totals.spent} ditukar</div></div><span class="count-badge">${totals.available} tersedia</span>`;
    $('#stamp-list').innerHTML = list.length ? list.map(stamp => {
      const design = state.designs.find(x => x.id === stamp.designId) || {emoji:'⭐',name:'Stamp'};
      const reason = state.reasons.find(x => x.id === stamp.reasonId) || {name:'Usaha hebat'};
      const emoji = reason.emoji || design.emoji || '⭐';
      return `<article class="stamp-row"><div class="stamp-emoji" style="background:${esc(design.color || '#f4ead7')}">${esc(emoji)}</div><div class="stamp-info"><strong>${esc(emoji)} Stamp${stamp.pending ? ' · menunggu sinkron' : ''}</strong><span>${esc(reason.name)}</span></div><span class="stamp-date">${esc(dateText(stamp.createdAt))}</span></article>`;
    }).join('') : '<div class="empty-state compact">Belum ada stamp di koleksi ini.</div>';
  }
  function renderRewards(state) {
    const select = $('#reward-child');
    const childId = select?.value || state.children[0]?.id || '';
    if (select && childId) select.value = childId;
    const totals = childId ? childTotals(state, childId) : { available:0 };
    $('#reward-balance').textContent = `${totals.available} stamp tersedia`;
    const rewards = state.rewards.filter(x => x.active);
    $('#reward-empty').hidden = rewards.length > 0;
    $('#reward-list').innerHTML = rewards.map(reward => {
      const ready = totals.available >= reward.goal && !!childId;
      const description = reward.description ? `<p>${esc(reward.description)}</p>` : '<p>Hadiah kecil untuk usaha besar.</p>';
      return `<article class="reward-card"><span class="reward-icon setup-icon" aria-hidden="true">🎁</span><div class="reward-copy"><h3>${esc(reward.name)}</h3>${description}<div class="reward-meta"><span>Butuh ${reward.goal} stamp</span><span>${ready ? 'Siap ditukar' : `${Math.max(0,reward.goal-totals.available)} lagi`}</span></div></div><button class="button ${ready?'primary':'secondary'} full" data-redeem="${esc(reward.id)}" ${ready?'':'disabled'}>Tukarkan untuk ${esc(state.children.find(x=>x.id===childId)?.name || 'anak')}</button></article>`;
    }).join('');
    $$('[data-redeem]').forEach(btn => btn.onclick = async () => {
      const reward = state.rewards.find(x => x.id === btn.dataset.redeem);
      if (!reward || !childId || childTotals(state, childId).available < reward.goal) return;
      await enqueue('reward.redeem', { id:uuid(), childId, rewardId:reward.id });
      notify(`Hadiah “${reward.name}” ditukar.`, 'success');
    });
  }
  function renderSetup(state) {
    const item = (icon, name, detail='') => `<div class="managed-item"><span>${icon} ${esc(name)}</span><span>${esc(detail)}</span></div>`;
    $('#setup-children').innerHTML = state.children.length ? state.children.map(x => item('●',x.name,'Anak')).join('') : '<span class="muted" style="font-size:11px">Belum ada anak.</span>';
    $('#setup-reasons').innerHTML = state.reasons.length ? state.reasons.map(x => item(x.emoji||'⭐',x.name,'Alasan')).join('') : '<span class="muted" style="font-size:11px">Belum ada alasan.</span>';
    $('#setup-rewards').innerHTML = state.rewards.length ? state.rewards.map(x => item('🎁',x.name,`${x.goal} stamp`)).join('') : '<span class="muted" style="font-size:11px">Belum ada hadiah.</span>';
  }
  function journalDateLabel(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date);
  }
  function renderJournal(state) {
    const root = $('#journal-list');
    if (!root) return;
    const filter = $('#journal-filter')?.value || '';
    const entries = (state.journals || []).filter(entry => !filter || entry.date === filter).slice().sort((a,b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    if (!entries.length) {
      root.innerHTML = `<div class="journal-empty">${filter ? 'Belum ada kenangan pada tanggal ini.' : 'Belum ada catatan. Tulis atau gambar kenangan pertama keluarga di atas.'}</div>`;
      return;
    }
    const groups = new Map();
    for (const entry of entries) {
      const date = entry.date || '';
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(entry);
    }
    root.innerHTML = [...groups].map(([date, items]) => `<section class="journal-day"><h3 class="journal-day-heading">${esc(journalDateLabel(date))}</h3>${items.map(entry => {
      const badge = entry.pending ? 'Menunggu sinkron' : (entry.shared ? 'Dibagikan' : 'Pribadi');
      const drawing = /^(data:image\/(jpeg|png);base64,)/.test(entry.drawing || '') ? `<img src="${esc(entry.drawing)}" alt="Gambar kenangan ${esc(entry.title || 'keluarga')}">` : '';
      const media = (entry.media || []).map(item => {
        const source = mediaCache[item.id] || `/api/media/${encodeURIComponent(item.id)}`;
        const label = `Lampiran kenangan ${entry.title || 'keluarga'}`;
        return item.type?.startsWith('video/')
          ? `<figure class="journal-media-item" data-media-id="${esc(item.id)}"><video src="${esc(source)}" controls preload="metadata" playsinline aria-label="${esc(label)}"></video></figure>`
          : `<figure class="journal-media-item" data-media-id="${esc(item.id)}"><img src="${esc(source)}" alt="${esc(label)}"></figure>`;
      }).join('');
      const mediaGrid = media ? `<div class="journal-media-grid">${media}</div>` : '';
      const body = entry.body ? `<p>${esc(entry.body)}</p>` : '';
      const activity = entry.activityId ? (state.activities || []).find(x => x.id === entry.activityId) : null;
      const author = entry.createdByName || (entry.createdBy === state.user?.id ? state.user.username : 'Anggota keluarga');
      const reactions = (state.journalReactions || []).filter(x => x.journalId === entry.id);
      const reactionBar = entry.shared ? `<div class="journal-reactions" aria-label="Reaksi keluarga">${reactionChoices.map(emoji => {
        const matches = reactions.filter(x => x.emoji === emoji);
        const mine = matches.some(x => x.userId === state.user?.id);
        return `<button class="reaction-button${mine?' selected':''}" type="button" data-react-entry="${esc(entry.id)}" data-emoji="${emoji}" aria-pressed="${mine}" aria-label="${emoji}, ${matches.length} reaksi">${emoji}<span>${matches.length || ''}</span></button>`;
      }).join('')}</div>` : '';
      const comments = (state.journalComments || []).filter(x => x.journalId === entry.id);
      const commentBlock = entry.shared ? `<div class="journal-comments">${comments.map(comment => `<p class="journal-comment"><strong>${esc(comment.username || 'Anggota keluarga')}</strong><span>${esc(comment.body)}</span></p>`).join('')}<form class="journal-comment-form" data-comment-entry="${esc(entry.id)}"><input name="body" maxlength="500" placeholder="Tulis komentar…" aria-label="Komentar untuk ${esc(entry.title || 'kenangan')}" required><button class="button secondary" type="submit">Kirim</button></form></div>` : '';
      return `<article class="journal-card"><div class="journal-card-title"><h3>${esc(entry.title || 'Kenangan tanpa judul')}</h3><span class="journal-badge${entry.shared?' shared':''}">${esc(badge)}</span></div><div class="journal-byline">${esc(author)}${activity ? ` · Tantangan: ${esc(activity.title)}` : ''}</div>${body}${drawing}${mediaGrid}${reactionBar}${commentBlock}</article>`;
    }).join('')}</section>`).join('');
  }
  function renderActivities(state) {
    const root = $('#activities-list');
    if (!root) return;
    const activities = (state.activities || []).slice().sort((a,b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    if (!activities.length) {
      root.innerHTML = '<div class="journal-empty">Belum ada tantangan. Buat satu untuk mengajak keluarga menulis atau menggambar bersama.</div>';
      return;
    }
    root.innerHTML = activities.map(activity => {
      const count = (state.journals || []).filter(entry => entry.activityId === activity.id).length;
      return `<article class="activity-card"><div class="activity-card-copy"><span class="activity-date">${esc(journalDateLabel(activity.date))}</span><h3>${esc(activity.title)}</h3><p>${esc(activity.prompt)}</p><span class="activity-count">${count} ${count === 1 ? 'jawaban' : 'jawaban'} keluarga</span></div><button class="button secondary" type="button" data-activity-respond="${esc(activity.id)}">Ikut tantangan</button></article>`;
    }).join('');
  }
  function calendarEventMarkup(item, state) {
    const assignee = item.assigneeId === 'all' || !item.assigneeId
      ? 'Seluruh keluarga'
      : (state.members || []).find(member => member.id === item.assigneeId)?.username || 'Anggota keluarga';
    const kind = item.kind === 'task' ? 'Tugas' : (item.kind === 'challenge' ? 'Tantangan' : 'Kegiatan');
    return `<article class="calendar-event ${item.kind === 'task' ? 'task' : 'activity'}" data-calendar-event="${esc(item.id)}"><div class="calendar-event-meta"><span>${kind}${item.pending ? ' · menunggu sinkron' : ''}</span>${item.time ? `<time>${esc(item.time)}</time>` : ''}</div><strong>${esc(item.title)}</strong><span class="calendar-assignee">${esc(assignee)}</span>${item.prompt ? `<p>${esc(item.prompt)}</p>` : ''}</article>`;
  }
  function renderCalendar(state) {
    const root = $('#calendar-grid');
    if (!root) return;
    const assignee = $('#calendar-assignee');
    if (assignee) {
      const old = assignee.value || 'all';
      const members = state.members || [];
      assignee.innerHTML = '<option value="all">Seluruh anggota keluarga</option>' + members.map(member => `<option value="${esc(member.id)}">${esc(member.username)}${member.id === state.user?.id ? ' (saya)' : ''}</option>`).join('');
      assignee.value = members.some(member => member.id === old) || old === 'all' ? old : 'all';
    }
    const year = calendarView.getFullYear(), month = calendarView.getMonth();
    $('#calendar-month-label').textContent = new Intl.DateTimeFormat('id-ID', { month:'long', year:'numeric' }).format(calendarView);
    const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((firstOffset + days) / 7) * 7;
    const activities = (state.activities || []);
    const cells = [];
    for (let index = 0; index < cellCount; index++) {
      const dayDate = new Date(year, month, index - firstOffset + 1);
      const iso = localDateValue(dayDate);
      const inMonth = dayDate.getMonth() === month;
      const dayEvents = activities.filter(item => item.date === iso).sort((a,b) => (a.time || '').localeCompare(b.time || '') || (a.title || '').localeCompare(b.title || ''));
      const eventMarkup = dayEvents.map(item => calendarEventMarkup(item, state)).join('');
      cells.push(`<div class="calendar-day${inMonth ? '' : ' outside'}${iso === localDateValue() ? ' today' : ''}${iso === selectedCalendarDate ? ' selected' : ''}" role="gridcell"><button class="calendar-day-select" type="button" data-calendar-date="${iso}" aria-label="${esc(journalDateLabel(iso))}${dayEvents.length ? `, ${dayEvents.length} agenda` : ''}" aria-pressed="${iso === selectedCalendarDate}"><span>${dayDate.getDate()}</span>${dayEvents.length ? `<i class="calendar-dot" aria-hidden="true"></i>` : ''}</button><div class="calendar-day-events">${eventMarkup}</div></div>`);
    }
    root.innerHTML = cells.join('');
    const selectedEvents = activities.filter(item => item.date === selectedCalendarDate).sort((a,b) => (a.time || '').localeCompare(b.time || '') || (a.title || '').localeCompare(b.title || ''));
    $('#calendar-agenda-title').textContent = selectedCalendarDate ? journalDateLabel(selectedCalendarDate) : 'Agenda terdekat';
    $('#calendar-agenda-list').innerHTML = selectedEvents.length ? selectedEvents.map(item => calendarEventMarkup(item, state)).join('') : '<div class="calendar-empty">Belum ada agenda pada tanggal ini. Tambahkan kegiatan atau tugas keluarga di atas.</div>';
  }
  function renderWeeklyMemories(state) {
    const root = $('#weekly-memory');
    if (!root) return;
    const today = localDateValue();
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - 6);
    const weekStart = localDateValue(weekStartDate);
    const entries = (state.journals || []).filter(entry => entry.date >= weekStart && entry.date <= today).slice().sort((a,b) => `${b.date}|${b.createdAt}`.localeCompare(`${a.date}|${a.createdAt}`));
    const days = new Set(entries.map(entry => entry.date)).size;
    const shared = entries.filter(entry => entry.shared).length;
    const headline = entries.length ? (entries[0].title || 'Kenangan tanpa judul') : 'Minggu ini masih menunggu cerita pertama';
    root.innerHTML = `<div class="weekly-memory-mark" aria-hidden="true">✦</div><div class="weekly-memory-copy"><p class="eyebrow">MEMORI 7 HARI TERAKHIR</p><h3>${entries.length ? `${entries.length} ${entries.length === 1 ? 'kenangan' : 'kenangan'} tersimpan` : 'Yuk simpan satu cerita kecil'}</h3><p>${entries.length ? `${days} hari terisi · ${shared} dibagikan bersama keluarga. Terbaru: ${esc(headline)}.` : 'Tulisan atau gambar bertanggalmu akan dirangkum di sini.'}</p></div><span class="weekly-memory-range">${esc(weekStart.slice(5))}—${esc(today.slice(5))}</span>`;
  }
  function switchTab(name) {
    const navTab = name === 'give' ? 'stamp' : (name === 'more' || name === 'setup' ? 'more' : 'home');
    $$('[data-bottom-tab]').forEach(btn => {
      const active = btn.dataset.bottomTab === navTab;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    const activePanel = $(`#panel-${name}`);
    $$('.panel').forEach(panel => panel.classList.toggle('active', panel === activePanel));
    const heading = activePanel?.querySelector('.section-heading h2, .section-heading h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  async function enqueueMany(items) {
    const operations = items.map(item => ({ id:uuid(), kind:item.kind, payload:item.payload, createdAt:new Date().toISOString() }));
    await withQueueLock(async () => {
      const queue = (await currentQueue()) || [];
      queue.push(...operations);
      window.__pending = queue;
      await kvSet(keyFor('queue'), queue);
    });
    render();
    if (navigator.onLine && onlineSession) setTimeout(() => syncQueue(), 0);
    return operations;
  }
  async function enqueue(kind, payload) {
    return enqueueMany([{ kind, payload }]);
  }
  async function syncQueue() {
    if (!navigator.onLine || !onlineSession || !snapshot) return { ok:false, offline:true, pending:(window.__pending || []).length };
    if (syncPromise) return syncPromise;
    const attempt = drainSyncQueue();
    syncPromise = attempt;
    try { return await attempt; }
    finally { if (syncPromise === attempt) syncPromise = null; }
  }
  async function drainSyncQueue() {
    while (navigator.onLine && onlineSession && snapshot) {
      const queue = await withQueueLock(async () => (await currentQueue()) || []);
      window.__pending = queue;
      if (!queue.length) { updateSyncStatus(); return { ok:true, pending:0 }; }
      updateSyncStatus();
      const mediaIndex = queue.findIndex(op => op.kind === 'media.upload');
      if (mediaIndex === 0) {
        const upload = queue[0];
        try {
          const response = await fetch('/api/media/upload', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ operationId:upload.id, ...upload.payload }) });
          if (response.status === 401) { onlineSession = false; sessionRequired = true; showGate('Sesi berakhir. Masuk kembali untuk menyinkronkan.'); return { ok:false, unauthorized:true, pending:queue.length }; }
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || `HTTP ${response.status}`);
          }
          await withQueueLock(async () => {
            const latest = (await currentQueue()) || [];
            const keep = latest.filter(item => item.id !== upload.id);
            await kvSet(keyFor('queue'), keep);
            window.__pending = keep;
          });
          continue;
        } catch (error) {
          updateSyncStatus(`Sinkronisasi gagal: ${error.message}`);
          return { ok:false, error:error.message, pending:(window.__pending || []).length };
        }
      }
      const batch = [];
      const eligible = mediaIndex > 0 ? queue.slice(0, mediaIndex) : queue.slice(0, 100);
      for (const op of eligible) {
        const candidate = [...batch, op];
        const bytes = new TextEncoder().encode(JSON.stringify({operations:candidate})).length;
        if (batch.length && bytes > 240 * 1024) break;
        batch.push(op);
        if (bytes > 240 * 1024) break;
      }
      try {
        const response = await fetch('/api/sync', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({operations:batch}) });
        if (response.status === 401) { onlineSession = false; sessionRequired = true; showGate('Sesi berakhir. Masuk kembali untuk menyinkronkan.'); return { ok:false, unauthorized:true, pending:queue.length }; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reply = await response.json();
        const applied = new Set(reply.applied || []);
        const remaining = await withQueueLock(async () => {
          const latest = (await currentQueue()) || [];
          const keep = latest.filter(op => !applied.has(op.id));
          await kvSet(keyFor('queue'), keep);
          window.__pending = keep;
          return keep;
        });
        await persistSnapshot(reply.snapshot);
        render();
        const rejected = Object.values(reply.rejected || {});
        if (rejected.length) {
          const reason = rejected[0];
          notify(`Perubahan belum diterima server: ${reason}. Tetap tersimpan di perangkat.`, 'error');
          updateSyncStatus(`Sinkronisasi gagal: ${reason}`);
          return { ok:false, error:reason, rejected:rejected.length, pending:remaining.length };
        }
        if (batch.every(op => !applied.has(op.id))) {
          const reason = 'Server belum mengonfirmasi perubahan.';
          updateSyncStatus(`Sinkronisasi gagal: ${reason}`);
          return { ok:false, error:reason, pending:remaining.length };
        }
      } catch (error) {
        updateSyncStatus(`Sinkronisasi gagal: ${error.message}`);
        return { ok:false, error:error.message, pending:(window.__pending || []).length };
      }
    }
    return { ok:false, offline:true, pending:(window.__pending || []).length };
  }
  async function loadOnline() {
    const response = await fetch('/api/bootstrap', { credentials:'same-origin', cache:'no-store' });
    if (response.status === 401) { sessionRequired = true; return { auth:false }; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    sessionRequired = false;
    await persistSnapshot(data);
    mediaCache = (await kvGet(keyFor('media-cache'))) || {};
    localJournals = (await kvGet(keyFor('journal-local'))) || [];
    onlineSession = true;
    lastSyncAt = data.serverTime || new Date().toISOString();
    await kvSet(keyFor('last-sync'), lastSyncAt);
    renderManualSyncInfo();
    window.__pending = await withQueueLock(async () => (await currentQueue()) || []);
    render();
    const sync = await syncQueue();
    if (!manualSyncing) {
      if (sync.ok) setManualSyncStatus('Data keluarga tersinkron. Tekan tombol untuk memeriksa katalog gambar terbaru.', 'success');
      else if (sync.pending) setManualSyncStatus(`${sync.pending} perubahan tetap tersimpan di perangkat dan akan dicoba lagi.`, 'pending');
    }
    return { auth:true, sync, serverTime:lastSyncAt };
  }
  async function fetchLatestColoringCatalog() {
    const url = `/static/coloring-templates.js?manual-sync=${Date.now()}-${uuid()}`;
    const response = await fetch(url, { credentials:'same-origin', cache:'no-store' });
    if (!response.ok) throw new Error(`Katalog gambar gagal diambil (HTTP ${response.status}).`);
    const cachedResponse = response.clone();
    const source = await response.text();
    if (!source.includes('STAMP_COLORING_CATEGORIES') || !source.includes('<svg')) throw new Error('Berkas katalog gambar tidak valid.');
    let changed = true;
    if ('caches' in window) {
      const cacheName = (await caches.keys()).find(name => name.startsWith('stamp-family-shell-'));
      if (cacheName) {
        const cache = await caches.open(cacheName);
        const previous = await cache.match('/static/coloring-templates.js');
        const previousSource = previous ? await previous.text() : '';
        await cache.put('/static/coloring-templates.js', cachedResponse);
        changed = previousSource !== source;
      }
    }
    return { changed, bytes:new TextEncoder().encode(source).length };
  }
  async function updateServiceWorkerIfAvailable() {
    if (!('serviceWorker' in navigator)) return false;
    let registration;
    try { registration = await navigator.serviceWorker.getRegistration(); }
    catch (_) { return false; }
    if (!registration?.active) return false;
    const previous = registration.active;
    try { await registration.update(); }
    catch (_) { return false; }
    if (registration.active && registration.active !== previous) return true;
    const installing = registration.installing;
    if (!installing) return false;
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        installing.removeEventListener('statechange', check);
        resolve(value);
      };
      const check = () => {
        if (registration.active && registration.active !== previous && installing.state === 'activated') finish(true);
        else if (installing.state === 'redundant') finish(false);
      };
      const timer = setTimeout(() => finish(false), 10_000);
      installing.addEventListener('statechange', check);
      check();
    });
  }
  async function manualSyncNow() {
    const button = $('#manual-sync-button');
    if (!button || manualSyncing) return;
    if (!navigator.onLine) {
      const pending = (window.__pending || []).length;
      const message = `Offline. ${pending ? `${pending} perubahan lokal tetap tersimpan` : 'Data lokal tetap tersedia'}. Hubungkan internet lalu coba lagi.`;
      setManualSyncStatus(message, 'pending');
      notify(message, 'error');
      return;
    }
    manualSyncing = true;
    button.disabled = true;
    button.textContent = 'Menyinkronkan…';
    setManualSyncStatus('Mengambil data keluarga dan katalog gambar terbaru…');
    let familyDataLoaded = false;
    try {
      const result = await loadOnline();
      if (!result.auth) {
        const message = 'Sesi berakhir. Masuk kembali untuk menyinkronkan; perubahan lokal tetap tersimpan.';
        setManualSyncStatus(message, 'error');
        notify(message, 'error');
        return;
      }
      familyDataLoaded = true;
      const catalog = await fetchLatestColoringCatalog();
      const shellUpdated = await updateServiceWorkerIfAvailable();
      const pending = (await currentQueue()) || [];
      if (pending.length) {
        const message = `Data keluarga dan katalog sudah diperiksa. ${pending.length} perubahan belum diterima dan tetap tersimpan di perangkat; coba sinkronkan lagi nanti.`;
        setManualSyncStatus(message, 'pending');
        notify(message, 'error');
      } else {
        const message = `Berhasil. Data keluarga terbaru dimuat dan katalog gambar diperiksa (${Math.round(catalog.bytes / 1024)} KB).`;
        setManualSyncStatus(message, 'success');
        notify(message, 'success');
      }
      if (catalog.changed || shellUpdated) {
        setManualSyncStatus(`${pending.length ? `${pending.length} perubahan tetap tersimpan. ` : ''}Pembaruan gambar siap; memuat ulang aplikasi…`, pending.length ? 'pending' : 'success');
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (error) {
      const pending = (await currentQueue().catch(() => [])) || [];
      const message = `${familyDataLoaded ? 'Data keluarga berhasil dimuat, tetapi katalog belum diperbarui.' : 'Sinkronisasi gagal.'} ${error.message || 'Periksa koneksi lalu coba lagi.'}${pending.length ? ` ${pending.length} perubahan lokal tetap tersimpan.` : ''}`;
      setManualSyncStatus(message, 'error');
      notify(message, 'error');
    } finally {
      manualSyncing = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = 'Sinkronkan sekarang';
      }
    }
  }
  async function loadApp() {
    if (!$('#panel-dashboard')) return;
    try { db = await openDB(); }
    catch (_) { showGate('Penyimpanan offline tidak tersedia'); return; }
    let offlineProfile = null;
    try { offlineProfile = JSON.parse(localStorage.getItem('stampFamilyProfile') || 'null'); } catch (_) {}
    let cached = null;
    if (offlineProfile?.id) cached = await kvGet(`snapshot:${offlineProfile.id}`);
    if (navigator.onLine) {
      try {
        const result = await loadOnline();
        if (!result.auth) { showGate('Silakan masuk terlebih dahulu'); return; }
        return;
      } catch (_) {
        // Network unavailable: continue with the device's last cached family state below.
      }
    }
    if (cached && offlineProfile && cached.user?.id === offlineProfile.id) {
      profile = offlineProfile;
      snapshot = cached;
      mediaCache = (await kvGet(keyFor('media-cache'))) || {};
      localJournals = (await kvGet(keyFor('journal-local'))) || [];
      lastSyncAt = await kvGet(keyFor('last-sync'));
      renderManualSyncInfo();
      window.__pending = await withQueueLock(async () => (await kvGet(`queue:${profile.id}`)) || []);
      onlineSession = false;
      $('#notice').textContent = 'Mode offline aktif. Perubahan antre dahulu dan akan disinkronkan setelah kembali online.';
      $('#notice').hidden = false;
      setManualSyncStatus('Offline. Perubahan tersimpan lokal; hubungkan internet untuk mengambil data dan katalog terbaru.', 'pending');
      render();
    } else {
      showGate('Belum ada data offline');
    }
  }

  function localDateValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function fileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('file tidak dapat dibaca'));
      reader.readAsDataURL(file);
    });
  }
  function blobAsDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('media tidak dapat diproses'));
      reader.readAsDataURL(blob);
    });
  }
  async function checkMediaSignature(file) {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ascii = offset => String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (file.type === 'image/png') return bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index) => bytes[index] === value);
    if (file.type === 'image/webp') return ascii(0) === 'RIFF' && ascii(8) === 'WEBP';
    if (file.type === 'video/mp4') return ascii(4) === 'ftyp';
    if (file.type === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    return false;
  }
  async function compressJournalImage(file) {
    if (file.size > 12 * 1024 * 1024) throw new Error('Foto sumber maksimal 12 MB.');
    if (!await checkMediaSignature(file)) throw new Error('Format foto tidak sesuai dengan isi file.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch (_) { throw new Error('Foto tidak dapat dibuka. Pilih file JPEG, PNG, atau WebP yang valid.'); }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    for (const quality of [.82, .72, .62, .52, .42]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 700 * 1024) return { type:'image/jpeg', data:await blobAsDataURL(blob), bytes:blob.size };
    }
    throw new Error('Foto tetap terlalu besar setelah dikompres.');
  }
  function renderMediaPreview() {
    const root = $('#journal-media-preview');
    if (!root) return;
    root.innerHTML = selectedJournalMedia.map(item => `<figure class="media-preview-item"><button type="button" class="media-remove" data-remove-media="${esc(item.id)}" aria-label="Hapus ${esc(item.name)}">×</button>${item.type.startsWith('video/') ? `<video src="${esc(item.data)}" muted playsinline aria-label="Pratinjau ${esc(item.name)}"></video>` : `<img src="${esc(item.data)}" alt="Pratinjau ${esc(item.name)}">`}<figcaption>${esc(item.name)}</figcaption></figure>`).join('');
  }
  async function addJournalMedia(files) {
    if (!files.length) return;
    if (selectedJournalMedia.length + files.length > 6) { notify('Satu kenangan dapat memuat maksimal 6 foto atau video.', 'error'); return; }
    const candidate = [...selectedJournalMedia];
    try {
      for (const file of files) {
        if (['image/jpeg','image/png','image/webp'].includes(file.type)) {
          const result = await compressJournalImage(file);
          candidate.push({ id:uuid(), type:result.type, data:result.data, name:file.name || 'Foto', bytes:result.bytes });
        } else if (['video/mp4','video/webm'].includes(file.type)) {
          if (file.size > 4 * 1024 * 1024) throw new Error('Video maksimal 4 MB per file.');
          if (!await checkMediaSignature(file)) throw new Error('Format video tidak sesuai dengan isi file.');
          candidate.push({ id:uuid(), type:file.type, data:await fileAsDataURL(file), name:file.name || 'Video', bytes:file.size });
        } else {
          throw new Error('Format yang didukung: JPEG, PNG, WebP, MP4, dan WebM.');
        }
      }
      const total = candidate.reduce((sum,item) => sum + item.bytes, 0);
      if (total > 6 * 1024 * 1024) throw new Error('Jumlah ukuran lampiran dalam satu kenangan maksimal 6 MB.');
      selectedJournalMedia = candidate;
      renderMediaPreview();
    } catch (error) {
      notify(error.message || 'Media tidak dapat ditambahkan.', 'error');
    }
  }
  const dailyPrompts = [
    'Apa hal kecil yang membuatmu tersenyum hari ini?', 'Gambarkan sesuatu yang kamu syukuri hari ini.',
    'Siapa yang menolongmu hari ini, dan bagaimana rasanya?', 'Apa makanan paling enak yang kamu makan minggu ini?',
    'Kalau hari ini punya warna, warna apa dan kenapa?', 'Ceritakan satu hal baru yang kamu pelajari.',
    'Momen apa yang ingin kamu ulangi bersama keluarga?', 'Gambarkan tempat paling nyaman bagimu.',
    'Apa yang membuatmu merasa berani hari ini?', 'Sebutkan satu hal baik yang kamu lakukan untuk orang lain.',
    'Kalau bisa mengajak keluarga bertualang, kamu ingin ke mana?', 'Apa suara atau lagu yang paling kamu suka belakangan ini?',
    'Gambarkan teman atau hewan yang membuatmu bahagia.', 'Apa yang ingin kamu coba besok?',
    'Ceritakan kejadian lucu yang kamu ingat.', 'Apa yang kamu banggakan dari dirimu hari ini?',
    'Bagaimana cara keluarga membuatmu merasa disayang?', 'Buat gambar tentang rumah impianmu.',
    'Apa hal paling menarik yang kamu lihat di luar?', 'Kalau bisa memberi nama hari ini, apa namanya?',
    'Apa yang membuatmu merasa tenang?', 'Ceritakan permainan favoritmu bersama keluarga.',
    'Gambarkan cuaca atau suasana hatimu hari ini.', 'Siapa yang ingin kamu ucapkan terima kasih?',
    'Apa cita-cita kecil yang ingin kamu capai minggu ini?', 'Ceritakan sesuatu yang membuatmu penasaran.',
    'Apa kenangan keluarga yang selalu membuatmu tertawa?', 'Kalau punya satu kekuatan ajaib, apa pilihanmu?',
    'Apa hal sederhana yang ingin kamu lakukan bersama besok?', 'Buat gambar tentang petualangan paling seru.'
  ];
  function dailyPrompt() {
    const seed = Number(localDateValue().replaceAll('-', '')) || 0;
    return dailyPrompts[seed % dailyPrompts.length];
  }
  function setDailyPrompt() {
    const prompt = $('#daily-prompt-text');
    if (prompt) prompt.textContent = dailyPrompt();
  }
  function paintCanvasBackground(value) {
    const canvas = $('#journal-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fffefa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value === 'dots') {
      ctx.fillStyle = '#dfd8ca';
      for (let y = 18; y < canvas.height; y += 22) for (let x = 18; x < canvas.width; x += 22) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (value === 'lines') {
      ctx.strokeStyle = '#e8e1d5'; ctx.lineWidth = 1;
      for (let y = 28; y < canvas.height; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    } else if (value === 'sky') {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#f4f8fb'); gradient.addColorStop(1, '#fff3df');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  function renderColoringGallery() {
    const root = $('#coloring-gallery');
    if (!root) return;
    const filter = $('#coloring-category-filter');
    const categories = ['Semua', ...coloringCategories.map(category => category.name)];
    filter.innerHTML = categories.map(category => {
      const count = category === 'Semua' ? coloringTemplates.length : coloringTemplates.filter(template => template.category === category).length;
      const selected = category === activeColoringCategory;
      return `<button type="button" class="coloring-category-button${selected ? ' selected' : ''}" data-coloring-category="${esc(category)}" aria-pressed="${selected}">${esc(category)} <span>${count}</span></button>`;
    }).join('');
    const filteredTemplates = activeColoringCategory === 'Semua'
      ? coloringTemplates
      : coloringTemplates.filter(template => template.category === activeColoringCategory);
    $('#coloring-template-count').textContent = `${filteredTemplates.length} gambar${activeColoringCategory === 'Semua' ? ' tersedia' : ` · ${activeColoringCategory}`}`;
    root.innerHTML = `<button class="coloring-card blank-card" type="button" data-coloring-template="blank"><span class="coloring-card-art"><span class="blank-art-mark" aria-hidden="true">＋</span></span><span class="coloring-card-copy"><strong>Kanvas kosong</strong><span>Mulai ›</span></span></button>${filteredTemplates.map(template => `<button class="coloring-card" type="button" data-coloring-template="${esc(template.id)}" data-coloring-category="${esc(template.category)}"><span class="coloring-card-art">${template.svg}</span><span class="coloring-card-copy"><strong>${esc(template.name)}</strong><span>Warnai ›</span></span></button>`).join('')}`;
  }
  function setColoringTool(tool) {
    coloringTool = tool;
    $$('[data-coloring-tool]').forEach(button => {
      const selected = button.dataset.coloringTool === tool;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const canvas = $('#coloring-canvas');
    if (canvas) canvas.style.cursor = tool === 'fill' ? 'cell' : (tool === 'eraser' ? 'not-allowed' : 'crosshair');
  }
  function setColoringColor(color) {
    coloringColor = color;
    const picker = $('#coloring-color');
    if (picker) picker.value = color;
    $$('[data-coloring-color]').forEach(button => {
      const selected = button.dataset.coloringColor.toLowerCase() === color.toLowerCase();
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function drawColoringTemplate(templateID) {
    const canvas = $('#coloring-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    coloringHasChanges = false;
    coloringHistory = [];
    if (templateID === 'blank') return;
    const template = coloringTemplates.find(item => item.id === templateID);
    if (!template) return;
    const token = ++coloringLoadToken;
    const image = new Image();
    image.onload = () => {
      if (token !== coloringLoadToken) return;
      ctx.drawImage(image, 28, 24, canvas.width - 56, canvas.height - 48);
    };
    image.onerror = () => notify('Gambar belum dapat dibuka. Pilih gambar lain.', 'error');
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(template.svg)}`;
  }
  function openColoringTemplate(templateID) {
    const template = coloringTemplates.find(item => item.id === templateID);
    coloringTemplateID = template ? template.id : 'blank';
    $('#coloring-gallery-view').hidden = true;
    $('#coloring-editor-view').hidden = false;
    $('#coloring-editor-title').textContent = template?.name || 'Kanvas kosong';
    $('#coloring-title').value = template ? template.name : 'Karya kanvas bebas';
    $('#coloring-date').value = localDateValue();
    $('#coloring-share').checked = false;
    setColoringTool('brush');
    setColoringColor(coloringColor);
    drawColoringTemplate(coloringTemplateID);
    $('#coloring-editor-view').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function saveColoringHistory() {
    const canvas = $('#coloring-canvas');
    if (!canvas) return;
    coloringHistory.push(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
    if (coloringHistory.length > MAX_COLORING_HISTORY) coloringHistory.shift();
  }
  function undoColoring() {
    const canvas = $('#coloring-canvas');
    const previous = coloringHistory.pop();
    if (!canvas || !previous) return;
    canvas.getContext('2d').putImageData(previous, 0, 0);
    coloringHasChanges = true;
  }
  function coloringPoint(event) {
    const canvas = $('#coloring-canvas');
    const rect = canvas.getBoundingClientRect();
    return { x:Math.floor((event.clientX - rect.left) * canvas.width / rect.width), y:Math.floor((event.clientY - rect.top) * canvas.height / rect.height) };
  }
  function hexColorChannels(hex) {
    const value = hex.replace('#', '');
    return [parseInt(value.slice(0,2),16), parseInt(value.slice(2,4),16), parseInt(value.slice(4,6),16)];
  }
  function floodColoringArea(x, y) {
    const canvas = $('#coloring-canvas');
    const ctx = canvas.getContext('2d');
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    const start = (y * canvas.width + x) * 4;
    const target = [pixels[start], pixels[start + 1], pixels[start + 2]];
    const fill = hexColorChannels(coloringColor);
    if (target.every((channel, index) => Math.abs(channel - fill[index]) < 4)) return;
    const closeToTarget = index => Math.abs(pixels[index] - target[0]) <= 38 && Math.abs(pixels[index + 1] - target[1]) <= 38 && Math.abs(pixels[index + 2] - target[2]) <= 38 && pixels[index + 3] > 0;
    const visited = new Uint8Array(canvas.width * canvas.height);
    const stack = [y * canvas.width + x];
    while (stack.length) {
      const pixel = stack.pop();
      if (visited[pixel]) continue;
      visited[pixel] = 1;
      const index = pixel * 4;
      if (!closeToTarget(index)) continue;
      pixels[index] = fill[0]; pixels[index + 1] = fill[1]; pixels[index + 2] = fill[2]; pixels[index + 3] = 255;
      const px = pixel % canvas.width;
      if (px > 0) stack.push(pixel - 1);
      if (px < canvas.width - 1) stack.push(pixel + 1);
      if (pixel >= canvas.width) stack.push(pixel - canvas.width);
      if (pixel < canvas.width * (canvas.height - 1)) stack.push(pixel + canvas.width);
    }
    ctx.putImageData(image, 0, 0);
    coloringHasChanges = true;
  }
  function splatterColoringAt(x, y) {
    const canvas = $('#coloring-canvas');
    const ctx = canvas.getContext('2d');
    const size = Number($('#coloring-brush-size').value);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .78;
    ctx.fillStyle = coloringColor;
    const dot = (cx, cy, radius) => {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, radius), 0, Math.PI * 2);
      ctx.fill();
    };
    dot(x, y, size * .24);
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * size * 2.4;
      dot(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, size * (.07 + Math.random() * .18));
    }
    ctx.restore();
    coloringHasChanges = true;
  }
  function downloadColoring() {
    const canvas = $('#coloring-canvas');
    const title = ($('#coloring-title').value || 'gambar-mewarnai').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gambar-mewarnai';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${title}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function compactColoringDrawing() {
    const canvas = $('#coloring-canvas');
    for (const quality of [.72, .62, .52, .42]) {
      const drawing = canvas.toDataURL('image/jpeg', quality);
      if (drawing.length <= 180000) return drawing;
    }
    return '';
  }
  async function saveColoringToJournal(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const drawing = compactColoringDrawing();
    if (!drawing) { notify('Gambar terlalu besar untuk jurnal. Coba gunakan lebih sedikit warna.', 'error'); return; }
    const payload = {
      id:uuid(), date:$('#coloring-date').value, title:$('#coloring-title').value.trim(),
      body:'Karya mewarnai keluarga.', drawing, shared:$('#coloring-share').checked,
      activityId:'', media:[], mediaIds:[]
    };
    if (!payload.date || !payload.title) { notify('Isi tanggal dan judul karya terlebih dahulu.', 'error'); return; }
    button.disabled = true;
    try {
      if (payload.shared) await enqueue('journal.add', payload);
      else {
        localJournals.unshift({ ...payload, createdBy:profile.id, createdByName:profile.username, createdAt:new Date().toISOString(), shared:false });
        await kvSet(keyFor('journal-local'), localJournals);
        render();
      }
      switchTab('journal');
      notify(payload.shared ? 'Karya disimpan ke jurnal dan akan dibagikan saat tersambung.' : 'Karya disimpan di jurnal pribadi pada perangkat ini.', 'success');
    } catch (_) {
      notify('Karya belum berhasil disimpan. Coba lagi.', 'error');
    } finally { button.disabled = false; }
  }
  function initializeColoringCanvas() {
    const canvas = $('#coloring-canvas');
    if (!canvas) return;
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x:(event.clientX - rect.left) * canvas.width / rect.width, y:(event.clientY - rect.top) * canvas.height / rect.height };
    };
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      const p = point(event);
      if (coloringTool === 'fill') {
        saveColoringHistory();
        floodColoringArea(Math.floor(p.x), Math.floor(p.y));
        return;
      }
      if (coloringTool === 'splatter') {
        saveColoringHistory();
        splatterColoringAt(p.x, p.y);
        return;
      }
      saveColoringHistory();
      coloringInProgress = true;
      canvas.setPointerCapture(event.pointerId);
      const ctx = canvas.getContext('2d');
      const size = Number($('#coloring-brush-size').value);
      ctx.globalCompositeOperation = coloringTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = coloringTool === 'marker' ? .42 : 1;
      ctx.strokeStyle = coloringTool === 'eraser' ? '#ffffff' : coloringColor;
      ctx.lineWidth = coloringTool === 'pencil' ? Math.max(1.5, size * .42) : (coloringTool === 'marker' ? size * 1.8 : size);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + .1, p.y + .1); ctx.stroke();
      coloringHasChanges = true;
    });
    canvas.addEventListener('pointermove', event => {
      if (!coloringInProgress) return;
      event.preventDefault();
      const p = point(event), ctx = canvas.getContext('2d');
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    const finishStroke = () => {
      coloringInProgress = false;
      const ctx = canvas.getContext('2d');
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };
    canvas.addEventListener('pointerup', finishStroke);
    canvas.addEventListener('pointercancel', finishStroke);
    canvas.addEventListener('lostpointercapture', finishStroke);
    $('#coloring-gallery')?.addEventListener('click', event => {
      const card = event.target.closest('[data-coloring-template]');
      if (card) openColoringTemplate(card.dataset.coloringTemplate);
    });
    $('#coloring-category-filter')?.addEventListener('click', event => {
      const button = event.target.closest('[data-coloring-category]');
      if (!button) return;
      activeColoringCategory = button.dataset.coloringCategory;
      renderColoringGallery();
    });
    $('#coloring-back')?.addEventListener('click', () => {
      if (coloringHasChanges && !window.confirm('Karya belum disimpan. Kembali ke galeri dan buang perubahan?')) return;
      $('#coloring-editor-view').hidden = true;
      $('#coloring-gallery-view').hidden = false;
      $('#coloring-gallery-view').scrollIntoView({ behavior:'smooth', block:'start' });
    });
    $('#coloring-reset')?.addEventListener('click', () => {
      if (coloringHasChanges && !window.confirm('Mulai ulang dan hapus warna yang sudah dibuat?')) return;
      drawColoringTemplate(coloringTemplateID);
    });
    $('#coloring-undo')?.addEventListener('click', undoColoring);
    $('#coloring-download')?.addEventListener('click', downloadColoring);
    $('#coloring-save-form')?.addEventListener('submit', saveColoringToJournal);
    $$('[data-coloring-tool]').forEach(button => button.addEventListener('click', () => setColoringTool(button.dataset.coloringTool)));
    $$('[data-coloring-color]').forEach(button => button.addEventListener('click', () => setColoringColor(button.dataset.coloringColor)));
    $('#coloring-color')?.addEventListener('input', event => setColoringColor(event.currentTarget.value));
    $('#coloring-brush-size')?.addEventListener('input', event => { $('#coloring-brush-value').textContent = event.currentTarget.value; });
    $('#coloring-date').value = localDateValue();
    renderColoringGallery();
    drawColoringTemplate('blank');
  }
  function saveCanvasHistory() {
    const canvas = $('#journal-canvas');
    if (!canvas) return;
    canvasHistory.push({ image:canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height), active:drawingActive, background:canvasBackground });
    if (canvasHistory.length > MAX_CANVAS_HISTORY) canvasHistory.shift();
  }
  function undoCanvas() {
    const canvas = $('#journal-canvas');
    const previous = canvasHistory.pop();
    if (!canvas || !previous) return;
    canvas.getContext('2d').putImageData(previous.image, 0, 0);
    drawingActive = previous.active;
    canvasBackground = previous.background;
    $('#journal-background').value = canvasBackground;
  }
  function clearJournalCanvas() {
    const canvas = $('#journal-canvas');
    if (!canvas) return;
    canvasBackground = 'blank';
    $('#journal-background').value = 'blank';
    paintCanvasBackground(canvasBackground);
    canvasHistory = [];
    drawingActive = false;
    drawingInProgress = false;
    canvasErasing = false;
    $('#journal-eraser').setAttribute('aria-pressed', 'false');
    $('#journal-eraser').textContent = 'Penghapus';
  }
  function journalDrawingData() {
    const source = $('#journal-canvas');
    if (!source || !drawingActive) return '';
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    return canvas.toDataURL('image/jpeg', .62);
  }
  const journalCanvas = $('#journal-canvas');
  if (journalCanvas) {
    paintCanvasBackground(canvasBackground);
    const point = event => {
      const rect = journalCanvas.getBoundingClientRect();
      return { x:(event.clientX - rect.left) * journalCanvas.width / rect.width, y:(event.clientY - rect.top) * journalCanvas.height / rect.height };
    };
    journalCanvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      saveCanvasHistory();
      drawingInProgress = true;
      journalCanvas.setPointerCapture(event.pointerId);
      const p = point(event), ctx = journalCanvas.getContext('2d');
      ctx.globalCompositeOperation = canvasErasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = $('#journal-pen-color').value; ctx.lineWidth = Number($('#journal-brush-size').value); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + .1, p.y + .1); ctx.stroke();
      drawingActive = true;
    });
    journalCanvas.addEventListener('pointermove', event => {
      if (!drawingInProgress) return;
      event.preventDefault();
      const p = point(event), ctx = journalCanvas.getContext('2d');
      ctx.globalCompositeOperation = canvasErasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = $('#journal-pen-color').value; ctx.lineWidth = Number($('#journal-brush-size').value); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    const finishDrawing = () => { drawingInProgress = false; };
    journalCanvas.addEventListener('pointerup', finishDrawing);
    journalCanvas.addEventListener('pointercancel', finishDrawing);
    journalCanvas.addEventListener('lostpointercapture', finishDrawing);
  }
  $('#journal-clear-drawing')?.addEventListener('click', clearJournalCanvas);
  $('#journal-undo')?.addEventListener('click', undoCanvas);
  $('#journal-eraser')?.addEventListener('click', event => {
    canvasErasing = !canvasErasing;
    event.currentTarget.setAttribute('aria-pressed', String(canvasErasing));
    event.currentTarget.textContent = canvasErasing ? 'Penghapus aktif' : 'Penghapus';
  });
  $('#journal-background')?.addEventListener('change', event => {
    saveCanvasHistory();
    canvasBackground = event.currentTarget.value;
    paintCanvasBackground(canvasBackground);
    drawingActive = canvasBackground !== 'blank';
  });
  $('#journal-brush-size')?.addEventListener('input', event => { $('#journal-brush-value').textContent = event.currentTarget.value; });
  if ($('#journal-entry-date')) $('#journal-entry-date').value = localDateValue();
  if ($('#activity-date')) $('#activity-date').value = localDateValue();
  if ($('#calendar-date')) $('#calendar-date').value = localDateValue();
  if ($('#calendar-time')) $('#calendar-time').value = '09:00';
  setDailyPrompt();
  initializeColoringCanvas();

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-tab], [data-open-tab]');
    if (btn) { switchTab(btn.dataset.tab || btn.dataset.openTab); return; }
    const calendarDate = event.target.closest('[data-calendar-date]');
    if (calendarDate) {
      selectedCalendarDate = calendarDate.dataset.calendarDate;
      const picked = new Date(`${selectedCalendarDate}T12:00:00`);
      calendarView = new Date(picked.getFullYear(), picked.getMonth(), 1);
      if (snapshot) render();
      return;
    }
    if (event.target.closest('#calendar-prev')) {
      calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1);
      selectedCalendarDate = localDateValue(new Date(calendarView.getFullYear(), calendarView.getMonth(), 1));
      if (snapshot) render();
      return;
    }
    if (event.target.closest('#calendar-next')) {
      calendarView = new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1);
      selectedCalendarDate = localDateValue(new Date(calendarView.getFullYear(), calendarView.getMonth(), 1));
      if (snapshot) render();
      return;
    }
    if (event.target.closest('#calendar-today')) {
      const today = new Date(); calendarView = new Date(today.getFullYear(), today.getMonth(), 1); selectedCalendarDate = localDateValue(today);
      if (snapshot) render();
      return;
    }
    const removeMedia = event.target.closest('[data-remove-media]');
    if (removeMedia) {
      selectedJournalMedia = selectedJournalMedia.filter(item => item.id !== removeMedia.dataset.removeMedia);
      renderMediaPreview();
      return;
    }
    if (event.target.closest('#use-daily-prompt')) {
      const field = $('#journal-form textarea[name=body]');
      const prompt = dailyPrompt();
      field.value = field.value ? `${prompt}\n\n${field.value}` : prompt;
      field.focus();
      return;
    }
    const reaction = event.target.closest('[data-react-entry][data-emoji]');
    if (reaction) {
      enqueue('journal.react.toggle', { id:uuid(), journalId:reaction.dataset.reactEntry, emoji:reaction.dataset.emoji });
      return;
    }
    const respond = event.target.closest('[data-activity-respond]');
    if (respond) {
      const activity = (projected()?.activities || []).find(item => item.id === respond.dataset.activityRespond);
      if (!activity) return;
      $('#journal-activity-id').value = activity.id;
      $('#journal-entry-date').value = activity.date;
      const title = $('#journal-form input[name=title]');
      const body = $('#journal-form textarea[name=body]');
      if (!title.value) title.value = `Jawaban: ${activity.title}`;
      if (!body.value) body.value = activity.prompt;
      $('#journal-share').checked = true;
      $('#journal-form').scrollIntoView({ behavior:'smooth', block:'center' });
      notify('Jawaban tantangan akan dibagikan dengan keluarga.', 'success');
    }
  });
  $('#stamp-celebration')?.addEventListener('click', event => {
    if (event.target === event.currentTarget || event.target.closest('.celebration-close')) closeStampCelebration();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#stamp-celebration')?.hidden) closeStampCelebration();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-child-select]')) render();
    if (event.target.matches('#journal-filter')) { if (snapshot) render(); }
    if (event.target.matches('#journal-media-input')) {
      const submit = $('#journal-form button[type="submit"]');
      if (submit) submit.disabled = true;
      mediaProcessing = addJournalMedia([...event.target.files]).finally(() => { if (submit) submit.disabled = false; });
      event.target.value = '';
    }
    if (event.target.matches('#calendar-date') && event.target.value) {
      selectedCalendarDate = event.target.value;
      const picked = new Date(`${selectedCalendarDate}T12:00:00`);
      calendarView = new Date(picked.getFullYear(), picked.getMonth(), 1);
      if (snapshot) render();
    }
    if (event.target.matches('#journal-share') && $('#journal-activity-id').value && !event.target.checked) {
      event.target.checked = true;
      notify('Jawaban tantangan harus dibagikan agar keluarga dapat ikut serta.', 'error');
    }
  });
  $$('[data-create-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    if (profile?.role !== 'admin') { notify('Hanya admin keluarga yang dapat mengubah pengaturan.', 'error'); return; }
    const data = new FormData(form);
    const payload = { id:uuid() };
    for (const [key,value] of data.entries()) payload[key] = value;
    if (form.dataset.createForm === 'reward.add') payload.goal = Number(payload.goal);
    await enqueue(form.dataset.createForm, payload);
    form.reset();
    const colorInput = form.querySelector('input[type=color]'); if (colorInput) colorInput.value = '#f2b66d';
    const emojiInput = form.querySelector('input[name=emoji]'); if (emojiInput) emojiInput.value = '⭐';
    notify('Perubahan disimpan di perangkat.', 'success');
  }));
  $('#calendar-event-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    if (button.disabled) return;
    const payload = {
      id:uuid(), date:$('#calendar-date').value, time:$('#calendar-time').value,
      kind:$('#calendar-kind').value, assigneeId:$('#calendar-assignee').value || 'all',
      title:$('#calendar-title').value.trim(), description:$('#calendar-description').value.trim()
    };
    if (!payload.date || !payload.time || !payload.title) { notify('Isi tanggal, jam, dan nama kegiatan atau tugas.', 'error'); return; }
    button.disabled = true;
    try {
      selectedCalendarDate = payload.date;
      const picked = new Date(`${payload.date}T12:00:00`); calendarView = new Date(picked.getFullYear(), picked.getMonth(), 1);
      await enqueue('calendar.add', payload);
      form.reset();
      $('#calendar-date').value = payload.date;
      $('#calendar-time').value = '09:00';
      $('#calendar-assignee').value = 'all';
      notify(payload.kind === 'task' ? 'Tugas keluarga ditambahkan ke kalender.' : 'Kegiatan keluarga ditambahkan ke kalender.', 'success');
    } catch (_) { notify('Agenda belum berhasil disimpan. Coba lagi.', 'error'); }
    finally { button.disabled = false; }
  });
  $('#journal-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    if (button?.disabled) return;
    await mediaProcessing;
    const data = new FormData(form);
    const drawing = journalDrawingData();
    const media = selectedJournalMedia.map(item => ({ id:item.id, type:item.type }));
    const payload = {
      id:uuid(), date:String(data.get('date') || ''), title:String(data.get('title') || '').trim(),
      body:String(data.get('body') || '').trim(), drawing, shared:$('#journal-share').checked,
      activityId:String(data.get('activityId') || ''), media, mediaIds:media.map(item => item.id)
    };
    if (payload.activityId && !payload.shared) { notify('Jawaban tantangan perlu dibagikan kepada keluarga.', 'error'); return; }
    if (!payload.date || (!payload.title && !payload.body && !payload.drawing && media.length === 0)) {
      notify('Tambahkan judul, cerita, gambar, atau foto/video terlebih dahulu.', 'error');
      return;
    }
    if (button) button.disabled = true;
    try {
      for (const item of selectedJournalMedia) mediaCache[item.id] = item.data;
      if (selectedJournalMedia.length) await kvSet(keyFor('media-cache'), mediaCache);
      if (payload.shared) {
        const mediaOperations = selectedJournalMedia.map(item => ({ kind:'media.upload', payload:{ id:item.id, type:item.type, data:item.data.split(',')[1] || '' } }));
        await enqueueMany([...mediaOperations, { kind:'journal.add', payload }]);
      } else {
        localJournals.unshift({ ...payload, createdBy:profile.id, createdByName:profile.username, createdAt:new Date().toISOString(), shared:false });
        await kvSet(keyFor('journal-local'), localJournals);
        render();
      }
      form.reset();
      $('#journal-entry-date').value = localDateValue();
      selectedJournalMedia = [];
      renderMediaPreview();
      clearJournalCanvas();
      notify(payload.shared ? 'Kenangan disimpan dan akan dibagikan saat tersambung.' : 'Kenangan pribadi disimpan di perangkat ini.', 'success');
    } catch (_) {
      notify('Kenangan belum berhasil disimpan di perangkat. Coba lagi.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });
  $('#activity-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const date = $('#activity-date').value;
    const title = $('#activity-title').value.trim();
    const prompt = $('#activity-prompt').value.trim();
    if (!date || !title || !prompt) { notify('Isi tanggal, nama, dan ajakan tantangan.', 'error'); return; }
    const button = form.querySelector('button[type=submit]');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await enqueue('activity.add', { id:uuid(), date, title, prompt });
      form.reset();
      $('#activity-date').value = localDateValue();
      notify('Tantangan keluarga disimpan dan akan disinkronkan.', 'success');
    } catch (_) { notify('Tantangan belum berhasil disimpan. Coba lagi.', 'error'); }
    finally { button.disabled = false; }
  });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-comment-entry]');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector('input[name=body]');
    const body = input.value.trim();
    if (!body) return;
    const submit = form.querySelector('button[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      await enqueue('journal.comment.add', { id:uuid(), journalId:form.dataset.commentEntry, body });
      notify('Komentar ditambahkan.', 'success');
    } catch (_) { notify('Komentar belum berhasil disimpan. Coba lagi.', 'error'); }
    finally { submit.disabled = false; }
  });
  $('#give-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton?.disabled) return;
    const data = new FormData(form);
    const familyID = profile?.familyId || snapshot?.family?.id || '';
    const payload = { id:uuid(), childId:data.get('childId'), reasonId:data.get('reasonId'), designId:`system-reason-${familyID}` };
    if (!payload.childId || !payload.reasonId || !familyID) { notify('Pilih anak dan alasan terlebih dahulu.', 'error'); return; }
    const state = projected();
    const child = state?.children.find(item => item.id === payload.childId);
    const reason = state?.reasons.find(item => item.id === payload.reasonId);
    const audio = prepareStampAudio();
    if (submitButton) submitButton.disabled = true;
    try {
      await enqueue('stamp.give', payload);
      form.reset();
      playStampSound(audio);
      showStampCelebration(child, reason);
      notify('Stamp ditambahkan ke koleksi.', 'success');
    } catch (_) {
      notify('Stamp belum berhasil disimpan di perangkat. Coba lagi.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  $('#invite-button')?.addEventListener('click', async () => {
    const username = $('#invite-username').value.trim();
    const role = $('#invite-role').value;
    if (!username) { notify('Masukkan username untuk anggota baru.', 'error'); return; }
    if (!navigator.onLine || !onlineSession) { notify('Untuk membuat akun anggota, hubungkan ke server dan masuk kembali.', 'error'); return; }
    const button = $('#invite-button'); button.disabled = true;
    try {
      const response = await fetch('/api/invite', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,role}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal membuat akun.');
      snapshot.members = snapshot.members || [];
      snapshot.members.push({ id:result.id, username:result.username, role:result.role });
      await persistSnapshot(snapshot);
      render();
      const box = $('#invite-result');
      box.innerHTML = `<strong>Akun dibuat untuk ${esc(result.username)} · ${esc(result.role === 'admin' ? 'Admin keluarga' : 'Anggota')}</strong>Password awal (ditampilkan satu kali): <code>${esc(result.password)}</code><br>Catat dan bagikan langsung kepada anggota keluarga.`;
      box.hidden = false; $('#invite-username').value = '';
    } catch (error) { notify(error.message, 'error'); }
    finally { button.disabled = false; }
  });
  $('#manual-sync-button')?.addEventListener('click', manualSyncNow);
  $('#logout-form')?.addEventListener('submit', event => {
    const queue = window.__pending || [];
    const privateCount = localJournals.length;
    if ((queue.length || privateCount) && !window.confirm(`${queue.length ? `${queue.length} perubahan belum tersinkron` : ''}${queue.length && privateCount ? ' dan ' : ''}${privateCount ? `${privateCount} catatan pribadi` : ''}. Keluar akan menghapus data lokal ini dari perangkat. Tetap keluar?`)) { event.preventDefault(); return; }
    if (db) { db.close(); indexedDB.deleteDatabase(DB_NAME); }
    localStorage.removeItem('stampFamilyProfile');
  });
  window.addEventListener('online', async () => {
    if (!snapshot) return;
    try {
      const result = await loadOnline();
      if (!result.auth) showGate('Sesi berakhir. Masuk kembali untuk menyinkronkan.');
    } catch (_) {
      onlineSession = false;
      updateSyncStatus('Sinkronisasi gagal');
      setManualSyncStatus('Koneksi kembali, tetapi data belum berhasil disegarkan. Coba tombol Sinkronkan sekarang.', 'error');
    }
  });
  window.addEventListener('offline', () => {
    onlineSession = false;
    updateSyncStatus();
    const pending = (window.__pending || []).length;
    setManualSyncStatus(`Offline. ${pending ? `${pending} perubahan lokal tetap tersimpan` : 'Data lokal tetap tersedia'}; hubungkan internet untuk memperbarui.`, 'pending');
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  loadApp();
})();
