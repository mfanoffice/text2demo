/* ============================================================================
   DeckEngine —— 把分镜（storyboard）编译成一份完整的单文件演示动画 HTML
   零依赖 · 经典脚本（file:// 可直接 <script src> 加载）
   导出：window.DeckEngine = { TYPES, ICONS, art, draft, build, blank }
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ 图标 */
  var ICONS = {
    box:    '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M24 8l15 8v16l-15 8-15-8V16z"/><path d="M9 16l15 8 15-8M24 24v16"/></g></svg>',
    key:    '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><circle cx="17" cy="17" r="7"/><path d="M22 22l16 16M31 31l-4 4M36 36l-4 4"/></g></svg>',
    lock:   '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><rect x="10" y="21" width="28" height="19" rx="5"/><path d="M17 21v-6a7 7 0 0 1 14 0v6"/></g></svg>',
    cloud:  '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M15 36h19a9 9 0 0 0 1-18 13 13 0 0 0-25 3 8 8 0 0 0 5 15z"/></g></svg>',
    doc:    '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M13 8h15l7 7v25H13z"/><path d="M28 8v7h7M19 25h10M19 32h10"/></g></svg>',
    sheet:  '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><rect x="10" y="10" width="28" height="28" rx="4"/><path d="M10 20h28M10 29h28M20 10v28"/></g></svg>',
    folder: '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M8 14h12l4 5h16v19H8z"/></g></svg>',
    chat:   '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M9 12h30v20H22l-9 8v-8H9z"/></g></svg>',
    bolt:   '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M26 6L13 27h9l-2 15 15-22h-9z"/></g></svg>',
    user:   '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><circle cx="24" cy="17" r="8"/><path d="M9 41c2-9 8-13 15-13s13 4 15 13"/></g></svg>',
    check:  '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.4"><path d="M11 25l9 9 17-20"/></g></svg>',
    globe:  '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><circle cx="24" cy="24" r="16"/><path d="M8 24h32M24 8c5 6 5 26 0 32M24 8c-5 6-5 26 0 32"/></g></svg>',
    shield: '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><path d="M24 7l14 5v11c0 10-6 16-14 19-8-3-14-9-14-19V12z"/><path d="M18 24l4 4 8-9"/></g></svg>',
    screen: '<svg viewBox="0 0 48 48"><g class="stroke" style="stroke-width:3.2"><rect x="8" y="10" width="32" height="22" rx="4"/><path d="M4 38h40"/></g></svg>'
  };
  var ICON_KEYS = Object.keys(ICONS);
  function icon(name) { return ICONS[name] || ICONS.box; }

  /* --------------------------------------------------------------- 通用图形 */
  /* 轨道图形：中心块 + 同心环 + 辐条光点（话题无关，任何主题都能用） */
  function orbitArt(o) {
    o = o || {};
    var letter = o.letter || 'A';
    var spokes = o.spokes || 8;
    var accent = o.color || '#007AFF';
    var cx = 200, cy = 200;
    var parts = '';
    parts += '<circle cx="200" cy="200" r="150" fill="none" stroke="' + accent + '" stroke-opacity=".13" stroke-width="2"/>';
    parts += '<circle cx="200" cy="200" r="112" fill="none" stroke="' + accent + '" stroke-opacity=".10" stroke-width="2" stroke-dasharray="7 11"/>';
    for (var i = 0; i < spokes; i++) {
      var a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
      var r0 = 62, r1 = 132 - (i % 2) * 16;
      var x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
      var x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
      var mx = cx + Math.cos(a) * (r0 + r1) / 2, my = cy + Math.sin(a) * (r0 + r1) / 2;
      parts += '<path d="M' + f(x0) + ',' + f(y0) + ' Q' + f(mx + Math.cos(a + 1.2) * 16) + ',' + f(my + Math.sin(a + 1.2) * 16) + ' ' + f(x1) + ',' + f(y1) + '" fill="none" stroke="url(#dgLeg)" stroke-width="9" stroke-linecap="round"/>';
      parts += '<circle cx="' + f(x1) + '" cy="' + f(y1) + '" r="7" fill="#FF9500"/>';
      parts += '<circle cx="' + f(x1) + '" cy="' + f(y1) + '" r="14" fill="none" stroke="#FF9500" stroke-opacity=".26" stroke-width="2.4"/>';
    }
    return '<svg viewBox="0 0 400 400" width="100%" height="100%" style="display:block;overflow:hidden">' +
      '<defs><linearGradient id="dgHead" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#3AA0FF"/><stop offset="1" stop-color="' + accent + '"/></linearGradient>' +
      '<linearGradient id="dgLeg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + accent + '"/><stop offset="1" stop-color="#5AB0FF"/></linearGradient></defs>' +
      parts +
      '<rect x="140" y="140" width="120" height="120" rx="36" fill="url(#dgHead)"/>' +
      '<text x="200" y="200" text-anchor="middle" dominant-baseline="central" ' +
      'font-family="-apple-system,PingFang SC,sans-serif" font-size="56" font-weight="800" fill="#fff">' + esc(letter) + '</text>' +
      '</svg>';
  }

  function f(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function lines(s) {
    return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function split2(s) {
    var p = String(s).split('|');
    return { t: (p[0] || '').trim(), d: (p[1] || '').trim(), c: (p[2] || '').trim() };
  }
  var COLORS = { blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30' };
  function col(name, i) {
    if (COLORS[name]) return COLORS[name];
    return [COLORS.blue, COLORS.green, COLORS.orange, COLORS.red][(i || 0) % 4];
  }

  /* ------------------------------------------------------------- 页面模板 */
  /* 每个模板返回该页的 innerHTML；元素的 DOM 顺序 = 空格的释放顺序 */
  var TYPES = ['cover', 'points', 'equation', 'neq', 'facts', 'local', 'flow', 'hub', 'cards'];
  /* 分镜里能选的类型：不含 cover。封面在「封面」页签单独做，不占演示的一页。
     cover 模板保留只是为了兼容旧分镜数据，新分镜不该再产出它。 */
  var CONTENT_TYPES = ['custom', 'points', 'equation', 'neq', 'facts', 'local', 'flow', 'hub', 'cards'];
  var TYPE_LABEL = {
    cover: '封面', custom: 'AI 设计页', points: '要点', equation: '等式', neq: '反转', facts: '事实徽章',
    local: '本地方案', flow: '流程', hub: '枢纽辐射', cards: '三张卡'
  };

  function head(p) {
    return '<div class="anim p-head" data-from="down">' +
      (p.kicker ? '<div class="kicker">' + esc(p.kicker) + '</div>' : '') +
      '<h2 class="p-title">' + esc(p.title) + '</h2>' +
      (p.sub ? '<div class="p-sub">' + esc(p.sub) + '</div>' : '') + '</div>';
  }
  function titleWithAccent(title, accent) {
    var t = esc(title);
    if (!accent) return t;
    var i = t.indexOf(esc(accent));
    if (i < 0) return t;
    var a = esc(accent);
    return t.slice(0, i) + '<em>' + a + '</em>' + t.slice(i + a.length);
  }
  function stagger(inner) { return '<div class="stagger" style="display:contents">' + inner + '</div>'; }

  /* --------------------------------------------------------- CSS 作用域化
     AI 每页自己写 CSS，直接塞进去会互相串味，所以把每条选择器前缀成 .sN。
     @keyframes / @font-face 里的 from/to/百分比不动。 */
  function scopeCSS(css, scope) {
    if (!css) return '';
    var out = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
    var res = '', i = 0;
    while (i < out.length) {
      var brace = out.indexOf('{', i);
      if (brace < 0) { res += out.slice(i); break; }
      var head = out.slice(i, brace).trim();
      var depth = 0, j = brace, end = -1;
      for (; j < out.length; j++) {
        if (out[j] === '{') depth++;
        else if (out[j] === '}') { depth--; if (!depth) { end = j; break; } }
      }
      if (end < 0) break;
      var body = out.slice(brace + 1, end);
      if (/^@(keyframes|-webkit-keyframes|font-face)/i.test(head)) {
        res += head + '{' + body + '}';
      } else if (/^@(media|supports)/i.test(head)) {
        res += head + '{' + scopeCSS(body, scope) + '}';
      } else if (head) {
        var sel = head.split(',').map(function (x) {
          x = x.trim(); if (!x) return '';
          if (x.indexOf('&') === 0) return scope + x.slice(1);
          if (/^(from|to|[\d.]+%)$/i.test(x)) return x;
          return scope + ' ' + x;
        }).filter(Boolean).join(',');
        res += sel + '{' + body + '}';
      }
      i = end + 1;
    }
    return res;
  }

  var T = {};

  /* AI 现场设计的页面：结构与图示由模型写，风格由外壳保证。
     模型只写「本页内容」；舞台、网格、配色变量、入场动画、循环注视动画、
     步进顺序、字幕安全区全部由外壳负责。 */
  T.custom = function (p) {
    return String(p.html || '');
  };

  T.cover = function (p) {
    var items = lines(p.items);
    return '<div class="anim cover-kicker" data-from="down">' + esc(p.kicker || '') + '</div>' +
      '<h1 class="anim cover-title" data-from="rise">' + titleWithAccent(p.title || '', p.accent) + '</h1>' +
      (p.sub ? '<div class="anim cover-sub" data-from="up">' + esc(p.sub) + '</div>' : '') +
      '<div class="anim cover-octo" data-from="scale"><div class="idle idle-fill l-float">' +
        orbitArt({ letter: (p.mark || (p.title || 'A').slice(0, 1)).toUpperCase(), spokes: 8 }) + '</div></div>' +
      (items[0] ? '<div class="anim cover-caption" data-from="up">' + esc(items[0]) + '</div>' : '');
  };

  T.points = function (p) {
    var items = lines(p.items);
    var n = Math.min(items.length, 6);
    var cards = items.slice(0, n).map(function (s, i) {
      var o = split2(s);
      return '<div class="pt" style="--i:' + i + '">' +
        '<div class="n" style="background:' + col(o.c, i) + '">' + (i + 1) + '</div>' +
        '<div><div class="t">' + esc(o.t) + '</div>' + (o.d ? '<div class="d">' + esc(o.d) + '</div>' : '') + '</div></div>';
    }).join('');
    return head(p) + '<div class="anim pts n' + n + '" data-from="rise">' + stagger(cards) + '</div>';
  };

  T.equation = function (p) {
    var items = lines(p.items);
    var L = split2(items[0] || 'A'), R = split2(items[1] || 'B');
    var op = p.op === '≠' ? '≠' : '=';
    function cell(o, color, from) {
      return '<div class="anim eq-cell" data-from="' + from + '">' +
        '<div class="eq-mark"><span class="idle idle-fill l-sheen sheen"></span>' +
        '<div style="font-size:76px;font-weight:900;letter-spacing:-.04em;color:' + color + '">' + esc(o.t) + '</div></div>' +
        '<div class="eq-label">' + esc(o.t) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</div></div>';
    }
    var mark = op === '='
      ? '<div class="eq-equal"><span></span><span></span></div>'
      : '<div class="eq-equal" style="position:relative"><span></span><span></span>' +
        '<i style="position:absolute;left:-14px;top:50%;width:132px;height:18px;border-radius:9px;background:var(--red);transform:rotate(-17deg)"></i></div>';
    return head(p) +
      '<div class="eq">' + cell(L, 'var(--blue)', 'left') +
      '<div class="anim" data-from="scale" style="display:flex;align-items:center">' + mark + '</div>' +
      cell(R, 'var(--ink)', 'right') + '</div>' +
      (p.mark ? '<div class="anim eq-q" data-from="scale">' + esc(p.mark) + '</div>' : '');
  };

  T.neq = function (p) {
    var q = lines(p.items);
    return head(p) +
      '<div class="neq">' +
        '<div class="anim neq-bar b1" data-from="left"></div>' +
        '<div class="anim neq-bar b2" data-from="right"></div>' +
        '<div class="anim neq-crack" data-from="down"></div>' +
        '<div class="anim neq-halo idle l-halo" data-from="scale"></div>' +
      '</div>' +
      '<div class="anim neq-note" data-from="right"><div class="neq-quote">' +
        q.map(function (s) { return esc(s); }).join('<br>') + '</div></div>' +
      (p.caption ? '<div class="anim name-chip" data-from="up"><span class="chip"><span class="dot" style="background:var(--blue)">' +
        icon('user') + '</span>' + esc(p.caption) + '</span></div>' : '');
  };

  T.facts = function (p) {
    var items = lines(p.items).slice(0, 4);
    var badges = items.map(function (s, i) {
      var o = split2(s), c = col(o.c, i);
      return '<div class="badge" style="--i:' + i + '"><span class="bar" style="background:' + c + '"></span>' +
        '<span class="ic" style="background:' + c + '">' + icon(o.c === 'red' ? 'shield' : ['box', 'lock', 'bolt', 'globe'][i % 4]) + '</span>' +
        '<span><span class="txt">' + esc(o.t) + '</span>' + (o.d ? '<div class="sub">' + esc(o.d) + '</div>' : '') + '</span></div>';
    }).join('');
    return head(p) +
      '<div class="anim hub" data-from="scale"><div class="idle idle-fill l-float">' +
        orbitArt({ letter: (p.mark || (p.title || 'A').slice(0, 1)).toUpperCase(), spokes: 8 }) + '</div></div>' +
      (p.caption ? '<div class="anim hub-caption" data-from="up">' + esc(p.caption) + '</div>' : '') +
      '<div class="anim badges" data-from="right">' + stagger(badges) + '</div>';
  };

  T.local = function (p) {
    var items = lines(p.items).slice(0, 4);
    var chips = items.map(function (s, i) {
      var o = split2(s);
      return '<div class="fall-chip" style="--i:' + i + '"><i style="background:' + col(o.c, i) + '">' +
        icon(['chat', 'bolt', 'key', 'lock'][i % 4]) + '</i>' + esc(o.t) + '</div>';
    }).join('');
    return head(p) +
      '<div class="anim device" data-from="rise"><div class="scr"><span class="idle idle-fill l-scan scan"></span>' +
        '<div class="folder"><div class="tab"></div><div class="body"></div>' +
        '<div class="label">' + esc(p.folder || '~/data') + '</div></div>' +
      '</div></div>' +
      '<div class="anim falls" data-from="down">' + stagger(chips) + '</div>' +
      '<div class="anim cut" data-from="none" style="--from:translate3d(0,18px,0)"><div class="stagger">' +
        '<div class="cut-line" style="--i:0"></div>' +
        '<div class="cut-stop" style="--i:1"><svg viewBox="0 0 96 96"><g class="stroke" style="stroke-width:7;color:var(--red)">' +
          '<circle cx="48" cy="48" r="32"/><path d="M27 69L69 27"/></g></svg></div>' +
        '<div class="cloud" style="--i:2"><svg viewBox="0 0 194 150"><g class="stroke" style="stroke-width:6;color:#C7C7CC">' +
          '<path d="M52 118h76a30 30 0 0 0 3-60 44 44 0 0 0-85 10 27 27 0 0 0 6 50z"/></g></svg></div>' +
        (p.badge ? '<div class="cut-badge" style="--i:3"><b>' + esc(p.badge) + '</b><span>' + esc(p.caption || '') + '</span></div>' : '') +
      '</div></div>';
  };

  T.flow = function (p) {
    var nodes = lines(p.items).slice(0, 5);
    var chips = String(p.caption || '').split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var steps = nodes.map(function (s, i) {
      var o = split2(s), c = col(o.c, i);
      return '<div class="fstep' + (i === nodes.length - 1 ? ' last' : '') + '" style="--i:' + i + '">' +
        '<div class="fnode"><div class="ic" style="background:' + c + '">' + icon(['user', 'bolt', 'bolt', 'check', 'star'][i % 5] || 'bolt') + '</div>' +
        '<div class="t">' + esc(o.t) + '</div></div>' +
        '<div class="fconn"><svg viewBox="0 0 120 38" preserveAspectRatio="none">' +
        '<path class="l-flow" pathLength="100" style="--i:' + i + '" d="M2 19H98" stroke="' + c + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="14 100" fill="none"/>' +
        '<path d="M96 11l12 8-12 8z" fill="' + c + '" opacity=".85"/></svg></div></div>';
    }).join('');
    return head(p) + '<div class="anim flow" data-from="none" style="--from:translate3d(0,20px,0)">' + stagger(steps) + '</div>' +
      (chips.length ? '<div class="anim abilities" data-from="rise">' + stagger(chips.map(function (t, i) {
        return '<div class="ability" style="--i:' + i + '"><span class="ic">' + icon(['doc', 'sheet', 'folder', 'globe'][i % 4]) + '</span>' + esc(t) + '</div>';
      }).join('')) + '</div>' : '');
  };

  T.hub = function (p) {
    var sats = lines(p.items).slice(0, 4);
    var pos = ['s1', 's2', 's3', 's4'];
    var box = sats.map(function (s, i) {
      var o = split2(s);
      return '<div class="anim sat ' + pos[i] + '" data-from="' + ['left', 'right', 'left', 'right'][i] + '" style="--d:' + (i * 0.4) + 's">' +
        '<span class="ic" style="background:' + col(o.c, i) + '">' + icon(['screen', 'globe', 'chat', 'doc'][i % 4]) + '</span>' +
        '<span><span class="t">' + esc(o.t) + '</span>' + (o.d ? '<div class="s">' + esc(o.d) + '</div>' : '') + '</span></div>';
    }).join('');
    return head(p) +
      '<div class="spoke"><svg class="spoke-lines" viewBox="0 0 1408 526">' +
        '<g fill="none" stroke="#C7C7CC" stroke-width="3" stroke-dasharray="10 9">' +
          '<path d="M652 222L348 80"/><path d="M756 222L1060 80"/><path d="M652 298L348 396"/><path d="M756 298L1060 396"/></g>' +
        '<g fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="14 100">' +
          '<path class="l-flow" pathLength="100" d="M652 222L348 80" stroke="#007AFF" style="--i:0"/>' +
          '<path class="l-flow" pathLength="100" d="M756 222L1060 80" stroke="#34C759" style="--i:1"/>' +
          '<path class="l-flow" pathLength="100" d="M652 298L348 396" stroke="#FF9500" style="--i:2"/>' +
          '<path class="l-flow" pathLength="100" d="M756 298L1060 396" stroke="#FF3B30" style="--i:3"/></g></svg>' +
        '<div class="anim hub-core" data-from="scale"><span class="idle idle-fill l-pulse halo"></span>' +
        '<span class="wm">' + esc(p.mark || 'W') + '</span></div>' + box +
      '</div>';
  };

  T.cards = function (p) {
    var items = lines(p.items).slice(0, 4);
    var cards = items.map(function (s, i) {
      var o = split2(s), c = col(o.c, i);
      var art = i === 0 ? '<svg viewBox="0 0 120 120" style="width:150px;height:150px"><g class="stroke" style="stroke-width:5;color:' + c + '"><circle cx="60" cy="60" r="34"/><path d="M42 60l13 13 24-28"/></g></svg>'
        : i === 1 ? '<svg viewBox="0 0 120 120" style="width:150px;height:150px"><g class="stroke" style="stroke-width:5;color:' + c + '"><rect x="20" y="26" width="80" height="54" rx="10"/><path d="M10 94h100"/></g></svg>'
        : '<svg viewBox="0 0 120 120" style="width:150px;height:150px"><g class="stroke" style="stroke-width:5;color:' + c + '"><path d="M38 92h44a22 22 0 0 0 2-44 32 32 0 0 0-62 8 20 20 0 0 0 16 36z"/></g></svg>';
      return '<div class="way" style="--i:' + i + '"><span class="idx">0' + (i + 1) + '</span>' +
        '<div class="viz"><div class="idle idle-fill l-float-s" style="--d:' + (i * 0.3) + 's">' + art + '</div></div>' +
        '<div class="t">' + esc(o.t) + '</div>' + (o.d ? '<div class="d">' + esc(o.d) + '</div>' : '') + '</div>';
    }).join('');
    return head(p) + '<div class="anim ways" data-from="rise">' + stagger(cards) + '</div>';
  };

  /* ------------------------------------------------------------------ 主题
     主题 = 一组 CSS 变量 + 一个外壳级点缀（--accentbar）。模型页子只准用 var(--x)，
     所以换主题不重新分镜：改的是 build 注入的 :root，不是页面内容。
     语义色纪律：蓝=主强调 / 绿=肯定 / 橙=注意 / 红=风险，8 套都保持，
     分镜语法里的 blue|green|orange|red 与校验器不用动。 */
  var THEMES = {
    keynote:   { label: 'Keynote 浅色', vars: {
      '--blue':'#007AFF','--green':'#34C759','--orange':'#FF9500','--red':'#FF3B30','--bg':'#F2F2F7','--ink':'#1C1C1E','--ink2':'#3A3A3C','--mute':'#8E8E93','--line':'#D1D1D6','--card':'#FFF','--grid':'64px','--gline':'rgba(28,28,30,.055)','--seg':'rgba(28,28,30,.07)','--shadow':'0 1px 2px rgba(0,0,0,.05),0 14px 34px -18px rgba(0,0,0,.28)','--shadow-lg':'0 2px 4px rgba(0,0,0,.05),0 26px 60px -30px rgba(0,0,0,.35)','--accentbar':'none','--blue2':'#34A0FF','--oncolor':'#FFF' } },
    dark:      { label: '暗夜 Dark', vars: {
      '--blue':'#409CFF','--green':'#3AD67A','--orange':'#FFA033','--red':'#FF5C57','--bg':'#0E0E11','--ink':'#F5F5F7','--ink2':'#C7C7CC','--mute':'#8E8E93','--line':'#3A3A3E','--card':'#1C1C21','--grid':'64px','--gline':'rgba(255,255,255,.05)','--seg':'rgba(255,255,255,.09)','--shadow':'0 0 0 1px rgba(255,255,255,.07),0 24px 44px -20px rgba(0,0,0,.8)','--shadow-lg':'0 0 0 1px rgba(255,255,255,.09),0 30px 60px -24px rgba(0,0,0,.9)','--accentbar':'none','--blue2':'#7AB8FF','--oncolor':'#FFF' } },
    midnight:  { label: '极夜蓝', vars: {
      '--blue':'#5B8CFF','--green':'#4CD6A8','--orange':'#FFB454','--red':'#FF6B6B','--bg':'#0A1022','--ink':'#EAF0FF','--ink2':'#B8C6E8','--mute':'#6E7FA3','--line':'#26324F','--card':'#111B36','--grid':'64px','--gline':'rgba(120,160,255,.06)','--seg':'rgba(120,160,255,.1)','--shadow':'0 0 0 1px rgba(120,160,255,.1),0 26px 50px -22px rgba(0,0,0,.85)','--shadow-lg':'0 0 0 1px rgba(120,160,255,.14),0 32px 60px -24px rgba(0,0,0,.9)','--accentbar':'linear-gradient(90deg,var(--blue),var(--green),var(--blue))','--blue2':'#8FB0FF','--oncolor':'#FFF' } },
    mono:      { label: '纸墨 Mono', vars: {
      '--blue':'#141414','--green':'#141414','--orange':'#141414','--red':'#D0342C','--bg':'#FBFAF7','--ink':'#141414','--ink2':'#3B3B3B','--mute':'#9B978F','--line':'#DAD5CB','--card':'#FFFFFF','--grid':'56px','--gline':'rgba(20,20,20,.04)','--seg':'rgba(20,20,20,.06)','--shadow':'0 1px 2px rgba(0,0,0,.04)','--shadow-lg':'0 2px 6px rgba(0,0,0,.06)','--accentbar':'none','--blue2':'#3B3B3B','--oncolor':'#FFF' } },
    neon:      { label: '暮光霓虹', vars: {
      '--blue':'#B388FF','--green':'#3AEBD6','--orange':'#FFB340','--red':'#FF4D8D','--bg':'#0B0716','--ink':'#F2EDFF','--ink2':'#B9A8E8','--mute':'#7A6BA8','--line':'#2C2250','--card':'#160E2E','--grid':'64px','--gline':'rgba(179,136,255,.06)','--seg':'rgba(179,136,255,.1)','--shadow':'0 0 0 1px rgba(179,136,255,.14),0 26px 50px -20px rgba(120,60,255,.35)','--shadow-lg':'0 0 0 1px rgba(179,136,255,.2),0 32px 60px -22px rgba(120,60,255,.45)','--accentbar':'linear-gradient(90deg,var(--blue),var(--red),var(--green),var(--blue))','--blue2':'#D0B4FF','--oncolor':'#FFF' } },
    cream:     { label: '暖阳奶油', vars: {
      '--blue':'#3E7CFF','--green':'#2FB57C','--orange':'#FF8A3D','--red':'#F0533F','--bg':'#FAF5EC','--ink':'#3A2E23','--ink2':'#6B5A47','--mute':'#A99B87','--line':'#E8DCC8','--card':'#FFFFFF','--grid':'64px','--gline':'rgba(120,90,40,.055)','--seg':'rgba(120,90,40,.08)','--shadow':'0 1px 2px rgba(120,90,40,.06),0 16px 36px -18px rgba(120,90,40,.25)','--shadow-lg':'0 2px 4px rgba(120,90,40,.08),0 26px 60px -28px rgba(120,90,40,.32)','--accentbar':'none','--blue2':'#6FA0FF','--oncolor':'#FFF' } },
    graphite:  { label: '石墨工业', vars: {
      '--blue':'#9AA7B5','--green':'#57C285','--orange':'#FFB454','--red':'#E86A5E','--bg':'#16181B','--ink':'#E8EAED','--ink2':'#B6BCC4','--mute':'#7A828C','--line':'#2E3238','--card':'#1F2328','--grid':'48px','--gline':'rgba(255,255,255,.04)','--seg':'rgba(255,255,255,.08)','--shadow':'0 0 0 1px rgba(255,255,255,.07)','--shadow-lg':'0 0 0 1px rgba(255,255,255,.1)','--accentbar':'none','--blue2':'#C2CCD8','--oncolor':'#FFF' } },
    aurora:    { label: '深海极光', vars: {
      '--blue':'#2DD4BF','--green':'#34D399','--orange':'#FBBF24','--red':'#FB7185','--bg':'#071A1D','--ink':'#E6FBF7','--ink2':'#A7D8D0','--mute':'#5F948E','--line':'#1B4044','--card':'#0C2629','--grid':'64px','--gline':'rgba(45,212,191,.06)','--seg':'rgba(45,212,191,.12)','--shadow':'0 0 0 1px rgba(45,212,191,.12),0 26px 50px -22px rgba(0,40,40,.8)','--shadow-lg':'0 0 0 1px rgba(45,212,191,.18),0 32px 60px -24px rgba(0,50,50,.9)','--accentbar':'linear-gradient(90deg,var(--blue),var(--green),var(--orange),var(--blue))','--blue2':'#7BEDE0','--oncolor':'#FFF' } }
  };
  var THEME_ORDER = ['keynote','dark','midnight','mono','neon','cream','graphite','aurora'];
  /* 暗色主题：safe-zone 压一层黑纱提示字幕区（亮色主题不压）。
     判定只看 --bg 亮度，主题表里写错 --dark 也不会漏。 */
  function themeIsDark(vars) {
    var c = String(vars['--bg'] || '#fff').replace('#', '');
    if (c.length !== 6) return false;
    var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 110;
  }
  function themeVars(theme) {
    var t = THEMES[theme] || THEMES.keynote;
    var extra = themeIsDark(t.vars) ? { '--scrim': 'linear-gradient(to top,rgba(0,0,0,.32),transparent)' } : { '--scrim': 'none' };
    return Object.assign({}, t.vars, extra);
  }
  function themeCSS(theme) {
    var v = themeVars(theme), s = ':root{';
    for (var k in v) s += k + ':' + v[k] + ';';
    return s + '}';
  }

  /* ------------------------------------------------------------------ 外壳 */
  var SHELL_CSS = [
':root{--ease-out:cubic-bezier(.16,1,.3,1);--ease-io:cubic-bezier(.65,0,.35,1)}',
'*{box-sizing:border-box}html,body{height:100%;margin:0}',
'body{background:#0E0E10;color:var(--ink);overflow:hidden;position:relative;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}',
'h1,h2,h3{margin:0;font-weight:700;letter-spacing:-.022em}',
'#stage{position:absolute;left:50%;top:50%;width:1600px;height:900px;overflow:hidden;border-radius:6px;background-color:var(--bg);background-image:linear-gradient(to right,var(--gline) 1px,transparent 1px),linear-gradient(to bottom,var(--gline) 1px,transparent 1px);background-size:var(--grid) var(--grid);box-shadow:0 40px 120px -40px rgba(0,0,0,.85);transform:translate(-50%,-50%) scale(var(--s,1));transform-origin:center center}',
'#stage::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:var(--accentbar);z-index:41;pointer-events:none}',
'.safe-zone{position:absolute;left:0;right:0;bottom:0;height:90px;pointer-events:none;background:var(--scrim)}',
'.segments{position:absolute;top:0;left:0;right:0;height:4px;display:flex;gap:4px;z-index:40}',
'.segments .seg{flex:1;background:var(--seg);overflow:hidden}',
'.segments .seg i{display:block;height:100%;width:100%;background:var(--blue);transform:scaleX(0);transform-origin:0 50%;transition:transform .5s var(--ease-out)}',
'.segments .seg.on i{transform:scaleX(1)}.segments .seg.cur i{background:linear-gradient(90deg,var(--blue),var(--blue2))}',
'.hud-page{position:absolute;top:38px;right:96px;z-index:40;font-size:14px;font-weight:600;letter-spacing:.08em;color:var(--mute);font-variant-numeric:tabular-nums}',
'.hud-hint{position:absolute;top:38px;left:96px;z-index:40;display:flex;gap:18px;align-items:center;font-size:14px;font-weight:600;letter-spacing:.06em;color:var(--mute);transition:opacity .6s var(--ease-out)}',
'.hud-hint.gone{opacity:0}.hud-hint kbd{font:inherit;background:var(--card);border:1px solid var(--line);border-bottom-width:2px;border-radius:7px;padding:3px 9px;color:var(--ink2)}',
'.page{position:absolute;inset:0;opacity:0;pointer-events:none;transform:scale(.988);transition:opacity .5s var(--ease-out),transform .75s var(--ease-out)}',
'.page.active{opacity:1;pointer-events:auto;transform:none}',
'.page:not(.active) *{animation-play-state:paused!important}',
'.anim{opacity:0;filter:blur(5px);transform:var(--from,translate3d(0,26px,0));transition:opacity .52s var(--ease-out),transform .74s var(--ease-out),filter .52s var(--ease-out);will-change:transform,opacity}',
'.anim.in{opacity:1;filter:blur(0);transform:var(--to,none)}',
'.anim[data-from=left]{--from:translate3d(-48px,0,0)}.anim[data-from=right]{--from:translate3d(48px,0,0)}',
'.anim[data-from=down]{--from:translate3d(0,-32px,0)}.anim[data-from=scale]{--from:scale(.88)}',
'.anim[data-from=rise]{--from:translate3d(0,54px,0) scale(.96)}.anim[data-from=up]{--from:translate3d(0,28px,0)}',
'.anim[data-from=none]{--from:none}',
'.idle{display:block}',
'.idle-fill{width:100%;height:100%}',
'.in .l-float{animation:lFloat 4.6s var(--ease-io) infinite;animation-delay:var(--d,0s)}',
'.in .l-float-s{animation:lFloatS 3.8s var(--ease-io) infinite;animation-delay:var(--d,0s)}',
'.in .l-pulse{animation:lPulse 2.6s var(--ease-io) infinite;animation-delay:var(--d,0s)}',
'.in .l-halo{animation:lHalo 3.2s var(--ease-out) infinite;animation-delay:var(--d,0s)}',
'.in .l-flow{animation:lFlow 2.1s linear infinite;animation-delay:calc(var(--i,0) * -.18s)}',
'.in .l-sheen{animation:lSheen 3.4s var(--ease-io) infinite;animation-delay:var(--d,0s)}',
'.in .l-scan{animation:lScan 3.6s var(--ease-io) infinite;animation-delay:var(--d,0s)}',
'svg .l-pulse,svg .l-float,svg .l-float-s{transform-box:view-box}',
'.stagger> *{opacity:0;transform:translate3d(0,16px,0);transition:opacity .5s var(--ease-out),transform .72s var(--ease-out);transition-delay:calc(var(--i,0) * 90ms)}',
'.anim.in .stagger> *{opacity:1;transform:none}',
'@keyframes lFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}',
'@keyframes lFloatS{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
'@keyframes lPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.09);opacity:.86}}',
'@keyframes lHalo{0%{transform:scale(.72);opacity:.5}100%{transform:scale(1.55);opacity:0}}',
'@keyframes lFlow{from{stroke-dashoffset:16}to{stroke-dashoffset:-104}}',
'@keyframes lSheen{0%{transform:translateX(-120%)}55%,100%{transform:translateX(220%)}}',
'@keyframes lScan{0%{transform:translateY(-64px);opacity:0}12%{opacity:.9}88%{opacity:.9}100%{transform:translateY(190px);opacity:0}}',
'.p-head{position:absolute;left:96px;top:84px;right:96px}',
'.kicker{font-size:14px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);margin-bottom:16px}',
'.p-title{font-size:58px;line-height:1.1;color:var(--ink)}',
'.p-sub{font-size:21px;font-weight:500;color:var(--ink2);margin-top:14px}',
'.card{background:var(--card);border-radius:28px;box-shadow:var(--shadow)}',
'.chip{display:inline-flex;align-items:center;gap:12px;background:var(--card);border-radius:999px;padding:14px 24px 14px 16px;box-shadow:var(--shadow);font-size:19px;font-weight:600;color:var(--ink)}',
'.chip .dot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--oncolor);flex:none}',
'.chip .dot svg{width:20px;height:20px}',
'.stroke{fill:none;stroke:currentColor;stroke-width:3.1;stroke-linecap:round;stroke-linejoin:round}',
'.cover-kicker{position:absolute;left:0;right:0;top:126px;text-align:center;font-size:15px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}',
'.cover-title{position:absolute;left:0;right:0;top:158px;text-align:center;font-size:152px;line-height:.96;letter-spacing:-.045em;color:var(--ink)}',
'.cover-title em{font-style:normal;background:linear-gradient(120deg,var(--blue),#41A6FF);-webkit-background-clip:text;background-clip:text;color:transparent}',
'.cover-sub{position:absolute;left:0;right:0;top:336px;text-align:center;font-size:26px;font-weight:500;color:var(--ink2)}',
'.cover-octo{position:absolute;left:600px;top:392px;width:400px;height:408px}',
'.cover-caption{position:absolute;left:0;right:0;bottom:118px;text-align:center;font-size:17px;font-weight:600;letter-spacing:.04em;color:var(--mute)}',
'.eq{position:absolute;left:0;right:0;top:344px;display:flex;align-items:center;justify-content:center;gap:56px}',
'.eq-cell{width:268px;display:flex;flex-direction:column;align-items:center;gap:20px}',
'.eq-mark{width:268px;height:268px;border-radius:52px;display:grid;place-items:center;background:var(--card);box-shadow:var(--shadow-lg);position:relative;overflow:hidden}',
'.eq-mark .sheen{position:absolute;top:0;bottom:0;width:120px;background:linear-gradient(100deg,transparent,rgba(0,122,255,.14),transparent)}',
'.eq-label{font-size:22px;font-weight:700;text-align:center}.eq-label small{display:block;font-size:14px;font-weight:600;color:var(--mute);margin-top:5px}',
'.eq-equal{display:flex;flex-direction:column;gap:22px}',
'.eq-equal span{display:block;width:104px;height:18px;border-radius:9px;background:#C7C7CC}',
'.eq-q{position:absolute;right:130px;top:286px;font-size:132px;font-weight:800;color:var(--orange);line-height:1;text-shadow:0 18px 40px rgba(255,149,0,.28)}',
'.neq{position:absolute;left:96px;top:330px;width:520px;height:360px}',
'.neq-bar{position:absolute;left:0;width:420px;height:34px;border-radius:17px;background:#C7C7CC}',
'.neq .b1{top:110px}.neq .b2{top:216px}',
'.neq-crack{position:absolute;left:0;top:110px;width:420px;height:34px;border-radius:17px;background:var(--red);box-shadow:0 16px 40px -14px rgba(255,59,48,.7);--from:translate3d(0,-70px,0) rotate(0deg);--to:rotate(-17deg)}',
'.neq-note{position:absolute;left:700px;top:376px;width:720px}',
'.neq-halo{position:absolute;left:40px;top:96px;width:340px;height:62px;border-radius:31px;border:2px solid rgba(255,59,48,.55);pointer-events:none}',
'.neq-quote{font-size:76px;line-height:1.12;letter-spacing:-.03em;color:var(--ink)}',
'.neq-quote b{color:var(--red);font-weight:700}',
'.name-chip{position:absolute;left:700px;top:646px}',
'.hub{position:absolute;left:96px;top:258px;width:660px;height:540px}',
'.hub-caption{position:absolute;left:96px;top:724px;width:660px;text-align:center;font-size:17px;font-weight:600;color:var(--mute)}',
'.badges{position:absolute;left:856px;top:300px;width:648px;display:flex;flex-direction:column;gap:34px}',
'.badge{display:flex;align-items:center;gap:22px;padding:26px 30px;border-radius:26px;background:var(--card);box-shadow:var(--shadow);position:relative;overflow:hidden}',
'.badge .bar{position:absolute;left:0;top:0;bottom:0;width:6px}',
'.badge .txt{font-size:28px;font-weight:700;letter-spacing:-.02em}',
'.badge .sub{font-size:15px;font-weight:600;color:var(--mute);margin-top:4px}',
'.badge .ic{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;flex:none}',
'.badge .ic svg{width:32px;height:32px}',
'.device{position:absolute;left:180px;top:266px;width:620px;height:520px;border-radius:44px;background:var(--card);box-shadow:var(--shadow-lg);border:1px solid rgba(0,122,255,.18)}',
'.device .scr{position:absolute;inset:18px;border-radius:30px;background:radial-gradient(120% 90% at 50% 0%,rgba(0,122,255,.07),transparent 70%),#FAFAFC;overflow:hidden}',
'.device .scan{position:absolute;left:24px;right:24px;height:64px;border-radius:32px;top:40px;background:linear-gradient(180deg,transparent,rgba(0,122,255,.16),transparent)}',
'.folder{position:absolute;left:150px;top:236px;width:320px;height:210px}',
'.folder .tab{position:absolute;left:0;top:0;width:132px;height:52px;border-radius:16px 16px 0 0;background:#D8E6FF}',
'.folder .body{position:absolute;left:0;top:34px;width:320px;height:176px;border-radius:0 22px 22px 22px;background:linear-gradient(160deg,#E8F1FF,#D3E4FF);border:1px solid rgba(0,122,255,.24)}',
'.folder .label{position:absolute;left:0;right:0;bottom:34px;text-align:center;font-size:27px;font-weight:700;color:var(--blue)}',
'.falls{position:absolute;left:180px;top:420px;width:620px;display:flex;gap:22px;justify-content:center}',
'.fall-chip{background:var(--card);border-radius:20px;padding:16px 22px;box-shadow:var(--shadow);font-size:19px;font-weight:700;display:flex;align-items:center;gap:12px;color:var(--ink)}',
'.fall-chip i{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-style:normal;color:var(--oncolor)}',
'.fall-chip svg{width:20px;height:20px}',
'.cut{position:absolute;left:840px;top:300px;width:664px;height:460px}',
'.cut-line{position:absolute;left:-40px;top:120px;width:480px;height:0;border-top:3px dashed #C7C7CC}',
'.cut-stop{position:absolute;left:300px;top:54px;width:132px;height:132px;border-radius:50%;background:var(--card);box-shadow:var(--shadow-lg);display:grid;place-items:center}',
'.cut-stop svg{width:74px;height:74px}',
'.cloud{position:absolute;left:470px;top:-20px;width:194px;height:150px}',
'.cut-badge{position:absolute;left:180px;top:212px;padding:18px 30px;border-radius:22px;background:var(--card);box-shadow:var(--shadow);display:flex;align-items:center;gap:16px;white-space:nowrap}',
'.cut-badge b{font-size:30px;font-weight:800;color:var(--red)}.cut-badge span{font-size:17px;font-weight:600;color:var(--mute)}',
'.flow{position:absolute;left:96px;top:322px;width:1408px;display:flex;align-items:flex-start;justify-content:space-between}',
'.fstep{position:relative;width:262px;flex:none}',
'.fnode{width:262px;height:198px;border-radius:30px;background:var(--card);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;border:1px solid var(--gline)}',
'.fnode .ic{width:60px;height:60px;border-radius:19px;display:grid;place-items:center;color:var(--oncolor)}',
'.fnode .ic svg{width:34px;height:34px}',
'.fnode .t{font-size:23px;font-weight:700;text-align:center}',
'.fconn{position:absolute;left:262px;top:80px;width:118px;height:38px}',
'.fconn svg{width:120px;height:38px;overflow:visible}.fstep.last .fconn{display:none}',
'.abilities{position:absolute;left:96px;top:596px;width:1408px;display:flex;gap:26px;justify-content:center}',
'.ability{display:flex;align-items:center;gap:14px;background:var(--card);border-radius:22px;padding:20px 28px;box-shadow:var(--shadow);font-size:22px;font-weight:700;color:var(--ink)}',
'.ability .ic{width:40px;height:40px;color:var(--blue)}.ability .ic svg{width:100%;height:100%}',
'.spoke{position:absolute;left:96px;top:274px;width:1408px;height:526px}',
'.spoke-lines{position:absolute;inset:0;width:1408px;height:526px;overflow:visible;z-index:1}',
'.hub-core{position:absolute;left:614px;top:170px;width:180px;height:180px;border-radius:52px;z-index:2;background:linear-gradient(150deg,#2C2C2E,#1C1C1E);box-shadow:0 30px 60px -26px rgba(0,0,0,.6);display:grid;place-items:center;color:var(--oncolor)}',
'.hub-core .wm{font-size:64px;font-weight:800}.hub-core .halo{position:absolute;inset:-14px;border-radius:64px;border:2px solid rgba(0,122,255,.35)}',
'.sat{position:absolute;width:320px;height:106px;border-radius:26px;background:var(--card);box-shadow:var(--shadow-lg);padding:26px 28px;display:flex;align-items:center;gap:20px;border:1px solid var(--gline)}',
'.sat .ic{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;color:var(--oncolor);flex:none}',
'.sat .ic svg{width:32px;height:32px}.sat .t{font-size:25px;font-weight:700}',
'.sat .s{font-size:14px;font-weight:600;color:var(--mute);margin-top:3px}',
'.sat.s1{left:24px;top:24px}.sat.s2{left:1064px;top:24px}.sat.s3{left:24px;top:346px}.sat.s4{left:1064px;top:346px}',
'.ways{position:absolute;left:96px;top:300px;width:1408px;display:flex;gap:32px}',
'.way{width:448px;height:420px;border-radius:34px;background:var(--card);box-shadow:var(--shadow-lg);padding:40px 36px;display:flex;flex-direction:column;border:1px solid var(--gline);overflow:hidden}',
'.way .viz{height:210px;display:grid;place-items:center;position:relative}',
'.way .t{font-size:27px;font-weight:700;margin-top:auto}.way .d{font-size:16px;font-weight:600;color:var(--mute);margin-top:8px}',
'.way .idx{position:absolute;right:30px;top:26px;font-size:15px;font-weight:700;color:var(--line);font-variant-numeric:tabular-nums}',
'.pts{position:absolute;left:96px;top:296px;width:1408px;display:grid;grid-template-columns:1fr 1fr;gap:26px}',
'.pts.n1,.pts.n2{top:330px}.pts.n3,.pts.n5{top:280px}',
'.pts.n3 .pt:last-child,.pts.n5 .pt:last-child{grid-column:1/-1}',
'.pt{display:flex;gap:20px;padding:28px 30px;border-radius:26px;background:var(--card);box-shadow:var(--shadow);align-items:flex-start}',
'.pt .n{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:var(--oncolor);font-weight:800;font-size:19px;flex:none}',
'.pt .t{font-size:25px;font-weight:700;letter-spacing:-.02em}',
'.pt .d{font-size:16px;font-weight:600;color:var(--mute);margin-top:6px;line-height:1.62}'
  ].join('\n');

  /* 运行时：字符串拼接写成，避免嵌套模板字面量 */
  var RUNTIME = [
"(function(){",
"  var stage=document.getElementById('stage');",
"  var pages=Array.prototype.slice.call(document.querySelectorAll('.page'));",
"  var segWrap=document.getElementById('segments');",
"  var pageNum=document.getElementById('pageNum');",
"  var hint=document.getElementById('hint');",
"  var N=pages.length, cur=0;",
"  function fit(){ stage.style.setProperty('--s', Math.min(window.innerWidth/1600, window.innerHeight/900)); }",
"  window.addEventListener('resize', fit);",
"  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);",
"  window.addEventListener('orientationchange', fit); fit();",
"  pages.forEach(function(){ var d=document.createElement('div'); d.className='seg'; d.innerHTML='<i></i>'; segWrap.appendChild(d); });",
"  var segs=Array.prototype.slice.call(segWrap.children);",
"  pages.forEach(function(p){ p.steps=Array.prototype.slice.call(p.querySelectorAll('.anim')); p.k=0; });",
"  function paint(){",
"    pages.forEach(function(p,i){ p.classList.toggle('active', i===cur);",
"      p.steps.forEach(function(el,j){ el.classList.toggle('in', j<p.k); }); });",
"    segs.forEach(function(s,i){ s.classList.toggle('on', i<=cur); s.classList.toggle('cur', i===cur); });",
"    pageNum.textContent = ('0'+(cur+1)).slice(-2)+' / '+('0'+N).slice(-2);",
"  }",
"  function goTo(i, full){ if(i<0||i>=N) return; cur=i; var p=pages[i];",
"    p.k = full ? p.steps.length : Math.min(1, p.steps.length); paint(); }",
"  function step(){ var p=pages[cur];",
"    if (p.k<p.steps.length){ p.k++; paint(); } else if (cur<N-1){ goTo(cur+1,false); } }",
"  function dismiss(){ if (hint && !hint.classList.contains('gone')) hint.classList.add('gone'); }",
"  window.addEventListener('keydown', function(e){",
"    if (e.metaKey||e.ctrlKey||e.altKey) return;",
"    switch(e.key){",
"      case ' ': case 'Spacebar': case 'Enter': e.preventDefault(); dismiss(); step(); break;",
"      case 'ArrowRight': case 'ArrowDown': case 'PageDown': e.preventDefault(); dismiss(); goTo(cur+1,true); break;",
"      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); dismiss(); goTo(cur-1,true); break;",
"      case 'Home': e.preventDefault(); goTo(0,true); break;",
"      case 'End': e.preventDefault(); goTo(N-1,true); break;",
"      case 'r': case 'R': pages[cur].k=1; paint(); break;",
"    } });",
"  stage.addEventListener('click', function(){ dismiss(); step(); });",
"  /* ------------------------------------------------ 本地校验（不经过模型）",
"     AI 每页自由设计版式，最容易犯四类错：元素跑出舞台、文字掉进底部字幕",
"     安全区、忘了入场动画、入场后没有循环注视动画。这里逐页量一遍，",
"     把结果 postMessage 给工作台。校验靠量，不靠模型自觉。 */",
"  function runCheck(){",
"    var sr=stage.getBoundingClientRect(), sc=sr.width/1600;",
"    if (sr.width<100) return null;                       // 还没排版，等下一轮",
"    var issues=[];",
"    pages.forEach(function(p,i){",
"      var wasActive=p.classList.contains(\"active\"), k=p.k;",
"      p.classList.add(\"active\");",
"      p.steps.forEach(function(el){ el.classList.add(\"in\"); });",
"      // 循环动画会让元素飘动或缩放（高光扫过是故意飞出容器被裁掉的），量版式前先停掉",
"      var idles=Array.prototype.slice.call(p.querySelectorAll(\".idle, .idle *,.l-float,.l-float-s,.l-pulse,.l-halo,.l-flow,.l-sheen,.l-scan\"));",
"      var savedAnim=idles.map(function(el){ var v=el.style.animation; el.style.animation=\"none\"; return v; });",
"      if(!p.steps.length) issues.push({page:i+1,kind:\"noanim\",detail:\"本页没有任何 .anim 元素，空格按下去不会有入场动画\"});",
"      if(!p.querySelector(\".idle,.l-float,.l-float-s,.l-pulse,.l-halo,.l-flow,.l-sheen,.l-scan\")) issues.push({page:i+1,kind:\"noidle\",detail:\"入场后没有循环注视动画（给某个元素加 class=idle l-float）\"});",
"      var kids=p.querySelectorAll(\"*\"), text=0;",
"      for(var j=0;j<kids.length;j++){",
"        var el=kids[j], rc=el.getBoundingClientRect();",
"        if(!rc.width && !rc.height) continue;",
"        var L=(rc.left-sr.left)/sc, T=(rc.top-sr.top)/sc, R=(rc.right-sr.left)/sc, B=(rc.bottom-sr.top)/sc;",
"        var cls=String(el.className||\"\").replace(/\\s+/g,\".\").slice(0,22)||el.tagName.toLowerCase();",
"        var spilled=(L<-2||T<-2||R>1602||B>902);",
"        if(spilled) issues.push({page:i+1,kind:\"overflow\",detail:cls+\" 跑出舞台 [\"+[L,T,R,B].map(Math.round).join(\",\")+\"]\"});",
"        var own=false, ns=el.childNodes;",
"        for(var q=0;q<ns.length;q++) if(ns[q].nodeType===3 && ns[q].textContent.trim()) own=true;",
"        if(own){ text++;",
"          if(B>810 && !spilled) issues.push({page:i+1,kind:\"safe\",detail:\"文字「\"+el.textContent.trim().slice(0,14)+\"」底边 \"+Math.round(B)+\"px，进了底部 90px 字幕安全区\"}); }",
"      }",
"      if(!text && !p.querySelector(\"svg,img,canvas\")) issues.push({page:i+1,kind:\"empty\",detail:\"本页既没有文字也没有图形\"});",
"      idles.forEach(function(el,idx){ el.style.animation=savedAnim[idx]; });",
"      p.steps.forEach(function(el,j){ el.classList.toggle(\"in\", j<k); });",
"      if(!wasActive) p.classList.remove(\"active\");",
"    });",
"    return issues;",
"  }",
"  function report(){",
"    var issues=runCheck(); if(!issues) return;",
"    var payload={knote:\"check\", pages:N, issues:issues, total:issues.length, deck:document.title};",
"    window.__knoteReport=payload;",
"    try{ if(window.parent && window.parent!==window) window.parent.postMessage(payload,\"*\"); }catch(e){}",
"  }",
"  window.__knoteCheck=runCheck;",
"  [80,300,800,1500].forEach(function(t){ setTimeout(report,t); });",
"  var rzT; window.addEventListener(\"resize\", function(){ clearTimeout(rzT); rzT=setTimeout(report,350); });",
"  goTo(0,false);",
"})();"
  ].join('\n');

  /* ------------------------------------------------------------------ 编译 */
  function build(sb) {
    sb = sb || {};
    var pages = (sb.pages || []).filter(function (p) { return T[p.type]; });
    if (!pages.length) pages = [{ type: 'points', title: sb.title || '未命名', items: '这一页还是空的|回去写点内容' }];
    var theme = sb.theme && THEMES[sb.theme] ? sb.theme : 'keynote';
    var extraCSS = [];
    var body = pages.map(function (p, i) {
      var cls = 'page' + (p.type === 'custom' ? ' page-custom s' + i : '');
      if (p.type === 'custom' && p.css) extraCSS.push(scopeCSS(p.css, '.s' + i));
      return '<section class="' + cls + '" data-type="' + esc(p.type) + '" data-i="' + i + '">' + (T[p.type](p) || '') + '</section>';
    }).join('\n\n');
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(sb.title || '演示动画') + '</title>\n<style>\n' + themeCSS(theme) + '\n' + SHELL_CSS + '\n' + extraCSS.join('\n') + '\n</style>\n</head>\n<body>\n\n' +
      '<div id="stage">\n' +
      '  <div class="segments" id="segments"></div>\n' +
      '  <div class="hud-page" id="pageNum">01 / ' + ('0' + pages.length).slice(-2) + '</div>\n' +
      '  <div class="hud-hint" id="hint"><span><kbd>空格</kbd> 逐步入场</span><span><kbd>←</kbd><kbd>→</kbd> 翻页</span></div>\n\n' +
      body + '\n\n  <div class="safe-zone"></div>\n</div>\n\n<script>\n' + RUNTIME + '\n<\/script>\n</body>\n</html>\n';
  }

  /* --------------------------------------------------- 本地草稿（规则版） */
  var STOP = ('的 了 是 在 和 与 也 就 都 而 及 或 等 这 那 你 我 他 它 们 一个 一种 什么 怎么 可以 这个 那个 因为 所以 但是 如果 已经 非常 不是 就是 还有 而且 然后 之后 以及 对于 关于 通过 我们 你们 他们 ' +
    // 分镜语法里的标记词，绝不能当成关键词
    'blue green orange red color true false null px div span items type title sub caption mark kicker ' +
    '任何 这样 那么 一些 很多 全部 所有 需要 使用 进行 情况 时候 是否 一样 反正 其实 而且 只是').split(' ');
  /* 本地关键词抽取：按句滑窗 n-gram + 频次门槛 + 子串去重（统计，不是理解） */
  function keywords(text, n) {
    n = n || 8;
    var sents = String(text || '')
      .split(/[。！？；;!?\n，,、：:（）()《》【】\s]+/)
      .map(function (s) { return s.replace(/[^\u4e00-\u9fa5A-Za-z0-9._-]/g, ''); })
      .filter(function (s) { return s.length >= 2; });
    var pool = {};
    function add(w) { if (w.length >= 2 && STOP.indexOf(w) < 0) pool[w] = (pool[w] || 0) + 1; }
    sents.forEach(function (s) {
      (s.match(/[A-Za-z][A-Za-z0-9._-]{1,19}/g) || []).forEach(add);
      var cjk = s.replace(/[^\u4e00-\u9fa5]/g, '');
      // 窗口要够长（10），否则「腾讯云官方仓库」这类短语会被自己的 6 字碎片挤掉
      for (var len = 2; len <= 10; len++) {
        for (var i = 0; i + len <= cjk.length; i++) add(cjk.substr(i, len));
      }
    });
    var all = Object.keys(pool).map(function (w) { return { w: w, c: pool[w], len: w.length }; });
    var strong = all.filter(function (o) { return o.c >= 2; });
    var weak = all.filter(function (o) { return o.c === 1 && o.len >= 3; });
    var picked = [];
    function take(list, cap, byLength) {
      list.sort(byLength
        ? function (a, b) { return b.len - a.len || b.c - a.c; }
        : function (a, b) { return (b.c * (b.len + 1)) - (a.c * (a.len + 1)); });
      for (var i = 0; i < list.length && picked.length < (cap || n); i++) {
        var w = list[i].w, ok = true;
        for (var j = 0; j < picked.length; j++) {
          if (picked[j].indexOf(w) >= 0 || w.indexOf(picked[j]) >= 0) { ok = false; break; }
        }
        if (ok) picked.push(w);
      }
    }
    take(strong, n);
    // 宁少不脏：只保留重复出现的词；不足 4 个时，才用「整句短语」补位
    if (picked.length < 4) take(weak, 4, true);
    // 再砍一刀：如果池子里存在更长且同样高频的词包含它，它就是碎片（开源版 → 源版）
    return picked.filter(function (w) {
      return !all.some(function (o) {
        return o.w !== w && o.len > w.length && o.w.indexOf(w) >= 0 && o.c >= pool[w];
      });
    });
  }
  function sentences(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .split(/\n+/).join('。')
      .split(/(?<=[。！？；!?;])/)
      .map(function (s) { return s.replace(/^[\s、，,。]+/, '').trim(); })
      .filter(function (s) { return s.length > 3; });
  }
  function inferType(s, i, total) {
    if (/[?？]$|难道|是不是|不就是/.test(s)) return 'equation';
    if (/本地|不上传|留在|隐私|目录|密钥|记忆/.test(s)) return 'local';
    if (/协议|开源|免费|官方仓库|收费|许可/.test(s)) return 'facts';
    if (/客户端|网页|生态|接入|支持|打通|接口/.test(s)) return 'hub';
    if (/先|再|然后|接着|最后|流程|自动|规划|交付/.test(s)) return 'flow';
    if (i === total - 1) return 'cards';
    return 'points';
  }
  function draft(text) {
    var ss = sentences(text);
    if (!ss.length) return { title: '未命名', pages: [{ type: 'points', title: '未命名' }] };
    var per = ss.length <= 8 ? 2 : 1;              // 每页塞 1–2 句
    var chunks = [];
    for (var i = 0; i < ss.length; i += per) {
      var g = ss.slice(i, i + per).join('');
      if (g.length > 76) g = g.slice(0, 76);
      chunks.push(g);
    }
    if (chunks.length > 12) chunks = chunks.slice(0, 12);
    var title = (chunks[0] || '').replace(/[。！？]$/, '').slice(0, 12);
    var pages = chunks.map(function (s, i) {
      var type = inferType(s, i, chunks.length);
      var page = { type: type, kicker: i === 0 ? '' : '第 ' + (i + 1) + ' 页', title: s.replace(/[。！？]$/, '').slice(0, 26) };
      if (type === 'equation') { page.items = (chunks[i - 1] || 'A').slice(0, 8) + '|' + '\n' + title + '|'; page.op = '≠'; page.mark = '？'; }
      else if (type === 'facts') { page.items = keywords(s, 3).map(function (k) { return k + '|'; }).join('\n'); page.caption = keywords(s, 1)[0] || ''; }
      else if (type === 'hub') { page.items = keywords(s, 4).map(function (k) { return k + '|'; }).join('\n'); page.mark = title.slice(0, 1); }
      else if (type === 'flow') { page.items = ['你下达任务|', '自己规划|', '自己干活|', '直接交付|'].join('\n'); page.caption = keywords(s, 3).join('、'); }
      else if (type === 'cards') { page.items = keywords(s, 3).map(function (k, j) { return k + '|第 ' + (j + 1) + ' 张卡'; }).join('\n'); }
      else { page.items = s.split(/[，,；;]/).filter(Boolean).slice(0, 4).map(function (x) { return x.slice(0, 22) + '|'; }).join('\n'); }
      return page;
    });
    return { title: title, pages: pages };
  }

  window.DeckEngine = {
    TYPES: TYPES, CONTENT_TYPES: CONTENT_TYPES, TYPE_LABEL: TYPE_LABEL, ICONS: ICONS, ICON_KEYS: ICON_KEYS,
    art: orbitArt, build: build, draft: draft, keywords: keywords, sentences: sentences,
    THEMES: THEMES, THEME_ORDER: THEME_ORDER, themeIsDark: themeIsDark,
    blank: function () { return { type: 'points', kicker: '', title: '新的一页', items: '要点一|说明\n要点二|说明' }; }
  };
})();
