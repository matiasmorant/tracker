class DurationPickerModal extends HTMLElement {
    constructor() {
        super();
        this._resolve = null;
        this._reject = null;
    }
    
    connectedCallback() {
        if (this.innerHTML.trim()) return;
        
        this.innerHTML = `
            <style>
                .input-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.75rem;
                    margin-top: 1rem;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                }
                .input-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--sl-color-gray-500);
                    margin-bottom: 0.25rem;
                }
                .input-field {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid var(--sl-color-gray-300);
                    border-radius: var(--sl-input-border-radius-medium);
                    text-align: center;
                    font-size: 1rem;
                    color: var(--sl-color-gray-900);
                    background-color: var(--sl-color-white);
                }
                .input-field:focus {
                    outline: none;
                    border-color: var(--sl-color-primary-600);
                    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-color-primary-100);
                }
            </style>
            <sl-dialog label="Edit Duration" id="dialog">
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
                <div slot="footer">
                    <sl-button variant="default" id="cancelBtn">Cancel</sl-button>
                    <sl-button variant="primary" id="okBtn">OK</sl-button>
                </div>
            </sl-dialog>
        `;
        
        this.dialog = this.querySelector('#dialog');
        this.daysInput = this.querySelector('#daysInput');
        this.hoursInput = this.querySelector('#hoursInput');
        this.minutesInput = this.querySelector('#minutesInput');
        this.secondsInput = this.querySelector('#secondsInput');
        this.cancelBtn = this.querySelector('#cancelBtn');
        this.okBtn = this.querySelector('#okBtn');
        
        this.cancelBtn.addEventListener('click', () => this._rejectModal());
        this.okBtn.addEventListener('click', () => this._confirmModal());
        
        this.dialog.addEventListener('sl-after-hide', () => {
            if (this._reject) {
                this._reject(new Error('Cancelled'));
            }
            this._cleanup();
        });
    }
    
    open(seconds) {
        const secs = parseInt(seconds) || 0;
        const d = Math.floor(secs / 86400);
        const h = Math.floor((secs % 86400) / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        
        this.daysInput.value = d;
        this.hoursInput.value = h;
        this.minutesInput.value = m;
        this.secondsInput.value = s;
        
        this.dialog.show();
        
        setTimeout(() => this.daysInput.focus(), 100);
        
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
        
        this.dialog.hide();
        if (this._resolve) {
            this._resolve(totalSeconds);
        }
        this._cleanup();
    }
    
    _rejectModal() {
        this.dialog.hide();
    }
    
    _cleanup() {
        this._resolve = null;
        this._reject = null;
    }
}

customElements.define('duration-picker-modal', DurationPickerModal);
