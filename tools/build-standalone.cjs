const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),read=f=>fs.readFileSync(path.join(dist,f),'utf8');
const worker=read('geometry.js')+'\n'+read('detector-core.js')+'\n'+read('detector-worker.js').replace(/^importScripts\([^\n]+\);\s*/,'');
const rectWorker=read('geometry.js')+'\n'+read('rectifier-core.js')+'\n'+read('rectifier-worker.js').replace(/^importScripts\([^\n]+\);\s*/,'');
const workerSource=JSON.stringify(worker).replace(/</g,'\\u003c');
const rectWorkerSource=JSON.stringify(rectWorker).replace(/</g,'\\u003c');
const app=`const __workerSource=${workerSource};const __workerUrl=URL.createObjectURL(new Blob([__workerSource],{type:'text/javascript'}));const __rectWorkerSource=${rectWorkerSource};const __rectWorkerUrl=URL.createObjectURL(new Blob([__rectWorkerSource],{type:'text/javascript'}));\n`+read('app.js').replace("new Worker('detector-worker.js')","new Worker(__workerUrl)").replace("new Worker('rectifier-worker.js')","new Worker(__rectWorkerUrl)");
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>').replace('<script src="geometry.js"></script>',()=>'<script>'+read('geometry.js')+'</script>').replace('<script src="rectifier-core.js"></script>',()=>'<script>'+read('rectifier-core.js')+'</script>').replace('<script src="app.js"></script>',()=>'<script>'+app+'</script>');
const output=path.resolve(process.argv[2]||path.join(root,'outputs','PTCG-Center-Lab.html'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),selfContained:true}));
