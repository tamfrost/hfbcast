const commitHash = require("./commithash.json").commitHash;

const isWebWorker = typeof WorkerGlobalScope !== 'undefined';
const isJavascript = typeof window !== 'undefined' && !isWebWorker;
const isNodejs = !isJavascript && !isWebWorker;

const BroadcastDb = require('./src/lib.js').BroadcastDb;

let globalObject;

if (isNodejs) {
    globalObject = global;
}

if (isJavascript) {
    globalObject = window;
}

if (isWebWorker) {
    globalObject = self;
}


class MyWasmClass {
    
    constructor(config, wasmModule) {
        this.wasmModule = wasmModule;
        const jsonInput = JSON.stringify(config);
        const configAddress = wasmModule._malloc(jsonInput.length + 1);
        wasmModule.stringToUTF8(jsonInput, configAddress, jsonInput.length + 1);
        this.myClass = new wasmModule.MyClass(configAddress);
    }

    emArray(array) {
        const ptr = this.wasmModule._malloc(array.length*64);
        (new Float64Array(this.wasmModule.HEAPU8.buffer, ptr, array.length)).set(array);
        return ptr;
    }

    emString(string) {
        const ptr = this.wasmModule._malloc(string.length*8);
        (new Float64Array(this.wasmModule.HEAPU8.buffer, ptr, string.length)).set(string);
        return ptr;
    }

    method1(data) {
        return new Promise((resolve, reject) => {
            globalObject.methodResolver = resolve;
            this.myClass.method1(data.length, this.emArray(data));
        })
    }

    logBuildTime() {
        this.wasmModule.MyClass.logBuildTime();
    }

    logCommitHash() {
        this.wasmModule.MyClass.logCommitHash();
    }

    getCommitHash() {
        return this.wasmModule.UTF8ToString(this.wasmModule.MyClass.getCommitHash());
    }
}

// const moduleGenerator = require('./lib/wasm-module');

// loadWasm = function (config) {
//     return new Promise(resolve => {
//         moduleGenerator().then(wasmModule => {
//             resolve(new MyWasmClass(config, wasmModule));
//         })
//     })
// }

module.exports = {
    BroadcastDb,
    // loadWasm,
    commitHash
}
