import { createUnitModel } from './unit-model.js';
export const MAX_ACTIVE_UNITS = 8;
const model = createUnitModel();
// Older saves are plain arrays; excess active entries become archived, never discarded.
export function normalizeLibrary(values) {
  const seen = new Set(); let active = 0;
  return (Array.isArray(values) ? values : []).filter(u => u?.id && u?.sprite?.src).map(raw => ({...model.balance(raw,raw.id),archived:raw.archived===true})).filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; }).map(u => {
    const archived = u.archived || active >= MAX_ACTIVE_UNITS;
    if (!archived) active++;
    return { ...u, archived };
  });
}
export function creationRoom(library) {
  return library.filter(u => !u.archived).length < MAX_ACTIVE_UNITS;
}
export function addToLibrary(library, unit) {
  const old = library.find(u => u.id === unit.id), next = { ...model.balance(unit, unit.id), archived: old ? old.archived : !creationRoom(library) };
  return old ? library.map(u => u.id === next.id ? next : u) : [...library, next];
}
export function archiveUnit(library, id, archived) {
  const old = library.find(u => u.id === id);
  if (!old) throw Error('这位队员不在档案中。');
  if (!archived && old.archived && !creationRoom(library)) throw Error('阵容已有 8 位自建队员，先收起一位再上阵。');
  return library.map(u => u.id === id ? { ...u, archived } : u);
}
