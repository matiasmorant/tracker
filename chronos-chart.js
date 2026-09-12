import {
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

function clipPath(padding, chartWidth, chartHeight) {
  return m('clipPath#chartClip',
    m('rect', { x: padding.left, y: padding.top, width: chartWidth, height: chartHeight })
  );
}

function shadingRect(band, minDate, maxDate, xScale, padding, chartWidth, chartHeight) {
  const visibleStart = band.start < minDate ? minDate : band.start;
  const visibleEnd   = band.end   > maxDate ? maxDate : band.end;
  const xStart = padding.left + xScale(visibleStart);
  const xEnd   = padding.left + xScale(visibleEnd);
  const w = xEnd - xStart;
  if (w <= 0 || xStart > padding.left + chartWidth || xEnd < padding.left) return null;
  return m('rect[fill=currentColor][fill-opacity=0.1]', {
    x: Math.max(padding.left, xStart),
    y: padding.top,
    width: Math.min(chartWidth, w - Math.max(0, padding.left - xStart)),
    height: chartHeight,
  });
}

function axesGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints, options) {
  const { minDate, maxDate, mode, items } = getXAxisConfig(allPoints, options.viewDays, options.panOffset);
  const yValues = generateYValues(allPoints.map(p => p.y), 6, options.logScale);

  const gridLines = [];
  const axisLines = [];
  const axisTexts = [];

  if (options.grid.show) {
    if (mode.startsWith('shade-')) {
      items.filter(b => b.isEven).forEach(band => {
        const r = shadingRect(band, minDate, maxDate, xScale, padding, chartWidth, chartHeight);
        if (r) gridLines.push(r);
      });
    } else {
      items.forEach(({ date }) => {
        const x = padding.left + xScale(date);
        if (x >= padding.left && x <= padding.left + chartWidth) {
          gridLines.push(m('line.grid-line[stroke=currentColor][stroke-opacity=0.2][stroke-width=1]', {
            x1: x, y1: padding.top, x2: x, y2: padding.top + chartHeight,
          }));
        }
      });
    }
    yValues.forEach(yv => {
      const y = padding.top + yScale(yv);
      gridLines.push(m('line.grid-line[stroke=currentColor][stroke-opacity=0.2][stroke-width=1]', {
        x1: padding.left, y1: y, x2: padding.left + chartWidth, y2: y,
      }));
    });
  }

  if (options.axis.show) {
    axisLines.push(
      m('line.axis-line[stroke=currentColor][stroke-opacity=0.5][stroke-width=1.5]', {
        x1: padding.left, y1: padding.top + chartHeight, x2: padding.left + chartWidth, y2: padding.top + chartHeight,
      }),
      m('line.axis-line[stroke=currentColor][stroke-opacity=0.5][stroke-width=1.5]', {
        x1: padding.left, y1: padding.top, x2: padding.left, y2: padding.top + chartHeight,
      }),
    );
    items.forEach(item => {
      const x = padding.left + xScale(item.label.pos);
      if (x < padding.left || x > padding.left + chartWidth) return;
      axisTexts.push(m('text.axis-text.text-xs.select-none.pointer-events-none[text-anchor=middle][fill=currentColor][opacity=0.7]', {
        x,
        y: padding.top + chartHeight + 20,
      }, item.label.text));
    });
    yValues.forEach(v => {
      const y = padding.top + yScale(v);
      axisTexts.push(m('text.axis-text.text-xs.select-none.pointer-events-none[text-anchor=end][fill=currentColor][opacity=0.7]', {
        x: padding.left + 20,
        y: y - 4,
      }, formatValue(v, options.valueFormatter)));
    });
  }

  return [
    gridLines.length ? m('g.grid-group', gridLines) : null,
    axisLines.length || axisTexts.length ? m('g.axis-group', [...axisLines, ...axisTexts]) : null,
  ];
}

function chartLine(points, xScale, yScale, padding, style) {
  if (points.length < 2) return null;
  const d = generateSmoothPath(points, xScale, yScale, padding.left, padding.top, style.tension);
  return m('path.chart-line[fill=none][stroke-linecap=round][stroke-linejoin=round]', {
    d,
    stroke: style.color,
    'stroke-width': style.width,
    'stroke-dasharray': style.dash.join(' '),
  });
}

function chartPoints(points, xScale, yScale, dims, style, onEnter, onLeave) {
  const { padding, chartWidth, chartHeight } = dims;
  const radius = style.radius || 4;
  return m('g',
    points.map((point, index) => {
      const cx = padding.left + xScale(point.x);
      const cy = padding.top  + yScale(point.y);
      return m('circle.chart-point.cursor-pointer[stroke-width=2][fill=white]', {
        cx, cy,
        r: radius,
        stroke: style.color,
        class: 'hover:[r:6px]',
        style: 'transition: r 0.2s ease;',
        onmouseenter: (e) => {
          e.redraw = false;
          if (cx >= padding.left && cx <= padding.left + chartWidth &&
              cy >= padding.top  && cy <= padding.top  + chartHeight) {
            onEnter(e, point, style.label, index);
          }
        },
        onmouseleave: (e) => {
          e.redraw = false;
          onLeave();
        },
      });
    })
  );
}

