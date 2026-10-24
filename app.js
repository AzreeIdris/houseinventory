'use strict';

const STORAGE_KEY = 'houseInventory.v1';
const WARRANTY_WARN_DAYS = 30;

const $ = (sel) => document.querySelector(sel);

const els = {
  list: $('#itemList'),
  empty: $('#emptyState'),
  noMatches: $('#noMatches'),
  search: $('#search'),
  filterRoom: $('#filterRoom'),
  filterCategory: $('#filterCategory'),
  sortBy: $('#sortBy'),
  roomSummary: $('#roomSummary'),
  roomOptions: $('#roomOptions'),
  categoryOptions: $('#categoryOptions'),
  statItems: $('#statItems'),
  statQty: $('#statQty'),
  statValue: $('#statValue'),
  statRooms: $('#statRooms'),
  dialog: $('#itemDialog'),
  form: $('#itemForm'),
  dialogTitle: $('#dialogTitle'),
  deleteBtn: $('#deleteItem'),
  photoInput: $('#photoInput'),
  photoPreview: $('#photoPreview'),
  removePhoto: $('#removePhoto'),
};

let items = load();
let pendingPhoto = null; // data URL of the photo in the open dialog, or null

// ---------- Storage ----------

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (err) {
    alert('Could not save — browser storage is full. Try removing some photos or exporting a backup.');
    return false;
  }
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !String(raw.name || '').trim()) return null;
  const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fallback);
  const now = new Date().toISOString();
  return {
    id: String(raw.id || newId()),
    name: String(raw.name).trim(),
    room: String(raw.room || 'Unassigned').trim() || 'Unassigned',
    category: String(raw.category || '').trim(),
    quantity: Math.max(0, Math.round(num(raw.quantity, 1))),
    value: Math.max(0, num(raw.value, 0)),
    brand: String(raw.brand || '').trim(),
    serial: String(raw.serial || '').trim(),
    purchaseDate: String(raw.purchaseDate || ''),
    warrantyUntil: String(raw.warrantyUntil || ''),
    notes: String(raw.notes || ''),
    photo: typeof raw.photo === 'string' && raw.photo.startsWith('data:image/') ? raw.photo : null,
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- Helpers ----------

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const totalValue = (item) => item.value * item.quantity;
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function warrantyStatus(item) {
  if (!item.warrantyUntil) return null;
  const end = new Date(item.warrantyUntil + 'T00:00:00');
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((end - startOfToday) / 86400000);
  if (days < 0) return { cls: 'expired', text: 'Warranty expired' };
  if (days <= WARRANTY_WARN_DAYS) return { cls: 'warn', text: `Warranty ends in ${days}d` };
  return null;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    if (child != null) node.append(child);
  }
  return node;
}

// ---------- Rendering ----------

function filteredItems() {
  const q = els.search.value.trim().toLowerCase();
  const room = els.filterRoom.value;
  const category = els.filterCategory.value;

  const result = items.filter((it) => {
    if (room && it.room !== room) return false;
    if (category && it.category !== category) return false;
    if (!q) return true;
    return [it.name, it.room, it.category, it.brand, it.serial, it.notes]
      .some((field) => field.toLowerCase().includes(q));
  });

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    room: (a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name),
    'value-desc': (a, b) => totalValue(b) - totalValue(a),
    'value-asc': (a, b) => totalValue(a) - totalValue(b),
    'date-desc': (a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''),
    'updated-desc': (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return result.sort(sorters[els.sortBy.value] || sorters.name);
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.replaceChildren(el('option', { value: '', textContent: placeholder }),
    ...values.map((v) => el('option', { value: v, textContent: v })));
  select.value = values.includes(current) ? current : '';
}

function fillDatalist(list, values) {
  list.replaceChildren(...values.map((v) => el('option', { value: v })));
}

function render() {
  const rooms = uniqueSorted(items.map((i) => i.room));
  const categories = uniqueSorted(items.map((i) => i.category));

  fillSelect(els.filterRoom, rooms, 'All rooms');
  fillSelect(els.filterCategory, categories, 'All categories');
  fillDatalist(els.roomOptions, uniqueSorted(['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Garage', 'Office', ...rooms]));
  fillDatalist(els.categoryOptions, uniqueSorted(['Electronics', 'Furniture', 'Appliances', 'Jewelry', 'Tools', 'Clothing', ...categories]));

  // Stats cover the whole inventory, not just the filtered view.
  els.statItems.textContent = items.length;
  els.statQty.textContent = items.reduce((sum, i) => sum + i.quantity, 0);
  els.statValue.textContent = money.format(items.reduce((sum, i) => sum + totalValue(i), 0));
  els.statRooms.textContent = rooms.length;

  renderRoomSummary(rooms);

  const visible = filteredItems();
  els.empty.hidden = items.length > 0;
  els.noMatches.hidden = items.length === 0 || visible.length > 0;
  els.list.replaceChildren(...visible.map(renderItem));
}

function renderRoomSummary(rooms) {
  const chips = rooms.map((room) => {
    const roomItems = items.filter((i) => i.room === room);
    const value = roomItems.reduce((sum, i) => sum + totalValue(i), 0);
    const chip = el('button', {
      type: 'button',
      className: 'chip' + (els.filterRoom.value === room ? ' active' : ''),
      title: `Filter by ${room}`,
    }, room, el('span', { className: 'muted', textContent: `${roomItems.length} · ${money.format(value)}` }));
    chip.addEventListener('click', () => {
      els.filterRoom.value = els.filterRoom.value === room ? '' : room;
      render();
    });
    return chip;
  });
  els.roomSummary.replaceChildren(...chips);
}

function renderItem(item) {
  const warranty = warrantyStatus(item);
  const meta = [item.room, item.category, item.brand].filter(Boolean).join(' · ');
  const li = el('li', { className: 'item', tabIndex: 0 },
    item.photo ? el('img', { src: item.photo, alt: item.name, loading: 'lazy' }) : null,
    el('div', { className: 'item-body' },
      el('h3', { className: 'item-title', textContent: item.name }),
      el('div', { className: 'item-meta', textContent: meta }),
      warranty ? el('div', {}, el('span', { className: `badge ${warranty.cls}`, textContent: warranty.text })) : null,
      el('div', { className: 'item-footer' },
        el('span', { textContent: `Qty ${item.quantity}` }),
        el('strong', { textContent: money.format(totalValue(item)) }),
      ),
    ),
  );
  li.addEventListener('click', () => openDialog(item));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDialog(item);
    }
  });
  return li;
}

