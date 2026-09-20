/* ===========================================================
   2026 国庆 · 青甘大环线 行程地图
   数据来源：OSM/Nominatim（点位）、OSRM（真实路网里程与轨迹）
   底图：高德（GCJ-02）/ OSM（WGS-84）——坐标系不同，切底图时自动重新投影
   标签：自绘标签层 + 碰撞避让（8 方向候选 + 引线），避免文字互相压住
   =========================================================== */
(function () {
  'use strict';

  /* ---------------- WGS-84 -> GCJ-02 ---------------- */
  var PI = Math.PI, AA = 6378245.0, EE = 0.00669342162296594323;

  function outOfChina(lng, lat) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }
  function tLat(x, y) {
    var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  function wgs2gcj(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    var dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
    var radLat = lat / 180 * PI, magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    var sq = Math.sqrt(magic);
    dLat = (dLat * 180) / ((AA * (1 - EE)) / (magic * sq) * PI);
    dLng = (dLng * 180) / (AA / sq * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  var MODE = 'gcj';
  function T(lat, lng) {
    if (MODE === 'wgs') return [lat, lng];
    var p = wgs2gcj(lng, lat);
    return [p[1], p[0]];
  }
  function TPath(path) {
    return path.map(function (p) { return T(p[1], p[0]); });
  }

  /* ---------------- 配置 ---------------- */
  var CAT = {
    visit:    { c: '#16a34a', label: '我们会去（重点游玩）' },
    hotel:    { c: '#7c3aed', label: '已订酒店（当晚落脚点）' },
    pass:     { c: '#2563eb', label: '我们会经过 / 其他停留' },
    optional: { c: '#f59e0b', label: '顺路可加（不用绕路）' },
    ref:      { c: '#9ca3af', label: '参考地图上的点（不去）' }
  };
  var CATS = Object.keys(CAT);
  var LABEL_COLOR = {
    visit: '#0f172a', hotel: '#5b21b6', pass: '#1e40af',
    optional: '#b45309', ref: '#6b7280'
  };
  var LEAD_COLOR = {
    visit: '#16a34a', hotel: '#7c3aed', pass: '#2563eb',
    optional: '#f59e0b', ref: '#9ca3af'
  };
  var DAY_COLORS = {
    '9/26': '#2563eb', '9/27': '#0891b2', '9/28': '#059669', '9/29': '#65a30d',
    '9/30': '#0d9488', '10/1': '#ea580c', '10/2': '#dc2626', '10/3': '#db2777',
    '10/4': '#7c3aed', '10/5': '#4f46e5', '10/6': '#64748b', '10/7': '#94a3b8'
  };
  var state = { cats: {}, route: true, names: false, refNames: false, activeDay: null };
  CATS.forEach(function (k) { state.cats[k] = true; });

  /* ---------------- 地图 ---------------- */
  var map = L.map('map', { zoomControl: true, scrollWheelZoom: true }).setView([37.4, 97.0], 6);

  var tileOpt = { maxZoom: 17, minZoom: 4 };
  var amapVec = L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    Object.assign({ subdomains: '1234', attribution: '&copy; 高德地图 · 数据 OSM' }, tileOpt));
  var amapImg = L.layerGroup([
    L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      Object.assign({ subdomains: '1234', attribution: '&copy; 高德地图 · 数据 OSM' }, tileOpt)),
    L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
      Object.assign({ subdomains: '1234' }, tileOpt))
  ]);
  var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    Object.assign({ attribution: '&copy; OpenStreetMap contributors' }, tileOpt));

  amapVec.addTo(map);
  var BASES = { '高德·路网': amapVec, '高德·卫星': amapImg, 'OSM·路网': osmLayer };
  var PROJ_OF = { '高德·路网': 'gcj', '高德·卫星': 'gcj', 'OSM·路网': 'wgs' };

  var groups = { route: L.layerGroup().addTo(map) };
  CATS.forEach(function (k) { groups[k] = L.layerGroup().addTo(map); });

  /* ---------------- 标签层（避让 + 引线） ---------------- */
  var labelPane = map.createPane('labelPane');
  labelPane.style.zIndex = 640;          // 在 markerPane(600) 之上、tooltipPane(650) 之下
  labelPane.style.pointerEvents = 'none';

  var LABEL_H = 15, LEAD_START = 7, TIGHT = 2;
  var RADII = [16, 30, 48, 70, 96, 126];   // 文字离点的距离：先近后远，挤不下就一圈圈往外推
  var ANGLES = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
  var DIR_ANGLE = { right: 0, br: 45, bottom: 90, bl: 135, left: 180, tl: -135, top: -90, tr: -45 };
  var widthCache = {};
  var labelPool = {};        // key -> {el, lead, tip, txt}；复用 DOM，逐帧只改样式

  function textWidth(text, bold) {
    var key = (bold ? 'b|' : 'n|') + text;
    if (widthCache[key] != null) return widthCache[key];
    var el = document.createElement('span');
    el.className = 'plabel-txt' + (bold ? ' bold' : '');
    el.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0';
    el.textContent = text;
    labelPane.appendChild(el);
    var w = el.offsetWidth || (text.length * 11 + 4);
    labelPane.removeChild(el);
    widthCache[key] = w;
    return w;
  }

  function poolGet(key) {
    var p = labelPool[key];
    if (p) return p;
    var el = document.createElement('div');
    el.className = 'plabel';
    var lead = document.createElement('i');
    var tip = document.createElement('b');
    var txt = document.createElement('span');
    txt.className = 'plabel-txt';
    el.appendChild(lead);
    el.appendChild(txt);
    el.appendChild(tip);
    labelPane.appendChild(el);
    return (labelPool[key] = { el: el, lead: lead, tip: tip, txt: txt, text: null });
  }

  function angDiff(a, b) {                 // 归一化到 [-180,180]
    var d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // 以点为中心，沿方向 (cos,sin)、距离 r 摆一个 w×LABEL_H 的文字框
  function boxAt(px, py, r, ca, sa, w) {
    var ax = px + r * ca, ay = py + r * sa;
    var bx = ca > 0.25 ? ax : (ca < -0.25 ? ax - w : ax - w / 2);
    var by = sa > 0.25 ? ay : (sa < -0.25 ? ay - LABEL_H : ay - LABEL_H / 2);
    return { x: bx, y: by, w: w, h: LABEL_H, ax: ax, ay: ay };
  }

  function overlapArea(a, placed) {
    var area = 0;
    for (var i = 0; i < placed.length; i++) {
      var b = placed[i];
      var ox = Math.min(a.x + a.w + TIGHT, b.x + b.w + TIGHT) - Math.max(a.x - TIGHT, b.x - TIGHT);
      var oy = Math.min(a.y + a.h + TIGHT, b.y + b.h + TIGHT) - Math.max(a.y - TIGHT, b.y - TIGHT);
      if (ox > 0 && oy > 0) area += ox * oy;
    }
    return area;
  }

  function labelItems() {
    var out = [];
    window.POIS.forEach(function (p) {
      if (!state.cats[p.cat]) return;
      var show = p.cat === 'visit' || p.cat === 'hotel' ? true
        : (p.cat === 'ref' ? state.refNames : state.names);
      if (!show) return;
      var ll = T(p.lat, p.lon);
      out.push({
        key: p.cat + '|' + p.id,
        text: p.short || p.name,
        lat: ll[0], lng: ll[1],
        bold: p.cat === 'hotel',
        color: LABEL_COLOR[p.cat],
        lead: LEAD_COLOR[p.cat],
        start: p.cat === 'hotel' ? 10 : 6,
        pref: DIR_ANGLE[p.dir],            // 手动指定时的偏好方向（没有邻居时用）
        prio: p.cat === 'hotel' ? 0 : (p.cat === 'visit' ? 1 : (p.cat === 'optional' ? 2 : (p.cat === 'pass' ? 3 : 4)))
      });
    });
    out.sort(function (a, b) { return a.prio - b.prio; });
    return out;
  }

  // 逐帧都可调用：只做定位 + 避让 + 改样式，不重建 DOM
  function layoutLabels() {
    var items = labelItems();
    var placed = [], shown = 0, used = {}, size = map.getSize(), i, j;

    // 1) 屏幕坐标 + 文字宽度
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      it.p = map.latLngToLayerPoint(L.latLng(it.lat, it.lng));
      it.w = textWidth(it.text, it.bold);
      it.on = !(it.p.x < -180 || it.p.x > size.x + 180 || it.p.y < -100 || it.p.y > size.y + 100);
    }

    // 2) 让文字朝「远离附近其它点」的方向甩出去，密集区自然呈放射状展开
    for (i = 0; i < items.length; i++) {
      var a = items[i], sx = 0, sy = 0, n = 0;
      for (j = 0; j < items.length; j++) {
        if (j === i) continue;
        var b = items[j];
        var dx = b.p.x - a.p.x, dy = b.p.y - a.p.y;
        if (Math.abs(dx) < 95 && Math.abs(dy) < 70) { sx += dx; sy += dy; n++; }
      }
      var pref = (n && (sx || sy)) ? Math.atan2(-sy, -sx) * 180 / Math.PI
        : (a.pref != null ? a.pref : 0);
      a.order = ANGLES.slice().sort(function (m, k) {
        return Math.abs(angDiff(m, pref)) - Math.abs(angDiff(k, pref));
      });
    }

    // 3) 由近及远找空位；引线长度 = 文字框到点的距离
    for (i = 0; i < items.length; i++) {
      var it2 = items[i];
      var node = poolGet(it2.key);
      used[it2.key] = 1;
      if (!it2.on) { node.el.style.display = 'none'; continue; }

      var best = null, bestArea = Infinity, bestR = 0, bestCa = 1, bestSa = 0;
      outer:
      for (var ri = 0; ri < RADII.length; ri++) {
        var r = RADII[ri];
        for (var ai = 0; ai < it2.order.length; ai++) {
          var rad = it2.order[ai] * Math.PI / 180;
          var ca = Math.cos(rad), sa = Math.sin(rad);
          var rect = boxAt(it2.p.x, it2.p.y, r, ca, sa, it2.w);
          var area = overlapArea(rect, placed);
          if (area === 0) { best = rect; bestArea = 0; bestR = r; bestCa = ca; bestSa = sa; break outer; }
          if (area < bestArea) { bestArea = area; best = rect; bestR = r; bestCa = ca; bestSa = sa; }
        }
      }
      // 所有位置都挤不下就先不画文字（点还在，悬停/点击仍能看到名字）
      if (!best || bestArea > 0.10 * it2.w * LABEL_H) { node.el.style.display = 'none'; continue; }

      placed.push(best);
      shown++;

      node.el.style.display = '';
      node.el.style.transform = 'translate(' + it2.p.x + 'px,' + it2.p.y + 'px)';
      if (node.text !== it2.text) {
        node.text = it2.text;
        node.txt.textContent = it2.text;
        node.txt.className = 'plabel-txt' + (it2.bold ? ' bold' : '');
        node.txt.style.color = it2.color;
      }
      // 引线：从点旁边出发，指向文字框
      node.lead.style.background = it2.lead;
      node.lead.style.height = it2.bold ? '1.6px' : '1px';
      node.lead.style.width = Math.max(1, bestR - it2.start) + 'px';
      node.lead.style.transform = 'rotate(' + (Math.atan2(bestSa, bestCa) * 180 / Math.PI).toFixed(1)
        + 'deg) translate(' + it2.start + 'px,0)';
      // 引线末端的小圆点，明确"这句是它"
      node.tip.style.background = it2.lead;
      node.tip.style.left = (best.ax - it2.p.x) + 'px';
      node.tip.style.top = (best.ay - it2.p.y) + 'px';
      node.txt.style.left = (best.x - it2.p.x) + 'px';
      node.txt.style.top = (best.y - it2.p.y) + 'px';
    }

    Object.keys(labelPool).forEach(function (k) {      // 本轮没出现的（被筛掉的）隐藏
      if (!used[k]) labelPool[k].el.style.display = 'none';
    });

    var hint = document.getElementById('label-hint');
    if (hint) {
      var msg = items.length
        ? '已显示 ' + shown + ' / ' + items.length + ' 个名称（挤不下的先隐藏，放大或悬停圆点即可看到）'
        : '当前未勾选任何名称';
      if (hint.textContent !== msg) hint.textContent = msg;
    }
  }

  /* ---------------- 点位与路线 ---------------- */
  function hotelIcon() {
    return L.divIcon({
      className: 'hotel-badge', iconSize: [15, 15], iconAnchor: [7.5, 7.5], html: '宿'
    });
  }

  function markerFor(p) {
    var ll = T(p.lat, p.lon);
    var pop = '<div class="pop"><b>' + p.name + '</b>'
      + (p.night ? '<em>' + p.night + '</em>' : (p.day && p.day !== '—' ? '<em>' + p.day + '</em>' : ''))
      + (p.tip ? '<p>' + p.tip + '</p>' : '') + '</div>';
    var m;
    if (p.cat === 'hotel') {
      m = L.marker(ll, { icon: hotelIcon(), zIndexOffset: 500, riseOnHover: true });
    } else {
      var r = p.cat === 'visit' ? 5 : (p.cat === 'pass' ? 4 : (p.cat === 'optional' ? 3.5 : 2.8));
      m = L.circleMarker(ll, {
        radius: r, color: '#fff', weight: p.cat === 'visit' ? 2 : 1.5,
        fillColor: CAT[p.cat].c, fillOpacity: p.cat === 'ref' ? 0.75 : 1
      });
    }
    // 文字标签走标签层，这里只留悬停提示，方便找到被隐藏的名称
    m.bindTooltip(p.short || p.name, { direction: 'top', offset: [0, -6], className: 'lbl-tip' });
    m.bindPopup(pop);
    return m;
  }

  function lineFor(leg, dim) {
    var col = DAY_COLORS[leg.day] || '#2563eb';
    var casing = L.polyline(TPath(leg.path), {
      color: '#ffffff', weight: 7, opacity: 0.55, lineJoin: 'round'
    });
    var main = L.polyline(TPath(leg.path), {
      color: col, weight: 3.4, opacity: dim ? 0.12 : 0.9, lineJoin: 'round'
    });
    main.bindTooltip(leg.day + '　' + nameOf(leg.from) + ' → ' + nameOf(leg.to)
      + '　约' + leg.km + 'km / ' + fmtMin(leg.min), { sticky: true, className: 'lbl-tip' });
    return L.layerGroup([casing, main]);
  }

  function fmtMin(m) { return m >= 60 ? (m / 60).toFixed(1) + 'h' : m + 'min'; }
  function nameOf(id) {
    var f = window.POIS.filter(function (x) { return x.id === id; })[0];
    if (f) return f.name;
    return id;
  }

  function rebuild() {
    groups.route.clearLayers();
    CATS.forEach(function (k) { groups[k].clearLayers(); });
    window.ROUTE.forEach(function (leg) {
      var g = lineFor(leg, state.activeDay && state.activeDay !== leg.day);
      g.eachLayer(function (l) { groups.route.addLayer(l); });
    });
    window.POIS.forEach(function (p) { groups[p.cat].addLayer(markerFor(p)); });
    applyVisibility();
    layoutLabels();
  }

  function applyVisibility() {
    CATS.forEach(function (k) {
      if (state.cats[k]) { if (!map.hasLayer(groups[k])) groups[k].addTo(map); }
      else if (map.hasLayer(groups[k])) map.removeLayer(groups[k]);
    });
    if (state.route) { if (!map.hasLayer(groups.route)) groups.route.addTo(map); }
    else if (map.hasLayer(groups.route)) map.removeLayer(groups.route);
  }

  /* ---------------- 侧栏 ---------------- */
  function dayKm(day) {
    var km = 0, min = 0;
    window.ROUTE.forEach(function (l) { if (l.day === day) { km += l.km || 0; min += l.min || 0; } });
    return { km: Math.round(km), min: min };
  }

  function renderLegend() {
    var box = document.getElementById('legend');
    CATS.forEach(function (k) {
      var row = document.createElement('label');
      row.className = 'lg-row';
      row.innerHTML = '<input type="checkbox" ' + (state.cats[k] ? 'checked' : '')
        + ' data-cat="' + k + '"><i class="' + (k === 'hotel' ? 'sq' : '') + '" style="background:' + CAT[k].c + '">'
        + (k === 'hotel' ? '宿' : '') + '</i>'
        + '<span>' + CAT[k].label + '</span>'
        + '<b>' + window.POIS.filter(function (p) { return p.cat === k; }).length + '</b>';
      box.appendChild(row);
    });
    box.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-cat');
      if (!k) return;
      state.cats[k] = e.target.checked;
      applyVisibility();
      layoutLabels();
    });

    [['route', '行车路线（按天着色）', 'line'],
     ['names', '显示途经城市 / 途经点名称', 'dot'],
     ['refNames', '显示参考点名称', 'dot']].forEach(function (cfg) {
      var row = document.createElement('label');
      row.className = 'lg-row';
      row.innerHTML = '<input type="checkbox" ' + (state[cfg[0]] ? 'checked' : '') + ' data-tog="' + cfg[0] + '">'
        + '<i class="' + cfg[2] + '"></i><span>' + cfg[1] + '</span>';
      box.appendChild(row);
    });
    box.addEventListener('change', function (e) {
      var t = e.target.getAttribute('data-tog');
      if (!t) return;
      state[t] = e.target.checked;
      if (t === 'route') applyVisibility(); else layoutLabels();
    });
  }

  function renderItinerary() {
    var box = document.getElementById('days');
    window.ITINERARY.forEach(function (d) {
      var k = dayKm(d.day);
      var el = document.createElement('div');
      el.className = 'day lv-' + d.level;
      el.setAttribute('data-day', d.day);
      el.innerHTML =
        '<div class="day-h"><span class="pill" style="background:' + (DAY_COLORS[d.day] || '#334155') + '">'
        + d.day + '</span><span class="wd">' + d.wd + '</span>'
        + '<span class="km">' + (k.km ? '≈' + k.km + 'km · ' + (k.min / 60).toFixed(1) + 'h' : '—')
        + '</span></div>'
        + '<div class="day-t">' + d.title + '</div>'
        + '<div class="day-p">计划：' + d.plan + '</div>'
        + '<div class="day-s"><b>宿</b> ' + d.stay + '</div>'
        + (d.note ? '<div class="day-n">' + d.note + '</div>' : '')
        + (d.flag ? '<div class="day-f">' + d.flag + '</div>' : '');
      el.addEventListener('click', function () { focusDay(d.day, el); });
      box.appendChild(el);
    });
  }

  function focusDay(day, el) {
    if (state.activeDay === day) day = null;
    state.activeDay = day;
    document.querySelectorAll('.day').forEach(function (n) { n.classList.remove('on'); });
    if (el && day) el.classList.add('on');
    rebuild();
    if (!day) { fitAll(); return; }
    var b = L.latLngBounds([]);
    window.ROUTE.forEach(function (l) {
      if (l.day === day) TPath(l.path).forEach(function (ll) { b.extend(ll); });
    });
    var d = window.ITINERARY.filter(function (x) { return x.day === day; })[0];
    if (d) {
      window.POIS.forEach(function (p) {
        if (d.spots.indexOf(p.id) >= 0) b.extend(T(p.lat, p.lon));
      });
    }
    if (b.isValid()) map.flyToBounds(b.pad(0.12), { duration: 0.7 });
  }

  function fitAll() {
    var b = L.latLngBounds([]);
    window.ROUTE.forEach(function (l) { TPath(l.path).forEach(function (ll) { b.extend(ll); }); });
    if (b.isValid()) map.flyToBounds(b.pad(0.05), { duration: 0.7 });
  }

  function renderChecks() {
    var box = document.getElementById('checks');
    window.CHECKS.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'chk lv-' + c.lv;
      el.innerHTML = '<b>' + c.t + '</b><p>' + c.d + '</p>';
      box.appendChild(el);
    });
  }

  function renderStats() {
    var km = window.ROUTE.reduce(function (s, l) { return s + (l.km || 0); }, 0);
    var min = window.ROUTE.reduce(function (s, l) { return s + (l.min || 0); }, 0);
    document.getElementById('stat-km').textContent = Math.round(km / 10) * 10;
    document.getElementById('stat-h').textContent = Math.round(min / 60);
    document.getElementById('stat-v').textContent =
      window.POIS.filter(function (p) { return p.cat === 'visit'; }).length;
    document.getElementById('stat-hotel').textContent =
      window.POIS.filter(function (p) { return p.cat === 'hotel'; }).length;
    document.getElementById('stat-r').textContent =
      window.POIS.filter(function (p) { return p.cat === 'ref'; }).length;
  }

  /* ---------------- 初始化 ---------------- */
  renderLegend();
  renderItinerary();
  renderChecks();
  renderStats();
  rebuild();
  setTimeout(fitAll, 250);

  L.control.layers(BASES, null, { position: 'topright', collapsed: false }).addTo(map);
  map.on('baselayerchange', function (e) {
    var m = PROJ_OF[e.name] || 'gcj';
    if (m === MODE) return;
    MODE = m;
    rebuild();
  });
  // 平移/缩放动画期间 Leaflet 会把整个 pane 一起做 transform，标签自动跟随；
  // 动画结束（坐标原点变化）后再重算一次，顺便刷新避让结果与视野外的显隐。
  map.on('zoomend viewreset moveend', layoutLabels);
  window.addEventListener('resize', function () { setTimeout(layoutLabels, 60); });

  document.getElementById('btn-fit').addEventListener('click', function () {
    state.activeDay = null;
    document.querySelectorAll('.day').forEach(function (n) { n.classList.remove('on'); });
    rebuild();
    fitAll();
  });

  function switchTab(which) {
    var it = which === 'itin';
    document.getElementById('btn-itinerary').classList.toggle('on', it);
    document.getElementById('btn-panel').classList.toggle('on', !it);
    document.getElementById('itinerary-panel').classList.toggle('hidden', !it);
    document.getElementById('check-panel').classList.toggle('hidden', it);
  }
  document.getElementById('btn-itinerary').addEventListener('click', function () { switchTab('itin'); });
  document.getElementById('btn-panel').addEventListener('click', function () { switchTab('check'); });
})();
