import fs from 'fs';
import path from 'path';

const listsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../lib/bully_lists');
const csvPath = path.join(listsDir, 'bully_dataset.csv');
const meaningsPath = path.join(listsDir, 'meanings.json');

function langNameToCode(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const map = {
    'hindi': 'hin',
    'english': 'eng',
    'marathi': 'mar',
    'tamil': 'tam',
    'telugu': 'tel',
    'bengali': 'ben',
    'gujarati': 'guj',
    'punjabi': 'pan',
    'malayalam': 'mal',
    'kannada': 'kan',
    'hindi/hinglish': 'hing',
    'hinglish': 'hing',
    'hing': 'hing'
  };
  return map[n] || n.slice(0,3);
}

function severityToLevel(s) {
  if (!s) return 'medium';
  const t = s.trim().toLowerCase();
  if (t === 'high') return 'high';
  if (t === 'low') return 'low';
  return 'medium';
}

function readJsonSafe(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {}
  return { high: [], medium: [], low: [] };
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

async function run() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV dataset not found at', csvPath);
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const header = lines.shift();

  let meanings = {};
  try { meanings = readJsonSafe(meaningsPath); } catch(e) { meanings = {}; }

  for (const line of lines) {
    // split by tab or comma
    const parts = line.split(/\t|,/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;
    const [langName, word, engMeaning, severity] = parts;
    const code = langNameToCode(langName);
    if (!code) continue;

    const lvl = severityToLevel(severity);

    const listPath = path.join(listsDir, `${code}.json`);
    const list = readJsonSafe(listPath);

    // ensure arrays
    list.high = list.high || [];
    list.medium = list.medium || [];
    list.low = list.low || [];

    // add word to appropriate list if missing
    const arr = lvl === 'high' ? list.high : (lvl === 'medium' ? list.medium : list.low);
    if (!arr.includes(word)) arr.push(word);

    // dedupe and sort
    list.high = Array.from(new Set(list.high)).sort();
    list.medium = Array.from(new Set(list.medium)).sort();
    list.low = Array.from(new Set(list.low)).sort();

    writeJson(listPath, list);

    // update meanings
    meanings[code] = meanings[code] || {};
    // store lowercase key for lookup
    meanings[code][word.toLowerCase()] = engMeaning;
  }

  writeJson(meaningsPath, meanings);

  console.log('Import complete. Updated lists and meanings.');
}

run().catch(err => { console.error(err); process.exit(2); });
