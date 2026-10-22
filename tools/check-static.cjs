const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),base=new URL('https://example.github.io/ptcg-center-lab/');
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
function check(relative){assert.ok(!relative.startsWith('/')&&!/^[a-z]+:/i.test(relative),'Assets must use project-relative paths: '+relative);const url=new URL(relative,base);assert.ok(url.pathname.startsWith(base.pathname),'Asset escaped Pages subpath: '+relative);assert.ok(fs.statSync(path.join(dist,relative)).isFile(),'Missing asset: '+relative);}
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(match[1]==='./')continue;check(match[1]);}
const app=fs.readFileSync(path.join(dist,'app.js'),'utf8');
for(const match of app.matchAll(/new Worker\('([^']+)'\)/g))check(match[1]);
for(const name of ['detector-worker.js','rectifier-worker.js']){const worker=fs.readFileSync(path.join(dist,name),'utf8');const imports=worker.match(/importScripts\(([^)]+)\)/);assert.ok(imports);for(const quoted of imports[1].matchAll(/'([^']+)'/g))check(quoted[1]);}
assert.ok(!fs.existsSync(path.join(root,'.openai')),'Hosting account metadata must stay outside the public repository');
console.log('Static assets and worker imports are valid under a GitHub Pages project subpath.');
