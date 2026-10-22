importScripts('geometry.js','detector-core.js');
let source=null,W=0,H=0;
// Cache 64 unscaled 256 x 256 tiles (~16 MiB). Square tiles keep both
// horizontal and vertical search bands local, including 200 MP photographs.
function imageSource(bitmap){
 const side=256,limit=64,cache=new Map(),canvas=new OffscreenCanvas(side,side),ctx=canvas.getContext('2d',{willReadFrequently:true});
 function tile(x,y){
  const tx=Math.floor(x/side),ty=Math.floor(y/side),key=ty*Math.ceil(bitmap.width/side)+tx;
  let block=cache.get(key);
  if(block){cache.delete(key);cache.set(key,block);return block;}
  const left=tx*side,top=ty*side,width=Math.min(side,bitmap.width-left),height=Math.min(side,bitmap.height-top);
  ctx.clearRect(0,0,side,side);ctx.drawImage(bitmap,left,top,width,height,0,0,width,height);
  block={data:ctx.getImageData(0,0,width,height).data,width};cache.set(key,block);
  if(cache.size>limit)cache.delete(cache.keys().next().value);
  return block;
 }
 function sample(x,y){
  if(x<0||y<0||x>=bitmap.width-1||y>=bitmap.height-1)return null;
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,lx=ix%side,ly=iy%side;
  const a=tile(ix,iy),b=lx===side-1?tile(ix+1,iy):a,c=ly===side-1?tile(ix,iy+1):a,d=lx===side-1?(ly===side-1?tile(ix+1,iy+1):b):c;
  const ka=(ly*a.width+lx)*4,kb=(ly*b.width+(lx+1)%side)*4,kc=(((ly+1)%side)*c.width+lx)*4,kd=(((ly+1)%side)*d.width+(lx+1)%side)*4,rgb=[];
  for(let k=0;k<3;k++)rgb[k]=(a.data[ka+k]*(1-fx)+b.data[kb+k]*fx)*(1-fy)+(c.data[kc+k]*(1-fx)+d.data[kd+k]*fx)*fy;
  const[r,g,bl]=rgb;return[.299*r+.587*g+.114*bl,(r-bl+255)/2,(2*g-r-bl+510)/4];
 }
 return{sample,close(){cache.clear();bitmap.close();canvas.width=1;canvas.height=1;}};
}
self.onmessage=async({data})=>{
 const{id,type,bitmap,outer,points,edge,range,innerOptions}=data;let detectedOuter=null;
 try{
  if(type==='load'){
   if(source)source.close();source=null;W=bitmap.width;H=bitmap.height;
   try{source=imageSource(bitmap);}catch(e){bitmap.close();throw e;}
   self.postMessage({id,loaded:true,width:W,height:H});return;
  }
  if(!source)throw Error('请先上传图片');
  if(type==='edge'){
   self.postMessage({id,progress:82,label:'原图连续边缘精修'});
   self.postMessage({id,result:CenterDetector.refineEdge(source.sample,W,H,points,edge,range)});return;
  }
  self.postMessage({id,progress:10,label:'寻找卡片长直边与完整外框'});
  const out=outer?{outer,quality:null}:CenterDetector.detectOuter(source.sample,null,W,H,[],(progress,label)=>self.postMessage({id,progress,label}));
  detectedOuter=out.outer;
  self.postMessage({id,stage:'outer',outer:out.outer,outerQuality:out.quality});
  self.postMessage({id,progress:75,label:'外框已定位，核对内框四边可信度'});
  const innerResult=CenterDetector.detectInner(source.sample,W,H,out.outer,[],innerOptions);
  self.postMessage({id,progress:100,label:innerResult.innerSource==='detected'?'内外框识别完成':'外框已定位，内框按居中比例估算'});
  self.postMessage({id,result:{outer:out.outer,...innerResult,outerQuality:out.quality,width:W,height:H}});
 }catch(e){self.postMessage({id,error:e.message||'识别失败，请手动定位',partial:detectedOuter?{outer:detectedOuter}:null});}
};
