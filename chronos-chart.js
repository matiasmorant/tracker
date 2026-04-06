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

export class ChronosChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = [];
    this._datasets = [];
    this._defaultOptions = {
      type: 'line', xScale: 'time', yScale: 'linear', padding: { top: 20, right: 10, bottom: 30, left: 10 },
      grid: { show: true, color: '#e5e7eb' }, axis: { show: true, color: '#6b7280', fontSize: 12 },
      lineWidth: 2, pointRadius: 4, tension: 0.2, viewDays: 0, darkMode: false, logScale: false, showPoints: true,
      colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6']
    };
    
    this._options = { ...this._defaultOptions };
    this._isDark = document.documentElement.classList.contains('dark');
    this._resizeObserver = null;
    this._animationFrame = null;
    
    // Panning state
    this._isPanning = false;
    this._panStartX = 0;
    this._panOffset = 0;
    this._maxPanOffset = 0;
    this._originalViewDays = 0;
    this._panStartOffset = 0;
    
    this.setupEventHandlers();
  }

  static get observedAttributes() {
    return ['data', 'options', 'width', 'height', 'view-days'];
  }

  connectedCallback() {
    this.render();
    this.setupResizeObserver();
    this.setupThemeObserver();
    this.setupPanningEvents();
  }

  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    this.removePanningEvents();
    this.removeLogScaleButtonEvents();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    const handlers = {
      'data': () => {
        try { this._data = JSON.parse(newValue); this.resetPanState(); this.updateChart(); } 
        catch(e) { console.error('Invalid data JSON:', e); }
      },
      'options': () => {
        try { this._options = { ...this._options, ...JSON.parse(newValue) }; this.updateChart(); } 
        catch(e) { console.error('Invalid options JSON:', e); }
      },
      'width': () => this.updateChart(),
      'height': () => this.updateChart(),
      'view-days': () => {
        const viewDays = parseInt(newValue) || 0;
        this._options.viewDays = viewDays;
        this._originalViewDays = viewDays;
        this.resetPanState();
        this.updateChart();
      }
    };
    
    if (handlers[name]) handlers[name]();
  }

  set data(value) { this._data = value; this.resetPanState(); this.updateChart(); }
  get data() { return this._data; }
  set options(value) { 
    this._options = { ...this._defaultOptions, ...value }; 
    if (value.viewDays !== undefined) this._originalViewDays = value.viewDays;
    this.updateChart();
  }
  get options() { return this._options || this._defaultOptions; }

  setupEventHandlers() {
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerEnter = this.handlePointerEnter.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.toggleLogScale = this.toggleLogScale.bind(this);
  }

  setupResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => {
      if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
      this._animationFrame = requestAnimationFrame(() => this.updateChart());
    });
    this._resizeObserver.observe(this);
  }

  setupThemeObserver() {
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          if (isDark !== this._isDark) {
            this._isDark = isDark;
            this.updateChart();
          }
        }
      });
    }).observe(document.documentElement, { attributes: true });
  }

  setupLogScaleButton() {
    if (this.logScaleBtn) {
      this.logScaleBtn.addEventListener('click', this.toggleLogScale);
    }
  }

  removeLogScaleButtonEvents() {
    if (this.logScaleBtn) {
      this.logScaleBtn.removeEventListener('click', this.toggleLogScale);
    }
  }

  toggleLogScale(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this._options.logScale = !this._options.logScale;
    
    if (this.logScaleBtn) {
      this.logScaleBtn.textContent = this._options.logScale ? 'LOG' : 'LINEAR';
    }
    
    this.dispatchEvent(new CustomEvent('scale-click', {
      bubbles: true,
      composed: true,
      detail: {
        logScale: this._options.logScale,
        timestamp: Date.now(),
        element: this
      }
    }));
    
    this.updateChart();
  }

  setupPanningEvents() {
    if (!this.svg) return;
    
    const style = document.createElement('style');
    style.textContent = `.chart-container.panning { cursor: grabbing !important; touch-action: none; }
                         .chart-container.pan-ready { cursor: grab !important; }
                         .chart-container.pan-ready:hover { cursor: grab !important; }`;
    this.shadowRoot.appendChild(style);
    
    this.svg.addEventListener('pointerenter', this.handlePointerEnter);
    this.svg.addEventListener('pointerleave', this.handlePointerLeave);
    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handlePointerMove);
    this.svg.addEventListener('pointerup', this.handlePointerUp);
    this.svg.addEventListener('pointercancel', this.handlePointerUp);
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  removePanningEvents() {
    if (!this.svg) return;
    
    this.svg.removeEventListener('pointerenter', this.handlePointerEnter);
    this.svg.removeEventListener('pointerleave', this.handlePointerLeave);
    this.svg.removeEventListener('pointerdown', this.handlePointerDown);
    this.svg.removeEventListener('pointermove', this.handlePointerMove);
    this.svg.removeEventListener('pointerup', this.handlePointerUp);
    this.svg.removeEventListener('pointercancel', this.handlePointerUp);
  }

  handlePointerEnter(event) {
    if (this._options.viewDays > 0) {
      this.container.classList.add('pan-ready');
    }
  }

  handlePointerLeave(event) {
    this.container.classList.remove('pan-ready', 'panning');
  }

  handlePointerDown(event) {
    if (this._options.viewDays <= 0 || event.button !== 0) return;
    event.preventDefault();
    event.target.setPointerCapture(event.pointerId);
    this.startPan(event.clientX);
  }

  handlePointerMove(event) {
    if (!this._isPanning || this._options.viewDays <= 0) return;
    event.preventDefault();
    this.updatePan(event.clientX);
  }

  handlePointerUp(event) {
    if (!this._isPanning) return;
    event.preventDefault();
    this.endPan();
  }

  startPan(clientX) {
    this._isPanning = true;
    this._panStartX = clientX;
    this._panStartOffset = this._panOffset || 0;
    
    const totalDays = getTotalDataDays(this._data);
    this._maxPanOffset = Math.max(0, totalDays - this._originalViewDays);
    
    this.container.classList.remove('pan-ready');
    this.container.classList.add('panning');
  }

  updatePan(clientX) {
    const deltaX = clientX - this._panStartX;
    const chartWidth = this.container.clientWidth - this._options.padding.left - this._options.padding.right;
    
    const daysPerPixel = this._maxPanOffset / chartWidth;
    
    let newOffset = this._panStartOffset + (deltaX * daysPerPixel);
    newOffset = Math.max(0, Math.min(this._maxPanOffset, newOffset));
    
    this._panOffset = newOffset;
    this._options.viewDays = this._originalViewDays;
    this.updateChart();
  }

  endPan() {
    this._isPanning = false;
    
    this.container.classList.remove('panning');
    if (this._options.viewDays > 0) {
      this.container.classList.add('pan-ready');
    }
  }


  drawShadingRect(gridGroup, band, minDate, maxDate, xScale, padding, chartWidth, chartHeight) {
    const visibleStart = band.start < minDate ? minDate : band.start;
    const visibleEnd   = band.end   > maxDate ? maxDate : band.end;
    
    const xStart = padding.left + xScale(visibleStart);
    const xEnd   = padding.left + xScale(visibleEnd);
    const w = xEnd - xStart;
    
    if (w <= 0 || xStart > padding.left + chartWidth || xEnd < padding.left) return;
    
    gridGroup.appendChild(this.createElement('rect', {
      x: Math.max(padding.left, xStart),
      y: padding.top,
      width: Math.min(chartWidth, w - Math.max(0, padding.left - xStart)),
      height: chartHeight,
      fill: 'currentColor',
      'fill-opacity': '0.1',
    }));
  }

  resetPanState() {
    this._panOffset = 0;
    this._isPanning = false;
    this._originalViewDays = this._options.viewDays;
    
    if (this.container) this.container.classList.remove('panning', 'pan-ready');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; width: 100%; height: 100%; font-family: system-ui, -apple-system, sans-serif; }
        .chart-container { width: 100%; height: 100%; overflow: hidden; cursor: default; touch-action: pan-y pinch-zoom; }
        svg { width: 100%; height: 100%; display: block; user-select: none; touch-action: none; }
        .grid-line { stroke: currentColor; stroke-opacity: 0.2; stroke-width: 1; }
        .axis-line { stroke: currentColor; stroke-opacity: 0.5; stroke-width: 1.5; }
        .axis-text { fill: currentColor; font-size: 12px; opacity: 0.7; user-select: none; pointer-events: none; }
        .chart-line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .chart-point { fill: white; stroke-width: 2; cursor: pointer; transition: r 0.2s ease; }
        .chart-point:hover { r: 6; }
        .chart-area { fill-opacity: 0.1; }
        .tooltip { position: absolute; background: var(--tooltip-bg, rgba(0, 0, 0, 0.8)); color: var(--tooltip-color, white);
          padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
          white-space: nowrap; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .no-data { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          color: var(--no-data-color, #9ca3af); font-size: 14px; text-align: center; display: none; }
        .chart-clip { clip-path: url(#chartClip); }
        
        .log-scale-container { position: absolute; bottom: 5px; left: 10px; z-index: 10; }
        .log-scale-btn { 
          font-size: 10px;
          color: #4f46e5;
          font-weight: 900;
          border: none;
          outline: 1px solid rgba(79, 70, 229, 0.2);
          outline-offset: 0;
          padding: 2px 4px;
          border-radius: 4px;
          cursor: pointer; 
          transition: all 0.2s ease;
          font-family: inherit;
          background: transparent;
          backdrop-filter: blur(4px);
          background-color: rgba(255, 255, 255, 0.8);
        }
        .log-scale-btn:hover { 
          background-color: rgba(79, 70, 229, 0.05);
          outline-color: rgba(79, 70, 229, 0.4);
          transform: translateY(-1px);
        }
        .log-scale-btn:active { transform: translateY(0); }
        
        :host-context(.dark) .log-scale-btn {
          color: #818cf8;
          background-color: rgba(0, 0, 0, 0.8);
          outline-color: rgba(129, 140, 248, 0.2);
        }
        :host-context(.dark) .log-scale-btn:hover {
          background-color: rgba(79, 70, 229, 0.1);
          outline-color: rgba(129, 140, 248, 0.4);
        }
      </style>
      <div class="chart-container">
        <svg id="chart-svg"></svg>
        <div class="tooltip" id="tooltip"></div>
        <div class="no-data" id="no-data">No data to display</div>
        <div class="log-scale-container">
          <button class="log-scale-btn" id="log-scale-btn">${this._options.logScale ? 'LOG' : 'LINEAR'}</button>
        </div>
      </div>
    `;
    
    this.container = this.shadowRoot.querySelector('.chart-container');
    this.svg = this.shadowRoot.getElementById('chart-svg');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.noData = this.shadowRoot.getElementById('no-data');
    this.logScaleBtn = this.shadowRoot.getElementById('log-scale-btn');
    
    this.setupLogScaleButton();
  }

  updateChart() {
    if (!this.svg) return;
    
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    
    if (!this._data?.datasets?.length) {
      this.noData.style.display = 'block';
      return;
    }
    
    this.noData.style.display = 'none';
    
    const width      = this.container.clientWidth  || parseInt(this.getAttribute('width'))  || 600;
    const height     = this.container.clientHeight || parseInt(this.getAttribute('height')) || 400;
    const padding = this._options.padding;
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);
    
    const allPoints = this._data.datasets.flatMap(dataset => 
      dataset.data?.filter(p => p.x && p.y !== undefined) || []
    );
    
    if (!allPoints.length) {
      this.noData.style.display = 'block';
      return;
    }
    
    const xScale = this.createXScale(allPoints, chartWidth);
    const yScale = this.createYScale(allPoints, chartHeight);
    
    const dims    = { width, height, chartWidth, chartHeight, padding };

    this.createClipPath(padding, chartWidth, chartHeight);
    
    if (this._options.grid.show || this._options.axis.show)
      this.drawAxesGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints);
    
    const chartContentGroup = this.createElement('g', { class: 'chart-clip' });
    this.svg.appendChild(chartContentGroup);
    
    this._data.datasets.forEach((dataset, index) => {
      if (!dataset.data?.length) return;
      
      const color = dataset.borderColor || this._options.colors[index % this._options.colors.length];
      const points = dataset.data.filter(p => p.x && p.y !== undefined);
      
      if (points.length > 0) {
        this.drawLine(points, xScale, yScale, padding, {
          color,
          width: dataset.borderWidth || this._options.lineWidth,
          tension: dataset.tension || this._options.tension,
          dash: dataset.borderDash || []
        }, chartContentGroup);
        
        if (this._options.showPoints && !dataset.hidePoints) {
          this.drawPoints(points, xScale, yScale, dims, {
            color,
            radius: dataset.pointRadius || this._options.pointRadius,
            datasetIndex: index,
            label: dataset.label || `Dataset ${index + 1}`
          }, chartContentGroup);
        }
      }
    });
    
    if (this.logScaleBtn) {
      this.logScaleBtn.textContent = this._options.logScale ? 'LOG' : 'LINEAR';
    }
  }

  createClipPath(padding, chartWidth, chartHeight) {
    const clipPath = this.createElement('clipPath', { id: 'chartClip' });
    
    const clipRect = this.createElement('rect', {
      x: padding.left,
      y: padding.top,
      width: chartWidth,
      height: chartHeight
    });
    
    clipPath.appendChild(clipRect);
    this.svg.appendChild(clipPath);
  }

  createXScale(points, chartWidth) {
    return createXScale(points, chartWidth, this._options.viewDays, this._panOffset);
  }

  createYScale(points, chartHeight) {
    return createYScale(points, chartHeight, this._options.logScale);
  }

  drawAxesGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints) {
    const { minDate, maxDate, mode, items } = getXAxisConfig(allPoints, this._options.viewDays, this._panOffset);
    const yValues = generateYValues(allPoints.map(p => p.y), 6, this._options.logScale);

    const showGrid = this._options.grid.show;
    const showAxis = this._options.axis.show;

    const addLine = (group, cls, attrs) => group.appendChild(this.createElement('line', { ...attrs, class: cls }));

    if (showGrid) {
      const gridGroup = this.createElement('g', { class: 'grid-group' });

      if (mode.startsWith('shade-')) {
        items
          .filter(band => band.isEven)
          .forEach(band => this.drawShadingRect(gridGroup, band, minDate, maxDate, xScale, padding, chartWidth, chartHeight));
      } else {
        items.forEach(({ date }) => {
          const x = padding.left + xScale(date);
          if (x >= padding.left && x <= padding.left + chartWidth) {
            addLine(gridGroup, 'grid-line', { x1: x, y1: padding.top, x2: x, y2: padding.top + chartHeight });
          }
        });
      }

      yValues.forEach(yValue => {
        const y = padding.top + yScale(yValue);
        addLine(gridGroup, 'grid-line', { x1: padding.left, y1: y, x2: padding.left + chartWidth, y2: y });
      });

      this.svg.appendChild(gridGroup);
    }

    if (showAxis) {
      const axisGroup = this.createElement('g', { class: 'axis-group' });
      const addText   = (attrs, txt) => {
        const el = this.createElement('text', { ...attrs, class: 'axis-text' });
        el.textContent = txt;
        return axisGroup.appendChild(el);
      };

      addLine(axisGroup, 'axis-line', { x1: padding.left, y1: padding.top + chartHeight, x2: padding.left + chartWidth, y2: padding.top + chartHeight });
      addLine(axisGroup, 'axis-line', { x1: padding.left, y1: padding.top,               x2: padding.left,              y2: padding.top + chartHeight });

      items.forEach(item => {
        const x = padding.left + xScale(item.label.pos);
        if (x < padding.left || x > padding.left + chartWidth) return;
        addText({ x, y: padding.top + chartHeight + 20, 'text-anchor': 'middle' }, item.label.text);
      });

      yValues.forEach(v => {
        const y = padding.top + yScale(v);
        addText({ x: padding.left + 20, y: y - 4, 'text-anchor': 'end' }, this.formatValue(v));
      });

      this.svg.appendChild(axisGroup);
    }
  }

  createElement(type, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  formatValue(value) {
    return formatValue(value, this._options.valueFormatter);
  }

  formatDate(date) {
    const [minDate, maxDate] = getVisibleDateRange(
      this._data?.datasets?.flatMap(d => d.data || []) || [],
      this._options.viewDays,
      this._panOffset
    );
    return formatDate(date, minDate, maxDate);
  }

  drawLine(points, xScale, yScale, padding, style, parentGroup) {
    if (points.length < 2) return;
    
    const pathData = generateSmoothPath(
      points, 
      xScale, yScale, 
      padding.left, padding.top, 
      style.tension
    );
    
    const path = this.createElement('path', {
      d: pathData, 
      stroke: style.color, 
      'stroke-width': style.width,
      'stroke-dasharray': style.dash.join(' '), 
      class: 'chart-line'
    });
    
    parentGroup.appendChild(path);
  }

  drawPoints(points, xScale, yScale, dims, style, parentGroup) {
    const { padding, chartWidth, chartHeight } = dims;
    const pointsGroup = this.createElement('g');
    
    points.forEach((point, index) => {
      const cx = padding.left + xScale(point.x);
      const cy = padding.top  + yScale(point.y);
      
      const circle = this.createElement('circle', {
        cx, cy, r: style.radius, stroke: style.color, fill: 'white', class: 'chart-point'
      });
      
      circle.addEventListener('mouseenter', (e) => {
        if (cx >= padding.left && cx <= padding.left + chartWidth &&
            cy >= padding.top  && cy <= padding.top  + chartHeight) {
          this.showTooltip(e, point, style.label, index);
        }
      });
      
      circle.addEventListener('mouseleave', () => this.hideTooltip());
      pointsGroup.appendChild(circle);
    });
    
    parentGroup.appendChild(pointsGroup);
  }

  showTooltip(event, point, label, index) {
    const formattedValue = this.formatValue(point.y);
    
    this.tooltip.innerHTML = `
      <div><strong>${label}</strong></div>
      <div>Date: ${this.formatDate(point.x)}</div>
      <div>Value: ${formattedValue}</div>
    `;
    
    this.tooltip.style.opacity = '1';
    
    const tooltipWidth  = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const containerRect = this.container.getBoundingClientRect();
    
    let left = event.clientX - containerRect.left + 10;
    let top  = event.clientY - containerRect.top  + 10;
    
    if (left + tooltipWidth  > containerRect.width)  left = event.clientX - containerRect.left - tooltipWidth  - 10;
    if (top  + tooltipHeight > containerRect.height) top  = event.clientY - containerRect.top  - tooltipHeight - 10;
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top  = `${top}px`;
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  // Public API
  destroy()                  { this.disconnectedCallback(); }
  resize(width, height)      { this.setAttribute('width', width); this.setAttribute('height', height); }
  updateData(newData)        { this.data = newData; }
  updateOptions(newOptions)  { this.options = newOptions; }
  clear()                    { this._data = { datasets: [] }; this.updateChart(); }
  resetPan()                 { this.resetPanState(); this.updateChart(); }
  panTo(offsetDays) {
    if (this._options.viewDays > 0) {
      const totalDays = getTotalDataDays(this._data);
      const maxOffset = Math.max(0, totalDays - this._originalViewDays);
      this._panOffset = Math.max(0, Math.min(maxOffset, offsetDays));
      this.updateChart();
    }
  }
}

customElements.define('chronos-chart', ChronosChart);
