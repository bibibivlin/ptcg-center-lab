const assert=require('node:assert/strict'),G=require('../dist/geometry.js');global.CenterGeometry=G;const D=require('../dist/detector-core.js');
const rect=[{x:0,y:0},{x:630,y:0},{x:630,y:880} ,{x:0,y:880}];
function fixture(w,h,quad){
 const inverse=G.homography(quad,rect);
 return(x,y)=>{
  if(x<0||y<0||x>=w-1||y>=h-1)return null;
  const p=G.map(inverse,{x,y}),noise=3*Math.sin(x*1.7)*Math.cos(y*.8);
  if(p.x<0||p.y<0||p.x>=630||p.y>=880)return[70+noise+12*y/h,110,150];
  if(p.x<23||p.x>607||p.y<23||p.y>857)return[35+noise,105,145];
  // A much brighter inner rectangle and a strong landscape-shaped art panel.
  if(p.y<410)return[200+20*Math.sin(p.x*.035)*Math.sin(p.y*.02),155,90];
  return[150+25*Math.sin(p.x*.05),100,120];
 };
}
for(const [w,h,quad] of [
 [600,800,[{x:65,y:70},{x:530,y:77},{x:525,y:730},{x:70,y:720}]],
 [800,600,[{x:710,y:65},{x:705,y:530},{x:60,y:525},{x:65,y:70}]],
 [12288,16384,[{x:1500,y:1800},{x:10300,y:1700},{x:10250,y:14000},{x:1600,y:14100}]]
]){
 const result=D.detectOuter(fixture(w,h,quad),null,w,h),actual=G.corners(result.outer);
 // Compare physical corners independent of the starting corner in landscape photos.
 for(const p of actual)assert.ok(Math.min(...quad.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))<Math.max(w,h)*.004,JSON.stringify({w,h,quad,actual}));
 assert.ok(result.quality.every(q=>q>=35));
}
assert.throws(()=>D.detectOuter(()=>[80,128,128],null,600,800),/外边线/);
console.log('Outer-frame regression passed: textured background, dark cut edge, strong artwork, landscape, 200 MP coordinates, blank-image rejection.');
