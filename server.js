"use strict";
/* ============================================================
   ADO Project Dashboard — static host + same-origin proxy
   Cho phép deploy trang tĩnh trên domain khác Azure DevOps Server
   mà không bị trình duyệt chặn CORS: mọi gọi API đi qua /proxy
   ở cùng origin với trang, rồi server này mới forward sang ADO.
   ============================================================ */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Chỉ cho phép proxy tới các host trong danh sách này (chặn SSRF / open relay).
// Đổi qua biến môi trường ALLOWED_HOSTS, phân tách bởi dấu phẩy, khi deploy domain/server ADO khác.
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'ado.sharepoint.vn')
  .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);

// Hot reload khi dev (pnpm dev): livereload theo dõi public/, tự refresh trình
// duyệt khi sửa file. Tự chèn script client vào HTML thay vì dùng
// connect-livereload — package đó không tương thích với response của
// express.static (Content-Length khoá sẵn nên script không lọt vào được).
// Không require ở production nên không cần package này trong node_modules production.
if(isDev){
  const livereload = require('livereload');
  const lrServer = livereload.createServer({ exts: ['html', 'css', 'js'] });
  lrServer.watch(PUBLIC_DIR);

  const LR_SNIPPET = '<script src="http://localhost:35729/livereload.js?snipver=1"></script>\n</body>';
  app.get(/^\/(.*\.html)?$/, (req, res, next) => {
    const file = req.path === '/' ? 'index.html' : req.path.slice(1);
    fs.readFile(path.join(PUBLIC_DIR, file), 'utf8', (err, html) => {
      if(err) return next();
      res.type('html').send(html.replace('</body>', LR_SNIPPET));
    });
  });
}

app.use(express.static(PUBLIC_DIR));
app.use('/proxy', express.raw({ type: '*/*', limit: '10mb' }));

app.all('/proxy', async (req, res) => {
  const raw = req.query.url;
  if(!raw) return res.status(400).json({ error: 'Thiếu tham số url' });

  let target;
  try{ target = new URL(raw); }
  catch{ return res.status(400).json({ error: 'url không hợp lệ' }); }

  if(!/^https?:$/.test(target.protocol) || !ALLOWED_HOSTS.includes(target.hostname.toLowerCase())){
    return res.status(403).json({ error: `Domain đích "${target.hostname}" không nằm trong ALLOWED_HOSTS` });
  }

  const headers = { Accept: 'application/json' };
  if(req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
  if(req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  const hasBody = !['GET', 'HEAD'].includes(req.method) && req.body && req.body.length;

  try{
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(buf);
  }catch(e){
    res.status(502).json({ error: 'Không gọi được server đích: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`ADO Dashboard đang chạy tại http://localhost:${PORT}`);
  console.log(`Cho phép proxy tới: ${ALLOWED_HOSTS.join(', ')}`);
  if(isDev) console.log('Hot reload: đang bật (sửa file trong public/ sẽ tự refresh trình duyệt).');
});
