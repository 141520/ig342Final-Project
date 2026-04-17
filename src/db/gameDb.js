import Dexie from 'dexie';
export const db = new Dexie('BeatdownDB');
db.version(1).stores({
  history: '++id, player, score, song, mode, date'
});