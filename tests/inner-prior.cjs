const assert=require('node:assert/strict'),G=require('../dist/geometry.js');global.CenterGeometry=G;const D=require('../dist/detector-core.js');
const w=830,h=1100,cw=630,ch=880,x0=90,y0=100;
const outer=G.edgePoints([{x:x0,y:y0},{x:x0+cw,y:y0},{x:x0+cw,y:y0+ch},{x:x0,y:y0+ch}]);
function image(margins,{art=false,weak=12,blank=false,noTop=false}={}){
 const gray=new Uint8Array(w*h).fill(35),[left,right,top,bottom]=margins;
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
  let v=115;
  if(!blank&&x>=left&&x<cw-right&&(noTop||y>=top)&&y<ch-bottom)v=115-weak;
  if(art&&x>=35&&x<cw-35&&y>=35&&y<ch-35)v=210;
  if(art&&x>=65&&x<cw-65&&y>=65&&y<ch-65)v=60+Math.round(20*Math.sin(x*.12)*Math.sin(y*.08));
  gray[(y+y0)*w+x+x0]=v;
 }
 return gray;
}
function detect(margins,fixture={},options={}){const result=D.detectInner(image(margins,fixture),w,h,outer,[],options),m=G.measure(outer,result.inner);return{result,m};}
const cases=[];
for(const margins of [[8,12,10,10],[6,14,4,16],[24,36,26,34]]){
 const{result,m}=detect(margins,{art:margins[0]<20});
 assert.deepEqual(result.estimatedEdges,[]);
 for(const[k,v]of Object.entries({left:margins[0],right:margins[1],top:margins[2],bottom:margins[3]}))assert.ok(Math.abs(m.borders[k]-v)<1.3,JSON.stringify({margins,k,actual:m.borders[k]}));
 cases.push({margins,reference:result.reference.name,lr:m.lr,tb:m.tb});
}
const custom={profile:'custom',width:1-46/cw,height:1-62/ch},margins=[17,29,23,39],customResult=detect(margins,{},custom);
assert.ok(Math.abs(customResult.m.lr-17/46*100)<1.5);assert.ok(Math.abs(customResult.m.tb-23/62*100)<1.5);
const partial=detect([10,10,10,10],{noTop:true});assert.deepEqual(partial.result.estimatedEdges,[0]);assert.ok(partial.result.edgeQuality.slice(1).every(v=>v>70));
const absent=detect([10,10,10,10],{blank:true});assert.deepEqual(absent.result.estimatedEdges,[0,1,2,3]);assert.equal(absent.result.quality,0);
assert.throws(()=>detect([10,10,10,10],{},{profile:'custom',width:1,height:.95}),/75%/);
console.log(JSON.stringify({passed:true,tests:['narrow frame despite stronger art rectangle','off-center print remains asymmetric','regular frame proportions','custom theoretical dimensions','one missing side preserves three detected sides','missing edges labeled as estimates','invalid theoretical ratio rejected'],cases},null,2));
