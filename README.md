# Prepare data

Ideally the data should be harvested from the original sources, but for now it is taken in a rather crude way from https://shortwavedb.org.

Go to https://shortwavedb.org/schedules.html and do a search for each of EiBi, AOKI, HFCC like shown in the image (make sure to select "Display All"). Save the result HTML page for each search in the ```sources``` folder as ```shortwave_<AOKI or EIBI or HFCC>.html``` 

![](/assets/img.png "")

# Build the database

Build the database in the sqlite directory. The database file must be gzipped and moved to the assets folder to be used by other rfdf applications.

```
> cd sqlite
> npm install -g ts-node
> npm install
> npm run build
> gzip database.sqlite
> mv database.sqlite.gz ../assets
```

# Data sources

Assembled:
* https://shortwavedb.org/schedules.html
* https://shortwavedb.org/index.html

Original:
* http://www.eibispace.de/
* http://www1.s2.starcat.ne.jp/ndxc/
* https://www.itu.int/en/ITU-R/terrestrial/broadcast/HFBC/Pages/Schedule.aspx