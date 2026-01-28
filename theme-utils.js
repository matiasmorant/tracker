// theme-utils.js
export class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }

    initTheme() {
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = storedTheme === 'dark' || (!storedTheme && prefersDark);
        
        this.theme = isDark ? 'dark' : 'light';
        
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        return this.theme;
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        
        localStorage.setItem('theme', this.theme);
        
        if (this.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        return this.theme;
    }

    getCurrentTheme() {
        return this.theme;
    }

    updateThemeIcons(element) {
        if (!element) return;
        
        const themeIconLight = element.querySelector('#theme-icon-light');
        const themeIconDark = element.querySelector('#theme-icon-dark');
        const themeText = element.querySelector('#theme-text');
        
        if (themeIconLight && themeIconDark && themeText) {
            if (this.theme === 'light') {
                themeIconLight.classList.remove('hidden');
                themeIconDark.classList.add('hidden');
                themeText.textContent = 'Dark Mode';
            } else {
                themeIconLight.classList.add('hidden');
                themeIconDark.classList.remove('hidden');
                themeText.textContent = 'Light Mode';
            }
        }
    }
}

// Create a singleton instance
export const themeManager = new ThemeManager();