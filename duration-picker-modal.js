class DurationPickerModal extends HTMLElement {
    constructor() {
        super();
        this._resolve = null;
        this._reject = null;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: none;
                }
                .backdrop {
                    position: fixed;
                    inset: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 50;
                }
                .modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    border-radius: 1rem;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    width: 90%;
                    max-width: 28rem;
                    z-index: 51;
                    overflow: hidden;
                }
                .dark .modal {
                    background-color: #1e293b;
                }
                .header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                }
                .dark .header {
                    border-bottom-color: #334155;
                }
                .title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e293b;
                }
                .dark .title {
                    color: #f1f5f9;
                }
                .body {
                    padding: 1.5rem;
                }
                .input-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.75rem;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                }
                .input-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                    margin-bottom: 0.25rem;
                }
                .dark .input-label {
                    color: #94a3b8;
                }
                .input-field {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #cbd5e1;
                    border-radius: 0.5rem;
                    text-align: center;
                    font-size: 1rem;
                    color: #1e293b;
                    background-color: white;
                }
                .dark .input-field {
                    background-color: #334155;
                    border-color: #475569;
                    color: #f1f5f9;
                }
                .input-field:focus {
                    outline: none;
                    ring: 2px;
                    ring-color: #4f46e5;
                    border-color: #4f46e5;
                }
                .footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                }
                .dark .footer {
                    border-top-color: #334155;
                }
                .btn {
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-cancel {
                    background-color: #f1f5f9;
                    color: #475569;
                }
                .dark .btn-cancel {
                    background-color: #334155;
                    color: #cbd5e1;
                }
                .btn-cancel:hover {
                    background-color: #e2e8f0;
                }
                .dark .btn-cancel:hover {
                    background-color: #475569;
                }
                .btn-ok {
                    background-color: #4f46e5;
                    color: white;
                }
                .btn-ok:hover {
                    background-color: #4338ca;
                }
            </style>
            <div class="backdrop"></div>
            <div class="modal">
                <div class="header">
                    <h3 class="title">Edit Duration</h3>
                </div>
                <div class="body">
                    <div class="input-grid">
                        <div class="input-group">
                            <span class="input-label">Days</span>
                            <input type="number" min="0" class="input-field" id="daysInput">
                        </div>
                        <div class="input-group">
                            <span class="input-label">Hours</span>
                            <input type="number" min="0" max="23" class="input-field" id="hoursInput">
                        </div>
                        <div class="input-group">
                            <span class="input-label">Minutes</span>
                            <input type="number" min="0" max="59" class="input-field" id="minutesInput">
                        </div>
                        <div class="input-group">
                            <span class="input-label">Seconds</span>
                            <input type="number" min="0" max="59" class="input-field" id="secondsInput">
                        </div>
                    </div>
                </div>
                <div class="footer">
                    <button class="btn btn-cancel" id="cancelBtn">Cancel</button>
                    <button class="btn btn-ok" id="okBtn">OK</button>
                </div>
            </div>
        `;
        this.backdrop = this.shadowRoot.querySelector('.backdrop');
        this.modal = this.shadowRoot.querySelector('.modal');
        this.daysInput = this.shadowRoot.getElementById('daysInput');
        this.hoursInput = this.shadowRoot.getElementById('hoursInput');
        this.minutesInput = this.shadowRoot.getElementById('minutesInput');
        this.secondsInput = this.shadowRoot.getElementById('secondsInput');
        this.cancelBtn = this.shadowRoot.getElementById('cancelBtn');
        this.okBtn = this.shadowRoot.getElementById('okBtn');
        
        this.backdrop.addEventListener('click', () => this._rejectModal());
        this.cancelBtn.addEventListener('click', () => this._rejectModal());
        this.okBtn.addEventListener('click', () => this._confirmModal());
        
        // Handle Enter/Escape keys
        this._handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this._rejectModal();
            } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
                this._confirmModal();
            }
        };
    }
    
    connectedCallback() {
        // Host initially hidden
        this.style.display = 'none';
    }
    
    open(seconds) {
        // Parse seconds into days, hours, minutes, seconds
        const secs = parseInt(seconds) || 0;
        const d = Math.floor(secs / 86400);
        const h = Math.floor((secs % 86400) / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        
        this.daysInput.value = d;
        this.hoursInput.value = h;
        this.minutesInput.value = m;
        this.secondsInput.value = s;
        
        // Show modal
        this.style.display = 'block';
        document.addEventListener('keydown', this._handleKeydown);
        
        // Focus first input
        this.daysInput.focus();
        
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
    
    _confirmModal() {
        const d = parseInt(this.daysInput.value) || 0;
        const h = parseInt(this.hoursInput.value) || 0;
        const m = parseInt(this.minutesInput.value) || 0;
        const s = parseInt(this.secondsInput.value) || 0;
        const totalSeconds = d * 86400 + h * 3600 + m * 60 + s;
        
        this._closeModal();
        if (this._resolve) {
            this._resolve(totalSeconds);
        }
        this._cleanup();
    }
    
    _rejectModal() {
        this._closeModal();
        if (this._reject) {
            this._reject(new Error('Cancelled'));
        }
        this._cleanup();
    }
    
    _closeModal() {
        this.style.display = 'none';
        document.removeEventListener('keydown', this._handleKeydown);
    }
    
    _cleanup() {
        this._resolve = null;
        this._reject = null;
    }
}

customElements.define('duration-picker-modal', DurationPickerModal);
