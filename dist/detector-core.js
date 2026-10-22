(function(root){
'use strict';
const G=root.CenterGeometry;
function intersect(l,m){const d=l.a*m.b-m.a*l.b;if(Math.abs(d)<1e-9)throw Error('未找到稳定四边形');return{x:(l.b*m.c-m.b*l.c)/d,y:(l.c*m.a-m.c*l.a)/d};}
// Search a bounded grid of ORIGINAL-image samples, then fit the selected sides
// at original pixel precision. No dependency on a flat or single-color background.
function detectOuterSeed(sample,w,h,progress){
 progress(15,'采样原图颜色边缘');
 const step=Math.max(1,Math.max(w,h)/900),W=Math.floor((w-1)/step),H=Math.floor((h-1)/step),size=W*H;
 const channels=[new Float32Array(size),new Float32Array(size),new Float32Array(size)];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const xx=x*step,yy=y*step,r=step*.35,neighbors=[[0,0],[-r,0],[r,0],[0,-r],[0,r]].map(([dx,dy])=>sample(xx+dx,yy+dy)).filter(Boolean);
  if(!neighbors.length)continue;const p=[0,1,2].map(c=>neighbors.reduce((s,v)=>s+(v[c]??v[0]),0)/neighbors.length);
  for(let c=0;c<3;c++)channels[c][y*W+x]=p[c]??p[0];
 }
 progress(35,'分析长直边方向');
 // Smooth the sampled lattice to suppress fabric weave and foil speckles.
 const smooth=channels.map(ch=>{const out=new Float32Array(size);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x;out[k]=(ch[k]*4+2*(ch[k-1]+ch[k+1]+ch[k-W]+ch[k+W])+ch[k-W-1]+ch[k-W+1]+ch[k+W-1]+ch[k+W+1])/16;}return out;});
 const gx=new Float32Array(size),gy=new Float32Array(size),mag=new Float32Array(size),hist=new Uint32Array(256);
 for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){
  const k=y*W+x;let best=0,dx=0,dy=0;
  for(let c=0;c<3;c++){const a=smooth[c],weight=c?1.7:1,xx=(a[k+2]-a[k-2])*weight,yy=(a[k+2*W]-a[k-2*W])*weight,s=xx*xx+yy*yy;if(s>best){best=s;dx=xx;dy=yy;}}
  gx[k]=dx;gy[k]=dy;mag[k]=Math.sqrt(best);hist[Math.min(255,Math.floor(mag[k]))]++;
 }
 let sum=0,threshold=8;for(let i=0;i<256;i++){sum+=hist[i];if(sum>size*.78){threshold=Math.max(8,Math.min(24,i));break;}}
 const diag=Math.ceil(Math.hypot(W,H)),bins=diag+1,votes=new Float32Array(180*bins),cos=[],sin=[];
 for(let t=0;t<180;t++){cos[t]=Math.cos(t*Math.PI/180);sin[t]=Math.sin(t*Math.PI/180);}
 for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
  const k=y*W+x,s=mag[k];if(s<threshold)continue;
  const ax=Math.abs(gx[k])>Math.abs(gy[k])?1:0,ay=ax?0:1;
  if(s<mag[k+ax+ay*W]||s<mag[k-ax-ay*W])continue;
  let angle=Math.round(Math.atan2(gy[k],gx[k])*180/Math.PI);angle=(angle+180)%180;
  for(let dt=-5;dt<=5;dt++){const t=(angle+dt+180)%180,r=Math.round((x*cos[t]+y*sin[t]+diag)/2);votes[t*bins+r]+=Math.min(60,s)*(1-Math.abs(dt)*.06);}
 }
 progress(50,'筛选完整卡片四边形');
 const peaks=[];
 for(let t=0;t<180;t++)for(let r=1;r<bins-1;r++){const v=votes[t*bins+r];if(v>500&&v>=votes[t*bins+r-1]&&v>votes[t*bins+r+1])peaks.push({t,r,v});}
 peaks.sort((a,b)=>b.v-a.v);
 const lines=[];
 for(const p of peaks){
  const rho=p.r*2-diag,l={a:cos[p.t],b:sin[p.t],c:-rho,t:p.t,v:p.v};
  if(lines.some(q=>{const dot=l.a*q.a+l.b*q.b;return Math.abs(dot)>.996&&Math.abs(l.c-(dot<0?-q.c:q.c))<10;}))continue;
  lines.push(l);if(lines.length===80)break;
 }
 const vertical=lines.filter(l=>Math.abs(l.a)>Math.abs(l.b)).slice(0,28),horizontal=lines.filter(l=>Math.abs(l.b)>=Math.abs(l.a)).slice(0,28);
 function pairs(list){const result=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j],dot=a.a*b.a+a.b*b.b;
  if(Math.abs(dot)<.94||Math.abs(a.c-(dot<0?-b.c:b.c))<Math.min(W,H)*.2)continue;
  result.push([a,b]);
 }return result;}
 function edgeEvidence(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;let strength=0,count=0;
  for(let i=0;i<70;i++){const f=.08+.84*i/69,x=a.x+dx*f,y=a.y+dy*f;let best=0;
   for(let d=-3;d<=3;d++){const xx=Math.round(x+nx*d),yy=Math.round(y+ny*d),k=yy*W+xx;if(xx<3||yy<3||xx>=W-3||yy>=H-3)continue;const normal=Math.abs(gx[k]*nx+gy[k]*ny);best=Math.max(best,normal);}
   strength+=Math.min(1,best/45);if(best>threshold*.8)count++;
  }
  return{score:strength/70,support:count/70};
 }
 const perimeter=[];
 for(let y=5;y<H-5;y+=15)for(let x=5;x<W-5;x+=15)if(x<W*.04||x>W*.96||y<H*.04||y>H*.96)perimeter.push(smooth.map(c=>c[y*W+x]));
 const backgroundColor=[0,1,2].map(c=>perimeter.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(perimeter.length/2)]);
 let best=null;
 for(const vs of pairs(vertical))for(const hs of pairs(horizontal)){
  let q;try{q=[intersect(vs[0],hs[0]),intersect(vs[1],hs[0]),intersect(vs[1],hs[1]),intersect(vs[0],hs[1])];}catch{continue;}
  const cx=q.reduce((s,p)=>s+p.x,0)/4,cy=q.reduce((s,p)=>s+p.y,0)/4;
  q.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  const start=q.reduce((k,p,i)=>p.x+p.y<q[k].x+q[k].y?i:k,0);q=q.slice(start).concat(q.slice(0,start));
  if(!G.validQuad(q)||q.some(p=>p.x<3||p.y<3||p.x>W-4||p.y>H-4))continue;
  const area=G.area(q)/(W*H);if(area<.08||area>.96)continue;
  const lengths=q.map((p,i)=>Math.hypot(p.x-q[(i+1)%4].x,p.y-q[(i+1)%4].y));
  const width=(lengths[0]+lengths[2])/2,height=(lengths[1]+lengths[3])/2,ratio=Math.min(width,height)/Math.max(width,height);
  if(ratio<.50||ratio>.90||Math.min(lengths[0],lengths[2])/Math.max(lengths[0],lengths[2])<.65||Math.min(lengths[1],lengths[3])/Math.max(lengths[1],lengths[3])<.65)continue;
  const evidence=q.map((p,i)=>edgeEvidence(p,q[(i+1)%4]));
  if(evidence.some(e=>e.support<.48))continue;
  const mean=evidence.reduce((s,e)=>s+e.score,0)/4,weakest=Math.min(...evidence.map(e=>e.score));
  const outside=[];
  for(let e=0;e<4;e++){const a=q[e],b=q[(e+1)%4],dx=b.x-a.x,dy=b.y-a.y,len=lengths[e];for(let i=0;i<12;i++){const f=.1+.8*i/11,x=Math.round(a.x+dx*f+dy/len*8),y=Math.round(a.y+dy*f-dx/len*8);if(x>=1&&y>=1&&x<W-1&&y<H-1)outside.push(smooth.map(c=>c[y*W+x]));}}
  const med=[0,1,2].map(c=>outside.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(outside.length/2)]),deviations=outside.map(p=>Math.hypot(...p.map((v,i)=>v-med[i]))).sort((a,b)=>a-b);
  const consistency=Math.exp(-(deviations[Math.floor(deviations.length*.7)]||0)/35);
  const likeness=outside.reduce((s,p)=>s+Math.exp(-Math.hypot(...p.map((v,i)=>v-backgroundColor[i]))/35),0)/outside.length;
  const background=consistency*.3+likeness*.7;
  const score=mean*.40+weakest*.20+.35*Math.sqrt(area)+.50*background-.45*Math.abs(Math.log(ratio/(63/88)));
  if(!best||score>best.score)best={q,score,evidence,width,height};
 }
 if(!best)throw Error('没有找到四条可靠的卡片外边线，请手动定位外框');
 // Check outward from each candidate for the actual cut edge. This prevents a
 // bright print frame from winning over a dark, glitter-covered physical border.
 const adjusted=[];
 for(let e=0;e<4;e++){
  const a=best.q[e],b=best.q[(e+1)%4],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,range=Math.min(best.width,best.height)*.10;
  const at=(t,n)=>{const x=Math.round(a.x+dx*t+nx*n),y=Math.round(a.y+dy*t+ny*n);return x>=1&&y>=1&&x<W-1&&y<H-1?smooth.map(c=>c[y*W+x]):null;};
  function boundary(offset){let value=0,count=0;for(let i=0;i<50;i++){const t=.12+.76*i/49,ref=at(t,-range-8),out=at(t,offset-4),inside=at(t,offset+4);if(!ref||!out||!inside)continue;count++;const likeness=Math.exp(-Math.hypot(...out.map((v,c)=>v-ref[c]))/18),contrast=Math.min(1,Math.hypot(...inside.map((v,c)=>v-out[c]))/30);value+=likeness*contrast;}return count>35?value/count:0;}
  const initial=boundary(0);let score=initial,offset=0;
  for(let d=-Math.floor(range);d<0;d++){const v=boundary(d);if(v>score+.015){score=v;offset=d;}}
  if(score<initial+.12)offset=0;
  adjusted.push(G.edgeLine({x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset}));
 }
 const expanded=adjusted.map((line,i)=>intersect(adjusted[(i+3)%4],line));
 const aspectError=q=>{const d=q.map((p,i)=>Math.hypot(p.x-q[(i+1)%4].x,p.y-q[(i+1)%4].y)),ratio=(d[0]+d[2])/(d[1]+d[3]);return Math.abs(Math.log(Math.min(ratio,1/ratio)/(63/88)));};
 if(G.validQuad(expanded)&&expanded.every(p=>p.x>=1&&p.y>=1&&p.x<W-1&&p.y<H-1)&&aspectError(expanded)<aspectError(best.q)-.005)best.q=expanded;
 // Keep the short dimension on top for landscape photos as well.
 if(best.width>best.height)best.q=best.q.slice(1).concat(best.q[0]);
 return best.q.map(p=>({x:p.x*step,y:p.y*step}));
}
function sampler(gray,w,h,extra=[],transform=null){if(typeof gray==='function')return(x,y)=>{const p=transform?G.map(transform,{x,y}):{x,y};return gray(p.x,p.y);};const channels=[gray,...extra];return function(x,y){const p=transform?G.map(transform,{x,y}):{x,y},ix=Math.floor(p.x),iy=Math.floor(p.y);if(ix<0||iy<0||ix>=w-1||iy>=h-1)return null;const fx=p.x-ix,fy=p.y-iy,k=iy*w+ix,a=(1-fx)*(1-fy),b=fx*(1-fy),c=(1-fx)*fy,d=fx*fy;return channels.map(ch=>ch[k]*a+ch[k+1]*b+ch[k+w]*c+ch[k+w+1]*d);};}
function scanEdge(sample,a,b,range,options={}){
const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<8)throw Error('精修时请让同一边的两点至少相距 8 px');const tx=(b.x-a.x)/length,ty=(b.y-a.y)/length,nx=-ty,ny=tx,R=Math.max(2,Math.ceil(range)),count=R*2+1,profile=new Float64Array(count),groups=[];const low=Math.ceil(length*(options.guided?.04:.16)),high=Math.floor(length*(options.guided?.96:.84));
function at(t,n){return{x:a.x+tx*t+nx*n,y:a.y+ty*t+ny*n};}
const stride=options.maxSamples?Math.max(1,Math.floor((high-low)/options.maxSamples)):1,radius=options.radius||1,total=Math.floor((high-low)/stride)+1;
for(let t=low;t<=high;t+=stride){const row=new Float32Array(count),raw=new Float32Array(count),ref=at(t,-range-radius*3),background=options.outer?sample(ref.x,ref.y):null;for(let j=0;j<count;j++){const off=j-R,p=at(t,off),u=sample(p.x-nx*radius,p.y-ny*radius),v=sample(p.x+nx*radius,p.y+ny*radius);if(!u||!v)continue;let sum=0;for(let k=0;k<u.length;k++)sum+=(u[k]-v[k])**2;let score=Math.min(90,Math.sqrt(sum));raw[j]=score;if(options.outer){const outside=at(t,off-radius*2),u=sample(outside.x,outside.y),v=background;if(u&&v){const difference=Math.hypot(...u.map((c,k)=>c-v[k]));score*=.1+.9*Math.exp(-difference/12);}}if(options.mask){const distance=Math.max(3,Math.min(14,range*.12)),pi=at(t,off+distance),po=at(t,off-distance),inside=options.mask[Math.round(pi.y)*options.width+Math.round(pi.x)]||0,outside=options.mask[Math.round(po.y)*options.width+Math.round(po.x)]||0;if(!inside||outside)score*=.32;}row[j]=score;profile[j]+=score;}
const peaks=[];for(let j=1;j<count-1;j++)if(row[j]>3&&row[j]>=row[j-1]&&row[j]>row[j+1])peaks.push(j);peaks.sort((i,j)=>row[j]-row[i]);const candidates=[];for(const j of peaks){if(candidates.some(p=>Math.abs(p.n-(j-R))<3))continue;const den=row[j-1]-2*row[j]+row[j+1],sub=Math.abs(den)>1e-9?Math.max(-.5,Math.min(.5,.5*(row[j-1]-row[j+1])/den)):0;candidates.push({t,n:j-R+sub,s:row[j],raw:raw[j]});if(candidates.length===3)break;}if(candidates.length)groups.push(candidates);}
if(groups.length<Math.max(8,total*.12))throw Error('当前边缺少连续直线边缘，请手动调整或扩大搜索半径');
const tolerance=options.maxSamples?Math.max(1.65,options.radius*.8):Math.max(1.65,Math.min(4,length*.0007));let best={score:-1,m:0,b:0};
function scoreModel(m,b){if(Math.abs(m)>.25||Math.abs(b+m*length*.5)>range+2)return;let score=0;for(const candidates of groups){let local=0;for(const c of candidates){const dist=Math.abs(c.n-m*c.t-b);if(dist<=tolerance)local=Math.max(local,c.s*(1-.3*dist/tolerance));}score+=local;}score/=1+.16*Math.abs(b+m*length*.5)/Math.max(1,range);if(score>best.score)best={score,m,b};}
const bins=Array.from(profile,(s,i)=>({s,n:i-R})).sort((a,b)=>b.s-a.s);for(const p of bins.slice(0,16))scoreModel(0,p.n);
let seed=173;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let trial=0;trial<100;trial++){const ga=groups[Math.floor(random()*groups.length*.3)],gb=groups[Math.floor(groups.length*(.7+random()*.3))];const p=ga[Math.floor(random()*ga.length)],q=gb[Math.floor(random()*gb.length)],m=(q.n-p.n)/(q.t-p.t);scoreModel(m,p.n-m*p.t);}
let model=best,chosen=[];for(let iteration=0;iteration<3;iteration++){chosen=[];for(const candidates of groups){let c=null,value=-1;for(const p of candidates){const distance=Math.abs(p.n-model.m*p.t-model.b);const s=p.s*(1-distance/tolerance);if(distance<=tolerance&&s>value){c=p;value=s;}}if(c)chosen.push(c);}if(chosen.length<8)throw Error('边缘拟合不稳定，请重新打点');let sw=0,st=0,sn=0,stt=0,stn=0;for(const p of chosen){const weight=p.s;sw+=weight;st+=p.t*weight;sn+=p.n*weight;stt+=p.t*p.t*weight;stn+=p.t*p.n*weight;}const den=sw*stt-st*st;model={m:(sw*stn-st*sn)/den,b:(sn*stt-st*stn)/den};}
const coverage=chosen.length/total,contrast=chosen.reduce((s,p)=>s+(p.raw??p.s),0)/chosen.length,confidence=Math.round(Math.min(100,coverage*100*Math.min(1,contrast/18)));return{anchors:[at(length*.22,model.m*length*.22+model.b),at(length*.78,model.m*length*.78+model.b)],endpoints:[at(0,model.b),at(length,model.m*length+model.b)],confidence,coverage,contrast};
}
function detectOuter(gray,mask,w,h,extra=[],progress=()=>{}){
 const sample=sampler(gray,w,h,extra),seed=detectOuterSeed(sample,w,h,progress),points=[],quality=[],radius=Math.max(1,Math.max(w,h)/1500);
 const smooth=(x,y)=>{const values=[[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]].map(([dx,dy])=>sample(x+dx,y+dy)).filter(Boolean);return values.length?[0,1,2].map(c=>values.reduce((s,p)=>s+(p[c]??p[0]),0)/values.length):null;};
 progress(65,'在原图精修四条外边线');
 for(let edge=0;edge<4;edge++){
  const a=seed[edge],b=seed[(edge+1)%4];
  try{let result=scanEdge(smooth,a,b,Math.max(5,Math.max(w,h)/900*18),{maxSamples:320,radius,outer:true});if(result.confidence<65){try{const alternate=scanEdge(smooth,a,b,Math.max(5,Math.max(w,h)/900*18),{maxSamples:320,radius});if(alternate.confidence>result.confidence+15)result=alternate;}catch{}}points.push(...(result.confidence>=45?result.anchors:G.edgePoints(seed).slice(edge*2,edge*2+2)));quality.push(result.confidence);}
  catch{points.push(...G.edgePoints(seed).slice(edge*2,edge*2+2));quality.push(0);}
 }
 const corners=G.corners(points);
 if(corners.some(p=>p.x<0||p.y<0||p.x>=w||p.y>=h))throw Error('外框精修证据不足，请手动核对卡片边缘');
 return{outer:G.edgePoints(corners),quality,method:'color-gradient-quadrilateral-original-pixel-fit'};
}
// Detection allows asymmetric margins. Only the explicit fallback assumes centering.
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
function inferInner(gray,w,h,outer,extra=[],options={}){
 const quad=G.corners(outer),original=G.rectification(quad),scale=Math.max(1,original.w/1000),rw=original.w/scale,rh=original.h/scale;
 const r={w:rw,h:rh,inverse:G.homography([{x:0,y:0},{x:rw,y:0},{x:rw,y:rh},{x:0,y:rh}],quad)},sample=sampler(gray,w,h,extra,r.inverse),references=innerReferences(options);
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
   const alternative=layouts.find(l=>!l.combo.some(m=>m.estimated)&&l.combo.some((m,i)=>Math.abs(m.depth-layout.combo[i].depth)>r.w*.008));
   const referenceAmbiguous=!!alternative&&layout.score-alternative.score<.2;
   return{inner,quality:Math.min(...edgeQuality),edgeQuality,estimatedEdges,reference:layout.reference,referenceAmbiguous,method:'ratio-prior-continuous-axis-edges'};
  }catch{}
 }
 throw Error('理论位置附近没有形成有效内框，请核对参考比例并手动定位');
}
// An estimate is always a complete centered frame, never a mixture of guessed
// and measured sides. The default is an editable ~2.5 mm border reference.
function estimateInner(outer,options={},reason='内框连续边缘证据不足'){
 const reference=options.profile&&options.profile!=='auto'?innerReferences(options)[0]:innerProfiles.regular;
 const r=G.rectification(G.corners(outer)),x=r.w*(1-reference.width)/2,y=r.h*(1-reference.height)/2;
 const q=[{x,y},{x:r.w-x,y},{x:r.w-x,y:r.h-y},{x,y:r.h-y}].map(p=>G.map(r.inverse,p));
 return{inner:G.edgePoints(q),quality:0,edgeQuality:[0,0,0,0],estimatedEdges:[0,1,2,3],reference,referenceAmbiguous:false,innerSource:'estimated-centered',fallbackReason:reason,method:'centered-ratio-estimate'};
}
function detectInner(gray,w,h,outer,extra=[],options={}){
 innerReferences(options); // Reject invalid user settings instead of hiding them in a fallback.
 let result;
 try{result=inferInner(gray,w,h,outer,extra,options);}catch{return estimateInner(outer,options);}
 if(result.estimatedEdges.length||result.quality<85||result.referenceAmbiguous){
  const fallback=estimateInner(outer,options,result.referenceAmbiguous?'存在多组相近内边界':'内框四边的连续性或可信度不足');
  fallback.detectionQuality=result.quality;return fallback;
 }
 return{...result,innerSource:'detected'};
}
function refineEdge(gray,w,h,points,edge,range,extra=[]){const i=edge*2;if(!points[i]||!points[i+1])throw Error('先为当前边标出两个点');const fit=scanEdge(sampler(gray,w,h,extra),points[i],points[i+1],range,{guided:true}),result=points.map(p=>p?({...p}):null);result[i]=fit.endpoints[0];result[i+1]=fit.endpoints[1];if(result[i].x<0||result[i].y<0||result[i].x>=w||result[i].y>=h||result[i+1].x<0||result[i+1].y<0||result[i+1].x>=w||result[i+1].y>=h)throw Error('拟合边缘超出原图，请重新打点');return{points:result,quality:fit.confidence};}
root.CenterDetector={detectOuter,detectInner,estimateInner,refineEdge,scanEdge};if(typeof module!=='undefined')module.exports=root.CenterDetector;
})(typeof self!=='undefined'?self:globalThis);