function ChronosChart(initialVnode) {
  let options      = { ...defaultOptions, ...(initialVnode.attrs.options || {}) };
  let data         = initialVnode.attrs.data || [];
  let containerEl  = null;
  let raf          = null;

  // Pan state
  let isPanning      = false;
  let panReady       = false;
  let panStartX      = 0;
  let panOffset      = 0;
  let maxPanOffset   = 0;
  let panStartOffset = 0;
  let originalViewDays = options.viewDays;

  // Tooltip state
  let tooltipEl        = null;
  let isTooltipVisible = false;
  let tooltipLeft      = 0;
  let tooltipTop       = 0;

  // Theme observer — triggers a redraw when dark class toggles
  const themeObserver = new MutationObserver(() => m.redraw());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  let resizeObserver = null;

  // ---------------------------------------------------------------------------
  // Pan helpers
  // ---------------------------------------------------------------------------

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
    if (shouldResetPan) {
      resetPanState();
    }
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
    let   newOffset  = panStartOffset + (e.clientX - panStartX) * daysPerPx;
    panOffset        = Math.max(0, Math.min(maxPanOffset, newOffset));
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

  // ---------------------------------------------------------------------------
  // Tooltip helpers
  // ---------------------------------------------------------------------------

  function showTooltip(event, point, label) {
    if (!tooltipEl || !containerEl) return;
    const formattedValue = formatValue(point.y, options.valueFormatter);
    const [minDate, maxDate] = getVisibleDateRange(
      data?.datasets?.flatMap(d => d.data || []) || [],
      options.viewDays, panOffset
    );
    const dateStr = formatDate(point.x, minDate, maxDate);

    tooltipEl.innerHTML = `
      <div><strong>${label}</strong></div>
      <div>Date: ${dateStr}</div>
      <div>Value: ${formattedValue}</div>
    `;
    tooltipEl.style.opacity = '1';

    const tooltipWidth  = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const containerRect = containerEl.getBoundingClientRect();

    let left = event.clientX - containerRect.left + 10;
    let top  = event.clientY - containerRect.top  + 10;

    if (left + tooltipWidth  > containerRect.width)  left = event.clientX - containerRect.left - tooltipWidth  - 10;
    if (top  + tooltipHeight > containerRect.height) top  = event.clientY - containerRect.top  - tooltipHeight - 10;

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top  = `${top}px`;
    tooltipLeft = left;
    tooltipTop  = top;
    isTooltipVisible = true;
  }

  function hideTooltip() {
    isTooltipVisible = false;
    if (tooltipEl) {
      tooltipEl.style.opacity = '0';
    }
  }

  // ---------------------------------------------------------------------------
  // SVG chart content
  // ---------------------------------------------------------------------------

  function renderChart(width, height) {
    const padding     = options.padding;
    const chartWidth  = Math.max(0, width  - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top  - padding.bottom);

    const allPoints = data.datasets.flatMap(ds =>
      ds.data?.filter(p => p.x && p.y !== undefined) || []
    );
    if (!allPoints.length) return null;

    const xScaleFn = createXScale(allPoints, chartWidth, options.viewDays, panOffset);
    const yScaleFn = createYScale(allPoints, chartHeight, options.logScale);
    const dims     = { width, height, chartWidth, chartHeight, padding };

    const datasetNodes = data.datasets.map((ds, i) => {
      if (!ds.data?.length) return null;
      const color  = ds.borderColor || options.colors[i % options.colors.length];
      const points = ds.data.filter(p => p.x && p.y !== undefined);
      if (!points.length) return null;

      return m('g', { key: i },
        chartLine(points, xScaleFn, yScaleFn, padding, {
          color,
          width:   ds.borderWidth || options.lineWidth,
          tension: ds.tension     || options.tension,
          dash:    ds.borderDash  || [],
        }),
        options.showPoints && !ds.hidePoints
          ? chartPoints(points, xScaleFn, yScaleFn, dims,
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
      clipPath(padding, chartWidth, chartHeight),
      ...axesGrid(xScaleFn, yScaleFn, chartWidth, chartHeight, padding, allPoints,
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
          chartNode
            ? chartNode
            : m('.absolute.top-1/2.left-1/2.-translate-x-1/2.-translate-y-1/2.text-sm.text-gray-400.text-center',
                'No data to display'),

          m('.tooltip.absolute.pointer-events-none.z-50.rounded-md.px-3.py-2.text-xs.text-white.whitespace-nowrap.shadow-lg.bg-black/80.transition-opacity.duration-200', {
            style: {
              opacity: isTooltipVisible ? 1 : 0,
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`,
            },
            oncreate({dom}) { tooltipEl = dom; },
            onupdate({dom}) { tooltipEl = dom; },
          }),

          m('.absolute.z-10', { class: 'bottom-1.5 left-2.5' },
            m('button.font-black.px-1.rounded.cursor-pointer.transition-all' +
              '.border-none.outline.outline-1.backdrop-blur-sm' +
              '.bg-white/80.text-indigo-600.outline-indigo-200/60' +
              '.hover:bg-indigo-50.hover:outline-indigo-400/60.hover:-translate-y-px' +
              '.active:translate-y-0' +
              '.dark:bg-black/80.dark:text-indigo-400.dark:outline-indigo-400/20' +
              '.dark:hover:bg-indigo-900/20.dark:hover:outline-indigo-400/40', {
              class: 'text-[10px] py-0.5',
              onclick(e) {
                e.preventDefault();
                e.stopPropagation();
                const newScale = !options.logScale;
                const onScaleClick = attrs.onScaleClick || attrs.onscaleclick;
                if (onScaleClick) {
                  onScaleClick(newScale);
                } else {
                  options.logScale = newScale;
                  m.redraw();
                }
              },
            }, options.logScale ? 'LOG' : 'LINEAR'),
          ),
        ),
      );
    },
  };
}

export default ChronosChart;