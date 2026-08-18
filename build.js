"use strict";
/* ============================================================
   Build production bundle: xáo trộn (obfuscate) code JS inline
   trong public/index.html rồi xuất ra dist/index.html. Không đụng
   tới HTML/CSS — chỉ obfuscate nội dung từng thẻ <script> để khi
   deploy, mở DevTools sẽ không thấy code gốc dễ đọc như trước.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC = path.join(__dirname, 'public', 'index.html');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'index.html');

const OBFUSCATE_OPTS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: true,
  selfDefending: true,
};

const html = fs.readFileSync(SRC, 'utf8');
let count = 0;

const built = html.replace(/<script>([\s\S]*?)<\/script>/g, (match, code) => {
  count++;
  const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATE_OPTS).getObfuscatedCode();
  return `<script>${result}</script>`;
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, built, 'utf8');
console.log(`Đã build ${count} khối <script> → ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
