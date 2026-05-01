// ── RunningX Auth & Google Sheets API v4 ─────────────────────────────────────
// PKCE OAuth 2.0 — no backend required
// Token stored in localStorage; re-auth prompt when expired

const GAUTH = {
  AUTH_BACKEND: 'https://runningx-auth-production.up.railway.app',
  CLIENT_ID: '724112309611-37u5dgrvat37l81tm1lamb1mq06l8erq.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '),
  REDIRECT_URI: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/oauth-callback.html',
  TOKEN_KEY: 'gauth_token',
  EXPIRY_KEY: 'gauth_expiry',
  EMAIL_KEY:  'gauth_email',
  SHEET_ID_KEY: 'oauth_sheetId',
};

// ── PKCE helpers ─────────────────────────────────────────────────────────────
function _b64url(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function _pkce(){
  const verifier=_b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  return{verifier,challenge:_b64url(digest)};
}

// ── Token storage ─────────────────────────────────────────────────────────────
function authGetToken(){return localStorage.getItem(GAUTH.TOKEN_KEY)||'';}
function authIsExpired(){
  const exp=parseInt(localStorage.getItem(GAUTH.EXPIRY_KEY)||'0');
  return Date.now()>exp-60000; // 1 min buffer
}
function authSaveToken(token,expiresIn){
  localStorage.setItem(GAUTH.TOKEN_KEY,token);
  localStorage.setItem(GAUTH.EXPIRY_KEY,String(Date.now()+expiresIn*1000));
}
function authClear(){
  [GAUTH.TOKEN_KEY,GAUTH.EXPIRY_KEY,GAUTH.EMAIL_KEY,'gauth_refresh'].forEach(k=>localStorage.removeItem(k));
}
function authEmail(){return localStorage.getItem(GAUTH.EMAIL_KEY)||'';}
function authSheetId(){return localStorage.getItem(GAUTH.SHEET_ID_KEY)||'';}
function authSetSheetId(id){localStorage.setItem(GAUTH.SHEET_ID_KEY,id);}

// ── OAuth flow — popup-based (PKCE + postMessage) ────────────────────────────
// Opens a popup. After consent Google redirects popup to REDIRECT_URI which
// loads a tiny receiver page that posts the code back via postMessage.
async function authSignIn(){
  const {verifier,challenge}=await _pkce();
  localStorage.setItem('pkce_verifier',verifier);

  const params=new URLSearchParams({
    client_id:    GAUTH.CLIENT_ID,
    redirect_uri: GAUTH.REDIRECT_URI,
    response_type:'code',
    scope:        GAUTH.SCOPES,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    access_type:  'offline',
    prompt:       'consent',
  });

  const url='https://accounts.google.com/o/oauth2/v2/auth?'+params;

  return new Promise((resolve,reject)=>{
    const popup=window.open(url,'gauth','width=520,height=640,left=200,top=80');
    if(!popup){reject(new Error('Popup geblokkeerd — sta popups toe voor deze pagina'));return;}

    // Listen for postMessage from the popup (sent by oauth-callback.html)
    function onMessage(e){
      if(e.origin!==window.location.origin)return;
      if(e.data?.type!=='OAUTH_CODE')return;
      window.removeEventListener('message',onMessage);
      clearInterval(closedTimer);
      popup.close();
      if(e.data.error){reject(new Error(e.data.error));return;}
      _exchangeCode(e.data.code).then(resolve).catch(reject);
    }
    window.addEventListener('message',onMessage);

    // Fallback: detect popup closed without posting
    const closedTimer=setInterval(()=>{
      if(popup.closed){
        clearInterval(closedTimer);
        window.removeEventListener('message',onMessage);
        reject(new Error('Inloggen geannuleerd'));
      }
    },500);
  });
}

async function _exchangeCode(code){
  const verifier=localStorage.getItem('pkce_verifier');
  localStorage.removeItem('pkce_verifier');
  const res=await fetch(GAUTH.AUTH_BACKEND+'/auth/token',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri:  GAUTH.REDIRECT_URI,
    }),
  });
  const json=await res.json();
  if(json.error)throw new Error(json.error_description||json.error);
  authSaveToken(json.access_token,json.expires_in||3600);
  // Store refresh token for silent re-auth
  if(json.refresh_token)localStorage.setItem('gauth_refresh',json.refresh_token);
  // Fetch user email
  try{
    const me=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{
      headers:{Authorization:'Bearer '+json.access_token}
    });
    const info=await me.json();
    if(info.email)localStorage.setItem(GAUTH.EMAIL_KEY,info.email);
  }catch{}
  return json.access_token;
}

