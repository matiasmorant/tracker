class Modal extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.childElement = null;
    this.handleEscape = this.handleEscape.bind(this);
  }

  connectedCallback() {
    this.setupModal();
    this.attachEventListeners();
    
    // Start hidden by default
    this.style.display = 'none';
    
    // Set up a MutationObserver to watch for style/display changes from Alpine.js
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style' || mutation.attributeName === 'x-show') {
          const isVisible = this.style.display !== 'none';
          if (isVisible && !this.isOpen) {
            this.isOpen = true;
            this.onOpen();
          } else if (!isVisible && this.isOpen) {
            this.isOpen = false;
            this.onClose();
          }
        }
      });
    });
    
    this.observer.observe(this, {
      attributes: true,
      attributeFilter: ['style', 'x-show']
    });
  }

  disconnectedCallback() {
    this.removeEventListeners();
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  setupModal() {
    // For Alpine.js integration, we want to transform the element itself
    // into the modal structure rather than replacing innerHTML
    this.classList.add('fixed', 'inset-0', 'z-50', 'overflow-y-auto');
    
    // Get the child element (should be only one)
    if (this.children.length !== 1) {
      console.warn('Modal component expects exactly one child element');
      return;
    }
    
    this.childElement = this.children[0];
    
    // Create the modal structure
    this.innerHTML = `
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="modal-backdrop fixed inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
        <div class="modal-content bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden dark:bg-slate-800">
          <!-- Child component will be inserted here -->
        </div>
      </div>
    `;
    
    // Move the child element into the modal content
    const modalContent = this.querySelector('.modal-content');
    if (modalContent && this.childElement) {
      modalContent.appendChild(this.childElement);
    }
  }

  attachEventListeners() {
    // Click on backdrop to close
    const backdrop = this.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        // Only close if clicking directly on the backdrop, not on content
        if (e.target === backdrop) {
          this.close();
        }
      });
    }
  }

  removeEventListeners() {
    const backdrop = this.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.removeEventListener('click', () => this.close());
    }
  }

  handleEscape(event) {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  onOpen() {
    // Add escape key listener
    document.addEventListener('keydown', this.handleEscape);
    
    // Focus management
    setTimeout(() => {
      const focusableElement = this.childElement?.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusableElement) {
        focusableElement.focus();
      }
    }, 10);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  onClose() {
    // Remove escape key listener
    document.removeEventListener('keydown', this.handleEscape);
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Dispatch close event
    this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true }));
  }

  open() {
    this.style.display = 'block';
  }

  close() {
    this.style.display = 'none';
  }

  // Method to check if modal is open
  get open() {
    return this.isOpen;
  }

  // Method to toggle modal state
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

customElements.define('modal-wrapper', Modal);

export default Modal;