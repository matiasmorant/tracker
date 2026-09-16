import {
  Interval,
  parseDate,
  formatValue,
  formatDate,
  generateYValues,
  getTotalDataDays,
  createXScale,
  createYScale,
  getVisibleDateRange,
  generateSmoothPath,
  getXAxisConfig,
} from './chart-utils.js';

const defaultOptions = {
  type: 'line', xScale: 'time', yScale: 'linear',
  padding: { top: 20, right: 10, bottom: 30, left: 10 },
  grid: { show: true, color: '#e5e7eb' },
  axis: { show: true, color: '#6b7280', fontSize: 12 },
  lineWidth: 2, pointRadius: 4, tension: 0.2, viewDays: 0,
  darkMode: false, logScale: false, showPoints: true,
  colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
           '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'],
};

function clipPath(box) {
  return m('clipPath#chartClip',
    m('rect', { x: box.x[0], y: box.y[0], width: Interval.size(box.x), height: Interval.size(box.y) })
  );
}

function shadingRect(band, dateInterval, xScale, box) {
  const visible = Interval.intersectDate(band.interval, dateInterval); if (!visible)                   return null;
  const xVisible = visible.map(xScale);                                if (Interval.isEmpty(xVisible)) return null;
  const clamped = Interval.intersect(xVisible, box.x);                 if (!clamped)                   return null;
  return m('rect[fill=currentColor][fill-opacity=0.1]', {
    x: clamped[0],
    y: box.y[0],
    width:  Interval.size(clamped),
    height: Interval.size(box.y),
  });
}

function axesGrid(xScale, yScale, box, allPoints, options) {
  const { dateInterval, mode, items } = getXAxisConfig(allPoints, options.viewDays, options.panOffset);
  const yValues = generateYValues(allPoints.map(p => p.y), 6, options.logScale);

  const gridLines = [];
  const axisLines = [];
  const axisTexts = [];
  const GridLine = 'line[stroke=currentColor][stroke-opacity=0.2][stroke-width=1]';
  const Axis = 'line[stroke=currentColor][stroke-opacity=0.5][stroke-width=1.5]';
  const TickLabel = 'text.text-xs.select-none.pointer-events-none[fill=currentColor][opacity=0.7]'; 
  if (options.grid.show) {
    if (mode.startsWith('shade-')) {
      items.filter(b => b.isEven).forEach(band => {
        const r = shadingRect(band, dateInterval, xScale, box);
        if (r) gridLines.push(r);
      });
    } else {
      items.forEach(({ date }) => {
        const x = xScale(date);
        if (Interval.contains(box.x, x)) {
          gridLines.push(m(GridLine, { x1: x, y1: box.y[0], x2: x, y2: box.y[1], }));
        }
      });
    }
    yValues.forEach(yv => {
      const y = yScale(yv);
      gridLines.push(m(GridLine, { x1: box.x[0], y1: y, x2: box.x[1], y2: y, }));
    });
  }

  if (options.axis.show) {
    axisLines.push(
      m(Axis, { x1: box.x[0], y1: box.y[1], x2: box.x[1], y2: box.y[1], }),
      m(Axis, { x1: box.x[0], y1: box.y[0], x2: box.x[0], y2: box.y[1], }),
    );
    items.forEach(item => {
      const x = xScale(item.label.pos);
      if (!Interval.contains(box.x, x)) return;
      axisTexts.push(m(TickLabel+'[text-anchor=middle]', { x, y: box.y[1] + 20, }, item.label.text));
    });
    yValues.forEach(v => {
      const y = yScale(v);
      axisTexts.push(m(TickLabel+'[text-anchor=end]'   , { x: box.x[0] + 20, y: y - 4, }, formatValue(v, options.valueFormatter)));
    });
  }

  return [
    gridLines.length ? m('g', gridLines) : null,
    axisLines.length || axisTexts.length ? m('g', [...axisLines, ...axisTexts]) : null,
  ];
}

function chartLine(points, xScale, yScale, box, style) {
  if (points.length < 2) return null;
  const d = generateSmoothPath(points, xScale, yScale, style.tension);
  return m('path.chart-line[fill=none][stroke-linecap=round][stroke-linejoin=round]', {
    d,
    stroke: style.color,
    'stroke-width': style.width,
    'stroke-dasharray': style.dash.join(' '),
  });
}

