import * as fs from 'fs';
import * as url from 'url';
import { AppDataSource } from "./data-source";
import {Site} from "./entity/Site";
import {Broadcast} from "./entity/Broadcast";
import {JSDOM} from "jsdom";
const jquery = require("jquery");

function parseBroadcasts(sourceName) {

    return new Promise(resolve => {

        const broadcasts = [];
        const sites = [];

        fs.readFile(`../sources/shortwave_${sourceName}.html`, 'utf8', async function(err, testHTML) {

            //@ts-ignore
            global.document= new JSDOM( testHTML );

            //@ts-ignore
            const $ = jquery(global.document.window);

            const rows = $('table.results tr');

            rows.each(async (i, row) => {

                // if (i===0 || i>100) return false;
                if (i===0) return false;
                if (i%1000 === 0) console.log(sourceName, i);

                const cells = $(row).find('td');

                const fq = Number.parseFloat($(cells[0]).html());
                const startStopTime = $(cells[1]).html().split('-');
                const station = $(cells[2]).html();
                const country = $(cells[3]).html();
                const language = $(cells[4]).html();
                const days = $(cells[5]).html();
                const power = $(cells[6]).html();
                const link = $(cells[7]).html();
                let lon=0, lat=0, siteName='unknown';
                try {
                    const a = $(link);
                    // console.log(a.length);
                    siteName = a.length === 1 ? a.html() : link;
                    //@ts-ignore
                    const coordString = (new url.URL(a.attr('href'))).searchParams.get('center').split(',');
                    lat = Number.parseFloat(coordString[0]);
                    lon = Number.parseFloat(coordString[1]);
                }
                catch (e) {
                }

                const startHour = Number.parseInt(startStopTime[0].substring(0,2));
                const startMin = Number.parseInt(startStopTime[0].substring(2,4));
                const stopHour = Number.parseInt(startStopTime[1].substring(0,2));
                const stopMin = Number.parseInt(startStopTime[1].substring(2,4));

                let daysInteger = 0;
                if (/^\d+$/.test(days)) {
                    for (let i = 0; i < days.length; i++) {
                        const dayInt = parseInt(days.charAt(i));
                        daysInteger += Math.pow(2, dayInt - 1);
                    }
                } else {
                    //Not able to represent other formats like '(17)' = 17th day of month, '2.5' = 2nd Friday of month, '8/15' = August 15th
                }

                // console.log(fq, lon, lat, startStopTime, startHour, stopHour, days);

                const site = new Site();
                site.name = siteName;
                site.power = Number.parseFloat(power);
                site.lon = lon;
                site.lat = lat;

                const broadcast = new Broadcast();
                broadcast.frequency = fq;
                broadcast.site = site;
                broadcast.days = daysInteger;
                broadcast.startTime = startMin + 60*startHour;
                broadcast.endTime = stopMin + 60*stopHour;
                broadcast.station = station;
                broadcast.country = country;
                broadcast.language = language;
                broadcast.source = sourceName;

                sites.push(site);
                broadcasts.push(broadcast);
            })

            resolve(broadcasts);
        });
    })
}

AppDataSource.initialize().then(async () => {

    console.log('PARSING HTML ...');

    const broadcasts1: any = await parseBroadcasts('AOKI');
    console.log('AOKI TOTAL: ', broadcasts1.length);
    const broadcasts2: any = await parseBroadcasts('EIBI');
    console.log('EIBI TOTAL: ', broadcasts2.length);
    const broadcasts3: any = await parseBroadcasts('HFCC');
    console.log('HFCC TOTAL: ', broadcasts3.length);

    const broadcasts = [... broadcasts1, ... broadcasts2, ... broadcasts3]

    console.log(broadcasts.length, 'BROADCASTS FOUND IN TOTAL');

    console.log('POPULATING DATABASE ...');

    let uniques = 0;
    let nonUniques = 0;
    for (let i=0; i<broadcasts.length; i++) {
        try {
            if (i%1000 === 0) console.log('checked', i, 'broadcasts');
            // await siteRepository.save(broadcasts[i].site);

            const siteName = broadcasts[i].site.name;
            const site = await AppDataSource.manager.findOne(Site, {where: {name: siteName}});
            if (site) {
                broadcasts[i].site = site;
            }
            else {
               await AppDataSource.manager.save(broadcasts[i].site);
            }
            await AppDataSource.manager.save(broadcasts[i]);
            uniques++;
        }
        catch (e) {
            nonUniques++;
            // console.log(i, 'NOT UNIQUE', broadcasts[i]);
        }
    }

    console.log('FOUND', uniques, 'UNIQUE BROADCASTS');
    console.log('FOUND', nonUniques, 'NON UNIQUE BROADCASTS');

}).catch(error => console.log(error))
