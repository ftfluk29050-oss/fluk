/* Chart3D — antique 3D sea chart with a sailing caravel (three.js r128).
   Usage: const c = Chart3D(containerEl, {land: LAND_RINGS, onSeaClick(lon,lat,onLand){}}) */
(function(){
const GW=720,GH=360;
function cellOf(lon,lat){let i=Math.floor((((lon+180)%360)+360)%360*2);let j=Math.floor((90-lat)*2);return [Math.min(GW-1,Math.max(0,i)),Math.min(GH-1,Math.max(0,j))]}
function rnd(s){return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646}}
function chaikin(p,it){for(let t=0;t<it;t++){const q=[p[0]];for(let k=0;k<p.length-1;k++){const a=p[k],b=p[k+1];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}q.push(p[p.length-1]);p=q}return p}
function thin(p,step){const o=[p[0]];let acc=0;for(let k=1;k<p.length;k++){acc+=Math.hypot(p[k][0]-p[k-1][0],p[k][1]-p[k-1][1]);if(acc>=step||k===p.length-1){o.push(p[k]);acc=0}}return o}
const hav=(a,b)=>{const R=6371,t=Math.PI/180,dl=(b[1]-a[1])*t,dg=(b[0]-a[0])*t;const h=Math.sin(dl/2)**2+Math.cos(a[1]*t)*Math.cos(b[1]*t)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))};

