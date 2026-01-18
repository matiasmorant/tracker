import { 
  parseDate, 
  formatValue, 
  formatDate,
  getMonthIndex,
  generateYValues, 
  generateXLabels,
  generateMonthlyTickDates,
  getTotalDataDays,
  createXScale,
  createYScale,
  getVisibleDateRange,
  generateSmoothPath 
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
    this.setupLogScaleButton();
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
    // Unified pointer event handlers
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerEnter = this.handlePointerEnter.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    
    // Log scale button handler
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
    if (this.shadowRoot) {
      const logScaleButton = this.shadowRoot.getElementById('log-scale-btn');
      if (logScaleButton) {
        logScaleButton.addEventListener('click', this.toggleLogScale);
      }
    }
  }

  removeLogScaleButtonEvents() {
    if (this.shadowRoot) {
      const logScaleButton = this.shadowRoot.getElementById('log-scale-btn');
      if (logScaleButton) {
        logScaleButton.removeEventListener('click', this.toggleLogScale);
      }
    }
  }

  toggleLogScale(event) {
    // Prevent default to avoid any native button behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Toggle the log scale state
    this._options.logScale = !this._options.logScale;
    
    // Update button text
    const logScaleButton = this.shadowRoot.getElementById('log-scale-btn');
    if (logScaleButton) {
      logScaleButton.textContent = this._options.logScale?'LOG':'LINEAR';
    }
    
    // Dispatch custom event for Alpine.js or other frameworks
    this.dispatchEvent(new CustomEvent('scale-click', {
      bubbles: true,
      composed: true,
      detail: {
        logScale: this._options.logScale,
        timestamp: Date.now(),
        element: this
      }
    }));
    
    // Update the chart
    this.updateChart();
  }

  setupPanningEvents() {
    if (!this.svg) return;
    
    const style = document.createElement('style');
    style.textContent = `.chart-container.panning { cursor: grabbing !important; touch-action: none; }
                         .chart-container.pan-ready { cursor: grab !important; }
                         .chart-container.pan-ready:hover { cursor: grab !important; }`;
    this.shadowRoot.appendChild(style);
    
    // Unified pointer events (works for mouse, touch, pen)
    this.svg.addEventListener('pointerenter', this.handlePointerEnter);
    this.svg.addEventListener('pointerleave', this.handlePointerLeave);
    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handlePointerMove);
    this.svg.addEventListener('pointerup', this.handlePointerUp);
    this.svg.addEventListener('pointercancel', this.handlePointerUp);
    
    // Prevent context menu on touch devices for better UX
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
      this.shadowRoot.querySelector('.chart-container').classList.add('pan-ready');
    }
  }

  handlePointerLeave(event) {
    this.shadowRoot.querySelector('.chart-container').classList.remove('pan-ready', 'panning');
  }

  handlePointerDown(event) {
    if (this._options.viewDays <= 0 || event.button !== 0) return;
    
    // Prevent default to avoid text selection and improve touch behavior
    event.preventDefault();
    
    // Set pointer capture for consistent behavior across devices
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
    return getTotalDataDays(this._data);
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
        
        /* Log scale button styles - matching Tailwind: text-[10px] text-indigo-600 dark:text-indigo-400 font-black ring-1 ring-indigo-600/20 px-1 rounded */
        .log-scale-container { position: absolute; bottom: 5px; left: 10px; z-index: 10; }
        .log-scale-btn { 
          font-size: 10px;
          color: #4f46e5; /* text-indigo-600 */
          font-weight: 900; /* font-black */
          border: none;
          outline: 1px solid rgba(79, 70, 229, 0.2); /* ring-1 ring-indigo-600/20 */
          outline-offset: 0;
          padding: 2px 4px; /* px-1 */
          border-radius: 4px; /* rounded */
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
        .log-scale-btn:active { 
          transform: translateY(0); 
        }
        
        /* Dark mode support for log scale button */
        :host-context(.dark) .log-scale-btn {
          color: #818cf8; /* dark:text-indigo-400 */
          background-color: rgba(0, 0, 0, 0.8);
          outline-color: rgba(129, 140, 248, 0.2); /* ring-indigo-600/20 in dark mode */
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
          <button class="log-scale-btn" id="log-scale-btn">${this._options.logScale?'LOG':'LINEAR'}</button>
        </div>
      </div>
    `;
    
    this.svg = this.shadowRoot.getElementById('chart-svg');
    this.tooltip = this.shadowRoot.getElementById('tooltip');
    this.noData = this.shadowRoot.getElementById('no-data');
    
    // Setup log scale button events
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
    
    // Update log scale button text
    const logScaleButton = this.shadowRoot.getElementById('log-scale-btn');
    if (logScaleButton) {
      logScaleButton.textContent = this._options.logScale?'LOG':'LINEAR';
    }
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
    return createXScale(points, chartWidth, this._options.viewDays, this._panOffset);
  }

  createYScale(points, chartHeight) {
    return createYScale(points, chartHeight, this._options.logScale);
  }

  // In the drawGrid method, modify the month shading logic:

  drawGrid(xScale, yScale, chartWidth, chartHeight, padding, allPoints) {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.classList.add('grid-group');
    
    const yValues = generateYValues(allPoints.map(p => p.y), 6, this._options.logScale);
    
    const { minDate, maxDate } = getVisibleDateRange(allPoints, this._options.viewDays, this._panOffset);
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    
    if (dateRangeDays > 60 && dateRangeDays <= 310) {
      // Get the first month of the ENTIRE dataset for consistent shading
      const allDates = this._data?.datasets?.flatMap(d => 
        d.data?.map(p => parseDate(p.x)) || []
      ) || [];
      
      const globalMinDate = allDates.length > 0 ? Math.min(...allDates) : minDate;
      const globalMaxDate = allDates.length > 0 ? Math.max(...allDates) : maxDate;
      
      // Generate months from the global dataset range
      const globalFirstMonth = new Date(globalMinDate);
      globalFirstMonth.setDate(1);
      globalFirstMonth.setHours(0, 0, 0, 0);
      
      const globalLastMonth = new Date(globalMaxDate);
      globalLastMonth.setDate(1);
      globalLastMonth.setHours(0, 0, 0, 0);
      
      // Create all month boundaries in the global range
      const globalMonthDates = [];
      let currentMonth = new Date(globalFirstMonth);
      
      while (currentMonth <= globalLastMonth) {
        globalMonthDates.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      
      // Get the reference month index from the first month of global data
      const firstMonthDate = new Date(globalMinDate);
      const firstMonthIndex = firstMonthDate.getMonth() + (firstMonthDate.getFullYear() * 12);
      
      // Find the month that starts before or at the visible minDate
      let startMonthIndex = 0;
      for (let i = 0; i < globalMonthDates.length; i++) {
        if (globalMonthDates[i].getTime() <= minDate) {
          startMonthIndex = i;
        }
      }
      
      // Draw shaded regions for all months that intersect the visible range
      for (let i = startMonthIndex; i < globalMonthDates.length; i++) {
        const currentMonthStart = globalMonthDates[i].getTime();
        const nextMonthStart = i < globalMonthDates.length - 1 
          ? globalMonthDates[i + 1].getTime() 
          : globalMonthDates[i].getTime() + (31 * 24 * 60 * 60 * 1000); // Approximate if no next month
        
        // Only draw if this month intersects the visible range
        if (currentMonthStart <= maxDate && nextMonthStart >= minDate) {
          // Calculate visible portion of this month
          const visibleStart = Math.max(currentMonthStart, minDate);
          const visibleEnd = Math.min(nextMonthStart, maxDate);
          
          // Determine if this month should be shaded
          const currentDate = new Date(currentMonthStart);
          const currentMonthIndex = currentDate.getMonth() + (currentDate.getFullYear() * 12);
          const shouldShade = (currentMonthIndex - firstMonthIndex) % 2 === 0;
          
          if (shouldShade && visibleStart < visibleEnd) {
            const xStart = padding.left + xScale(visibleStart);
            const xEnd = padding.left + xScale(visibleEnd);
            const width = xEnd - xStart;
            
            if (width > 0 && xStart <= padding.left + chartWidth && xEnd >= padding.left) {
              const rect = this.createElement('rect', {
                x: Math.max(padding.left, xStart),
                y: padding.top,
                width: Math.min(chartWidth, width - Math.max(0, padding.left - xStart)),
                height: chartHeight,
                fill: 'currentColor',
                'fill-opacity': '0.1',
              });
              gridGroup.appendChild(rect);
            }
          }
        }
        
        // Stop if we're past the visible range
        if (currentMonthStart > maxDate) break;
      }
    } else if (dateRangeDays > 310 && dateRangeDays <= 365) {
      const tickDates = generateMonthlyTickDates(minDate, maxDate);
      
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
      // Original logic for other ranges
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
    
    // Horizontal grid lines (unchanged)
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
    
    const { minDate, maxDate } = getVisibleDateRange(points, this._options.viewDays, this._panOffset);
    const dateRangeDays = (maxDate - minDate) / (24 * 60 * 60 * 1000);
    
    if (dateRangeDays > 60 && dateRangeDays <= 310) {
      const tickDates = generateMonthlyTickDates(minDate, maxDate);
      
      tickDates.forEach((dateTimestamp, index) => {
        const currentMonthStart = dateTimestamp;
        const nextMonthStart = tickDates[index + 1] || maxDate;
        
        // Calculate midpoint for centered label
        const midTimestamp = currentMonthStart + (nextMonthStart - currentMonthStart) / 2;
        const x = padding.left + xScale(midTimestamp);
        
        // Only render if midpoint is within view
        if (x >= padding.left && x <= padding.left + chartWidth) {
          const date = new Date(currentMonthStart);
          const text = this.createElement('text', {
            x, 
            y: padding.top + chartHeight + 20,
            'text-anchor': 'middle', 
            class: 'axis-text'
          });
          
          // Use short month name (e.g., "Jan", "Feb") for centered labels
          text.textContent = date.toLocaleDateString(undefined, { month: 'short' });
          axisGroup.appendChild(text);
        }
      });
    } else if (dateRangeDays > 310 && dateRangeDays <= 365) {
      const tickDates = generateMonthlyTickDates(minDate, maxDate);
      
      tickDates.forEach((dateTimestamp) => {
        const date = new Date(dateTimestamp);
        const x = padding.left + xScale(dateTimestamp);
        
        if (x >= padding.left && x <= padding.left + chartWidth) {
          const text = this.createElement('text', {
            x, y: padding.top + chartHeight + 20,
            'text-anchor': 'middle', class: 'axis-text'
          });
          text.textContent = formatDate(date, minDate, maxDate);
          axisGroup.appendChild(text);
        }
      });
    } else {
      // Original logic for other ranges
      const xLabels = generateXLabels(points, 8, this._options.viewDays, this._panOffset);
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
    
    // Y-axis labels (unchanged)
    const yValues = generateYValues(points.map(p => p.y), 6, this._options.logScale);
    yValues.forEach((yValue) => {
      const y = padding.top + yScale(yValue);
      const text = this.createElement('text', {
        x: padding.left + 20, y: y - 4,
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

  formatValue(value) {
    return formatValue(value, this._options.valueFormatter);
  }

  formatDate(date) {
    const dates = this._data?.datasets?.flatMap(d => d.data?.map(p => parseDate(p.x)) || []) || [];
    const { minDate, maxDate } = getVisibleDateRange(
      this._data?.datasets?.flatMap(d => d.data || []) || [],
      this._options.viewDays,
      this._panOffset
    );
    
    return formatDate(date, minDate, maxDate);
  }

  drawLine(points, xScale, yScale, padding, style, parentGroup) {
    if (points.length < 2) return;
    
    const pathGroup = this.createElement('g');
    
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
    const formattedDate = new Date(parseDate(point.x)).toLocaleString();
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