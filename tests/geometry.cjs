const assert=require('node:assert/strict'),G=require('../dist/geometry.js');
global.CenterGeometry=G;const D=require('../dist/detector-core.js');
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// All coordinates exceed typical display sizes, proving computation is independent of preview resolution.
const outer=[{x:2210,y:1400},{x:8510,y:1400},{x:8510,y:10200},{x:2210,y:10200}];
const inner=[{x:2410,y:1700},{x:8210,y:1700},{x:8210,y:9800},{x:2410,y:9800}];
const r=G.measure(outer,inner);near(r.lr,40);near(r.tb,300/700*100);near(r.borders.left,200);near(r.borders.bottom,400);
const warped=[{x:1540.25,y:635.125},{x:9420.75,y:1100.875},{x:8130.35,y:12201.45},{x:600.15,y:10900.6}];
const H=G.homography(outer,warped),m=G.measure(warped,inner.map(p=>G.map(H,p)));near(m.lr,r.lr,1e-6);near(m.tb,r.tb,1e-6);
const p={x:10932.123456789,y:16812.987654321},mapped=G.map(H,p),back=G.map(G.homography(warped,outer),mapped);near(back.x,p.x,1e-6);near(back.y,p.y,1e-6);
assert.throws(()=>G.measure([outer[0],outer[2],outer[1],outer[3]],inner));
assert.throws(()=>G.measure(outer,[{x:0,y:0},...inner.slice(1)]));
// Full-resolution detector, with a rotated rectangular card and known asymmetric inner margins.
const w=1800,h=2500,gray=new Uint8Array(w*h).fill(52),mask=new Uint8Array(w*h),angle=-.028,cos=Math.cos(angle),sin=Math.sin(angle);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-900,dy=y-1250,u=dx*cos+dy*sin+630,v=-dx*sin+dy*cos+880;if(u>=0&&u<1260&&v>=0&&v<1760){mask[y*w+x]=1;gray[y*w+x]=204;if(u>=58&&u<1190&&v>=72&&v<1702)gray[y*w+x]=69;}}
const eightOuter=G.edgePoints(outer),eightInner=G.edgePoints(inner);near(G.measure(eightOuter,eightInner).lr,r.lr);near(G.measure(eightOuter,eightInner).tb,r.tb);const before=JSON.stringify(eightOuter.slice(2));eightOuter[0].y+=2;eightOuter[1].y+=2;assert.equal(JSON.stringify(eightOuter.slice(2)),before);near(G.corners(eightOuter)[0].y,1402);near(G.corners(eightOuter)[1].y,1402);assert.throws(()=>G.corners([null,...eightOuter.slice(1)]));
const out=D.detectOuter(gray,mask,w,h),i=D.detectInner(gray,w,h,out.outer),measured=G.measure(out.outer,i.inner);near(measured.lr,58/128*100,.8);near(measured.tb,72/130*100,.8);assert.equal(out.outer.length,8);assert.equal(i.inner.length,8);
// Anchor relocation changes handles only, including perspective-skewed frames.
for(const quad of [outer,warped]){const points=G.edgePoints(quad);for(let i=0;i<4;i++){const length=Math.hypot(quad[(i+1)%4].x-quad[i].x,quad[(i+1)%4].y-quad[i].y);assert.ok(Math.hypot(points[2*i].x-quad[i].x,points[2*i].y-quad[i].y)<length*.13);const corners=G.corners(points);near(corners[i].x,quad[i].x);near(corners[i].y,quad[i].y);}}
const group=[{x:.1,y:4},{x:12,y:7},{x:2,y:8},{x:9,y:9}],moved=G.translateBounded(group,-100,100,20,20);for(let i=0;i<4;i++){near(moved[i].x-group[i].x,-.1);near(moved[i].y-group[i].y,10);assert.ok(moved[i].x>=0&&moved[i].x<20&&moved[i].y>=0&&moved[i].y<20);}
console.log(JSON.stringify({passed:true,tests:['original high-resolution coordinates','perspective invariance','fractional coordinate preservation','invalid geometry rejection','full-resolution rotated outer and inner detection'],detected:{lr:measured.lr,tb:measured.tb,quality:i.quality}},null,2));