function webglOK(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl')))}catch(e){return false}}

window.Chart3D=function(container,opts){
  opts=opts||{};
  if(!window.THREE||!webglOK())return null;
  const LAND=opts.land;
  /* ---------- land mask & sea routing ---------- */
  const land=new Uint8Array(GW*GH);
  {const c=document.createElement('canvas');c.width=GW;c.height=GH;const g=c.getContext('2d');g.fillStyle='#000';
   for(const r of LAND){g.beginPath();for(let k=0;k<r.length;k+=2){const x=(r[k]/10+180)*2,y=(90-r[k+1]/10)*2;k?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.fill()}
   const d=g.getImageData(0,0,GW,GH).data;for(let i=0;i<GW*GH;i++)land[i]=d[i*4+3]>110?1:0;
   const carve=(a,b)=>{const n=40;for(let s=0;s<=n;s++){const lon=a[0]+(b[0]-a[0])*s/n,lat=a[1]+(b[1]-a[1])*s/n;const [i,j]=cellOf(lon,lat);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const jj=j+dj;if(jj<0||jj>=GH)continue;land[jj*GW+((i+di+GW)%GW)]=0}}};
   carve([-68.3,-52.4],[-70.5,-53.3]);carve([-70.5,-53.3],[-72.8,-53.6]);carve([-72.8,-53.6],[-76,-52.5]);
   carve([98,5.5],[103.6,1.3]);carve([103.6,1.3],[104.6,1.2]);carve([100.6,13.0],[100.6,13.5]);carve([-6.2,36.2],[-5.3,35.95]);}
  const pen=new Float32Array(GW*GH);
  {const dist=new Int16Array(GW*GH).fill(99);const q=[];for(let i=0;i<GW*GH;i++)if(land[i]){dist[i]=0;q.push(i)}
   for(let h=0;h<q.length;h++){const c=q[h],d=dist[c];if(d>=4)continue;const x=c%GW,y=(c/GW)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const yy=y+dy;if(yy<0||yy>=GH)continue;const n=yy*GW+((x+dx+GW)%GW);if(dist[n]>d+1){dist[n]=d+1;q.push(n)}}}
   for(let i=0;i<GW*GH;i++)pen[i]=[0,0,1.6,.8,.3][Math.min(dist[i],4)]||0}
  const isLand=(lon,lat)=>{const [i,j]=cellOf(lon,lat);return !!land[j*GW+i]};
  function nearestSea(i,j){if(!land[j*GW+i])return [i,j];for(let r=1;r<30;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const jj=j+dj;if(jj<1||jj>=GH-1)continue;const ii=(i+di+GW)%GW;if(!land[jj*GW+ii])return [ii,jj]}return [i,j]}
  function astar(a,b){
    let [si,sj]=nearestSea(...cellOf(a[0],a[1])),[ti,tj]=nearestSea(...cellOf(b[0],b[1]));
    const S=sj*GW+si,T=tj*GW+ti,N=GW*GH;const gs=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
    const hx=(i,j)=>{let dx=Math.abs(i-ti);dx=Math.min(dx,GW-dx);const dy=Math.abs(j-tj);return (dx+dy)+(1.4142-2)*Math.min(dx,dy)};
    const heap=[],hp=[];const push=(n,f)=>{heap.push(n);hp.push(f);let k=heap.length-1;while(k){const p=(k-1)>>1;if(hp[p]<=hp[k])break;[heap[p],heap[k]]=[heap[k],heap[p]];[hp[p],hp[k]]=[hp[k],hp[p]];k=p}};
    const pop=()=>{const top=heap[0];const ln=heap.pop(),lf=hp.pop();if(heap.length){heap[0]=ln;hp[0]=lf;let k=0;for(;;){let l=2*k+1,r=l+1,m=k;if(l<heap.length&&hp[l]<hp[m])m=l;if(r<heap.length&&hp[r]<hp[m])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];[hp[m],hp[k]]=[hp[k],hp[m]];k=m}}return top};
    gs[S]=0;push(S,hx(si,sj));
    while(heap.length){const c=pop();if(c===T)break;if(closed[c])continue;closed[c]=1;const x=c%GW,y=(c/GW)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const yy=y+dy;if(yy<2||yy>=GH-2)continue;const xx=(x+dx+GW)%GW,n=yy*GW+xx;if(land[n]||closed[n])continue;
        if(dx&&dy&&(land[y*GW+xx]&&land[yy*GW+x]))continue;
        const g=gs[c]+(dx&&dy?1.4142:1)+pen[n];if(g<gs[n]){gs[n]=g;from[n]=c;push(n,g+hx(xx,yy))}}}
    if(from[T]<0&&S!==T)return [[a[0],a[1]],[b[0],b[1]]];
    const cells=[];for(let c=T;c!==-1;c=from[c]){cells.push(c);if(c===S)break}cells.reverse();
    const out=[[a[0],a[1]]];let lon=a[0],pi=si;
    for(let k=1;k<cells.length;k++){const x=cells[k]%GW,y=(cells[k]/GW)|0;let dx=x-pi;if(dx>GW/2)dx-=GW;if(dx<-GW/2)dx+=GW;lon+=dx*.5;pi=x;if(k===1){lon=(-180+(x+.5)*.5);lon+=Math.round((a[0]-lon)/360)*360}out.push([lon,90-(y+.5)*.5])}
    const bl=b[0]+Math.round((lon-b[0])/360)*360;out.push([bl,b[1]]);return out}
  function seaPath(a,b){return chaikin(thin(astar(a,b),1.1),3)}
  function buildRoute(pts){let path=[[pts[0].p[0],pts[0].p[1]]];const stops=[{...pts[0],at:0}];
    for(let k=1;k<pts.length;k++){const a=path[path.length-1],b=pts[k].p;const seg=pts[k].river?[a,[b[0]+Math.round((a[0]-b[0])/360)*360,b[1]]]:seaPath(a,b);
      for(let s=1;s<seg.length;s++)path.push(seg[s]);if(!pts[k].via)stops.push({...pts[k],p:[path[path.length-1][0],b[1]],at:path.length-1})}
    return {path,stops}}

  /* ---------- renderer & scene ---------- */
  const W3=36,H3=18;
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;
  const cv=renderer.domElement;cv.style.cssText='display:block;width:100%;height:100%;cursor:crosshair;touch-action:none';container.appendChild(cv);
  const pinLayer=document.createElement('div');pinLayer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';container.appendChild(pinLayer);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#1b120b');scene.fog=new THREE.Fog('#1b120b',60,120);
  const camera=new THREE.PerspectiveCamera(38,1,.05,400);
  scene.add(new THREE.HemisphereLight('#fff1d8','#3a2412',.7));
  const sun=new THREE.DirectionalLight('#ffe9c4',.45);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.5,far:30});sun.shadow.bias=-0.0008;scene.add(sun,sun.target);

  /* chart texture */
  const maxT=renderer.capabilities.maxTextureSize;const TW=maxT>=8192&&innerWidth>900?8192:4096,TH=TW/2;
  const tc=document.createElement('canvas');tc.width=TW;tc.height=TH;const g=tc.getContext('2d');
  const X=lon=>(lon+180)/360*TW,Y=lat=>(90-lat)/180*TH,S=TW/4096;
  function landPath(){g.beginPath();for(const r of LAND){for(let k=0;k<r.length;k+=2){const x=X(r[k]/10),y=Y(r[k+1]/10);k?g.lineTo(x,y):g.moveTo(x,y)}g.closePath()}}
  function rose(cx,cy,r){g.save();g.translate(cx,cy);
    g.strokeStyle='rgba(42,28,16,.75)';g.lineWidth=2*S;g.beginPath();g.arc(0,0,r*.92,0,7);g.stroke();g.beginPath();g.arc(0,0,r*.78,0,7);g.stroke();
    for(let k=0;k<32;k++){const a=k/32*Math.PI*2;g.beginPath();g.moveTo(Math.cos(a)*r*.78,Math.sin(a)*r*.78);g.lineTo(Math.cos(a)*r*(k%2?.84:.92),Math.sin(a)*r*(k%2?.84:.92));g.stroke()}
    const pt=(a,len,w,c1,c2)=>{g.save();g.rotate(a);g.fillStyle=c1;g.beginPath();g.moveTo(0,-len);g.lineTo(w,0);g.lineTo(0,0);g.fill();g.fillStyle=c2;g.beginPath();g.moveTo(0,-len);g.lineTo(-w,0);g.lineTo(0,0);g.fill();g.restore()};
    for(let k=0;k<8;k++)pt(k*Math.PI/4+Math.PI/8,r*.55,r*.07,'#6a5136','#efe0bc');
    for(let k=0;k<4;k++)pt(k*Math.PI/2+Math.PI/4,r*.62,r*.1,'#2e6b62','#e8d6a8');
    for(let k=0;k<4;k++)pt(k*Math.PI/2,r*.95,r*.13,k===0?'#a3361c':'#2a1c10',k===0?'#d9745a':'#efe0bc');
    g.strokeStyle='#2a1c10';g.lineWidth=1.2*S;g.beginPath();g.arc(0,0,r*.08,0,7);g.fillStyle='#c09a4a';g.fill();g.stroke();
    g.font=`italic ${r*.2}px "IM Fell English",Georgia,serif`;g.fillStyle='#a3361c';g.textAlign='center';g.fillText('N',0,-r*1.02);g.restore()}
  function serpent(x,y,dir){g.save();g.translate(x,y);g.scale(dir*S,S);g.strokeStyle='rgba(42,28,16,.55)';g.lineWidth=3;g.fillStyle='rgba(46,107,98,.18)';
    for(let k=0;k<3;k++){g.beginPath();g.ellipse(-40+k*55,0,22,26,0,Math.PI,0);g.fill();g.stroke()}
    g.beginPath();g.moveTo(110,0);g.quadraticCurveTo(130,-50,150,-40);g.quadraticCurveTo(162,-30,150,-18);g.stroke();
    g.beginPath();g.moveTo(-60,0);g.quadraticCurveTo(-90,-20,-100,6);g.stroke();
    for(let k=-2;k<4;k++){g.beginPath();g.moveTo(-120+k*60,6);g.quadraticCurveTo(-105+k*60,0,-90+k*60,6);g.stroke()}g.restore()}
  function drawChart(){const R=rnd(7);
    const bg=g.createLinearGradient(0,0,0,TH);bg.addColorStop(0,'#efdfb8');bg.addColorStop(.5,'#f3e6c4');bg.addColorStop(1,'#e8d3a6');g.fillStyle=bg;g.fillRect(0,0,TW,TH);
    for(let k=0;k<26;k++){const x=R()*TW,y=R()*TH,r=(120+R()*520)*S;const al=.05+R()*.07;for(const ox of [-TW,0,TW]){const s=g.createRadialGradient(x+ox,y,0,x+ox,y,r);s.addColorStop(0,`rgba(150,105,45,${al})`);s.addColorStop(1,'rgba(150,105,45,0)');g.fillStyle=s;g.fillRect(x+ox-r,y-r,2*r,2*r)}}
    for(let k=0;k<26000;k++){g.fillStyle=`rgba(${R()<.5?'90,60,25':'255,250,235'},${R()*.09})`;g.fillRect(R()*TW,R()*TH,1.5*S,1.5*S)}
    g.lineWidth=1.2*S;g.strokeStyle='rgba(80,55,25,.16)';for(let lon=-180;lon<=180;lon+=15){g.beginPath();g.moveTo(X(lon),0);g.lineTo(X(lon),TH);g.stroke()}
    for(let lat=-75;lat<=75;lat+=15){g.beginPath();g.moveTo(0,Y(lat));g.lineTo(TW,Y(lat));g.stroke()}
    g.setLineDash([14*S,10*S]);g.strokeStyle='rgba(163,54,28,.35)';g.lineWidth=2*S;for(const lat of [23.44,-23.44,0]){g.beginPath();g.moveTo(0,Y(lat));g.lineTo(TW,Y(lat));g.stroke()}g.setLineDash([]);
    const roses=[[-32,22],[62,-18],[-150,6],[112,22]],cols=['rgba(42,28,16,.13)','rgba(46,107,98,.16)','rgba(163,54,28,.15)'];
    for(const [lo,la] of roses){const cx=X(lo),cy=Y(la);for(let k=0;k<32;k++){const a=k/32*Math.PI*2;g.strokeStyle=cols[k%4===0?0:(k%2?1:2)];g.lineWidth=(k%4===0?1.6:1)*S;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*TW*.6,cy+Math.sin(a)*TW*.6);g.stroke()}}
    g.save();g.lineJoin='round';for(const [w,a] of [[46,.05],[30,.07],[18,.1],[9,.14]]){landPath();g.strokeStyle=`rgba(46,107,98,${a})`;g.lineWidth=w*S;g.stroke()}g.restore();
    landPath();const lg=g.createLinearGradient(0,0,0,TH);lg.addColorStop(0,'#d8c08a');lg.addColorStop(.5,'#dcc592');lg.addColorStop(1,'#d2b57c');g.fillStyle=lg;g.fill('evenodd');
    g.save();landPath();g.clip('evenodd');for(let k=0;k<9000;k++){g.fillStyle=`rgba(110,75,30,${R()*.12})`;g.fillRect(R()*TW,R()*TH,2*S,2*S)}
    g.strokeStyle='rgba(106,81,54,.35)';g.lineWidth=1.4*S;for(let k=0;k<900;k++){const x=R()*TW,y=R()*TH*.8+TH*.08,s=(6+R()*8)*S;g.beginPath();g.moveTo(x-s,y);g.quadraticCurveTo(x,y-s*1.3,x+s,y);g.stroke()}g.restore();
    landPath();g.strokeStyle='#3a2716';g.lineWidth=2.2*S;g.lineJoin='round';g.stroke();
    rose(X(-32),Y(22),170*S);rose(X(62),Y(-18),120*S);rose(X(-150),Y(6),120*S);
    const lab=(t,lo,la,sz,col,font,italic)=>{g.save();g.font=`${italic?'italic ':''}${sz*S}px ${font}`;g.fillStyle=col;g.textAlign='center';g.textBaseline='middle';g.fillText(t,X(lo),Y(la));g.restore()};
    const th='"Srisakdi","Taviraj",serif',la='"IM Fell English",Georgia,serif';
    lab('มหาสมุทรแอตแลนติก',-38,4,70,'rgba(46,80,74,.8)',th);lab('Mare Oceanum',-38,-0.5,44,'rgba(46,80,74,.7)',la,true);
    lab('มหาสมุทรอินเดีย',75,-8,66,'rgba(46,80,74,.8)',th);lab('Oceanus Indicus',75,-12.5,42,'rgba(46,80,74,.7)',la,true);
    lab('มหาสมุทรแปซิฟิก',-135,-18,70,'rgba(46,80,74,.8)',th);lab('Mar Pacifico',-135,-22.5,44,'rgba(46,80,74,.7)',la,true);
    lab('มหาสมุทรแปซิฟิก',170,24,54,'rgba(46,80,74,.7)',th);
    lab('ยุโรป',18,50,60,'rgba(42,28,16,.78)',th);lab('แอฟริกา',20,8,66,'rgba(42,28,16,.78)',th);lab('เอเชีย',92,48,72,'rgba(42,28,16,.78)',th);
    lab('โลกใหม่',-100,43,60,'rgba(163,54,28,.8)',th);lab('Mundus Novus',-100,38.5,40,'rgba(163,54,28,.7)',la,true);
    lab('ดินแดนที่ยังไม่รู้จัก',-62,-12,52,'rgba(163,54,28,.72)',th);lab('Terra Incognita',-62,-16,36,'rgba(163,54,28,.62)',la,true);
    lab('สยาม',101,17.4,40,'rgba(163,54,28,.9)',th);g.fillStyle='#a3361c';g.beginPath();g.arc(X(100.57),Y(14.36),6*S,0,7);g.fill();
    lab('หมู่เกาะเครื่องเทศ',131,4.5,32,'rgba(42,28,16,.8)',th);lab('อินเดีย',79,21,40,'rgba(42,28,16,.8)',th);
    serpent(X(-50),Y(-35),1);serpent(X(95),Y(-38),-1);serpent(X(-165),Y(35),1)}
  const tex=new THREE.CanvasTexture(tc);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();tex.minFilter=THREE.LinearMipmapLinearFilter;tex.wrapS=THREE.RepeatWrapping;
  function paint(){drawChart();tex.needsUpdate=true}
  paint();
  Promise.race([Promise.all(['700 40px Srisakdi','40px "IM Fell English"','italic 40px "IM Fell English"'].map(f=>document.fonts.load(f))),new Promise(r=>setTimeout(r,3500))]).then(paint).catch(()=>{});
  const mapMat=new THREE.MeshLambertMaterial({map:tex});
  for(const off of [-1,0,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(W3,H3,1,1),mapMat);m.rotation.x=-Math.PI/2;m.position.x=off*W3;m.receiveShadow=true;scene.add(m)}
  {const wc=document.createElement('canvas');wc.width=512;wc.height=512;const w=wc.getContext('2d');w.fillStyle='#3a2414';w.fillRect(0,0,512,512);const R=rnd(3);
   for(let k=0;k<160;k++){w.strokeStyle=`rgba(${R()<.5?'20,10,4':'120,80,45'},${.15+R()*.25})`;w.lineWidth=1+R()*2;w.beginPath();let y=R()*512;w.moveTo(0,y);for(let x=0;x<=512;x+=32){y+=(R()-.5)*6;w.lineTo(x,y)}w.stroke()}
   const wt=new THREE.CanvasTexture(wc);wt.wrapS=wt.wrapT=THREE.RepeatWrapping;wt.repeat.set(16,8);wt.encoding=THREE.sRGBEncoding;
   const table=new THREE.Mesh(new THREE.PlaneGeometry(260,140),new THREE.MeshLambertMaterial({map:wt}));table.rotation.x=-Math.PI/2;table.position.y=-.35;table.receiveShadow=true;scene.add(table);
   const fm=new THREE.MeshLambertMaterial({color:'#5a3a1e'}),fb=new THREE.MeshLambertMaterial({color:'#c09a4a'});
   for(const s of [-1,1]){const bar=new THREE.Mesh(new THREE.BoxGeometry(W3*3+1.2,.5,.6),fm);bar.position.set(0,-.08,s*(H3/2+.3));bar.castShadow=true;scene.add(bar);
     const inl=new THREE.Mesh(new THREE.BoxGeometry(W3*3+1.2,.06,.08),fb);inl.position.set(0,.2,s*(H3/2+.05));scene.add(inl)}
   for(const s of [-1,1]){const bar=new THREE.Mesh(new THREE.BoxGeometry(.6,.5,H3+1.2),fm);bar.position.set(s*(W3*1.5+.3),-.08,0);scene.add(bar)}
   const under=new THREE.Mesh(new THREE.BoxGeometry(W3*3,.3,H3),new THREE.MeshLambertMaterial({color:'#2a1a0e'}));under.position.y=-.17;scene.add(under)}
  const clouds=[];
  {const cc=document.createElement('canvas');cc.width=cc.height=256;const c=cc.getContext('2d');
   for(let k=0;k<14;k++){const x=60+Math.random()*136,y=90+Math.random()*76,r=30+Math.random()*50;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,250,240,.55)');gr.addColorStop(1,'rgba(255,250,240,0)');c.fillStyle=gr;c.fillRect(0,0,256,256)}
   const ct=new THREE.CanvasTexture(cc);for(let k=0;k<9;k++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:.32,depthWrite:false}));const sc=3+Math.random()*4;s.scale.set(sc,sc*.55,1);s.position.set((Math.random()-.5)*W3*1.2,1.6+Math.random()*1.4,(Math.random()-.5)*H3*.7);s.userData.v=.12+Math.random()*.15;scene.add(s);clouds.push(s)}}

  /* caravel */
  function sailTex(nation,lateen){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
    const gr=x.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#fbf3de');gr.addColorStop(1,'#e6d4ac');x.fillStyle=gr;x.fillRect(0,0,256,256);
    x.strokeStyle='rgba(120,90,50,.25)';x.lineWidth=2;for(let k=32;k<256;k+=32){x.beginPath();x.moveTo(k,0);x.lineTo(k,256);x.stroke()}
    if(!lateen){x.fillStyle='#b3261e';if(nation!=='es'){x.fillRect(108,40,40,176);x.fillRect(40,108,176,40);x.fillStyle='#fbf3de';x.fillRect(122,54,12,148);x.fillRect(54,122,148,12)}
    else{x.save();x.translate(128,128);for(const a of [Math.PI/4,-Math.PI/4]){x.save();x.rotate(a);x.fillRect(-14,-100,28,200);x.restore()}x.restore()}}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
  const ship=new THREE.Group(),body=new THREE.Group();ship.add(body);
  {const wood=new THREE.MeshLambertMaterial({color:'#6b4222'}),dark=new THREE.MeshLambertMaterial({color:'#3b2412'}),trim=new THREE.MeshLambertMaterial({color:'#c09a4a'});
   const hull=new THREE.Mesh(new THREE.SphereGeometry(.5,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),wood);hull.scale.set(1,.42,.34);hull.position.y=.13;hull.castShadow=true;body.add(hull);
   const deck=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.03,24),new THREE.MeshLambertMaterial({color:'#a57a4a'}));deck.scale.set(1,1,.34);deck.position.y=.135;body.add(deck);
   const rail=new THREE.Mesh(new THREE.TorusGeometry(.5,.012,6,32),trim);rail.rotation.x=Math.PI/2;rail.scale.set(1,.34,1);rail.position.y=.15;body.add(rail);
   const aft=new THREE.Mesh(new THREE.BoxGeometry(.24,.12,.24),dark);aft.position.set(-.34,.2,0);aft.castShadow=true;body.add(aft);
   const fore=new THREE.Mesh(new THREE.BoxGeometry(.14,.08,.2),dark);fore.position.set(.36,.18,0);body.add(fore);
   const mast=(x,h)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,h,6),dark);m.position.set(x,.14+h/2,0);m.castShadow=true;body.add(m)};
   mast(.16,.78);mast(-.06,.95);mast(-.3,.6);
   const bow=new THREE.Mesh(new THREE.CylinderGeometry(.008,.01,.36,5),dark);bow.rotation.z=-1.1;bow.position.set(.6,.24,0);body.add(bow);
   const sq=(x,y,w,h)=>{const geo=new THREE.PlaneGeometry(w,h,6,6);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i)/w,v=p.getY(i)/h;p.setZ(i,(1-(2*u)**2)*.05+(1-(2*v)**2)*.02)}geo.computeVertexNormals();
     const s=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:sailTex('pt'),side:THREE.DoubleSide}));s.rotation.y=Math.PI/2;s.position.set(x,y,0);s.castShadow=true;body.add(s);return s};
   ship.userData.sails=[sq(.18,.62,.42,.38),sq(-.04,.72,.5,.46),sq(-.04,1.03,.3,.16)];
   const lat=new THREE.Shape();lat.moveTo(0,0);lat.lineTo(.34,0);lat.lineTo(.02,.5);lat.lineTo(0,0);
   const ls=new THREE.Mesh(new THREE.ShapeGeometry(lat),new THREE.MeshLambertMaterial({map:sailTex('pt',1),side:THREE.DoubleSide}));ls.position.set(-.46,.26,0);ls.castShadow=true;body.add(ls);
   const flagGeo=new THREE.PlaneGeometry(.2,.06,8,1);const flag=new THREE.Mesh(flagGeo,new THREE.MeshLambertMaterial({color:'#b3261e',side:THREE.DoubleSide}));flag.position.set(-.16,1.13,0);body.add(flag);
   ship.userData.flagGeo=flagGeo;ship.userData.base=flagGeo.attributes.position.array.slice()}
  scene.add(ship);
  function setNation(n){for(const s of ship.userData.sails){s.material.map=sailTex(n);s.material.needsUpdate=true}}

  /* wake */
  const WAKE=70,wakePos=new Float32Array(WAKE*3),wakeAge=new Float32Array(WAKE).fill(9);
  const wakeGeo=new THREE.BufferGeometry();wakeGeo.setAttribute('position',new THREE.BufferAttribute(wakePos,3));
  const wakeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
  const wake=new THREE.Points(wakeGeo,new THREE.PointsMaterial({map:wakeTex,size:.16,transparent:true,depthWrite:false,opacity:.7,color:'#fffaf0'}));wake.frustumCulled=false;scene.add(wake);let wakeI=0,wakeT=0;

  /* route ribbons */
  function stripTex(kind){const c=document.createElement('canvas');c.width=64;c.height=16;const x=c.getContext('2d');x.fillStyle='#fff';
    if(kind==='dash'){x.fillRect(2,4,42,8)}else{x.beginPath();x.arc(16,8,5,0,7);x.arc(48,8,5,0,7);x.fill()}
    const tt=new THREE.CanvasTexture(c);tt.wrapS=THREE.RepeatWrapping;tt.anisotropy=4;return tt}
  const trailMat=new THREE.MeshBasicMaterial({map:stripTex('dash'),color:'#8e3a1a',transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const planMat=new THREE.MeshBasicMaterial({map:stripTex('dot'),color:'#2a1c10',transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});
  function setPair(pos,uv,ll,i,p,w,u,y){const a=ll[Math.max(0,i-1)],b=ll[Math.min(ll.length-1,i+1)];let tx=(b[0]-a[0]),tz=-(b[1]-a[1]);const L=Math.hypot(tx,tz)||1;tx/=L;tz/=L;const nx=-tz*w/2,nz=tx*w/2,x=p[0]/10,z=-p[1]/10;
    pos.set([x+nx,y,z+nz,x-nx,y,z-nz],i*6);uv.set([u,0,u,1],i*4)}
  function ribbon(ll,w,rep,y){const n=ll.length,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];let d=0;
    for(let i=0;i<n;i++){if(i)d+=Math.hypot(ll[i][0]-ll[i-1][0],ll[i][1]-ll[i-1][1])/10;setPair(pos,uv,ll,i,ll[i],w,d*rep,y)}
    for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(pos,3));gg.setAttribute('uv',new THREE.BufferAttribute(uv,2));gg.setIndex(idx);gg.userData={w,rep,y};return gg}
  let trail=null,plan=null,ribW=0,guide=null,guideLL=null;
  const guideMat=new THREE.MeshBasicMaterial({map:stripTex('dash'),color:'#a3361c',transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});
  const V=(lon,lat,y=.02)=>new THREE.Vector3(lon/10,y,-lat/10);

  /* marker flag */
  const marker=new THREE.Group();
  {const pole=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.5,6),new THREE.MeshLambertMaterial({color:'#2a1c10'}));pole.position.y=.25;marker.add(pole);
   const fl=new THREE.Mesh(new THREE.PlaneGeometry(.22,.13),new THREE.MeshLambertMaterial({color:'#a3361c',side:THREE.DoubleSide}));fl.position.set(.11,.43,0);marker.add(fl);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.08,.11,24),new THREE.MeshBasicMaterial({color:'#a3361c',transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.01;marker.add(ring);marker.userData.ring=ring}
  marker.visible=false;scene.add(marker);

  /* ---------- camera ---------- */
  const cam={tx:0,tz:-2.5,dist:30,pol:.92,az:0,goal:null,follow:false};let tilt3d=true;
  function applyCam(){const h=Math.cos(cam.pol)*cam.dist,r=Math.sin(cam.pol)*cam.dist;camera.position.set(cam.tx+Math.sin(cam.az)*r,h,cam.tz+Math.cos(cam.az)*r);camera.lookAt(cam.tx,0,cam.tz)}
  function flyTo(tx,tz,dist,pol){cam.goal={tx,tz,dist:Math.min(44,Math.max(2.2,dist)),pol:pol??(tilt3d?.92:.08)}}
  let panelFrac=()=>opts.panelFrac?opts.panelFrac():0;
  function fitBounds(pts,pad){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const [lo,la] of pts){x0=Math.min(x0,lo/10);x1=Math.max(x1,lo/10);z0=Math.min(z0,-la/10);z1=Math.max(z1,-la/10)}
    const w=Math.max(x1-x0,1),h=Math.max(z1-z0,1),pf=panelFrac(),vf=camera.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*camera.aspect);
    const dW=(w*1.15/2)/Math.tan(hf/2),dH=(h*1.25/2)/Math.tan(vf/2)/((1-pf)*.72);const d=Math.max(dW,dH)*(pad||1.05)+1;flyTo((x0+x1)/2,(z0+z1)/2+d*(.06+pf*.35),d)}

  /* ---------- sailing ---------- */
  let pathV=[],cum=[0],sPos=0,playing=false,speed=1,pauseT=0,stops=[],stopIdx=0,hooks={},km=0,heading=0,lastLL=opts.start||[-9.6,38.4],sailing=false;
  function ribWidth(){return .045*Math.max(1,cam.dist/9)}
  function buildRibbons(fresh){const w=ribWidth();ribW=w;const drawn=trail&&!fresh?trail.geometry.drawRange.count:0;
    if(trail){scene.remove(trail);trail.geometry.dispose()}if(plan){scene.remove(plan);plan.geometry.dispose()}
    if(guide){scene.remove(guide);guide.geometry.dispose();guide=null}
    if(guideLL){guide=new THREE.Mesh(ribbon(guideLL,w*.7,1/(w*2.4),.008),guideMat);guide.renderOrder=0;guide.frustumCulled=false;scene.add(guide)}
    if(pathV.length<2){trail=plan=null;return}
    plan=new THREE.Mesh(ribbon(pathV,w*.8,1/(w*1.6),.012),planMat);plan.renderOrder=1;plan.frustumCulled=false;scene.add(plan);
    trail=new THREE.Mesh(ribbon(pathV,w,1/(w*3.2),.02),trailMat);trail.renderOrder=2;trail.frustumCulled=false;trail.geometry.setDrawRange(0,drawn);scene.add(trail);trail.userData.mod=-1}
  function posAt(s){let k=1;while(k<cum.length-1&&cum[k]<s)k++;const a=pathV[k-1],b=pathV[k]||a,f=cum[k]>cum[k-1]?Math.min(1,Math.max(0,(s-cum[k-1])/(cum[k]-cum[k-1]))):1;return {ll:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],k}}
  function updTrail(s,k,ll){if(!trail)return;const gg=trail.geometry,pos=gg.attributes.position.array,uv=gg.attributes.uv.array,{w,rep,y}=gg.userData;
    const m=trail.userData.mod;if(m>=0&&m!==k)setPair(pos,uv,pathV,m,pathV[m],w,cum[m]*rep,y);
    setPair(pos,uv,pathV,k,ll,w,s*rep,y);trail.userData.mod=k;gg.attributes.position.needsUpdate=true;gg.attributes.uv.needsUpdate=true;gg.setDrawRange(0,k*6)}
  function sail(path,o){o=o||{};pathV=path;cum=[0];for(let k=1;k<path.length;k++)cum.push(cum[k-1]+Math.hypot(path[k][0]-path[k-1][0],path[k][1]-path[k-1][1])/10);
    sPos=0;stops=o.stops||[];stopIdx=o.skipFirst?1:0;hooks=o;pauseT=o.delay||0;playing=true;sailing=true;if(o.resetKm)km=0;if(o.ink)trailMat.color.set(o.ink);buildRibbons(true);
    if(o.marker){marker.position.copy(V(path[path.length-1][0],path[path.length-1][1],0));marker.visible=true}else marker.visible=false}
  function placeShip(ll){lastLL=ll.slice();const P=V(ll[0],ll[1],0);ship.position.x=P.x;ship.position.z=P.z}
  placeShip(lastLL);

  /* ---------- pins ---------- */
  let pins=[];
  function setPins(list){pins.forEach(p=>p.el.remove());pins=list.map(p=>{p.el.style.position='absolute';p.el.style.left='0';p.el.style.top='0';p.el.style.pointerEvents='auto';pinLayer.appendChild(p.el);return p})}

  /* ---------- input ---------- */
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function pick(cx,cy){const r=cv.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const p=new THREE.Vector3();return ray.ray.intersectPlane(plane,p)?p:null}
  const ptrs=new Map();let down=null,moved=false,pinch=0;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});down={x:e.clientX,y:e.clientY,p:pick(e.clientX,e.clientY)};moved=false;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}});
  cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch){cam.dist=Math.min(44,Math.max(2.2,cam.dist*pinch/d));cam.goal=null}pinch=d;moved=true;return}
    if(!down)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;if(!moved||!down.p)return;
    const p=pick(e.clientX,e.clientY);if(!p)return;cam.tx+=down.p.x-p.x;cam.tz+=down.p.z-p.z;cam.tx=Math.max(-50,Math.min(50,cam.tx));cam.tz=Math.max(-9,Math.min(9,cam.tz));cam.goal=null;cam.follow=false;applyCam()});
  cv.addEventListener('pointerup',e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=0;if(down&&!moved&&ptrs.size===0&&opts.onSeaClick){const p=pick(e.clientX,e.clientY);if(p&&Math.abs(p.z)<H3/2-.2){const lon=p.x*10,lat=-p.z*10;opts.onSeaClick(lon,lat,isLand(lon,lat))}}down=null});
  cv.addEventListener('wheel',e=>{e.preventDefault();cam.dist=Math.min(44,Math.max(2.2,cam.dist*Math.exp(e.deltaY*.0012)));cam.goal=null},{passive:false});

  /* ---------- loop ---------- */
  function resize(){const w=container.clientWidth||innerWidth,h=container.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  addEventListener('resize',resize);resize();
  const clock=new THREE.Clock();let t=0,running=false,raf=0;const tmp=new THREE.Vector3();
  function frame(){if(!running)return;const dt=Math.min(.05,clock.getDelta());t+=dt;
    if(cam.goal){const k=1-Math.pow(.02,dt);for(const q of ['tx','tz','dist','pol'])cam[q]+=(cam.goal[q]-cam[q])*k;if(Math.abs(cam.goal.dist-cam.dist)<.01&&Math.abs(cam.goal.tx-cam.tx)<.005&&Math.abs(cam.goal.tz-cam.tz)<.005)cam.goal=null}
    const total=cum[cum.length-1]||0;
    if(sailing&&playing&&total>0&&sPos<=total){
      if(pauseT>0)pauseT-=dt*speed;
      else{const next=stops[stopIdx]?cum[stops[stopIdx].at]:total;const v=(hooks.pace||2.6)*speed*Math.min(1,.45+cam.dist/30);
        sPos=Math.min(next,sPos+v*dt);
        if(stops[stopIdx]&&sPos>=next){const i=stopIdx;stopIdx++;pauseT=hooks.stopPause??2.2;hooks.onStop&&hooks.onStop(i)}
        if(sPos>=total&&!stops[stopIdx]){sailing=false;marker.visible=false;hooks.onDone&&hooks.onDone()}}
      const {ll,k}=posAt(sPos);km+=hav(lastLL,ll);lastLL=ll;updTrail(sPos,k,ll);
      const P=V(ll[0],ll[1],0),ahead=posAt(Math.min(total,sPos+.05)).ll;const dx=ahead[0]-ll[0],dz=-(ahead[1]-ll[1]);if(Math.hypot(dx,dz)>1e-4){const hh=Math.atan2(-dz,dx);let d=hh-heading;d=Math.atan2(Math.sin(d),Math.cos(d));heading+=d*Math.min(1,dt*4)}
      ship.position.x=P.x;ship.position.z=P.z;hooks.onTick&&hooks.onTick(ll,km);
      wakeT+=dt;if(wakeT>.05&&pauseT<=0){wakeT=0;const i=wakeI++%WAKE;wakePos[i*3]=P.x-Math.cos(heading)*.3*ship.scale.x;wakePos[i*3+1]=.03;wakePos[i*3+2]=P.z+Math.sin(heading)*.3*ship.scale.x;wakeAge[i]=0}
      if(cam.follow){const k2=1-Math.pow(.5,dt);cam.tx+=(P.x-cam.tx)*k2*.35;cam.tz+=(P.z+.4-cam.tz)*k2*.35}}
    const sc=Math.min(1.7,Math.max(.1,cam.dist*.046));ship.scale.setScalar(sc);ship.rotation.y=heading;
    body.rotation.x=Math.sin(t*1.6)*.05;body.rotation.z=Math.sin(t*1.1+1)*.035;body.position.y=Math.sin(t*2)*.012;
    const fp=ship.userData.flagGeo.attributes.position,bs=ship.userData.base;for(let i=0;i<fp.count;i++){const x=bs[i*3];fp.setZ(i,Math.sin(t*7-x*30)*.02*(x+.1)/.2)}fp.needsUpdate=true;
    for(let i=0;i<WAKE;i++){wakeAge[i]+=dt;if(wakeAge[i]>2.2)wakePos[i*3+1]=-5}wakeGeo.attributes.position.needsUpdate=true;wake.material.size=.16*sc/.8;
    marker.userData.ring.scale.setScalar(1+.3*Math.sin(t*4));marker.scale.setScalar(sc);
    for(const c of clouds){c.position.x+=c.userData.v*dt;if(c.position.x>cam.tx+W3*.7)c.position.x=cam.tx-W3*.7}
    sun.position.set(ship.position.x-4,9,ship.position.z+5);sun.target.position.copy(ship.position);
    if((pathV.length>1||guideLL)&&Math.abs(Math.log(ribWidth()/ribW))>.3)buildRibbons(false);
    applyCam();renderer.render(scene,camera);
    const W=cv.clientWidth,H=cv.clientHeight;
    for(const p of pins){let lo=p.ll[0];lo+=Math.round((cam.tx*10-lo)/360)*360;tmp.set(lo/10,.05,-p.ll[1]/10).project(camera);const vis=tmp.z<1&&Math.abs(tmp.x)<1.08&&Math.abs(tmp.y)<1.08;p.el.style.display=vis?'':'none';if(vis)p.el.style.transform=`translate(${(tmp.x*.5+.5)*W}px,${(-tmp.y*.5+.5)*H}px) translate(-50%,${p.below?'0':'-100%'})`}
    raf=requestAnimationFrame(frame)}
  function start(){if(running)return;running=true;clock.getDelta();resize();raf=requestAnimationFrame(frame)}
  function stop(){running=false;cancelAnimationFrame(raf)}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){stop();running=false;cv.dataset.wasRunning='1'}else if(!document.hidden&&cv.dataset.wasRunning){delete cv.dataset.wasRunning;start()}});

  const api={THREE,camera,cam,
    buildRoute,seaPath,isLand,sail,placeShip,setNation,setPins,fitBounds,flyTo,start,stop,resize,
    setInk:c=>trailMat.color.set(c),
    setSpeed:s=>{speed=s},play:()=>{playing=true},pause:()=>{playing=false},isPlaying:()=>playing&&sailing,isSailing:()=>sailing,
    setFollow:f=>{cam.follow=f},
    zoom:f=>flyTo(cam.tx,cam.tz,cam.dist*f,cam.pol),
    toggleTilt:()=>{tilt3d=!tilt3d;flyTo(cam.tx,cam.tz,cam.dist,tilt3d?.92:.08);return tilt3d},
    shipLL:()=>lastLL.slice(),km:()=>km,resetKm:()=>{km=0},
    setCam:(tx,tz,dist)=>{cam.tx=tx;cam.tz=tz;cam.dist=dist;cam.goal=null;applyCam()},
    setGuide:ll=>{guideLL=ll;buildRibbons(false)},
    clearRoute:()=>{pathV=[];cum=[0];sailing=false;buildRibbons(true);marker.visible=false}};
  start();
  return api};
})();
