/* ============================================================================
   CoverRender —— 用 Canvas 2D 直接画三比例封面（零依赖，浏览器内出图）
   任何文案都会自动缩字号，绝不会出画。
   window.CoverRender = { RATIOS, draw, toPNG }
   ========================================================================== */
(function () {
  'use strict';

  var RATIOS = { '169': [1920, 1080], '43': [1440, 1080], '34': [1080, 1440] };
  var P = {
    '169': { pad: 112, grid: 96, f1: 176, f2: 96, fs: 42, ff: 32, fbd: 36, art: 740, portrait: false },
    '43':  { pad: 92,  grid: 80, f1: 140, f2: 78, fs: 34, ff: 28, fbd: 32, art: 540, portrait: false },
    '34':  { pad: 86,  grid: 72, f1: 168, f2: 90, fs: 38, ff: 30, fbd: 34, art: 560, portrait: true }
  };
  var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,sans-serif';
  var BLUE = '#007AFF', RED = '#FF3B30', ORANGE = '#FF9500', INK = '#1C1C1E', MUTE = '#6E6E73', BG = '#F2F2F7';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 自动缩字号 + 必要截断，保证不超出 maxW */
  function fit(ctx, s, weight, size, maxW) {
    var txt = String(s == null ? '' : s);
    var sz = size;
    var setF = function (z) { ctx.font = weight + ' ' + z + 'px ' + FONT; };
    setF(sz);
    var w = ctx.measureText(txt).width;
    if (w > maxW && w > 0) { sz = Math.max(Math.round(size * 0.42), Math.floor(size * maxW / w)); setF(sz); }
    if (ctx.measureText(txt).width > maxW) {
      while (txt.length > 2 && ctx.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1);
      txt += '…';
    }
    return { size: sz, text: txt };
  }
  function put(ctx, s, x, y, size, weight, color, align) {
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function measure(ctx, s, weight, size) {
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    return ctx.measureText(s).width;
  }

  /* 主题图形：中心块 + 同心环 + 8 条辐条光点（与 deck 内图形同源） */
  function art(ctx, x, y, size, letter) {
    var cx = x + size / 2, cy = y + size / 2, R = size / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,122,255,.13)'; ctx.lineWidth = Math.max(2, R * 0.008);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.80, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,122,255,.10)';
    ctx.setLineDash([R * 0.04, R * 0.06]);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.60, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      var r0 = R * 0.34, r1 = (R * 0.70) - (i % 2) * R * 0.09;
      var x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
      var x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
      var mx = cx + Math.cos(a) * (r0 + r1) / 2 + Math.cos(a + 1.2) * R * 0.09;
      var my = cy + Math.sin(a) * (r0 + r1) / 2 + Math.sin(a + 1.2) * R * 0.09;
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, BLUE); g.addColorStop(1, '#5AB0FF');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(6, R * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      ctx.fillStyle = ORANGE;
      ctx.beginPath(); ctx.arc(x1, y1, Math.max(4, R * 0.035), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,149,0,.28)'; ctx.lineWidth = Math.max(2, R * 0.012);
      ctx.beginPath(); ctx.arc(x1, y1, Math.max(8, R * 0.065), 0, Math.PI * 2); ctx.stroke();
    }
    var bw = R * 0.60, bx = cx - bw / 2, by = cy - bw / 2;
    var hg = ctx.createLinearGradient(bx, by, bx + bw, by + bw);
    hg.addColorStop(0, '#3AA0FF'); hg.addColorStop(1, BLUE);
    ctx.shadowColor = 'rgba(0,60,140,.28)'; ctx.shadowBlur = R * 0.12; ctx.shadowOffsetY = R * 0.05;
    ctx.fillStyle = hg; rr(ctx, bx, by, bw, bw, R * 0.18); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    put(ctx, letter || 'A', cx, cy + R * 0.11, Math.round(R * 0.28), '800', '#fff', 'center');
    ctx.restore();
  }

  function draw(canvas, ratio, d) {
    d = d || {};
    var size = RATIOS[ratio] || RATIOS['169'];
    var W = size[0], H = size[1], p = P[ratio] || P['169'];
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    /* 底 + 网格 */
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(28,28,30,.055)'; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += p.grid) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (var y = 0; y <= H; y += p.grid) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }

    /* 图形位置 + 蓝色辉光 */
    var artX = p.portrait ? (W - p.art) / 2 : W - p.pad - p.art;
    var artY = p.portrait ? (H - p.pad - p.art) : (H - p.art) / 2;
    var gl = ctx.createRadialGradient(artX + p.art / 2, artY + p.art / 2, p.art * 0.05, artX + p.art / 2, artY + p.art / 2, p.art * 0.78);
    gl.addColorStop(0, 'rgba(0,122,255,.13)'); gl.addColorStop(1, 'rgba(0,122,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

    /* ---- 文案：定版心 → 自动适配字号 → 按实际高度居中 ---- */
    var blockW = p.portrait ? W - p.pad * 2 : (artX - p.pad * 1.4);
    var neq = d.neq || '≠';
    var nqsz = Math.round(p.f2 * 1.12);
    var wneq = measure(ctx, neq, '900', nqsz);
    var bad = fit(ctx, d.badge || '', '700', p.fbd, blockW);
    var f1 = fit(ctx, d.l1 || '', '900', p.f1, blockW);
    var f2 = fit(ctx, d.l2 || '', '800', p.f2, Math.max(140, blockW - wneq - p.f2 * 0.18));
    var fsub = fit(ctx, d.sub || '', '600', p.fs, blockW);
    var ffoot = fit(ctx, d.foot || '', '700', p.ff, blockW - p.ff * 1.2);

    var badgeH = p.fbd * 2.0, gap = p.f1 * 0.16;
    var h1 = f1.size * 1.02, h2 = f2.size * 1.28, hs = fsub.size * 1.7, hf = ffoot.size * 2.0;
    var hasBadge = !!(d.badge || '').trim();
    var blockH = (hasBadge ? badgeH + gap : 0) + h1 + h2 * 0.92 + hs + hf;
    var top = p.portrait
      ? p.pad + Math.max(0, (H - p.pad * 2 - p.art - f1.size * 0.4 - blockH) / 2)
      : (H - blockH) / 2;
    var left = p.portrait ? W / 2 : p.pad;
    var align = p.portrait ? 'center' : 'left';
    var cy = top;

    if (hasBadge) {
      var badgeW = Math.min(blockW, measure(ctx, bad.text, '700', bad.size) + p.fbd * 3.4);
      var bx = p.portrait ? W / 2 - badgeW / 2 : p.pad;
      ctx.fillStyle = 'rgba(0,122,255,.10)'; rr(ctx, bx, cy, badgeW, badgeH, badgeH / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,122,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = BLUE; ctx.beginPath();
      ctx.arc(bx + p.fbd * 1.05, cy + badgeH / 2, p.fbd * 0.26, 0, Math.PI * 2); ctx.fill();
      put(ctx, bad.text, bx + p.fbd * 1.65, cy + badgeH * 0.68, bad.size, '700', BLUE);
      cy += badgeH + gap;
    }

    /* 第一行：蓝色渐变大字 */
    var w1 = measure(ctx, f1.text, '900', f1.size);
    var x1 = p.portrait ? W / 2 - w1 / 2 : p.pad;
    var g1 = ctx.createLinearGradient(x1, cy, x1 + w1, cy + f1.size);
    g1.addColorStop(0, '#0A84FF'); g1.addColorStop(.45, BLUE); g1.addColorStop(1, '#5AB0FF');
    ctx.font = '900 ' + f1.size + 'px ' + FONT; ctx.fillStyle = g1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(f1.text, x1, cy + f1.size * 0.80);
    cy += h1;

    /* 第二行：红 ≠ + 黑字 */
    var w2 = measure(ctx, f2.text, '800', f2.size);
    var lineW = wneq + p.f2 * 0.18 + w2;
    var lx = p.portrait ? W / 2 - lineW / 2 : p.pad;
    put(ctx, neq, lx, cy + h2 * 0.70, nqsz, '900', RED);
    put(ctx, f2.text, lx + wneq + p.f2 * 0.18, cy + h2 * 0.66, f2.size, '800', INK);
    cy += h2 * 0.92;

    /* 副标题 + 落款 */
    put(ctx, fsub.text, left, cy + fsub.size * 0.95, fsub.size, '600', MUTE, align);
    cy += hs;
    if (ffoot.text) {
      var fwText = ffoot.text;
      var fw = measure(ctx, fwText, '700', ffoot.size) + ffoot.size * 1.2;
      var fx = p.portrait ? W / 2 - fw / 2 : p.pad;
      ctx.fillStyle = ORANGE; ctx.beginPath();
      ctx.arc(fx + ffoot.size * 0.28, cy + ffoot.size * 0.30, ffoot.size * 0.28, 0, Math.PI * 2); ctx.fill();
      put(ctx, fwText, fx + ffoot.size * 0.85, cy + ffoot.size * 0.80, ffoot.size, '700', INK);
    }

    /* ---- 主题图形 ---- */
    art(ctx, artX, artY, p.art, d.mark || (d.l1 || 'A').slice(0, 1).toUpperCase());
    return canvas;
  }

  /* 把一张模型出的图居中裁到目标比例（挑小的那条边铺满，多的裁掉）。
     img 是 HTMLImageElement（已加载）、dataURL 也行。出图尺寸往往跟目标比例不完全一致，
     这里保证任何来源的图都能裁成精确的 3 比 4 / 4 比 3 / 16 比 9，不挤压不变形。 */
  function cover(canvas, ratio, img) {
    var T = RATIOS[ratio] || RATIOS['169'];
    var W = T[0], H = T[1];
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var iw = img.naturalWidth || img.videoWidth || img.width || 1;
    var ih = img.naturalHeight || img.videoHeight || img.height || 1;
    var scale = Math.max(W / iw, H / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return canvas;
  }

  window.CoverRender = {
    RATIOS: RATIOS,
    draw: draw,
    cover: cover,
    toPNG: function (canvas) { return canvas.toDataURL('image/png'); }
  };
})();
