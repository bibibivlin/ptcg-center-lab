const assert=require('node:assert/strict'),G=require('../dist/geometry.js');global.CenterGeometry=G;const R=require('../dist/rectifier-core.js');
const outer=G.edgePoints([{x:10,y:20},{x:73,y:20},{x:73,y:108},{x:10,y:108}]);const size=R.outputSize(outer);assert.equal(size.width,63);assert.equal(size.height,88);
const sample=(x,y,out,k)=>R.bilinear((x,y)=>[x*2,y*2,60,255],x,y,out,k);const full=R.warpStrip(size.r,63,88,0,88,sample);for(let y=0;y<88;y++)for(let x=0;x<63;x++){const k=(y*63+x)*4;assert.equal(full[k],(x+10)*2);assert.equal(full[k+1],(y+20)*2);assert.equal(full[k+2],60);assert.equal(full[k+3],255);}
const banded=new Uint8ClampedArray(full.length);for(let y=0;y<88;y+=17){const rows=Math.min(17,88-y);banded.set(R.warpStrip(size.r,63,88,y,rows,sample),y*63*4);}assert.deepEqual(banded,full);
const alpha=new Uint8ClampedArray(4);R.bilinear(x=>x===0?[255,0,0,255]:[0,0,255,0],.5,0,alpha,0);assert.deepEqual([...alpha],[255,0,0,128]);
const large=G.edgePoints([{x:200,y:300},{x:2400,y:300},{x:2400,y:300+2200*88/63},{x:200,y:300+2200*88/63}]);assert.equal(R.outputSize(large).width,2200);assert.ok(R.outputSize(large).height>3000);
const skew=[{x:150,y:100},{x:900,y:170},{x:810,y:1300},{x:70,y:1170}],d=R.outputSize(G.edgePoints(skew));assert.ok(d.width>=Math.max(Math.hypot(750,70),Math.hypot(740,130)));
console.log(JSON.stringify({passed:true,tests:['unmarked exact 1:1 source pixels','perspective transform sampling','strip continuity','premultiplied alpha preservation','export exceeds preview resolution','original pixel density selection']},null,2));
