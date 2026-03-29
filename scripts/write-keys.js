#!/usr/bin/env node
// Reads keys from .env and writes them to electron/keys-default.json
// which gets bundled into the app package. This file is gitignored.
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const out = {
  openaiKey: process.env.VITE_OPENAI_API_KEY || '',
  pineconeKey: process.env.VITE_PINECONE_API_KEY || '',
};

const outPath = path.resolve(__dirname, '../electron/keys-default.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), { mode: 0o600 });
console.log('keys-default.json written.');
