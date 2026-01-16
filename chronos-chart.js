export class ChronosChart extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = [];
    this._datasets = [];
    this._defaultOptions = {
      type: 'line', xScale: 'time', yScale: 'linear', padding: { top: 40, right: 40, bottom: 60, left: 60 },
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
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
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

  setupPanningEvents() {
    if (!this.svg) return;
    
    const style = document.createElement('style');
    style.textContent = `.chart-container.panning { cursor: grabbing !important; }
                         .chart-container.pan-ready { cursor: grab !important; }
                         .chart-container.pan-ready:hover { cursor: grab !important; }`;
    this.shadowRoot.appendChild(style);
    
    this.svg.addEventListener('mouseenter', () => {
      if (this._options.viewDays > 0) {
        this.shadowRoot.querySelector('.chart-container').classList.add('pan-ready');
      }
    });
    
    this.svg.addEventListener('mouseleave', () => {
      this.shadowRoot.querySelector('.chart-container').classList.remove('pan-ready', 'panning');
    });
    
    // Use pointer events for unified input handling
    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handlePointerMove);
    this.svg.addEventListener('pointerup', this.handlePointerUp);
    this.svg.addEventListener('pointerleave', this.handlePointerUp);
  }

  removePanningEvents() {
    if (!this.svg) return;
    
    this.svg.removeEventListener('pointerdown', this.handlePointerDown);
    this.svg.removeEventListener('pointermove', this.handlePointerMove);
    this.svg.removeEventListener('pointerup', this.handlePointerUp);
    this.svg.removeEventListener('pointerleave', this.handlePointerUp);
  }

  handlePointerDown(event) {
    if (this._options.viewDays <= 0) return;
    
    event.preventDefault();
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

  handleTouchStart(event) {
    if (this._options.viewDays <= 0 || event.touches.length !== 1) return;
    
    event.preventDefault();
    this.startPan(event.touches[0].clientX);
  }

  handleTouchMove(event) {
    if (!this._isPanning || this._options.viewDays <= 0 || event.touches.length !== 1) return;
    
    event.preventDefault();
    this.updatePan(event.touches[0].clientX);
  }

  handleTouchEnd(event) {
    if (!this._isPanning) return;
    
    event.preventDefault();
    this.endPan();
  }

  startPan(clientX) {
    this._isPanning = true;
    this._panStartX = clientX;
    this._panStartOffset = this._panOffset || 0;
    
    const container = this.shadowRoot.querySelector('.chart-container');
    container.classList.remove('pan-ready');
    container.classList.add('panning');
  }

  updatePan(clientX) {
    const deltaX = clientX - this._panStartX;
    const container = this.shadowRoot.querySelector('.chart-container');
    const chartWidth = container.clientWidth - this._options.padding.left - this._options.padding.right;
    
    const totalDays = this.getTotalDataDays();
    const visibleDays = this._originalViewDays;
    this._maxPanOffset = Math.max(0, totalDays - visibleDays);
    
    const daysPerPixel = this._maxPanOffset / chartWidth;
    let newOffset = this._panStartOffset + (deltaX * daysPerPixel);
    newOffset = Math.max(0, Math.min(this._maxPanOffset, newOffset));
    
    this._panOffset = newOffset;
    this._options.viewDays = visibleDays;
    this.updateChart();
  }

  endPan() {
    this._isPanning = false;
    
    const container = this.shadowRoot.querySelector('.chart-container');
    container.classList.remove('panning');
    if (this._options.viewDays > 0) {
      container.classList.add('pan-ready');
    }
  }

  getTotalDataDays() {
    if (!this._data?.datasets?.length) return 0;
    
    const allPoints = this._data.datasets.flatMap(dataset => 
      dataset.data?.filter(p => p.x && p.y !== undefined) || []
    );
    
    if (allPoints.length === 0) return 0;
    
    const dates = allPoints.map(p => this.parseDate(p.x));
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    
    return (maxDate - minDate) / (24 * 60 * 60 * 1000);
  }

  resetPanState() {
    this._panOffset = 0;
    this._isPanning = false;
    this._originalViewDays = this._options.viewDays;
    
    const container = this.shadowRoot.querySelector('.chart-container');
    if (container) container.classList.remove('panning', 'pan-ready');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; width: 100%; height: 100%; font-family: system-ui, -apple-system, sans-serif; }
        .chart-container { width: 100%; height: 100%; overflow: hidden; cursor: default; }
        svg { width: 100%; height: 100%; display: block; user-select: none; }
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
      </style>
      <div class="chart-container">
        <svg id="chart-svg"></svg>
        <div class="tooltip" id="tooltip"></div>
        <div class="no-data" id="no-data">No data to display</div>
      </div>
    `;
    
    this.svg = this.shadowRoot.getElementById('chart-svg');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.noData = this.shadowRoot.getElementById('no-data');
  }

  updateChart() {
    if (!this.svg) return;
    
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    
    if (!this._data?.datasets?.length) {
      this.noData.style.display = 'block';
      return;
    }
    
    this.noData.style.display = 'none';
    
    const container = this.shadowRoot.querySelector('.chart-container');
    const width = container.clientWidth || parseInt(this.getAttribute('width')) || 600;
    const height = container.clientHeight || parseInt(this.getAttribute('height')) || 400;
    const padding = this._options.padding;
    const chartWidth = Math.max(0, width - padding.left - padding.right);
    const chartHeight = Math.max(0, height - padding.top - padding.bottom);
    
    const allPoints = this._data.datasets.flatMap(dataset => 
      dataset.data?.filter(p => p.x && p.y !== undefined) || []
    );
    
    if (allPoints.length === 0) {
      this.noData.style.display = 'block';
      return;
    }
    
    const xScale = this.createXScale(allPoints, chartWidth);
    const yScale = this.createYScale(allPoints, chartHeight);
    
    this.createClipPath(padding, chartWidth, chartHeight);
    
    if (this._options.grid.show) this.drawGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints);
    if (this._options.axis.show) this.drawAxes(xScale, yScale, chartWidth, chartHeight, padding, allPoints);
    
    const chartContentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartContentGroup.classList.add('chart-clip');
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
          this.drawPoints(points, xScale, yScale, padding, {
            color,
            radius: dataset.pointRadius || this._options.pointRadius,
            datasetIndex: index,
            label: dataset.label || `Dataset ${index + 1}`
          }, chartContentGroup);
        }
      }
    });
  }

  createClipPath(padding, chartWidth, chartHeight) {
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', 'chartClip');
    
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', padding.left);
    clipRect.setAttribute('y', padding.top);
    clipRect.setAttribute('width', chartWidth);
    clipRect.setAttribute('height', chartHeight);
    
    clipPath.appendChild(clipRect);
    this.svg.appendChild(clipPath);
  }

  createXScale(points, chartWidth) {
    const xValues = points.map(p => this.parseDate(p.x));
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    
    let visibleMinX = minX;
    let visibleMaxX = maxX;
    
    if (this._options.viewDays > 0) {
      const visibleRangeMs = this._options.viewDays * 24 * 60 * 60 * 1000;
      const panOffsetMs = (this._panOffset || 0) * 24 * 60 * 60 * 1000;
      
      visibleMaxX = maxX - panOffsetMs;
      visibleMinX = Math.max(minX, visibleMaxX - visibleRangeMs);
      
      if (visibleMinX < minX) {
        visibleMinX = minX;
        visibleMaxX = Math.min(maxX, visibleMinX + visibleRangeMs);
      }
    }
    
    const dateRangeDays = (visibleMaxX - visibleMinX) / (24 * 60 * 60 * 1000);
    let tickDates = [];
    
    if (dateRangeDays > 90 && dateRangeDays <= 365) {
      const startDate = new Date(visibleMinX);
      const endDate = new Date(visibleMaxX);
      const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      
      let currentDate = new Date(firstDate);
      while (currentDate <= endDate) {
        tickDates.push(currentDate.getTime());
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    }
    
    return (date) => {
      let x = this.parseDate(date);
      
      if (tickDates.length > 0) {
        const tolerance = 2 * 24 * 60 * 60 * 1000;
        const matchingTick = tickDates.find(tick => Math.abs(tick - x) < tolerance);
        if (matchingTick) x = matchingTick;
      }
      
      return ((x - visibleMinX) / (visibleMaxX - visibleMinX)) * chartWidth;
    };
  }

  createYScale(points, chartHeight) {
    const yValues = points.map(p => p.y);
    let minY = Math.min(...yValues);
    let maxY = Math.max(...yValues);
    
    const displayYValues = this.generateYValues(points, 6);
    minY = Math.min(...displayYValues);
    maxY = Math.max(...displayYValues);
    
    if (minY === maxY) return (y) => chartHeight / 2;
    
    if (this._options.logScale && minY > 0) {
      minY = Math.log10(minY);
      maxY = Math.log10(maxY);
      return (y) => {
        if (y <= 0) return chartHeight;
        const logY = Math.log10(y);
        return chartHeight - ((logY - minY) / (maxY - minY)) * chartHeight;
      };
    }
    
    return (y) => chartHeight - ((y - minY) / (maxY - minY)) * chartHeight;
  }

  parseDate(dateValue) {
    if (typeof dateValue === 'number') return dateValue;
    if (typeof dateValue === 'string') {
      const parsed = Date.parse(dateValue);
      if (!isNaN(parsed)) return parsed;
    }
    return Date.now();
  }

  drawGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints) {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.classList.add('grid-group');
    
    const yValues = this.generateYValues(allPoints, 6);
    
    const dates = allPoints.map(p => this.parseDate(p.x));
    let minDate = Math.min(...dates);
    let maxDate = Math.max(...dates);
    
    if (this._options.viewDays > 0 && this._panOffset) {
      const visibleRangeMs = this._options.viewDays * 24 * 60 * 60 * 1000;
      const panOffsetMs = this._panOffset * 24 * 60 * 60 * 1000;
      maxDate = Math.max(...dates) - panOffsetMs;
      minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
    } else if (this._options.viewDays > 0) {
      maxDate = Math.max(...dates);
      minDate = maxDate - (this._options.viewDays * 24 * 60 * 60 * 1000);
    }
    
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    let tickDates = [];
    
    if (dateRangeDays > 90 && dateRangeDays <= 365) {
      const startDate = new Date(minDate);
      const endDate = new Date(maxDate);
      const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      
      let currentDate = new Date(firstDate);
      while (currentDate <= endDate) {
        tickDates.push(currentDate.getTime());
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
      
      tickDates.forEach((tickDate) => {
        const x = padding.left + xScale(tickDate);
        
        if (x >= padding.left && x <= padding.left + chartWidth) {
          const line = this.createElement('line', {
            x1: x, y1: padding.top, x2: x, y2: padding.top + chartHeight,
            class: 'grid-line'
          });
          gridGroup.appendChild(line);
        }
      });
    } else {
      for (let i = 0; i < 8; i++) {
        const tickDate = minDate + (i / 7) * (maxDate - minDate);
        const x = padding.left + xScale(tickDate);
        
        if (x >= padding.left && x <= padding.left + chartWidth) {
          const line = this.createElement('line', {
            x1: x, y1: padding.top, x2: x, y2: padding.top + chartHeight,
            class: 'grid-line'
          });
          gridGroup.appendChild(line);
        }
      }
    }
    
    yValues.forEach((yValue) => {
      if (yValue !== undefined) {
        const y = padding.top + yScale(yValue);
        const line = this.createElement('line', {
          x1: padding.left, y1: y, x2: padding.left + chartWidth, y2: y,
          class: 'grid-line'
        });
        gridGroup.appendChild(line);
      }
    });
    
    this.svg.appendChild(gridGroup);
  }

  drawAxes(xScale, yScale, chartWidth, chartHeight, padding, points) {
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    axisGroup.classList.add('axis-group');
    
    const xAxis = this.createElement('line', {
      x1: padding.left, y1: padding.top + chartHeight,
      x2: padding.left + chartWidth, y2: padding.top + chartHeight,
      class: 'axis-line'
    });
    
    const yAxis = this.createElement('line', {
      x1: padding.left, y1: padding.top,
      x2: padding.left, y2: padding.top + chartHeight,
      class: 'axis-line'
    });
    
    axisGroup.appendChild(xAxis);
    axisGroup.appendChild(yAxis);
    
    const dates = points.map(p => this.parseDate(p.x));
    let minDate = Math.min(...dates);
    let maxDate = Math.max(...dates);
    
    if (this._options.viewDays > 0 && this._panOffset) {
      const visibleRangeMs = this._options.viewDays * 24 * 60 * 60 * 1000;
      const panOffsetMs = this._panOffset * 24 * 60 * 60 * 1000;
      maxDate = Math.max(...dates) - panOffsetMs;
      minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
    } else if (this._options.viewDays > 0) {
      maxDate = Math.max(...dates);
      minDate = maxDate - (this._options.viewDays * 24 * 60 * 60 * 1000);
    }
    
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    let tickDates = [];
    
    if (dateRangeDays > 90 && dateRangeDays <= 365) {
      const startDate = new Date(minDate);
      const endDate = new Date(maxDate);
      const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      
      let currentDate = new Date(firstDate);
      while (currentDate <= endDate) {
        tickDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
      
      tickDates.forEach((date) => {
        const x = padding.left + xScale(date.getTime());
        const text = this.createElement('text', {
          x, y: padding.top + chartHeight + 20,
          'text-anchor': 'middle', class: 'axis-text'
        });
        text.textContent = this.formatDate(date);
        axisGroup.appendChild(text);
      });
    } else {
      const xLabels = this.generateXLabels(points, 8);
      xLabels.forEach((label, i) => {
        const tickDate = minDate + (i / (xLabels.length - 1)) * (maxDate - minDate);
        const x = padding.left + xScale(tickDate);
        const text = this.createElement('text', {
          x, y: padding.top + chartHeight + 20,
          'text-anchor': 'middle', class: 'axis-text'
        });
        text.textContent = label;
        axisGroup.appendChild(text);
      });
    }
    
    const yValues = this.generateYValues(points, 6);
    yValues.forEach((yValue) => {
      const y = padding.top + yScale(yValue);
      const text = this.createElement('text', {
        x: padding.left - 10, y: y + 4,
        'text-anchor': 'end', class: 'axis-text'
      });
      text.textContent = this.formatValue(yValue);
      axisGroup.appendChild(text);
    });
    
    this.svg.appendChild(axisGroup);
  }

  createElement(type, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', type);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  generateXLabels(points, count) {
    if (points.length === 0) return Array(count).fill('');
    
    const dates = points.map(p => this.parseDate(p.x));
    let minDate = Math.min(...dates);
    let maxDate = Math.max(...dates);
    
    if (this._options.viewDays > 0 && this._panOffset) {
      const visibleRangeMs = this._options.viewDays * 24 * 60 * 60 * 1000;
      const panOffsetMs = this._panOffset * 24 * 60 * 60 * 1000;
      maxDate = Math.max(...dates) - panOffsetMs;
      minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
    } else if (this._options.viewDays > 0) {
      maxDate = Math.max(...dates);
      minDate = maxDate - (this._options.viewDays * 24 * 60 * 60 * 1000);
    }
    
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    
    if (dateRangeDays > 90 && dateRangeDays <= 365) {
      return this.generateMonthlyTicks(minDate, maxDate);
    }
    
    const labels = [];
    for (let i = 0; i < count; i++) {
      const date = new Date(minDate + (i / (count - 1)) * (maxDate - minDate));
      labels.push(this.formatDate(date));
    }
    
    return labels;
  }

  generateMonthlyTicks(startDateMs, endDateMs) {
    const startDate = new Date(startDateMs);
    const endDate = new Date(endDateMs);
    const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    const monthlyDates = [];
    let currentDate = new Date(firstDate);
    
    while (currentDate <= endDate) {
      monthlyDates.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);
    }
    
    const filteredDates = monthlyDates.filter(date => {
      const dateMs = date.getTime();
      return dateMs >= startDateMs - (30 * 24 * 60 * 60 * 1000) && 
             dateMs <= endDateMs + (30 * 24 * 60 * 60 * 1000);
    });
    
    return filteredDates.map(date => this.formatDate(date));
  }

  generateYValues(points, count) {
    if (points.length === 0) return Array(count).fill(0);
    
    const values = points.map(p => p.y);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    
    if (minVal === maxVal) {
      minVal = minVal > 0 ? minVal * 0.9 : minVal - 1;
      maxVal = maxVal > 0 ? maxVal * 1.1 : maxVal + 1;
    }

    if (this._options.logScale && minVal > 0) {
      const logMin = Math.floor(Math.log10(minVal));
      const logMax = Math.log10(maxVal);
      
      let ticks = [];
      const multiples = [1, 2, 5, 10];
      
      for (let d = logMin; d < Math.ceil(logMax); d++) {
        multiples.forEach(m => {
          const val = Math.pow(10, d) * m;
          const prevMultipleValue = ticks.length > 0 ? ticks[ticks.length - 1] : 0;
          
          if (val >= Math.pow(10, logMin) && prevMultipleValue < maxVal) {
            ticks.push(val);
          }
        });
      }

      return [...new Set(ticks)].sort((a, b) => a - b);
    }

    const rawStep = (maxVal - minVal) / (count - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const res = rawStep / magnitude;
    
    let niceStep;
    if (res < 1.5) niceStep = 1;
    else if (res < 3) niceStep = 2;
    else if (res < 7) niceStep = 5;
    else niceStep = 10;
    niceStep *= magnitude;

    const graphMin = Math.floor(minVal / niceStep) * niceStep;
    const graphMax = Math.ceil(maxVal / niceStep) * niceStep;

    const result = [];
    for (let v = graphMin; v <= graphMax + niceStep * 0.0001; v += niceStep) {
      result.push(v);
    }
    
    return result;
  }

  formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    
    const dates = this._data?.datasets?.flatMap(d => d.data?.map(p => this.parseDate(p.x)) || []) || [];
    let minDate = Math.min(...dates);
    let maxDate = Math.max(...dates);
    
    if (this._options.viewDays > 0 && this._panOffset) {
      const visibleRangeMs = this._options.viewDays * 24 * 60 * 60 * 1000;
      const panOffsetMs = this._panOffset * 24 * 60 * 60 * 1000;
      maxDate = Math.max(...dates) - panOffsetMs;
      minDate = Math.max(Math.min(...dates), maxDate - visibleRangeMs);
    } else if (this._options.viewDays > 0) {
      maxDate = Math.max(...dates);
      minDate = maxDate - (this._options.viewDays * 24 * 60 * 60 * 1000);
    }
    
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    const isFirstOfMonth = date.getDate() === 1;
    
    if (dateRangeDays <= 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else if (dateRangeDays <= 30) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (dateRangeDays <= 90) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (dateRangeDays <= 365) {
      if (isFirstOfMonth) {
        return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
      } else {
        return date.toLocaleDateString([], { month: 'short' });
      }
    } else {
      return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
    }
  }

  formatValue(value) {
    if (this._options.valueFormatter) return this._options.valueFormatter(value);
    
    const roundedValue = Math.round(value * 1e10) / 1e10;
    
    if (Math.abs(roundedValue) >= 1000000) {
      return (roundedValue / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
    }
    if (Math.abs(roundedValue) >= 1000) {
      return (roundedValue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
    }
    
    return roundedValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  drawLine(points, xScale, yScale, padding, style, parentGroup) {
    if (points.length < 2) return;
    
    const pathGroup = this.createElement('g');
    let pathData = `M ${padding.left + xScale(points[0].x)} ${padding.top + yScale(points[0].y)}`;
    
    if (style.tension > 0 && points.length > 2) {
      for (let i = 1; i < points.length; i++) {
        const x0 = padding.left + xScale(points[Math.max(0, i - 2)].x);
        const y0 = padding.top + yScale(points[Math.max(0, i - 2)].y);
        const x1 = padding.left + xScale(points[i - 1].x);
        const y1 = padding.top + yScale(points[i - 1].y);
        const x2 = padding.left + xScale(points[i].x);
        const y2 = padding.top + yScale(points[i].y);
        const x3 = padding.left + xScale(points[Math.min(points.length - 1, i + 1)].x);
        const y3 = padding.top + yScale(points[Math.min(points.length - 1, i + 1)].y);
        
        const cp1x = x1 + (x2 - x0) / 6 * style.tension;
        const cp1y = y1 + (y2 - y0) / 6 * style.tension;
        const cp2x = x2 - (x3 - x1) / 6 * style.tension;
        const cp2y = y2 - (y3 - y1) / 6 * style.tension;
        
        pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      }
    } else {
      for (let i = 1; i < points.length; i++) {
        pathData += ` L ${padding.left + xScale(points[i].x)} ${padding.top + yScale(points[i].y)}`;
      }
    }
    
    const path = this.createElement('path', {
      d: pathData, stroke: style.color, 'stroke-width': style.width,
      'stroke-dasharray': style.dash.join(' '), class: 'chart-line'
    });
    
    pathGroup.appendChild(path);
    parentGroup.appendChild(pathGroup);
  }

  drawPoints(points, xScale, yScale, padding, style, parentGroup) {
    const pointsGroup = this.createElement('g');
    
    points.forEach((point, index) => {
      const cx = padding.left + xScale(point.x);
      const cy = padding.top + yScale(point.y);
      
      const circle = this.createElement('circle', {
        cx, cy, r: style.radius, stroke: style.color, fill: 'white', class: 'chart-point'
      });
      
      circle.addEventListener('mouseenter', (e) => {
        const padding = this._options.padding;
        const container = this.shadowRoot.querySelector('.chart-container');
        const chartWidth = container.clientWidth - padding.left - padding.right;
        const chartHeight = container.clientHeight - padding.top - padding.bottom;
        
        if (cx >= padding.left && cx <= padding.left + chartWidth &&
            cy >= padding.top && cy <= padding.top + chartHeight) {
          this.showTooltip(e, point, style.label, index);
        }
      });
      
      circle.addEventListener('mouseleave', () => this.hideTooltip());
      pointsGroup.appendChild(circle);
    });
    
    parentGroup.appendChild(pointsGroup);
  }

  showTooltip(event, point, label, index) {
    const formattedDate = new Date(this.parseDate(point.x)).toLocaleString();
    const formattedValue = this.formatValue(point.y);
    
    this.tooltip.innerHTML = `
      <div><strong>${label}</strong></div>
      <div>Date: ${formattedDate}</div>
      <div>Value: ${formattedValue}</div>
    `;
    
    this.tooltip.style.opacity = '1';
    
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const container = this.shadowRoot.querySelector('.chart-container');
    const containerRect = container.getBoundingClientRect();
    
    let left = event.clientX - containerRect.left + 10;
    let top = event.clientY - containerRect.top + 10;
    
    if (left + tooltipWidth > containerRect.width) left = event.clientX - containerRect.left - tooltipWidth - 10;
    if (top + tooltipHeight > containerRect.height) top = event.clientY - containerRect.top - tooltipHeight - 10;
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  // Public API methods
  destroy() { this.disconnectedCallback(); }
  resize(width, height) { this.setAttribute('width', width); this.setAttribute('height', height); }
  updateData(newData) { this.data = newData; }
  updateOptions(newOptions) { this.options = newOptions; }
  clear() { this._data = { datasets: [] }; this.updateChart(); }
  resetPan() { this.resetPanState(); this.updateChart(); }
  panTo(offsetDays) {
    if (this._options.viewDays > 0) {
      const totalDays = this.getTotalDataDays();
      const maxOffset = Math.max(0, totalDays - this._originalViewDays);
      this._panOffset = Math.max(0, Math.min(maxOffset, offsetDays));
      this.updateChart();
    }
  }
}

customElements.define('chronos-chart', ChronosChart);