async function _refreshToken(){
  const refresh=localStorage.getItem('gauth_refresh');
  if(!refresh)throw new Error('Geen refresh token');
  const res=await fetch(GAUTH.AUTH_BACKEND+'/auth/refresh',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:refresh}),
  });
  const json=await res.json();
  if(json.error)throw new Error(json.error_description||json.error);
  authSaveToken(json.access_token,json.expires_in||3600);
  return json.access_token;
}

// Ensure valid token — re-auth if expired
async function authEnsureToken(){
  if(authGetToken()&&!authIsExpired())return authGetToken();
  // Try silent refresh first
  try{
    const token=await _refreshToken();
    return token;
  }catch{}
  // Refresh failed — show re-auth banner
  showOAuthExpiredBanner();
  throw new Error('Sessie verlopen — log opnieuw in');
}

function showOAuthExpiredBanner(){
  const b=document.getElementById('updateBanner');
  if(!b)return;
  document.getElementById('updateBannerText').textContent='Sessie verlopen';
  b.querySelector('button').textContent='Opnieuw inloggen';
  b.onclick=()=>authSignIn().then(()=>{b.style.display='none';fetchData();});
  b.style.display='flex';
}

function authSignOut(){
  authClear();
  localStorage.removeItem(GAUTH.SHEET_ID_KEY);
  state.data=null;
  renderAccountSection();
  renderConnectSection();
  renderActiveView();
  showToast('Uitgelogd');
}

// ── Google Sheets API v4 ──────────────────────────────────────────────────────
const SHEETS_BASE='https://sheets.googleapis.com/v4/spreadsheets';
const REQUIRED_COLS=['datum','type','titel','detail','km','feedback','fase'];

