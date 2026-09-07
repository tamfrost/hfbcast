const fs = require('fs')
const zlib = require('zlib')
const initSqlJs = require('sql.js')

let db;
let logger;

const MIN_FREQUENCY = 0
const MAX_FREQUENCY = 30_000

/**
 *  Initializes the database, required before any query can be done
 */
async function initDb(log) {
    logger = log

    const compressedData = './assets/database.sqlite.gz'

    try {
        const compressed = fs.readFileSync(compressedData)
        const decompressed = zlib.gunzipSync(compressed)

        const SQL = await initSqlJs()
        db = new SQL.Database(new Uint8Array(decompressed))

        logger.info("Database initialized")

    } catch (error) {
        console.error('Error: ', error)
    }
}

/**
 * Runs a SQL query against the sql.js database and returns the rows as an
 * array of plain objects (column name -> value)
 *
 * @param {string} sql A SQL statement
 * @param {*[]} [params] Optional bound parameters
 * @returns {object[]} Array of row objects
 */
function execAsObjects(sql, params) {
    const statement = db.prepare(sql)
    if (params) {
        statement.bind(params)
    }
    const rows = []
    while (statement.step()) {
        rows.push(statement.getAsObject())
    }
    statement.free()
    return rows
}

/**
 *  @returns All rows in database
 */
function findAll() {
    const getAll = `
        SELECT * FROM broadcast 
        JOIN site on broadcast.siteId = site.id
        ORDER BY broadcast.siteId
    `
    return execAsObjects(getAll)
}

/**
 * @param {int} siteId Site id ( > 0)
 * @returns All rows for given site. There can be multiple broadcasts for single site
 */
function findBySiteId(siteId) {
    if (!Number.isInteger(siteId) || siteId < 1) {
        return {error: "Invalid site id number, must above 0"}
    }
    
    const getById = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE siteId = ?
    `
    return execAsObjects(getById, [siteId])
}

/**
 * @param {float} frequency in kHz
 * @returns All stations with given frequency
 */
function findByFrequency(frequency) {
    if (!validFrequency(frequency)) {
        return {error: `Invalid frequency: ${frequency}, 
            must be number between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }

    const getByFrequency = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE frequency = ?
    `
    return execAsObjects(getByFrequency, [frequency])
}

/**
 * @param {float} minFreq lower frequency in kHz
 * @param {float} maxFreq upper frequency in kHz
 * @returns All stations with a frequency between min and max
 */
function findBetweenFrequencies(minFreq, maxFreq) {
    if (!validFrequency(minFreq)) {
        return {error: `Invalid frequency: ${minFreq}, 
            must be integer between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }
    if (!validFrequency(maxFreq)) {
        return {error: `Invalid frequency: ${maxFreq}, 
            must be integer between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }

    // if we received min as max, we are nice and swap them
    if (minFreq > maxFreq) {
        let temp = maxFreq
        maxFreq = minFreq
        minFreq = temp
        logger.info("[findBetweenFrequencies]: Min was higher than max, swapping ...")
    }

    const getBetweenFreqs = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id 
        WHERE broadcast.frequency >= ?
        AND   broadcast.frequency <= ?
    `
    return execAsObjects(getBetweenFreqs, [minFreq, maxFreq])
}

/**
 * @param {float} frequency in kHz
 * @param {float} df optional delta frequency in kHz
 * @returns All stations within the interval: [frequency - df, frequency + df]
 */
function findAroundFrequency(frequency, df=100) {
    if (!validFrequency(frequency)) {
        return {error: `Invalid frequency: ${frequency}, 
            must be integer between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }

    let min = frequency - df
    let max = frequency + df    
    if (min < MIN_FREQUENCY) { min = MIN_FREQUENCY }
    if (max > MAX_FREQUENCY) { max = MAX_FREQUENCY }
    
    return findBetweenFrequencies(min, max)
}

/**
 * @param {string} name Partial or full name of station
 * @returns All matching stations for given name
 */
function findByName(name) {
    const getByStation = db.prepare(`
        SELECT *
        FROM broadcast
        JOIN site ON broadcast.siteId = site.id
        WHERE broadcast.station LIKE ?
    `)

    return execAsObjects(getByStation, [name])
}

/**
 * Parameter validation check for frequency in kHz
 * 
 * @param {float} f A frequency in kHz
 * @returns true if interger and in interval [{@link MIN_FREQUENCY}, {@link MAX_FREQUENCY}].
 */
function validFrequency(f) {
    if (!Number.isFinite(Number(f)) || Number(f) < MIN_FREQUENCY || Number(f) > MAX_FREQUENCY) {
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
    findAroundFrequency,
    findByName,
}
