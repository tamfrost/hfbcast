#!/usr/bin/env node

const log4js = require("log4js");
const express = require('express')
const path = require('path')
const cors = require('cors')
const app = express()

const db = require('./database')

const logger = log4js.getLogger();

async function server(config, silent) {

    logger.level = silent ? 'fatal' : 'debug';

    let resolver, rejecter;

    app.use(express.json())
    app.use(cors());
    app.options('*', cors());

    await db.initDb(logger)

    // server static homepage content
    app.use('/', express.static(path.join(__dirname, 'public')));

    //******************************
    //          REST
    //******************************

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

    app.get('/api/v1/broadcasts', (req, res) => {
        sendResult(res, db.findAll())
    })

    app.get('/api/v1/broadcasts/site/:id', (req, res) => {
        sendResult(res, db.findBySiteId(Number(req.params.id)))
    })

    app.get('/api/v1/broadcasts/frequency/:freq', (req, res) => {
        sendResult(res, db.findByFrequency(Number(req.params.freq)))
    })
    
    app.get('/api/v1/broadcasts/frequency-range', (req, res) => {
        sendResult(res, db.findBetweenFrequencies(Number(req.query.min), Number(req.query.max)))
    })

    //*********************************************************************
    //     set up web sockets (all on the same port as the http server)
    //*********************************************************************

    const httpServer = require('http').createServer(app);

    httpServer.on('error', e => {
        logger.info(e);
        rejecter('server error');
    });
    httpServer.listen(8000, '0.0.0.0', () => {
        logger.info('app server listening on http://0.0.0.0:8000')
        resolver('server started');
    })

    return new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
    });
}

const yargs = require('yargs')
    .usage('npm start -- -c <config file> -s <silent>')
    .options({
        config: {
            alias: 'c',
            describe: 'config file',
        },
        silent: {
            alias: 's',
            describe: 'run without logging',
        }
    })
    .argv;

if (require.main === module) {
    server(yargs.config ? require('./' + yargs.config) : {}, yargs.silent)
    .then(message => {
        console.log(message);
    })
    .catch(message => {
        console.error(message);
    });
}

module.exports = {
    server
};

