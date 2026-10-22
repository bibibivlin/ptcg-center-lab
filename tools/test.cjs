const cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const commands=[['tools/check-static.cjs'],...['geometry','detector','inner-prior','rectifier','rectifier-worker','worker','interactions','import-layout'].map(n=>['tests/'+n+'.cjs']),['tools/build-standalone.cjs'],['tests/interactions.cjs','--standalone']];
for(const args of commands){console.log('\n> node '+args.join(' '));const result=cp.spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