function chartPoints(points, xScale, yScale, box, style, onEnter, onLeave) {
  const radius = style.radius || 4;
  return m('g',
    points.map((point, index) => {
      const cx = xScale(point.x);
      const cy = yScale(point.y);
      return m('circle.chart-point.cursor-pointer[stroke-width=2][fill=white]', {
        cx, cy,
        r: radius,
        stroke: style.color,
        class: 'hover:[r:6px]',
        style: 'transition: r 0.2s ease;',
        onmouseenter: (e) => {
          if (Interval.contains(box.x, cx) && Interval.contains(box.y, cy)) {
            onEnter(e, point, style.label, index);
          }
        },
        onmouseleave: () => {
          onLeave();
        },
      });
    })
  );
}

function ChronosChart(initialVnode) {
  let options     = { ...defaultOptions, ...(initialVnode.attrs.options || {}) };
  let data        = initialVnode.attrs.data || [];
  let containerEl = null;
  let raf         = null;

  // Pan state
  let isPanning      = false;
  let panReady       = false;
  let panStartX      = 0;
  let panOffset      = 0;
  let maxPanOffset   = 0;
  let panStartOffset = 0;
  let originalViewDays = options.viewDays;

  // Tooltip state — single source of truth, consumed by tooltipVnode()
  let tooltip = {
    visible: false,
    left: 0, top: 0,
    label: '', date: '', value: '',
  };

  const themeObserver = new MutationObserver(() => m.redraw());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  let resizeObserver = null;

  function resetPanState() {
    panOffset        = 0;
    isPanning        = false;
    originalViewDays = options.viewDays;
    panReady         = false;
  }

  function syncDataAndOptions(newAttrs) {
    let shouldResetPan = false;
    if (newAttrs.data !== undefined && (newAttrs.data !== data || newAttrs.data?.datasets !== data?.datasets)) {
      data = newAttrs.data;
      shouldResetPan = true;
    }
    if (newAttrs.options !== undefined) {
      const o = newAttrs.options;
      if (o.viewDays !== undefined && o.viewDays !== originalViewDays) {
        originalViewDays = o.viewDays;
        shouldResetPan = true;
      }
      options = { ...defaultOptions, ...o };
    }
    if (shouldResetPan) resetPanState();
  }

  function onpointerenter() {
    if (options.viewDays > 0) { panReady = true; m.redraw(); }
  }

  function onpointerleave() {
    panReady  = false;
    isPanning = false;
    m.redraw();
  }

  function onpointerdown(e) {
    if (options.viewDays <= 0 || e.button !== 0) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);

    isPanning      = true;
    panReady       = false;
    panStartX      = e.clientX;
    panStartOffset = panOffset;
    maxPanOffset   = Math.max(0, getTotalDataDays(data) - originalViewDays);
    m.redraw();
  }

  function onpointermove(e) {
    if (!isPanning || options.viewDays <= 0) return;
    e.preventDefault();

    const chartWidth = containerEl.clientWidth - options.padding.left - options.padding.right;
    const daysPerPx  = maxPanOffset / chartWidth;
    const newOffset  = panStartOffset + (e.clientX - panStartX) * daysPerPx;
    panOffset        = Interval.clamp([0, maxPanOffset], newOffset);
    options.viewDays = originalViewDays;
    m.redraw();
  }

  function onpointerup(e) {
    if (!isPanning) return;
    e.preventDefault();
    isPanning = false;
    panReady  = options.viewDays > 0;
    m.redraw();
  }

  function showTooltip(event, point, label) {
    if (!containerEl) return;
    const dateInterval = getVisibleDateRange(
      data?.datasets?.flatMap(d => d.data || []) || [],
      options.viewDays, panOffset
    );
    const rect = containerEl.getBoundingClientRect();

    tooltip = {
      visible: true,
      left : event.clientX - rect.left + 10,
      top  : event.clientY - rect.top  + 10,
      label,
      date:  formatDate(point.x, dateInterval),
      value: formatValue(point.y, options.valueFormatter),
    };
  }

  function hideTooltip() {
    if (!tooltip.visible) return;
    tooltip.visible = false;
  }

  function clampTooltip({ dom }) {
    if (!tooltip.visible || !containerEl) return;

    const tw = dom.offsetWidth,  th = dom.offsetHeight;
    const cw = containerEl.clientWidth, ch = containerEl.clientHeight;

    let left = tooltip.left;
    let top  = tooltip.top;
    if (left + tw > cw) left = tooltip.left - 10 - tw - 10;
    if (top  + th > ch) top  = tooltip.top  - 10 - th - 10;
    left = Interval.clamp([0, cw - tw], left);
    top  = Interval.clamp([0, ch - th], top);

    if (left !== tooltip.left || top !== tooltip.top) {
      tooltip.left = left;
      tooltip.top  = top;
      dom.style.left = `${left}px`;
      dom.style.top  = `${top}px`;
    }
  }

  function renderChart(width, height) {
    const padding     = options.padding;
    const chartWidth  = Math.max(0, width  - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top  - padding.bottom);
    const box = {
      x: [padding.left, padding.left + chartWidth],
      y: [padding.top,  padding.top  + chartHeight],
    };

    const allPoints = data.datasets.flatMap(ds =>
      ds.data?.filter(p => p.x && p.y !== undefined) || []
    );
    if (!allPoints.length) return null;

    const xScaleFn = createXScale(allPoints, box, options.viewDays, panOffset);
    const yScaleFn = createYScale(allPoints, box, options.logScale);

    const datasetNodes = data.datasets.map((ds, i) => {
      if (!ds.data?.length) return null;
      const color  = ds.borderColor || options.colors[i % options.colors.length];
      const points = ds.data.filter(p => p.x && p.y !== undefined);
      if (!points.length) return null;

      return m('g', { key: i },
        chartLine(points, xScaleFn, yScaleFn, box, {
          color,
          width:   ds.borderWidth || options.lineWidth,
          tension: ds.tension     || options.tension,
          dash:    ds.borderDash  || [],
        }),
        options.showPoints && !ds.hidePoints
          ? chartPoints(points, xScaleFn, yScaleFn, box,
              { color, radius: ds.pointRadius || options.pointRadius, label: ds.label || `Dataset ${i + 1}` },
              showTooltip, hideTooltip)
          : null,
      );
    });

    return m('svg.w-full.h-full.block.select-none.touch-none', {
      onpointerenter,
      onpointerleave,
      onpointerdown,
      onpointermove,
      onpointerup,
      onpointercancel: onpointerup,
      oncontextmenu:   e => e.preventDefault(),
    },
      clipPath(box),
      ...axesGrid(xScaleFn, yScaleFn, box, allPoints,
        { ...options, panOffset }),
      m('g[clip-path="url(#chartClip)"]', datasetNodes),
    );
  }

  return {
    oncreate({dom}) {
      containerEl = dom.querySelector('.chart-container');

      resizeObserver = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => m.redraw());
      });
      resizeObserver.observe(dom);
    },

    onbeforeupdate({dom, attrs}) {
      containerEl = dom?.querySelector('.chart-container') || containerEl;
      syncDataAndOptions(attrs);
    },

    onupdate({dom, attrs }) {
      containerEl = dom?.querySelector('.chart-container') || containerEl;
      syncDataAndOptions(attrs);
    },

    onremove() {
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },

    view({attrs}) {
      const cursorClass = isPanning ? 'cursor-grabbing' : panReady ? 'cursor-grab' : 'cursor-default';
      const width       = containerEl?.clientWidth  || parseInt(attrs.width)  || 600;
      const height      = containerEl?.clientHeight || parseInt(attrs.height) || 400;
      const chartNode   = data?.datasets?.length ? renderChart(width, height) : null;

      return m('.relative.w-full.h-full.font-sans',
        m('.chart-container.relative.w-full.h-full.overflow-hidden.touch-pan-y',
          { class: cursorClass },
          chartNode || m('.absolute.top-1/2.left-1/2.-translate-x-1/2.-translate-y-1/2.text-sm.text-gray-400.text-center', 'No data to display'),
          m('.tooltip.absolute.pointer-events-none.z-50.rounded-md.px-3.py-2.text-xs.text-white.whitespace-nowrap.shadow-lg.bg-black/80.transition-opacity.duration-200', {
            style: {
              opacity: tooltip.visible ? 1 : 0,
              left: `${tooltip.left}px`,
              top:  `${tooltip.top}px`,
            },
            oncreate: clampTooltip,
            onupdate: clampTooltip,
            },
            m('', m('strong', tooltip.label)),
            m('', `Date: ${tooltip.date}`),
            m('', `Value: ${tooltip.value}`),
          ),
        ),
      );
    },
  };
}

export default ChronosChart;