/* ScrollTx — antique map scroll page transition.
   Close: the parchment unrolls downward from a wooden rod and covers the page.
   Open:  the parchment rolls back up into the rod, revealing the new page.
   API: ScrollTx.run(midFn, label)  ·  ScrollTx.close(label) -> Promise  ·  ScrollTx.open() -> Promise */
(function(){
const css=`
#stx{position:fixed;left:0;right:0;bottom:0;top:var(--stx-top,0px);z-index:45;pointer-events:none;overflow:hidden;contain:strict}
#stx[hidden]{display:none!important}
#stx.block{pointer-events:auto}
.stx-win{position:absolute;left:0;right:0;top:0;height:100%;overflow:hidden;transform:translateY(-100%);will-change:transform}
.stx-sheet{position:absolute;inset:0;overflow:hidden;transform:translateY(100%);will-change:transform;
  background:
   radial-gradient(60% 50% at 50% 50%,rgba(255,250,232,.75),transparent 70%),
   repeating-linear-gradient(0deg,transparent 0 83px,rgba(90,62,28,.10) 83px 84px),
   repeating-linear-gradient(90deg,transparent 0 83px,rgba(90,62,28,.10) 83px 84px),
   radial-gradient(130% 100% at 50% 50%,#f4e7c6 0%,#e9d6a6 70%,#d9bf85 100%)}
.stx-sheet::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 90px rgba(110,70,25,.35);pointer-events:none}
.stx-rhumb{position:absolute;inset:0;width:100%;height:100%}
.stx-seal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;justify-items:center;gap:6px;text-align:center;color:#2a1c10;width:min(560px,86vw)}
.stx-rose{width:clamp(96px,14vw,138px);height:auto;animation:stxspin 9s linear infinite}
.stx-seal small{font-family:"IM Fell English SC","IM Fell English",Georgia,serif;letter-spacing:.16em;font-size:12.5px;color:#a3361c}
.stx-seal b{font-family:"Srisakdi","Taviraj",Georgia,serif;font-weight:700;font-size:clamp(24px,3.4vw,38px);line-height:1.25}
.stx-seal i{font-style:normal;font-family:"Taviraj","Sarabun",Georgia,serif;font-size:15px;color:#6a5136}
.stx-rule{display:flex;align-items:center;gap:10px;width:200px}.stx-rule::before,.stx-rule::after{content:"";flex:1;height:1px;background:#a98a52}.stx-rule span{width:8px;height:8px;transform:rotate(45deg);background:#a3361c}
.stx-rod{position:absolute;left:0;right:0;height:30px;top:calc(100% - 15px);will-change:transform;
  background:linear-gradient(180deg,#6b4c24 0%,#c9ae76 16%,#f6e8c4 42%,#fff6de 52%,#dcc28b 74%,#7a5a2c 100%);
  box-shadow:0 16px 22px -10px rgba(40,22,6,.55)}
.stx-rod::before,.stx-rod::after{content:"";position:absolute;top:50%;width:46px;height:46px;margin-top:-23px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#b27a42,#6b3f1b 55%,#3a200b);box-shadow:0 0 0 3px #c09a4a inset,0 6px 12px -4px rgba(0,0,0,.6)}
.stx-rod::before{left:-8px}.stx-rod::after{right:-8px}
.stx-rod .curl{position:absolute;left:0;right:0;bottom:100%;height:46px;background:linear-gradient(180deg,rgba(120,80,30,0),rgba(120,80,30,.28));pointer-events:none}
.stx-rod.move{transform:translateY(-200vh)}
.stx-rod.fixed{top:0;height:24px;will-change:auto;box-shadow:0 8px 14px -8px rgba(40,22,6,.5)}
.stx-rod.fixed::before,.stx-rod.fixed::after{width:36px;height:36px;margin-top:-18px}
@keyframes stxspin{to{transform:rotate(360deg)}}
@media (max-width:640px){.stx-rod{height:22px;top:calc(100% - 11px)}.stx-rod::before,.stx-rod::after{width:34px;height:34px;margin-top:-17px}.stx-rod.fixed{height:18px}}
@media (prefers-reduced-motion:reduce){.stx-rose{animation:none}}
`;
const ROSE='<svg class="stx-rose" viewBox="-60 -64 120 124" aria-hidden="true"><circle r="46" fill="none" stroke="#2a1c10" stroke-width="1.6"/><circle r="39" fill="none" stroke="#2a1c10" stroke-width="1"/>'+
 Array.from({length:32},(_,k)=>{const a=k/32*Math.PI*2,r1=39,r2=k%2?42:46;return `<line x1="${(Math.cos(a)*r1).toFixed(1)}" y1="${(Math.sin(a)*r1).toFixed(1)}" x2="${(Math.cos(a)*r2).toFixed(1)}" y2="${(Math.sin(a)*r2).toFixed(1)}" stroke="#2a1c10" stroke-width="1"/>`}).join('')+
 [0,1,2,3,4,5,6,7].map(k=>{const a=k*45+22.5;return `<g transform="rotate(${a})"><path d="M0-28 3.5 0H0z" fill="#6a5136"/><path d="M0-28-3.5 0H0z" fill="#efe0bc"/></g>`}).join('')+
 [0,1,2,3].map(k=>{const a=k*90+45;return `<g transform="rotate(${a})"><path d="M0-32 5 0H0z" fill="#2e6b62"/><path d="M0-32-5 0H0z" fill="#e8d6a8"/></g>`}).join('')+
 [0,1,2,3].map(k=>{const a=k*90;return `<g transform="rotate(${a})"><path d="M0-47 7 0H0z" fill="${k?'#2a1c10':'#a3361c'}"/><path d="M0-47-7 0H0z" fill="${k?'#efe0bc':'#d9745a'}"/></g>`}).join('')+
 '<circle r="4" fill="#c09a4a" stroke="#2a1c10"/><text y="-52" text-anchor="middle" font-family="IM Fell English,Georgia,serif" font-style="italic" font-size="11" fill="#a3361c">N</text></svg>';
const RHUMB='<svg class="stx-rhumb" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+
 Array.from({length:32},(_,k)=>{const a=k/32*Math.PI*2,c=k%4===0?'rgba(42,28,16,.16)':k%2?'rgba(46,107,98,.16)':'rgba(163,54,28,.16)';return `<line x1="0" y1="0" x2="${(Math.cos(a)*400).toFixed(1)}" y2="${(Math.sin(a)*400).toFixed(1)}" stroke="${c}" stroke-width="${k%4===0?.35:.22}"/>`}).join('')+'</svg>';
let root,win,sheet,rod,fixedRod,tEl,sEl,busy=false,queued=null;
function build(){if(root)return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  root=document.createElement('div');root.id='stx';root.hidden=true;root.setAttribute('aria-hidden','true');
  root.innerHTML=`<div class="stx-win"><div class="stx-sheet">${RHUMB}<div class="stx-seal">${ROSE}<small>MAPPA · NAVIGATIO</small><b class="stx-t"></b><div class="stx-rule"><span></span></div><i class="stx-s"></i></div></div></div><div class="stx-rod move"><span class="curl"></span></div><div class="stx-rod fixed"></div>`;
  document.body.appendChild(root);sheet=root.querySelector('.stx-sheet');win=root.querySelector('.stx-win');fixedRod=root.querySelector('.stx-rod.fixed');rod=root.querySelector('.stx-rod.move');tEl=root.querySelector('.stx-t');sEl=root.querySelector('.stx-s')}
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim=(el,kf,o)=>el.animate?el.animate(kf,{fill:'forwards',...o}).finished.catch(()=>{}):Promise.resolve();
function setLabel(label){const [t,s]=Array.isArray(label)?label:[label||'',''];tEl.textContent=t;sEl.textContent=s||'กำลังคลี่แผนที่…';sEl.hidden=false}
function close(label){build();setLabel(label);root.hidden=false;root.classList.add('block');
  if(reduce()||!sheet.animate){win.style.transform='none';sheet.style.transform='none';rod.style.transform='none';return anim(root,[{opacity:0},{opacity:1}],{duration:160})}
  root.style.opacity=1;const e='cubic-bezier(.55,.06,.35,1)',d=620,H=root.clientHeight;
  return Promise.all([anim(rod,[{transform:`translateY(${-H}px)`},{transform:'translateY(0)'}],{duration:d,easing:e}),anim(win,[{transform:'translateY(-100%)'},{transform:'translateY(0)'}],{duration:d,easing:e}),
    anim(sheet,[{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:d,easing:e})])}
function open(){build();
  const clear=el=>{el.getAnimations&&el.getAnimations().forEach(a=>a.cancel());el.style.transform=''};
  const fin=()=>{root.hidden=true;root.classList.remove('block');root.style.opacity='';clear(win);clear(sheet);clear(rod);fixedRod.getAnimations&&fixedRod.getAnimations().forEach(a=>a.cancel())};
  if(reduce()||!sheet.animate){return anim(root,[{opacity:1},{opacity:0}],{duration:180}).then(fin)}
  const e='cubic-bezier(.6,0,.3,1)',d=680,H=root.clientHeight;
  return Promise.all([anim(rod,[{transform:'translateY(0)'},{transform:`translateY(${-H}px)`}],{duration:d,easing:e}),anim(win,[{transform:'translateY(0)'},{transform:'translateY(-100%)'}],{duration:d,easing:e}),
    anim(sheet,[{transform:'translateY(0)'},{transform:'translateY(100%)'}],{duration:d,easing:e})])
   .then(()=>anim(fixedRod,[{opacity:1},{opacity:0}],{duration:160})).then(fin)}
function run(mid,label){if(busy){queued={mid,label};return}busy=true;
  close(label).then(()=>{try{mid&&mid()}catch(e){console.error(e)}return new Promise(r=>setTimeout(r,reduce()?60:220))}).then(open).then(()=>{busy=false;if(queued){const q=queued;queued=null;run(q.mid,q.label)}})}
function covered(label){build();setLabel(label);root.hidden=false;root.classList.add('block');win.style.transform='none';sheet.style.transform='none';rod.style.transform='none'}
function flag(v){try{if(v===undefined)return sessionStorage.getItem('stx');if(v===null)sessionStorage.removeItem('stx');else sessionStorage.setItem('stx',v)}catch(e){return null}}
function leave(href,label){if(busy)return;busy=true;close(label).then(()=>{flag(JSON.stringify(label||''));let gone=false;addEventListener('pagehide',()=>{gone=true},{once:true});location.assign(href);setTimeout(()=>{if(!gone&&!document.hidden){busy=false;open()}},1600)})}
function arrive(){const f=flag();if(!f)return false;flag(null);let l='';try{l=JSON.parse(f)}catch(e){}covered(l);return true}
window.ScrollTx={run,close,open,covered,leave,arrive,isBusy:()=>busy};
})();
