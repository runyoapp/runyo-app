// ── runyo Auth & Google Sheets API v4 ─────────────────────────────────────
// PKCE OAuth 2.0 — no backend required
// Token stored in localStorage; re-auth prompt when expired

const GAUTH = {
  AUTH_BACKEND: 'https://runyo-auth-production.up.railway.app',
  CLIENT_ID: '360342745908-n5l0071jgfb76nn0qtj65d9rcmolgbqf.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.send',
  ].join(' '),
  REDIRECT_URI: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/oauth-callback.html',
  TOKEN_KEY: 'gauth_token',
  EXPIRY_KEY: 'gauth_expiry',
  EMAIL_KEY:  'gauth_email',
  SHEET_ID_KEY: 'oauth_sheetId',
  // Google API key voor Drive Picker — aanmaken in Cloud Console →
  // APIs & Services → Credentials → Create API Key → beperk tot Picker API + domein
  PICKER_API_KEY: '',
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
  localStorage.removeItem('runyo_drive_scope_missing');
  _appDataFileIdCache=null;
}
function authClear(){
  [GAUTH.TOKEN_KEY,GAUTH.EXPIRY_KEY,GAUTH.EMAIL_KEY,'gauth_refresh'].forEach(k=>localStorage.removeItem(k));
}
function authEmail(){return localStorage.getItem(GAUTH.EMAIL_KEY)||'';}
function authSheetId(){
  const direct=localStorage.getItem(GAUTH.SHEET_ID_KEY)||'';
  if(direct)return direct;
  // Fallback: look up by email
  const email=localStorage.getItem(GAUTH.EMAIL_KEY)||'';
  if(email){
    const saved=localStorage.getItem('sheetId_'+email)||'';
    if(saved){
      authSetSheetId(saved);
      // Restore tab name (not file name) for API calls
      const tabName=localStorage.getItem('sheetTabName_'+email)||localStorage.getItem('sheetName_'+email)||'';
      if(tabName){localStorage.setItem('sheetName',tabName);if(typeof state!=='undefined')state.sheetName=tabName;}
      return saved;
    }
  }
  return '';
}
function authSetSheetId(id){localStorage.setItem(GAUTH.SHEET_ID_KEY,id);}

// ── OAuth flow ────────────────────────────────────────────────────────────────
// PWA standalone (iOS): redirect flow — geen popups toegestaan.
// Overige browsers: popup met synchrone window.open() voor Safari-compatibiliteit.
async function authSignIn(){
  const isPWA=window.navigator.standalone||window.matchMedia('(display-mode:standalone)').matches;
  const params=new URLSearchParams({
    client_id:    GAUTH.CLIENT_ID,
    redirect_uri: GAUTH.REDIRECT_URI,
    response_type:'code',
    scope:        GAUTH.SCOPES,
    code_challenge_method:'S256',
    access_type:  'offline',
    prompt:       'consent',
  });

  if(isPWA){
    // Redirect flow — sla verifier op, redirect naar Google
    const {verifier,challenge}=await _pkce();
    localStorage.setItem('pkce_verifier',verifier);
    params.set('code_challenge',challenge);
    window.location.href='https://accounts.google.com/o/oauth2/v2/auth?'+params;
    return new Promise(()=>{}); // page navigates away
  }

  // Popup flow — open SYNCHRONOUSLY vóór await (Safari vereist dit)
  const popup=window.open('','gauth','width=520,height=640,left=200,top=80');
  if(!popup)throw new Error('Popup geblokkeerd — sta popups toe voor deze pagina');

  const {verifier,challenge}=await _pkce();
  localStorage.setItem('pkce_verifier',verifier);
  params.set('code_challenge',challenge);
  popup.location.href='https://accounts.google.com/o/oauth2/v2/auth?'+params;

  return new Promise((resolve,reject)=>{
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
    const closedTimer=setInterval(()=>{
      if(popup.closed){
        clearInterval(closedTimer);
        window.removeEventListener('message',onMessage);
        reject(new Error('Inloggen geannuleerd'));
      }
    },500);
  });
}

