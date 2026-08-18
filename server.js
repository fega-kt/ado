"use strict";
/* ============================================================
   ADO Project Dashboard — static host + same-origin proxy
   Cho phép deploy trang tĩnh trên domain khác Azure DevOps Server
   mà không bị trình duyệt chặn CORS: mọi gọi API đi qua /proxy
   ở cùng origin với trang, rồi server này mới forward sang ADO.
   ============================================================ */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Chỉ cho phép proxy tới các host trong danh sách này (chặn SSRF / open relay).
// Đổi qua biến môi trường ALLOWED_HOSTS, phân tách bởi dấu phẩy, khi deploy domain/server ADO khác.
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'ado.sharepoint.vn')
  .split(',').map(h => h.trim().toLowerCase()).filter(Boolean);

app.use(express.static(path.join(__dirname, 'public')));
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
});
