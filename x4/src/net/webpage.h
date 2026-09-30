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
header p{margin:4px 0 0;opacity:.85;font-size:14px}
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
<header><h1>Keeping Watch</h1><p>Your X4, on its own Wi-Fi. Nothing here touches the internet.</p></header>
<main>
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
</main>
<script>
const $=id=>document.getElementById(id);
const PLAN='#Signs a hard time is starting\n\n#Things I can do on my own\n\n#People or places that help\n\n#People I can text\n\n#Professionals\n\n#Making my space safer\n\n#What matters to me\n';
const say=(id,t,ok)=>{const e=$(id);e.textContent=t;e.className='msg '+(ok?'ok':'bad')};
const size=b=>b>1e6?(b/1e6).toFixed(1)+' MB':Math.max(1,Math.round(b/1e3))+' KB';
async function load(){
  try{
    const s=await (await fetch('/api/status')).json();
    const d=new Date(s.now*1000);
    $('clock').textContent=(s.trusted?'The X4 thinks it is ':'Not set. The X4 guesses ')+d.toLocaleString()+(s.battery>=0?' · battery '+s.battery+'%':'');
    const lib=$('library');lib.innerHTML='';
    (s.library||[]).sort((a,b)=>a.n.localeCompare(b.n)).forEach(f=>{const li=document.createElement('li');li.innerHTML='<span></span><small></small>';li.firstChild.textContent=f.n;li.lastChild.textContent=size(f.s);const a=document.createElement('a');a.className='btn';a.textContent='Download';a.setAttribute('aria-label','Download '+f.n);a.href='/api/lib?f='+encodeURIComponent(f.n);li.appendChild(a);lib.appendChild(li)});
    if(!(s.library||[]).length)lib.innerHTML='<li><span>No books on the card yet.</span></li>';
    const logs=$('logs');logs.innerHTML='';
    s.logs.filter(n=>n.endsWith('.csv')).sort().reverse().forEach(n=>{const m=n.slice(0,7);const li=document.createElement('li');li.innerHTML='<span></span>';li.firstChild.textContent=m;const a=document.createElement('a');a.className='btn';a.textContent='Download';a.setAttribute('aria-label','Download check-ins for '+m);a.href='/api/log?m='+m;li.appendChild(a);logs.appendChild(li)});
    if(!logs.children.length)logs.innerHTML='<li><span>No check-ins yet.</span></li>';
  }catch(e){$('clock').textContent='Could not reach the X4. Is this phone still on its Wi-Fi?'}
  try{const t=await (await fetch('/api/me')).text();$('me').value=t.trim()?t:PLAN}catch(e){}
}
$('setTime').onclick=async()=>{const r=await fetch('/api/time',{method:'POST',body:String(Math.floor(Date.now()/1000))});say('timeMsg',await r.text(),r.ok);load()};
$('saveMe').onclick=async()=>{const r=await fetch('/api/me',{method:'POST',body:$('me').value});say('meMsg',await r.text(),r.ok)};
$('upload').onclick=async()=>{const fs=$('files').files;if(!fs.length){say('upMsg','Pick a file first.',false);return}
  for(const f of fs){say('upMsg','Uploading '+f.name+'…',true);const fd=new FormData();fd.append('file',f,f.name);const r=await fetch('/api/upload',{method:'POST',body:fd});say('upMsg',await r.text(),r.ok)}
  load()};
load();
</script></body></html>)HTML";
