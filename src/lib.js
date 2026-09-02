const dumm = require("sql.js");
const pako = require("pako");
const sqlwasm = require("url-loader!sql.js/dist/sql-wasm.wasm").default;
const gzUrl = require("url-loader!../assets/database.sqlite.gz").default;

async function openDb() {
    return new Promise(resolve => {
        fetch(sqlwasm).then(res => res.blob()).then(async blob => {
            const sqlPromise = dumm({
                locateFile: () => URL.createObjectURL(blob)
            });
            const dataPromise = fetch(gzUrl).then(res => res.arrayBuffer());
            const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
            const db = new SQL.Database(new Uint8Array(pako.ungzip(buf)));
            resolve(db);
        })
    })
}

class BroadcastDb {

    constructor() {
        return new Promise(async resolve => {
            this.db = await openDb();
            resolve(this)
        })
    }

    getBroadcastsFromSites(station) {

        const now = new Date();
        const currentDay = now.getUTCDay();
        const currentHour = now.getUTCHours();
        const currentMinute = now.getUTCMinutes();
        const currentTime = currentMinute + 60*currentHour;

        const query = `SELECT * FROM broadcast
         JOIN site on broadcast.siteId = site.id
         WHERE broadcast.station LIKE '%${station}%'`
        const res = this.db.exec(query);

        return res[0] || {columns: [], values: []};
    }

    getBroadcastsBetween(minFreqkHz, maxFreqkHz, startTm = new Date(), endTm = new Date()) {

        //getUTCDay (Monday = 1, Tuesday = 2 ... Sunday = 0)
        let startDay = endTm.getUTCDay()-1;
        if (startDay === -1) {
            startDay = 6;
        }
        const startHour = startTm.getUTCHours();
        const startMinute = startTm.getUTCMinutes();
        const startTime = startMinute + 60*startHour;

        const endHour = endTm.getUTCHours();
        const endMinute = endTm.getUTCMinutes();
        const endTime = endMinute + 60*endHour;

        const query = `SELECT * FROM broadcast 
         JOIN site on broadcast.siteId = site.id 
         WHERE broadcast.startTime <= ${endTime} AND 
           broadcast.endTime > ${startTime} AND 
           NOT (site.lat = 0 AND site.lon = 0) AND
         broadcast.days & (1 << ${startDay}) != 0 AND
         broadcast.frequency <= ${maxFreqkHz} AND
         broadcast.frequency >= ${minFreqkHz}
    `
        const res = this.db.exec(query);

        return res[0] || {columns: [], values: []};
    }


    getBroadcastsAt(frequencyKHz, intervalKHz, startTm = new Date(), endTm = new Date()) {

        //getUTCDay (Monday = 1, Tuesday = 2 ... Sunday = 0)
        let currentDay = endTm.getUTCDay()-1;
        if (currentDay === -1) {
            currentDay = 6;
        }
        const startHour = startTm.getUTCHours();
        const startMinute = startTm.getUTCMinutes();
        const startTime = startMinute + 60*startHour;

        const endHour = endTm.getUTCHours();
        const endMinute = endTm.getUTCMinutes();
        const endTime = endMinute + 60*endHour;

        const query = `SELECT * FROM broadcast 
         JOIN site on broadcast.siteId = site.id 
         WHERE broadcast.startTime <= ${endTime} AND 
               broadcast.endTime > ${startTime} AND 
               NOT (site.lat = 0 AND site.lon = 0) AND
             broadcast.days & (1 << ${currentDay}) != 0 AND
             broadcast.frequency <= ${intervalKHz + frequencyKHz/1000} AND
             broadcast.frequency >= ${-intervalKHz + frequencyKHz/1000}
        `

        const broadcasts = [];
        const res = this.db.exec(query);
        if (res.length > 0) {
            res[0].values.forEach(c => {
                const broadcast = {};
                c.forEach((colvalue, i) => {
                    broadcast[res[0].columns[i]] = colvalue;
                })
                broadcasts.push(broadcast);
            })
        }

        return broadcasts;
    }

    getBuildInfo() {
        const query = `SELECT * FROM build_info ORDER BY id DESC LIMIT 1`;
        const res = this.db.exec(query);
        
        if (res.length > 0 && res[0].values.length > 0) {
            const buildInfo = {};
            res[0].values[0].forEach((colvalue, i) => {
                buildInfo[res[0].columns[i]] = colvalue;
            });
            return buildInfo;
        }
        
        return null;
    }
}

module.exports = {
    BroadcastDb    
}
