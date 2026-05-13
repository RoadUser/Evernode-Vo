const fs = require('fs');

function loadEnv() {
  let env = {};
  try {
    const res = fs.readFileSync('.env', 'utf8');
    res.split(/\?\
/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.substring(0, idx);
      const rawVal = trimmed.substring(idx + 1);
      let val = rawVal;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
  } catch (e) {
    // no .env
  }
  return env;
}

module.exports = loadEnv();
