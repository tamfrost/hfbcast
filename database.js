const fs = require('fs')
const zlib = require('zlib')
const initSqlJs = require('sql.js')

let db;
let logger = console;

const MIN_FREQUENCY = 0
const MAX_FREQUENCY = 30_000

/**
 * Allow-list of columns the API consumer may sort by.
 */
const SORTABLE_COLUMNS = {
    station:   'broadcast.station',
    frequency: 'broadcast.frequency',
    days:      'broadcast.days',
    startTime: 'broadcast.startTime',
    endTime:   'broadcast.endTime',
    country:   'broadcast.country',
    language:  'broadcast.language',
    name:      'site.name',
    power:     'site.power',
    lat:       'site.lat',
    lon:       'site.lon',
}

const SORT_DIRECTIONS = ['ASC', 'DESC']

/**
 * Builds an `ORDER BY` SQL clause from user-supplied sort parameters.
 *
 * Column names and ASC/DESC cannot be bound with `?` placeholders in
 * SQLite, so they must be interpolated as text. To prevent SQL injection
 * both `sortBy` and `sortDir` are validated against fixed allow-lists;
 * any value not on the list is silently ignored and the default ordering
 * (frequency ascending) is applied instead.
 *
 * @param {string} [sortBy] A key from {@link SORTABLE_COLUMNS}
 * @param {string} [sortDir] 'ASC' or 'DESC' (case-insensitive)
 * @returns {string} An `ORDER BY` clause (defaults to frequency ascending)
 */
const DEFAULT_ORDER_BY = `ORDER BY ${SORTABLE_COLUMNS.frequency} ASC`

function buildOrderBy(sortBy, sortDir) {
    if (!sortBy || !SORTABLE_COLUMNS[sortBy]) {
        return DEFAULT_ORDER_BY
    }
    const dir = String(sortDir || '').toUpperCase()
    const direction = SORT_DIRECTIONS.includes(dir) ? dir : 'ASC'
    return `ORDER BY ${SORTABLE_COLUMNS[sortBy]} ${direction}`
}

/**
 * Registers what logger to use, preferably the one created in server.js
 *
 * @param {object} log A logger exposing at least `info`/`debug`/`error`
 */
function setLogger(log) {
    logger = log || console
}

/**
 *  Initializes the database, required before any query can be done
 */
async function initDb() {
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
function findAll(sortBy, sortDir) {
    const orderBy = buildOrderBy(sortBy, sortDir)
    const getAll = `
        SELECT * FROM broadcast 
        JOIN site on broadcast.siteId = site.id
        ${orderBy}
    `
    return execAsObjects(getAll)
}

/**
 * @param {int} siteId Site id ( > 0)
 * @param {string} [sortBy] Optional sort column key (see SORTABLE_COLUMNS)
 * @param {string} [sortDir] Optional sort direction, 'ASC' or 'DESC'
 * @returns All rows for given site. There can be multiple broadcasts for single site
 */
function findBySiteId(siteId, sortBy, sortDir) {
    if (!Number.isInteger(siteId) || siteId < 1) {
        return {error: "Invalid site id number, must above 0"}
    }
    
    const orderBy = buildOrderBy(sortBy, sortDir)
    const getById = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE siteId = ?
        ${orderBy}
    `
    return execAsObjects(getById, [siteId])
}

/**
 * @param {float} frequency in kHz
 * @param {string} [sortBy] Optional sort column key (see SORTABLE_COLUMNS)
 * @param {string} [sortDir] Optional sort direction, 'ASC' or 'DESC'
 * @returns All stations with given frequency
 */
function findByFrequency(frequency, sortBy, sortDir) {
    if (!isValidFrequency(frequency)) {
        return {error: `Invalid frequency: ${frequency}, 
            must be number between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }

    const orderBy = buildOrderBy(sortBy, sortDir)
    const getByFrequency = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id
        WHERE frequency = ?
        ${orderBy}
    `
    return execAsObjects(getByFrequency, [frequency])
}

/**
 * @param {float} minFreq lower frequency in kHz
 * @param {float} maxFreq upper frequency in kHz
 * @param {string} [sortBy] Optional sort column key (see SORTABLE_COLUMNS)
 * @param {string} [sortDir] Optional sort direction, 'ASC' or 'DESC'
 * @returns All stations with a frequency between min and max
 */
function findBetweenFrequencies(minFreq, maxFreq, sortBy, sortDir) {
    if (!isValidFrequency(minFreq)) {
        return {error: `Invalid frequency: ${minFreq}, 
            must be integer between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }
    if (!isValidFrequency(maxFreq)) {
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

    const orderBy = buildOrderBy(sortBy, sortDir)
    const getBetweenFreqs = `
        SELECT * FROM broadcast
        JOIN site on broadcast.siteId = site.id 
        WHERE broadcast.frequency >= ?
        AND   broadcast.frequency <= ?
        ${orderBy}
    `
    return execAsObjects(getBetweenFreqs, [minFreq, maxFreq])
}

/**
 * @param {float} frequency in kHz
 * @param {float} df optional delta frequency in kHz
 * @param {string} [sortBy] Optional sort column key (see SORTABLE_COLUMNS)
 * @param {string} [sortDir] Optional sort direction, 'ASC' or 'DESC'
 * @returns All stations within the interval: [frequency - df, frequency + df]
 */
function findAroundFrequency(frequency, df=100, sortBy, sortDir) {
    if (!isValidFrequency(frequency)) {
        return {error: `Invalid frequency: ${frequency}, 
            must be integer between ${MIN_FREQUENCY} - ${MAX_FREQUENCY}`}
    }

    let min = frequency - df
    let max = frequency + df    
    if (min < MIN_FREQUENCY) { min = MIN_FREQUENCY }
    if (max > MAX_FREQUENCY) { max = MAX_FREQUENCY }
    
    return findBetweenFrequencies(min, max, sortBy, sortDir)
}

/**
 * @param {string} name Partial or full name of station
 * @param {string} [sortBy] Optional sort column key (see SORTABLE_COLUMNS)
 * @param {string} [sortDir] Optional sort direction, 'ASC' or 'DESC'
 * @returns All matching stations for given name
 */
function findByName(name, sortBy, sortDir) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return {error: "Invalid station name, must be a non-empty string"}
    }

    const orderBy = buildOrderBy(sortBy, sortDir)
    const getByStation = `
        SELECT *
        FROM broadcast
        JOIN site ON broadcast.siteId = site.id
        WHERE broadcast.station LIKE ?
        ${orderBy}
    `
    return execAsObjects(getByStation, [`%${name}%`])
}

/**
 * @returns infomation about database build
 */
function getBuildInfo() {
    const buildInfo = `
        SELECT * FROM build_info ORDER BY id DESC LIMIT 1
    `
    return execAsObjects(buildInfo)
}

/**
 * Parameter validation check for frequency in kHz
 * 
 * @param {float} f A frequency in kHz
 * @returns true if interger and in interval [{@link MIN_FREQUENCY}, {@link MAX_FREQUENCY}].
 */
function isValidFrequency(f) {
    if (!Number.isFinite(Number(f)) || Number(f) < MIN_FREQUENCY || Number(f) > MAX_FREQUENCY) {
        logger.info(`Got invalid frequency in request: ${f}`)
        return false
    }
    return true
}

module.exports = {
    initDb,
    setLogger,
    findAll,
    findBySiteId,
    findByFrequency,
    findBetweenFrequencies,
    findAroundFrequency,
    findByName,
    getBuildInfo,
    buildOrderBy,
    SORTABLE_COLUMNS,
}
