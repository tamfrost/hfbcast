#!/usr/bin/env node

const log4js = require("log4js");
const express = require('express')
const path = require('path')
const http = require('http')
const app = express()

const db = require('./database')

const logger = log4js.getLogger();

/**
 * Sends the result of a database query.
 * database.js functions return either an array of row objects
 * or an { error: "..." } object on invalid input.
 */
function sendResult(res, result) {
    if (result && result.error) {
        return res.status(400).json(result)
    }
    res.json(result)
}

/**
 * Extracts optional sort parameters (sortBy, sortDir) from the query
 * string. Values are validated against a whitelist inside database.js,
 * so the raw strings are forwarded here without sanitising.
 */
function sortParams(req) {
    return { sortBy: req.query.sortBy, sortDir: req.query.sortDir }
}

async function server() {

    logger.level = 'debug';

    app.use(express.json())

    db.setLogger(logger)
    await db.initDb()

    // server static homepage content from /public folder
    app.use('/', express.static(path.join(__dirname, 'public')));

    app.get('/api/v1/broadcasts', (req, res) => {
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, db.findAll(sortBy, sortDir))
    })

    app.get('/api/v1/broadcasts/site/:id', (req, res) => {
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, db.findBySiteId(Number(req.params.id), sortBy, sortDir))
    })

    app.get('/api/v1/broadcasts/frequency/:freq', (req, res) => {
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, db.findByFrequency(Number(req.params.freq), sortBy, sortDir))
    })
    
    app.get('/api/v1/broadcasts/frequency-range', (req, res) => {
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, 
            db.findBetweenFrequencies(
                Number(req.query.min), 
                Number(req.query.max), 
                sortBy, 
                sortDir
            )
        )
    })

    app.get('/api/v1/broadcasts/frequency-around/:freq', (req, res) => {
        const df = req.query.df !== undefined ? Number(req.query.df) : undefined
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, db.findAroundFrequency(Number(req.params.freq), df, sortBy, sortDir))
    })

    app.get('/api/v1/broadcasts/name', (req, res) => {
        const { sortBy, sortDir } = sortParams(req)
        sendResult(res, db.findByName(req.query.q, sortBy, sortDir))
    })

    app.get('/api/v1/broadcasts/buildinfo', (req, res) => {
        sendResult(res, db.getBuildInfo())
    })
    

    const httpServer = http.createServer(app);
    httpServer.on('error', e => {
        logger.error(e);
        process.exit(1);
    });
    httpServer.listen(8000, '0.0.0.0', () => {
        logger.info('Server listening on http://0.0.0.0:8000');
    });
}

if (require.main === module) {
    server().catch(err => {
        logger.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = {
    server
};

