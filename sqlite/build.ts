import "reflect-metadata";
import * as fs from 'fs';
import * as url from 'url';
import { AppDataSource } from "./data-source";
import {Site} from "./entity/Site";
import {Broadcast} from "./entity/Broadcast";
import {BuildInfo} from "./entity/BuildInfo";
import puppeteer from 'puppeteer';
const { JSDOM } = require("jsdom");
const jquery = require("jquery");



type BroadcastArray = Broadcast[];

async function scrapeAndParseBroadcasts(database: string, retries: number = 3): Promise<BroadcastArray> {
    console.log(`Starting browser for ${database}...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list'
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        console.log('Navigating to https://shortwavedb.org/...');
        await page.goto('https://shortwavedb.org/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('Waiting 5 seconds before calling CGI script...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Navigating to https://shortwavedb.org/cgi-bin/shortwave.cgi for ${database}... (Attempt ${attempt}/${retries})`);
                
                console.log('No form found, trying direct URL with parameters...');
                const queryParams = `database=${database}&country=All&language=All&band=All&timezone=UTC&display=Now&frequnits=kHz&sort=Frequency&latitude=&longitude=&units=Kilometers`;
                await page.goto(`https://shortwavedb.org/cgi-bin/shortwave.cgi?${queryParams}`, {
                    waitUntil: 'networkidle2',
                    timeout: 90000
                });
                
                // Check for timeout or error pages
                const pageTitle = await page.title();
                if (pageTitle.includes('Timeout') || pageTitle.includes('Error')) {
                    throw new Error(`Page shows timeout or error: ${pageTitle}`);
                }
                
                // If we get here, the page loaded successfully
                break;
            } catch (error) {
                if (attempt === retries) {
                    throw error; // Re-throw on last attempt
                }
                const waitTime = attempt * 10000; // 10s, 20s, 30s
                console.log(`Attempt ${attempt} failed. Waiting ${waitTime/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        console.log(`Page loaded for ${database}. Extracting table content...`);
        
        // Debug: Get page content to see what we're dealing with
        const pageContent = await page.content();
        console.log(`Page title: ${await page.title()}`);
        console.log(`Page content length: ${pageContent.length}`);
        
        // Check if there's an error message
        const hasError = await page.evaluate(() => {
            const errorText = document.body.innerText;
            return errorText.includes('Error Code') || errorText.includes('Invalid option') || errorText.includes('Transmission Failure');
        });
        
        if (hasError) {
            const errorText = await page.evaluate(() => document.body.innerText);
            console.log(`Error detected on page: ${errorText.substring(0, 200)}...`);
        }
        
        // Extract the main data table HTML directly
        const tableHtml = await page.evaluate(() => {
            // Look for table with class 'results' first, then fallback to largest table
            const resultsTable = document.querySelector('table.results');
            if (resultsTable) {
                return (resultsTable as any).outerHTML;
            }
            
            // Fallback: find the largest table
            const tables = document.querySelectorAll('table');
            let mainTable: any = null;
            let maxRows = 0;
            
            tables.forEach((table: any) => {
                const rows = table.querySelectorAll('tr').length;
                if (rows > maxRows && rows > 10) {
                    maxRows = rows;
                    mainTable = table;
                }
            });
            
            return mainTable ? (mainTable as any).outerHTML : '';
        });
        
        console.log(`Table HTML length: ${tableHtml ? tableHtml.length : 0}`);
        
        if (!tableHtml) {
            // Debug: show what tables we found
            const tableCount = await page.evaluate(() => document.querySelectorAll('table').length);
            console.log(`Found ${tableCount} tables on the page`);
            
            // Save the page content for inspection
            require('fs').writeFileSync(`debug_${database}.html`, pageContent);
            console.log(`Page content saved to debug_${database}.html`);
            
            throw new Error(`No table found for ${database}`);
        }
        
        // Save the page content for all successful parses
        require('fs').writeFileSync(`debug_${database}.html`, pageContent);
        console.log(`Page content saved to debug_${database}.html`);
        
        console.log(`Parsing broadcasts for ${database}...`);
        
        // Parse the HTML table
        const dom = new JSDOM(tableHtml);
        const $ = jquery(dom.window);
        
        const broadcasts: BroadcastArray = [];
        const rows = $('tr');
        // console.log(rows);
        
        console.log(`Found ${rows.length} rows in table for ${database}`);
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (i === 0) continue; // Skip header row
            if (i % 1000 === 0) console.log(database, i);
            
            const cells = $(row).find('td');
            
            const fq = Number.parseFloat($(cells[0]).html());
            const startStopTime = $(cells[1]).text().split('-');
            const station = $(cells[2]).html();
            const country = $(cells[3]).html();
            const language = $(cells[4]).html();
            const days = $(cells[5]).html();
            const power = $(cells[6]).html();
            const link = $(cells[7]).html();
            
            let lon = 0, lat = 0, siteName = 'unknown';
            try {
                const a = $(link);
                siteName = a.length === 1 ? a.html() : link;
                const href = a.attr('href');
                if (href) {
                    const coordStr = (new url.URL(href)).searchParams.get('center')?.split(',');
                    if (coordStr) {
                        lat = Number.parseFloat(coordStr[0]);
                        lon = Number.parseFloat(coordStr[1]);
                    }
                }
            } catch (e) {
                // No coordinates available
            }
            
            const startHour = Number.parseInt(startStopTime[0].substring(0, 2));
            const startMin = Number.parseInt(startStopTime[0].substring(2, 4));
            const stopHour = Number.parseInt(startStopTime[1].substring(0, 2));
            const stopMin = Number.parseInt(startStopTime[1].substring(2, 4));
            
            let daysInteger = 0;
            if (/^\d+$/.test(days)) {
                for (let i = 0; i < days.length; i++) {
                    const dayInt = parseInt(days.charAt(i));
                    daysInteger += Math.pow(2, dayInt - 1);
                }
            }
            
            const site = new Site();
            site.name = siteName;
            site.power = Number.parseFloat(power) || 0; // Handle NaN by defaulting to 0
            site.lon = lon;
            site.lat = lat;
            
            const broadcast = new Broadcast();
            broadcast.frequency = fq;
            broadcast.site = site;
            broadcast.days = daysInteger;
            broadcast.startTime = startMin + 60 * startHour;
            broadcast.endTime = stopMin + 60 * stopHour;
            broadcast.station = station;
            broadcast.country = country;
            broadcast.language = language;
            broadcast.source = database;
            
            broadcasts.push(broadcast);
        }
        
        console.log(`Found ${broadcasts.length} broadcasts for ${database}`);
        
        // Delete the debug HTML file after successful parsing
        try {
            require('fs').unlinkSync(`debug_${database}.html`);
            console.log(`Deleted debug_${database}.html`);
        } catch (e) {
            // Ignore error if file doesn't exist
        }
        
        return broadcasts;
        
    } finally {
        await browser.close();
        console.log(`Browser closed for ${database}`);
    }
}

AppDataSource.initialize().then(async () => {

    console.log('SCRAPING AND PARSING HTML ...');

    const databases = ['AOKI', 'EiBi', 'HFCC', 'ITU'];
    const allBroadcasts: BroadcastArray = [];
    
    for (let i = 0; i < databases.length; i++) {
        const database = databases[i];
        
        if (i > 0) {
            console.log('Waiting 10 seconds before next database call...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        try {
            const broadcasts = await scrapeAndParseBroadcasts(database);
            console.log(`${database} TOTAL: `, broadcasts.length);
            allBroadcasts.push(...broadcasts);
        } catch (error) {
            console.error(`Failed to scrape ${database} after all retries:`, error.message);
            console.log(`Continuing with remaining databases...`);
        }
    }

    console.log(allBroadcasts.length, 'BROADCASTS FOUND IN TOTAL');

    console.log('POPULATING DATABASE ...');

    let uniques = 0;
    let nonUniques = 0;
    for (let i = 0; i < allBroadcasts.length; i++) {
        try {
            if (i % 1000 === 0) console.log('checked', i, 'broadcasts');

            const siteName = allBroadcasts[i].site.name;
            const site = await AppDataSource.manager.findOne(Site, {where: {name: siteName}});
            if (site) {
                allBroadcasts[i].site = site;
            }
            else {
               await AppDataSource.manager.save(allBroadcasts[i].site);
            }
            await AppDataSource.manager.save(allBroadcasts[i]);
            uniques++;
        }
        catch (e) {
            nonUniques++;
            // console.log(i, 'NOT UNIQUE', broadcasts[i]);
        }
    }

    console.log('FOUND', uniques, 'UNIQUE BROADCASTS');
    console.log('FOUND', nonUniques, 'NON UNIQUE BROADCASTS');

    // Save build information
    console.log('SAVING BUILD INFO ...');
    const buildInfo = new BuildInfo();
    buildInfo.buildDate = new Date().toISOString();
    buildInfo.commitHash = process.env.CI_COMMIT_SHORT_SHA || 'local';
    await AppDataSource.manager.save(buildInfo);
    console.log(`Build info saved: ${buildInfo.buildDate}, commit: ${buildInfo.commitHash}`);

}).catch((error: any) => console.log(error))