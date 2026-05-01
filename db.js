import Papa from 'papaparse';
import { format, elapsedSeconds } from './utils.js';
import Dexie from 'dexie';
import { parseISO } from 'date-fns';
import { calculateSeriesSummary } from './analytics.js';

class ChronosDB extends Dexie {
    constructor() {
        super('ChronosDB');

        this.version(1).stores({
            series: '++id, name, group, type, config',
            groups: '++id, name, color',
            entries: '++id, seriesId, timestamp, value, notes'
        });

        this.version(2).stores({
            series: '++id, group',
            groups: '++id',
            entries: '++id, seriesId, [seriesId+timestamp]'
        }).upgrade(tx => {
            return Promise.resolve();
        });

        this.series  = this.table('series');
        this.groups  = this.table('groups');
        this.entries = this.table('entries');
    }

    // --- Series Methods ---
    async deleteSeries(id) {
        return await this.transaction('rw', this.series, this.entries, async () => {
            await this.series.delete(id);
            await this.entries.where({ seriesId: id }).delete();
        });
    }

    async saveEntry(entryData, updateSummaries = false) {
        const id = await this.entries.put(entryData);

        if (updateSummaries) {
            const series     = await this.series.get(entryData.seriesId);
            const allEntries = await this.entries.where({seriesId: entryData.seriesId}).toArray();

            series.summaryDisplay = calculateSeriesSummary(series, allEntries, format.duration);
            await this.series.put(series);

            return { entry: { ...entryData, id }, series };
        }

        return id;
    }

    // --- Group Methods ---
    async deleteGroup(id) {
        return await this.transaction('rw', this.groups, this.series, async () => {
            await this.groups.delete(id);
            await this.series.where({ group: id }).modify({ group: null });
        });
    }

    // --- Generic Internal Helpers ---
    isChrono(series) { return series.config?.quickAddAction === 'chronometer'; }

    isRunning(series) {
        if (!this.isChrono(series)) return false;
        return !!series.startTime;
    }

    async start(chrono) {
        if (!this.isChrono(chrono)) { throw new Error('Series is not a chronometer'); }
        if (this.isRunning(chrono)) { throw new Error('Chronometer is already running'); }
        chrono.startTime = new Date().toISOString();
        return await this.series.put(chrono);
    }

    async stop(chrono) {
        if (!this.isChrono(chrono)) { throw new Error('Series is not a chronometer'); }
        if (!this.isRunning(chrono)) { throw new Error('Chronometer is not running'); }
        // Calculate elapsed time before clearing startTime
        const elapsed = elapsedSeconds(chrono);
        chrono.startTime = null;
        await this.series.put(chrono);
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
        const entries = await this.entries.where({seriesId: series.id}).toArray();
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
                this.series.toArray(),
                this.groups.toArray(),
                this.entries.toArray()
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
                this.series.toArray(),
                this.groups.toArray(),
                this.entries.toArray()
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
                await this.groups.put(group);
            }
            
            for (const s of series || []) {
                const oldId = s.id;
                delete s.id;
                s.config = s.config || { stat: 'mean', period: 'all', quickAddAction: 'manual' };
                const newSeriesId = await this.series.put(s);
                
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
                        
                        for (const group of groups) await this.groups.put(group);
                        
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
        const seriesId = await this.series.put({
            name, group: group || '', type,
            config: { stat: 'mean', period: 'all', quickAddAction: 'manual' }
        });
        for (const entry of entries) await this.saveEntry({ ...entry, seriesId });
    }

    async updateSeriesConfig(seriesId, config) {
        const series = await this.series.get(seriesId);
        if (series) {
            series.config = { ...series.config, ...config };
            await this.series.put(series);
        }
    }
    
    async updateSeriesGroup(seriesId, groupName) {
        const series = await this.series.get(seriesId);
        if (series) {
            series.group = groupName;
            await this.series.put(series);
        }
    }

    async updateSeriesGroupNames(oldName, newName) {
        const targets = await this.series.where({group: oldName}).toArray();
        for (const series of targets) {
            series.group = newName;
            await this.series.put(series);
        }
    }

    async getSeriesWithEntries() {
        const series = await this.series.toArray();
        const entries = await this.entries.toArray();

        return series.map(s => ({
            ...s,
            entries: entries.filter(e => e.seriesId === s.id)
        }));
    }
}

// Create and export a singleton instance
const dbInstance = new ChronosDB();
export default dbInstance;