/* ============================================================================
   AI —— OpenAI 兼容接口客户端（决策层）+ 连接诊断
   配置只存在本机 localStorage，请求直连你填的地址。
   两套独立配置：对话模型（KEY）与文生图模型（IMG_KEY），互不影响。
   导出：window.AI = { load, save, normBase, candidates, probe, ping, storyboard,
                       titlesAndTags, imgLoad, imgSave, image, imageProbe, toDataURL }
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'knote.ai.v2';
  var DEFAULT = {
    base: 'https://api.deepseek.com/v1',
    model: '',
    key: '',
    temp: 0.6,
    enabled: false
  };

  function load() {
    try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULT); }
  }
  function save(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* 地址清洗：补协议、去尾斜杠、切掉多写的 /chat/completions */
  function normBase(b) {
    var s = String(b || '').replace(/\s+/g, '');
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    s = s.replace(/\/+$/, '');
    s = s.replace(/\/(chat\/)?completions$/i, '');
    s = s.replace(/\/+$/, '');
    return s;
  }
  /* 候选地址：原样 + 补 /v1（有些厂商必须带版本段） */
  function candidates(b) {
    var base = normBase(b), list = [];
    if (!base) return list;
    list.push(base);
    if (!/\/v\d+$/i.test(base)) list.push(base + '/v1');
    return list.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function fetchT(url, opt, ms) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, ms);
    return fetch(url, Object.assign({ signal: ctl.signal }, opt)).then(function (r) {
      clearTimeout(timer); return r;
    }, function (e) {
      clearTimeout(timer);
      e.timedOut = (e.name === 'AbortError');
      throw e;
    });
  }

  /* ------------------------------------------------- 出网通道
     内嵌在 DSH 工作台面板里时（window.__KN_EMBED__.proxy 存在），所有出网请求
     改走同源的本机转发接口：浏览器不再受跨域限制，用户自己的接口即使不返回
     CORS 头也能用。独立打开时这个开关不存在，行为与以前完全一致。 */
  function proxyBase() {
    var e = (typeof window !== 'undefined') && window.__KN_EMBED__;
    return (e && e.proxy) ? String(e.proxy).replace(/\/+$/, '') : '';
  }
  /* 统一出网通道：直连或本机转发，返回形状与 Response 一致（ok/status/text/json） */
  function send(url, init, ms) {
    init = init || {};
    var p = proxyBase();
    if (!p) return fetchT(url, init, ms);
    return fetchT(p + '/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        method: init.method || 'GET',
        headers: init.headers || {},
        body: init.body == null ? null : String(init.body)
      })
    }, ms).then(function (r) {
      if (!r.ok) {
        /* 转发层自己拒的请求，把 error 字段里的原因原样带出来——只报状态码等于没报 */
        return r.text().then(function (t) {
          var why = '';
          try { var j = JSON.parse(t); why = (j && j.error) || ''; } catch (e) {}
          throw new Error('本机转发拒绝了请求（HTTP ' + r.status + '）' + (why ? '：' + why : '，重启 DSH Desktop 后重试'));
        });
      }
      return r.json();
    }).then(function (j) {
      if (!j || typeof j.status !== 'number') throw new Error('本机转发没有返回可用结果');
      var text = j.text == null ? '' : String(j.text);
      return {
        ok: j.status >= 200 && j.status < 300,
        status: j.status,
        text: function () { return Promise.resolve(text); },
        json: function () { return Promise.resolve(JSON.parse(text || 'null')); }
      };
    });
  }

  function sameHost(a, b) {
    try { return new URL(a).host === new URL(b).host; } catch (e) { return false; }
  }

  function authHeader(cfg) {
    var h = { 'Content-Type': 'application/json' };
    if (cfg.key) h['Authorization'] = 'Bearer ' + String(cfg.key).trim();
    return h;
  }

  /* ------------------------------------------------------------- 流式收字
     为什么必须流式：分镜一次要给 7–9 页现场写 HTML，非流式时上游在整篇写完之前
     不会发出任何一个字节，于是链路上任何一层（本地代理 / 面板转发 / 中转网关）
     的「静默超时」都会先开火——你要么看到 504、要么看到 502。
     改成流式后字节持续流动，只要模型还在吐字就不会超时；剩下的异常只有一种：
     长时间一个字都没有。于是超时的含义从「总时长」变成「静默时长」。 */

  var IDLE_MIN = 15000;
  var IDLE_MAX = 600000;

  /* 流式 fetch：idleMs 内没收到任何字节就中止（每收到一块由 touch() 重置） */
  function streamFetch(url, init, idleMs) {
    var ctl = new AbortController();
    var api = { idleMs: idleMs, aborted: false };
    var timer = null;
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(function () { api.aborted = true; ctl.abort(); }, idleMs);
    }
    api.touch = function () { if (!api.aborted) arm(); };
    api.stop = function () { clearTimeout(timer); };
    arm();
    return fetch(url, Object.assign({ signal: ctl.signal }, init)).then(function (res) {
      api.touch();                       // 头部到了也算有活动，重新起算静默
      return { res: res, api: api };
    }, function (e) {
      api.stop();
      e.timedOut = api.aborted || e.name === 'AbortError';
      throw e;
    });
  }

  /* 逐块解析 SSE，返回拼好的完整文本。
     兼容两种上游：真流式（data: {...} 分片），以及「嘴上答应 stream、实际一次性返回 JSON」。 */
  function readStream(res, api, opt) {
    opt = opt || {};
    var reader = res.body.getReader();
    var dec = new TextDecoder('utf-8');
    var buf = '', full = '', raw = '', thinking = 0;
    function report() {
      if (!opt.onDelta) return;
      try { opt.onDelta({ chars: full.length, reasoning: thinking, text: full }); } catch (e) {}
    }
    function feed(lines) {
      for (var i = 0; i < lines.length; i++) {
        var line = String(lines[i]).trim();
        if (!line || line.charAt(0) === ':') continue;              // 空行与 SSE 心跳
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        var j;
        try { j = JSON.parse(payload); } catch (e) { continue; }
        var choice = (j && j.choices && j.choices[0]) || {};
        var d = choice.delta || choice.message || {};
        if (d.reasoning_content) { thinking += String(d.reasoning_content).length; report(); continue; }
        if (typeof d.content === 'string' && d.content) { full += d.content; report(); }
      }
    }
    function push(text, end) {
      buf += text;
      var parts = buf.split('\n');
      var tail = parts.pop();
      feed(parts);
      if (end && tail) feed([tail]);
      buf = end ? '' : tail;
    }
    function fallback() {
      try {
        var j = JSON.parse(raw.trim().replace(/^data:\s*/, ''));
        var c = (j && j.choices && j.choices[0]) || {};
        var m = c.message || c.delta || {};
        return String(m.content || '');
      } catch (e) { return ''; }
    }
    function fail(e) {
      api.stop();
      if (full) {                        // 已经收到内容：不重试，避免重复生成一遍
        var p = new Error('流式连接中断（已收到 ' + full.length + ' 字；未自动重试，以免重复生成）');
        p.partial = true; p.retryable = false;
        return p;
      }
      if (api.aborted || e.name === 'AbortError') {
        var t = new Error('上游 ' + Math.round(api.idleMs / 1000) + ' 秒没有发出任何字节（已按流式等待）');
        t.timedOut = true; t.retryable = true; t.network = true;
        return t;
      }
      if (!e.status) { e.retryable = true; e.network = true; }
      return e;
    }
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          api.stop();
          push(dec.decode(), true);
          var text = full || fallback();
          if (!text) throw new Error('流式返回里没有内容' + (raw ? '（收到 ' + raw.length + ' 字节，但不是 SSE 分片）' : '（一个字节都没收到）'));
          return text;
        }
        api.touch();
        var text = dec.decode(r.value, { stream: true });
        raw += text;
        push(text);
        return pump();
      }).catch(function (e) { throw fail(e); });
    }
    return pump();
  }

  /* 流式 POST：走本机转发时把 stream:true 一并交给转发层，让它原样透传字节 */
  function postStream(cfg, base, messages, opt) {
    var url = base + '/chat/completions';
    var headers = authHeader(cfg);
    headers['Accept'] = 'text/event-stream';
    var body = JSON.stringify({
      model: cfg.model,
      messages: messages,
      temperature: opt.temp == null ? cfg.temp : opt.temp,
      stream: true
    });
    var idle = Math.min(Math.max(Number(opt.idle) || 120000, IDLE_MIN), IDLE_MAX);
    var p = proxyBase();
    var target = p ? p + '/forward' : url;
    var init = p ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, method: 'POST', headers: headers, body: body, stream: true, idleTimeout: idle })
    } : { method: 'POST', headers: headers, body: body };
    return streamFetch(target, init, idle).then(function (r) {
      if (!r.res.ok) {
        return r.res.text().then(function (t) {
          r.api.stop();
          var e = new Error('HTTP ' + r.res.status + ' ' + String(t).slice(0, 200));
          e.status = r.res.status;
          e.retryable = (r.res.status === 404 || r.res.status === 405);
          throw e;
        });
      }
      return readStream(r.res, r.api, opt);
    }).catch(function (e) {
      if (e.retryable === undefined) { e.retryable = true; e.network = true; }   // Failed to fetch / 静默超时：换个候选再试
      throw e;
    });
  }

  /* 一次性 POST；失败时附带可判定信息 */
  function post(cfg, base, messages, opt) {
    opt = opt || {};
    if (opt.stream) return postStream(cfg, base, messages, opt);
    return send(base + '/chat/completions', {
      method: 'POST',
      headers: authHeader(cfg),
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: opt.temp == null ? cfg.temp : opt.temp,
        stream: false
      })
    }, opt.timeout || 120000).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var e = new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
          e.status = r.status;
          e.retryable = (r.status === 404 || r.status === 405);
          throw e;
        });
      }
      return r.json();
    }).then(function (j) {
      var txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (txt == null) throw new Error('返回里没有 choices[0].message.content');
      return String(txt);
    }, function (e) {
      if (!e.status) { e.retryable = true; e.network = true; }   // Failed to fetch / 超时：换个候选再试
      throw e;
    });
  }

  function chat(cfg, messages, opt) {
    opt = opt || {};
    var list = candidates(cfg.base);
    if (!list.length) return Promise.reject(new Error('还没填接口地址'));
    var last = null;
    function attempt(i) {
      if (i >= list.length) throw last;
      return post(cfg, list[i], messages, opt).catch(function (e) {
        last = e;
        if (e.retryable && i + 1 < list.length) return attempt(i + 1);
        throw e;
      });
    }
    return Promise.resolve().then(function () { return attempt(0); });
  }

  /* 从模型输出里抠出 JSON（容忍 ``` 围栏和前后废话） */
  function json(text) {
    var s = String(text).replace(/^\uFEFF/, '');
    s = s.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
    var a = s.indexOf('['), o = s.indexOf('{');
    var start = (a >= 0 && (o < 0 || a < o)) ? a : o;
    if (start < 0) throw new Error('输出里找不到 JSON：' + s.slice(0, 120));
    var open = s[start], close = open === '[' ? ']' : '}';
    var depth = 0, end = -1, inStr = false, esc = false;
    for (var i = start; i < s.length; i++) {
      var c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (!depth) { end = i; break; } }
    }
    if (end < 0) throw new Error('JSON 括号没闭合');
    var body = s.slice(start, end + 1);
    try { return JSON.parse(body); }
    catch (e) { return JSON.parse(body.replace(/,\s*([\]}])/g, '$1').replace(/[\u201c\u201d]/g, '"')); }
  }

  /* ======================================================== 文生图（封面设计）
     封面设计完全交给文生图模型：标题就是提示词，用户可再补一句，点「生成封面」才出图，
     按三个比例各请求一次。接口按 OpenAI Image 兼容写：
       POST {base}/images/generations   body { model, prompt, n:1, size }
     配置与对话模型完全分开——出图常常是另一家服务、另一个 key。 */
  var IMG_KEY = 'knote.ai.image.v1';
  var IMG_SIZES = { '169': '1792x1024', '43': '1024x1024', '34': '1024x1792' };
  /* 每个比例给一句话版式约束：模型自由出图时文字容易铺满或压边，本地只居中裁到精确比例、不会重排文字，
     所以构图安全区必须写进提示词。按请求的 size 匹配，让三张各按自己的构图出，文字不撞裁切边缘。 */
  var IMG_SAFETY = {
    '1792x1024': '这是一张 16:9 横版封面。主体水平居中略偏低，标题等文字紧凑收在画面中线偏上的一块，四边各留约 15% 安全空白，任何文字不得贴近左右或上下边缘。',
    '1024x1024': '这是一张 1:1 方版封面。主体居中，文字收在中心区域，四周留足等宽安全边距，标题与副文案不贴边。',
    '1024x1792': '这是一张 3:4 竖版封面。主体落在画面中上部，文字收在偏上方的方框内，底部与左右留安全空白，避免文字被上下裁切。'
  };
  function imgSafetyNote(size) {
    return IMG_SAFETY[size] || '画面主体居中、文字收在中心安全区，四周留安全边距，不贴近任一边缘。';
  }
  var DEFAULT_IMG = {
    base: 'https://api.openai.com/v1',
    model: '',
    key: '',
    /* 尺寸按比例各存一个。接口支持任意尺寸就改成 1920x1080 / 1440x1080 / 1080x1440，
       不支持也不要紧——本地会把出图居中裁到精确比例（CoverRender.cover）。 */
    sizes: { '169': IMG_SIZES['169'], '43': IMG_SIZES['43'], '34': IMG_SIZES['34'] },
    suffix: '视频封面，高清，构图简洁大气，主体突出，色彩鲜明'
  };
  function imgLoad() {
    try {
      var o = JSON.parse(localStorage.getItem(IMG_KEY) || '{}') || {};
      var c = Object.assign({}, DEFAULT_IMG, o);
      c.sizes = Object.assign({}, IMG_SIZES, o.sizes || {});
      return c;
    } catch (e) { return Object.assign({}, DEFAULT_IMG, { sizes: Object.assign({}, IMG_SIZES) }); }
  }
  function imgSave(cfg) {
    try { localStorage.setItem(IMG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* 出图返回形状各家不一，统一成一个能直接给 <img> 的 src：
       { data:[{ b64_json | url }] }        OpenAI 与多数兼容网关
       { images:[ "data:…" | "https://…" ] }
       { output:[ … ] } / { artifacts:[ … ] } / { results:[ … ] }
     base64 的 MIME 靠头部字节猜：网关不声明格式、或声明错了，图会显示不出来。 */
  function sniffMime(b64) {
    var h = String(b64).slice(0, 16).replace(/^data:[^,]*,/, '');
    if (h.indexOf('iVBORw0KGgo') === 0) return 'image/png';
    if (h.indexOf('/9j/') === 0) return 'image/jpeg';
    if (h.indexOf('UklGR') === 0) return 'image/webp';
    if (h.indexOf('R0lGOD') === 0) return 'image/gif';
    return 'image/png';
  }
  function pickImage(x) {
    if (!x) return null;
    if (typeof x === 'string') return { src: x };
    if (typeof x !== 'object') return null;
    var b64 = x.b64_json || x.b64 || x.base64 || x.image_base64;
    if (b64) return { src: 'data:' + sniffMime(b64) + ';base64,' + String(b64).replace(/^data:[^,]*,/, '') };
    var url = x.url || x.image_url || x.image || x.output || x.src;
    if (typeof url === 'string' && url) return { src: url, url: /^https?:/i.test(url) ? url : '' };
    return null;
  }
  function normalizeImage(j) {
    var lists = [j && j.data, j && j.images, j && j.output, j && j.artifacts, j && j.results];
    for (var i = 0; i < lists.length; i++) {
      var arr = lists[i];
      if (!arr) continue;
      if (!Array.isArray(arr)) arr = [arr];
      for (var k = 0; k < arr.length; k++) {
        var got = pickImage(arr[k]);
        if (got) {
          var o = (typeof arr[k] === 'object' && arr[k]) || {};
          got.revised = o.revised_prompt || o.revisedPrompt || (j && j.revised_prompt) || '';
          return got;
        }
      }
    }
    return pickImage(j && (j.image || j.image_url || j.url));
  }

  /* 有些网关只给图片网址，而该网址可能不允许跨域取字节。canvas 被跨域图污染后
     toDataURL 会抛 SecurityError——所以拿到网址先转成 data:（同源 fetch 取字节）。
     转换失败也不是死路：图照样能看、能下载，只是没法在本地裁比例。 */
  function toDataURL(src) {
    src = String(src || '');
    if (/^data:/i.test(src)) return Promise.resolve(src);
    if (!/^https?:/i.test(src)) return Promise.reject(new Error('不认识的图片地址：' + src.slice(0, 80)));
    return fetchT(src, { mode: 'cors' }, 60000).then(function (r) {
      if (!r.ok) throw new Error('取图失败 HTTP ' + r.status);
      return r.blob();
    }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result)); };
        fr.onerror = function () { rej(new Error('图片转本地失败')); };
        fr.readAsDataURL(b);
      });
    });
  }

  /* 出图一次。opt: { size, timeout, noFormat }
     response_format：dall-e-2/3 接受 'b64_json'，gpt-image-1 明确拒绝这个参数（400）。
     所以默认带上，上游一抱怨就自动去掉重发一次——用户不必管这些差异。 */
  function image(cfg, prompt, opt) {
    opt = opt || {};
    var list = candidates(cfg.base);
    if (!list.length) return Promise.reject(new Error('还没填图像接口地址（点「设置图像模型」）'));
    if (!String(cfg.model || '').trim()) return Promise.reject(new Error('还没填图像模型名（点「设置图像模型」）'));
    if (!String(prompt || '').trim()) return Promise.reject(new Error('提示词是空的：先选个标题，或自己写一句画面描述'));
    var last = null;
    function attempt(i, withFormat) {
      if (i >= list.length) throw last;
      var body = { model: cfg.model, prompt: String(prompt), n: 1 };
      if (opt.size) {
        body.size = opt.size;
        /* 按目标比例注入构图安全区，让文字不压到裁切边（本地不重排文字） */
        body.prompt = body.prompt + '\n\n【版式要求（必须遵守）】' + imgSafetyNote(opt.size);
      }
      if (withFormat) body.response_format = 'b64_json';
      return send(list[i] + '/images/generations', {
        method: 'POST', headers: authHeader(cfg), body: JSON.stringify(body)
      }, opt.timeout || 180000).then(function (r) {
        if (r.status === 404 || r.status === 405) {
          var e404 = new Error('HTTP ' + r.status + '（这个地址没有 /images/generations）');
          e404.retryable = true; throw e404;
        }
        return r.text().then(function (t) {
          if (r.status < 200 || r.status >= 300) {
            var msg = '';
            try { var j = JSON.parse(t); msg = (j && j.error && (j.error.message || j.error)) || (j && j.message) || ''; } catch (e2) {}
            msg = String(msg || t || '').replace(/\s+/g, ' ').slice(0, 300);
            var e = new Error('HTTP ' + r.status + (msg ? '：' + msg : ''));
            e.status = r.status;
            if (withFormat && r.status === 400 && /response_format|unknown|unsupported|not support|invalid/i.test(msg)) e.retryFormat = true;
            throw e;
          }
          var j2;
          try { j2 = JSON.parse(t); } catch (e3) { throw new Error('出图接口返回的不是 JSON：' + String(t).replace(/\s+/g, ' ').slice(0, 200)); }
          var got = normalizeImage(j2);
          if (!got) throw new Error('返回里找不到图片（期望 data[0].b64_json 或 data[0].url）：' + String(t).replace(/\s+/g, ' ').slice(0, 200));
          got.model = cfg.model; got.size = opt.size || '';
          return got;
        });
      }).catch(function (e) {
        last = e;
        if (e.retryFormat) return attempt(i, false);
        if (e.retryable && i + 1 < list.length) return attempt(i + 1, withFormat);
        throw e;
      });
    }
    return Promise.resolve().then(function () { return attempt(0, !opt.noFormat); });
  }

  /* 图像接口自检：只读 GET /models，不打图（出图要花钱、要等）。
     重点是看模型名在不在列表里——模型名写错是出图最常见的失败。 */
  function imageProbe(cfg) {
    var list = candidates(cfg.base);
    if (!list.length) return Promise.reject(new Error('还没填图像接口地址'));
    var started = Date.now();
    return send(list[0] + '/models', { method: 'GET', headers: authHeader(cfg) }, 15000)
      .then(function (r) {
        var ms = Date.now() - started;
        if (r.status !== 200) return { ok: false, ms: ms, status: r.status, msg: 'HTTP ' + r.status + '：地址通，但这个地址不提供 /models 列表（不影响出图，直接点「生成封面」试）' };
        return r.json().then(function (j) {
          var ids = ((j && j.data) || []).map(function (m) { return m && (m.id || m.name); }).filter(Boolean);
          var want = String(cfg.model || '').trim();
          if (!want) return { ok: true, ms: ms, status: 200, models: ids, msg: '地址通、密钥有效；还没填模型名，可选：' + (ids.slice(0, 12).join(', ') || '（列表为空）') };
          var has = ids.indexOf(want) >= 0;
          return { ok: true, ms: ms, status: 200, models: ids, hasModel: has,
            msg: has ? '地址通、密钥有效，' + want + ' 在列表里' : '地址通、密钥有效，但列表里没有 ' + want + (ids.length ? '；有：' + ids.slice(0, 12).join(', ') : '（列表为空）') };
        });
      }, function (e) { return { ok: false, ms: Date.now() - started, status: 0, msg: '连不上：' + e.message }; });
  }

  /* --------------------------------------------------------------- 诊断 */
  /* 判定逻辑：
     - 任何 HTTP 状态码（含 401）都说明「地址可达 + 浏览器被允许跨域」，因为能读到响应体
     - fetch 抛错时，用 no-cors 再打一次：能通＝被 CORS 挡；也抛＝域名/网络不通 */
  /* 先打轻量的 GET /models。注意：
     - 只有在服务器**明确回答** 404/405/501（说明服务可达、跨域也放行，只是没这个路径）时，
       才退到真实的 chat 端点。网络层失败时绝不重试，否则连不上的主机要白等两轮。 */
  function probeEndpoint(base, cfg) {
    return send(base + '/models', { method: 'GET', headers: authHeader(cfg) }, 10000)
      .then(function (r) {
        if (r.status !== 404 && r.status !== 405 && r.status !== 501) return r;
        return send(base + '/chat/completions', {
          method: 'POST', headers: authHeader(cfg),
          body: JSON.stringify({ model: cfg.model || 'probe', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, stream: false })
        }, 10000);
      });
  }

  function probeOne(base, cfg) {
    var started = Date.now();
    return probeEndpoint(base, cfg)
      .then(function (r) {
        var out = { base: base, ms: Date.now() - started, ok: true, status: r.status };
        if (r.status === 200) {
          // 顺手把服务商可用的模型名捞出来，省得猜（写错模型名是第二大失败原因）
          return r.json().then(function (j) {
            out.verdict = 'ok'; out.msg = '地址通，密钥有效';
            out.models = (j && Array.isArray(j.data) ? j.data : [])
              .map(function (m) { return m && (m.id || m.name); }).filter(Boolean).slice(0, 40);
            return out;
          }, function () { out.verdict = 'ok'; out.msg = '地址通，密钥有效'; return out; });
        }
        else if (r.status === 401 || r.status === 403) { out.verdict = 'auth'; out.msg = '地址通、能跨域，但密钥或权限不对（HTTP ' + r.status + '）'; }
        else { out.verdict = 'http'; out.msg = '地址通，但返回 HTTP ' + r.status; }
        return out;
      }, function (e) {
        var out = { base: base, ms: Date.now() - started, ok: false,
                    err: e.timedOut ? '请求超时（10 秒无响应）' : 'Failed to fetch' };
        return (proxyBase() ? Promise.reject(new Error('skip')) : fetchT(base + '/models', { mode: 'no-cors' }, 5000)).then(function () {
          out.verdict = 'cors';
          out.msg = '请求能到达服务器，但响应被浏览器拦下：这家接口不允许浏览器直连（响应里没有 Access-Control-Allow-Origin）';
          return out;
        }, function (e2) {
          out.verdict = e2.timedOut ? 'timeout' : 'unreachable';
          out.msg = e2.timedOut
            ? '连不上：10 秒没有任何响应（域名对吗？要不要挂代理？）'
            : '连不上：域名解析失败、端口没人监听，或者网络不通（检查地址拼写 / 是否需要代理）';
          return out;
        });
      });
  }

  /* 依次探测候选地址，返回结论 + 可用地址 */
  function probe(cfg) {
    var list = candidates(cfg.base);
    if (!list.length) return Promise.resolve({ ok: false, best: null, results: [], msg: '还没填接口地址' });
    var results = [];
    function step(i) {
      if (i >= list.length) {
        var best = results.filter(function (r) { return r.ok && r.verdict !== 'http'; })[0] || results.filter(function (r) { return r.ok; })[0];
        return { ok: !!(best && best.verdict !== 'http'), best: best || null, results: results,
                 msg: best ? best.msg : (results[0] ? results[0].msg : '探测失败') };
      }
      return probeOne(list[i], cfg).then(function (r) {
        results.push(r);
        // 「通」或「通但密钥不对」都说明地址可达、跨域被允许，是定论，不必再试下一个候选
        if (r.ok && r.verdict !== 'http') return { ok: true, best: r, results: results, msg: r.msg };
        // 异常状态码（404/405）或连不上，都再试下一个候选（比如补上 /v1 的那个）
        if (i + 1 < list.length) {
          // 候选只差一个路径段、域名相同：第一个连不上，第二个也不用再等 12 秒
          if (!r.ok && sameHost(list[i], list[i + 1])) {
            results.push({ base: list[i + 1], ok: false, ms: 0, inferred: true, verdict: r.verdict,
                           msg: r.msg + '（同一域名，不再重复等待）' });
            return step(i + 2);
          }
          return step(i + 1);
        }
        var best = results[results.length - 1];
        return { ok: !!(best && best.ok && best.verdict !== 'http'), best: best || null, results: results,
                 msg: best ? best.msg : '探测失败' };
      });
    }
    return step(0);
  }

  function ping(cfg) {
    return probe(cfg).then(function (r) {
      if (!r.ok) throw new Error(r.msg);
      return r.best.msg + '（' + r.best.base + '，' + r.best.ms + 'ms）';
    });
  }

  /* --------------------------------------------------------------- 提示词
     决策层：模型每次**自己设计版式与图示**，不再从固定模板里挑。
     固定的是「风格规范」（色板/网格/字号/缓动/舞台/动画/安全区），下面这份
     规范原文进提示词，模型必须遵守；执行层再逐页量一遍兜底。 */
    /* 风格规范随主题注入：模型只准用 CSS 变量，换主题时不用重新分镜 */
  var THEME_META = {
    keynote:  { dark: false, card: '#fff', bg: '#F2F2F7（浅灰）' },
    dark:     { dark: true,  card: '深卡 var(--card)，靠 var(--shadow) 的发光描边立起来（暗底上投影看不见，别再要白色大卡片）', bg: '#0E0E11（近黑）' },
    midnight: { dark: true,  card: '深蓝卡 var(--card) + 发光描边，氛围冷静，图示线条用 var(--blue) 发光', bg: '#0A1022（深蓝夜空）' },
    mono:     { dark: false, card: '#fff + 发丝线 var(--line)（阴影极轻）；这套语义色几乎全黑，唯一彩色是 var(--red) 朱红，别处别加色', bg: '#FBFAF7（米白纸）' },
    neon:     { dark: true,  card: '紫夜卡 var(--card) + 霓虹描边，图示可双线发光（外圈 var(--blue) 内圈 var(--green)）', bg: '#0B0716（紫夜）' },
    cream:    { dark: false, card: '#fff + 暖棕阴影 var(--shadow)，圆角可以更大更软', bg: '#FAF5EC（奶油）' },
    graphite: { dark: true,  card: '灰卡 var(--card) + 发丝描边，直角感（别做气泡感圆角），网格更密（48px）', bg: '#16181B（中性灰）' },
    aurora:   { dark: true,  card: '墨绿卡 var(--card) + 青碧描边，图示以 var(--blue) 青碧为主、var(--orange) 暖黄只点一两处', bg: '#071A1D（墨绿深海）' }
  };
  function styleSpec(theme) {
    var m = THEME_META[theme] || THEME_META.keynote;
    var cardLine = m.dark
      ? '  底色是 ' + m.bg + ' 加细网格，卡片用 ' + m.card + '；暗底上投影没有意义，层次全靠 var(--shadow) 的发光描边。'
      : '  底色是 ' + m.bg + ' 加 64px 网格，你自己不要再铺底色；卡片用 ' + m.card + ' + var(--shadow) 或 var(--shadow-lg)。';
    return [
      '【固定风格·必须遵守，不用你决定】',
      '· 舞台固定 1600×900，坐标就是绝对定位的 px。所有页面内容都活在 .page 里，.page 是你的作用域根。',
      '· 颜色只用这些 CSS 变量：var(--blue)（主强调）/ var(--green)（肯定）/ var(--orange)（注意）/ var(--red)（风险或强调）/',
      '  文字 var(--ink)、次要 var(--ink2)、弱化 var(--mute)、分割 var(--line)。',
      cardLine,
      '· 绝对禁止硬编码颜色字面量（#fff、#000、#333、rgba(...) 一律不许出现在你的 html/css 里）——',
      '  用户换主题时你的页面要零成本换装，只有变量能做到。色块上的文字用 var(--oncolor)。',
      '· 字体继承外壳（系统字体），不要引入外部字体、不要用 <link>/<script>/网络图片。可以用内联 <svg> 画图示。',
      '· 字号阶梯：大标题 72–96px / 页标题 44–56px / 卡片标题 22–28px / 正文 17–22px / 小标签 13–16px。字重 700–800 用于标题。',
      '· 缓动统一用 var(--ease-out)；不要写 linear 之外的奇怪曲线，不要用 JS 动画，不要用 @keyframes 做入场。',
      '',
      '【入场动画·每页必须有】',
      '· 给每个要入场的元素加 class="anim"，并指定方向：data-from="up|down|left|right|scale|rise|none"。',
      '· 初始态由外壳处理（opacity 0 + blur），你只要给位置。入场顺序 = 元素在 HTML 里的先后顺序，按一次空格放一个。',
      '· 一页放 3–6 个 .anim 最舒服；太多会拖节奏。',
      '',
      '【循环注视动画·每页必须有】',
      '· 入场结束后画面不能是死的，至少给一个元素加 class="idle" 加一种循环：l-float（缓慢上下）、l-float-s（更轻）、',
      '  l-pulse（呼吸缩放）、l-halo（光晕扩散）、l-sheen（高光扫过）、l-flow（虚线流动，配 svg 描边）。',
      '· 例：<div class="anim idle l-float" data-from="scale">…</div>',
      '',
      '【禁止】',
      '· 底部 90px（y 810–900）是字幕安全区：那里不能有任何文字。版式高度控制在 810 以内。',
      '· 元素不能超出 1600×900。不要写 <style> 标签、不要写 <script>、不要写 body/html 选择器。',
      '· 不要用 position:fixed，不要用 margin 撑版式——用绝对定位摆放。'
    ].join('\n');
  }

  var SYS_STORY = '你是短视频演示动画的版式设计师。你不套模板：每一页的版式、图示、节奏都由你现场设计，' +
    '但视觉风格规范是固定的，必须严格遵守。你只输出 JSON，不输出任何解释文字。';

  function storyPrompt(text, want, theme) {
    return [
      '把下面的口播文案拆成 ' + (want || '7–9') + ' 页演示动画。',
      '',
      styleSpec(theme),
      '',
      '【你要输出什么】',
      '一个 JSON 数组，每个元素是一页，字段：',
      '  type   固定写 "custom"',
      '  kicker 可选，顶部小标签（4–10 字）',
      '  note   可选，一句话说明这页的视觉想法（给人看，不渲染）',
      '  html   这一页的结构与图示（HTML 片段，可以内联 SVG）。不要包 <section>/<style>，直接写里面的元素。',
      '  css    这一页的 CSS。只写本页元素的样式；选择器直接用类名（如 .hero{...}），外壳会自动把它限定在本页，不会串到别页。',
      '',
      '【版式要求——这是重点】',
      '1. 每页都为一个观点服务。先想「这个观点最合适的视觉是什么」（对比、天平、流程轨道、环形、时间轴、进度、',
      '   数字计数、引语、地图、棋盘、赛道、代码块……），再动手写 HTML，不要每页都用同一种结构。',
      '2. 页与页之间版式要变化：不要连续三页都是「标题 + 三张卡」。',
      '3. 图示尽量用内联 SVG 自己画（坐标 0–1600 × 0–900 内），配合 .idle l-flow / l-halo 让它活着。',
      '4. 文案里语气最强的判断句单独给一页，用大字 + 强对比表达。',
      '5. 标题写人话，不要「第一点」「接下来」这种话。',
      '6. 页数 7–9 页，整个输出是一个 JSON 数组。',
      '',
      '文案：',
      text
    ].join('\n');
  }

  function normPage(p) {
    var t = String(p.type || 'points').toLowerCase().trim();
    var ok = ['cover', 'custom', 'points', 'equation', 'neq', 'facts', 'local', 'flow', 'hub', 'cards'];
    if (ok.indexOf(t) < 0) t = 'points';
    var out = { type: t };
    ['kicker', 'title', 'sub', 'caption', 'items', 'mark', 'op', 'folder', 'badge', 'html', 'css', 'note'].forEach(function (k) {
      var v = p[k];
      if (v == null) return;
      if (typeof v === 'object') {
        if (Array.isArray(v)) v = v.map(function (x) {
          if (x && typeof x === 'object') return [x.t || x.title || x.label || '', x.d || x.desc || x.sub || '', x.c || x.color || ''].join('|').replace(/\|+$/, '');
          return String(x);
        }).join('\n');
        else v = '';
      }
      if (String(v).trim()) out[k] = String(v).trim();
    });
    if (t === 'cover' && !out.title) out.title = '未命名';
    return out;
  }

  function storyboard(cfg, text, want, onDelta, opt) {
    opt = opt || {};
    return chat(cfg, [
      { role: 'system', content: SYS_STORY },
      { role: 'user', content: storyPrompt(text, want, opt.theme) }
    ], { temp: cfg.temp, stream: true, idle: 120000, onDelta: onDelta })   // 流式：只要还在吐字就不会超时
      .then(function (raw) {
      var arr = json(raw);
      if (!Array.isArray(arr) && arr && Array.isArray(arr.pages)) arr = arr.pages;
      if (!Array.isArray(arr)) throw new Error('模型没有返回数组');
      return arr.map(normPage)
        .filter(function (p) { return p && (p.html || p.title || p.items); })
        .filter(function (p) { return p.type !== 'cover'; });        // 封面归「封面」页签管，不进分镜
    });
  }

  /* 标题 + 标签一次问出来（标签是判断题，本地统计做不好，交给模型） */
  function titlesAndTags(cfg, text, n) {
    return chat(cfg, [
      { role: 'system', content: '你是短视频标题与标签编辑。你只输出 JSON，不输出解释。' },
      { role: 'user', content: '根据下面的文案做两件事：\n' +
        '1) 写 ' + (n || 8) + ' 个中文视频标题：每个不超过 26 字，有信息量或有悬念，不要标题党到失真，不要 emoji，不要编号。\n' +
        '2) 写 8 到 12 个视频标签：每个 2–6 个字的词或短语，按重要性从高到低排序，不要 # 号，不要标点。\n' +
        '输出形如 {"titles":["标题一","标题二"],"tags":["标签一","标签二"]}。\n\n文案：\n' + text }
    ], { temp: 0.9 }).then(function (raw) {
      var o = json(raw);
      var ts = Array.isArray(o) ? o : (o.titles || o.Titles || []);
      var gs = Array.isArray(o) ? [] : (o.tags || o.Tags || o.tag || []);
      var clean = function (s) { return String(s).replace(/^\s*\d+[.、)]\s*/, '').replace(/^#/, '').trim(); };
      return {
        titles: (Array.isArray(ts) ? ts : []).map(function (x) { return clean(typeof x === 'string' ? x : (x.title || x.t || '')); }).filter(Boolean).slice(0, n || 8),
        tags: (Array.isArray(gs) ? gs : []).map(function (x) { return clean(typeof x === 'string' ? x : (x.tag || x.name || '')); }).filter(Boolean).slice(0, 12)
      };
    });
  }

  /* 引擎版本，给页面自证用。浏览器对本地脚本的缓存很顽固：改了引擎不强刷，
     就可能页面是新的、ai.js 是旧的——混用的症状（按钮有进度字但数字一动不动、
     请求其实还是非流式的）非常像"上游挂了"，白查半天。 */
  window.KN_AI_VERSION = '1.0.12';

  window.AI = {
    load: load, save: save, normBase: normBase, candidates: candidates, proxyBase: proxyBase,
    probe: probe, ping: ping, chat: chat, storyboard: storyboard, titlesAndTags: titlesAndTags,
    json: json, DEFAULT: DEFAULT, styleSpec: styleSpec, THEME_META: THEME_META,
    /* 文生图是另一套配置、另一个地址，和对话模型互不影响 */
    imgLoad: imgLoad, imgSave: imgSave, image: image, imageProbe: imageProbe, toDataURL: toDataURL,
    DEFAULT_IMG: DEFAULT_IMG
  };
})();
