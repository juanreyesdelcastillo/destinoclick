// <dc-world-map> — mapamundi real (Natural Earth / TopoJSON) con regiones B2B coloreables.
// Llama a window.__dcSelectRegion(key) al hacer clic en una región.
(function () {
  const REGIONS = {
    mexico: { label: 'MÉXICO', at: [-102, 23], ids: ['484'] },
    caribe: { label: 'CARIBE Y CENTROAMÉRICA', at: [-80, 13], ids: ['214', '192', '388', '188', '320', '340', '222', '558', '591', '084', '044', '630', '332'] },
    europa: { label: 'EUROPA', at: [4, 45], ids: ['724', '380', '250', '620'] },
    asia: { label: 'ASIA Y MEDIO ORIENTE', at: [70, 26], ids: ['462', '392', '792', '784'] },
    cruceros: { label: 'CRUCEROS', at: [-45, 28], ids: [], ocean: true },
    tours: { label: 'TOURS PREMIUM', at: [-30, -18], ids: [], ocean: true }
  };
  const ROUTES = [
    ['mexico', 'europa'], ['europa', 'asia'], ['mexico', 'caribe'],
    ['caribe', 'cruceros'], ['cruceros', 'europa'], ['mexico', 'asia']
  ];
  const GOLD = '#e6b063';
  const NS = 'http://www.w3.org/2000/svg';

  const ready = () => new Promise((res) => {
    const t = setInterval(() => {
      if (window.d3 && window.topojson) { clearInterval(t); res(); }
    }, 60);
  });

  let cache = null;
  async function geo() {
    if (!cache) {
      const topo = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then((r) => r.json());
      cache = window.topojson.feature(topo, topo.objects.countries);
    }
    return cache;
  }

  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  class DcWorldMap extends HTMLElement {
    connectedCallback() {
      this.style.display = 'block';
      this.style.position = 'relative';
      this.style.width = '100%';
      this.style.height = '100%';
      this.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 11px/1 \'Plus Jakarta Sans\',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#475569">Cargando red mundial…</div>';
      this.boot();
      this.ro = new ResizeObserver(() => this.draw());
      this.ro.observe(this);
    }
    disconnectedCallback() { if (this.ro) this.ro.disconnect(); }

    async boot() {
      await ready();
      this.world = await geo();
      this.innerHTML = '';
      this.draw();
    }

    draw() {
      if (!this.world) return;
      const w = this.clientWidth || 900;
      const h = this.clientHeight || 470;
      if (w < 40 || h < 40) return;
      const d3 = window.d3;
      const active = this.getAttribute('active');

      const proj = d3.geoNaturalEarth1().fitExtent([[10, 6], [w - 10, h - 6]], { type: 'Sphere' });
      const path = d3.geoPath(proj);
      const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%' });
      svg.style.display = 'block';
      svg.style.overflow = 'visible';

      const defs = el('defs');
      defs.innerHTML =
        '<radialGradient id="dcSea" cx="50%" cy="45%" r="70%">' +
        '<stop offset="0%" stop-color="#0b2138"/><stop offset="100%" stop-color="#040e1b"/></radialGradient>' +
        '<radialGradient id="dcHalo" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffe0a8" stop-opacity=".95"/>' +
        '<stop offset="45%" stop-color="#e6b063" stop-opacity=".45"/>' +
        '<stop offset="100%" stop-color="#e6b063" stop-opacity="0"/></radialGradient>';
      svg.appendChild(defs);

      svg.appendChild(el('path', { d: path({ type: 'Sphere' }), fill: 'url(#dcSea)' }));
      const grat = d3.geoGraticule10();
      svg.appendChild(el('path', { d: path(grat), fill: 'none', stroke: 'rgba(148,163,184,.12)', 'stroke-width': '.6' }));

      const owner = {};
      Object.keys(REGIONS).forEach((k) => REGIONS[k].ids.forEach((id) => { owner[id] = k; }));

      const land = el('g', {});
      this.world.features.forEach((f) => {
        const key = owner[String(f.id).padStart(3, '0')];
        const on = !!key;
        const isActive = key && key === active;
        const p = el('path', {
          d: path(f) || '',
          fill: isActive ? '#4a3a1c' : on ? '#26405c' : '#152b42',
          stroke: isActive ? GOLD : on ? 'rgba(230,176,99,.45)' : 'rgba(49,81,116,.75)',
          'stroke-width': isActive ? '1.4' : on ? '.8' : '.5'
        });
        p.style.transition = 'fill .35s ease, stroke .35s ease';
        if (on) {
          p.style.cursor = 'pointer';
          p.addEventListener('mouseenter', () => { p.setAttribute('fill', '#5c4622'); p.setAttribute('stroke', '#ffcd89'); });
          p.addEventListener('mouseleave', () => { p.setAttribute('fill', isActive ? '#4a3a1c' : '#26405c'); p.setAttribute('stroke', isActive ? GOLD : 'rgba(230,176,99,.45)'); });
          p.addEventListener('click', () => window.__dcSelectRegion && window.__dcSelectRegion(key));
        }
        land.appendChild(p);
      });
      svg.appendChild(land);

      // Rutas comerciales sobre geodésicas reales
      const line = d3.line().curve(d3.curveBasis);
      const arcs = ROUTES.map(([a, b]) => {
        const ip = d3.geoInterpolate(REGIONS[a].at, REGIONS[b].at);
        const pts = d3.range(0, 1.0001, 1 / 40).map((t) => proj(ip(t)));
        return line(pts);
      });
      const base = el('g', { fill: 'none', stroke: 'rgba(230,176,99,.3)', 'stroke-width': '1.1' });
      const flow = el('g', { fill: 'none', stroke: GOLD, 'stroke-width': '1.7', 'stroke-dasharray': '12 260', 'stroke-linecap': 'round' });
      flow.style.animation = 'dcDash 6s linear infinite';
      arcs.forEach((d) => {
        base.appendChild(el('path', { d }));
        flow.appendChild(el('path', { d }));
      });
      svg.appendChild(base);
      svg.appendChild(flow);

      const planes = el('g', { fill: '#fff3d6' });
      arcs.slice(0, 4).forEach((d, i) => {
        const c = el('circle', { r: i % 2 ? '2.4' : '3.1' });
        const m = el('animateMotion', { dur: (8 + i * 1.6) + 's', begin: (i * 1.4) + 's', repeatCount: 'indefinite', path: d, rotate: 'auto' });
        c.appendChild(m);
        planes.appendChild(c);
      });
      svg.appendChild(planes);

      Object.keys(REGIONS).forEach((k) => {
        const r = REGIONS[k];
        const [x, y] = proj(r.at);
        const isActive = k === active;
        const g = el('g', {});
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => window.__dcSelectRegion && window.__dcSelectRegion(k));

        const halo = el('circle', { cx: x, cy: y, r: 26, fill: 'url(#dcHalo)', opacity: '.9' });
        halo.style.transformOrigin = `${x}px ${y}px`;
        halo.style.animation = 'dcPulseRing 2.8s ease-out infinite';
        g.appendChild(halo);
        g.appendChild(el('circle', { cx: x, cy: y, r: isActive ? 7 : 5.5, fill: r.ocean ? '#7bd0ff' : '#ffcd89', stroke: '#040e1b', 'stroke-width': '1.8' }));
        g.appendChild(el('circle', { cx: x, cy: y, r: 2.1, fill: '#040e1b' }));

        const tw = r.label.length * 6.6 + 18;
        const ly = y < h * 0.45 ? y - 30 : y + 18;
        g.appendChild(el('rect', { x: x - tw / 2, y: ly, width: tw, height: 19, rx: 6, fill: 'rgba(4,14,27,.92)', stroke: isActive ? GOLD : 'rgba(230,176,99,.4)', 'stroke-width': '1' }));
        const t = el('text', {
          x: x, y: ly + 13, 'text-anchor': 'middle', fill: r.ocean ? '#c4e7ff' : '#ffe0a8',
          'font-family': 'Montserrat, sans-serif', 'font-size': '9.5', 'font-weight': '700', 'letter-spacing': '.9'
        });
        t.textContent = r.label;
        g.appendChild(t);
        svg.appendChild(g);
      });

      this.replaceChildren(svg);
    }

    static get observedAttributes() { return ['active']; }
    attributeChangedCallback() { this.draw(); }
  }

  if (!customElements.get('dc-world-map')) customElements.define('dc-world-map', DcWorldMap);
})();