// Verwerk een OAuth-code die via redirect (iOS PWA) in localStorage is opgeslagen
async function _checkOauthRedirectReturn(){
  const code=localStorage.getItem('oauth_return_code');
  if(!code)return;
  localStorage.removeItem('oauth_return_code');
  try{
    await _exchangeCode(code);
    const em=typeof authEmail==='function'?authEmail():'';
    if(em&&typeof _restoreSettingsFromAccount==='function')_restoreSettingsFromAccount(em);
    if(typeof renderHeader==='function')renderHeader();
    if(typeof _resumePendingImport==='function'&&_resumePendingImport())return;
    if(authSheetId()){
      if(typeof switchTab==='function')switchTab('today');
      if(typeof fetchData==='function')fetchData();
    }else{
      if(typeof showOAuthConnectSheet==='function')showOAuthConnectSheet();
    }
  }catch(e){
    if(typeof showToast==='function')showToast('❌ Inloggen mislukt: '+e.message);
  }
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
  if(typeof state!=='undefined'){state.data=null;state.sheetId='';state.sheetName='';}
  if(typeof renderAccountSection==='function')renderAccountSection();
  if(typeof renderConnectSection==='function')renderConnectSection();
  if(typeof renderHeader==='function')renderHeader();
  if(typeof renderActiveView==='function')renderActiveView();
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
async function getOrCreateRunyoFolder(){
  const cacheKey='runyo_drive_folder_id';
  const cached=localStorage.getItem(cacheKey);
  if(cached)return cached;
  const token=await authEnsureToken();
  // Zoek bestaande runyo map (app-aangemaakt)
  try{
    const q=encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='runyo' and trashed=false");
    const res=await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,{
      headers:{Authorization:'Bearer '+token}
    });
    const data=await res.json();
    if(data.files?.[0]?.id){
      localStorage.setItem(cacheKey,data.files[0].id);
      return data.files[0].id;
    }
  }catch{}
  // Maak nieuwe runyo map
  const res=await fetch('https://www.googleapis.com/drive/v3/files',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({name:'runyo',mimeType:'application/vnd.google-apps.folder'}),
  });
  const folder=await res.json();
  if(folder.id)localStorage.setItem(cacheKey,folder.id);
  return folder.id||null;
}

