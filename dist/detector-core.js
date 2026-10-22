(function(root){
'use strict';
const G=root.CenterGeometry;
function fit(points){if(points.length<8)throw Error('边缘不足，请手动定位');let x=0,y=0;for(const p of points){x+=p.x;y+=p.y;}x/=points.length;y/=points.length;let xx=0,yy=0,xy=0;for(const p of points){xx+=(p.x-x)**2;yy+=(p.y-y)**2;xy+=(p.x-x)*(p.y-y);}const t=.5*Math.atan2(2*xy,xx-yy),a=-Math.sin(t),b=Math.cos(t);return{a,b,c:-a*x-b*y};}
function intersect(l,m){const d=l.a*m.b-m.a*l.b;if(Math.abs(d)<1e-9)throw Error('未找到稳定四边形');return{x:(l.b*m.c-m.b*l.c)/d,y:(l.c*m.a-m.c*l.a)/d};}
function detectOuterSeed(gray,mask,w,h){
const runs=[],parents=[0];let last=[];
function find(a){while(parents[a]!==a){parents[a]=parents[parents[a]];a=parents[a];}return a;}
function union(a,b){a=find(a);b=find(b);if(a!==b)parents[b]=a;}
const minRun=Math.max(2,Math.floor(w*.001));
for(let y=0;y<h;y++){const row=[];let j=0;for(let x=0;x<w;){if(!mask[y*w+x]){x++;continue;}const s=x;while(x<w&&mask[y*w+x])x++;const e=x-1;if(e-s+1<minRun)continue;let label=0;while(j<last.length&&last[j].e<s-1)j++;for(let k=j;k<last.length&&last[k].s<=e+1;k++){if(!label)label=last[k].l;else union(label,last[k].l);}if(!label){label=parents.length;parents.push(label);}const run={s,e,y,l:label};runs.push(run);if(runs.length>1500000)throw Error('背景过于复杂，请手动定位外框后识别内框');row.push(run);}last=row;}
const sums=new Map();for(const r of runs){const k=find(r.l),v=sums.get(k)||{n:0,minx:w,maxx:0,miny:h,maxy:0};v.n+=r.e-r.s+1;v.minx=Math.min(v.minx,r.s);v.maxx=Math.max(v.maxx,r.e);v.miny=Math.min(v.miny,r.y);v.maxy=Math.max(v.maxy,r.y);sums.set(k,v);}let chosen=0,best=0;for(const[k,s]of sums){const bw=s.maxx-s.minx,bh=s.maxy-s.miny;if(s.n<w*h*.015||bw<w*.1||bh<h*.1)continue;const touches=s.minx<2||s.miny<2||s.maxx>w-3||s.maxy>h-3;const score=s.n*(touches?.1:1);if(score>best){best=score;chosen=k;}}if(!chosen)throw Error('背景与卡牌对比不足，请先手动标出外框');
const chosenRuns=runs.filter(r=>find(r.l)===chosen);const upper=new Int32Array(w).fill(h),lower=new Int32Array(w).fill(-1),boundary=[];let sx=0,sy=0,n=0,sxx=0,syy=0,sxy=0;
for(const r of chosenRuns){boundary.push({x:r.s,y:r.y},{x:r.e,y:r.y});const k=r.e-r.s+1,xx=(r.s+r.e)*k/2;const squares=z=>z*(z+1)*(2*z+1)/6;sx+=xx;sy+=r.y*k;sxx+=squares(r.e)-squares(r.s-1);syy+=r.y*r.y*k;sxy+=r.y*xx;n+=k;for(let x=r.s;x<=r.e;x++){upper[x]=Math.min(upper[x],r.y);lower[x]=Math.max(lower[x],r.y);}}
for(let x=0;x<w;x++)if(lower[x]>=0)boundary.push({x,y:upper[x]},{x,y:lower[x]});const cx=sx/n,cy=sy/n;let angle=.5*Math.atan2(2*(sxy/n-cx*cy),sxx/n-cx*cx-(syy/n-cy*cy));let ux=Math.cos(angle),uy=Math.sin(angle);if(Math.abs(ux)<Math.abs(uy)){[ux,uy]=[-uy,ux];}if(ux<0){ux=-ux;uy=-uy;}const vx=-uy,vy=ux;let loU=Infinity,hiU=-Infinity,loV=Infinity,hiV=-Infinity;const pts=boundary.map(p=>{const u=(p.x-cx)*ux+(p.y-cy)*uy,v=(p.x-cx)*vx+(p.y-cy)*vy;loU=Math.min(loU,u);hiU=Math.max(hiU,u);loV=Math.min(loV,v);hiV=Math.max(hiV,v);return{...p,u,v};});const du=hiU-loU,dv=hiV-loV;
const sides=[pts.filter(p=>p.u<loU+du*.08&&p.v>loV+dv*.2&&p.v<hiV-dv*.2),pts.filter(p=>p.v<loV+dv*.08&&p.u>loU+du*.2&&p.u<hiU-du*.2),pts.filter(p=>p.u>hiU-du*.08&&p.v>loV+dv*.2&&p.v<hiV-dv*.2),pts.filter(p=>p.v>hiV-dv*.08&&p.u>loU+du*.2&&p.u<hiU-du*.2)];const lines=sides.map(fit);const q=[intersect(lines[0],lines[1]),intersect(lines[1],lines[2]),intersect(lines[2],lines[3]),intersect(lines[3],lines[0])];if(!G.validQuad(q)||q.some(p=>p.x<0||p.y<0||p.x>=w||p.y>=h))throw Error('外框识别不稳定，请手动定位');return q;
}
function sampler(gray,w,h,extra=[],transform=null){const channels=[gray,...extra];return function(x,y){const p=transform?G.map(transform,{x,y}):{x,y},ix=Math.floor(p.x),iy=Math.floor(p.y);if(ix<0||iy<0||ix>=w-1||iy>=h-1)return null;const fx=p.x-ix,fy=p.y-iy,k=iy*w+ix,a=(1-fx)*(1-fy),b=fx*(1-fy),c=(1-fx)*fy,d=fx*fy;return channels.map(ch=>ch[k]*a+ch[k+1]*b+ch[k+w]*c+ch[k+w+1]*d);};}
function scanEdge(sample,a,b,range,options={}){
const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<8)throw Error('精修时请让同一边的两点至少相距 8 px');const tx=(b.x-a.x)/length,ty=(b.y-a.y)/length,nx=-ty,ny=tx,R=Math.max(2,Math.ceil(range)),count=R*2+1,profile=new Float64Array(count),groups=[];const low=Math.ceil(length*(options.guided?.04:.16)),high=Math.floor(length*(options.guided?.96:.84));
function at(t,n){return{x:a.x+tx*t+nx*n,y:a.y+ty*t+ny*n};}
for(let t=low;t<=high;t++){const row=new Float32Array(count);for(let j=0;j<count;j++){const off=j-R,p=at(t,off),u=sample(p.x-nx,p.y-ny),v=sample(p.x+nx,p.y+ny);if(!u||!v)continue;let sum=0;for(let k=0;k<u.length;k++)sum+=(u[k]-v[k])**2;let score=Math.min(90,Math.sqrt(sum));if(options.mask){const distance=Math.max(3,Math.min(14,range*.12)),pi=at(t,off+distance),po=at(t,off-distance),inside=options.mask[Math.round(pi.y)*options.width+Math.round(pi.x)]||0,outside=options.mask[Math.round(po.y)*options.width+Math.round(po.x)]||0;if(!inside||outside)score*=.32;}row[j]=score;profile[j]+=score;}
const peaks=[];for(let j=1;j<count-1;j++)if(row[j]>3&&row[j]>=row[j-1]&&row[j]>row[j+1])peaks.push(j);peaks.sort((i,j)=>row[j]-row[i]);const candidates=[];for(const j of peaks){if(candidates.some(p=>Math.abs(p.n-(j-R))<3))continue;const den=row[j-1]-2*row[j]+row[j+1],sub=Math.abs(den)>1e-9?Math.max(-.5,Math.min(.5,.5*(row[j-1]-row[j+1])/den)):0;candidates.push({t,n:j-R+sub,s:row[j]});if(candidates.length===3)break;}if(candidates.length)groups.push(candidates);}
if(groups.length<Math.max(8,(high-low)*.12))throw Error('当前边缺少连续直线边缘，请手动调整或扩大搜索半径');
const tolerance=Math.max(1.65,Math.min(4,length*.0007));let best={score:-1,m:0,b:0};
function scoreModel(m,b){if(Math.abs(m)>.25||Math.abs(b+m*length*.5)>range+2)return;let score=0;for(const candidates of groups){let local=0;for(const c of candidates){const dist=Math.abs(c.n-m*c.t-b);if(dist<=tolerance)local=Math.max(local,c.s*(1-.3*dist/tolerance));}score+=local;}score/=1+.16*Math.abs(b+m*length*.5)/Math.max(1,range);if(score>best.score)best={score,m,b};}
const bins=Array.from(profile,(s,i)=>({s,n:i-R})).sort((a,b)=>b.s-a.s);for(const p of bins.slice(0,16))scoreModel(0,p.n);
let seed=173;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let trial=0;trial<100;trial++){const ga=groups[Math.floor(random()*groups.length*.3)],gb=groups[Math.floor(groups.length*(.7+random()*.3))];const p=ga[Math.floor(random()*ga.length)],q=gb[Math.floor(random()*gb.length)],m=(q.n-p.n)/(q.t-p.t);scoreModel(m,p.n-m*p.t);}
let model=best,chosen=[];for(let iteration=0;iteration<3;iteration++){chosen=[];for(const candidates of groups){let c=null,value=-1;for(const p of candidates){const distance=Math.abs(p.n-model.m*p.t-model.b);const s=p.s*(1-distance/tolerance);if(distance<=tolerance&&s>value){c=p;value=s;}}if(c)chosen.push(c);}if(chosen.length<8)throw Error('边缘拟合不稳定，请重新打点');let sw=0,st=0,sn=0,stt=0,stn=0;for(const p of chosen){const weight=p.s;sw+=weight;st+=p.t*weight;sn+=p.n*weight;stt+=p.t*p.t*weight;stn+=p.t*p.n*weight;}const den=sw*stt-st*st;model={m:(sw*stn-st*sn)/den,b:(sn*stt-st*stn)/den};}
const coverage=chosen.length/Math.max(1,high-low+1),contrast=chosen.reduce((s,p)=>s+p.s,0)/chosen.length,confidence=Math.round(Math.min(100,coverage*100*Math.min(1,contrast/18)));return{anchors:[at(length*.22,model.m*length*.22+model.b),at(length*.78,model.m*length*.78+model.b)],endpoints:[at(0,model.b),at(length,model.m*length+model.b)],confidence,coverage,contrast};
}
function detectOuter(gray,mask,w,h,extra=[]){const seed=detectOuterSeed(gray,mask,w,h),sample=sampler(gray,w,h,extra),points=[],quality=[];for(let edge=0;edge<4;edge++){const a=seed[edge],b=seed[(edge+1)%4],adjacent=seed[(edge+2)%4],normalSize=Math.hypot(adjacent.x-b.x,adjacent.y-b.y);try{const fit=scanEdge(sample,a,b,Math.max(5,normalSize*.025),{mask,width:w});points.push(...fit.anchors);quality.push(fit.confidence);}catch{points.push(...G.edgePoints(seed).slice(edge*2,edge*2+2));quality.push(0);}}try{G.corners(points);}catch{return{outer:G.edgePoints(seed),quality:[0,0,0,0]};}return{outer:G.edgePoints(G.corners(points)),quality};}
// Ratios are editable search references, not an assumption that the print is centered.
const innerProfiles={
 narrow:{name:'窄边框参考',width:.968,height:.977},
 regular:{name:'常规边框参考',width:.92,height:.943},
 wide:{name:'宽边框参考',width:.89,height:.921}
};
function innerReferences(options={}){
 if(options.profile==='custom'){
  const width=Number(options.width),height=Number(options.height);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<.75||width>.998||height<.75||height>.998)throw Error('理论内框宽高比例应在 75%–99.8% 之间');
  return[{name:'自定义比例',width,height}];
 }
 return innerProfiles[options.profile]?[innerProfiles[options.profile]]:Object.values(innerProfiles);
}
function innerBand(sample,a,b,minDepth,maxDepth,cardWidth,referenceDepths=[]){
 const length=Math.hypot(b.x-a.x,b.y-a.y),tx=(b.x-a.x)/length,ty=(b.y-a.y)/length,nx=-ty,ny=tx;
 const radius=Math.max(1,cardWidth/1500),lo=Math.floor(minDepth),hi=Math.ceil(maxDepth),count=hi-lo+1;
 const start=Math.ceil(length*.1),end=Math.floor(length*.9),total=end-start+1,profile=new Float64Array(count),groups=[];
 const at=(t,n)=>({x:a.x+tx*t+nx*n,y:a.y+ty*t+ny*n});
 const distance=(u,v)=>Math.sqrt(u.reduce((s,c,k)=>s+(c-v[k])**2,0));
 for(let t=start;t<=end;t++){
  const row=new Float32Array(count);
  for(let j=0;j<count;j++){
   const p=at(t,lo+j),u=sample(p.x-nx*radius,p.y-ny*radius),v=sample(p.x+nx*radius,p.y+ny*radius);
   if(u&&v)row[j]=Math.min(90,distance(u,v));
   profile[j]+=Math.min(1,row[j]/8);
  }
  const peaks=[];
  for(let j=1;j<count-1;j++)if(row[j]>4&&row[j]>=row[j-1]&&row[j]>row[j+1])peaks.push(j);
  peaks.sort((i,j)=>row[j]-row[i]);
  // Keep shallow and reference-adjacent peaks even when stronger artwork is present.
  const earliest=[...peaks].sort((i,j)=>i-j).slice(0,4),near=referenceDepths.map(depth=>peaks.reduce((best,j)=>best===null||Math.abs(lo+j-depth)<Math.abs(lo+best-depth)?j:best,null)).filter(j=>j!==null);
  const ordered=[...new Set([...peaks.slice(0,5),...earliest,...near,...peaks])],candidates=[];
  for(const j of ordered){
   if(candidates.some(c=>Math.abs(c.n-(lo+j))<2))continue;
   const den=row[j-1]-2*row[j]+row[j+1],sub=Math.abs(den)>1e-9?Math.max(-.5,Math.min(.5,.5*(row[j-1]-row[j+1])/den)):0;
   const n=lo+j+sub,p=at(t,n),u=sample(p.x-tx*radius,p.y-ty*radius),v=sample(p.x+tx*radius,p.y+ty*radius);
   const tangent=u&&v?distance(u,v):0,alignment=row[j]/(row[j]+tangent+.001);
   candidates.push({t,n,s:Math.min(1,row[j]/8)*Math.max(.3,alignment)});
   if(candidates.length===12)break;
  }
  if(candidates.length)groups.push(candidates);
 }
 if(groups.length<Math.max(12,total*.25))return[];
 const tolerance=Math.max(1.5,Math.min(3,cardWidth*.0007)),maxSlope=.065,proposals=[];
 function assess(m,b,keepPoints=false){
  if(!Number.isFinite(m)||!Number.isFinite(b)||Math.abs(m)>maxSlope)return null;
  const depth=b+m*length/2;
  if(depth<minDepth||depth>maxDepth)return null;
  let strength=0;const chosen=[],bins=new Uint32Array(8);
  for(const group of groups){
   let best=null,value=0;
   for(const p of group){const d=Math.abs(p.n-m*p.t-b),v=p.s*(1-.2*d/tolerance);if(d<tolerance&&v>value){best=p;value=v;}}
   if(best){chosen.push(best);strength+=value;bins[Math.min(7,Math.floor((best.t-start)/total*8))]++;}
  }
  const support=chosen.length/total,continuity=Array.from(bins).reduce((s,n)=>s+Math.min(1,n/(total/8*.65)),0)/8;
  if(support<.28||bins.filter(n=>n>total/8*.15).length<5)return null;
  const score=(support*.6+strength/total*.4)*(.7+.3*continuity)*(1-.14*Math.abs(m)/maxSlope);
  return{m,b,depth,support,continuity,score,chosen:keepPoints?chosen:null};
 }
 function propose(m,b){const model=assess(m,b);if(model)proposals.push(model);}
 const bins=Array.from(profile,(s,i)=>({s,n:lo+i})).sort((a,b)=>b.s-a.s),used=[];
 for(const bin of bins){if(used.some(n=>Math.abs(n-bin.n)<2))continue;used.push(bin.n);propose(0,bin.n);if(used.length===20)break;}
 let seed=907;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<180;i++){
  const left=groups[Math.floor(random()*groups.length*.3)],right=groups[Math.floor(groups.length*(.7+random()*.3))];
  const p=left[Math.floor(random()*left.length)],q=right[Math.floor(random()*right.length)],m=(q.n-p.n)/(q.t-p.t);propose(m,p.n-m*p.t);
 }
 proposals.sort((a,b)=>b.score-a.score);
 const result=[];
 for(const initial of proposals){
  if(result.some(r=>Math.abs(r.depth-initial.depth)<tolerance*2&&Math.abs(r.m-initial.m)<.012))continue;
  let model=initial;
  for(let iteration=0;iteration<3;iteration++){
   const current=assess(model.m,model.b,true);if(!current)break;
   let sw=0,st=0,sn=0,stt=0,stn=0;
   for(const p of current.chosen){const weight=p.s;sw+=weight;st+=p.t*weight;sn+=p.n*weight;stt+=p.t*p.t*weight;stn+=p.t*p.n*weight;}
   const den=sw*stt-st*st;if(Math.abs(den)<1e-9)break;
   const m=(sw*stn-st*sn)/den,b=(sn*stt-st*stn)/den,next=assess(m,b);if(!next)break;model=next;
  }
  if(result.some(r=>Math.abs(r.depth-model.depth)<tolerance*2&&Math.abs(r.m-model.m)<.012))continue;
  // A real border usually remains similar between the cut edge and the print boundary.
  // This is a weak cue, allowing textured and foil borders to retain their edge evidence.
  const variations=[];
  for(let t=start;t<=end;t+=Math.max(1,Math.floor(total/80))){const depth=model.m*t+model.b,p=at(t,Math.max(radius,depth*.3)),q=at(t,depth*.75),u=sample(p.x,p.y),v=sample(q.x,q.y);if(u&&v)variations.push(distance(u,v));}
  variations.sort((a,b)=>a-b);const variation=variations.length?variations[Math.floor(variations.length/2)]:90;
  const uniformity=Math.exp(-variation/35),score=model.score*.9+uniformity*.1;
  result.push({...model,score,confidence:Math.round(Math.min(100,model.support*100)),anchors:[.22,.78].map(f=>at(length*f,model.m*length*f+model.b))});
  if(result.length===14)break;
 }
 return result.sort((a,b)=>b.score-a.score);
}
function detectInner(gray,w,h,outer,extra=[],options={}){
 const r=G.rectification(G.corners(outer)),sample=sampler(gray,w,h,extra,r.inverse),references=innerReferences(options);
 const edges=[[{x:0,y:0},{x:r.w,y:0}],[{x:r.w,y:0},{x:r.w,y:r.h}],[{x:r.w,y:r.h},{x:0,y:r.h}],[{x:0,y:r.h},{x:0,y:0}]];
 const expected=(reference,edge)=>(edge%2?(1-reference.width)*r.w:(1-reference.height)*r.h)/2;
 const allowance=r.w*.025,minDepth=Math.max(2,r.w*.0035),models=edges.map(([a,b],edge)=>{
  const means=references.map(p=>expected(p,edge));
  return innerBand(sample,a,b,Math.max(minDepth,Math.min(...means)-allowance),Math.max(...means)+allowance,r.w,means);
 });
 const layouts=[],huber=x=>{x=Math.abs(x);return x<1?x*x:2*x-1;};
 for(const reference of references){
  const choices=models.map((list,edge)=>{
   const depth=expected(reference,edge),valid=list.filter(m=>Math.abs(m.depth-depth)<allowance*1.15).slice(0,8);
   if(valid.length)return valid;
   const[a,b]=edges[edge],len=Math.hypot(b.x-a.x,b.y-a.y),tx=(b.x-a.x)/len,ty=(b.y-a.y)/len;
   return[{depth,m:0,b:depth,support:0,score:0,confidence:0,estimated:true,anchors:[.22,.78].map(f=>({x:a.x+tx*len*f-ty*depth,y:a.y+ty*len*f+tx*depth}))}];
  });
  for(const top of choices[0])for(const right of choices[1])for(const bottom of choices[2])for(const left of choices[3]){
   const combo=[top,right,bottom,left],sumX=left.depth+right.depth,sumY=top.depth+bottom.depth;
   const sigmaX=Math.max(r.w*.012,(1-reference.width)*r.w*.22),sigmaY=Math.max(r.w*.012,(1-reference.height)*r.h*.22);
   const ratioPenalty=.2*(huber((sumX-(1-reference.width)*r.w)/sigmaX)+huber((sumY-(1-reference.height)*r.h)/sigmaY));
   // Width/height constrain the sum of opposite margins, never the location of the print center.
   const parallelPenalty=.035*(Math.abs(top.m-bottom.m)+Math.abs(left.m-right.m))/.03;
   // Prefer the first coherent print boundary over deeper decorative frames when evidence is comparable.
   const depthPenalty=2.5*(sumX+sumY)/r.w;
   layouts.push({combo,reference,score:combo.reduce((s,m)=>s+m.score,0)-ratioPenalty-parallelPenalty-depthPenalty});
  }
 }
 layouts.sort((a,b)=>b.score-a.score);
 for(const layout of layouts){
  try{
   const points=layout.combo.flatMap(m=>m.anchors.map(p=>G.map(r.inverse,p))),corners=G.corners(points);
   G.measure(outer,points);
   const inner=G.edgePoints(corners);if(inner.some(p=>p.x<0||p.y<0||p.x>=w||p.y>=h))continue;
   const estimatedEdges=layout.combo.flatMap((m,i)=>m.estimated?[i]:[]),edgeQuality=layout.combo.map(m=>m.confidence);
   const alternative=layouts.find(l=>l.reference!==layout.reference&&!l.combo.some(m=>m.estimated)&&l.combo.some((m,i)=>Math.abs(m.depth-layout.combo[i].depth)>r.w*.008));
   const referenceAmbiguous=!!alternative&&layout.score-alternative.score<.2;
   return{inner,quality:Math.min(...edgeQuality),edgeQuality,estimatedEdges,reference:layout.reference,referenceAmbiguous,method:'ratio-prior-continuous-axis-edges'};
  }catch{}
 }
 throw Error('理论位置附近没有形成有效内框，请核对参考比例并手动定位');
}
function refineEdge(gray,w,h,points,edge,range,extra=[]){const i=edge*2;if(!points[i]||!points[i+1])throw Error('先为当前边标出两个点');const fit=scanEdge(sampler(gray,w,h,extra),points[i],points[i+1],range,{guided:true}),result=points.map(p=>p?({...p}):null);result[i]=fit.endpoints[0];result[i+1]=fit.endpoints[1];if(result[i].x<0||result[i].y<0||result[i].x>=w||result[i].y>=h||result[i+1].x<0||result[i+1].y<0||result[i+1].x>=w||result[i+1].y>=h)throw Error('拟合边缘超出原图，请重新打点');return{points:result,quality:fit.confidence};}
root.CenterDetector={detectOuter,detectInner,refineEdge,scanEdge};if(typeof module!=='undefined')module.exports=root.CenterDetector;
})(typeof self!=='undefined'?self:globalThis);
