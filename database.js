const fs =  require('fs')
const zlib = require('zlib')
const { pipeline } = require('stream/promises');
const Database = require("better-sqlite3");

let db;

/**
 *  Initializes the database, required before any query can be done
 */
function initDb() {
    const compressedData    = './assets/database.sqlite.gz'
    const decompressedData  = './assets/database.sqlite'

    try {
        pipeline(
            fs.createReadStream(compressedData),
            zlib.createGunzip(),
            fs.createWriteStream(decompressedData)
        )
        
        db = new Database(decompressedData);
        
        // it is recommended to turn on WAL to increase performance 
        // ref: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
        db.pragma('journal_mode = WAL');

        console.log("loaded database")
    } catch (error) {
        console.error('Error: ', error)
    }
}

/**
 *  @returns All rows in database
 */
function findAll() {
    const getAll = db.prepare(`
        SELECT * FROM broadcast 
        JOIN site on broadcast.siteId = site.id
        ORDER BY broadcast.siteId
    `)
    return getAll.all()
}

/**
 * @param {int} siteId Site id ( > 0)
 * @returns All rows for given site. There can be multiple broadcasts for single site
 */
function findBySiteId(siteId) {
    if (!Number.isInteger(siteId) || siteId < 1) {
        return {error: "Invalid site id number, must above 0"}
    }
    const getById = db.prepare(`
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE siteId = ?
    `)
    return getById.all(siteId)
}

/**
 * @param {int} frequency [0 - 30 000 kHz]
 * @returns All stations with given frequency
 */
function findByFrequency(frequency) {
    if (!Number.isInteger(frequency) || frequency < 0 || frequency > 30000) {
        return {error: "Invalid frequency, must be between 0 - 30 000"}
    }

    const getByFrequency = db.prepare(`
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE frequency = ?
    `)
    return getByFrequency.all(frequency)
}

module.exports = {
    initDb,
    findAll,
    findBySiteId,
    findByFrequency,
}