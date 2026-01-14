class ChronosDB {
    constructor() {
        this.db = null;
        this.dbName = 'ChronosDB';
        this.version = 2;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Create object stores if they don't exist
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

    async getAllSeries() { return this.getAll('series'); }
    async getSeries(id) { return this.get('series', id); }
    async saveSeries(seriesData) { return this.save('series', seriesData); }
    async deleteSeries(id) {
        const tx = this.db.transaction(['series', 'entries'], 'readwrite');
        const seriesStore = tx.objectStore('series');
        const entriesStore = tx.objectStore('entries');
        
        // Delete series
        seriesStore.delete(id);
        
        // Delete all entries for this series
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
    async getAllGroups() { return this.getAll('groups'); }
    async saveGroup(groupData) { return this.save('groups', groupData); }
    async deleteGroup(id) { return this.delete('groups', id); }

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

    async exportJSON() {
        try {
            const [series, groups, entries] = await Promise.all([
                this.getAllSeries(),
                this.getAllGroups(),
                this.getAllEntries()
            ]);
            
            const exportObj = {
                appName: "Chronos",
                timestamp: new Date().toISOString(),
                data: { series, groups, entries }
            };
            
            return exportObj;
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
            
            // Export groups as tags
            groups.forEach(g => {
                csv += `${g.name}\r\nColor,0\r\n\r\n`;
            });
            
            // Export series types as units
            csv += "Units\r\n\r\n";
            series.forEach(s => {
                csv += `Unit for ${s.name}\r\nType,${s.type === 'time' ? 'duration' : 'number'}\r\nUp as green,true\r\n\r\n`;
            });
            
            // Export series data as parameters
            csv += "Parameters\r\n\r\n";
            
            series.forEach(s => {
                csv += `${s.name}\r\nUnit,Unit for ${s.name}\r\nColor,0\r\nIs archived,false\r\n`;
                if (s.group) {
                    csv += `Tags,${s.group}\r\n`;
                }
                
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

    async importJSON(importData, merge = true) {
        try {
            if (!importData.data || !importData.data.series) {
                throw new Error('Invalid JSON format');
            }
            
            const { series, groups, entries } = importData.data;
            
            // Import groups
            for (const group of groups || []) {
                delete group.id;
                await this.saveGroup(group);
            }
            
            // Import series
            for (const s of series || []) {
                const seriesId = s.id;
                delete s.id;
                s.config = s.config || { stat: 'mean', period: 'all', quickAddAction: 'manual' };
                
                const newSeriesId = await this.saveSeries(s);
                
                // Import entries for this series
                const seriesEntries = (entries || []).filter(e => e.seriesId === seriesId);
                for (const entry of seriesEntries) {
                    delete entry.id;
                    entry.seriesId = newSeriesId;
                    if (entry.timestamp) {
                        entry.timestamp = entry.timestamp.replace('T', ' ');
                    }
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
        try {
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    complete: async (results) => {
                        try {
                            const data = results.data;
                            
                            // Parse tags (groups)
                            const groups = [];
                            let inTags = false;
                            let inUnits = false;
                            const unitTypes = {};
                            let currentUnitName = null;
                            
                            for (let row of data) {
                                const firstCell = row[0]?.trim();
                                
                                if (firstCell === "Tags") { inTags = true; continue;}
                                if (firstCell === "Units") {inTags = false;inUnits = true;continue;}
                                if (firstCell === "Parameters") {break;}
                                
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
                            
                            // Save groups
                            for (const group of groups) {
                                await this.saveGroup(group);
                            }
                            
                            // Parse parameters (series)
                            let inParameters = false;
                            let currentSeriesName = null;
                            let currentSeriesTags = "";
                            let currentSeriesType = 'number';
                            let currentEntries = [];
                            
                            for (let row of data) {
                                const firstCell = row[0]?.trim();
                                
                                if (firstCell === "Parameters") {
                                    inParameters = true;
                                    continue;
                                }
                                
                                if (!inParameters) continue;
                                
                                if (firstCell === "" && row[1]) {
                                    // This is an entry row
                                    let timestamp = row[1].replace('T', ' ');
                                    let rawVal = parseFloat(row[2]);
                                    let value = currentSeriesType === 'time' ? rawVal / 1000 : rawVal;
                                    
                                    currentEntries.push({
                                        timestamp,
                                        value,
                                        notes: row[3] || ''
                                    });
                                } else if (firstCell === "Tags") {
                                    currentSeriesTags = row[1];
                                } else if (firstCell === "Unit") {
                                    const unitName = row[1]?.trim();
                                    currentSeriesType = (unitTypes[unitName] === 'duration') ? 'time' : 'number';
                                } else if (firstCell && !["Unit", "Color", "Is archived", "Tags", "Initial value"].includes(firstCell)) {
                                    // This is a new series
                                    if (currentSeriesName) {
                                        await this.saveImportedSeries(
                                            currentSeriesName,
                                            currentSeriesTags,
                                            currentSeriesType,
                                            currentEntries
                                        );
                                    }
                                    
                                    currentSeriesName = firstCell;
                                    currentSeriesTags = "";
                                    currentSeriesType = 'number';
                                    currentEntries = [];
                                }
                            }
                            
                            // Save the last series
                            if (currentSeriesName) {
                                await this.saveImportedSeries(
                                    currentSeriesName,
                                    currentSeriesTags,
                                    currentSeriesType,
                                    currentEntries
                                );
                            }
                            
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    },
                    error: (err) => reject(err)
                });
            });
        } catch (err) {
            console.error('CSV import failed:', err);
            throw err;
        }
    }
    
    async saveImportedSeries(name, group, type, entries) {
        const seriesData = {
            name,
            group: group || '',
            type,
            config: { stat: 'mean', period: 'all', quickAddAction: 'manual' }
        };
        
        const seriesId = await this.saveSeries(seriesData);
        
        for (const entry of entries) {
            await this.saveEntry({ ...entry, seriesId });
        }
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
        const series = await this.getAllSeries();
        const entries = await this.getAllEntries();
        
        return series.map(s => ({
            ...s,
            entries: entries.filter(e => e.seriesId === s.id)
        }));
    }
}

const chronosDB = new ChronosDB();
chronosDB.init().catch(err => console.error('Failed to initialize database:', err));
window.ChronosDB = chronosDB;