// ---------- Dialog ----------

function setPhoto(dataUrl) {
  pendingPhoto = dataUrl;
  els.photoPreview.hidden = !dataUrl;
  els.removePhoto.hidden = !dataUrl;
  if (dataUrl) els.photoPreview.src = dataUrl;
  else els.photoPreview.removeAttribute('src');
  els.photoInput.value = '';
}

function openDialog(item = null) {
  els.form.reset();
  const f = els.form.elements;
  els.dialogTitle.textContent = item ? 'Edit item' : 'Add item';
  els.deleteBtn.hidden = !item;
  f.id.value = item ? item.id : '';
  if (item) {
    for (const key of ['name', 'room', 'category', 'quantity', 'value', 'brand', 'serial', 'purchaseDate', 'warrantyUntil', 'notes']) {
      f[key].value = item[key] ?? '';
    }
    if (!item.value) f.value.value = '';
  } else if (els.filterRoom.value) {
    f.room.value = els.filterRoom.value;
  }
  setPhoto(item ? item.photo : null);
  els.dialog.showModal();
  f.name.focus();
}

function handleSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(els.form));
  const existing = items.find((i) => i.id === data.id);
  const item = normalize({
    ...existing,
    ...data,
    id: existing ? existing.id : newId(),
    photo: pendingPhoto,
    createdAt: existing ? existing.createdAt : undefined,
    updatedAt: new Date().toISOString(),
  });
  if (!item) return;

  const previous = items;
  items = existing ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
  if (!save()) {
    items = previous;
    return;
  }
  els.dialog.close();
  render();
}

function handleDelete() {
  const id = els.form.elements.id.value;
  const item = items.find((i) => i.id === id);
  if (!item || !confirm(`Delete "${item.name}"?`)) return;
  items = items.filter((i) => i.id !== id);
  save();
  els.dialog.close();
  render();
}

// Downscale photos so they fit comfortably in localStorage.
function resizeImage(file, maxSize = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

// ---------- Import / export ----------

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

function exportJson() {
  download(`house-inventory-${today()}.json`, JSON.stringify({ version: 1, items }, null, 2), 'application/json');
}

function exportCsv() {
  const columns = ['name', 'room', 'category', 'quantity', 'value', 'brand', 'serial', 'purchaseDate', 'warrantyUntil', 'notes'];
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    [...columns, 'totalValue'].join(','),
    ...items.map((i) => [...columns.map((c) => escape(i[c])), totalValue(i).toFixed(2)].join(',')),
  ];
  download(`house-inventory-${today()}.csv`, '﻿' + rows.join('\r\n'), 'text/csv');
}

async function importJson(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = (Array.isArray(parsed) ? parsed : parsed.items || []).map(normalize).filter(Boolean);
    if (!incoming.length) {
      alert('No items found in that file.');
      return;
    }
    const replace = confirm(
      `Found ${incoming.length} item(s).\n\nOK = replace your current inventory\nCancel = merge into it`
    );
    const previous = items;
    if (replace) {
      items = incoming;
    } else {
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const it of incoming) byId.set(it.id, it);
      items = [...byId.values()];
    }
    if (!save()) items = previous;
    render();
  } catch {
    alert('That file is not a valid inventory backup.');
  }
}

// ---------- Wiring ----------

$('#addItem').addEventListener('click', () => openDialog());
$('#cancelDialog').addEventListener('click', () => els.dialog.close());
$('#exportJson').addEventListener('click', exportJson);
$('#exportCsv').addEventListener('click', exportCsv);
$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importJson(file);
  e.target.value = '';
});
els.form.addEventListener('submit', handleSubmit);
els.deleteBtn.addEventListener('click', handleDelete);
els.removePhoto.addEventListener('click', () => setPhoto(null));
els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files[0];
  if (!file) return;
  try {
    setPhoto(await resizeImage(file));
  } catch {
    alert('Could not load that image.');
  }
});
for (const control of [els.search, els.filterRoom, els.filterCategory, els.sortBy]) {
  control.addEventListener('input', render);
}

render();
