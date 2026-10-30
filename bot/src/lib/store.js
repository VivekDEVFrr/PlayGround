import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', 'data');
const suggestionsFile = join(dataDir, 'suggestions.json');
const stateFile = join(dataDir, 'state.json');

function ensure() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensure();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, file);
}

/* ── suggestions ───────────────────────────────────────────── */
let suggestions = null;

function loadSuggestions() {
  if (!suggestions) {
    const raw = readJson(suggestionsFile, { nextId: 1, items: {} });
    suggestions = {
      nextId: Number(raw.nextId) || 1,
      items: raw.items && typeof raw.items === 'object' ? raw.items : {},
    };
  }
  return suggestions;
}

function saveSuggestions() {
  writeJson(suggestionsFile, loadSuggestions());
}

export function createSuggestion({ authorId, authorTag, text, channelId, messageId }) {
  const db = loadSuggestions();
  const id = db.nextId++;
  db.items[id] = {
    id,
    authorId,
    authorTag,
    text,
    channelId,
    messageId,
    up: [],
    down: [],
    status: 'open',
    staffNote: '',
    createdAt: new Date().toISOString(),
  };
  saveSuggestions();
  return db.items[id];
}

export function getSuggestion(id) {
  return loadSuggestions().items[id] || null;
}

export function setSuggestionMessage(id, messageId) {
  const item = getSuggestion(id);
  if (!item) return null;
  item.messageId = messageId;
  saveSuggestions();
  return item;
}

export function voteSuggestion(id, userId, kind) {
  const item = getSuggestion(id);
  if (!item) return null;
  if (item.status !== 'open') return { item, changed: false, closed: true };

  const up = new Set(item.up);
  const down = new Set(item.down);
  const target = kind === 'up' ? up : down;
  const other = kind === 'up' ? down : up;

  if (target.has(userId)) {
    target.delete(userId);
  } else {
    target.add(userId);
    other.delete(userId);
  }

  item.up = [...up];
  item.down = [...down];
  saveSuggestions();
  return { item, changed: true };
}

export function reviewSuggestion(id, status, staffNote) {
  const item = getSuggestion(id);
  if (!item) return null;
  item.status = status;
  item.staffNote = String(staffNote || '').slice(0, 300);
  item.reviewedAt = new Date().toISOString();
  saveSuggestions();
  return item;
}

/* ── small runtime state (status message ids) ──────────────── */
export function getState(key, fallback = null) {
  const state = readJson(stateFile, {});
  return state[key] ?? fallback;
}

export function setState(key, value) {
  const state = readJson(stateFile, {});
  state[key] = value;
  writeJson(stateFile, state);
}