async function createNewSheet(){
  const token=await authEnsureToken();
  const today=new Date().toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'});
  // Create spreadsheet
  const folderId=await getOrCreateRunyoFolder().catch(()=>null);
  const res=await fetch('https://sheets.googleapis.com/v4/spreadsheets',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({
      properties:{title:`runyo schema ${today}`},
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
  // Verplaats naar 'runyo' map in Drive
  if(folderId){
    fetch(`https://www.googleapis.com/drive/v3/files/${newId}?addParents=${folderId}&removeParents=root&fields=id`,{
      method:'PATCH',headers:{Authorization:'Bearer '+token}
    }).catch(()=>{});
  }
  authSetSheetId(newId);
  shareSheetWithRunyo(newId).catch(()=>{}); // non-blocking
  return{id:newId,url:`https://docs.google.com/spreadsheets/d/${newId}/edit`,title:`runyo schema ${today}`};
}

// ── Gmail send (gmail.send scope) ────────────────────────────────────────────
async function sendGmail(subject, htmlBody){
  const token=await authEnsureToken();
  const to=authEmail();
  const mime=[
    `To: ${to}`,
    `From: runyo <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n');
  const encoded=btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({raw:encoded}),
  });
  if(!res.ok){
    const e=await res.json();
    const msg=e.error?.message||'Gmail fout';
    if(res.status===401||res.status===403)throw new Error('Log opnieuw in om Gmail-toegang te verlenen (nieuwe toestemming vereist)');
    throw new Error(msg);
  }
  return res.json();
}

// ── Google Drive Picker (B14) ─────────────────────────────────────────────────
function openDrivePicker(){
  return new Promise(async(resolve,reject)=>{
    const token=await authEnsureToken();
    const load=()=>{
      if(!window.google?.picker){reject(new Error('Picker niet geladen'));return;}
      const builder=new google.picker.PickerBuilder()
        .addView(new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
          .setIncludeFolders(false))
        .setOAuthToken(token)
        .setCallback(data=>{
          if(data[google.picker.Response.ACTION]===google.picker.Action.PICKED){
            const doc=data[google.picker.Response.DOCUMENTS][0];
            resolve({id:doc[google.picker.Document.ID],name:doc[google.picker.Document.NAME]});
          }else if(data[google.picker.Response.ACTION]===google.picker.Action.CANCEL){
            resolve(null);
          }
        });
      if(GAUTH.PICKER_API_KEY)builder.setDeveloperKey(GAUTH.PICKER_API_KEY);
      builder.build().setVisible(true);
    };
    if(window.gapi&&window.google?.picker){load();}
    else if(window.gapi){gapi.load('picker',load);}
    else{reject(new Error('Google API niet beschikbaar'));}
  });
}

// ── Deel sheet met runyo service account (G16b) ───────────────────────────────
async function shareSheetWithRunyo(sheetId){
  try{
    const token=await authEnsureToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions?sendNotificationEmail=false`,{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({type:'user',role:'reader',emailAddress:'runyo-bot@runyo-app.iam.gserviceaccount.com'}),
    });
  }catch(e){console.warn('[runyo] share met service account mislukt:',e.message);}
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
    if(!datum||!/^\d{4}-\d{2}-\d{2}$/.test(datum))return null; // skip garbage rows like 'xx'
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

let _fetchGen=0;
let _pendingRacesToCopy=[];
async function fetchDataOAuth(){
  const gen=++_fetchGen;
  // Clear immediately so no old data leaks into the new schema's view
  if(typeof state!=='undefined')state.data=null;
  try{
    const rows=await oauthFetchData();
    if(gen!==_fetchGen)return; // stale: a newer fetch already started, discard
    state.data=rows;
    updateConnectionStatus(true);
  }catch(e){
    if(gen!==_fetchGen)return;
    updateConnectionStatus(false,e.message);
    if(e.message.includes('verlopen'))return;
  }
  hideLoading();renderActiveView();renderHeader();if(typeof renderSidebarPlanInfo==="function")renderSidebarPlanInfo();
}

// ── Connect UI ────────────────────────────────────────────────────────────────
async function oauthConnectFlow(){
  const btn=document.getElementById('oauthConnectBtn');
  if(btn){btn.disabled=true;btn.textContent='Bezig…';}
  try{
    await authSignIn();
    if(btn){btn.disabled=false;btn.textContent='Koppel met Google';}
    const _em2=typeof authEmail==='function'?authEmail():'';
    if(_em2&&typeof _restoreSettingsFromAccount==='function')_restoreSettingsFromAccount(_em2);
    // Herstel pending import als gebruiker eerst importeerde, daarna inlogde
    if(typeof _resumePendingImport==='function'&&_resumePendingImport())return;
    if(authSheetId()){
      showToast('✓ Ingelogd');
      if(typeof renderHeader==='function')renderHeader();
      if(typeof renderConnectSection==='function')renderConnectSection();
      if(typeof renderAccountSection==='function')renderAccountSection();
      if(typeof switchTab==='function')switchTab('today');
      if(typeof fetchData==='function')fetchData();
    }else{
      showOAuthConnectSheet();
    }
  }catch(e){
    showToast('❌ '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Koppel met Google';}
  }
}

function showOAuthConnectSheet(){
  const content=document.getElementById('dayModalContent');
  document.getElementById('dayModal').classList.add('open');
  const email=authEmail();
  const allDeleted=typeof _getDeletedSchemas==='function'?_getDeletedSchemas(email):[];
  const list=typeof _getSchemaList==='function'?_getSchemaList(email).filter(s=>!allDeleted.includes(s.id)).slice(0,8):[];
  const histHtml=list.length?`<div style="margin-bottom:14px">
    <div style="font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Eerder gekoppeld</div>
    ${list.map(s=>`<button onclick="oauthSelectSheet('${s.id}','${esc(s.name||s.id)}')" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 10px;margin-bottom:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);cursor:pointer"><span style="font-family:var(--font-m);font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name||s.id)}</span></button>`).join('')}
  </div>`:'';
  content.innerHTML=`<div class="modal-title">Schema koppelen</div>
    <div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin-bottom:14px">Ingelogd als <strong>${esc(email)}</strong></div>
    ${histHtml}
    <button class="btn-primary" style="margin-bottom:8px" onclick="oauthPickExisting()">Bestaand schema koppelen</button>
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
      <div style="font-family:var(--font-d);font-size:13px;font-weight:600;color:var(--muted);letter-spacing:-0.01em;margin-bottom:10px">Recente sheets</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        ${sheets.map(s=>{
          const d=new Date(s.modifiedTime);
          const ago=`${d.getDate()} ${months[d.getMonth()]}`;
          return `<button onclick="oauthSelectSheet('${s.id}','${esc(s.name)}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent">
            <span style="font-family:var(--font-d);font-weight:600;font-size:14px;color:var(--text);letter-spacing:-0.01em">${esc(s.name)}</span>
            <span style="font-family:var(--font-d);font-size:12px;color:var(--muted)">${ago}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn-secondary" style="margin-bottom:10px;display:flex;align-items:center;gap:8px;justify-content:center" onclick="(async()=>{try{const r=await openDrivePicker();if(r)oauthSelectSheet(r.id,r.name);}catch(e){if(typeof showToast==='function')showToast('❌ '+e.message);}})()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        Bladeren in Drive
      </button>
      <div style="font-family:var(--font-d);font-size:13px;color:var(--muted);margin-bottom:6px">Of plak een Sheet URL:</div>
      <input type="url" class="settings-input" id="oauthSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…">
      <button class="btn-secondary" style="margin-top:8px" onclick="oauthSelectFromUrl()">Koppelen via URL</button>`;
  }catch(e){
    content.innerHTML=`<div class="modal-title">Fout</div><div style="color:var(--race-text)">${esc(e.message)}</div>`;
  }
}

async function oauthSelectSheet(sheetId,name){
  if(typeof showLoading==='function')showLoading();
  // C63: capture future races from current schema BEFORE clearing state
  const _curSheetId=authSheetId();
  if(_curSheetId&&_curSheetId!==sheetId&&typeof state!=='undefined'&&state.data){
    const _today=new Date().toISOString().split('T')[0];
    _pendingRacesToCopy=state.data.filter(r=>(r.type==='race'||r.type==='Race'||(typeof normalizeType==='function'&&normalizeType(r.type)==='race'))&&r.datum>=_today);
  }else{_pendingRacesToCopy=[];}
  // BUG7: cancel any in-flight fetch from previous schema, clear its data
  _fetchGen++;
  if(typeof state!=='undefined')state.data=null;
  if(typeof renderActiveView==='function')renderActiveView();
  const content=document.getElementById('dayModalContent');
  content.innerHTML=`<div class="modal-title">Verificatie…</div><div style="color:var(--muted);font-size:12px">Kolommen controleren…</div>`;
  try{
    const result=await verifyOrFixSheet(sheetId);
    if(result.ok){
      await _finalizeOAuthSheet(sheetId,name);
    }else{
      content.innerHTML=`<div class="modal-title">${esc(name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Ontbrekende kolommen: <strong>${result.missing.join(', ')}</strong></div>
        <button class="btn-primary" onclick="oauthFixAndSelect('${sheetId}','${esc(name)}')">Kolommen automatisch toevoegen</button>
        <button class="btn-secondary" style="margin-top:8px" onclick="oauthPickExisting()">Andere sheet kiezen</button>`;
    }
  }catch(e){
    content.innerHTML=`<div class="modal-title">Fout</div><div style="color:var(--race-text)">${esc(e.message)}</div>`;
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
  content.innerHTML=`<div class="modal-title">Schema aanmaken…</div>`;
  if(typeof showLoading==='function')showLoading();
  try{
    const result=await createNewSheet();
    await _finalizeOAuthSheet(result.id,result.title,result.url);
  }catch(e){
    content.innerHTML=`<div class="modal-title">Fout</div><div style="color:var(--race-text);font-size:12px">${esc(e.message)}</div>`;
  }
}

async function _getDriveFileName(sheetId){
  try{
    const token=await authEnsureToken();
    if(!token)return'';
    const res=await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?fields=name`,{
      headers:{Authorization:'Bearer '+token}
    });
    if(!res.ok)return'';
    const json=await res.json();
    return json.name||'';
  }catch(e){return'';}
}

async function _finalizeOAuthSheet(sheetId,name,url){
  // 1. Get tab name + spreadsheet title via Sheets API (works for all accessible sheets)
  let tabName='';let sheetsFileTitle='';
  try{
    const meta=await sheetsGet(`/${sheetId}?fields=properties.title,sheets.properties`);
    tabName=meta.sheets?.[0]?.properties?.title||'';
    sheetsFileTitle=meta.properties?.title||'';
  }catch{}
  // state.sheetName = tab name only (used for API: "TabName!A:K")
  state.sheetName=tabName;
  localStorage.setItem('sheetName',tabName);
  // 2. Display name: spreadsheet title from Sheets API (works even for URL-linked sheets),
  //    fall back to Drive API (for drive.file-scoped sheets), then tab name, then id
  let displayName=sheetsFileTitle||tabName||sheetId;
  try{
    const dn=await _getDriveFileName(sheetId);
    if(dn)displayName=dn;
  }catch{}
  authSetSheetId(sheetId);
  state.sheetId=sheetId;
  localStorage.setItem('sheetId',sheetId);
  localStorage.setItem('driveFileName_'+sheetId,displayName);
  // 3. Persist per email
  const _em=authEmail();
  if(_em){
    localStorage.setItem('sheetId_'+_em,sheetId);
    localStorage.setItem('sheetTabName_'+_em,tabName);
    localStorage.setItem('sheetName_'+_em,tabName);
    localStorage.setItem('sheetFileName_'+_em,displayName);
  }
  const sheetUrl=url||`https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  // 4. Remove from deleted list — user is actively linking this schema
  if(_em){
    try{
      const d=typeof _getDeletedSchemas==='function'?_getDeletedSchemas(_em):[];
      const clean=d.filter(id=>id!==sheetId);
      if(clean.length<d.length)localStorage.setItem('schemaDeleted_'+_em,JSON.stringify(clean));
    }catch{}
  }
  if(typeof _addToSchemaList==='function')_addToSchemaList(_em,{id:sheetId,name:displayName,url:sheetUrl,ts:Date.now()});
  if(typeof _saveSchemaHistory==='function')_saveSchemaHistory(sheetId,displayName,sheetUrl);
  // 5. Cross-device sync: load remote schema list from sheet metadata and merge
  const _sheetMeta=await _loadSchemaListFromSheetMeta(sheetId);
  if(_sheetMeta&&_em){
    try{
      const snapList=JSON.parse(_sheetMeta.schemaList||'[]');
      // Exclude the currently-linked schema from remote deleted list so re-linking always works
      const snapDeleted=JSON.parse(_sheetMeta.schemaDeleted||'[]').filter(id=>id!==sheetId);
      const localDeleted=typeof _getDeletedSchemas==='function'?_getDeletedSchemas(_em):[];
      const allDeleted=[...new Set([...localDeleted,...snapDeleted])];
      if(allDeleted.length!==localDeleted.length)localStorage.setItem('schemaDeleted_'+_em,JSON.stringify(allDeleted));
      const localList=typeof _getSchemaList==='function'?_getSchemaList(_em):[];
      const localIds=new Set(localList.map(s=>s.id));
      const merged=[...localList];
      for(const entry of snapList){
        if(!localIds.has(entry.id)&&!allDeleted.includes(entry.id)){merged.push(entry);localIds.add(entry.id);}
      }
      merged.sort((a,b)=>(b.ts||0)-(a.ts||0));
      localStorage.setItem('schemaList_'+_em,JSON.stringify(merged.slice(0,50)));
    }catch{}
  }
  // Ensure linked schema is in list and not in deleted after merge
  if(_em){
    try{
      const d=typeof _getDeletedSchemas==='function'?_getDeletedSchemas(_em):[];
      const clean=d.filter(id=>id!==sheetId);
      if(clean.length<d.length)localStorage.setItem('schemaDeleted_'+_em,JSON.stringify(clean));
    }catch{}
  }
  if(typeof _addToSchemaList==='function')_addToSchemaList(_em,{id:sheetId,name:displayName,url:sheetUrl,ts:Date.now()});
  if(typeof _syncSettingsToAccount==='function')await _syncSettingsToAccount();
  // Save updated schema list back to sheet metadata
  await _saveSchemaListToSheetMeta(sheetId);
  closeDayModal();
  if(typeof renderHeader==='function')renderHeader();
  if(typeof renderConnectSection==='function')renderConnectSection();
  showToast('✓ Schema gekoppeld');
  await fetchData();
  // C63: offer to copy races from previous schema
  if(typeof _offerRacesCopy==='function')_offerRacesCopy(sheetId);
}

// ── Drive appDataFolder — cross-device settings sync ──────────────────────────
let _appDataFileIdCache=null;

async function _getOrCreateAppDataFile(){
  if(_appDataFileIdCache)return _appDataFileIdCache;
  try{
    const token=await authEnsureToken();
    if(!token)return null;
    const res=await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'runyo-settings.json'&fields=files(id)",{
      headers:{Authorization:'Bearer '+token}
    });
    if(res.status===403){localStorage.setItem('runyo_drive_scope_missing','1');return null;}
    if(!res.ok)return null;
    localStorage.removeItem('runyo_drive_scope_missing');
    const data=await res.json();
    if(data.files?.length){_appDataFileIdCache=data.files[0].id;return _appDataFileIdCache;}
    const form=new FormData();
    form.append('metadata',new Blob([JSON.stringify({name:'runyo-settings.json',parents:['appDataFolder']})],{type:'application/json'}));
    form.append('file',new Blob(['{}'],{type:'application/json'}));
    const cr=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
      method:'POST',headers:{Authorization:'Bearer '+token},body:form
    });
    if(!cr.ok)return null;
    const created=await cr.json();
    _appDataFileIdCache=created.id;
    return _appDataFileIdCache;
  }catch{return null;}
}

async function saveSettingsToAppData(settings){
  try{
    const token=await authEnsureToken();
    if(!token)return;
    const fileId=await _getOrCreateAppDataFile();
    if(!fileId)return;
    const form=new FormData();
    form.append('metadata',new Blob([JSON.stringify({})],{type:'application/json'}));
    form.append('file',new Blob([JSON.stringify(settings)],{type:'application/json'}));
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,{
      method:'PATCH',headers:{Authorization:'Bearer '+token},body:form
    });
  }catch{}
}

async function loadSettingsFromAppData(){
  try{
    const token=await authEnsureToken();
    if(!token)return null;
    const fileId=await _getOrCreateAppDataFile();
    if(!fileId)return null;
    const res=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{
      headers:{Authorization:'Bearer '+token}
    });
    if(!res.ok)return null;
    const data=await res.json();
    // Return null for empty/uninitialized file
    if(!data||Object.keys(data).length===0)return null;
    return data;
  }catch{return null;}
}

// ── Hidden sync tab — cross-device schema list storage ────────────────────────
// Writes JSON to _rxsync!A1 in the connected spreadsheet (hidden tab).
// Uses the same values API as training data — guaranteed to work with
// the existing spreadsheets scope, no developer metadata quirks.
const _SYNC_TAB='_rxsync';
const _syncTabKnown=new Set(); // sheetIds where we've confirmed _rxsync exists this session

async function _saveSchemaListToSheetMeta(sheetId){
  try{
    const email=typeof authEmail==='function'?authEmail():'';
    if(!email||!sheetId)return;
    const value=JSON.stringify({
      schemaList:localStorage.getItem('schemaList_'+email)||'[]',
      schemaDeleted:localStorage.getItem('schemaDeleted_'+email)||'[]',
    });
    if(!_syncTabKnown.has(sheetId)){
      // Check if the tab exists before blindly calling addSheet (avoids 400 in console)
      const meta=await sheetsGet(`/${sheetId}?fields=sheets.properties.title`);
      const exists=meta.sheets?.some(s=>s.properties?.title===_SYNC_TAB);
      if(!exists){
        await sheetsPost(`/${sheetId}:batchUpdate`,{requests:[{addSheet:{properties:{title:_SYNC_TAB}}}]});
      }
      _syncTabKnown.add(sheetId);
    }
    await sheetsPut(`/${sheetId}/values/${_SYNC_TAB}!A1`,{
      range:`${_SYNC_TAB}!A1`,majorDimension:'ROWS',values:[[value]]
    });
  }catch{}
}

async function _loadSchemaListFromSheetMeta(sheetId){
  try{
    const data=await sheetsGet(`/${sheetId}/values/${_SYNC_TAB}!A1`);
    const raw=data.values?.[0]?.[0];
    if(!raw)return null;
    return JSON.parse(raw);
  }catch{return null;}
}
