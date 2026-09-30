#pragma once
// The page the X4 serves on its own hotspot (192.168.4.1). Plain HTML, no external files: the phone
// joining the hotspot has no internet, so fonts and scripts must all be inline.
static const char WEB_PAGE[] = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keeping Watch</title>
<style>
:root{--ink:#1a2238;--paper:#f6f2e8;--line:#d9d2bf;--muted:#5d6479;--night:#121c30;--moon:#e9dfc6;--ok:#2f6b4a;--bad:#9b2f2f;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--ink:#ece4cf;--paper:#0e1626;--line:#2a3654;--muted:#a3a9ba;--night:#0a1120;--ok:#7fc39b;--bad:#e59a9a;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 Georgia,serif}
header{background:var(--night);color:var(--moon);padding:20px 18px}h1{margin:0;font-size:26px;font-weight:600}
header p{margin:4px 0 0;opacity:.85;font-size:14px}[hidden]{display:none!important}
main{max-width:640px;margin:0 auto;padding:6px 18px 40px}
section{border-bottom:1px solid var(--line);padding:18px 0}h2{font-size:18px;margin:0 0 8px}
p.note{color:var(--muted);font-size:14px;margin:4px 0 10px}
button,.btn{font:600 16px system-ui,sans-serif;background:var(--ink);color:var(--paper);border:0;border-radius:4px;padding:0 16px;min-height:44px;min-width:44px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
:focus-visible{outline:3px solid var(--ink);outline-offset:2px;box-shadow:0 0 0 5px var(--paper)}
label{display:block;font:600 15px system-ui,sans-serif;margin:8px 0 4px}input[type=file]{font:16px system-ui,sans-serif;max-width:100%;min-height:44px}@media (forced-colors:active){button,.btn{border:1px solid ButtonText}}
button.ghost{background:none;color:var(--ink);border:1px solid var(--line)}
ul{list-style:none;padding:0;margin:0}li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;min-height:44px;border-top:1px dashed var(--line)}
li span{overflow-wrap:anywhere;font:14px ui-monospace,Menlo,monospace}li small{color:var(--muted);white-space:nowrap}
textarea{width:100%;min-height:260px;font:15px/1.45 ui-monospace,Menlo,monospace;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:10px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.msg{font:14px system-ui,sans-serif;min-height:1.4em}
.ok{color:var(--ok)}.bad{color:var(--bad);font-weight:600}.bad::before{content:'Problem: '}
</style></head><body>
<header><h1>Keeping Watch</h1><p id="hdrNote">Your X4. Nothing here touches the internet.</p></header>
<main>
<section id="pinSec" hidden><h2>PIN</h2><p class="note" id="pinNote">This X4 is on your Wi-Fi, so it asks for the PIN shown on its screen before it shows or changes anything. The PIN is new each time the Wi-Fi screen opens.</p>
<label for="pin">PIN from the X4 screen</label>
<div class="row"><input id="pin" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-describedby="pinNote" style="font:22px ui-monospace,Menlo,monospace;min-height:44px;width:9em;padding:0 10px"><button id="unlock">Unlock</button></div><p class="msg" id="pinMsg" role="status" aria-live="polite"></p></section>

<div id="priv">
<section><h2>Clock</h2><p class="note" id="clock" role="status" aria-live="polite">Checking…</p>
<div class="row"><button id="setTime">Set the X4 to this phone’s time</button></div><p class="msg" id="timeMsg" role="status" aria-live="polite"></p></section>

<section><h2>Books</h2><p class="note">Your journals as PDF and EPUB, stored on the X4’s card. Tap one to download it to this device.</p>
<ul id="library"><li><span>Loading…</span></li></ul></section>

<section><h2>Check-in log</h2><p class="note">One file per month (a spreadsheet opens it). Totals are on the X4 under This month. <b>The card holds the only copy: download this month’s file when you close the month.</b></p>
<ul id="logs"><li><span>Loading…</span></li></ul></section>

<section><h2>My safety plan</h2><p class="note" id="meNote">Lines starting with # are headings. Write under each one. It shows on the X4 under My safety plan.</p>
<label for="me">Your safety plan</label>
<textarea id="me" spellcheck="true" aria-describedby="meNote"></textarea>
<div class="row"><button id="saveMe">Save to the X4</button></div><p class="msg" id="meMsg" role="status" aria-live="polite"></p></section>

<section><h2>Add files</h2><p class="note">Month packs (like 2026-11.txt), checkins.txt, support.txt, or book PDFs and EPUBs. Your safety plan and check-in log are never replaced from here.</p>
<label for="files">Files to add</label>
<div class="row"><input type="file" id="files" multiple accept=".txt,.pdf,.epub"><button id="upload">Upload</button></div><p class="msg" id="upMsg" role="status" aria-live="polite"></p></section>

<section><h2>Wi-Fi</h2><p class="note" id="wifiNote">Checking…</p>
<div class="row"><button id="scan">Look for networks</button></div>
<fieldset id="nets" hidden style="border:0;padding:0;margin:10px 0 0"><legend style="font:600 15px system-ui,sans-serif">Networks in range</legend><ul id="netList"></ul>
<label for="otherName" id="otherL">Or type a network name</label><input id="otherName" autocomplete="off" maxlength="32" style="font:16px system-ui,sans-serif;min-height:44px;width:100%;padding:0 10px">
<label for="wpass">Password</label><input id="wpass" type="password" autocomplete="off" maxlength="63" style="font:16px system-ui,sans-serif;min-height:44px;width:100%;padding:0 10px" aria-describedby="wpassNote">
<p class="note" id="wpassNote">8 to 63 characters, empty for an open network. It goes to the X4 over its own hotspot, is saved only on its card, and is never uploaded.</p>
<div class="row"><label style="display:inline-flex;align-items:center;gap:8px;margin:0;min-height:44px"><input type="checkbox" id="showPass" style="width:24px;height:24px"> Show password</label><button id="join">Join this network</button></div></fieldset>
<p class="msg" id="joinMsg" role="status" aria-live="polite"></p>
<h2 style="margin-top:18px;font-size:16px">Saved on the X4</h2><ul id="saved"><li><span>None yet.</span></li></ul>
<label for="devName">Name on your network</label><p class="note" id="nameNote">Letters, digits and hyphens. The page is then at <b id="nameShow">keeping-watch</b>.local when the X4 is on your Wi-Fi.</p>
<div class="row"><input id="devName" autocomplete="off" maxlength="24" aria-describedby="nameNote" style="font:16px system-ui,sans-serif;min-height:44px;padding:0 10px"><button id="saveName">Save name</button></div><p class="msg" id="nameMsg" role="status" aria-live="polite"></p></section>
</div>
</main>
<script>
const $=id=>document.getElementById(id);
const PLAN='#Signs a hard time is starting\n\n#Things I can do on my own\n\n#People or places that help\n\n#People I can text\n\n#Professionals\n\n#Making my space safer\n\n#What matters to me\n';
const say=(id,t,ok)=>{const e=$(id);e.textContent=t;e.className='msg '+(ok?'ok':'bad')};
const size=b=>b>1e6?(b/1e6).toFixed(1)+' MB':Math.max(1,Math.round(b/1e3))+' KB';
let info=null,nets=[];
async function getInfo(){try{info=await (await fetch('/api/info')).json()}catch(e){info=null}return info}
const FORM={'Content-Type':'application/x-www-form-urlencoded'};
// Over the user's Wi-Fi nothing private shows until the PIN is typed; the hotspot has no PIN (its own password is the gate).
function gate(){
  const locked=!!(info&&info.needPin&&!info.unlocked);
  $('pinSec').hidden=!locked;$('priv').hidden=locked;
  $('hdrNote').textContent=!info?'Could not reach the X4.':info.lan?'Your X4, on '+(info.ssid||'your Wi-Fi')+'. Only devices on this Wi-Fi can open this page.':'Your X4, on its own Wi-Fi. Nothing here touches the internet.';
  if(locked){const bad=info.locked||info.busy;$('pinMsg').className='msg'+(bad?' bad':'');$('pinMsg').textContent=info.locked?'Too many wrong PINs. On the X4 press Back, then open Wi-Fi again for a new PIN.':info.busy?'Another device is using this X4. Try again in a couple of minutes.':''}
  return !locked;
}
// A 401 means the quiet couple of minutes ran out: ask for the PIN again instead of failing silently.
async function guarded(r){if(r.status===401||r.status===423||r.status===429){await getInfo();gate()}return r}
$('unlock').onclick=async()=>{const r=await fetch('/api/unlock',{method:'POST',headers:FORM,body:new URLSearchParams({pin:$('pin').value})});let j={};try{j=await r.json()}catch(e){}
  if(r.ok){$('pin').value='';await start();return}
  say('pinMsg',j.message||'That did not work.',false);if(r.status===429||r.status===423){await getInfo();gate()}};
async function start(){await getInfo();if(gate()){load();wifiLoad()}}
async function wifiLoad(){
  if(!info)return;
  const lan=info.lan;
  $('wifiNote').textContent=lan?'This X4 is on '+(info.ssid||'your Wi-Fi')+'. To use another network, open Wi-Fi on the X4 and choose it, or join from its hotspot.':'Join the X4 to your Wi-Fi to use this page from your usual network. Pick a network and type its password.';
  $('scan').hidden=lan;$('devName').value=info.name;$('nameShow').textContent=info.name;
  try{const r=await guarded(await fetch('/api/net/scan'));if(r.ok){const j=await r.json();nets=j.nets;showSaved(j.saved);if(!lan)showNets()}}catch(e){}
}
function showSaved(list){const ul=$('saved');ul.innerHTML='';
  list.forEach(n=>{const li=document.createElement('li');li.innerHTML='<span></span>';li.firstChild.textContent=n.s+(n.last?' (used last)':'');const b=document.createElement('button');b.className='ghost';b.textContent='Forget';b.setAttribute('aria-label','Forget '+n.s);
    b.onclick=async()=>{const r=await guarded(await fetch('/api/net/forget',{method:'POST',headers:FORM,body:new URLSearchParams({ssid:n.s})}));say('joinMsg',r.ok?'Forgotten: '+n.s+' and its password are gone from the card.':'That did not work.',r.ok);if(r.ok)wifiLoad()};li.appendChild(b);ul.appendChild(li)});
  if(!list.length)ul.innerHTML='<li><span>None yet.</span></li>'}
function showNets(){const ul=$('netList');ul.innerHTML='';$('nets').hidden=false;
  nets.forEach((n,i)=>{const li=document.createElement('li');li.innerHTML='<label style="display:flex;align-items:center;gap:10px;margin:0;min-height:44px;width:100%"><input type="radio" name="net" style="width:24px;height:24px"><span></span></label>';const inp=li.querySelector('input');inp.value=n.s;li.querySelector('span').textContent=n.s+' · '+(n.r>-55?'strong':n.r>-70?'good':'weak')+(n.l?' · password':' · open')+(n.saved?' · saved':'');ul.appendChild(li)});
  if(!nets.length)ul.innerHTML='<li><span>No networks found. Move closer to the router and try again.</span></li>'}
$('scan').onclick=async()=>{say('joinMsg','Looking… this takes a few seconds.',true);const r=await guarded(await fetch('/api/net/scan'));if(!r.ok){say('joinMsg','That did not work.',false);return}const j=await r.json();nets=j.nets;showSaved(j.saved);showNets();say('joinMsg',nets.length+' found.',true)};
$('showPass').onchange=()=>{$('wpass').type=$('showPass').checked?'text':'password'};
$('join').onclick=async()=>{
  const pick=document.querySelector('input[name=net]:checked');const ssid=$('otherName').value.trim()||(pick?pick.value:'');
  if(!ssid){say('joinMsg','Pick a network first.',false);return}
  say('joinMsg','Joining '+ssid+'… Your phone may drop off the X4’s hotspot now. That is normal: let it go back to your usual Wi-Fi, then open the address on the X4’s screen.',true);
  let r;try{r=await fetch('/api/net/join',{method:'POST',headers:FORM,body:new URLSearchParams({ssid:ssid,pass:$('wpass').value})})}catch(e){return}
  $('wpass').value='';
  if(!r.ok){let j={};try{j=await r.json()}catch(e){}say('joinMsg',j.message||'That did not work.',false);await guarded(r);return}
  for(let i=0;i<20;i++){await new Promise(z=>setTimeout(z,2000));const x=await getInfo();
    if(!x)return;   // the phone left the hotspot: the message above says what to do next
    if(x.phase==='wifi'){say('joinMsg','Joined '+x.ssid+'. Reconnect this phone to '+x.ssid+' (it usually does by itself), then open http://'+x.name+'.local/ or http://'+x.ip+'/ and type the PIN shown on the X4.'+(x.why?' '+x.why:''),true);return}
    if(x.phase==='hotspot'&&x.why){say('joinMsg',x.why+' Nothing was saved. Check the password and try again.',false);return}
    if(x.phase==='failed'){say('joinMsg',x.why,false);return}}
  say('joinMsg','Still trying. Look at the X4’s screen.',true)};
$('saveName').onclick=async()=>{const r=await guarded(await fetch('/api/net/name',{method:'POST',headers:FORM,body:new URLSearchParams({name:$('devName').value})}));let j={};try{j=await r.json()}catch(e){}
  if(r.ok){$('nameShow').textContent=j.name;$('devName').value=j.name}say('nameMsg',r.ok?'Saved. The page is at '+j.name+'.local on your Wi-Fi.':(j.message||'That did not work.'),r.ok)};
async function load(){
  try{
    const sr=await guarded(await fetch('/api/status'));if(!sr.ok)return;const s=await sr.json();
    const d=new Date(s.now*1000);
    $('clock').textContent=(s.trusted?'The X4 thinks it is ':'Not set. The X4 guesses ')+d.toLocaleString()+(s.battery>=0?' · battery '+s.battery+'%':'');
    const lib=$('library');lib.innerHTML='';
    (s.library||[]).sort((a,b)=>a.n.localeCompare(b.n)).forEach(f=>{const li=document.createElement('li');li.innerHTML='<span></span><small></small>';li.firstChild.textContent=f.n;li.lastChild.textContent=size(f.s);const a=document.createElement('a');a.className='btn';a.textContent='Download';a.setAttribute('aria-label','Download '+f.n);a.href='/api/lib?f='+encodeURIComponent(f.n);li.appendChild(a);lib.appendChild(li)});
    if(!(s.library||[]).length)lib.innerHTML='<li><span>No books on the card yet.</span></li>';
    const logs=$('logs');logs.innerHTML='';
    s.logs.filter(n=>n.endsWith('.csv')).sort().reverse().forEach(n=>{const m=n.slice(0,7);const li=document.createElement('li');li.innerHTML='<span></span>';li.firstChild.textContent=m;const a=document.createElement('a');a.className='btn';a.textContent='Download';a.setAttribute('aria-label','Download check-ins for '+m);a.href='/api/log?m='+m;li.appendChild(a);logs.appendChild(li)});
    if(!logs.children.length)logs.innerHTML='<li><span>No check-ins yet.</span></li>';
  }catch(e){$('clock').textContent='Could not reach the X4. Is this phone still on its Wi-Fi?'}
  try{const mr=await guarded(await fetch('/api/me'));if(mr.ok){const t=await mr.text();$('me').value=t.trim()?t:PLAN}}catch(e){}
}
const said=async r=>r.status===401?'Type the PIN first.':r.status===423||r.status===429?'This X4 is not taking changes from this device right now.':await r.text();
$('setTime').onclick=async()=>{const r=await guarded(await fetch('/api/time',{method:'POST',body:String(Math.floor(Date.now()/1000))}));say('timeMsg',await said(r),r.ok);load()};
$('saveMe').onclick=async()=>{const r=await guarded(await fetch('/api/me',{method:'POST',body:$('me').value}));say('meMsg',await said(r),r.ok)};
$('upload').onclick=async()=>{const fs=$('files').files;if(!fs.length){say('upMsg','Pick a file first.',false);return}
  for(const f of fs){say('upMsg','Uploading '+f.name+'…',true);const fd=new FormData();fd.append('file',f,f.name);const r=await guarded(await fetch('/api/upload',{method:'POST',body:fd}));say('upMsg',await said(r),r.ok)}
  load()};
start();
</script></body></html>)HTML";
