import 'style-loader!css-loader!ag-grid-community/styles/ag-theme-balham.css';
import 'style-loader!css-loader!ag-grid-community/styles/ag-grid.css';
import {createGrid} from 'ag-grid-community';
import {BroadcastDb} from './lib.js';
import {commitHash} from '../commithash.json';
// import {BroadcastDb, commitHash} from '../dist';


console.log('COMMIT HASH', commitHash);

(new BroadcastDb()).then(db => {
    // Get and display build info
    const buildInfo = db.getBuildInfo();
    if (buildInfo) {
        const buildInfoDiv = document.createElement('div');
        buildInfoDiv.style.padding = '10px';
        buildInfoDiv.style.backgroundColor = '#f0f0f0';
        buildInfoDiv.style.marginBottom = '10px';
        buildInfoDiv.style.fontFamily = 'monospace';
        buildInfoDiv.innerHTML = `
            <strong>Database Build Info:</strong><br>
            Build Date: ${buildInfo.buildDate}<br>
            Commit Hash: ${buildInfo.commitHash}
        `;
        document.body.insertBefore(buildInfoDiv, document.body.firstChild);
        console.log('Database Build Info:', buildInfo);
    }

    const result = db.getBroadcastsBetween(0,30000);
    // console.log(result.columns);
    // console.log(result.values);

    const useColumns = ['frequency', 'station', 'country', 'source', 'name', 'power', 'lon', 'lat'];
    const useIndex = useColumns.map(name => result.columns.indexOf(name));

    const gridOptions = {
        rowData: result.values.map(row => useColumns.reduce((res, name, i) => { 
            res[name] = row[useIndex[i]]; 
            return res; 
        },{})),
        columnDefs: useColumns.map((name, i) => {return {field: name}}),
    };
    
    const myGridElement = document.querySelector('#myGrid');
    createGrid(myGridElement, gridOptions);

});

