#!/usr/bin/env node

/**
 * Build fragments index from dictionary.
 * Usage: npm run build:fragments
 *
 * Reads data/spanish_words.txt and generates data/fragments.json
 * with valid substrings of length 2-4 filtered by frequency.
 */

const fs = require('fs');
const path = require('path');

function normalize(word) {
  let w = word.trim().toLowerCase();
  w = w.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
       .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
  w = w.replace(/[^a-zñ]/g, '');
  return w;
}

const dictPath = path.join(__dirname, '..', 'data', 'spanish_words.txt');
const outPath = path.join(__dirname, '..', 'data', 'fragments.json');

if (!fs.existsSync(dictPath)) {
  console.error('❌ No se encontró el diccionario en:', dictPath);
  console.error('   Crea el archivo data/spanish_words.txt con una palabra por línea.');
  process.exit(1);
}

console.log('📖 Leyendo diccionario...');
const content = fs.readFileSync(dictPath, 'utf-8');
const lines = content.split(/\r?\n/);
const words = new Set();
for (const line of lines) {
  const w = normalize(line);
  if (w.length >= 2) words.add(w);
}
console.log(`   ${words.size} palabras cargadas.`);

console.log('🔍 Calculando substrings...');
const counts = { 2: {}, 3: {}, 4: {} };

for (const word of words) {
  for (let len = 2; len <= 4; len++) {
    if (word.length < len) continue;
    const seen = new Set();
    for (let i = 0; i <= word.length - len; i++) {
      const frag = word.substring(i, i + len);
      if (!seen.has(frag)) {
        seen.add(frag);
        counts[len][frag] = (counts[len][frag] || 0) + 1;
      }
    }
  }
}

console.log('📊 Filtrando por frecuencia...');
const MIN_FREQ = 20;
const result = {};

for (let len = 2; len <= 4; len++) {
  const entries = Object.entries(counts[len]);
  const total = entries.length;

  // Filter by min frequency
  const filtered = entries.filter(([, count]) => count >= MIN_FREQ);

  // Sort by frequency (ascending)
  filtered.sort((a, b) => a[1] - b[1]);

  // Optional: remove top 5% too-easy fragments for len 2
  let maxIdx = filtered.length;
  if (len === 2 && filtered.length > 20) {
    maxIdx = Math.floor(filtered.length * 0.95);
  }

  result[len] = filtered.slice(0, maxIdx).map(([frag, count]) => frag);

  console.log(`   Longitud ${len}: ${total} total → ${result[len].length} válidos (min freq: ${MIN_FREQ})`);
}

// Ensure output directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`\n✅ Fragmentos guardados en: ${outPath}`);
console.log('   Puedes iniciar el servidor con: npm start');
