/**
 * ChronosDB Module
 * A wrapper for IndexedDB to handle series, groups, and entries.
 */
export class ChronosDB {
    constructor() {
        this.db = null;
        this.dbName = 'ChronosDB';
        this.version = 2;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                if (!db.objectStoreNames.contains('series')) {
                    db.createObjectStore('series', { keyPath: 'id', autoIncrement: true });
                }
                
                if (!db.objectStoreNames.contains('groups')) {
                    db.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
                }
                
                if (!db.objectStoreNames.contains('entries')) {
                    const entriesStore = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
                    entriesStore.createIndex('seriesId', 'seriesId', { unique: false });
                }
            };
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            
            request.onerror = (e) => {
                console.error('Database initialization failed:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    // --- Series Methods ---
    async getAllSeries() { return this.getAll('series'); }
    async getSeries(id) { return this.get('series', id); }
    async saveSeries(seriesData) { return this.save('series', seriesData); }
    
    async deleteSeries(id) {
        const tx = this.db.transaction(['series', 'entries'], 'readwrite');
        const seriesStore = tx.objectStore('series');
        const entriesStore = tx.objectStore('entries');
        
        seriesStore.delete(id);
        
        const index = entriesStore.index('seriesId');
        index.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
    
    async getEntriesForSeries(seriesId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('entries', 'readonly');
            const store = tx.objectStore('entries');
            const index = store.index('seriesId');
            const request = index.getAll(IDBKeyRange.only(seriesId));
            
            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllEntries() { return this.getAll('entries'); }
    async saveEntry(entryData) { return this.save('entries', entryData); }
    async deleteEntry(id) { return this.delete('entries', id); }

    // --- Group Methods ---
    async getAllGroups() { return this.getAll('groups'); }
    async saveGroup(groupData) { return this.save('groups', groupData); }
    async deleteGroup(id) { return this.delete('groups', id); }

    // --- Generic Internal Helpers ---
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const cleanData = JSON.parse(JSON.stringify(data));
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = cleanData.id ? store.put(cleanData) : store.add(cleanData);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Export/Import Logic ---
    async exportJSON() {
        try {
            const [series, groups, entries] = await Promise.all([
                this.getAllSeries(),
                this.getAllGroups(),
                this.getAllEntries()
            ]);
            
            return {
                appName: "Chronos",
                timestamp: new Date().toISOString(),
                data: { series, groups, entries }
            };
        } catch (err) {
            console.error('Export failed:', err);
            throw err;
        }
    }
    
    async exportCSV() {
        try {
            const [series, groups, entries] = await Promise.all([
                this.getAllSeries(),
                this.getAllGroups(),
                this.getAllEntries()
            ]);
            
            let csv = "Tags\r\n\r\n";
            groups.forEach(g => { csv += `${g.name}\r\nColor,0\r\n\r\n`; });
            
            csv += "Units\r\n\r\n";
            series.forEach(s => {
                csv += `Unit for ${s.name}\r\nType,${s.type === 'time' ? 'duration' : 'number'}\r\nUp as green,true\r\n\r\n`;
            });
            
            csv += "Parameters\r\n\r\n";
            series.forEach(s => {
                csv += `${s.name}\r\nUnit,Unit for ${s.name}\r\nColor,0\r\nIs archived,false\r\n`;
                if (s.group) csv += `Tags,${s.group}\r\n`;
                
                const seriesEntries = entries
                    .filter(e => e.seriesId === s.id)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                seriesEntries.forEach(e => {
                    csv += `,${e.timestamp},${e.value},\r\n`;
                });
                csv += "\r\n";
            });
            
            return csv;
        } catch (err) {
            console.error('CSV export failed:', err);
            throw err;
        }
    }

    async importJSON(importData) {
        try {
            if (!importData.data || !importData.data.series) throw new Error('Invalid JSON format');
            const { series, groups, entries } = importData.data;
            
            for (const group of groups || []) {
                delete group.id;
                await this.saveGroup(group);
            }
            
            for (const s of series || []) {
                const oldId = s.id;
                delete s.id;
                s.config = s.config || { stat: 'mean', period: 'all', quickAddAction: 'manual' };
                const newSeriesId = await this.saveSeries(s);
                
                const seriesEntries = (entries || []).filter(e => e.seriesId === oldId);
                for (const entry of seriesEntries) {
                    delete entry.id;
                    entry.seriesId = newSeriesId;
                    if (entry.timestamp) entry.timestamp = entry.timestamp.replace('T', ' ');
                    await this.saveEntry(entry);
                }
            }
            return true;
        } catch (err) {
            console.error('JSON import failed:', err);
            throw err;
        }
    }
    
    async importCSV(csvText) {
        // Assumes PapaParse is available globally or via import
        return new Promise((resolve, reject) => {
            if (typeof Papa === 'undefined') {
                reject(new Error("PapaParse library not found."));
                return;
            }

            Papa.parse(csvText, {
                complete: async (results) => {
                    try {
                        const data = results.data;
                        const groups = [];
                        let inTags = false, inUnits = false;
                        const unitTypes = {};
                        let currentUnitName = null;
                        
                        for (let row of data) {
                            const firstCell = row[0]?.trim();
                            if (firstCell === "Tags") { inTags = true; continue; }
                            if (firstCell === "Units") { inTags = false; inUnits = true; continue; }
                            if (firstCell === "Parameters") break;
                            
                            if (inTags && firstCell && firstCell !== "Color") {
                                groups.push({ name: firstCell, color: '#6366f1' });
                            }
                            if (inUnits && firstCell && !firstCell.startsWith('Type')) {
                                currentUnitName = firstCell;
                            }
                            if (inUnits && firstCell === "Type" && currentUnitName) {
                                unitTypes[currentUnitName] = row[1]?.trim().toLowerCase();
                            }
                        }
                        
                        for (const group of groups) await this.saveGroup(group);
                        
                        let inParameters = false, currentSeriesName = null, currentSeriesTags = "";
                        let currentSeriesType = 'number', currentEntries = [];
                        
                        for (let row of data) {
                            const firstCell = row[0]?.trim();
                            if (firstCell === "Parameters") { inParameters = true; continue; }
                            if (!inParameters) continue;
                            
                            if (firstCell === "" && row[1]) {
                                let rawVal = parseFloat(row[2]);
                                currentEntries.push({
                                    timestamp: row[1].replace('T', ' '),
                                    value: currentSeriesType === 'time' ? rawVal / 1000 : rawVal,
                                    notes: row[3] || ''
                                });
                            } else if (firstCell === "Tags") {
                                currentSeriesTags = row[1];
                            } else if (firstCell === "Unit") {
                                currentSeriesType = (unitTypes[row[1]?.trim()] === 'duration') ? 'time' : 'number';
                            } else if (firstCell && !["Unit", "Color", "Is archived", "Tags", "Initial value"].includes(firstCell)) {
                                if (currentSeriesName) {
                                    await this.saveImportedSeries(currentSeriesName, currentSeriesTags, currentSeriesType, currentEntries);
                                }
                                currentSeriesName = firstCell;
                                currentSeriesTags = "";
                                currentSeriesType = 'number';
                                currentEntries = [];
                            }
                        }
                        if (currentSeriesName) await this.saveImportedSeries(currentSeriesName, currentSeriesTags, currentSeriesType, currentEntries);
                        resolve();
                    } catch (err) { reject(err); }
                },
                error: (err) => reject(err)
            });
        });
    }
    
    async saveImportedSeries(name, group, type, entries) {
        const seriesId = await this.saveSeries({
            name, group: group || '', type,
            config: { stat: 'mean', period: 'all', quickAddAction: 'manual' }
        });
        for (const entry of entries) await this.saveEntry({ ...entry, seriesId });
    }

    async updateSeriesConfig(seriesId, config) {
        const series = await this.getSeries(seriesId);
        if (series) {
            series.config = { ...series.config, ...config };
            await this.saveSeries(series);
        }
    }
    
    async updateSeriesGroup(seriesId, groupName) {
        const series = await this.getSeries(seriesId);
        if (series) {
            series.group = groupName;
            await this.saveSeries(series);
        }
    }
    
    async getSeriesWithEntries() {
        const [series, entries] = await Promise.all([this.getAllSeries(), this.getAllEntries()]);
        return series.map(s => ({
            ...s,
            entries: entries.filter(e => e.seriesId === s.id)
        }));
    }
}

// Create and export a singleton instance
const dbInstance = new ChronosDB(); await dbInstance.init();
export default dbInstance;