async function sheetsGet(path,params={}){
  const token=await authEnsureToken();
  const qs=new URLSearchParams(params);
  const res=await fetch(`${SHEETS_BASE}${path}${qs.toString()?'?'+qs:''}`,{
    headers:{Authorization:'Bearer '+token}
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  return res.json();
}

async function sheetsPost(path,body){
  const token=await authEnsureToken();
  const res=await fetch(`${SHEETS_BASE}${path}`,{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  return res.json();
}

async function sheetsPut(path,body){
  const token=await authEnsureToken();
  const url=`${SHEETS_BASE}${path}${path.includes('?')?'&':'?'}valueInputOption=USER_ENTERED`;
  const res=await fetch(url,{
    method:'PUT',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  return res.json();
}

async function drivePost(path,body,params={}){
  const token=await authEnsureToken();
  const qs=new URLSearchParams(params);
  const res=await fetch(`https://www.googleapis.com/drive/v3${path}${qs.toString()?'?'+qs:''}`,{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  return res.json();
}

// ── Sheet structure helpers ───────────────────────────────────────────────────
const ALL_COLS=['datum','type','titel','detail','km','feedback','fase','id','updated_at','created_at','race_type'];

async function getSheetHeaders(sheetId,sheetName=''){
  const range=sheetName?`${sheetName}!A1:Z1`:'A1:Z1';
  const data=await sheetsGet(`/${sheetId}/values/${encodeURIComponent(range)}`);
  return(data.values?.[0]||[]).map(h=>String(h).toLowerCase().trim());
}

async function verifyOrFixSheet(sheetId,sheetName=''){
  const headers=await getSheetHeaders(sheetId,sheetName);
  const missing=REQUIRED_COLS.filter(c=>!headers.includes(c));
  if(!missing.length)return{ok:true,headers};
  return{ok:false,missing,headers};
}

// ── Create new sheet ──────────────────────────────────────────────────────────
async function createNewSheet(){
  const token=await authEnsureToken();
  const today=new Date().toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'});
  // Create spreadsheet
  const res=await fetch('https://sheets.googleapis.com/v4/spreadsheets',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({
      properties:{title:`RunningX — Trainingsschema ${today}`},
      sheets:[{properties:{title:'Schema',index:0}}],
    }),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  const sheet=await res.json();
  const newId=sheet.spreadsheetId;
  // Write headers
  await sheetsPut(`/${newId}/values/Schema!A1:K1`,{
    range:'Schema!A1:K1',
    majorDimension:'ROWS',
    values:[ALL_COLS],
  });
  // Get real tab sheetId
  const meta=await sheetsGet(`/${newId}?fields=sheets.properties`);
  const tabId=meta.sheets?.[0]?.properties?.sheetId??0;
  // Bold + freeze header row, hide system columns H-K
  await sheetsPost(`/${newId}:batchUpdate`,{requests:[
    {repeatCell:{range:{sheetId:tabId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{textFormat:{bold:true}}},fields:'userEnteredFormat.textFormat'}},
    {updateSheetProperties:{properties:{sheetId:tabId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
    {updateDimensionProperties:{range:{sheetId:tabId,dimension:'COLUMNS',startIndex:7,endIndex:11},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
  ]});
  authSetSheetId(newId);
  return{id:newId,url:`https://docs.google.com/spreadsheets/d/${newId}/edit`,title:`RunningX — Trainingsschema ${today}`};
}

// ── Add missing columns to existing sheet ────────────────────────────────────
async function addMissingColumns(sheetId,missing,existingHeaders,sheetName=''){
  const allNeeded=[...existingHeaders];
  missing.forEach(c=>{if(!allNeeded.includes(c))allNeeded.push(c);});
  const range=sheetName?`${sheetName}!A1`:'A1';
  await sheetsPut(`/${sheetId}/values/${encodeURIComponent(range)}`,{
    range,majorDimension:'ROWS',
    values:[allNeeded],
  });
}

// ── Read all rows ─────────────────────────────────────────────────────────────
async function oauthFetchData(){
  const sheetId=authSheetId()||state.sheetId;
  if(!sheetId)throw new Error('Geen sheet gekoppeld');
  const sheetName=state.sheetName||'';
  const range=sheetName?`${sheetName}!A:K`:'A:K';
  const data=await sheetsGet(`/${sheetId}/values/${encodeURIComponent(range)}`);
  const rows=data.values||[];
  if(rows.length<2)return[];
  const headers=rows[0].map(h=>String(h).toLowerCase().trim());
  const getCol=(h,r)=>{const i=headers.indexOf(h);return i>=0?(r[i]||''):'';}
  return rows.slice(1).map((r,i)=>{
    const datum=getCol('datum',r);
    if(!datum)return null;
    return mapRow({
      rowIndex: i+2, // 1-indexed, +1 for header
      datum, type:getCol('type',r), titel:getCol('titel',r),
      detail:getCol('detail',r), km:getCol('km',r),
      feedback:getCol('feedback',r), fase:getCol('fase',r),
      id:getCol('id',r), updated_at:getCol('updated_at',r),
      created_at:getCol('created_at',r), race_type:getCol('race_type',r),
    });
  }).filter(Boolean);
}

// ── Write helpers ─────────────────────────────────────────────────────────────
function _nowISO(){return new Date().toISOString();}
function _uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});}

async function oauthGetHeaders(){
  const sheetId=authSheetId()||state.sheetId;
  return getSheetHeaders(sheetId,state.sheetName||'');
}

async function oauthAddRow(fields){
  const sheetId=authSheetId()||state.sheetId;
  const sheetName=state.sheetName||'Schema';
  const headers=await oauthGetHeaders();
  const row=headers.map(h=>{
    if(h==='id')return fields.id||_uuid();
    if(h==='updated_at'||h==='created_at')return fields[h]||_nowISO();
    return fields[h]||'';
  });
  await sheetsPost(`/${sheetId}/values/${encodeURIComponent(sheetName+'!A:A')}:append`,row);
  // Sort by datum after append
  await oauthSortByDate(sheetId,sheetName);
  await fetchData();
}

async function sheetsAppend(sheetId,sheetName,row){
  const token=await authEnsureToken();
  const range=encodeURIComponent(sheetName+'!A:A');
  const res=await fetch(`${SHEETS_BASE}/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({majorDimension:'ROWS',values:[row]}),
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
  return res.json();
}

async function oauthAddRowDirect(fields){
  const sheetId=authSheetId()||state.sheetId;
  const sheetName=state.sheetName||'Schema';
  const headers=await oauthGetHeaders();
  const row=headers.map(h=>{
    if(h==='id')return fields.id||_uuid();
    if(h==='updated_at'||h==='created_at')return fields[h]||_nowISO();
    return fields[h]!==undefined?String(fields[h]):'';
  });
  await sheetsAppend(sheetId,sheetName,row);
  await fetchData();
}

async function oauthUpdateRow(rowIndex,fields){
  const sheetId=authSheetId()||state.sheetId;
  const sheetName=state.sheetName||'Schema';
  const headers=await oauthGetHeaders();
  // Read current row first
  const range=`${sheetName}!A${rowIndex}:K${rowIndex}`;
  const cur=await sheetsGet(`/${sheetId}/values/${encodeURIComponent(range)}`);
  const existing=cur.values?.[0]||[];
  const row=headers.map((h,i)=>{
    if(h==='updated_at')return _nowISO();
    if(fields[h]!==undefined)return String(fields[h]);
    return existing[i]||'';
  });
  await sheetsPut(`/${sheetId}/values/${encodeURIComponent(range)}`,{
    range,majorDimension:'ROWS',values:[row],
  });
  await fetchData();
}

async function oauthDeleteRow(rowIndex){
  const sheetId=authSheetId()||state.sheetId;
  // Get sheetId (tab id) for the batchUpdate request
  const meta=await sheetsGet(`/${sheetId}?fields=sheets.properties`);
  const sheetName=state.sheetName||'Schema';
  const tabMeta=meta.sheets?.find(s=>s.properties.title===sheetName)||meta.sheets?.[0];
  const tabId=tabMeta?.properties?.sheetId??0;
  await sheetsPost(`/${sheetId}:batchUpdate`,{requests:[{
    deleteDimension:{range:{sheetId:tabId,dimension:'ROWS',startIndex:rowIndex-1,endIndex:rowIndex}}
  }]});
  if(state.data)state.data=state.data.filter(r=>r.rowIndex!==rowIndex);
  if(state.data)state.data.forEach(r=>{if(r.rowIndex>rowIndex)r.rowIndex--;});
}

async function oauthSetFeedback(datum,rating,tekst){
  const sheetId=authSheetId()||state.sheetId;
  const sheetName=state.sheetName||'Schema';
  const row=state.data?.find(r=>r.datum===datum&&r.type!=='work'&&r.type!=='rest');
  if(!row?.rowIndex)throw new Error('Rij niet gevonden: '+datum);
  const emojis=['😵','😓','😐','💪','🔥'];
  const fb=`${rating}/5 ${emojis[rating-1]||''}${tekst?' – '+tekst:''}`;
  const headers=await oauthGetHeaders();
  const fbCol=headers.indexOf('feedback');
  if(fbCol<0)throw new Error('Kolom feedback niet gevonden');
  const colLetter=String.fromCharCode(65+fbCol);
  const range=`${sheetName}!${colLetter}${row.rowIndex}`;
  await sheetsPut(`/${sheetId}/values/${encodeURIComponent(range)}`,{
    range,majorDimension:'ROWS',values:[[fb]],
  });
  row.feedback=fb;
}

async function oauthSortByDate(sheetId,sheetName){
  // Get tab sheetId
  try{
    const meta=await sheetsGet(`/${sheetId}?fields=sheets.properties`);
    const tabMeta=meta.sheets?.find(s=>s.properties.title===sheetName)||meta.sheets?.[0];
    const tabId=tabMeta?.properties?.sheetId??0;
    // Get last row
    const data=await sheetsGet(`/${sheetId}/values/${encodeURIComponent(sheetName+'!A:A')}`);
    const lastRow=(data.values?.length||1);
    if(lastRow<3)return;
    await sheetsPost(`/${sheetId}:batchUpdate`,{requests:[{sortRange:{range:{sheetId:tabId,startRowIndex:1,endRowIndex:lastRow,startColumnIndex:0,endColumnIndex:11},sortSpecs:[{dimensionIndex:0,sortOrder:'ASCENDING'}]}}]});
  }catch{}
}

// ── Sheet picker (Drive file picker fallback via list) ────────────────────────
async function listRecentSheets(){
  const token=await authEnsureToken();
  const res=await fetch("https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'+and+trashed%3Dfalse&orderBy=modifiedTime+desc&pageSize=20&fields=files(id,name,modifiedTime)",{
    headers:{Authorization:'Bearer '+token}
  });
  const json=await res.json();
  return json.files||[];
}

// ── OAuth-aware wrappers that replace Apps Script calls ───────────────────────
// These are called by app.js — they route to OAuth or Apps Script depending on auth state.

function isOAuthMode(){
  return !!(authGetToken()&&!authIsExpired()&&(authSheetId()||state.sheetId));
}

// Override fetchData to use OAuth when available
const _origFetchData=null; // patched below after app.js loads

async function fetchDataOAuth(){
  try{
    state.data=await oauthFetchData();
    updateConnectionStatus(true);
  }catch(e){
    updateConnectionStatus(false,e.message);
    if(e.message.includes('verlopen'))return;
  }
  hideLoading();renderActiveView();renderHeader();
}

// ── Connect UI ────────────────────────────────────────────────────────────────
async function oauthConnectFlow(){
  const btn=document.getElementById('oauthConnectBtn');
  if(btn){btn.disabled=true;btn.textContent='Bezig…';}
  try{
    await authSignIn();
    if(btn){btn.disabled=false;btn.textContent='Koppel met Google';}
    showOAuthConnectSheet();
  }catch(e){
    showToast('❌ '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Koppel met Google';}
  }
}

function showOAuthConnectSheet(){
  const content=document.getElementById('dayModalContent');
  document.getElementById('dayModal').classList.add('open');
  content.innerHTML=`<div class="modal-title">Schema koppelen</div>
    <div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin-bottom:16px">Ingelogd als <strong>${authEmail()}</strong></div>
    <button class="btn-primary" style="margin-bottom:10px" onclick="oauthPickExisting()">Bestaand schema koppelen</button>
    <button class="btn-secondary" onclick="oauthCreateNew()">Nieuw leeg schema aanmaken</button>`;
}

async function oauthPickExisting(){
  const content=document.getElementById('dayModalContent');
  content.innerHTML=`<div class="modal-title">Schema kiezen</div><div style="color:var(--muted);font-size:12px;margin-bottom:12px">Laden…</div>`;
  try{
    const sheets=await listRecentSheets();
    if(!sheets.length){
      content.innerHTML+=`<div style="font-size:12px;color:var(--muted)">Geen Google Sheets gevonden. Maak een nieuw schema aan.</div>
        <button class="btn-primary" style="margin-top:12px" onclick="oauthCreateNew()">Nieuw schema aanmaken</button>`;
      return;
    }
    const months=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    content.innerHTML=`<div class="modal-title">Schema kiezen</div>
      <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Recente sheets</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
        ${sheets.map(s=>{
          const d=new Date(s.modifiedTime);
          const ago=`${d.getDate()} ${months[d.getMonth()]}`;
          return `<button onclick="oauthSelectSheet('${s.id}','${esc(s.name)}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--surface);border:1px solid var(--border);cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent">
            <span style="font-family:var(--font-d);font-weight:700;font-size:14px;color:var(--text)">${esc(s.name)}</span>
            <span style="font-family:var(--font-m);font-size:9px;color:var(--faint)">${ago}</span>
          </button>`;
        }).join('')}
      </div>
      <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);margin-bottom:6px">Of plak een Sheet URL:</div>
      <input type="url" class="settings-input" id="oauthSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…">
      <button class="btn-secondary" style="margin-top:8px" onclick="oauthSelectFromUrl()">Koppelen via URL</button>`;
  }catch(e){
    content.innerHTML=`<div class="modal-title">Fout</div><div style="color:var(--race-text)">${esc(e.message)}</div>`;
  }
}

async function oauthSelectSheet(sheetId,name){
  const el=document.getElementById('dayModalContent');
  el.innerHTML=`<div class="modal-title">Verificatie…</div><div style="color:var(--muted);font-size:12px">Kolommen controleren…</div>`;
  try{
    const result=await verifyOrFixSheet(sheetId);
    if(result.ok){
      await _finalizeOAuthSheet(sheetId,name);
    }else{
      el.innerHTML=`<div class="modal-title">${esc(name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Dit schema mist ${result.missing.length} kolom${result.missing.length>1?'men':''}:</div>
        <div style="font-family:var(--font-m);font-size:10px;color:var(--accent);margin-bottom:14px;letter-spacing:0.5px">${result.missing.join(' · ')}</div>
        <button class="btn-primary" onclick="oauthFixAndSelect('${sheetId}','${esc(name)}')">Automatisch toevoegen en koppelen</button>
        <button class="btn-secondary" style="margin-top:8px" onclick="oauthPickExisting()">Andere sheet kiezen</button>`;
    }
  }catch(e){
    el.innerHTML=`<div class="modal-title">Kan sheet niet lezen</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${esc(e.message)}</div>
      <button class="btn-secondary" onclick="oauthPickExisting()">Terug</button>`;
  }
}

async function oauthFixAndSelect(sheetId,name){
  const result=await verifyOrFixSheet(sheetId);
  if(!result.ok)await addMissingColumns(sheetId,result.missing,result.headers);
  await _finalizeOAuthSheet(sheetId,name);
}

async function oauthSelectFromUrl(){
  const url=document.getElementById('oauthSheetUrl')?.value.trim();
  const m=url?.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if(!m){showToast('Ongeldige Sheet URL');return;}
  await oauthSelectSheet(m[1],url);
}

async function oauthCreateNew(){
  const content=document.getElementById('dayModalContent');
  content.innerHTML=`<div class="modal-title">Schema aanmaken…</div><div style="color:var(--muted);font-size:12px">Even geduld…</div>`;
  try{
    const result=await createNewSheet();
    await _finalizeOAuthSheet(result.id,result.title,result.url);
  }catch(e){
    content.innerHTML=`<div class="modal-title">Fout</div><div style="color:var(--race-text);font-size:12px">${esc(e.message)}</div>`;
  }
}

async function _finalizeOAuthSheet(sheetId,name,url){
  // Detect tab name
  try{
    const meta=await sheetsGet(`/${sheetId}?fields=sheets.properties`);
    const firstName=meta.sheets?.[0]?.properties?.title||'';
    if(firstName)state.sheetName=firstName;
    localStorage.setItem('sheetName',firstName);
  }catch{}
  authSetSheetId(sheetId);
  state.sheetId=sheetId;
  const sheetUrl=url||`https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  closeDayModal();
  renderConnectSection();renderAccountSection();
  showToast('✓ Schema gekoppeld');
  await fetchData();
}
