(() => {
  'use strict';

  const MINUTES = { focus: 25, short: 5, long: 15 };
  const CIRC = 2 * Math.PI * 92;
  const KEY = 'focus-desk-v1';

  const $ = (s) => document.querySelector(s);
  const el = {
    time: $('#time'), progress: $('#progress'), start: $('#start'), reset: $('#reset'),
    current: $('#current-task'), count: $('#done-count'), form: $('#task-form'),
    input: $('#task-input'), list: $('#task-list'), empty: $('#empty'),
    modes: document.querySelectorAll('.mode')
  };

  const today = () => new Date().toISOString().slice(0, 10);

  let state = load();
  let mode = 'focus';
  let remaining = MINUTES.focus * 60; // seconds
  let endAt = null;
  let tick = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.tasks)) {
        if (s.day !== today()) { s.day = today(); s.sessions = 0; }
        return s;
      }
    } catch (e) { /* ignore corrupt or blocked storage */ }
    return { tasks: [], activeId: null, sessions: 0, day: today() };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Timer ---------- */
  function fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function render() {
    el.time.textContent = fmt(remaining);
    const total = MINUTES[mode] * 60;
    el.progress.style.strokeDasharray = CIRC;
    el.progress.style.strokeDashoffset = CIRC * (1 - remaining / total);
    el.start.textContent = endAt ? 'Pause' : 'Start';
    document.title = (endAt ? fmt(remaining) + ' – ' : '') + 'Focus Desk';
    document.body.classList.toggle('is-break', mode !== 'focus');
    el.count.textContent = state.sessions;
  }
  function setMode(next) {
    stop();
    mode = next;
    remaining = MINUTES[mode] * 60;
    el.modes.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    render();
  }
  function run() {
    endAt = Date.now() + remaining * 1000;
    tick = setInterval(update, 250);
    render();
  }
  function stop() {
    if (endAt) remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    endAt = null;
    clearInterval(tick);
  }
  function update() {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if (remaining === 0) return finish();
    render();
  }
  function finish() {
    endAt = null;
    clearInterval(tick);
    beep();
    if (mode === 'focus') {
      state.sessions++;
      const t = state.tasks.find((x) => x.id === state.activeId);
      if (t) t.pomos++;
      save(); renderTasks();
      setMode(state.sessions % 4 === 0 ? 'long' : 'short');
    } else {
      setMode('focus');
    }
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((d) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
      });
    } catch (e) { /* audio not available */ }
  }

  el.start.addEventListener('click', () => { endAt ? (stop(), render()) : run(); });
  el.reset.addEventListener('click', () => setMode(mode));
  el.modes.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  /* ---------- Tasks ---------- */
  function renderTasks() {
    el.list.innerHTML = '';
    state.tasks.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'task' + (t.id === state.activeId ? ' is-active' : '') + (t.done ? ' is-done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = t.done;
      cb.setAttribute('aria-label', 'Mark "' + t.text + '" done');
      cb.addEventListener('change', () => { t.done = cb.checked; save(); renderTasks(); });

      const label = document.createElement('button');
      label.className = 'label'; label.textContent = t.text;
      label.title = 'Work on this task';
      label.addEventListener('click', () => { state.activeId = t.id; save(); renderTasks(); });

      const pomos = document.createElement('span');
      pomos.className = 'pomos'; pomos.textContent = t.pomos + ' ×';
      pomos.title = 'Focus sessions completed';

      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×';
      del.setAttribute('aria-label', 'Delete "' + t.text + '"');
      del.addEventListener('click', () => {
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        if (state.activeId === t.id) state.activeId = null;
        save(); renderTasks();
      });

      li.append(cb, label, pomos, del);
      el.list.appendChild(li);
    });
    el.empty.hidden = state.tasks.length > 0;
    const active = state.tasks.find((x) => x.id === state.activeId);
    el.current.textContent = active ? active.text : 'No task selected';
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    const task = { id: Date.now().toString(36), text, done: false, pomos: 0 };
    state.tasks.push(task);
    if (!state.activeId) state.activeId = task.id;
    el.input.value = '';
    save(); renderTasks();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault(); el.start.click();
    }
  });

  renderTasks();
  render();
})();
