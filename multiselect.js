export class MultiSelect extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.showAll = false;
    this._items = [];
    this._selectedIds = [];
    this._renderTimeout = null;
    this._isInitialRender = true;
  }

  static get observedAttributes() {
    return ['items', 'selected-ids', 'multi'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  parseItems() {
    try {
      const itemsAttr = this.getAttribute('items');
      if (!itemsAttr) return [];
      if (itemsAttr.startsWith('[')) {
        return JSON.parse(itemsAttr);
      }
      return [];
    } catch (e) {
      console.warn('Failed to parse items:', e);
      return [];
    }
  }

  parseSelectedIds() {
    try {
      const selectedAttr = this.getAttribute('selected-ids');
      if (!selectedAttr) return [];
      if (selectedAttr.startsWith('[')) {
        return JSON.parse(selectedAttr);
      }
      return [];
    } catch (e) {
      console.warn('Failed to parse selected-ids:', e);
      return [];
    }
  }

  toggleShowAll() {
    this.showAll = !this.showAll;
    this.render();
  }

  toggle(id) {
    let selectedIds = this.parseSelectedIds();
    const isMulti = this.getAttribute('multi') !== null;
    
    const normalizedId = (typeof this._items[0]?.id === 'number') ? Number(id) : id;
    
    let newSelection;
    if (isMulti) {
      const exists = selectedIds.some(sid => sid == normalizedId);
      newSelection = exists
        ? selectedIds.filter(i => i != normalizedId)
        : [...selectedIds, normalizedId];
    } else {
      newSelection = [normalizedId];
    }

    this.dispatchEvent(new CustomEvent('change', {
      detail: { selection: newSelection },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }
    
    this._renderTimeout = setTimeout(() => {
      this._items = this.parseItems();
      this._selectedIds = this.parseSelectedIds();
      
      const sortedItems = [...this._items].sort((a, b) => {
        const aSelected = this._selectedIds.some(sid => sid == a.id);
        const bSelected = this._selectedIds.some(sid => sid == b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });

      const plusIcon = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      const minusIcon = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      const buttonIcon = this.showAll ? minusIcon : plusIcon;

      const styles = `
        <style>          
          :host { 
            display: flex !important; 
            opacity: 1 !important; 
            visibility: visible !important;
            position: relative;
          }
                  
          .toggle-button {
            cursor: pointer;
            padding: 0.25rem;
            font-size: 0.6rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6366f1;
            background: transparent;
            border: none;
            border-radius: 0.25rem;
            transition: all 0.15s ease;
            z-index: 1;
            min-width: 24px;
            min-height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .chips-container {
            display: flex; 
            flex-wrap: wrap; 
            gap: 0.5rem; 
            align-items: center;
          }
          
          .chip {
            --base-bg: var(--chip-color, #64748b);
            cursor: pointer;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            transition: all 0.2s ease;
            user-select: none;
            white-space: nowrap;

            /* Inactive state: 10% opacity background, 40% opacity border */
            background: oklch(from var(--base-bg) L C H / 0.1);
            border: 1px solid oklch(from var(--base-bg) L C H / 0.25);
            color: var(--base-bg);
          }
          
          .chip.active {
            --text-l: clamp(15%, calc((L - 0.5) * -1000%), 98%);
            background-color: var(--base-bg);
            border-color: transparent;
            /* Derives text color from background hue but flips lightness */
            color: oklch(from var(--base-bg) var(--text-l) C H);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          
          .chip:hover { 
            transform: translateY(-1px);
            filter: brightness(0.9);
          }
          
          .dark .toggle-button { color: #818cf8; }
        </style>
      `;

      const existingToggleBtn = this.shadowRoot.getElementById('toggle-show-all');
      const existingChipsContainer = this.shadowRoot.querySelector('.chips-container');
      
      const chips = sortedItems.map(item => {
        const isActive = this._selectedIds.some(sid => sid == item.id);
        if (!isActive && !this.showAll) return '';
        
        // Pass the item color as a CSS variable for OKLCH manipulation
        const inlineStyle = item.color ? `style="--chip-color: ${item.color};"` : '';
        
        return `
          <div 
            class="chip ${isActive ? 'active' : ''}" 
            ${inlineStyle}
            data-id="${item.id}"
          >
            ${item.label}
          </div>
        `;
      }).filter(Boolean).join('');

      if (existingToggleBtn && existingChipsContainer && !this._isInitialRender) {
        existingToggleBtn.innerHTML = buttonIcon;
        existingChipsContainer.innerHTML = chips;
        this.attachEventListeners();
      } else {
        this.shadowRoot.innerHTML = `
          ${styles}
          <button class="toggle-button" id="toggle-show-all">
            ${buttonIcon}
          </button>
          <div class="chips-container">
            ${chips}
          </div>
        `;
        this.attachEventListeners();
        this._isInitialRender = false;
      }
      
      this._renderTimeout = null;
    }, 10);
  }

  attachEventListeners() {
    const toggleBtn = this.shadowRoot.getElementById('toggle-show-all');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleShowAll();
      };
    }
    
    this.shadowRoot.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = (e) => {
        e.stopPropagation();
        const id = chip.getAttribute('data-id');
        this.toggle(id);
      };
    });
  }

  disconnectedCallback() {
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }
  }
}

if (!customElements.get('multi-select')) {
  customElements.define('multi-select', MultiSelect);
}