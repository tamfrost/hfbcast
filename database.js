const fs =  require('fs')
const zlib = require('zlib')
const { pipeline } = require('stream/promises');
const Database = require("better-sqlite3");

let db;
let logger;

/**
 *  Initializes the database, required before any query can be done
 */
async function initDb(log) {
    logger = log

    const compressedData    = './assets/database.sqlite.gz'
    const decompressedData  = './assets/database.sqlite'

    try {
        await pipeline(
            fs.createReadStream(compressedData),
            zlib.createGunzip(),
            fs.createWriteStream(decompressedData)
        )
        
        db = new Database(decompressedData);
        
        // it is recommended to turn on WAL to increase performance 
        // ref: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
        db.pragma('journal_mode = WAL');
    
        logger.info("Database initialized")

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
 * @param {float} frequency in kHz
 * @returns All stations with given frequency
 */
function findByFrequency(frequency) {
    if (!validFrequency(frequency)) {
        return {error: `Invalid frequency: ${frequency}, must be number between 0 - 30 000`}
    }

    const getByFrequency = db.prepare(`
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE frequency = ?
    `)
    return getByFrequency.all(frequency)
}

/**
 * @param {float} minFreq lower frequency in kHz
 * @param {float} maxFreq upper frequency in kHz
 * @returns All stations with a frequency between min and max
 */
function findBetweenFrequencies(minFreq, maxFreq) {
    if (!validFrequency(minFreq)) {
        return {error: `Invalid frequency: ${minFreq}, must be integer between 0 - 30 000`}
    }
    if (!validFrequency(maxFreq)) {
        return {error: `Invalid frequency: ${maxFreq}, must be integer between 0 - 30 000`}
    }

    // if we received min as max, we are nice and swap them
    if (minFreq > maxFreq) {
        let temp = maxFreq
        maxFreq = minFreq
        minFreq = temp
        logger.info("[findBetweenFrequencies]: Min was higher than max, swapping ...")
    }

    const getBetweenFreqs = db.prepare(`
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id 
        WHERE broadcast.frequency <= ${maxFreq} 
        AND   broadcast.frequency >= ${minFreq}
    `)
    return getBetweenFreqs.all()
}

/**
 * Parameter validation check for frequency in kHz
 * 
 * @param {float} f A frequency in kHz
 * @returns true if interger and in interval [0 - 30 000]
 */
function validFrequency(f) {
    if (Number.isNaN(f) || f < 0 || f > 30000) {
        logger.info(`Got invalid frequency in request: ${f}`)
        return false
    }
    return true
}

module.exports = {
    initDb,
    findAll,
    findBySiteId,
    findByFrequency,
    findBetweenFrequencies,
}