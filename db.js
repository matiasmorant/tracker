import { openDB } from 'idb';
import Papa from 'papaparse';
import { format, getRunningTime, elapsedSeconds } from './utils.js';
import { parseISO } from 'date-fns';
import { calculateSeriesSummary } from './analytics.js';

export class ChronosDB {
    constructor() {
        this.db = null;
        this.dbName = 'ChronosDB';
        this.version = 2;
    }

    async init() {
        if (this.db) return this.db;

        this.db = await openDB(this.dbName, this.version, {
            upgrade: (db) => {
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
            }
        });

        return this.db;
    }

    // --- Series Methods ---
    async getAllSeries() { return this.getAll('series'); }
    async getSeries(id) { return this.get('series', id); }
    async saveSeries(seriesData) { return this.save('series', seriesData); }
    
    async deleteSeries(id) {
        const seriesStore = this.db.transaction('series', 'readwrite').objectStore('series');
        const entriesStore = this.db.transaction('entries', 'readwrite').objectStore('entries');
        
        await seriesStore.delete(id);
        
        const index = entriesStore.index('seriesId');
        const entries = await index.getAll(IDBKeyRange.only(id));
        for (const entry of entries) {
            await entriesStore.delete(entry.id);
        }
    }

    async getSeriesByGroup(groupName) {
        const allSeries = await this.getAll('series');
        return allSeries.filter(s => s.group === groupName);
    }

    async getEntriesForSeries(seriesId) {
        const index = this.db.transaction('entries', 'readonly').objectStore('entries').index('seriesId');
        return await index.getAll(IDBKeyRange.only(seriesId));
    }

    async getAllEntries() { return this.getAll('entries'); }
    async saveEntry(entryData, updateSummaries = false) {
        const id = await this.save('entries', entryData);
        if (id) entryData.id = id;

        if (updateSummaries) {
            const series     = await this.getSeries(entryData.seriesId);
            const allEntries = await this.getEntriesForSeries(entryData.seriesId);
            
            series.summaryDisplay = calculateSeriesSummary(series, allEntries, format.duration);
            await this.saveSeries(series);
            
            return { entry: entryData, series };
        }

        return id;
    }
    async deleteEntry(id) { return this.delete('entries', id); }

    // --- Group Methods ---
    async getAllGroups() { return this.getAll('groups'); }
    async saveGroup(groupData) { return this.save('groups', groupData); }
    async deleteGroup(id) { return this.delete('groups', id); }

    // --- Generic Internal Helpers ---
    async getAll (storeName)     { return this.db.getAll (storeName); }
    async get    (storeName, id) { return this.db.get    (storeName, id); }
    async delete (storeName, id) { return this.db.delete (storeName, id); }
    
    async save(storeName, data) {
        const cleanData = structuredClone(data);
        if (cleanData.id) {
            return this.db.put(storeName, cleanData);
        } else {
            return this.db.add(storeName, cleanData);
        }
    }
    

    isChrono(series) { return series.config?.quickAddAction === 'chronometer'; }

    isRunning(series) {
        if (!this.isChrono(series)) return false;
        return !!series.startTime;
    }

    async start(chrono) {
        if (!this.isChrono(chrono)) { throw new Error('Series is not a chronometer'); }
        if (this.isRunning(chrono)) { throw new Error('Chronometer is already running'); }
        chrono.startTime = new Date().toISOString();
        return await this.saveSeries(chrono);
    }

    async stop(chrono) {
        if (!this.isChrono(chrono)) { throw new Error('Series is not a chronometer'); }
        if (!this.isRunning(chrono)) { throw new Error('Chronometer is not running'); }
        // Calculate elapsed time before clearing startTime
        const elapsed = elapsedSeconds(chrono);
        chrono.startTime = null;
        await this.saveSeries(chrono);
        return await this.saveEntry({
            timestamp: format.dateTime(new Date()),
            value: elapsed,
            notes: '',
            seriesId: chrono.id
        });
    }

    async toggle(chrono) {
        if (!this.isChrono(chrono)) { throw new Error('Series is not a chronometer'); }
        return await (this.isRunning(chrono) ? this.stop(chrono) : this.start(chrono));
    }

    async quickCurrentTime(series) {
        const now = new Date();
        const secondsSinceMidnight = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        
        await this.saveEntry({
            timestamp: format.dateTime(now),
            value: secondsSinceMidnight,
            notes: '',
            seriesId: series.id
        });
    }

    async quickIncrement(series) {
        const todayStr = format.day(new Date());
        const entries = await this.getEntriesForSeries(series.id);
        const todayEntry = entries.find(x=>x.timestamp.startsWith(todayStr));
        
        if (todayEntry) {
            todayEntry.value = (todayEntry.value || 0) + 1;
            await this.saveEntry(todayEntry);
        } else {
            await this.saveEntry({
                timestamp: format.dateTime(new Date()),
                value: 1,
                notes: '',
                seriesId: series.id
            });
        }
    }

    async quickAction(series) {
        const action = series.config?.quickAddAction;
        if (action === 'increment'  ) { await this.quickIncrement(series); }
        if (action === 'chronometer') { await this.toggle(series); }
        if (action === 'currentTime') { await this.quickCurrentTime(series); }
    }

    async exportJSON() {
        try {
            const [series, groups, entries] = await Promise.all([
                this.getAllSeries(),
                this.getAllGroups(),
                this.getAllEntries()
            ]);
            
            return {
                appName: "Chronos",
                timestamp: format.dateTime(new Date()),
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
                    if (entry.timestamp) entry.timestamp = format.dateTime(parseISO(entry.timestamp));
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
        return new Promise((resolve, reject) => {
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
                                    timestamp: format.dateTime(parseISO(row[1])),
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

    async updateSeriesGroupNames(oldName, newName) {
        const allSeries = await this.getAllSeries();
        const targets = allSeries.filter(s => s.group === oldName);
        for (const series of targets) {
            series.group = newName;
            await this.saveSeries(series);
        }
    }
    
    async getSeriesWithEntries() {
        const [series, entries] = await Promise.all([this.getAllSeries(), this.getAllEntries()]);
        const entriesBySeries = _.groupBy(entries, 'seriesId');
        return _.map(series, s => ({
            ...s,
            entries: entriesBySeries[s.id] || []
        }));
    }
}

// Create and export a singleton instance
const dbInstance = new ChronosDB(); await dbInstance.init();
export default dbInstance;
