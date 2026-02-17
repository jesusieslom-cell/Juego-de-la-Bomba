const fs = require('fs');
const path = require('path');

class FragmentGenerator {
  constructor(dictionary) {
    this.dictionary = dictionary;
    // fragments by length: { 2: [...], 3: [...], 4: [...] }
    this.fragments = { 2: [], 3: [], 4: [] };
  }

  load() {
    const fragPath = path.join(__dirname, '..', 'data', 'fragments.json');

    if (fs.existsSync(fragPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(fragPath, 'utf-8'));
        this.fragments = data;
        console.log(`🧩 Fragmentos cargados desde ${fragPath}: len2=${(data['2']||[]).length}, len3=${(data['3']||[]).length}, len4=${(data['4']||[]).length}`);
        return;
      } catch (e) {
        console.warn('⚠ Error leyendo fragments.json, recalculando...', e.message);
      }
    }

    console.log('🧩 Calculando fragmentos desde el diccionario (esto puede tomar unos segundos)...');
    this.buildFromDictionary();
  }

  buildFromDictionary() {
    const words = this.dictionary.getAll();
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

    // Determine min frequency based on dictionary size
    const dictSize = words.size;
    let minFreq;
    if (dictSize < 200) minFreq = 2;
    else if (dictSize < 1000) minFreq = 3;
    else if (dictSize < 5000) minFreq = 5;
    else minFreq = 20;

    // Max frequency to avoid too-easy fragments (top 5% excluded for large dicts)
    for (let len = 2; len <= 4; len++) {
      const entries = Object.entries(counts[len])
        .filter(([, count]) => count >= minFreq)
        .sort((a, b) => a[1] - b[1]);

      // For large dictionaries, also cap max frequency
      let maxFreq = Infinity;
      if (dictSize > 5000 && entries.length > 20) {
        const top5pct = Math.floor(entries.length * 0.95);
        maxFreq = entries[top5pct] ? entries[top5pct][1] : Infinity;
      }

      this.fragments[len] = entries
        .filter(([, count]) => count <= maxFreq)
        .map(([frag]) => frag);
    }

    console.log(`🧩 Fragmentos calculados: len2=${this.fragments[2].length}, len3=${this.fragments[3].length}, len4=${this.fragments[4].length}`);

    // If very few fragments, add some hardcoded common ones
    if (this.fragments[2].length < 5) {
      this.fragments[2] = [...new Set([...this.fragments[2], 'ar', 'er', 'ir', 'or', 'al', 'an', 'en', 'on', 'os', 'as', 'es', 'do', 'ro', 'la', 'ta', 'ma', 'ca', 'pa', 'sa', 'na', 'ra'])];
    }
    if (this.fragments[3].length < 5) {
      this.fragments[3] = [...new Set([...this.fragments[3], 'ado', 'ero', 'nte', 'ion', 'mos', 'lar', 'tar', 'nar', 'car', 'gar', 'rar', 'ber', 'der', 'ler', 'mer', 'ner', 'per', 'ser', 'ter', 'ver'])];
    }
    if (this.fragments[4].length < 5) {
      this.fragments[4] = [...new Set([...this.fragments[4], 'cion', 'ente', 'ment', 'ando', 'endo', 'iera', 'idad', 'ando', 'aron'])];
    }
  }

  getFragment(length, recentFragments) {
    const pool = this.fragments[length] || this.fragments[3] || [];
    if (pool.length === 0) {
      // Fallback
      const fallbacks = ['ar', 'er', 'al', 'on', 'an', 'os', 'as'];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // Avoid recent fragments
    const recentSet = new Set(recentFragments || []);
    const filtered = pool.filter(f => !recentSet.has(f));
    const candidates = filtered.length > 0 ? filtered : pool;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

module.exports = FragmentGenerator;
