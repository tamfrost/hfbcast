import 'style-loader!css-loader!ag-grid-community/styles/ag-theme-balham.css';
import 'style-loader!css-loader!ag-grid-community/styles/ag-grid.css';
import {createGrid} from 'ag-grid-community';
import {BroadcastDb} from './lib.js';
import {commitHash} from '../commithash.json';
// import {BroadcastDb, commitHash} from '../dist';


console.log('COMMIT HASH', commitHash);

(new BroadcastDb()).then(db => {
    const result = db.getBroadcastsBetween(0,30000);
    // console.log(result.columns);
    // console.log(result.values);

    const useColumns = ['frequency', 'station', 'country', 'source', 'power', 'lon', 'lat'];
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

