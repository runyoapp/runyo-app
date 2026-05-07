// ── ACTIVITY DATA MODEL ───────────────────────────────────────────────────────
// Canonical activity enum (English)
const ACTIVITY_ENUM=['run','work','strength','mobility','rest','race','recovery','swim','bike','gym'];

// Dutch → English normalization map (backward compat with sheet values)
const TYPE_NL_MAP={
  werk:'work', rust:'rest', kracht:'strength',
  mobiliteit:'mobility', herstel:'recovery',
  zwemmen:'swim', fietsen:'bike',
};

// Normalize a raw type string from the sheet to canonical enum value
function normalizeType(raw){
  if(!raw)return'rest';
  const t=raw.toLowerCase().trim().split(',')[0].trim();
  return TYPE_NL_MAP[t]||t; // map Dutch, pass through English
}

// Map canonical enum → TYPES display config (English keys added)
const TYPE_DISPLAY={
  run:     {bg:'var(--run-bg)',    text:'var(--run-text)',    i18n:'type_run'},
  work:    {bg:'var(--work-bg)',   text:'var(--work-text)',   i18n:'type_werk'},
  strength:{bg:'var(--str-bg)',    text:'var(--str-text)',    i18n:'type_kracht'},
  mobility:{bg:'var(--mob-bg)',    text:'var(--mob-text)',    i18n:'type_mob'},
  rest:    {bg:'var(--rest-bg)',   text:'var(--rest-text)',   i18n:'type_rust'},
  race:    {bg:'var(--race-bg)',   text:'var(--race-text)',   i18n:'type_race'},
  recovery:{bg:'var(--herstel-bg)',text:'var(--herstel-text)',i18n:'type_herstel'},
  swim:    {bg:'var(--swim-bg)',   text:'var(--swim-text)',   i18n:'type_swim'},
  bike:    {bg:'var(--bike-bg)',   text:'var(--bike-text)',   i18n:'type_bike'},
  gym:     {bg:'var(--gym-bg)',    text:'var(--gym-text)',    i18n:'type_gym'},
  // Dutch aliases for backward compat
  werk:    {bg:'var(--work-bg)',   text:'var(--work-text)',   i18n:'type_werk'},
  kracht:  {bg:'var(--str-bg)',    text:'var(--str-text)',    i18n:'type_kracht'},
  mobiliteit:{bg:'var(--mob-bg)', text:'var(--mob-text)',    i18n:'type_mob'},
  rust:    {bg:'var(--rest-bg)',   text:'var(--rest-text)',   i18n:'type_rust'},
  herstel: {bg:'var(--herstel-bg)',text:'var(--herstel-text)',i18n:'type_herstel'},
  zwemmen: {bg:'var(--swim-bg)',   text:'var(--swim-text)',   i18n:'type_swim'},
  fietsen: {bg:'var(--bike-bg)',   text:'var(--bike-text)',   i18n:'type_bike'},
};

// Normalize distance: "10km" → 10, "800 m" → 0.8, "10" → 10
function normalizeDistance(raw){
  if(!raw&&raw!==0)return null;
  const s=raw.toString().trim().toLowerCase();
  const mMatch=s.match(/^([\d.]+)\s*m$/);
  if(mMatch)return parseFloat(mMatch[1])/1000; // meters to km
  return parseFloat(s)||null;
}

// Format distance for display: <0.1 → meters, else km
function formatDistance(km){
  if(km===null||km===undefined)return'';
  if(km<0.1)return`${Math.round(km*1000)} m`;
  return`${km} km`;
}

// Normalize empty/null values
function normalizeEmptyValues(obj){
  const out={};
  for(const k in obj)out[k]=obj[k]??'';
  return out;
}

function humanError(e){
  const m=e?.message||'';
  if(m.includes('429'))return'Te veel verzoeken — wacht even en probeer opnieuw.';
  if(m.includes('403'))return'Geen toegang tot dit bestand.';
  if(m.includes('401'))return'Sessie verlopen — log opnieuw in.';
  if(m.includes('500')||m.includes('502')||m.includes('503'))return'Er is iets misgegaan, probeer opnieuw.';
  if(m.includes('Failed to fetch')||m.includes('NetworkError'))return'Geen verbinding — controleer je internet.';
  return m;
}

// ── WEATHER ───────────────────────────────────────────────────────────────────
const WMO_EMOJI={
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'❄️',73:'❄️',75:'❄️',77:'❄️',
  80:'🌧️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️',
};
function weatherEmoji(code){return WMO_EMOJI[code]||'🌡️';}

async function fetchLocationByIP(){
  try{
    const r=await fetch('https://ipapi.co/json/');
    const d=await r.json();
    if(!d.latitude)return null;
    return{lat:d.latitude,lon:d.longitude,city:d.city||d.region||'',source:'ip'};
  }catch{return null;}
}

async function geocodeCity(city){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,{headers:{'Accept-Language':'nl'}});
    const d=await r.json();
    if(!d[0])return null;
    return{lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon),city,source:'manual'};
  }catch{return null;}
}

function getWeatherLocation(){
  try{return JSON.parse(localStorage.getItem('weatherLocation')||'null');}catch{return null;}
}
function setWeatherLocation(loc){localStorage.setItem('weatherLocation',JSON.stringify(loc));}

async function ensureWeatherLocation(){
  const saved=getWeatherLocation();
  if(saved?.lat)return saved;
  const loc=await fetchLocationByIP();
  if(loc){setWeatherLocation(loc);}
  return loc;
}

async function fetchWeather(){
  const loc=await ensureWeatherLocation();
  if(!loc)return null;
  const cache=JSON.parse(localStorage.getItem('weatherCache')||'null');
  if(cache&&cache.loc===`${loc.lat},${loc.lon}`&&Date.now()-cache.ts<3600000)return cache.data;
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=weather_code,temperature_2m,precipitation`);
    const d=await r.json();
    const data={code:d.current.weather_code,temp:Math.round(d.current.temperature_2m),precip:d.current.precipitation,city:loc.city};
    localStorage.setItem('weatherCache',JSON.stringify({loc:`${loc.lat},${loc.lon}`,ts:Date.now(),data}));
    return data;
  }catch{return null;}
}

function renderWeatherWidget(){
  const w=JSON.parse(localStorage.getItem('weatherCache')||'null')?.data;
  if(!w)return'';
  return`<div class="weather-widget">${weatherEmoji(w.code)} <span>${w.temp}°C</span><span class="weather-city">${w.city}</span></div>`;
}

async function initWeather(){
  await fetchWeather();
  const el=document.getElementById('weatherWidget');
  if(el)el.outerHTML=renderWeatherWidget()||'';
}

// Activity options for dropdowns — value=canonical English, sheet writes remapped
const ACTIVITY_OPTIONS=[
  {value:'run',      sheet:'run',        nl:'Hardlopen'},
  {value:'work',     sheet:'werk',       nl:'Werk'},
  {value:'strength', sheet:'kracht',     nl:'Kracht'},
  {value:'mobility', sheet:'mobiliteit', nl:'Mobiliteit'},
  {value:'rest',     sheet:'rust',       nl:'Rust'},
  {value:'race',     sheet:'race',       nl:'Race'},
  {value:'recovery', sheet:'herstel',    nl:'Herstel'},
  {value:'swim',     sheet:'zwemmen',    nl:'Zwemmen'},
  {value:'bike',     sheet:'fietsen',    nl:'Fietsen'},
  {value:'gym',      sheet:'gym',        nl:'Gym'},
];
// Map canonical type back to Dutch sheet value
function toSheetType(canonical){
  return ACTIVITY_OPTIONS.find(o=>o.value===canonical)?.sheet||canonical;
}

// ── DATA SERVICE LAYER ────────────────────────────────────────────────────────
// Thin wrappers — UI always goes through these, never calls sheet directly.

function getActivities(filters={}){
  let rows=state.data||[];
  // Support both old (datum/fase) and new (date/phase) field names
  if(filters.date)rows=rows.filter(r=>(r.date||r.datum)===filters.date);
  if(filters.phase)rows=rows.filter(r=>(r.phase||r.fase)===filters.phase);
  if(filters.fase)rows=rows.filter(r=>(r.fase||r.phase)===filters.fase);
  if(filters.type)rows=rows.filter(r=>r.type===filters.type);
  if(filters.excludeTypes)rows=rows.filter(r=>!filters.excludeTypes.includes(r.type));
  return rows;
}

// C52: find the fase for a given date from existing data
function getFaseForDate(datum){
  if(!state.data||!datum)return'';
  // Find rows around this date to determine fase
  const sorted=[...state.data].filter(r=>r.fase&&r.datum).sort((a,b)=>a.datum.localeCompare(b.datum));
  let fase='';
  for(const r of sorted){
    if(r.datum<=datum)fase=r.fase;
    else break;
  }
  return fase;
}

async function createActivity(fields){
  // fields: {datum, type, titel, detail, km, fase}
  const normalized={...fields, type: fields.type||'rest'};
  if(state.scriptUrl){
    await sheetAddRow(normalized);
  }else{
    if(!state.data)state.data=[];
    state.data.push({...normalized,feedback:'',rowIndex:null});
    renderActiveView();
  }
}

async function updateActivity(rowIndex,fields){
  if(state.scriptUrl){
    await sheetUpdateRow(rowIndex,fields);
  }else{
    const row=state.data?.find(r=>r.rowIndex===rowIndex);
    if(row)Object.assign(row,fields);
    renderActiveView();
  }
}

async function deleteActivityById(rowIndex){
  // Undo buffer — keep for 10 seconds
  const row=state.data?.find(r=>r.rowIndex===rowIndex);
  if(row){
    state._undoBuffer={row,timeout:setTimeout(()=>{state._undoBuffer=null;},10000)};
  }
  if(state.scriptUrl){
    await sheetDeleteRow(rowIndex);
  }else{
    if(state.data)state.data=state.data.filter(r=>r.rowIndex!==rowIndex);
    renderActiveView();
  }
}

// ── CONSTANTS (keep for backward compat) ─────────────────────────────────────
// TYPES is now an alias for TYPE_DISPLAY for backward compat
const TYPES=TYPE_DISPLAY;
const TYPE_FALLBACK=TYPES.rest;



const PR_ORDER=['800m','1500m','1mile','5km','10km','10mile','HM','M'];
const DAYS_NL=['Ma','Di','Wo','Do','Vr','Za','Zo'];
const DAYS_EN=['Mo','Tu','We','Th','Fr','Sa','Su'];
const MONTHS_FULL_NL=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const MONTHS_FULL_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_NL=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const MONTHS_EN=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// ── I18N ─────────────────────────────────────────────────────────────────────
const STRINGS={
  nl:{
    today:'Vandaag',week:'Week',plan:'Training',calendar:'Kalender',stats:'Stats',settings:'Instellingen',
    sg_account:'Account',sg_profile:'Profiel',sg_notif:'Notificaties',sg_connect:'Koppeling',sg_app:'App',
    your_name:'Jouw naam',
    pr_title:'Persoonlijke records',pr_add:'Afstand toevoegen',pr_none:'Nog geen records toegevoegd.',
    lang_title:'Taal',
    notif_telegram_title:'Telegram',notif_telegram:'Gebruikersnaam',notif_hint:'Koppel je Telegram-account om dagelijkse schema\'s, weekoverzichten en feedback-verzoeken te ontvangen.',
    tg_not_linked:'Niet gekoppeld',tg_linked:'Gekoppeld',tg_verify:'Koppeling starten',tg_verifying:'Verificatie starten…',tg_verify_hint:'Stuur /start naar @runyo_appbot in Telegram om de koppeling te bevestigen.',
    schema_title:'Koppel je trainingsschema',schema_hint:'Plak de URL van je gepubliceerde Google Apps Script Web App.',
    sheet_name_label:'Tabblad naam (optioneel)',sheet_name_hint:'Laat leeg om het eerste tabblad automatisch te gebruiken.',
    api_save:'Opslaan & verbinden',not_connected:'Niet verbonden',
    connected:'Verbonden ✓',conn_err:'Fout',
    enter_url:'Voer een URL in',connecting:'Verbinding testen…',
    goal_dist:'Afstand',goal_time:'Doeltijd',goal_race:'Race naam',goal_date:'Racedatum',
    rest_day:'Rustdag',rest_msg:'Vandaag herstel je. Morgen ga je er weer voor.',
    mob_reminder:'Mobiliteit',mob_text:'Dagelijkse routine',
    tomorrow:'Morgen',setup_title:'Koppel je trainingsschema',setup_body:'Ga naar Instellingen → Koppeling.',
    no_schema:'Koppel je trainingsschema',
    feedback_q:'Hoe ging het?',feedback_save:'Feedback opslaan',notes_q:'Notities',notes_save:'Opslaan',
    feedback_logged:'✓ Gelogd',feedback_edit:'Aanpassen',feedback_update:'Bijwerken',feedback_cancel:'Annuleren',
    select_score:'Selecteer eerst een score',
    week_km:'km gepland',week_sessions:'sessies',week_werk:'werkdagen',
    week_progress:'Weekvoortgang',week_done:'gedaan',week_feedback:'feedback',week_todo:'Nog te doen',
    type_run:'Hardlopen',type_kracht:'Kracht',type_mob:'Mobiliteit',type_race:'Race',type_werk:'Werk',type_rust:'Rust',type_herstel:'Herstel',type_swim:'Zwemmen',type_bike:'Fietsen',type_gym:'Gym',
    days_ago:'geweest',days_today:'Vandaag!',days_label:'dagen',weeks_label:'weken',months_label:'maanden',
    hm:'Halve marathon',marathon:'Marathon',other_dist:'Vrij invoer',
    stats_total:'Totaal km',stats_done:'km in plan',stats_days:'Dagen tot race',
    stats_runs:'Runs gelogd',stats_sessions:'sessies gedaan',stats_week:'Deze week',stats_week_sub:'km tot nu toe',
    stats_feel:'Gem. gevoel',stats_feedback:'Feedback',stats_fb_sub:'sessies',stats_recent:'Recente feedback',
    no_data:'Geen data',
    race_add:'Voeg race toe +',race_name:'Race naam',race_date:'Datum',race_dist:'Afstand',race_type:'Type race',race_main:'Hoofddoel',race_save:'Race opslaan',race_delete:'Verwijderen',race_edit:'Bewerken',
    race_saved:'✓ Race opgeslagen',race_deleted:'Race verwijderd',race_required:'Naam en datum zijn verplicht',
    main_goal:'Hoofddoel',
    cal_add_race:'Voeg race toe +',races_this_month:'Races deze maand',no_races_month:'Geen races deze maand.',
    saved:'✓ Opgeslagen',
    update_available:'🔄 Update beschikbaar',update_apply:'Nu updaten',
    account_title:'Inloggen',account_hint:'Log in om je gegevens te synchroniseren (binnenkort beschikbaar).',
    email_placeholder:'naam@voorbeeld.nl',login_btn:'Inloggen',logout_btn:'Uitloggen',
    logged_in_as:'Ingelogd als',not_logged_in:'Niet ingelogd',
    edit_day:'Dag bewerken',field_titel:'Titel',field_type:'Type',field_km:'Km',field_detail:'Detail',field_emoji:'Emoji',save_changes:'Wijzigingen opslaan',
    pr_placeholder:'bijv. 37:56',
    connect_sheet:'Schema koppelen',connect_active:'Gekoppeld',connect_disconnect:'Ontkoppelen',connect_url_placeholder:'https://script.google.com/macros/s/…/exec',
    connect_hint:'Plak de URL van je gepubliceerde Google Apps Script.',connect_disconnected:'Niet gekoppeld',
    week_label:'Week',next_fase:'Volgende fase',
    add_training:'Training toevoegen',type_label:'Type',
    race_to_sheet:'Race opgeslagen in schema',race_to_sheet_err:'Race lokaal opgeslagen (geen schema)',
  },
  en:{
    today:'Today',week:'Week',plan:'Training',calendar:'Calendar',stats:'Stats',settings:'Settings',
    sg_account:'Account',sg_profile:'Profile',sg_notif:'Notifications',sg_connect:'Connection',sg_app:'App',
    your_name:'Your name',
    pr_title:'Personal records',pr_add:'Add distance',pr_none:'No records added yet.',
    lang_title:'Language',
    notif_telegram_title:'Telegram',notif_telegram:'Username',notif_hint:'Connect your Telegram account to receive daily schedules, weekly overviews and feedback reminders.',
    tg_not_linked:'Not linked',tg_linked:'Linked',tg_verify:'Start linking',tg_verifying:'Starting verification…',tg_verify_hint:'Send /start to @runyo_appbot in Telegram to confirm the link.',
    schema_title:'Connect your training schedule',schema_hint:'Paste the URL of your published Google Apps Script Web App.',
    sheet_name_label:'Sheet tab name (optional)',sheet_name_hint:'Leave empty to auto-detect the first tab.',
    api_save:'Save & connect',not_connected:'Not connected',
    connected:'Connected ✓',conn_err:'Error',
    enter_url:'Enter a URL',connecting:'Testing connection…',
    goal_dist:'Distance',goal_time:'Target time',goal_race:'Race name',goal_date:'Race date',
    rest_day:'Rest day',rest_msg:'Today you recover. Tomorrow you push.',
    mob_reminder:'Mobility',mob_text:'Daily routine',
    tomorrow:'Tomorrow',setup_title:'Connect your training schedule',setup_body:'Go to Settings → Connection.',
    no_schema:'Connect your training schedule',
    feedback_q:'How did it go?',feedback_save:'Save feedback',notes_q:'Notes',notes_save:'Save',
    feedback_logged:'✓ Logged',feedback_edit:'Edit',feedback_update:'Update',feedback_cancel:'Cancel',
    select_score:'Select a score first',
    week_km:'km planned',week_sessions:'sessions',week_werk:'work days',
    week_progress:'Week progress',week_done:'done',week_feedback:'feedback',week_todo:'Still to do',
    type_run:'Running',type_kracht:'Strength',type_mob:'Mobility',type_race:'Race',type_werk:'Work',type_rust:'Rest',type_herstel:'Recovery',type_swim:'Swimming',type_bike:'Cycling',type_gym:'Gym',
    days_ago:'past',days_today:'Today!',days_label:'days',weeks_label:'weeks',months_label:'months',
    hm:'Half marathon',marathon:'Marathon',other_dist:'Custom',
    stats_total:'Total km',stats_done:'km in plan',stats_days:'Days to race',
    stats_runs:'Runs logged',stats_sessions:'sessions done',stats_week:'This week',stats_week_sub:'km so far',
    stats_feel:'Avg feeling',stats_feedback:'Feedback',stats_fb_sub:'sessions',stats_recent:'Recent feedback',
    no_data:'No data',
    race_add:'Add race +',race_name:'Race name',race_date:'Date',race_dist:'Distance',race_type:'Race type',race_main:'Main goal',race_save:'Save race',race_delete:'Delete',race_edit:'Edit',
    race_saved:'✓ Race saved',race_deleted:'Race deleted',race_required:'Name and date are required',
    main_goal:'Main goal',
    cal_add_race:'Add race +',races_this_month:'Races this month',no_races_month:'No races this month.',
    saved:'✓ Saved',
    update_available:'🔄 Update available',update_apply:'Update now',
    account_title:'Sign in',account_hint:'Sign in to sync your data (coming soon).',
    email_placeholder:'name@example.com',login_btn:'Sign in',logout_btn:'Sign out',
    logged_in_as:'Signed in as',not_logged_in:'Not signed in',
    edit_day:'Edit day',field_titel:'Title',field_type:'Type',field_km:'Km',field_detail:'Detail',field_emoji:'Emoji',save_changes:'Save changes',
    pr_placeholder:'e.g. 37:56',
    connect_sheet:'Connect schedule',connect_active:'Connected',connect_disconnect:'Disconnect',connect_url_placeholder:'https://script.google.com/macros/s/…/exec',
    connect_hint:'Paste the URL of your published Google Apps Script.',connect_disconnected:'Not connected',
    week_label:'Week',next_fase:'Next phase',
    add_training:'Add training',type_label:'Type',
    race_to_sheet:'Race saved to schedule',race_to_sheet_err:'Race saved locally (no schedule)',
  }
};

// ── STATE ────────────────────────────────────────────────────────────────────
const state={
  scriptUrl: localStorage.getItem('scriptUrl')||'',
  sheetId:    localStorage.getItem('sheetId')||'',
  sheetName: localStorage.getItem('sheetName')||'',
  lang:      localStorage.getItem('lang')||'nl',
  data:      null,
  currentTab:'today',
  selectedRating:0,
  editingFeedback:false,
  calYear:   new Date().getFullYear(),
  calMonth:  new Date().getMonth(),
  calSelectedDate:null,
  editingRaceId:null,
  weekOffset:0,
  dayOffset:0, // C53: vandaag swipe offset
  editingRowIndex:null,
  _prs:null,_races:null,
  swReg:null,
  pendingSW:null,
  planWeekOffset:0,     // C27: week swipe offset (0 = current week)
  currentFase:null,     // C29: active fase for floating label
  raceHeaderOpen:false,
};

// ── SVG ICONS (module scope) ──────────────────────────────────────────────────
const googleSvg=`<svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" fill="#34A853"/><path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>`;
const importSvg=`<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M5 8l5-5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 16h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const chevronSvg=`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const gearSvg=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

// ── HELPERS ──────────────────────────────────────────────────────────────────
const T=k=>STRINGS[state.lang]?.[k]??STRINGS.nl[k]??k;
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const todayStr=()=>new Date().toISOString().split('T')[0];
const parseDate=s=>new Date(s+'T00:00:00');
// Mon-first day index: JS getDay() is 0=Sun..6=Sat; our arrays are 0=Ma..6=Zo
const dayIdx=d=>(d.getDay()+6)%7;
const daysUntil=s=>{const n=new Date();n.setHours(0,0,0,0);return Math.round((parseDate(s)-n)/86400000);};

function fmtDate(s){
  const d=parseDate(s),days=state.lang==='en'?DAYS_EN:DAYS_NL,months=state.lang==='en'?MONTHS_EN:MONTHS_NL;
  return `${days[dayIdx(d)]} ${d.getDate()} ${months[d.getMonth()]}`;
}
function fmtDateFull(s){
  const d=parseDate(s),days=state.lang==='en'?DAYS_EN:DAYS_NL,mf=state.lang==='en'?MONTHS_FULL_EN:MONTHS_FULL_NL;
  return `${days[dayIdx(d)]} ${d.getDate()} ${mf[d.getMonth()]} ${d.getFullYear()}`;
}
function getMondayStr(){
  const n=new Date();n.setHours(12,0,0,0);
  const dow=n.getDay();n.setDate(n.getDate()-(dow===0?6:dow-1));
  const y=n.getFullYear(),m=String(n.getMonth()+1).padStart(2,'0'),d=String(n.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function getWeekDates(){
  // C36: always Mon-Sun
  return getWeekDatesOffset(0);
}

// C24: type resolution — comma-separated, first valid type wins for colour
function typeOf(typeStr){
  if(!typeStr)return TYPE_FALLBACK;
  const norm=normalizeType(typeStr);
  return TYPE_DISPLAY[norm]||TYPE_DISPLAY[typeStr.toLowerCase().trim()]||TYPE_FALLBACK;
}
// Type checks — work with both Dutch and English values
const hasType=(typeStr,key)=>{
  if(!typeStr)return false;
  const norm=normalizeType(typeStr);
  const dutch=Object.entries(TYPE_NL_MAP).find(([,v])=>v===key)?.[0];
  return norm===key||typeStr.toLowerCase().trim()===key||(dutch&&typeStr.toLowerCase().trim()===dutch);
};
const isWork=t=>hasType(t,'work');
const isRace=t=>hasType(t,'race');
const isRust=t=>hasType(t,'rest');
const isMob=t=>hasType(t,'mobility');

function countdownDisplay(days){
  if(days<0)return{val:'✓',unit:T('days_ago')};
  if(days===0)return{val:'!',unit:T('days_today')};
  if(days<=30)return{val:days,unit:T('days_label')};
  if(days<=90)return{val:Math.round(days/7),unit:T('weeks_label')};
  return{val:Math.round(days/30),unit:T('months_label')};
}

// C25: race emoji - language-agnostic
function raceEmoji(race){
  const d=(race.dist||'').toLowerCase(),tp=(race.raceType||'').toLowerCase();
  if(tp.includes('trail')||tp.includes('ultra'))return'🏔';
  if(tp.includes('baan')||tp.includes('track'))return'🏟';
  if(d.includes('marathon')&&!d.includes('half')&&!d.includes('halve'))return'🏅';
  if(d.includes('halve')||d.includes('half')||d==='hm')return'🥈';
  if(d==='5km'||d==='5 km')return'⚡';
  if(d==='10km'||d==='10 km')return'🎯';
  return'🏁';
}

// Map raceType string → RXIcon type key
function raceTypeIconKey(raceType, dist){
  const tp=(raceType||'').toLowerCase(), d=(dist||'').toLowerCase();
  if(tp.includes('trail')||tp.includes('ultra'))return'trail';
  if(tp.includes('baan')||tp.includes('track'))return'target';
  if(d.includes('marathon')&&!d.includes('half')&&!d.includes('halve'))return'run';
  return'race';
}

// ── LOCALSTORAGE ─────────────────────────────────────────────────────────────
function loadPRs(){if(!state._prs){try{state._prs=JSON.parse(localStorage.getItem('prs')||'{}')}catch{state._prs={}}}return state._prs;}
function loadRaces(){if(!state._races){try{state._races=JSON.parse(localStorage.getItem('userRaces')||'[]')}catch{state._races=[]}}return state._races;}
function persistPRs(p){state._prs=p;localStorage.setItem('prs',JSON.stringify(p));}
function persistRaces(r){state._races=r;localStorage.setItem('userRaces',JSON.stringify(r));}

// ── SERVICE WORKER ───────────────────────────────────────────────────────────
function initServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    state.swReg=reg;
    // Check for waiting SW immediately
    if(reg.waiting)onSWWaiting(reg.waiting);
    reg.addEventListener('updatefound',()=>{
      const nw=reg.installing;
      nw.addEventListener('statechange',()=>{
        if(nw.state==='installed'&&navigator.serviceWorker.controller)
          onSWWaiting(nw);
      });
    });
  }).catch(()=>{});
  // Listen for message from SW that it has claimed clients after skipWaiting
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    window.location.reload();
  });
}

function onSWWaiting(sw){
  state.pendingSW=sw;
  const banner=document.getElementById('updateBanner');
  if(banner){
    document.getElementById('updateBannerText').textContent=T('update_available');
    banner.querySelector('button').textContent=T('update_apply');
    banner.style.display='flex';
  }
}

function applyUpdate(){
  if(state.pendingSW){
    state.pendingSW.postMessage({type:'SKIP_WAITING'});
  }
}

// ── DATA LAYER ────────────────────────────────────────────────────────────────
// All sheet writes use rowIndex as the stable identifier.
// state.data rows include rowIndex from the API.

function apiParams(extra={}){
  const p=new URLSearchParams({...extra});
  if(state.sheetId)p.set('sheetId',state.sheetId);
  if(state.sheetName)p.set('sheetName',state.sheetName);
  return p;
}

async function apiCall(params){
  if(!state.scriptUrl)throw new Error('Geen schema gekoppeld');
  const res=await fetch(state.scriptUrl+'?'+params);
  if(!res.ok)throw new Error('HTTP '+res.status);
  const json=await res.json();
  if(json.status!=='ok')throw new Error(json.message||'Onbekende fout');
  return json;
}

// ── MAP ROW: sheet field names → internal model ──────────────────────────────
// Sheet columns: datum, type, titel, detail, km, feedback, fase (+ rowIndex)
// Internal model: date, type (normalized), title, details, distance, feedback, phase
function mapRow(r){
  return {
    rowIndex:   r.rowIndex,
    // system fields
    id:         r.id||null,
    updated_at: r.updated_at||null,
    created_at: r.created_at||null,
    // canonical names
    date:     r.datum||r.date||'',
    type:     normalizeType(r.type||r.activity||''),
    title:    r.titel||r.title||'',
    details:  r.detail||r.details||'',
    distance: r.km||r.distance||'',
    feedback: r.feedback||'',
    phase:    r.fase||r.phase||'',
    // originals for sheet writes
    datum:    r.datum||r.date||'',
    titel:    r.titel||r.title||'',
    detail:   r.detail||r.details||'',
    km:       r.km||r.distance||'',
    fase:     r.fase||r.phase||'',
    race_type:r.race_type||'',
  };
}

async function fetchData(){
  // OAuth mode — use Sheets API v4 directly
  if(typeof isOAuthMode==='function'&&isOAuthMode()){
    return fetchDataOAuth();
  }
  if(!state.scriptUrl){hideLoading();renderActiveView();renderHeader();return;}
  try{
    const json=await apiCall(apiParams({action:'getAll'}));
    state.data=json.rows.map(mapRow);
    updateConnectionStatus(true);
  }catch(e){updateConnectionStatus(false,e.message);}
  hideLoading();renderActiveView();renderHeader();
}

async function sheetAddRow(fields){
  if(typeof isOAuthMode==='function'&&isOAuthMode()){return oauthAddRowDirect(fields);}
  await apiCall(apiParams({action:'addRow',...fields}));
  await fetchData();
}

async function sheetUpdateRow(rowIndex,fields){
  if(typeof isOAuthMode==='function'&&isOAuthMode()){return oauthUpdateRow(rowIndex,fields);}
  await apiCall(apiParams({action:'updateRow',rowIndex:String(rowIndex),...fields}));
  await fetchData();
}

async function sheetDeleteRow(rowIndex){
  if(typeof isOAuthMode==='function'&&isOAuthMode()){return oauthDeleteRow(rowIndex);}
  await apiCall(apiParams({action:'deleteRow',rowIndex:String(rowIndex)}));
  if(state.data)state.data=state.data.filter(r=>r.rowIndex!==rowIndex);
  if(state.data)state.data.forEach(r=>{if(r.rowIndex>rowIndex)r.rowIndex--;});
}

async function submitFeedback(datum,rating,tekst){
  try{
    if(typeof isOAuthMode==='function'&&isOAuthMode()){
      await oauthSetFeedback(datum,rating,tekst);
      showToast(T('feedback_logged'));return true;
    }
    if(!state.scriptUrl){showToast('❌ '+T('enter_url'));return false;}
    const row=state.data?.find(r=>r.datum===datum&&r.type!=='work'&&r.type!=='rest');
    const extra=row?.rowIndex?{rowIndex:String(row.rowIndex)}:{};
    await apiCall(apiParams({action:'setFeedback',datum,rating,tekst:tekst||'',...extra}));
    if(row){const e=['😵','😓','😐','💪','🔥'];row.feedback=`${rating}/5 ${e[rating-1]}${tekst?' – '+tekst:''}`;}
    showToast(T('feedback_logged'));return true;
  }catch(e){showToast('❌ '+humanError(e));return false;}
}

// ── RENDER DISPATCH ───────────────────────────────────────────────────────────
function renderActiveView(){
  switch(state.currentTab){
    case 'today':    renderToday();break;
    case 'week':     renderWeek();break;
    case 'plan':     renderPlan();break;
    case 'calendar': renderCalendar();break;
    case 'settings': renderSettingsFields();break;
  }
}

// DEV: force clear cache and reload
async function devForceRefresh(){
  if('serviceWorker' in navigator){
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
  }
  const keys=await caches.keys();
  await Promise.all(keys.map(k=>caches.delete(k)));
  location.reload(true);
}


function applyTheme(){
  document.documentElement.dataset.theme=state.theme;
  const btn=document.getElementById('themeToggleBtn');
  if(btn)btn.textContent=state.theme==='dark'?'🌙':'☀️';
}
function setTheme(t){
  state.theme=t;localStorage.setItem('theme',t);
  applyTheme();
}
function toggleTheme(){
  setTheme(state.theme==='dark'?'light':'dark');
}

// ── HEADER ────────────────────────────────────────────────────────────────────
// Week + button: pick date then open add modal
function openWeekAddActivity(){
  // Show a compact date picker modal
  const content=document.getElementById('dayModalContent');
  const dates=getWeekDatesOffset(state.weekOffset||0);
  const days=state.lang==='en'?DAYS_EN:DAYS_NL;
  const t=todayStr();
  content.innerHTML=`<div class="modal-title">Dag kiezen</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${dates.map(d=>{
        const pd=parseDate(d);
        const isT=d===t;
        return `<button onclick="closeDayModal();openAddActivity('${d}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${isT?'rgba(198,242,78,0.08)':'var(--surface)'};border:1px solid ${isT?'var(--accent)':'var(--border)'};cursor:pointer;font-family:var(--font-d);font-weight:700;font-size:15px;color:${isT?'var(--accent)':'var(--text)'};text-align:left;-webkit-tap-highlight-color:transparent">
          <span>${days[dayIdx(pd)]} ${pd.getDate()}</span>
          ${isT?'<span style="font-family:var(--font-m);font-size:9px;color:var(--accent);letter-spacing:1px">VANDAAG</span>':''}
        </button>`;
      }).join('')}
    </div>`;
  state.editingRowIndex=null;
  document.getElementById('dayModal').classList.add('open');
}

function openDayFromRacesBar(datum){
  openDayModal(datum);
}

function renderSidebarPlanInfo(){
  if(!state.data)return;
  const t=todayStr();
  const allRows=state.data;
  const todayRow=allRows.find(r=>r.datum===t);
  const faseValues=[...new Set(allRows.map(r=>r.fase||'').filter(Boolean))];
  const fase=todayRow?.fase||state.currentFase||'';
  const faseIdx=faseValues.indexOf(fase);

  // Phase info
  const faseEl=document.getElementById('sbFaseLabel');
  const faseCountEl=document.getElementById('sbFaseCount');
  const weekEl=document.getElementById('sbWeekLabel');
  const fillEl=document.getElementById('sbProgressFill');
  const kmEl=document.getElementById('sbKmLabel');
  const pctEl=document.getElementById('sbPctLabel');
  if(faseEl)faseEl.textContent=fase||'—';
  if(faseCountEl&&faseValues.length>1)faseCountEl.textContent=`${faseIdx+1} / ${faseValues.length}`;

  // Current fase duration
  if(weekEl&&fase){
    const fRows=allRows.filter(r=>r.fase===fase&&r.datum);
    const fStart=fRows[0]?.datum,fEnd=fRows[fRows.length-1]?.datum;
    if(fStart&&fEnd){
      const wks=Math.max(1,Math.ceil((parseDate(fEnd)-parseDate(fStart))/604800000+1));
      weekEl.textContent=`${wks} weken`;
    }
  }

  // Week km progress (for bar + km label)
  const mondayStr=getMondayStr();
  const endOfWeek=mondayStr.slice(0,8)+String(parseInt(mondayStr.slice(8))+6).padStart(2,'0');
  const weekDone=allRows.filter(r=>r.datum>=mondayStr&&r.datum<=t).reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  const weekTotal=allRows.filter(r=>r.datum>=mondayStr&&r.datum<=endOfWeek).reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  const pct=weekTotal>0?Math.min(100,Math.round(weekDone/weekTotal*100)):0;
  if(fillEl)fillEl.style.width=pct+'%';
  if(kmEl)kmEl.textContent=weekTotal>0?`${weekDone.toFixed(0)} / ${weekTotal.toFixed(0)} km`:'';
  if(pctEl)pctEl.textContent=weekTotal>0?`${pct}%`:'';

  // User row
  const loggedIn=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
  const email=loggedIn&&typeof authEmail==='function'?authEmail():'';
  const initials=email?email[0].toUpperCase():'?';
  const name=localStorage.getItem('userName')||email.split('@')[0]||'—';
  const avatarEl=document.getElementById('sbAvatarBtn');
  const nameEl=document.getElementById('sbUserName');
  const subEl=document.getElementById('sbUserSub');
  if(avatarEl)avatarEl.textContent=initials;
  if(nameEl)nameEl.textContent=name;
  if(subEl)subEl.textContent=loggedIn?'gesynced':'niet ingelogd';
}

function renderHeader(){
  const name=localStorage.getItem('userName')||'';
  const tn=document.getElementById('topbarName');if(tn)tn.textContent=name;
  renderRacesBar();
  renderSidebarPlanInfo();
  renderTopbarAuth();
}

function renderTopbarAuth(){
  const loggedIn=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
  const email=loggedIn&&typeof authEmail==='function'?authEmail():'';
  const initials=email?email[0].toUpperCase():'?';
  const btnHtml=loggedIn
    ?`<button id="avatarBtn" onclick="toggleAvatarMenu(this)" style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--accent-ink);border:none;font-family:var(--font-d);font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</button>`
    :`<button onclick="oauthConnectFlow()" style="background:var(--surface);color:var(--text);border:1px solid var(--border);padding:6px 14px;font-family:var(--font-d);font-size:13px;font-weight:500;letter-spacing:-0.01em;border-radius:999px;cursor:pointer;display:flex;align-items:center;gap:6px">${googleSvg}Inloggen</button>`;
  const el=document.getElementById('topbarAuth');
  const el2=document.getElementById('topbarAuthDesktop');
  if(el)el.innerHTML=btnHtml;
  if(el2)el2.innerHTML=btnHtml;
  // Global dropdown appended to body — avoids overflow clipping
  let menu=document.getElementById('avatarDropdown');
  if(loggedIn){
    if(!menu){menu=document.createElement('div');menu.id='avatarDropdown';document.body.appendChild(menu);}
    menu.style.cssText='display:none;position:fixed;z-index:9000;background:var(--surface);border:1px solid var(--border);border-radius:12px;min-width:220px;box-shadow:0 12px 32px rgba(14,31,26,0.18);overflow:hidden';
    const _item=(onclick,label,svg,danger=false)=>
      `<button onclick="${onclick}" class="av-item${danger?' av-item-danger':''}">${svg}<span>${label}</span></button>`;
    menu.innerHTML=`
      <div class="av-header">
        <div class="av-email">${esc(email)}</div>
      </div>
      ${_item('_closeAvatarMenu();openStats()','Stats',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="17" rx="1"/></svg>')}
      ${_item('_closeAvatarMenu();openStats();setTimeout(openPrEditor,300)','Mijn PR\'s',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M9 12l-2 8 5-3 5 3-2-8"/></svg>')}
      ${_item('_closeAvatarMenu();switchTab(\'settings\')','Instellingen',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9"/></svg>')}
      <div class="av-divider"></div>
      ${_item('_closeAvatarMenu();authSignOut()','Uitloggen',
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
        true)}`;
  }else if(menu){
    menu.remove();
  }
}

function _closeAvatarMenu(){
  const m=document.getElementById('avatarDropdown');
  if(m)m.style.display='none';
}

function toggleAvatarMenu(btn){
  const m=document.getElementById('avatarDropdown');if(!m)return;
  if(m.style.display==='block'){m.style.display='none';return;}
  if(btn){
    const r=btn.getBoundingClientRect();
    const inSidebar=r.left<window.innerWidth/2;
    if(inSidebar){
      // Sidebar: open boven de rij, aan de rechterkant van de sidebar
      m.style.left=r.right+'px';
      m.style.right='auto';
      m.style.bottom=(window.innerHeight-r.top+4)+'px';
      m.style.top='auto';
    }else{
      // Topbar: open onder de knop, rechts uitgelijnd
      m.style.left='auto';
      m.style.right=(window.innerWidth-r.right)+'px';
      m.style.top=(r.bottom+6)+'px';
      m.style.bottom='auto';
    }
  }
  m.style.display='block';
  const _trigger=btn;
  setTimeout(()=>document.addEventListener('click',function h(e){
    if(_trigger&&_trigger.contains(e.target))return; // laat toggle zelf sluiten
    const m2=document.getElementById('avatarDropdown');
    if(m2&&!m2.contains(e.target)){m2.style.display='none';}
    document.removeEventListener('click',h);
  },true),10);
}


function toggleRaceHeader(){
  state.raceHeaderOpen=!state.raceHeaderOpen;
  renderRacesBar();
}

function renderRacesBar(){
  const bar=document.getElementById('racesBar');if(!bar)return;

  // Sheet races first, localStorage fallback
  let races=(state.data||[])
    .filter(r=>r.type==='race'&&r.datum)
    .sort((a,b)=>a.datum.localeCompare(b.datum))
    .filter(r=>daysUntil(r.datum)>=-1)
    .slice(0,5);
  if(!races.length&&!state.scriptUrl){
    races=loadRaces()
      .filter(r=>daysUntil(r.date)>=-1)
      .sort((a,b)=>a.date.localeCompare(b.date))
      .slice(0,5)
      .map(r=>({datum:r.date,titel:r.name,km:r.dist}));
  }

  // No races — hide chip entirely
  if(!races.length){bar.innerHTML='';return;}

  const main=races[0];
  const rest=races.slice(1);
  const cd=countdownDisplay(daysUntil(main.datum));
  const kmRaw=(main.km||'').toString().trim().replace(/\s*km$/i,'');
  const kmVal=parseFloat(kmRaw);
  const distStr=kmRaw?(kmVal>100?`${kmRaw} m`:`${kmRaw} km`):'';
  const localRaces=loadRaces();
  const lr=localRaces.find(l=>l.date===main.datum)||localRaces.find(l=>l.name===main.titel);
  const tier=lr?.raceType==='A'||lr?.mainGoal?'A':'B';
  const open=state.raceHeaderOpen;

  let h=`<div class="race-chip${open?' open':''}">
    <div class="race-chip-main" onclick="openDayFromRacesBar('${main.datum}')">
      <div class="race-dot"></div>
      <div class="race-chip-body">
        <div class="race-chip-name">${esc(main.titel||main.datum)}${distStr?` · ${distStr}`:''}</div>
        <div class="race-chip-meta">${main.datum?main.datum.split('-').slice(1).reverse().join(' '):''}${tier?' · '+tier+'-race':''}</div>
      </div>
      <div class="race-chip-countdown">${cd.val}<span>${cd.unit}</span></div>
    </div>
    <button onclick="toggleRaceHeader()" style="background:none;border:none;border-left:1px solid var(--border);padding:0 14px;cursor:pointer;align-self:stretch;display:flex;align-items:center" title="Uitklappen">
      <div class="race-chip-chevron" style="margin:0">›</div>
    </button>`;

  if(open){
    h+=`<div class="race-chip-timeline">`;
    if(rest.length){
      h+=`<div class="race-chip-timeline-label">Volgende races</div>
        <div class="race-chip-timeline-items">
          <div class="race-chip-timeline-line"></div>`;
      rest.forEach(r=>{
        const rcd=countdownDisplay(daysUntil(r.datum));
        const rl=localRaces.find(l=>l.date===r.datum)||localRaces.find(l=>l.name===r.titel);
        const rt=rl?.raceType==='A'||rl?.mainGoal?'A':'B';
        const rKm=(r.km||'').toString().trim().replace(/\s*km$/i,'');
        const rKmVal=parseFloat(rKm);
        const rDist=rKm?(rKmVal>100?`${rKm} m`:`${rKm} km`):'';
        const dotColor=rt==='A'?'var(--cat-race)':'var(--muted)';
        h+=`<div class="race-chip-timeline-item" onclick="openDayFromRacesBar('${r.datum}');event.stopPropagation()">
          <div class="race-chip-timeline-dot" style="background:${dotColor}"></div>
          <div class="race-chip-timeline-item-body">
            <div class="race-chip-timeline-item-name">${esc(r.titel||r.datum)}${rDist?` · ${rDist}`:''}</div>
            <div class="race-chip-timeline-item-meta">${r.datum||''} · ${rt}-race</div>
          </div>
          <div class="race-chip-timeline-item-days">${rcd.val}${rcd.unit}</div>
        </div>`;
      });
      h+=`</div>`;
    }
    h+=`<div class="race-chip-add" onclick="openRaceModal();event.stopPropagation()">+ Race toevoegen</div>
    </div>`;
  }

  h+=`</div>`;
  bar.innerHTML=h;
}

// ── TODAY ─────────────────────────────────────────────────────────────────────
function renderToday(){
  const el=document.getElementById('todayContent');
  const today=todayStr();
  const off=state.dayOffset||0;
  const tDate=new Date();tDate.setDate(tDate.getDate()+off);tDate.setHours(12,0,0,0);
  const ty=tDate.getFullYear(),tm=String(tDate.getMonth()+1).padStart(2,'0'),td=String(tDate.getDate()).padStart(2,'0');
  const t=`${ty}-${tm}-${td}`;
  const days=state.lang==='en'?DAYS_EN:DAYS_NL;
  const mf=state.lang==='en'?MONTHS_FULL_EN:MONTHS_FULL_NL;
  const d=parseDate(t);

  // Week day strip — Mon..Sun of the displayed week
  const todayDate=new Date();todayDate.setHours(12,0,0,0);
  const weekDow=(tDate.getDay()+6)%7;
  const weekStart=new Date(tDate);weekStart.setDate(tDate.getDate()-weekDow);
  let stripH=`<div class="today-day-strip">
    <button class="tds-nav" onclick="state.dayOffset=(state.dayOffset||0)-7;renderToday()">‹</button>
    <div class="tds-days">`;
  for(let i=0;i<7;i++){
    const wDay=new Date(weekStart);wDay.setDate(weekStart.getDate()+i);
    const wStr=`${wDay.getFullYear()}-${String(wDay.getMonth()+1).padStart(2,'0')}-${String(wDay.getDate()).padStart(2,'0')}`;
    const wOff=Math.round((wDay-todayDate)/86400000);
    const isActive=(wOff===off);
    const tr=state.data?.find(r=>r.datum===wStr&&r.type!=='rest');
    const dotColor=tr?(isActive?'rgba(255,255,255,0.65)':typeOf(tr.type).text):'transparent';
    stripH+=`<div class="today-day-block${isActive?' active':''}" onclick="state.dayOffset=${wOff};renderToday()">
      <div class="tdb-day">${DAYS_NL[i]}</div>
      <div class="tdb-num">${wDay.getDate()}</div>
      <div class="tdb-dot" style="background:${dotColor}"></div>
    </div>`;
  }
  stripH+=`</div>
    <button class="tds-nav" onclick="state.dayOffset=(state.dayOffset||0)+7;renderToday()">›</button>
  </div>`;

  // Fase kicker
  let faseKicker='';
  if(state.data){const tr=state.data.find(r=>r.datum===t);if(tr?.fase)faseKicker=tr.fase;}
  const dayLabel=off===0?`${days[dayIdx(d)]} · vandaag`:`${days[dayIdx(d)]} ${d.getDate()} ${mf[d.getMonth()]}`;

  let h=`<div style="height:12px"></div>`;
  h+=stripH;
  h+=`<div class="today-kicker">
    <span>${dayLabel}${faseKicker?`<span class="today-kicker-fase"> · ${faseKicker}</span>`:''}</span>
    <button class="today-add-btn" onclick="openAddActivity('${t}')">+</button>
  </div>`;

  // Weather widget (today only)
  const _wc=JSON.parse(localStorage.getItem('weatherCache')||'null')?.data;
  if(off===0){
    h+=_wc?renderWeatherWidget():`<div id="weatherWidget"></div>`;
    if(!_wc)initWeather();
  }

  if(!state.data){
    h+=`<div style="padding:0 16px">`;
    h+=noSchemaHint();
    h+=`</div>`;
    el.innerHTML=h;return;
  }

  const todayRows=state.data.filter(r=>r.datum===t);
  const row=todayRows[0]||null;
  h+=`<div style="padding:0 16px">`;

  if(!row||row.type==='rest'){
    h+=`<div class="card">
      <div class="rest-card-inner">
        <div class="rest-emoji">😴</div>
        <div><div class="rest-title">${T('rest_day')}</div><div class="rest-sub">${T('rest_msg')}</div></div>
      </div>
    </div>`;
  } else {
    const activeRows=todayRows.filter(r=>r.type!=='rest');
    activeRows.forEach(row=>{
      const ti=typeOf(row.type);
      const isRun=hasType(row.type,'run');
      const isRaceDay=hasType(row.type,'race');
      const detail=row.detail||'';
      const paceMatch=detail.match(/(\d+:\d+)[–-]?(\d+:\d+)?\/km/);
      const hrMatch=detail.match(/<?\s*(\d+)\s*bpm/i)||detail.match(/HR\s*<?(\d+)/i);
      const duurMatch=detail.match(/(\d+)\s*(?:min|')/i);
      h+=`<div class="today-hero-card${isRaceDay?' race-border':''}" onclick="openDayModalRow(${row.rowIndex},'${t}')" style="-webkit-tap-highlight-color:transparent">`;
      h+=`<div class="cat-tag">
        <div class="cat-dot" style="background:${ti.text}"></div>
        <span class="cat-label">${T(ti.i18n)}${row.titel?' · '+esc(row.titel):''}</span>
      </div>`;
      if(row.km){
        h+=`<div class="today-hero-km"${!isRun?' style="font-size:40px"':''}>${esc(row.km)}<span class="today-hero-km-unit"> km</span></div>`;
      } else if(duurMatch){
        h+=`<div class="today-hero-km">${duurMatch[1]}<span class="today-hero-km-unit"> min</span></div>`;
      }
      if(paceMatch||hrMatch){
        h+=`<div class="today-hero-stats">`;
        if(paceMatch)h+=`<div><div class="ths-label">pace</div><div class="ths-val">${esc(paceMatch[0])}</div></div>`;
        if(hrMatch)h+=`<div><div class="ths-label">hr</div><div class="ths-val">&lt;${esc(hrMatch[1])} bpm</div></div>`;
        if(duurMatch)h+=`<div><div class="ths-label">duur</div><div class="ths-val">${duurMatch[1]}′</div></div>`;
        h+=`</div>`;
      }
      if(detail){h+=`<div class="today-hero-detail">${esc(detail)}</div>`;}
      if(isRun){
        const hasFb=!!row.feedback;
        h+=`<button class="today-hero-cta${hasFb?' secondary':''}" onclick="event.stopPropagation();toggleTodayFeedback()">Beoordeel run <span>→</span></button>`;
      }
      h+=`</div>`;
    });
    const fbRow=activeRows.find(r=>r.type!=='work');
    if(fbRow){const fbHtml=feedbackHtml(fbRow.datum,fbRow.feedback);const hidden=!fbRow.feedback&&!state.editingFeedback;h+=`<div id="todayFeedback" style="display:${hidden?'none':'block'}">${fbHtml}</div>`;}
  }

  // Tomorrow card — only when viewing today
  if(off!==0){h+=`</div>`;el.innerHTML=h;attachStarListeners();
    const scrollEl2=document.getElementById('scrollArea');
    if(scrollEl2&&!scrollEl2._daySwipe){scrollEl2._daySwipe=true;let sx2=0,sy2=0;scrollEl2.addEventListener('touchstart',e=>{sx2=e.touches[0].clientX;sy2=e.touches[0].clientY;},{passive:true});scrollEl2.addEventListener('touchend',e=>{if(state.currentTab!=='today')return;const dx=e.changedTouches[0].clientX-sx2,dy=e.changedTouches[0].clientY-sy2;if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>50){state.dayOffset=(state.dayOffset||0)+(dx<0?1:-1);renderToday();}},{passive:true});}
    return;
  }
  const tmrDate=new Date();tmrDate.setDate(tmrDate.getDate()+1);
  const tmrStr=tmrDate.toISOString().split('T')[0];
  const tmr=state.data?.find(r=>r.datum===tmrStr&&r.type!=='rest');
  if(tmr){
    const tmrTi=typeOf(tmr.type);
    h+=`<div class="today-tmr-card" onclick="state.dayOffset=1;renderToday()" style="-webkit-tap-highlight-color:transparent">
      <div class="today-tmr-bar" style="background:${tmrTi.text}"></div>
      <div style="flex:1;min-width:0">
        <div class="today-tmr-label">${T('tomorrow')} · ${days[dayIdx(tmrDate)]} ${tmrDate.getDate()}</div>
        <div class="today-tmr-title">${esc(tmr.titel||T(tmrTi.i18n))}${tmr.km?' · '+esc(tmr.km)+' km':''}</div>
      </div>
      <div class="today-tmr-chevron">›</div>
    </div>`;
  }


  h+=`</div>`;
  el.innerHTML=h;
  attachStarListeners();
  const scrollEl=document.getElementById('scrollArea');
  if(scrollEl&&!scrollEl._daySwipe){
    scrollEl._daySwipe=true;
    let sx=0,sy=0;
    scrollEl.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
    scrollEl.addEventListener('touchend',e=>{
      if(state.currentTab!=='today')return;
      const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>50){
        state.dayOffset=(state.dayOffset||0)+(dx<0?1:-1);
        renderToday();
      }
    },{passive:true});
  }
}

function noSchemaHint(){
  const loggedIn=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
  if(loggedIn){
    return `<div style="padding:32px 20px">
      <div style="font-family:var(--font-d);font-weight:700;font-size:24px;letter-spacing:-0.03em;margin-bottom:8px">Geen schema gekoppeld</div>
      <div style="font-family:var(--font-d);font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.5">Koppel jouw trainingsschema en ontvang dagelijks wat er op het programma staat.</div>
      <button class="btn-primary" onclick="showOAuthConnectSheet&&showOAuthConnectSheet()||switchTab('settings')">Schema koppelen</button>
    </div>`;
  }
  return `<div style="padding:32px 20px">
    <div style="font-family:var(--font-d);font-weight:700;font-size:24px;letter-spacing:-0.03em;margin-bottom:8px">Breng je schema mee</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.5">Importeer je trainingsschema en ontvang elke dag wat er op het programma staat.</div>
    <button class="connect-tile primary" onclick="oauthConnectFlow()" style="margin-bottom:10px;border:none">
      <div class="connect-tile-icon">${importSvg}</div>
      <div class="connect-tile-body">
        <div class="connect-tile-title">Schema importeren</div>
        <div class="connect-tile-sub">PDF, Excel, foto of van je coach</div>
      </div>
      ${chevronSvg}
    </button>
    <button class="btn-google" onclick="oauthConnectFlow()">${googleSvg}Login met Google</button>
    <div style="text-align:center;font-size:11px;color:var(--faint);margin-top:10px;line-height:1.5">Door verder te gaan ga je akkoord met onze voorwaarden.</div>
  </div>`;
}

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
function feedbackHtml(datum,existing){
  const isEdit=!!existing;let rating=0,text='';
  if(isEdit){const m=existing.match(/^(\d)/);if(m)rating=parseInt(m[1]);const mt=existing.match(/–\s*(.+)$/);if(mt)text=mt[1];}
  if(isEdit&&!state.editingFeedback){
    return `<div class="prev-feedback">
      <div class="prev-feedback-header">
        <span class="prev-feedback-label">${T('feedback_logged')}</span>
        <button class="edit-link" onclick="state.editingFeedback=true;renderToday()">${T('feedback_edit')}</button>
      </div>
      <div class="prev-feedback-text">${esc(existing)}</div>
    </div>`;
  }
  const stars=['😵','😓','😐','💪','🔥'].map((e,i)=>
    `<button class="star-btn${rating>0&&(i+1)<=rating?' active':''}" data-val="${i+1}">${e}</button>`
  ).join('');
  return `<div class="feedback-section">
    <div class="feedback-title">${T('feedback_q')}</div>
    <div class="feedback-stars">${stars}</div>
    <textarea class="feedback-textarea" id="feedbackText">${esc(text)}</textarea>
    <button class="btn-primary" id="submitBtn" onclick="handleFeedbackSubmit('${esc(datum)}')">${isEdit?T('feedback_update'):T('feedback_save')}</button>
    ${isEdit?`<button class="btn-secondary" onclick="state.editingFeedback=false;renderToday()">${T('feedback_cancel')}</button>`:''}
  </div>`;
}

function toggleTodayFeedback(){
  const el=document.getElementById('todayFeedback');if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
  if(el.style.display==='block'){attachStarListeners();}
}

function attachStarListeners(scope){
  const sel=scope?`#${scope} .star-btn`:'.star-btn';
  document.querySelectorAll(sel).forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.selectedRating=parseInt(btn.dataset.val);
      document.querySelectorAll(sel).forEach(b=>b.classList.toggle('active',parseInt(b.dataset.val)<=state.selectedRating));
    });
  });
}

async function handleFeedbackSubmit(datum){
  if(!state.selectedRating){showToast(T('select_score'));return;}
  const btn=document.getElementById('submitBtn');
  const tekst=document.getElementById('feedbackText')?.value||'';
  btn.disabled=true;btn.textContent='…';
  const ok=await submitFeedback(datum,state.selectedRating,tekst);
  if(ok){state.editingFeedback=false;state.selectedRating=0;setTimeout(renderToday,800);}
  else{btn.disabled=false;btn.textContent=T('feedback_save');}
}

// ── WEEK ──────────────────────────────────────────────────────────────────────
function renderWeek(){
  const el=document.getElementById('weekContent');
  const offset=state.weekOffset||0;
  const dates=getWeekDatesOffset(offset);
  const t=todayStr();
  const days=state.lang==='en'?DAYS_EN:DAYS_NL;
  const wd=dates.map(d=>({date:d,rows:(state.data||[]).filter(r=>r.datum===d),row:(state.data||[]).find(r=>r.datum===d)??null}));
  const d0=parseDate(dates[0]),d6=parseDate(dates[6]);
  const months=state.lang==='en'?MONTHS_EN:MONTHS_NL;
  const jan4=new Date(d0.getFullYear(),0,4);
  const weekNum=Math.ceil(((d0-jan4)/86400000+jan4.getDay()+1)/7);
  const weekLabel=`${d0.getDate()}–${d6.getDate()} ${months[d0.getMonth()]}`;
  const plannedKm=wd.reduce((s,{rows})=>s+rows.reduce((a,r)=>a+(parseFloat(r.km)||0),0),0);
  const doneKm=wd.filter(({date})=>date<=t).reduce((s,{rows})=>s+rows.reduce((a,r)=>a+(parseFloat(r.km)||0),0),0);
  const pct=plannedKm>0?Math.min(100,Math.round(doneKm/plannedKm*100)):0;
  const kmLeft=Math.max(0,plannedKm-doneKm);

  // Header: ‹ Week N + date range › | km total right
  let h=`<div class="week-header">
    <div style="display:flex;align-items:center;gap:10px">
      <button class="week-nav-btn" onclick="state.weekOffset=(state.weekOffset||0)-1;renderWeek()">‹</button>
      <div>
        <div class="week-header-num">Week ${weekNum}</div>
        <div class="week-header-dates">${weekLabel}${offset!==0?` · <button class="week-now-btn" onclick="state.weekOffset=0;renderWeek()">Nu</button>`:''}</div>
      </div>
      <button class="week-nav-btn" onclick="state.weekOffset=(state.weekOffset||0)+1;renderWeek()">›</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div style="text-align:right">
        <div class="week-km-total">${doneKm.toFixed(0)}<span class="week-km-slash"> / ${plannedKm.toFixed(0)} km</span></div>
        <div class="week-km-pct">${pct}%${kmLeft>0?' · '+kmLeft.toFixed(0)+' km te gaan':''}</div>
      </div>
      <button class="today-add-btn" onclick="openWeekAddActivity()">+</button>
    </div>
  </div>`;

  // Progress bar
  h+=`<div class="week-progress-bar"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:2px"></div></div>`;

  // Day strip (today highlighted, click scrolls to row)
  h+=`<div style="height:14px"></div>
  <div class="today-day-strip">
    <div class="tds-days">`;
  wd.forEach(({date,rows},i)=>{
    const isT=date===t;
    const tr=rows.find(r=>r.type!=='rest'&&r.type!=='work');
    const dotColor=tr?(isT?'rgba(255,255,255,0.65)':typeOf(tr.type).text):'transparent';
    const d=parseDate(date);
    h+=`<div class="today-day-block${isT?' active':''}"
      onclick="weekScrollToDay('${date}')"
      ondragover="event.preventDefault();this.classList.add('wdr-drop-target')"
      ondragleave="this.classList.remove('wdr-drop-target')"
      ondrop="weekDropOnDay(event,'${date}');this.classList.remove('wdr-drop-target')">
      <div class="tdb-day">${DAYS_NL[i]}</div>
      <div class="tdb-num">${d.getDate()}</div>
      <div class="tdb-dot" style="background:${dotColor}"></div>
    </div>`;
  });
  h+=`</div></div>`;

  // Day rows
  h+=`<div id="weekSwipeWrap" style="padding:14px 16px 0">`;
  if(!state.data){h+=noSchemaHint();}
  else{
    const activeDays=wd.map(({date,rows})=>({date,activeRows:rows.filter(r=>r.type&&r.type!=='work'&&r.type!=='rest')})).filter(({activeRows})=>activeRows.length);
    activeDays.forEach(({date,activeRows})=>{
      const isTdy=date===t,isPast=date<t,d=parseDate(date);
      activeRows.forEach((row,i)=>{
        const ti=typeOf(row.type);
        h+=`<div data-upcoming-date="${date}" data-row-index="${row.rowIndex||''}" data-row-date="${date}"
          draggable="true"
          onclick="openDayModalRow(${row.rowIndex},'${date}')"
          ondragstart="weekDragStart(event,${row.rowIndex||'null'},'${date}')"
          ondragend="weekDragEnd(event)"
          class="week-day-row${isTdy?' today':isPast?' past':''}"
          style="${i>0?'margin-top:4px':''};-webkit-tap-highlight-color:transparent;cursor:grab">
          <div class="wdr-bar" style="background:${ti.text}"></div>
          <div style="flex:1;min-width:0">
            <div class="wdr-label">${days[dayIdx(d)]} · ${T(ti.i18n)}</div>
            <div class="wdr-title">${esc(row.titel||'')}</div>
          </div>
          ${row.km?`<div class="wdr-km">${esc(row.km)} km</div>`:''}
          <div class="wdr-handle" title="Slepen om te verplaatsen">⠿</div>
        </div>`;
      });
    });
  }
  h+=`</div>`;
  el.innerHTML=h;
  requestAnimationFrame(()=>initWeekSwipe());
}

// ── PLAN ──────────────────────────────────────────────────────────────────────
function renderPlan(){
  const el=document.getElementById('planContent');
  const titleEl=document.getElementById('planPageTitle');
  const phaseTabs=document.getElementById('phaseTabs');
  const t=todayStr();
  if(!state.planTypeFilters)state.planTypeFilters=[];

  // Schema overview header
  if(titleEl){
    const allR=state.data?.filter(r=>r.datum)||[];
    const raceRows=allR.filter(r=>r.type==='race'&&r.datum).sort((a,b)=>a.datum.localeCompare(b.datum));
    const nextRace=raceRows.find(r=>daysUntil(r.datum)>=0);
    const schemaName=nextRace?.titel||'Training';
    const totalKm=allR.reduce((s,r)=>s+(parseFloat(r.km)||0),0);
    const startDate=allR[0]?.datum;
    const endDate=nextRace?.datum||allR[allR.length-1]?.datum;
    const mn=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    const fmtS=d=>{if(!d)return'';const p=parseDate(d);return`${p.getDate()} ${mn[p.getMonth()]}`;};
    let weekNum=1,totalWeeks=1,pct=0;
    if(startDate&&endDate){
      const s=parseDate(startDate),e=parseDate(endDate),n=parseDate(t);
      totalWeeks=Math.max(1,Math.ceil((e-s)/604800000));
      weekNum=Math.min(totalWeeks,Math.max(1,Math.ceil((n-s)/604800000)+1));
      pct=Math.min(100,Math.round((weekNum-1)/totalWeeks*100));
    }
    titleEl.innerHTML=allR.length?`<div class="plan-schema-header">
      <div class="psh-kicker">training${totalKm>0?' · '+Math.round(totalKm)+' km':''}</div>
      <div class="psh-title">${esc(schemaName)}</div>
      <div class="psh-sub">Week ${weekNum} van ${totalWeeks}</div>
      <div class="psh-bar"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px"></div></div>
      <div class="psh-dates"><span>Start · ${fmtS(startDate)}</span><span>Race · ${fmtS(endDate)}</span></div>
    </div>`:`<div class="plan-schema-header"><div class="psh-kicker">training</div><div class="psh-title">Training</div></div>`;
  }

  if(!state.data){phaseTabs.innerHTML='';renderPlanWithoutData(t);return;}
  const allRows=state.data.filter(r=>r.datum);
  if(!allRows.length){el.innerHTML=`<div class="no-data">${T('no_data')}</div>`;phaseTabs.innerHTML='';return;}

  const faseValues=[...new Set(allRows.map(r=>r.fase||'').filter(Boolean))];
  phaseTabs.innerHTML='';

  if(faseValues.length>0){
    // Auto-open current fase
    if(!state.openFase||!faseValues.includes(state.openFase)){
      state.openFase=faseValues.find(f=>allRows.filter(r=>r.fase===f).some(r=>r.datum>=t))||faseValues[faseValues.length-1];
    }

    let h='<div style="padding:8px 16px 0">';
    faseValues.forEach((f,i)=>{
      const fRows=allRows.filter(r=>r.fase===f&&r.datum);
      const fEnd=fRows[fRows.length-1]?.datum,fStart=fRows[0]?.datum;
      const allPast=fEnd&&fEnd<t;
      const hasFuture=fStart&&fStart>t;
      const isCurrent=!allPast&&!hasFuture;
      const isOpen=f===state.openFase;
      const shortName=f.replace(/^Fase\s*\d+\s*[·–-]\s*/i,'').trim()||f;
      const num=String(f.match(/\d+/)?.[0]||i+1).padStart(2,'0');
      const wks=fStart&&fEnd?Math.max(1,Math.ceil((parseDate(fEnd)-parseDate(fStart))/604800000+1)):'';
      const cls=`plan-fase-row${isCurrent?' is-current':allPast?' is-done':''}`;

      h+=`<div class="plan-fase-block">
        <div class="${cls}" onclick="togglePlanFase('${esc(f)}')" style="-webkit-tap-highlight-color:transparent">
          <div class="pfr-num">${num}</div>
          <div style="flex:1;min-width:0"><div class="pfr-name">${esc(shortName)}</div></div>
          ${wks?`<div class="pfr-weeks">${wks}w</div>`:''}
          <div class="pfr-status">${allPast?'✓':isCurrent?'→':''}</div>
          <div class="pfr-chevron${isOpen?' open':''}" style="font-size:14px;color:var(--muted);transition:transform .2s">›</div>
        </div>
        ${isOpen?`<div class="plan-fase-rows"><div class="plan-table" style="margin-top:6px">${planRowsHtml(fRows,t)}</div></div>`:''}
      </div>`;
    });
    h+='</div>';
    el.innerHTML=h;
    requestAnimationFrame(()=>{
      el.querySelector('.is-today')?.scrollIntoView({behavior:'smooth',block:'center'});
      initPlanSwipe();
    });
  }else{
    renderPlanRows(allRows,t,'');
  }
}

function togglePlanFase(fase){
  state.openFase=state.openFase===fase?null:fase;
  renderPlan();
}

function planRowsHtml(rows,t){
  if(!rows.length)return`<div class="no-data">${T('no_data')}</div>`;
  const byDate=[];
  rows.forEach(row=>{const last=byDate[byDate.length-1];if(last&&last.datum===row.datum)last.rows.push(row);else byDate.push({datum:row.datum,rows:[row]});});
  let h='';
  byDate.forEach(({datum:rowDatum,rows:dayRows})=>{
    const isPast=rowDatum<t,isTdy=rowDatum===t;
    const parts=fmtDate(rowDatum).split(' ');
    const rowId='pr-'+rowDatum;
    const row=dayRows[0];
    const work=dayRows.every(r=>r.type==='work');
    h+=`<div>
      <div class="plan-row${isPast?' is-past':''}${isTdy?' is-today':''}${work?' is-work':''}" onclick="togglePlanRow('${rowId}')">
        <div class="plan-row-date"><strong>${parts[0]} ${parts[1]}</strong>${parts[2]}</div>
        <div class="plan-row-emoji">${RXIcon(row.type||'rest',16,'var(--muted)','var(--accent)')}</div>
        <div class="plan-row-body"><div class="plan-row-title">${dayRows.map(r=>esc(r.title||r.titel||'—')).join(' · ')}</div></div>
        <div class="plan-row-km">${dayRows.map(r=>r.km||r.distance).filter(Boolean).map(k=>k+'km').join('+')}</div>
        ${dayRows.some(r=>r.feedback)?'<div class="plan-row-feedback"></div>':''}
      </div>
      <div class="plan-row-detail" id="${rowId}">
        ${dayRows.map(r=>{const rti=typeOf(r.type);return`
          <div style="padding:8px 0;${dayRows.length>1?'border-bottom:1px solid var(--border)':''}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              ${RXIcon(r.type,14,'var(--muted)','var(--accent)')}
              <span class="badge" style="background:${rti.bg};color:${rti.text}">${T(rti.i18n)}</span>
              ${r.km||r.distance?`<span style="font-family:var(--font-m);font-size:10px;color:var(--accent)">${esc(r.km||r.distance)}km</span>`:''}
            </div>
            <div style="font-family:var(--font-d);font-weight:700;font-size:14px">${esc(r.title||r.titel||'')}</div>
            ${r.details||r.detail?`<div style="font-family:var(--font-m);font-size:12px;color:var(--muted);margin-top:2px">${esc(r.details||r.detail)}</div>`:''}
            ${r.feedback?`<div class="plan-feedback-text">✓ ${esc(r.feedback)}</div>`:''}
            <button style="margin-top:6px;background:none;border:1px solid var(--border);padding:4px 10px;color:var(--muted);font-family:var(--font-m);font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer" onclick="openDayModalRow(${r.rowIndex},'${rowDatum}');event.stopPropagation()">Bewerken</button>
          </div>`;}).join('')}
      </div>
    </div>`;
  });
  return h;
}

function buildPhaseTabs(values){
  document.getElementById('phaseTabs').innerHTML=values.map((f,i)=>
    `<button class="phase-tab${i===0?' active':''}" data-fase="${esc(f)}">${esc(f)}</button>`
  ).join('');
}

function renderPlanWithoutData(t){
  // C22: show current week structure, editable, without schema
  const dates=getWeekDates();
  const days=state.lang==='en'?DAYS_EN:DAYS_NL;
  document.getElementById('phaseTabs').innerHTML='';
  let h=`<div style="margin-bottom:10px">${noSchemaHint()}</div><div class="plan-table">`;
  dates.forEach(date=>{
    const isPast=date<t,isTdy=date===t,d=parseDate(date);
    const rowId='pr-empty-'+date;
    h+=`<div>
      <div class="plan-row${isTdy?' is-today':''}${isPast?' is-past':''}" onclick="openDayModal('${date}')">
        <div class="plan-row-date"><strong>${days[dayIdx(d)]} ${d.getDate()}</strong>${MONTHS_NL[d.getMonth()]}</div>
        <div class="plan-row-emoji">·</div>
        <div class="plan-row-body"><div class="plan-row-title" style="color:var(--faint)">—</div></div>
        <div class="plan-row-km"></div>
      </div>
    </div>`;
  });
  h+='</div>';
  document.getElementById('planContent').innerHTML=h;
}

function _togglePlanFilter(type){
  if(!state.planTypeFilters)state.planTypeFilters=[];
  const idx=state.planTypeFilters.indexOf(type);
  if(idx>=0)state.planTypeFilters.splice(idx,1);
  else state.planTypeFilters.push(type);
  renderPlan();
}

function selectFase(btn,fase){
  state.currentFase=fase;
  document.querySelectorAll('#phaseTabs .plan-fase-row').forEach(b=>b.classList.toggle('is-active',b.dataset.fase===fase));
  const _tf=state.planTypeFilters||[];
  const rows=_tf.length?(state.data||[]).filter(r=>r.fase===fase&&_tf.some(f=>hasType(r.type,f))):(state.data||[]).filter(r=>(r.fase||'')===(fase||''));
  renderPlanRows(rows,todayStr(),'');
}

function renderPlanRows(rows,t,faseBadge=''){
  const el=document.getElementById('planContent');
  if(!rows.length){el.innerHTML=`<div class="no-data">${T('no_data')}</div>`;return;}

  // C49: multi-select filter behind icon
  const activeTypes=[...new Set(rows.map(r=>normalizeType(r.type||'rest')).filter(t=>t&&t!=='rest'&&t!=='work'))];
  const _tf=state.planTypeFilters||[];
  const filterOpen=state.planFilterOpen||false;
  const filterActive=_tf.length>0;
  let filterH=`<div style="display:flex;justify-content:flex-end;margin-bottom:${filterOpen?'8':'0'}px;gap:6px;align-items:center">
    ${filterActive?`<button onclick="state.planTypeFilters=[];renderPlan()" style="background:none;border:none;color:var(--muted);font-family:var(--font-m);font-size:10px;cursor:pointer;padding:2px 0;text-decoration:underline;text-underline-offset:2px">wis filter</button>`:''}
    <button onclick="state.planFilterOpen=!state.planFilterOpen;renderPlan()" style="background:${filterActive?'var(--accent)':'none'};border:1px solid ${filterActive?'var(--accent)':'var(--border)'};padding:5px 8px;cursor:pointer;display:flex;align-items:center;gap:4px;color:${filterActive?'var(--accent-ink)':'var(--muted)'};border-radius:var(--r);-webkit-tap-highlight-color:transparent">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="3,4 21,4 14,12 14,20 10,18 10,12"/></svg>
      ${filterActive?`${_tf.length} filter${_tf.length>1?'s':''}`:T('filter')||'Filter'}
    </button>
  </div>`;
  if(filterOpen&&activeTypes.length>1){
    filterH+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">`;
    activeTypes.forEach(tp=>{
      const active=_tf.includes(tp);
      const label=T(TYPES[tp]?.i18n||tp);
      filterH+=`<button onclick="_togglePlanFilter('${tp}')" style="display:flex;align-items:center;gap:4px;padding:5px 10px;background:${active?'var(--accent)':'var(--surface)'};border:1px solid ${active?'var(--accent)':'var(--border)'};color:${active?'var(--accent-ink)':'var(--muted)'};font-family:var(--font-m);font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border-radius:var(--r);-webkit-tap-highlight-color:transparent">${label}</button>`;
    });
    filterH+='</div>';
  }

  let h=`<div class="plan-content-wrap">${faseBadge||''}${filterH}`;
  let lastFase=null;

  // swipe + scroll container
  h+='<div class="plan-swipe-wrapper" id="planSwipeWrapper"><div class="plan-swipe-inner" id="planSwipeInner">';
  h+='<div class="plan-table">';

  // C57: group by date, show all activities per day
  const byDate=[];
  rows.forEach(row=>{
    const last=byDate[byDate.length-1];
    if(last&&last.datum===row.datum)last.rows.push(row);
    else byDate.push({datum:row.datum,rows:[row]});
  });

  byDate.forEach(({datum:rowDatum,rows:dayRows})=>{
    const isPast=rowDatum<t,isTdy=rowDatum===t;
    const parts=fmtDate(rowDatum).split(' ');
    const rowId='pr-'+rowDatum;
    const row=dayRows[0];
    const work=dayRows.every(r=>r.type==='work');
    const ti=typeOf(row.type);

    // C29: fase float label when fase changes
    if(row.fase&&row.fase!==lastFase){
      h+=`</div><div class="fase-float">${esc(row.fase)}</div><div class="plan-table" style="border-top:none;border-radius:0 0 6px 6px">`;
      lastFase=row.fase;
    }

    // (fase-float is now handled at top of byDate.forEach above)

    h+=`<div>
      <div class="plan-row${isPast?' is-past':''}${isTdy?' is-today':''}${work?' is-work':''}" onclick="togglePlanRow('${rowId}')">
        <div class="plan-row-date"><strong>${parts[0]} ${parts[1]}</strong>${parts[2]}</div>
        <div class="plan-row-emoji">${RXIcon(row.type||'rest',16,'var(--muted)','var(--accent)')}</div>
        <div class="plan-row-body"><div class="plan-row-title">${dayRows.map(r=>esc(r.title||r.titel||'—')).join(' · ')}</div></div>
        <div class="plan-row-km">${dayRows.map(r=>r.km||r.distance).filter(Boolean).map(k=>k+'km').join('+')}</div>
        ${dayRows.some(r=>r.feedback)?'<div class="plan-row-feedback"></div>':''}
      </div>
      <div class="plan-row-detail" id="${rowId}">
        ${dayRows.map(r=>{const rti=typeOf(r.type);return`
          <div style="padding:8px 0;${dayRows.length>1?'border-bottom:1px solid var(--border)':''}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              ${RXIcon(r.type,14,'var(--muted)','var(--accent)')}
              <span class="badge" style="background:${rti.bg};color:${rti.text}">${T(rti.i18n)}</span>
              ${r.km||r.distance?`<span style="font-family:var(--font-m);font-size:10px;color:var(--accent)">${esc(r.km||r.distance)}km</span>`:''}
            </div>
            <div style="font-family:var(--font-d);font-weight:700;font-size:14px">${esc(r.title||r.titel||'')}</div>
            ${r.details||r.detail?`<div style="font-family:var(--font-m);font-size:12px;color:var(--muted);margin-top:2px">${esc(r.details||r.detail)}</div>`:''}
            ${r.feedback?`<div class="plan-feedback-text">✓ ${esc(r.feedback)}</div>`:''}
            <button style="margin-top:6px;background:none;border:1px solid var(--border);padding:4px 10px;color:var(--muted);font-family:var(--font-m);font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer" onclick="openDayModalRow(${r.rowIndex},'${rowDatum}');event.stopPropagation()">Bewerken</button>
          </div>`;}).join('')}
      </div>
    </div>`;
  });

  h+='</div>';

  // C29: next-fase nudge at bottom
  const faseValues=state.data?[...new Set(state.data.map(r=>r.fase||'').filter(Boolean))]:[];
  const activeFase=document.getElementById('phaseTabs')?.querySelector('.plan-fase-row.is-active')?.dataset.fase;
  if(activeFase&&faseValues.length>1){
    const idx=faseValues.indexOf(activeFase);
    if(idx<faseValues.length-1){
      const nextFase=faseValues[idx+1];
      h+=`<div class="fase-next-nudge" onclick="selectFaseByName('${esc(nextFase)}')">
        <span style="color:var(--faint);margin-right:4px">${esc(T('next_fase'))}:</span> ${esc(nextFase)}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>`;
    }
  }

  h+='</div></div></div>'; // close swipe-inner + swipe-wrapper + plan-content-wrap
  el.innerHTML=h;
  requestAnimationFrame(()=>{
    el.querySelector('.is-today')?.scrollIntoView({behavior:'smooth',block:'center'});
    initPlanSwipe();
  });
}

function togglePlanRow(id){
  const detail=document.getElementById(id);if(!detail)return;
  const isOpen=detail.classList.contains('open');
  document.querySelectorAll('.plan-row-detail.open').forEach(d=>d.classList.remove('open'));
  if(!isOpen)detail.classList.add('open');
}

// navigate to fase by name
function selectFaseByName(fase){
  const tile=document.querySelector(`#phaseTabs .plan-fase-row[data-fase="${CSS.escape(fase)}"]`);
  if(tile)selectFase(tile,fase);
}

// C27: swipe gesture for Training tab
function initPlanSwipe(){
  const wrapper=document.getElementById('planSwipeWrapper');
  if(!wrapper)return;
  let startX=0,startY=0,dragging=false;
  wrapper.addEventListener('touchstart',e=>{
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;dragging=true;
  },{passive:true});
  wrapper.addEventListener('touchend',e=>{
    if(!dragging)return;dragging=false;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      swipePlanFase(dx<0?1:-1);
    }
  },{passive:true});
}

function swipePlanFase(dir){
  if(!state.data)return;
  const faseValues=[...new Set(state.data.map(r=>r.fase||'').filter(Boolean))];
  if(faseValues.length<=1)return;
  const phaseTabs=document.getElementById('phaseTabs');
  const active=phaseTabs?.querySelector('.plan-fase-row.is-active');
  if(!active)return;
  const idx=faseValues.indexOf(active.dataset.fase);
  const next=faseValues[idx+dir];
  if(next===undefined)return;
  const btn=phaseTabs.querySelector(`[data-fase="${CSS.escape(next)}"]`);
  if(btn)selectFase(btn,next);
}

// ── DAY MODAL (C22 + C28) ─────────────────────────────────────────────────────
function openDayModal(dateStr,targetRowIndex){
  // C34: support multiple rows per date
  const rows=state.data?.filter(r=>r.datum===dateStr)||[];
  // If targetRowIndex given, show that specific row; else show all
  // Priority: state.editingRowIndex > targetRowIndex > first row
  const resolvedIdx=state.editingRowIndex||targetRowIndex||null;
  const row=resolvedIdx
    ?rows.find(r=>r.rowIndex===resolvedIdx)||rows[0]||null
    :rows[0]||null;
  const t=todayStr(),isPast=dateStr<=t;
  const ti=row?typeOf(row.type):null;
  const content=document.getElementById('dayModalContent');
  state.editingFeedback=false;state.selectedRating=0;

  // C37: date kicker + title layout
  const d=parseDate(dateStr);
  const dayNames=state.lang==='en'?DAYS_EN:DAYS_NL;
  const mNames=state.lang==='en'?MONTHS_FULL_EN:MONTHS_FULL_NL;
  let h=`<div style="margin-bottom:16px">
    <div style="font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">${dayNames[dayIdx(d)]} · ${mNames[d.getMonth()]} ${d.getFullYear()}</div>
    <div style="font-family:var(--font-d);font-weight:800;font-size:28px;line-height:1;text-transform:uppercase">${d.getDate()} ${mNames[d.getMonth()]}</div>
  </div>`;

  if(!row){
    // C28: empty day — type picker at top, then training details, notes at bottom (smaller)
    const typeOptions=ACTIVITY_OPTIONS.map(o=>
      `<option value="${o.value}"${o.value==='rest'?' selected':''}>${o.nl}</option>`
    ).join('');
    h+=`<div class="feedback-section" style="margin-bottom:10px">
      <div class="feedback-title">${'Activiteit toevoegen'}</div>
      <div style="margin-bottom:8px">
        <label class="settings-label">${T('type_label')}</label>
        <select class="plan-edit-field" id="edit-type" style="width:100%;padding:8px 10px">
          ${typeOptions}
        </select>
      </div>
      <div style="margin-bottom:8px">
        <label class="settings-label">${T('field_titel')}</label>
        <input class="plan-edit-field" id="edit-titel" value="" placeholder="${T('field_titel')}">
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1">
          <label class="settings-label">${'Afstand'}</label>
          <input class="plan-edit-field" id="edit-km" value="" placeholder="0" type="number" step="0.1">
        </div>
  
      </div>
      <div style="margin-bottom:8px">
        <label class="settings-label">${T('field_detail')}</label>
        <textarea class="plan-edit-field" id="edit-detail" style="height:56px;resize:none"></textarea>
      </div>
      <button class="btn-primary" onclick="saveDayEdit('${dateStr}')">${T('save_changes')}</button>
    </div>
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:0;padding:10px 14px;margin-bottom:10px">
      <div style="font-family:var(--font-m);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--faint);margin-bottom:6px">${T('notes_q')}</div>
      <textarea class="feedback-textarea" id="modalNoteText" style="height:56px;margin-bottom:8px"></textarea>
      <button class="btn-secondary" style="margin-top:0" onclick="saveModalNote('${dateStr}')">${T('notes_save')}</button>
    </div>`;
  }else{
    const border=row.type==='work'?'work-border':row.type==='race'?'race-border':'';
    // C37: cleaner card, C34: show all rows if multiple
    rows.forEach((r,idx)=>{
      const rti=typeOf(r.type);
      const rb=r.type==='work'?'work-border':r.type==='race'?'race-border':'';
      const isRaceRow=r.type==='race';
      // Parse raceType from detail (format: "dist · raceType · Doel: xx")
      const detailParts=(r.detail||'').split('·').map(s=>s.trim()).filter(Boolean);
      const parsedRaceType=isRaceRow&&detailParts.length>1?detailParts[1].replace(/Doel:.*/,'').trim():'';
      const iconKey=isRaceRow?raceTypeIconKey(parsedRaceType,r.km):(r.type?.split(',')[0].trim()||'run');
      const clickHandler=isRaceRow?`openRaceModalFromSheet(${r.rowIndex})`:`openDayModal(this.dataset.date)`;
      h+=`<div class="card ${rb}" onclick="${clickHandler}" data-date="${dateStr}" style="padding:14px 16px;margin-bottom:${idx<rows.length-1?'8':'10'}px;cursor:pointer;-webkit-tap-highlight-color:transparent">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${r.detail?'10':'0'}px">
          <div style="width:32px;height:32px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${RXIcon(iconKey,18,isRaceRow?'var(--race-text)':'var(--text)',isRaceRow?'var(--race-text)':'var(--accent)')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-m);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;color:${rti.text};margin-bottom:2px">${T(rti.i18n)}${parsedRaceType?' · '+esc(parsedRaceType):''}</div>
            <div style="font-family:var(--font-d);font-weight:800;font-size:20px;line-height:1">${esc(r.titel||'Training')}</div>
          </div>
          ${r.km?`<div style="font-family:var(--font-d);font-weight:800;font-size:22px;color:${isRaceRow?'var(--race-text)':'var(--accent)'};flex-shrink:0">${esc(r.km)}<span style="font-size:12px;color:var(--muted)">km</span></div>`:''}
        </div>
        ${r.detail?`<div style="font-family:var(--font-m);font-size:12px;color:var(--muted);line-height:1.6;padding-top:10px;border-top:1px solid var(--border)">${esc(r.detail)}</div>`:''}
      </div>`;
    });

    // Feedback — dag level, one block, collapsed by default
    const fbRow=rows.find(r=>r.type!=='work'&&r.type!=='rest')||null;
    const existingFb=fbRow?.feedback||'';
    if(fbRow){
      if(isPast){
        if(existingFb&&!state.editingFeedback){
          // Show compact "given" state + edit link
          h+=`<div class="prev-feedback" style="margin-bottom:10px">
            <div class="prev-feedback-header">
              <span class="prev-feedback-label">${T('feedback_logged')}</span>
              <button class="edit-link" onclick="state.editingFeedback=true;openDayModal('${dateStr}',${row?.rowIndex||'null'})">${T('feedback_edit')}</button>
            </div>
            <div class="prev-feedback-text">${esc(existingFb)}</div>
          </div>`;
        }else{
          // Collapsed — show "Geef feedback" link that expands inline
          h+=`<div id="fbCollapse" style="margin-bottom:10px">
            ${!existingFb?`<button onclick="expandFeedback('${dateStr}')" style="background:none;border:none;color:var(--accent);font-family:var(--font-m);font-size:10px;letter-spacing:1px;cursor:pointer;padding:0;text-transform:uppercase">› ${T('feedback_q')}</button>`:''}
            ${existingFb?feedbackHtmlModal(dateStr,existingFb):''}
          </div>`;
          // expandFeedback() is called by the button onclick
        }
      }
    }

    // Edit section — collapsible
    const typeOptions=ACTIVITY_OPTIONS.map(o=>
      `<option value="${o.value}"${row.type===o.value?' selected':''}>${o.nl}</option>`
    ).join('');
    h+=`<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px">
      <button onclick="document.getElementById('editFields').style.display=document.getElementById('editFields').style.display==='none'?'block':'none'" style="background:none;border:none;color:var(--muted);font-family:var(--font-m);font-size:10px;letter-spacing:1px;cursor:pointer;padding:0;text-transform:uppercase;width:100%;text-align:left;margin-bottom:6px">› Activiteit bewerken</button>
      <div id="editFields" style="display:none">
        <div style="margin-bottom:8px">
          <label class="settings-label">Dag</label>
          <input class="plan-edit-field" id="edit-datum" type="date" value="${esc(dateStr||'')}" style="width:100%;padding:8px 10px">
        </div>
        <div style="margin-bottom:8px">
          <label class="settings-label">${T('field_titel')}</label>
          <input class="plan-edit-field" id="edit-titel" value="${esc(row?.titel||'')}" placeholder="${T('field_titel')}">
        </div>
        <div style="margin-bottom:8px">
          <label class="settings-label">${T('type_label')}</label>
          <select class="plan-edit-field" id="edit-type" style="width:100%;padding:8px 10px" onchange="['raceGoalWrap','raceTypeWrap'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=this.value==='race'?'block':'none';}.bind(this))">
            ${typeOptions}
            <option value="${esc(row.type||'')}"${!TYPES[row.type]?' selected':''}>${esc(row.type||'')}</option>
          </select>
        </div>
        <div id="raceTypeWrap" style="margin-bottom:8px;display:${row.type==='race'?'block':'none'}">
          <label class="settings-label">Type race</label>
          <select class="plan-edit-field" id="edit-race-type" style="width:100%;padding:8px 10px">
            <option value="">—</option>
            <option value="baan"${(row?.race_type||'')==='baan'?' selected':''}>Baan</option>
            <option value="weg"${(row?.race_type||'')==='weg'?' selected':''}>Weg</option>
            <option value="trail"${(row?.race_type||'')==='trail'?' selected':''}>Trail</option>
            <option value="ultra"${(row?.race_type||'')==='ultra'?' selected':''}>Ultra</option>
            <option value="anders"${(row?.race_type||'')==='anders'?' selected':''}>Anders</option>
          </select>
        </div>
        <div id="raceGoalWrap" style="margin-bottom:8px;display:${row.type==='race'?'block':'none'}">
          <label class="settings-label">Doeltijd (optioneel)</label>
          <input class="plan-edit-field" id="edit-goal" placeholder="bijv. 37:30" value="${esc(row?.detail?.match(/doel[:\s]+([0-9:]+)/i)?.[1]||'')}">
        </div>
        <div style="margin-bottom:8px">
          <label class="settings-label">${'Afstand'}</label>
          <input class="plan-edit-field" id="edit-km" value="${esc(row?.km||'')}" placeholder="0" type="number" step="0.1">
        </div>
        <div style="margin-bottom:8px">
          <label class="settings-label">${T('field_detail')}</label>
          <textarea class="plan-edit-field" id="edit-detail" style="height:56px;resize:none">${esc(row?.detail||'')}</textarea>
        </div>
        <button class="btn-primary" onclick="saveDayEdit('${dateStr}')">${T('save_changes')}</button>
        ${row?.rowIndex?`<button class="btn-secondary" style="margin-top:6px;color:var(--race-text);border-color:rgba(244,67,54,0.4)" onclick="deleteActivity(${row.rowIndex})">Verwijderen</button>`:''}
      </div>
    </div>`;
  }

  content.innerHTML=h;
  attachStarListeners('dayModalContent');
  // Store rowIndex for saveDayEdit to use
  state.editingRowIndex=row?.rowIndex||null;
  document.getElementById('dayModal').classList.add('open');
}

function feedbackHtmlModal(datum,existing){
  const isEdit=!!existing;let rating=0,text='';
  if(isEdit){const m=existing.match(/^(\d)/);if(m)rating=parseInt(m[1]);const mt=existing.match(/–\s*(.+)$/);if(mt)text=mt[1];}
  if(isEdit&&!state.editingFeedback){
    return `<div class="prev-feedback">
      <div class="prev-feedback-header">
        <span class="prev-feedback-label">${T('feedback_logged')}</span>
        <button class="edit-link" onclick="state.editingFeedback=true;openDayModal('${datum}')">${T('feedback_edit')}</button>
      </div>
      <div class="prev-feedback-text">${esc(existing)}</div>
    </div>`;
  }
  const stars=['😵','😓','😐','💪','🔥'].map((e,i)=>
    `<button class="star-btn${rating>0&&(i+1)<=rating?' active':''}" data-val="${i+1}">${e}</button>`
  ).join('');
  return `<div class="feedback-section">
    <div class="feedback-title">${T('feedback_q')}</div>
    <div class="feedback-stars">${stars}</div>
    <textarea class="feedback-textarea" id="modalFbText">${esc(text)}</textarea>
    <button class="btn-primary" id="modalSubmitBtn" onclick="handleModalFeedback('${esc(datum)}')">${isEdit?T('feedback_update'):T('feedback_save')}</button>
    ${isEdit?`<button class="btn-secondary" onclick="state.editingFeedback=false;openDayModal('${datum}')">${T('feedback_cancel')}</button>`:''}
  </div>`;
}

function expandFeedback(datum){
  const el=document.getElementById('fbCollapse');if(!el)return;
  const stars=['😵','😓','😐','💪','🔥'].map((e,i)=>
    `<button class="star-btn" data-val="${i+1}">${e}</button>`).join('');
  el.innerHTML=`<div class="feedback-section">
    <div class="feedback-title">${T('feedback_q')}</div>
    <div class="feedback-stars">${stars}</div>
    <textarea class="feedback-textarea" id="modalFbText"></textarea>
    <button class="btn-primary" id="modalSubmitBtn" onclick="handleModalFeedback('${esc(datum)}')">${T('feedback_save')}</button>
  </div>`;
  attachStarListeners('fbCollapse');
}

async function handleModalFeedback(datum){
  if(!state.selectedRating){showToast(T('select_score'));return;}
  const btn=document.getElementById('modalSubmitBtn');
  const tekst=document.getElementById('modalFbText')?.value||'';
  btn.disabled=true;btn.textContent='…';
  const ok=await submitFeedback(datum,state.selectedRating,tekst);
  if(ok){state.editingFeedback=false;state.selectedRating=0;closeDayModal();renderActiveView();}
  else{btn.disabled=false;btn.textContent=T('feedback_save');}
}

async function saveModalNote(datum){
  const tekst=document.getElementById('modalNoteText')?.value||'';
  if(!state.scriptUrl){showToast('❌ '+T('enter_url'));return;}
  try{
    const params=new URLSearchParams({action:'setFeedback',datum,rating:0,tekst});
    if(state.sheetName)params.set('sheetName',state.sheetName);
    const json=await(await fetch(state.scriptUrl+'?'+params)).json();
    if(json.status!=='ok')throw new Error(json.message);
    if(state.data){const row=state.data.find(r=>r.datum===datum);if(row)row.feedback=tekst;}
    showToast('✓ '+T('notes_save'));closeDayModal();
  }catch(e){showToast('❌ '+humanError(e));}
}

async function saveDayEdit(datum){
  const newDatum=document.getElementById('edit-datum')?.value||datum;
  const titel=document.getElementById('edit-titel')?.value.trim()||'';
  const typeRaw=document.getElementById('edit-type')?.value.trim()||'';
  const type=toSheetType(typeRaw)||typeRaw;
  const km=document.getElementById('edit-km')?.value.trim()||'';
  const detail=document.getElementById('edit-detail')?.value.trim()||'';
  const race_type=document.getElementById('edit-race-type')?.value||'';
  const fase=getFaseForDate(newDatum)||getFaseForDate(datum);
  datum=newDatum;
  const fields={datum,titel,type,km,detail,fase,...(race_type?{race_type}:{})};

  // Use only the explicitly set editingRowIndex — never infer from datum
  const editingRowIndex=state.editingRowIndex||null;

  if(state.scriptUrl){
    try{
      if(editingRowIndex){
        await updateActivity(editingRowIndex,fields);
      }else{
        await createActivity(fields);
      }
    }catch(e){
      // Fallback: update local cache only
      if(state.data){
        let row=state.data.find(r=>r.rowIndex===editingRowIndex||r.datum===datum);
        if(row)Object.assign(row,fields);
        else state.data.push({...fields,feedback:'',rowIndex:null});
      }
      showToast('⚠ Lokaal opgeslagen: '+e.message);
      closeDayModal();renderActiveView();return;
    }
  }else{
    // No sheet — local only
    if(state.data){
      let row=state.data.find(r=>r.rowIndex===editingRowIndex||r.datum===datum);
      if(row)Object.assign(row,fields);
      else state.data.push({...fields,feedback:'',rowIndex:null});
    }
  }

  state.editingRowIndex=null;
  showToast(T('saved'));
  closeDayModal();
  renderActiveView();
}

async function deleteActivity(rowIndex){
  if(!rowIndex)return;
  // Show inline confirmation instead of blocking confirm()
  const btn=document.querySelector(`[onclick="deleteActivity(${rowIndex})"]`);
  if(btn&&!btn.dataset.confirming){
    btn.dataset.confirming='1';
    btn.textContent='Zeker weten? Klik opnieuw';
    btn.style.color='var(--race-text)';
    setTimeout(()=>{if(btn){btn.textContent='Verwijderen';btn.style.color='';delete btn.dataset.confirming;}},3000);
    return;
  }
  // Buffer first, close modal immediately — don't wait for sheet
  const row=state.data?.find(r=>r.rowIndex===rowIndex);
  if(row){
    clearTimeout(state._undoBuffer?.timeout);
    state._undoBuffer={row, timeout:setTimeout(()=>{state._undoBuffer=null;},10000)};
    // Optimistic: remove from local cache immediately
    if(state.data)state.data=state.data.filter(r=>r.rowIndex!==rowIndex);
  }
  state.editingRowIndex=null;
  closeDayModal();
  renderActiveView();renderHeader();
  showToast('Verwijderd',true);
  // Delete from sheet in background
  if(state.scriptUrl){
    try{await sheetDeleteRow(rowIndex);}
    catch(e){
      // Rollback: re-add to local cache
      if(row&&state.data)state.data.push(row);
      showToast('❌ Verwijderen mislukt');
      renderActiveView();
    }
  }
}

// C44: open ADD mode (new activity), independent of existing row
// Open day modal for a specific row by rowIndex (multi-activity days)
function openDayModalRow(rowIndex,dateStr){
  // Pre-set the editingRowIndex so openDayModal uses the right row
  state.editingRowIndex=rowIndex;
  // Find the specific row and pass it as context
  const row=state.data?.find(r=>r.rowIndex===rowIndex);
  if(row)openDayModal(dateStr,rowIndex);
  else openDayModal(dateStr);
}

function openAddActivity(dateStr){
  const content=document.getElementById('dayModalContent');
  state.editingFeedback=false;state.selectedRating=0;

  const d=parseDate(dateStr);
  const dayNames=state.lang==='en'?DAYS_EN:DAYS_NL;
  const mNames=state.lang==='en'?MONTHS_FULL_EN:MONTHS_FULL_NL;
  const typeOptions=Object.entries(TYPES).map(([k,v])=>
    `<option value="${k}"${k==='run'?' selected':''}>${T(v.i18n)}</option>`
  ).join('');

  content.innerHTML=`<div style="margin-bottom:16px">
    <div style="font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">${dayNames[dayIdx(d)]} · ${mNames[d.getMonth()]} ${d.getFullYear()}</div>
    <div style="font-family:var(--font-d);font-weight:800;font-size:28px;line-height:1;text-transform:uppercase">${d.getDate()} ${mNames[d.getMonth()]}</div>
  </div>
  <div class="feedback-section">
    <div style="font-family:var(--font-m);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">${'Activiteit toevoegen'}</div>
    <div style="margin-bottom:8px">
      <label class="settings-label">${T('type_label')}</label>
      <select class="plan-edit-field" id="edit-type" style="width:100%;padding:8px 10px">${typeOptions}</select>
    </div>
    <div style="margin-bottom:8px">
      <label class="settings-label">${T('field_titel')}</label>
      <input class="plan-edit-field" id="edit-titel" value="" placeholder="${T('field_titel')}">
    </div>
    <div style="margin-bottom:8px">
      <label class="settings-label">${'Afstand'}</label>
      <input class="plan-edit-field" id="edit-km" value="" placeholder="0" type="number" step="0.1">
    </div>
    <div style="margin-bottom:8px">
      <label class="settings-label">${T('field_detail')}</label>
      <textarea class="plan-edit-field" id="edit-detail" style="height:56px;resize:none"></textarea>
    </div>
    <button class="btn-primary" onclick="saveDayEdit('${dateStr}')">${T('save_changes')}</button>
  </div>`;
  state.editingRowIndex=null;
  document.getElementById('dayModal').classList.add('open');
}

function closeDayModal(e){
  if(e&&e.target!==document.getElementById('dayModal'))return;
  document.getElementById('dayModal').classList.remove('open');
  state.editingFeedback=false;state.selectedRating=0;
  state.editingRowIndex=null;
}

// ── STATS OVERLAY ─────────────────────────────────────────────────────────────
function openStats(){
  const el=document.getElementById('statsOverlay');
  const content=document.getElementById('statsContent');
  if(!el||!content)return;
  const t=todayStr();
  const past=state.data?state.data.filter(r=>r.datum<=t):[];
  const totalKm=past.reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  const runCount=past.filter(r=>hasType(r.type,'run')).length;
  const fbRows=past.filter(r=>r.feedback);
  const ratingRows=fbRows.filter(r=>/^\d/.test(r.feedback));
  const avgRating=ratingRows.length?ratingRows.reduce((s,r)=>s+parseInt(r.feedback[0]),0)/ratingRows.length:0;
  const sheetRaceRows3=(state.data||[]).filter(r=>r.type==='race'&&r.datum).sort((a,b)=>a.datum.localeCompare(b.datum));
  const nextRace3=sheetRaceRows3.find(r=>daysUntil(r.datum)>=0)||sheetRaceRows3[0];
  const daysLeft=nextRace3?daysUntil(nextRace3.datum):0;
  const mondayStr=getMondayStr();
  const weekKm=(state.data||[]).filter(r=>r.datum>=mondayStr&&r.datum<=t).reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  const months=state.lang==='en'?MONTHS_EN:MONTHS_NL;

  const tiles=[
    {label:T('stats_total'),val:totalKm.toFixed(0),unit:T('stats_done'),hi:true},
    {label:T('stats_days'),val:daysLeft,unit:nextRace3?.titel||nextRace3?.datum||'—',hi:true},
    {label:T('stats_runs'),val:runCount,unit:T('stats_sessions'),hi:false},
    {label:T('stats_week'),val:weekKm.toFixed(0),unit:T('stats_week_sub'),hi:true},
    avgRating>0?{label:T('stats_feel'),val:avgRating.toFixed(1),unit:`/5 · ${ratingRows.length} ${T('stats_fb_sub')}`,hi:false}:null,
    {label:T('stats_feedback'),val:fbRows.length,unit:T('stats_fb_sub'),hi:false},
  ].filter(Boolean);

  let h=`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div>
      <div style="font-family:var(--font-d);font-size:13px;font-weight:600;color:var(--muted);letter-spacing:-0.01em">all-time</div>
      <div style="font-family:var(--font-d);font-weight:800;font-size:26px;letter-spacing:-0.04em;color:var(--text);line-height:1;margin-top:2px">Jouw run</div>
    </div>
    <button onclick="closeStats()" style="background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:8px 14px;cursor:pointer;font-family:var(--font-d);font-size:13px;border-radius:8px;-webkit-tap-highlight-color:transparent">✕</button>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">`;
  tiles.forEach(t=>{
    h+=`<div style="background:var(--surface);border:1px solid var(--border);padding:16px;border-radius:12px">
      <div style="font-family:var(--font-d);font-size:12px;color:var(--muted);letter-spacing:-0.005em;margin-bottom:8px;font-weight:500">${esc(t.label)}</div>
      <div style="font-family:var(--font-d);font-weight:800;font-size:36px;line-height:1;letter-spacing:-0.04em;color:${t.hi?'var(--accent)':'var(--text)'}">${esc(String(t.val))}</div>
      <div style="font-family:var(--font-d);font-size:12px;color:var(--muted);margin-top:4px">${esc(t.unit)}</div>
    </div>`;
  });
  h+='</div>';
  if(fbRows.length){
    h+=`<div style="font-family:var(--font-d);font-size:13px;font-weight:600;color:var(--muted);letter-spacing:-0.01em;margin-bottom:10px">${T('stats_recent')}</div>`;
    fbRows.slice(-3).reverse().forEach(row=>{
      const d=parseDate(row.datum);
      h+=`<div style="background:var(--surface);border:1px solid var(--border);padding:14px;border-radius:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <div style="font-family:var(--font-d);font-weight:600;font-size:14px;letter-spacing:-0.01em">${esc(row.titel||'Training')}</div>
          <span style="font-family:var(--font-d);font-size:12px;color:var(--muted)">${d.getDate()} ${months[d.getMonth()]}</span>
        </div>
        <div style="font-family:var(--font-d);font-size:13px;color:var(--text2);line-height:1.5">${esc(row.feedback)}</div>
      </div>`;
    });
  }
  content.innerHTML=h;
  el.style.display='flex';
}

function closeStats(e){
  if(e&&e.target!==document.getElementById('statsOverlay'))return;
  document.getElementById('statsOverlay').style.display='none';
}

// ── WEEK SWIPE ────────────────────────────────────────────────────────────────
function initWeekSwipe(){
  const wrap=document.getElementById('weekSwipeWrap');
  if(!wrap||wrap._swipeInit)return;
  wrap._swipeInit=true;
  let sx=0,sy=0;
  wrap.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  wrap.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      state.weekOffset=(state.weekOffset||0)+(dx<0?1:-1);
      renderWeek();
    }
  },{passive:true});
}

// helper: get week dates for a given offset
// C51: week tile click — only border highlight, never opens modal
function weekScrollToDay(date){
  const row=document.querySelector(`[data-upcoming-date="${date}"]`);
  if(row){row.scrollIntoView({behavior:'smooth',block:'nearest'});row.style.outline='2px solid var(--accent)';setTimeout(()=>row.style.outline='',1200);}
}

function weekDragStart(e,rowIndex,date){
  e.dataTransfer.setData('rowIndex',rowIndex);
  e.dataTransfer.setData('date',date);
  e.dataTransfer.effectAllowed='move';
  e.currentTarget.style.opacity='0.4';
}

function weekDragEnd(e){
  e.currentTarget.style.opacity='';
  document.querySelectorAll('.wdr-drop-target').forEach(el=>el.classList.remove('wdr-drop-target'));
}

async function weekDropOnDay(e,newDate){
  e.preventDefault();
  const rowIndex=parseInt(e.dataTransfer.getData('rowIndex'));
  const oldDate=e.dataTransfer.getData('date');
  if(!oldDate||newDate===oldDate)return;
  const row=state.data?.find(r=>r.rowIndex===rowIndex||(r.datum===oldDate));
  if(!row)return;
  showToast('Verplaatsen…');
  const fase=getFaseForDate(newDate)||row.fase||'';
  const fields={...row,datum:newDate,fase};
  try{
    if(rowIndex&&state.scriptUrl)await updateActivity(rowIndex,fields);
    else if(rowIndex)await oauthUpdateRow(rowIndex,fields);
    row.datum=newDate;row.fase=fase;
    showToast('✓ Verplaatst naar '+newDate.slice(8)+' '+['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][parseInt(newDate.slice(5,7))-1]);
    renderWeek();
  }catch(err){showToast('❌ '+err.message);}
}

function weekTileClick(date){
  const t=todayStr();
  // Remove selected class from all, add to clicked
  document.querySelectorAll('[data-week-tile]').forEach(el=>{
    if(el.dataset.weekTile===date){
      el.classList.add('wt-selected');
    } else {
      el.classList.remove('wt-selected');
    }
  });
  // Scroll upcoming row
  document.querySelectorAll('[data-upcoming-date]').forEach(el=>el.classList.remove('wt-selected'));
  const row=document.querySelector(`[data-upcoming-date="${date}"]`);
  if(row){
    row.scrollIntoView({behavior:'smooth',block:'nearest'});
    row.classList.add('wt-selected');
    setTimeout(()=>row.classList.remove('wt-selected'),1500);
  }
}

function getWeekDatesOffset(offset){
  const n=new Date();n.setHours(12,0,0,0); // noon avoids DST edge cases
  n.setDate(n.getDate()+(offset||0)*7);
  const dow=n.getDay();
  n.setDate(n.getDate()-(dow===0?6:dow-1)); // rewind to Monday
  return Array.from({length:7},(_,i)=>{
    const d=new Date(n);d.setDate(n.getDate()+i);
    // local date parts — never UTC
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  });
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
function renderCalendar(){
  const el=document.getElementById('calContent');
  const y=state.calYear,m=state.calMonth;
  const mf=state.lang==='en'?MONTHS_FULL_EN:MONTHS_FULL_NL;
  const firstDay=new Date(y,m,1);
  const lastDay=new Date(y,m+1,0);
  const startPad=(firstDay.getDay()+6)%7;
  const t=todayStr();

  // Build cells
  const cells=[];
  for(let i=0;i<startPad;i++){const d=new Date(y,m,1-startPad+i);cells.push({date:d,other:true});}
  for(let i=1;i<=lastDay.getDate();i++)cells.push({date:new Date(y,m,i),other:false});
  while(cells.length%7!==0){const p=cells[cells.length-1].date;const nd=new Date(p);nd.setDate(p.getDate()+1);cells.push({date:nd,other:true});}

  // Date → primary training type
  const dateTypeMap={};
  (state.data||[]).forEach(r=>{
    if(!r.datum||r.type==='rest'||r.type==='work')return;
    if(!dateTypeMap[r.datum])dateTypeMap[r.datum]=normalizeType(r.type||'run');
  });

  const sheetRaces=(state.data||[]).filter(r=>r.type==='race'&&r.datum);

  // Header
  let h=`<div class="cal-header">
    <div class="cal-month-title">${mf[m]} ${y}</div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="week-nav-btn" onclick="calPrev()">‹</button>
      <button class="week-nav-btn" onclick="calNext()">›</button>
    </div>
  </div>
  <div style="padding:0 16px">`;

  // Day-of-week headers
  h+=`<div class="cal-grid" style="margin-bottom:4px">`;
  ['M','D','W','D','V','Z','Z'].forEach(d=>{h+=`<div class="cal-dow">${d}</div>`;});
  h+=`</div>`;

  // Day cells
  h+=`<div class="cal-grid" style="gap:4px">`;
  cells.forEach(({date,other})=>{
    const y2=date.getFullYear(),m2=String(date.getMonth()+1).padStart(2,'0'),d2=String(date.getDate()).padStart(2,'0');
    const ds=`${y2}-${m2}-${d2}`;
    const isToday=ds===t;
    const isSel=state.calSelectedDate===ds;
    const type=dateTypeMap[ds];
    const dotColor=type?typeOf(type).text:null;
    h+=`<div onclick="${other?'':(`selectCalDate('${ds}')`)}" class="cal-cell2${isToday?' c2-today':''}${other?' c2-other':''}${isSel?' c2-sel':''}">
      <div class="c2-num">${date.getDate()}</div>
      ${dotColor&&!other?`<div class="c2-dot" style="background:${isToday?'rgba(6,32,25,0.55)':dotColor}"></div>`:''}
    </div>`;
  });
  h+=`</div>`;

  // Category legend for this month
  const monthTypes=[...new Set((state.data||[]).filter(r=>{if(!r.datum||r.type==='rest'||r.type==='work')return false;const rd=parseDate(r.datum);return rd.getFullYear()===y&&rd.getMonth()===m;}).map(r=>normalizeType(r.type||'run')).filter(Boolean))];
  if(monthTypes.length){
    h+=`<div class="cal-legend">`;
    monthTypes.forEach(type=>{const ti=typeOf(type);h+=`<div class="cal-legend-item"><div style="width:6px;height:6px;border-radius:999px;flex-shrink:0;background:${ti.text}"></div><span>${T(ti.i18n)}</span></div>`;});
    h+=`</div>`;
  }

  // Selected date detail
  if(state.calSelectedDate){
    const selRows=(state.data||[]).filter(r=>r.datum===state.calSelectedDate);
    if(selRows.length){
      selRows.forEach(r=>{
        const ti=typeOf(r.type);
        h+=`<div class="today-tmr-card" onclick="openDayModal('${state.calSelectedDate}')" style="margin-bottom:6px;-webkit-tap-highlight-color:transparent">
          <div class="today-tmr-bar" style="background:${ti.text}"></div>
          <div style="flex:1;min-width:0">
            <div class="today-tmr-label">${T(ti.i18n)}</div>
            <div class="today-tmr-title">${esc(r.titel||'')}${r.km?' · '+esc(r.km)+' km':''}</div>
          </div>
          <div class="today-tmr-chevron">›</div>
        </div>`;
      });
    }
  }

  // Month races
  const monthRaces=sheetRaces.filter(r=>{const rd=parseDate(r.datum);return rd.getFullYear()===y&&rd.getMonth()===m;}).sort((a,b)=>a.datum.localeCompare(b.datum));
  if(monthRaces.length){
    h+=`<div style="font-family:var(--font-d);font-size:13px;font-weight:600;color:var(--muted);margin:14px 0 8px">${T('races_this_month')}</div>`;
    monthRaces.forEach(r=>{
      const cd=countdownDisplay(daysUntil(r.datum));
      h+=`<div class="cal-race-row" onclick="openDayModal('${r.datum}')">
        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center">${RXIcon('race',20,'var(--race-text)','var(--race-text)')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-d);font-size:12px;font-weight:600;color:var(--cat-race);margin-bottom:2px">Race</div>
          <div style="font-family:var(--font-d);font-size:14px;font-weight:600">${esc(r.titel||r.datum)}</div>
          ${r.km?`<div style="font-family:var(--font-d);font-size:12px;color:var(--muted)">${esc(r.km)} km</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-d);font-weight:800;font-size:20px;color:var(--text);letter-spacing:-0.03em;line-height:1">${cd.val}</div>
          <div style="font-family:var(--font-d);font-size:11px;color:var(--muted);margin-top:2px">${cd.unit}</div>
        </div>
      </div>`;
    });
  }

  h+=`</div>`; // close padding wrapper
  el.innerHTML=h;
  if(!el._calSwipe){
    el._calSwipe=true;let sx=0;
    el.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;},{passive:true});
    el.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>50){dx<0?calNext():calPrev();}},{passive:true});
  }
}

function selectCalDate(ds){state.calSelectedDate=state.calSelectedDate===ds?null:ds;renderCalendar();}
function calPrev(){state.calMonth--;if(state.calMonth<0){state.calMonth=11;state.calYear--;}state.calSelectedDate=null;renderCalendar();}
function calNext(){state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}state.calSelectedDate=null;renderCalendar();}

// ── RACE MODAL ────────────────────────────────────────────────────────────────
// Open race edit modal from a sheet row (C34: sheet is source of truth)
function openRaceModalFromSheet(rowIndex){
  const r=state.data?.find(r=>r.rowIndex===rowIndex);
  if(!r)return;
  // raceType comes from localStorage only (not sheet detail)
  const localRaces=loadRaces();
  const lr=localRaces.find(l=>l.date===r.datum)||localRaces.find(l=>l.name===(r.titel||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{2BFF}\s]+/u,'').trim());
  const raceType=lr?.raceType||'';
  const rawDetail=(r.detail||'').replace(/\s*\(Doel:[^)]*\)/,'').trim();
  const notes=lr?.notes||rawDetail||'';
  const goalMatch=(r.detail||'').match(/\(Doel:\s*(\d+:\d{2}(?::\d{2})?)\)/);
  const goal=goalMatch?goalMatch[1]:'';
  const emojiRx=/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{2BFF}\s]+/u;
  const cleanTitle=(r.titel||'').replace(emojiRx,'').trim();
  const syntheticRace={id:'sheet_'+rowIndex,name:cleanTitle||r.titel||'',date:r.datum,dist:r.km||'',raceType,mainGoal:lr?.mainGoal||false,goal,notes:notes,detail:rawDetail,_rowIndex:rowIndex};
  state._raceFromSheet=syntheticRace;
  closeDayModal();
  openRaceModal('sheet_'+rowIndex);
}

function openRaceModal(raceId,prefillDate){
  const races=loadRaces();
  let race=raceId?races.find(r=>r.id===raceId)||races.find(r=>r.date===raceId):null;
  if(!race&&raceId?.startsWith('sheet_'))race=state._raceFromSheet||null;
  state.editingRaceId=race?.id||null;
  document.getElementById('raceModal').classList.remove('open');
  const content=document.getElementById('raceModalContent');

  const DIST=['5 km','10 km','10 mile','Halve marathon','Marathon'];
  const TYPE=['Weg','Baan','Trail','Ultra','Virtueel'];

  const rawDist=(race?.dist||'').toString().trim();
  const normDist=rawDist.replace(/^(\d+)\s*km?$/i,'$1 km');
  const matchedDist=DIST.find(o=>o===normDist||o===rawDist)||'';
  const customDist=matchedDist?'':rawDist;

  const matchedType=TYPE.find(o=>o===(race?.raceType||''))||'';
  const customType=matchedType?'':(race?.raceType||'');

  content.innerHTML=`
    <div class="modal-title">${raceId?'Race bewerken':'Race toevoegen'}</div>
    <div class="settings-field">
      <label class="settings-label">Race naam</label>
      <input type="text" class="settings-input" id="raceNameInput" value="${esc(race?.name||'')}" placeholder="Big10 Rotterdam">
    </div>
    <div class="settings-field">
      <label class="settings-label">Datum</label>
      <input type="date" class="settings-input" id="raceDateInput" value="${esc(race?.date||prefillDate||'')}">
    </div>
    <div class="settings-field">
      <label class="settings-label">Afstand</label>
      <select class="settings-input" id="raceDistSelect" onchange="document.getElementById('raceDistCustom').style.display=this.value==='__custom'?'block':'none'">
        <option value="">—</option>
        ${DIST.map(d=>`<option value="${d}"${matchedDist===d?' selected':''}>${d}</option>`).join('')}
        <option value="__custom"${customDist?' selected':''}>Anders…</option>
      </select>
      <input type="text" class="settings-input" id="raceDistCustom" placeholder="bijv. 800 m" style="margin-top:6px;display:${customDist?'block':'none'}" value="${esc(customDist)}">
    </div>
    <div class="settings-field">
      <label class="settings-label">Type race</label>
      <select class="settings-input" id="raceTypeSelect" onchange="document.getElementById('raceTypeCustom').style.display=this.value==='__custom'?'block':'none'">
        <option value="">—</option>
        ${TYPE.map(t=>`<option value="${t}"${matchedType===t?' selected':''}>${t}</option>`).join('')}
        <option value="__custom"${customType?' selected':''}>Anders…</option>
      </select>
      <input type="text" class="settings-input" id="raceTypeCustom" placeholder="bijv. Veldloop" style="margin-top:6px;display:${customType?'block':'none'}" value="${esc(customType)}">
    </div>
    <div class="settings-field">
      <label class="settings-label">Doeltijd (optioneel)</label>
      <input type="text" class="settings-input" id="raceGoalInput" value="${esc(race?.goal||'')}" placeholder="bijv. 37:30">
    </div>
    <div class="settings-field">
      <label class="settings-label">Notities / detail</label>
      <textarea class="settings-input" id="raceDetailInput" rows="3" style="resize:none">${esc(race?.notes||race?.detail||'')}</textarea>
    </div>
    <div class="settings-field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="raceMainInput" ${race?.mainGoal?'checked':''} style="width:18px;height:18px;accent-color:var(--accent)">
      <label for="raceMainInput" class="settings-label" style="margin:0">Hoofddoel</label>
    </div>
    <button class="btn-primary" style="margin-top:8px" onclick="saveRace()">Race opslaan</button>
    ${race?`<button class="btn-secondary" onclick="deleteRace('${race.id}')">🗑 Verwijderen</button>`:''}`;

  document.getElementById('raceModal').classList.add('open');
}

async function saveRace(){
  const name=document.getElementById('raceNameInput')?.value.trim();
  const date=document.getElementById('raceDateInput')?.value;
  if(!name||!date){showToast('Race naam en datum zijn verplicht');return;}
  const distSel=document.getElementById('raceDistSelect')?.value;
  const dist=distSel==='__custom'?document.getElementById('raceDistCustom')?.value.trim():(distSel||'');
  const typeSel=document.getElementById('raceTypeSelect')?.value;
  const raceType=typeSel==='__custom'?document.getElementById('raceTypeCustom')?.value.trim():(typeSel||'');
  const mainGoal=!!document.getElementById('raceMainInput')?.checked;
  const goal=document.getElementById('raceGoalInput')?.value.trim()||'';
  const notes=document.getElementById('raceDetailInput')?.value.trim()||'';

  // Persist raceType + mainGoal + goal in localStorage (keyed by date for sheet races)
  const races=loadRaces();
  const isSheetRace=!state.editingRaceId||state.editingRaceId.startsWith('sheet_');
  if(isSheetRace){
    const idx=races.findIndex(r=>r.date===date);
    const entry={id:date,name,date,dist,raceType,mainGoal,goal,notes};
    if(idx>=0)races[idx]=entry;else races.push(entry);
    state.editingRaceId=date;
  }else{
    const idx=races.findIndex(r=>r.id===state.editingRaceId);
    if(idx>=0)races[idx]={...races[idx],name,date,dist,raceType,mainGoal,goal,notes};
    else races.push({id:Date.now().toString(),name,date,dist,raceType,mainGoal,goal});
  }
  persistRaces(races);

  const [sy,sm]=date.split('-').map(Number);
  state.calYear=sy;state.calMonth=sm-1;state.calSelectedDate=date;
  closeRaceModal();renderHeader();
  if(state.currentTab==='calendar')renderCalendar();else switchTab('calendar');

  // Sheet: write titel + km + (Doel: xx:xx) appended to detail
  const existingDetail=(state.data?.find(r=>r.datum===date&&r.type==='race')?.detail||'')
    .replace(/\s*\(Doel:[^)]*\)/,'').trim();
  const raceDetail=goal?`${existingDetail?existingDetail+' ':''}(Doel: ${goal})`:existingDetail;
  const baseDetail=notes||'';
  const raceFields={datum:date,titel:name,type:'race',detail:baseDetail+(goal?` (Doel: ${goal})`:''),km:dist||'',race_type:raceType||''};

  if(state.scriptUrl){
    try{
      const sheetRowIndex=state._raceFromSheet?._rowIndex||null;
      const existingRow=state.data?.find(r=>r.datum===date&&r.type==='race');
      const targetRowIndex=sheetRowIndex||existingRow?.rowIndex||null;
      if(targetRowIndex)await sheetUpdateRow(targetRowIndex,raceFields);
      else await sheetAddRow(raceFields);
      state._raceFromSheet=null;
      showToast('Race opgeslagen in schema');
      await fetchData();
    }catch(e){showToast('❌ '+humanError(e));}
  }else{
    if(state.data){
      const ex=state.data.find(r=>r.datum===date&&r.type==='race');
      if(ex)Object.assign(ex,raceFields);
      else state.data.push({...raceFields,feedback:'',rowIndex:null});
    }
    showToast('Race opgeslagen');
  }
}

function deleteRace(id){
  persistRaces(loadRaces().filter(r=>r.id!==id));
  closeRaceModal();renderHeader();
  if(state.currentTab==='calendar')renderCalendar();
  showToast(T('race_deleted'));
}

function closeRaceModal(e){
  if(e&&e.target!==document.getElementById('raceModal'))return;
  document.getElementById('raceModal').classList.remove('open');
  state.editingRaceId=null;
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function renderStats(){
  const el=document.getElementById('statsContent');
  const t=todayStr();
  const past=state.data?state.data.filter(r=>r.datum<=t):[];
  const totalKm=past.reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  // C24: count by type 'run'
  const runCount=past.filter(r=>hasType(r.type,'run')).length;
  const fbRows=past.filter(r=>r.feedback);
  const ratingRows=fbRows.filter(r=>/^\d/.test(r.feedback));
  const avgRating=ratingRows.length?ratingRows.reduce((s,r)=>s+parseInt(r.feedback[0]),0)/ratingRows.length:0;
  // C34: races from sheet
  const sheetRaceRows2=(state.data||[]).filter(r=>r.type==='race'&&r.datum).sort((a,b)=>a.datum.localeCompare(b.datum));
  const nextRace2=sheetRaceRows2.find(r=>daysUntil(r.datum)>=0)||sheetRaceRows2[0];
  const daysLeft=nextRace2?daysUntil(nextRace2.datum):0;
  const raceName=nextRace2?.titel||nextRace2?.datum||'—';
  const mondayStr=getMondayStr();
  const weekKm=(state.data||[]).filter(r=>r.datum>=mondayStr&&r.datum<=t).reduce((s,r)=>s+(parseFloat(r.km)||0),0);
  const months=state.lang==='en'?MONTHS_EN:MONTHS_NL;

  let h=`<div class="stats-grid">
    <div class="stat-card"><div class="stat-label">${T('stats_total')}</div><div class="stat-val">${totalKm.toFixed(0)}</div><div class="stat-sub">${T('stats_done')}</div></div>
    <div class="stat-card"><div class="stat-label">${T('stats_days')}</div><div class="stat-val">${daysLeft}</div><div class="stat-sub">${esc(raceName)}</div></div>
    <div class="stat-card"><div class="stat-label">${T('stats_runs')}</div><div class="stat-val">${runCount}</div><div class="stat-sub">${T('stats_sessions')}</div></div>
    <div class="stat-card"><div class="stat-label">${T('stats_week')}</div><div class="stat-val">${weekKm.toFixed(0)}</div><div class="stat-sub">${T('stats_week_sub')}</div></div>
    ${avgRating>0?`<div class="stat-card"><div class="stat-label">${T('stats_feel')}</div><div class="stat-val" style="font-size:28px">${['😵','😓','😐','💪','🔥'][Math.round(avgRating)-1]}</div><div class="stat-sub">${avgRating.toFixed(1)}/5 · ${ratingRows.length} ${T('stats_fb_sub')}</div></div>`:''}
    <div class="stat-card"><div class="stat-label">${T('stats_feedback')}</div><div class="stat-val">${fbRows.length}</div><div class="stat-sub">${T('stats_fb_sub')}</div></div>
  </div>`;

  if(!state.data)h+=noSchemaHint();

  // PR tiles
  const prs=loadPRs();
  const activePrs=PR_ORDER.filter(d=>d in prs&&prs[d]);
  h+=`<div style="margin:4px 0 6px;font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase">PERSOONLIJKE RECORDS</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;margin-bottom:14px">
    ${activePrs.map(d=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px">
      <div style="font-family:var(--font-m);font-size:9px;color:var(--faint);letter-spacing:0.5px;margin-bottom:4px">${d}</div>
      <div style="font-family:var(--font-d);font-weight:800;font-size:20px;line-height:1;color:var(--accent)">${esc(prs[d])}</div>
    </div>`).join('')}
    <button onclick="openPrEditor()" style="background:var(--surface);border:1px dashed var(--border);border-radius:var(--r);padding:10px;cursor:pointer;color:var(--muted);font-size:22px;font-weight:300;line-height:1;display:flex;align-items:center;justify-content:center;min-height:60px">+</button>
  </div>`;

  const recent=fbRows.slice(-8).reverse();
  if(recent.length){
    h+=`<div style="margin-bottom:8px;font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase">${T('stats_recent')}</div><div class="feedback-history">`;
    recent.forEach(row=>{
      const d=parseDate(row.datum);
      h+=`<div class="fh-row">
        <div class="fh-date">${d.getDate()} ${months[d.getMonth()]}</div>
        <div class="fh-body"><div class="fh-title">${esc(row.titel||row.type||'Training')}</div><div class="fh-text">${esc(row.feedback)}</div></div>
        ${row.km?`<div class="fh-km">${esc(row.km)}km</div>`:''}
      </div>`;
    });
    h+='</div>';
  }
  el.innerHTML=h;
}

function openPrEditor(){
  const prs=loadPRs();
  const existing=PR_ORDER.filter(d=>d in prs);
  const remaining=PR_ORDER.filter(d=>!(d in prs));
  const el=document.getElementById('statsContent');if(!el)return;
  if(document.getElementById('prEditorSection')){document.getElementById('prEditorSection').remove();return;}
  const sec=document.createElement('div');
  sec.id='prEditorSection';
  sec.style.cssText='margin-top:16px;padding-top:16px;border-top:1px solid var(--border)';
  sec.innerHTML=`<div style="font-family:var(--font-m);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">PR BEWERKEN</div>
    ${existing.map(d=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <label style="font-family:var(--font-m);font-size:10px;color:var(--muted);min-width:52px">${d}</label>
      <input type="text" class="settings-input" style="flex:1" placeholder="bijv. 37:56" value="${esc(prs[d]||'')}" oninput="updatePR('${d}',this.value)">
      <button onclick="removePrField('${d}');renderStats();setTimeout(openPrEditor,50)" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:18px;padding:0 4px;line-height:1">×</button>
    </div>`).join('')}
    ${remaining.length?`<select class="settings-input" style="margin-top:6px" onchange="if(this.value){const p=loadPRs();p[this.value]='';persistPRs(p);this.value='';renderStats();setTimeout(openPrEditor,50);}">
      <option value="">+ Afstand toevoegen…</option>
      ${remaining.map(d=>`<option value="${d}">${d}</option>`).join('')}
    </select>`:''}`;
  el.appendChild(sec);
  sec.scrollIntoView({behavior:'smooth',block:'end'});
}


// ── SETTINGS ──────────────────────────────────────────────────────────────────
function renderAccountSection(){
  const el=document.getElementById('accountSection');if(!el)return;
  const oauthEmail=typeof authEmail==='function'?authEmail():'';
  const oauthActive=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
  if(oauthActive&&oauthEmail){
    el.innerHTML=`<div class="account-row">
      <div class="account-avatar" style="font-size:22px">🏃</div>
      <div class="account-info">
        <div class="account-email">${esc(oauthEmail)}</div>
        <div class="account-status">Google · ${T('logged_in_as')}</div>
      </div>
      <button class="account-logout" onclick="authSignOut()">${T('logout_btn')}</button>
    </div>`;
  }else{
    el.innerHTML=`<div style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.5">
      Log in met Google om je schema te koppelen en data te synchroniseren.
    </div>
    <div style="max-width:260px">
      <button class="btn-google" onclick="oauthConnectFlow()">${googleSvg}Login met Google</button>
    </div>`;
  }
}

function logoutAccount(){
  if(typeof authSignOut==='function'){authSignOut();return;}
  localStorage.removeItem('userEmail');
  renderAccountSection();
}


// ── C26 / E7: CONNECT SECTION — OAuth-first ─────────────────────────────────
function renderConnectSection(){
  const el=document.getElementById('connectSection');if(!el)return;
  const oauthActive=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
  const sheetId=typeof authSheetId==='function'?authSheetId():state.sheetId;
  const connected=oauthActive&&!!sheetId;

  if(connected){
    const sheetUrl=`https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    el.innerHTML=`<div style="font-family:var(--font-m);font-size:10px;color:var(--muted);padding:8px 0">Laden…</div>`;
    (async()=>{
      const _emD=typeof authEmail==='function'?authEmail():'';
      let fileName=localStorage.getItem('driveFileName_'+sheetId)||'';
      if(!fileName&&_emD)fileName=localStorage.getItem('sheetFileName_'+_emD)||'';
      // If cached value is a raw URL or bare sheetId, it's poisoned — wipe it first
      if(fileName.startsWith('http')||fileName===sheetId){
        localStorage.removeItem('driveFileName_'+sheetId);
        if(_emD)localStorage.removeItem('sheetFileName_'+_emD);
        fileName='';
      }
      if(!fileName){
        // Sheets API: works for any accessible sheet with spreadsheets scope
        try{
          const meta=await sheetsGet(`/${sheetId}?fields=properties.title`);
          const t=meta?.properties?.title;
          if(t)fileName=t;
        }catch{}
      }
      if(!fileName){
        try{if(typeof _getDriveFileName==='function')fileName=await _getDriveFileName(sheetId)||'';}catch{}
      }
      if(!fileName){
        try{const sh=await listRecentSheets();fileName=sh.find(s=>s.id===sheetId)?.name||'';}catch{}
      }
      if(!fileName){
        // Tab name is always stored locally and is better than 'Schema'
        fileName=localStorage.getItem('sheetTabName_'+_emD)||localStorage.getItem('sheetName')||'';
      }
      if(!fileName)fileName='Schema';
      if(fileName!=='Schema'){
        localStorage.setItem('driveFileName_'+sheetId,fileName);
        if(_emD)localStorage.setItem('sheetFileName_'+_emD,fileName);
      }
      const _em=typeof authEmail==='function'?authEmail():'';
      if(_em)localStorage.setItem('sheetFileName_'+_em,fileName);
      // Push schema list to sheet tab + Drive — once per session to avoid quota hits
      if(!window._rxSyncedThisSession){
        window._rxSyncedThisSession=true;
        if(typeof _saveSchemaListToSheetMeta==='function')_saveSchemaListToSheetMeta(sheetId).catch(()=>{});
        if(typeof _syncSettingsToAccount==='function')_syncSettingsToAccount().catch(()=>{});
      }
      _saveSchemaHistory(sheetId,fileName,sheetUrl);
      const _driveMissing=localStorage.getItem('rx_drive_scope_missing')==='1';
      el.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--run-text);flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-d);font-size:14px;font-weight:600;letter-spacing:-0.01em;margin-bottom:3px">${esc(fileName)}</div>
            <a href="${esc(sheetUrl)}" target="_blank" style="font-family:var(--font-d);font-size:12px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58"/><path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>Openen in Google Sheets ↗</a>
          </div>
          <button onclick="disconnectSheet()" style="background:none;border:none;color:var(--muted);font-family:var(--font-d);font-size:12px;cursor:pointer;padding:4px 0;text-decoration:underline;text-underline-offset:2px;flex-shrink:0;-webkit-tap-highlight-color:transparent">Ontkoppelen</button>
        </div>
        ${_driveMissing?`<div style="font-family:var(--font-d);font-size:12px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px"><span style="flex:1">Log opnieuw in voor automatische synchronisatie naar andere apparaten.</span><button class="btn-save" onclick="authSignOut&&authSignOut();oauthConnectFlow&&oauthConnectFlow()" style="white-space:nowrap;flex-shrink:0;font-size:12px;padding:7px 12px">Opnieuw inloggen</button></div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-save" onclick="toggleConnectPanel('history')" style="font-size:13px;padding:8px 14px">Gekoppelde schema's</button>
          <button class="btn-save" onclick="toggleConnectPanel('new')" style="font-size:13px;padding:8px 14px">+ Nieuw trainingsschema</button>
        </div>
        <div id="connectPanel" style="margin-top:12px"></div>`;
    })();
    return;
  }

  if(oauthActive&&!sheetId){
    el.innerHTML=`
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Ingelogd als <strong style="color:var(--text)">${esc(authEmail())}</strong></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        <button class="connect-tile primary" onclick="openImportModal('all')" style="border:none">
          <div class="connect-tile-icon">${importSvg}</div>
          <div class="connect-tile-body">
            <div class="connect-tile-title">Importeer eigen schema <span style="background:var(--accent);color:var(--accent-ink);font-size:9px;padding:1px 6px;border-radius:999px;font-family:var(--font-d);font-weight:700;letter-spacing:-0.01em;vertical-align:middle;margin-left:4px">Aanbevolen</span></div>
            <div class="connect-tile-sub">PDF, Excel, foto of van je coach</div>
          </div>
          ${chevronSvg}
        </button>
        <button class="connect-tile" onclick="oauthPickExisting()">
          <div class="connect-tile-icon"><svg width="20" height="20" viewBox="0 0 48 48" fill="none"><path fill="#0F9D58" d="M37 4H17l-6 6v34a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path fill="#87CEAC" d="M17 4v4a2 2 0 0 1-2 2h-4z"/><path fill="#F1F1F1" d="M33 22H15v14h18V22zm-10 12h-6v-4h6zm0-6h-6v-4h6zm8 6h-6v-4h6zm0-6h-6v-4h6z"/></svg></div>
          <div class="connect-tile-body">
            <div class="connect-tile-title">Koppel Google Sheets schema</div>
            <div class="connect-tile-sub">Koppel een Google Sheet die je al hebt</div>
          </div>
          ${chevronSvg}
        </button>
        <button class="connect-tile" onclick="oauthCreateNew()">
          <div class="connect-tile-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M10 7v6M7 10h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <div class="connect-tile-body">
            <div class="connect-tile-title">Leeg schema aanmaken</div>
            <div class="connect-tile-sub">Begin met een nieuw leeg schema</div>
          </div>
          ${chevronSvg}
        </button>
      </div>`;
    return;
  }

  el.innerHTML=`
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px">Koppel je trainingsschema om te starten.</div>
    <div style="max-width:260px">
      <button class="btn-google" id="oauthConnectBtn" onclick="oauthConnectFlow()">${googleSvg}Login met Google</button>
    </div>
`;
}

// ── PER-EMAIL SCHEMA LIST ─────────────────────────────────────────────────────
// Simple list per email: [{id, name, url, ts}]
// This IS the cross-device source of truth — stored per email in localStorage

function _schemaListKey(email){return 'schemaList_'+(email||'');}

function _getSchemaList(email){
  try{return JSON.parse(localStorage.getItem(_schemaListKey(email))||'[]');}catch{return[];}
}

function _addToSchemaList(email,entry){
  if(!email||!entry?.id)return;
  try{
    const list=_getSchemaList(email);
    const deleted=_getDeletedSchemas(email);
    if(deleted.includes(entry.id))return;
    const idx=list.findIndex(s=>s.id===entry.id);
    if(idx>=0)list[idx]={...list[idx],...entry};
    else list.unshift(entry);
    localStorage.setItem(_schemaListKey(email),JSON.stringify(list.slice(0,50)));
  }catch{}
}

function _getDeletedSchemas(email){
  try{return JSON.parse(localStorage.getItem('schemaDeleted_'+(email||''))||'[]');}catch{return[];}
}

function _deleteFromSchemaList(email,sheetId){
  if(!email||!sheetId)return;
  try{
    const list=_getSchemaList(email).filter(s=>s.id!==sheetId);
    localStorage.setItem(_schemaListKey(email),JSON.stringify(list));
    const deleted=_getDeletedSchemas(email);
    if(!deleted.includes(sheetId))deleted.push(sheetId);
    localStorage.setItem('schemaDeleted_'+email,JSON.stringify(deleted));
  }catch{}
}

// Compat shims
function _saveSchemaHistory(sheetId,name,url){
  const email=typeof authEmail==='function'?authEmail():'';
  _addToSchemaList(email,{id:sheetId,name:name||sheetId,url:url||'https://docs.google.com/spreadsheets/d/'+sheetId+'/edit',ts:Date.now()});
}
function _loadSchemaHistory(){
  const email=typeof authEmail==='function'?authEmail():'';
  return _getSchemaList(email);
}

// ── SETTINGS SYNC ─────────────────────────────────────────────────────────────
async function _syncSettingsToAccount(){
  const email=typeof authEmail==='function'?authEmail():'';
  if(!email)return;
  const _cid=typeof authSheetId==='function'?authSheetId():'';
  const snap={
    prs:localStorage.getItem('prs')||'{}',
    lang:localStorage.getItem('lang')||'nl',
    theme:localStorage.getItem('theme')||'light',
    telegramUser:localStorage.getItem('telegramUser')||'',
    notifPrefs:localStorage.getItem('notifPrefs')||'{}',
    schemaList:localStorage.getItem('schemaList_'+email)||'[]',
    schemaDeleted:localStorage.getItem('schemaDeleted_'+email)||'[]',
    connectedSheetId:_cid||'',
    connectedSheetTab:_cid?localStorage.getItem('sheetName')||'':'',
    connectedSheetName:_cid?localStorage.getItem('driveFileName_'+_cid)||localStorage.getItem('sheetFileName_'+email)||'':'',
  };
  localStorage.setItem('accountSnap_'+email,JSON.stringify(snap));
  if(typeof saveSettingsToAppData==='function'){
    saveSettingsToAppData(snap).catch(()=>{});
  }
  const _curSheetId=typeof authSheetId==='function'?authSheetId():'';
  if(_curSheetId&&typeof _saveSchemaListToSheetMeta==='function'){
    _saveSchemaListToSheetMeta(_curSheetId).catch(()=>{});
  }
}
function _applySnapToLocal(snap,email){
  if(!snap||!email)return;
  if(snap.prs)localStorage.setItem('prs',snap.prs);
  if(snap.telegramUser)localStorage.setItem('telegramUser',snap.telegramUser);
  if(snap.notifPrefs)localStorage.setItem('notifPrefs',snap.notifPrefs);
  if(snap.lang){localStorage.setItem('lang',snap.lang);if(typeof state!=='undefined')state.lang=snap.lang;}
  if(snap.theme){localStorage.setItem('theme',snap.theme);if(typeof state!=='undefined')state.theme=snap.theme;}
  // Merge schema deleted lists (union)
  if(snap.schemaDeleted){
    try{
      const snapDel=JSON.parse(snap.schemaDeleted||'[]');
      const localDel=JSON.parse(localStorage.getItem('schemaDeleted_'+email)||'[]');
      localStorage.setItem('schemaDeleted_'+email,JSON.stringify([...new Set([...localDel,...snapDel])]));
    }catch{}
  }
  // Merge schema lists (add remote entries not already local, filter deleted)
  if(snap.schemaList){
    try{
      const snapList=JSON.parse(snap.schemaList||'[]');
      const allDeleted=JSON.parse(localStorage.getItem('schemaDeleted_'+email)||'[]');
      const localList=_getSchemaList(email);
      const localIds=new Set(localList.map(s=>s.id));
      const merged=localList.filter(s=>!allDeleted.includes(s.id));
      const mergedIds=new Set(merged.map(s=>s.id));
      for(const entry of snapList){
        if(!mergedIds.has(entry.id)&&!allDeleted.includes(entry.id)){merged.push(entry);mergedIds.add(entry.id);}
      }
      merged.sort((a,b)=>(b.ts||0)-(a.ts||0));
      localStorage.setItem('schemaList_'+email,JSON.stringify(merged.slice(0,50)));
    }catch{}
  }
  // B15: restore connected schema on new device
  if(snap.connectedSheetId){
    const hasSheet=(typeof authSheetId==='function'&&authSheetId())||localStorage.getItem('oauth_sheetId')||'';
    if(!hasSheet){
      if(typeof authSetSheetId==='function')authSetSheetId(snap.connectedSheetId);
      localStorage.setItem('sheetId',snap.connectedSheetId);
      if(snap.connectedSheetTab)localStorage.setItem('sheetName',snap.connectedSheetTab);
      if(snap.connectedSheetName)localStorage.setItem('driveFileName_'+snap.connectedSheetId,snap.connectedSheetName);
      if(snap.connectedSheetName)localStorage.setItem('sheetFileName_'+email,snap.connectedSheetName);
      if(typeof state!=='undefined'){state.sheetId=snap.connectedSheetId;state.sheetName=snap.connectedSheetTab||'';}
    }
  }
  if(typeof state!=='undefined')state._prs=null;
  if(typeof applyTheme==='function')applyTheme();
  if(typeof applyI18n==='function')applyI18n();
}

function _restoreSettingsFromAccount(email){
  if(!email)return;
  try{
    // Apply local snap immediately (fast path)
    const snap=JSON.parse(localStorage.getItem('accountSnap_'+email)||'null');
    if(snap)_applySnapToLocal(snap,email);
    // Always sync with Drive — bidirectional: picks up changes from other devices
    if(typeof loadSettingsFromAppData==='function'){
      loadSettingsFromAppData().then(driveSnap=>{
        if(!driveSnap)return;
        // Merge Drive state into local (local deletions take effect too)
        _applySnapToLocal(driveSnap,email);
        // Write merged state back to Drive so it becomes the new single source of truth
        if(typeof _syncSettingsToAccount==='function')_syncSettingsToAccount().catch(()=>{});
        if(typeof renderHeader==='function')renderHeader();
        if(typeof renderConnectSection==='function')renderConnectSection();
        // Refresh connect modal if it's open (so schema list appears on Device B)
        const modal=document.getElementById('dayModal');
        if(modal?.classList.contains('open')&&typeof showOAuthConnectSheet==='function')showOAuthConnectSheet();
      }).catch(()=>{});
    }
  }catch(e){}
}
function _editSchemaModal(sheetId, name){
  const isAppCreated=!!localStorage.getItem('driveFileName_'+sheetId);
  const modal=document.getElementById('dayModal');
  const el=document.getElementById('dayModalContent');
  modal.classList.add('open');
  el.innerHTML=`
    <div class="modal-title">Schema bewerken</div>
    <div style="margin-bottom:14px">
      <label class="settings-label">Naam</label>
      <input type="text" id="schemaEditName" class="settings-input" value="${esc(name)}" style="margin-top:4px">
    </div>
    <button class="btn-primary" onclick="_saveSchemaName('${sheetId}')">Opslaan</button>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Schema ontkoppelen verwijdert het uit je lijst, maar het Google Sheet blijft bestaan.</div>
      ${isAppCreated?`<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer">
        <input type="checkbox" id="driveTrashCheck" style="width:16px;height:16px;accent-color:var(--cat-race)">
        <span style="font-size:12px;color:var(--text)">Ook verwijderen uit Google Drive</span>
      </label>`:''}
      <button onclick="_deleteSchemaWithOptions('${sheetId}')" style="background:none;border:1px solid rgba(200,51,107,0.4);color:var(--cat-race);font-family:var(--font-d);font-size:13px;font-weight:500;padding:8px 14px;border-radius:var(--r);cursor:pointer;width:100%">
        Schema verwijderen uit lijst
      </button>
    </div>`;
}

function _saveSchemaName(sheetId){
  const input=document.getElementById('schemaEditName');
  const newName=input?.value?.trim();
  if(!newName)return;
  const email=typeof authEmail==='function'?authEmail():'';
  const list=typeof _getSchemaList==='function'?_getSchemaList(email):[];
  const entry=list.find(s=>s.id===sheetId);
  if(entry){
    entry.name=newName;
    localStorage.setItem('schemaList_'+email,JSON.stringify(list));
    localStorage.setItem('driveFileName_'+sheetId,newName);
    if(email)localStorage.setItem('sheetFileName_'+email,newName);
    _syncSettingsToAccount();
  }
  closeDayModal();
  loadSheetPickerInline();
  showToast('Naam opgeslagen');
}

async function _deleteSchemaWithOptions(sheetId){
  const trash=document.getElementById('driveTrashCheck')?.checked;
  const email=typeof authEmail==='function'?authEmail():'';
  _deleteFromSchemaList(email,sheetId);
  _syncSettingsToAccount();
  if(trash){
    try{
      const token=await authEnsureToken();
      await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/trash`,{
        method:'POST',headers:{Authorization:'Bearer '+token}
      });
      showToast('Schema verwijderd uit Drive');
    }catch(e){showToast('Schema uit lijst verwijderd (Drive mislukt)');}
  }else{
    showToast('Schema uit lijst verwijderd');
  }
  closeDayModal();
  loadSheetPickerInline();
}

function _confirmDeleteSchema(sheetId){
  const btns=document.querySelectorAll(`[data-trash="${sheetId}"]`);
  const btn=btns[0];
  if(btn&&!btn.dataset.confirming){
    btn.dataset.confirming='1';
    btn.textContent='✓?';
    btn.style.color='var(--race-text)';
    btn.style.borderColor='var(--race-text)';
    setTimeout(()=>{if(btn){btn.textContent='🗑';btn.style.color='';btn.style.borderColor='';delete btn.dataset.confirming;}},3000);
    return;
  }
  const email=typeof authEmail==='function'?authEmail():'';
  _deleteFromSchemaList(email,sheetId);
  _syncSettingsToAccount();
  loadSheetPickerInline();
}

function toggleConnectPanel(panel){
  const el=document.getElementById('connectPanel');if(!el)return;
  if(el.dataset.panel===panel&&panel!=='url'){el.innerHTML='';delete el.dataset.panel;return;}
  el.dataset.panel=panel;
  const _tileBase='display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;transition:border-color 0.15s;min-height:170px;';
  const _iconWrap='width:44px;height:44px;border-radius:9px;background:var(--bg);border:1px solid var(--border);display:grid;place-items:center;flex-shrink:0;';
  const _arrow='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
  const _foot=(meta)=>`<div style="margin-top:auto;padding-top:8px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between"><span style="font-family:var(--font-m);font-size:9px;color:var(--faint);letter-spacing:.08em;text-transform:uppercase">${meta}</span><span style="width:22px;height:22px;border-radius:5px;background:var(--bg);border:1px solid var(--border);display:grid;place-items:center;color:var(--muted)">${_arrow}</span></div>`;
  if(panel==='history'){
    el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:14px 0">
      <div style="width:180px;height:4px;background:var(--border);border-radius:999px;overflow:hidden">
        <div style="height:100%;background:var(--accent);border-radius:999px;transform:scaleX(0);transform-origin:left center;animation:loadBarFill 1.5s ease-out infinite"></div>
      </div>
      <span style="font-family:var(--font-d);font-size:13px;color:var(--muted)">Eerder gekoppelde schema's zoeken…</span>
    </div>`;
    loadSheetPickerInline();
  }else if(panel==='url'){
    el.dataset.panel='url';
    el.innerHTML=`<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px">
      <div style="font-family:var(--font-m);font-size:11px;font-weight:600;color:var(--text);margin-bottom:4px">Google Sheets URL koppelen</div>
      <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);margin-bottom:10px">Plak de URL van een bestaand schema met de juiste kolommen.</div>
      <div style="display:flex;gap:6px"><input type="url" class="settings-input" id="inlineSheetUrl" placeholder="https://docs.google.com/spreadsheets/…" style="flex:1"><button class="btn-save" onclick="oauthSelectFromUrl()">Koppelen</button></div>
    </div>`;
    setTimeout(()=>document.getElementById('inlineSheetUrl')?.focus(),50);
  }else{
    // 3-tile grid
    const _sheetsIcon='<svg viewBox="0 0 48 48" width="28" height="28"><path fill="#0F9D58" d="M37 4H17l-6 6v34a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path fill="#87CEAC" d="M17 4v4a2 2 0 0 1-2 2h-4z"/><path fill="#F1F1F1" d="M33 22H15v14h18V22zm-10 12h-6v-4h6zm0-6h-6v-4h6zm8 6h-6v-4h6zm0-6h-6v-4h6z"/></svg>';
    const _excelChip='<svg viewBox="0 0 48 48" width="16" height="16"><path fill="#21A366" d="M28 4H17l-6 6v32a2 2 0 0 0 2 2h25a2 2 0 0 0 2-2V18z"/><path fill="#107C41" d="M28 4v12a2 2 0 0 0 2 2h10z"/><rect fill="#fff" x="13" y="22" width="22" height="15" rx="1"/><path fill="#21A366" d="M19 25.5l2.1 3.4 2.2-3.4h2.4l-3.3 4.9 3.4 5.1H23.4l-2.2-3.5-2.2 3.5h-2.4l3.4-5.1-3.3-4.9z"/></svg>';
    const _pdfChip='<svg viewBox="0 0 48 48" width="16" height="16"><path fill="#E94235" d="M37 4H17l-6 6v34a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path fill="#F4B4AE" d="M17 4v4a2 2 0 0 1-2 2h-4z"/><text x="24" y="33" text-anchor="middle" font-family="Arial" font-weight="700" font-size="10" fill="#fff">PDF</text></svg>';
    const _imgChip='<svg viewBox="0 0 48 48" width="16" height="16"><path fill="#FF9E3D" d="M37 4H17l-6 6v34a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path fill="#FFD3A8" d="M17 4v4a2 2 0 0 1-2 2h-4z"/><circle cx="20" cy="22" r="2.2" fill="#fff"/><path fill="#fff" d="M15 36l5-7 4 4 5-6 6 9z"/></svg>';
    const _chip=(svg)=>`<span style="width:26px;height:26px;border-radius:5px;background:var(--bg);border:1px solid var(--border);display:grid;place-items:center">${svg}</span>`;
    el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:4px">
      <button onclick="oauthCreateNew()" style="${_tileBase}">
        <div style="${_iconWrap}color:var(--accent)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
        <div style="font-family:var(--font-m);font-size:11px;font-weight:600;color:var(--text)">Maak nieuw schema</div>
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);line-height:1.5">Begin met een lege Google Sheet — de juiste kolommen staan al klaar.</div>
        ${_foot('Leeg')}
      </button>
      <button onclick="toggleConnectPanel('url')" style="${_tileBase}border-color:rgba(198,242,78,0.35);background:linear-gradient(180deg,rgba(198,242,78,0.05),var(--surface) 70%);position:relative">
        <span style="position:absolute;top:-8px;right:12px;padding:2px 8px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-family:var(--font-m);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Aanbevolen</span>
        <div style="${_iconWrap}padding:4px">${_sheetsIcon}</div>
        <div style="font-family:var(--font-m);font-size:11px;font-weight:600;color:var(--text)">Koppel Google Sheets URL</div>
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);line-height:1.5">Plak een URL van een bestaande sheet. Wijzigingen verschijnen direct.</div>
        ${_foot('Live sync')}
      </button>
      <button onclick="openImportModal('all')" style="${_tileBase}">
        <div style="${_iconWrap}color:var(--accent)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 4l1.5 3 3 1.5-3 1.5L15 13l-1.5-3-3-1.5 3-1.5L15 4z"/><path d="M5 19l8-8"/><path d="M4.5 5.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg></div>
        <div style="font-family:var(--font-m);font-size:11px;font-weight:600;color:var(--text)">Importeer eigen schema</div>
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);line-height:1.5">Upload een Excel, PDF of foto. We digitaliseren het automatisch.</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:auto;padding-top:6px">${_chip(_excelChip)}${_chip(_pdfChip)}${_chip(_imgChip)}<span style="font-family:var(--font-m);font-size:9px;color:var(--faint)">.xlsx · .pdf · .jpg</span></div>
        ${_foot('Automatisch')}
      </button>
    </div>`;
  }
}

function oauthSelectFromUrl(){
  const u=document.getElementById('inlineSheetUrl')?.value.trim();
  if(!u){showToast('Voer een URL in');return;}
  const m=u.match(/spreadsheets.d.([a-zA-Z0-9_-]+)/);
  if(!m){showToast('Ongeldige sheet URL');return;}
  oauthSelectSheet(m[1],u);
}

async function loadSheetPickerInline(){
  const el=document.getElementById('sheetPickerInline')||document.getElementById('connectPanel');
  if(!el)return;
  el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:14px 0"><div style="width:180px;height:4px;background:var(--border);border-radius:999px;overflow:hidden"><div style="height:100%;background:var(--accent);border-radius:999px;transform:scaleX(0);transform-origin:left center;animation:loadBarFill 1.5s ease-out infinite"></div></div><span style="font-family:var(--font-d);font-size:13px;color:var(--muted)">Eerder gekoppelde schema's zoeken…</span></div>`;
  const currentId=typeof authSheetId==='function'?authSheetId():'';
  // Use per-email schema list as source of truth
  const _em2=typeof authEmail==='function'?authEmail():'';
  // Also add any Drive sheets we haven't seen yet (merge)
  try{
    const driveSheets=await listRecentSheets();
    driveSheets.forEach(s=>{
      const fn=localStorage.getItem('driveFileName_'+s.id)||s.name;
      _addToSchemaList(_em2,{id:s.id,name:fn,url:`https://docs.google.com/spreadsheets/d/${s.id}/edit`,ts:Date.now()});
    });
  }catch{}
  const deleted=_getDeletedSchemas(_em2);
  // Ensure the active schema is always in the list, even if never saved to schemaList
  if(currentId&&!deleted.includes(currentId)){
    const already=_getSchemaList(_em2).find(s=>s.id===currentId);
    if(!already){
      const fn=localStorage.getItem('driveFileName_'+currentId)||
               localStorage.getItem('sheetFileName_'+_em2)||
               localStorage.getItem('sheetTabName_'+_em2)||
               localStorage.getItem('sheetName')||'';
      _addToSchemaList(_em2,{id:currentId,name:fn,url:`https://docs.google.com/spreadsheets/d/${currentId}/edit`,ts:Date.now()});
    }
  }
  const hist=_getSchemaList(_em2);
  const filtered=hist.filter(s=>!deleted.includes(s.id)).slice(0,10);
  // If active schema was pushed past position 10 by newer entries, add it back
  if(currentId&&!filtered.find(s=>s.id===currentId)){
    const act=hist.find(s=>s.id===currentId);
    if(act&&!deleted.includes(currentId))filtered.unshift(act);
  }
  // Fix stale entries where name is a raw URL or the bare sheet ID
  const needsNameFix=filtered.filter(s=>!s.name||s.name===s.id||s.name.startsWith('http'));
  if(needsNameFix.length){
    await Promise.all(needsNameFix.map(async s=>{
      // Wipe URL-like name immediately so rendering shows sheetId at worst
      if(s.name&&(s.name.startsWith('http')||s.name===s.id))s.name='';
      try{
        const meta=await sheetsGet(`/${s.id}?fields=properties.title`);
        const title=meta?.properties?.title;
        if(title){
          s.name=title;
          _addToSchemaList(_em2,{...s,name:title});
          localStorage.setItem('driveFileName_'+s.id,title);
        }
      }catch{}
    }));
  }
  const rows=filtered.map(s=>{
    const isActive=s.id===currentId;
    return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
      <button onclick="_saveSchemaHistory('${s.id}','${esc(s.name)}','${esc(s.url||'')}');oauthSelectSheet('${s.id}','${esc(s.name)}')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:1px solid ${isActive?'var(--cat-run)':'var(--border)'};border-radius:var(--r);cursor:pointer;text-align:left;flex:1;min-width:0">
        <div style="width:7px;height:7px;border-radius:50%;background:${isActive?'var(--cat-run)':'var(--faint)'};flex-shrink:0"></div>
        <span style="font-family:var(--font-d);font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(s.name||s.id)}</span>
      </button>
      <button onclick="_editSchemaModal('${s.id}','${esc(s.name)}')" style="background:none;border:1px solid var(--border);color:var(--muted);cursor:pointer;padding:5px 9px;border-radius:var(--r);flex-shrink:0;font-size:13px;line-height:1" title="Bewerken">✏</button>
    </div>`;
  }).join('');
  const target=document.getElementById('connectPanel')||el;
  target.innerHTML=`<div style="margin-bottom:4px">${rows||'<div style="font-family:var(--font-m);font-size:10px;color:var(--faint);padding:4px 0">Geen schema\'s gevonden.</div>'}</div>`;
}



// ── E6 AI SCHEMA IMPORT ───────────────────────────────────────────────────────
state.importStep=0;
state.importData={};

const _IMP_DAYS=['Ma','Di','Wo','Do','Vr','Za','Zo'];

function openImportModal(type){
  state.importStep=1;
  state.importData={type,file:null,fileName:'',startDate:todayStr(),runDays:[0,2,4],keepRest:true,preview:null,error:null,loading:false};
  document.getElementById('dayModal').classList.add('open');
  _renderImportModal();
}

function _renderImportModal(){
  const el=document.getElementById('dayModalContent');
  if(!el)return;
  const s=state.importStep,d=state.importData;
  const stepLabel=(n)=>`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <button onclick="state.importStep=${n-1};_renderImportModal()" style="background:none;border:none;color:var(--text);font-family:var(--font-d);font-size:13px;font-weight:500;cursor:pointer;padding:0">← Terug</button>
    <span style="font-family:var(--font-m);font-size:11px;color:var(--muted)">${n} / 4</span>
  </div>`;

  // ── Stap 1: bestand kiezen ───────────────────────────────────────────────
  if(s===1){
    const accept='.xlsx,.pdf,.jpg,.jpeg,.png,.csv';
    const tiles=[
      {type:'pdf',label:'PDF',sub:'Schema van je coach of uit een boek',icon:`<svg width="22" height="22" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="11" height="16" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 2v4h4" stroke="currentColor" stroke-width="1.5"/><text x="6" y="14" font-size="6" font-weight="700" font-family="Sora" fill="currentColor">PDF</text></svg>`},
      {type:'excel',label:'Excel / CSV',sub:'XLSX, Numbers, CSV',icon:`<svg width="22" height="22" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="11" height="16" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 2v4h4M6 9h7M6 12h7M6 15h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`},
      {type:'image',label:'Foto',sub:'Handgeschreven of screenshot — werkt ook',icon:`<svg width="22" height="22" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="11" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M7 5l1-2h4l1 2" stroke="currentColor" stroke-width="1.5"/></svg>`},
    ];
    const selectedType=d.type&&d.type!=='all'?d.type:null;
    el.innerHTML=`
      <div style="font-family:var(--font-m);font-size:11px;color:var(--muted);text-align:right;margin-bottom:16px">1 / 4</div>
      <div style="font-family:var(--font-d);font-weight:700;font-size:22px;letter-spacing:-0.03em;margin-bottom:6px">Breng je schema mee</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.5">Hoe heb je 'm? runyo herkent ze allemaal.</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${tiles.map(t=>`
          <button class="connect-tile${selectedType===t.type?' primary':''}" onclick="state.importData.type='${t.type}';_renderImportModal()" style="${selectedType===t.type?'border:none':''}">
            <div class="connect-tile-icon">${t.icon}</div>
            <div class="connect-tile-body">
              <div class="connect-tile-title">${t.label}</div>
              <div class="connect-tile-sub">${t.sub}</div>
            </div>
            ${selectedType===t.type?'<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
          </button>`).join('')}
      </div>
      ${selectedType?`
        <label style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 16px;border:2px dashed var(--border);border-radius:var(--r-lg);cursor:pointer;background:var(--surface);margin-bottom:14px;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <svg width="28" height="28" viewBox="0 0 26 26" fill="none"><path d="M13 4v14M7 10l6-6 6 6" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 19v3h20v-3" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
          <span style="font-family:var(--font-d);font-size:14px;font-weight:500;color:${d.fileName?'var(--text)':'var(--muted)'}">${esc(d.fileName)||'Klik om bestand te kiezen'}</span>
          <input type="file" accept="${accept}" style="display:none" onchange="_importFileSelected(this)">
        </label>
        <button class="btn-primary" ${d.file?'':'disabled'} onclick="_importStep1Next()">Volgende →</button>
      `:`<div style="text-align:center;font-size:13px;color:var(--faint);padding:8px 0">Kies eerst een bestandstype hierboven</div>`}`;
    return;
  }

  // ── Stap 2: configuratie ─────────────────────────────────────────────────
  if(s===2){
    const rd=d.runDays;
    el.innerHTML=`
      ${stepLabel(2)}
      <div style="font-family:var(--font-d);font-weight:700;font-size:22px;letter-spacing:-0.03em;margin-bottom:6px">Even instellen</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.5">Dan weet runyo hoe je schema in de tijd past.</div>
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Begindatum schema</div>
        <input type="date" class="settings-input" value="${d.startDate}" onchange="state.importData.startDate=this.value">
      </div>
      <div style="margin-bottom:14px">
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Hardloopdagen</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${_IMP_DAYS.map((n,i)=>`<button onclick="_importToggleDay(${i})" style="padding:7px 11px;border-radius:var(--r);border:1px solid ${rd.includes(i)?'var(--accent)':'var(--border)'};background:${rd.includes(i)?'var(--accent)':'var(--surface)'};color:${rd.includes(i)?'var(--accent-ink)':'var(--muted)'};font-family:var(--font-d);font-size:13px;font-weight:${rd.includes(i)?'600':'400'};cursor:pointer;transition:all 0.12s">${n}</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);margin-bottom:20px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="font-size:13px;font-weight:500;color:var(--text)">Rustdagen behouden</div>
            <button onclick="_toggleRustTooltip()" style="background:var(--surface);border:1px solid var(--border);border-radius:50%;width:18px;height:18px;font-size:10px;color:var(--muted);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;line-height:1" title="Uitleg">i</button>
          </div>
          <div id="rustTooltip" style="display:none;margin-top:6px;font-size:11px;color:var(--text2);background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:8px 10px;line-height:1.5">Staat dit aan, dan worden rustdagen uit je originele schema overgenomen op dezelfde positie. Zet uit als je zelf wil bepalen wanneer je rust.</div>
        </div>
        <button onclick="_importToggleRest()" style="width:44px;height:24px;border-radius:12px;border:none;background:${d.keepRest?'var(--accent)':'var(--border)'};cursor:pointer;position:relative;flex-shrink:0;transition:background 0.15s;margin-left:12px">
          <span style="position:absolute;top:4px;${d.keepRest?'left:23px':'left:4px'};width:16px;height:16px;border-radius:50%;background:${d.keepRest?'var(--accent-ink)':'var(--surface)'}"></span>
        </button>
      </div>
      <button class="btn-primary" onclick="_importStep2Next()">Schema verwerken →</button>`;
    return;
  }

  // ── Stap 3: schema herkend ───────────────────────────────────────────────
  if(s===3){
    const _debugBlock=()=>{
      const raw=d.rawResponse||'';
      const reportBtn=`<button class="btn-secondary" style="margin-top:8px;width:100%" onclick="_importReportBug()">Fout melden (bestand + respons opsturen)</button>`;
      return`<details style="margin-top:12px"><summary style="font-family:var(--font-m);font-size:9px;color:var(--faint);cursor:pointer;letter-spacing:1px;text-transform:uppercase">Debug — analyse respons</summary><pre style="font-family:var(--font-m);font-size:9px;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:8px;margin-top:6px;overflow:auto;max-height:160px;white-space:pre-wrap;word-break:break-all">${esc(raw||'(leeg)')}</pre>${reportBtn}</details>`;
    };
    if(d.loading){
      el.innerHTML=`${stepLabel(3)}
        <div style="text-align:center;padding:40px 0">
          <div style="width:48px;height:48px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;margin:0 auto 16px;animation:spin 0.8s linear infinite"></div>
          <div style="font-family:var(--font-d);font-size:16px;font-weight:600;color:var(--text);margin-bottom:6px">Schema verwerken…</div>
          <div style="font-size:13px;color:var(--muted)">Dit kan een minuut duren.</div>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
      return;
    }
    if(d.error){el.innerHTML=`${stepLabel(3)}<div style="font-size:13px;color:var(--cat-race);margin-bottom:16px;padding:12px;background:rgba(200,51,107,0.06);border:1px solid rgba(200,51,107,0.2);border-radius:var(--r)">${esc(d.error)}</div><button class="btn-primary" onclick="_importStep2Next()">Opnieuw proberen</button>${_debugBlock()}`;return;}
    if(!d.preview?.length){el.innerHTML=`${stepLabel(3)}<div style="font-size:13px;color:var(--cat-race);margin-bottom:16px">Geen schema gevonden. Probeer een ander bestand.</div><button class="btn-primary" onclick="state.importStep=1;_renderImportModal()">Ander bestand kiezen</button>${_debugBlock()}`;return;}

    // Bouw week-overzicht (groepeer per ISO-week)
    const weekMap={};
    d.preview.forEach(r=>{
      const dt=new Date(r.datum+'T12:00:00');
      const wk=dt.toISOString().slice(0,10);
      const mon=new Date(dt);mon.setDate(dt.getDate()-(dt.getDay()+6)%7);
      const key=mon.toISOString().slice(0,10);
      if(!weekMap[key])weekMap[key]={key,rows:[],km:0};
      weekMap[key].rows.push(r);
      weekMap[key].km+=parseFloat((r.km||0).toString().replace(',','.'))||0;
    });
    const weeks=Object.values(weekMap).sort((a,b)=>a.key.localeCompare(b.key)).slice(0,6);
    const totalKm=d.preview.reduce((s,r)=>s+(parseFloat((r.km||0).toString().replace(',','.'))||0),0);
    const catColor=(type)=>{
      const t=normalizeType(type||'rest');
      return{run:'var(--cat-run)',strength:'var(--cat-strength)',mobility:'var(--cat-mobility)',rest:'var(--border)',race:'var(--cat-race)',recovery:'var(--cat-recovery)',work:'var(--cat-work)'}[t]||'var(--border)';
    };

    const rapportHtml=d.rapport?`
      <div style="background:var(--accent-glow);border:1px solid rgba(0,185,142,0.2);border-radius:var(--r);padding:10px 12px;margin-bottom:14px;display:flex;gap:8px;align-items:flex-start">
        <svg width="16" height="16" viewBox="0 0 16 16" style="flex-shrink:0;margin-top:1px"><circle cx="8" cy="8" r="7" fill="none" stroke="var(--accent)" stroke-width="1.5"/><path d="M5 8l2.5 2.5 4-5" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div style="font-size:12px;color:var(--text2);line-height:1.5">${esc(d.rapport)}</div>
      </div>`:'';

    const weekBars=weeks.map((w,wi)=>{
      const bars=w.rows.map(r=>`<div style="flex:1;height:20px;border-radius:3px;background:${catColor(r.type)}" title="${esc(r.titel||r.type)}"></div>`).join('');
      return`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:${wi?'1px solid var(--border)':'none'}">
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);width:32px;flex-shrink:0">WK ${wi+1}</div>
        <div style="flex:1;display:flex;gap:3px">${bars}</div>
        <div style="font-family:var(--font-m);font-size:11px;color:var(--text2);width:44px;text-align:right">${w.km.toFixed(0)}<span style="color:var(--muted)">km</span></div>
      </div>`;
    }).join('');

    const legendItems=[['run','var(--cat-run)','Run'],['strength','var(--cat-strength)','Kracht'],['mobility','var(--cat-mobility)','Mobility'],['rest','var(--border)','Rust'],['race','var(--cat-race)','Race']];
    const legend=legendItems.map(([,c,l])=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:2px;background:${c}"></div><span style="font-size:11px;color:var(--muted)">${l}</span></div>`).join('');

    el.innerHTML=`${stepLabel(3)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="var(--accent-ink)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div style="font-family:var(--font-m);font-size:11px;color:var(--accent);letter-spacing:0.06em;text-transform:uppercase">Schema herkend</div>
      </div>
      <div style="font-family:var(--font-d);font-weight:700;font-size:20px;letter-spacing:-0.02em;margin-bottom:4px">${weeks.length} weken · ${totalKm.toFixed(0)} km totaal</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px">${d.preview.length} activiteiten · ${esc(d.fileName)}</div>
      ${rapportHtml}
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
          <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase">Eerste ${weeks.length} weken</div>
          ${d.preview.length>weeks.length*7?`<div style="font-size:11px;color:var(--muted)">+ meer</div>`:''}
        </div>
        ${weekBars}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">${legend}</div>
      <button class="btn-primary" onclick="state.importStep=4;_renderImportModal()">Klopt. ga verder →</button>
      <div style="text-align:center;margin-top:10px">
        <button onclick="state.importStep=2;_renderImportModal()" style="background:none;border:none;color:var(--muted);font-family:var(--font-d);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:2px">Iets aanpassen</button>
      </div>
      ${_debugBlock()}`;
    return;
  }

  // ── Stap 4: bevestigen + importeren ─────────────────────────────────────
  if(s===4){
    el.innerHTML=`
      ${stepLabel(4)}
      <div style="font-family:var(--font-d);font-weight:700;font-size:22px;letter-spacing:-0.03em;margin-bottom:6px">Alles klaar</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.5">Klik op importeren om je schema toe te voegen aan Google Sheets.</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:20px">
        <div style="font-family:var(--font-m);font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">Samenvatting</div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;color:var(--muted)">Bestand</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${esc(state.importData.fileName)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;color:var(--muted)">Activiteiten</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${state.importData.preview?.length||0}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0">
          <span style="font-size:13px;color:var(--muted)">Begindatum</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${state.importData.startDate}</span>
        </div>
      </div>
      <button class="btn-primary" onclick="_confirmImport()">Schema importeren →</button>
      <div style="text-align:center;margin-top:12px">
        <div style="font-size:11px;color:var(--faint);line-height:1.5">Het schema wordt naar je gekoppelde Google Sheet geschreven.</div>
      </div>`;
    return;
  }
}

function _importFileSelected(input){
  const f=input.files[0];if(!f)return;
  state.importData.file=f;state.importData.fileName=f.name;
  _renderImportModal();
}
function _importStep1Next(){
  if(!state.importData.file){showToast('Selecteer eerst een bestand');return;}
  state.importStep=2;_renderImportModal();
}
function _importToggleDay(i){
  const a=state.importData.runDays,idx=a.indexOf(i);
  idx>=0?a.splice(idx,1):a.push(i);
  _renderImportModal();
}
function _importToggleRest(){state.importData.keepRest=!state.importData.keepRest;_renderImportModal();}
function _toggleRustTooltip(){const t=document.getElementById('rustTooltip');if(t)t.style.display=t.style.display==='none'?'block':'none';}

async function _importStep2Next(){
  state.importStep=3;
  const d0=state.importData;
  Object.assign(d0,{loading:true,error:null,preview:null,importStartTs:new Date().toISOString()});
  // G17: start log entry before AI call
  _importSendLog({ts:d0.importStartTs,success:null,phase:'start',
    fileName:d0.file?.name||'',fileType:d0.type||'',fileSize:d0.file?.size||0,
    settings:{startDate:d0.startDate,runDays:d0.runDays,keepRest:d0.keepRest}});
  _renderImportModal();
  try{await _runImportAI();}
  catch(e){
    const d=state.importData;
    Object.assign(d,{error:e.message||'Verwerking mislukt',loading:false});
    _renderImportModal();
    _importSendLog({
      ts:new Date().toISOString(),success:false,
      fileName:d.file?.name||'',fileType:d.type||'',fileSize:d.file?.size||0,
      settings:{startDate:d.startDate,runDays:d.runDays,keepRest:d.keepRest},
      rawResponse:d.rawResponse||'',rapport:d.rapport||'',parsedCount:d.parsedCount||0,
      tokenUsage:d.tokenUsage||null,aiDuration:d.aiDuration||null,estimatedCostEur:d.estimatedCostEur||null,
      error:e.message||'Verwerking mislukt',fileBase64:d2.fileBase64||'',client:_importClientInfo(),
    });
  }
}

async function _readFileBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=e=>resolve(e.target.result.split(',')[1]);
    r.onerror=reject;r.readAsDataURL(file);
  });
}

async function _loadSheetJS(){
  if(window.XLSX)return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=resolve;s.onerror=()=>reject(new Error('SheetJS laden mislukt'));
    document.head.appendChild(s);
  });
}

function _importClientInfo(){
  return{
    userAgent:navigator.userAgent,
    screen:`${screen.width}x${screen.height}`,
    lang:navigator.language,
    online:navigator.onLine,
    platform:navigator.platform||'',
  };
}

async function _importSendLog(payload){
  try{
    const resp=await fetch(GAUTH.AUTH_BACKEND+'/ai/debug-log',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
    });
    if(!resp.ok)throw new Error('HTTP '+resp.status);
  }catch{}
}

async function _runImportAI(){
  const d=state.importData;
  const name=d.file.name.toLowerCase();
  const dayNames=_IMP_DAYS.map((n,i)=>d.runDays.includes(i)?n:null).filter(Boolean).join(', ')||'geen';
  const userText=`Begindatum: ${d.startDate}. Hardloopdagen: ${dayNames}. Rustdagen behouden: ${d.keepRest?'ja':'nee'}.`;
  state.importData.aiStart=Date.now();

  let userContent;
  if(name.endsWith('.xlsx')){
    await _loadSheetJS();
    const buf=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=e=>resolve(e.target.result);r.onerror=reject;r.readAsArrayBuffer(d.file);});
    // G16a: store raw base64 for download in log
    try{const bytes=new Uint8Array(buf);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));state.importData.fileBase64=btoa(bin).slice(0,2000000);}catch{}
    const wb=window.XLSX.read(buf,{type:'array'});
    const csv=window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    userContent=`${userText}\n\n${csv}`;
  } else {
    const b64=await _readFileBase64(d.file);
    state.importData.fileBase64=b64.slice(0,2000000); // G16a: store for download
    const mt=name.endsWith('.pdf')?'application/pdf':name.endsWith('.png')?'image/png':'image/jpeg';
    const block=name.endsWith('.pdf')
      ?{type:'document',source:{type:'base64',media_type:mt,data:b64}}
      :{type:'image',source:{type:'base64',media_type:mt,data:b64}};
    userContent=[block,{type:'text',text:userText}];
  }

  const resp=await fetch(GAUTH.AUTH_BACKEND+'/ai/import',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'claude-sonnet-4-6',max_tokens:8000,
      system:`Je krijgt een trainingsschema (PDF, Excel, afbeelding of tekst).

Eerste stap (kritiek): Scan onmiddellijk naar de kern: zoek naar "WEEK", "Week", tabellen met MON/TUE/... of herhaalde dag-structuren. Sla alle inleidingen, motivatie, glossary, pace charts, uitleg over audio guided runs, marketing en algemene adviezen over. Ga rechtstreeks naar de week-per-week workouts.

Velden per item: datum (YYYY-MM-DD), type (run|kracht|mobiliteit|rust|herstel|werk|race), titel (string, max 70 tekens), detail (string, max 170 tekens), km (number|null), fase ("" altijd leeg).

Regels (strikt):
1. Structuur: volg exact de weken en dagen uit het schema. Dubbele schema's (miles+km of identieke content): neem alleen de meest gedetailleerde versie. Negeer duplicaten.
2. Datum mapping: begindatum = eerste dag week 1. Elke week +7 dagen. Ontbrekende dagen vullen met rust.
3. Hardloopdagen: schema leidend. Neem alle run-sessies over.
4. Rust: REST/Off/Off Day → type rust, detail "rust". REST or Cross-Training → type rust, detail "rust (optioneel cross/mobiliteit)". Als rustdagen behouden = nee → vervang pure rust door mobiliteit of herstel (behalve taper/race week).
5. Type mapping: Easy/Recovery/Long Run/Steady/Speed/Interval/Tempo/Threshold/Hill/Fartlek → run. Race/Tune-up Race → race. Cross-Training/Yoga/Pilates/Bike/Swim/Core → mobiliteit of kracht. Stretch/Mobility → mobiliteit.
6. Meerdere sessies per dag: altijd combineren in één item. WU+main+CD in detail.
7. km: gebruik expliciete afstanden. Ranges zonder afstand → null. Miles × 1.609, afronden op 1 decimaal.
8. Output: chronologisch, één entry per dag, geen dubbele datums.

Schrijf eerst een TITEL: van maximaal 30 tekens — de naam van het schema zoals in het bestand staat (bijv. "ASICS 18-weken marathon"). Dan een RAPPORT: van maximaal 5 korte zinnen in gewone taal. Schrijf alsof je het uitlegt aan de gebruiker: wat het doel is, hoeveel weken, hoeveel hardloopsessies per week, hoe het volume opbouwt en of er een taperfase is. Geen technische velden, geen interne labels. Daarna DIRECT de JSON array op een nieuwe regel, geen markdown, geen \`\`\`json, geen extra tekst voor of na de array.`,
      messages:[{role:'user',content:userContent}],
    }),
  });

  if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e?.error?.message||`API fout ${resp.status}`);}
  const json=await resp.json();
  const raw=json.content?.[0]?.text||'';
  state.importData.rawResponse=raw;
  state.importData.tokenUsage=json.usage||null;
  state.importData.aiDuration=Date.now()-(state.importData.aiStart||Date.now());
  // G18: estimate cost
  if(json.usage){
    const inp=(json.usage.input_tokens||0)/1e6*3;
    const out=(json.usage.output_tokens||0)/1e6*15;
    state.importData.estimatedCostEur=+(inp+out).toFixed(4);
  }
  // Extract TITEL: and RAPPORT:
  const titelMatch=raw.match(/TITEL\s*:\s*([^\n\r]{1,30})/i);
  state.importData.schemaTitle=titelMatch?titelMatch[1].trim():'';
  const rapportMatch=raw.match(/RAPPORT\s*:\s*([\s\S]*?)(?=\[|$)/i);
  state.importData.rapport=rapportMatch?rapportMatch[1].trim():'';
  let parsed=null;
  // 1. Strip markdown fences if present (```json ... ``` or ``` ... ```)
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned=fenced?fenced[1].trim():raw.trim();
  // 2. Try parsing cleaned text as complete JSON array
  if(!parsed){const m=cleaned.match(/\[[\s\S]*\]/);if(m)try{parsed=JSON.parse(m[0]);}catch{}}
  // 3. Try raw fallback (in case no fences)
  if(!parsed){const m=raw.match(/\[[\s\S]*\]/);if(m)try{parsed=JSON.parse(m[0]);}catch{}}
  // 4. Recover individual objects from truncated response
  if(!parsed){
    const objs=[...raw.matchAll(/\{[^{}]*?"datum"\s*:\s*"(\d{4}-\d{2}-\d{2})"[\s\S]*?\}/g)].map(m=>{try{return JSON.parse(m[0]);}catch{return null;}}).filter(Boolean);
    if(objs.length)parsed=objs;
  }
  if(!Array.isArray(parsed)||!parsed.length)throw new Error('Geen schema gevonden, probeer een ander bestand');

  const rows=parsed
    .filter(r=>r?.datum&&/^\d{4}-\d{2}-\d{2}$/.test(r.datum))
    .map(r=>({datum:r.datum,type:r.type||'run',titel:String(r.titel||''),detail:String(r.detail||''),km:r.km!=null&&r.km!==''?Number(r.km)||null:null,fase:r.fase||''}));
  if(!rows.length)throw new Error('Geen schema gevonden, probeer een ander bestand');

  state.importData.parsedCount=rows.length;
  Object.assign(state.importData,{preview:rows,loading:false});
  _renderImportModal();
}

function _getFutureRaces(data){
  const today=todayStr();
  return(data||[]).filter(r=>normalizeType(r.type)==='race'&&r.datum>=today);
}

function _offerRacesCopy(newSheetId,racesOverride){
  const races=racesOverride||_pendingRacesToCopy||[];
  _pendingRacesToCopy=[];
  if(!races.length)return;
  window._raceCopyPending={races,newSheetId};
  const el=document.getElementById('dayModalContent');
  document.getElementById('dayModal').classList.add('open');
  el.innerHTML=`<div class="modal-title">Races meenemen?</div>
    <div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin-bottom:14px">Je vorige schema bevat ${races.length} toekomstige race${races.length>1?'s':''}. Wil je die toevoegen aan het nieuwe schema?</div>
    <div style="margin-bottom:16px;max-height:140px;overflow:auto">${races.slice(0,8).map(r=>`<div style="font-family:var(--font-m);font-size:10px;color:var(--text);padding:5px 0;border-bottom:1px solid var(--border)">🏁 ${esc(r.datum)} — ${esc(r.titel||'Race')}</div>`).join('')}${races.length>8?`<div style="font-family:var(--font-m);font-size:10px;color:var(--muted);padding:5px 0">+${races.length-8} meer</div>`:''}</div>
    <div style="display:flex;gap:8px"><button class="btn-secondary" style="flex:1" onclick="closeDayModal()">Nee</button><button class="btn-primary" style="flex:1" onclick="_doRacesCopy()">Ja, meenemen</button></div>`;
}

async function _doRacesCopy(){
  const{races,newSheetId}=window._raceCopyPending||{};
  closeDayModal();
  if(!races?.length)return;
  showToast('Races worden gekopieerd…');
  try{
    const sheetName=state.sheetName||'Schema';
    const COLS=['datum','type','titel','detail','km','feedback','fase','id','updated_at','created_at','race_type'];
    const values=races.map(r=>COLS.map(h=>{
      if(h==='id')return _uuid();
      if(h==='updated_at'||h==='created_at')return _nowISO();
      if(h==='type')return toSheetType(normalizeType(r.type));
      if(h==='km')return r.km!=null?String(r.km):'';
      if(h==='feedback')return'';
      if(h==='race_type')return r.race_type||'';
      if(h==='fase')return''; // C64: clear fase on copied race rows
      return String(r[h]??'');
    }));
    const token=await authEnsureToken();
    const url=`${SHEETS_BASE}/${newSheetId}/values/${encodeURIComponent(sheetName+'!A:A')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({majorDimension:'ROWS',values})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
    await oauthSortByDate(newSheetId,sheetName);
    showToast(`✓ ${races.length} race${races.length>1?'s':''} gekopieerd`);
    await fetchData();
  }catch(e){showToast('❌ Kopiëren mislukt: '+e.message);}
}

async function _confirmImport(){
  const d=state.importData;
  const rows=d.preview;if(!rows?.length)return;
  // C63: capture future races from current (old) schema before we switch
  const _preImportRaces=_getFutureRaces(state.data);
  const _hadActiveSchema=!!(typeof authSheetId==='function'&&authSheetId());
  const el=document.getElementById('dayModalContent');
  el.innerHTML=`<div class="modal-title">Importeren…</div>`;
  showLoading();
  try{
    // Always create a fresh sheet — never modify an existing connected sheet
    const sheet=await createNewSheet();
    const sheetId=sheet.id;
    const sheetName='Schema';
    authSetSheetId(sheetId);
    state.sheetId=sheetId;state.sheetName=sheetName;
    localStorage.setItem('sheetId',sheetId);localStorage.setItem('sheetName',sheetName);
    const _em=typeof authEmail==='function'?authEmail():'';
    if(_em){
      localStorage.setItem('sheetId_'+_em,sheetId);
      localStorage.setItem('sheetTabName_'+_em,sheetName);
      localStorage.setItem('sheetFileName_'+_em,sheet.title);
    }
    // C61: sheet title = "runyo schema <title> <dd-mm-yyyy>"
    const _rawFile=d.file?.name||'';
    const _fileBase=_rawFile.replace(/\.[^.]+$/,'').slice(0,50);
    const _titlePart=(d.schemaTitle&&d.schemaTitle.length>2?d.schemaTitle.slice(0,50):_fileBase)||'';
    const _today=new Date().toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'});
    const _importSheetTitle=_titlePart?`runyo schema ${_titlePart} ${_today}`:`runyo schema ${_today}`;
    // Rename the sheet to the import-specific title
    try{const _tok=await authEnsureToken();await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,{method:'POST',headers:{Authorization:'Bearer '+_tok,'Content-Type':'application/json'},body:JSON.stringify({requests:[{updateSpreadsheetProperties:{properties:{title:_importSheetTitle},fields:'title'}}]})});}catch{}
    const _importDisplay=_titlePart||sheet.title;
    localStorage.setItem('driveFileName_'+sheetId,_importDisplay);
    if(_em)localStorage.setItem('sheetFileName_'+_em,_importDisplay);
    _saveSchemaHistory(sheetId,_importDisplay,sheet.url);
    el.innerHTML=`<div class="modal-title">Importeren…</div><div style="font-family:var(--font-m);font-size:11px;color:var(--muted);margin-top:32px;text-align:center">Rijen wegschrijven…</div>`;
    // Fixed column order — no header read needed
    const COLS=['datum','type','titel','detail','km','feedback','fase','id','updated_at','created_at','race_type'];
    const values=rows.map(r=>COLS.map(h=>{
      if(h==='id')return _uuid();
      if(h==='updated_at'||h==='created_at')return _nowISO();
      if(h==='type')return toSheetType(normalizeType(r.type));
      if(h==='km')return r.km!=null?String(r.km):'';
      if(h==='feedback'||h==='race_type')return'';
      return String(r[h]??'');
    }));
    const token=await authEnsureToken();
    const url=`${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(sheetName+'!A:A')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const body=JSON.stringify({majorDimension:'ROWS',values});
    const doPost=()=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body});
    let res=await doPost();
    if(res.status===429){await new Promise(r=>setTimeout(r,2000));res=await doPost();}
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||'HTTP '+res.status);}
    await oauthSortByDate(sheetId,sheetName);
    if(typeof _syncSettingsToAccount==='function')_syncSettingsToAccount().catch(()=>{});
    closeDayModal();
    if(typeof renderHeader==='function')renderHeader();
    if(typeof renderConnectSection==='function')renderConnectSection();
    showToast(`✓ ${rows.length} activiteiten geïmporteerd in nieuw schema`);
    // Auto-log successful imports
    const d2=state.importData;
    _importSendLog({
      ts:new Date().toISOString(),success:true,
      fileName:d2.file?.name||'',fileType:d2.type||'',fileSize:d2.file?.size||0,
      settings:{startDate:d2.startDate,runDays:d2.runDays,keepRest:d2.keepRest},
      rawResponse:d2.rawResponse||'',rapport:d2.rapport||'',parsedCount:rows.length,
      tokenUsage:d2.tokenUsage||null,aiDuration:d2.aiDuration||null,estimatedCostEur:d2.estimatedCostEur||null,
      error:'',fileBase64:d2.fileBase64||'',client:_importClientInfo(),
    });
    await fetchData();
    // C63: offer to copy races from previous schema
    if(_hadActiveSchema&&_preImportRaces.length>0)_offerRacesCopy(sheetId,_preImportRaces);
  }catch(e){
    const errMsg='Importeren mislukt: '+(e.message||e);
    const d2=state.importData;
    Object.assign(d2,{error:errMsg,loading:false});
    _renderImportModal();
    _importSendLog({
      ts:new Date().toISOString(),success:false,
      fileName:d2.file?.name||'',fileType:d2.type||'',fileSize:d2.file?.size||0,
      settings:{startDate:d2.startDate,runDays:d2.runDays,keepRest:d2.keepRest},
      rawResponse:d2.rawResponse||'',rapport:d2.rapport||'',parsedCount:d2.parsedCount||0,
      tokenUsage:d2.tokenUsage||null,aiDuration:d2.aiDuration||null,estimatedCostEur:d2.estimatedCostEur||null,
      error:errMsg,fileBase64:d2.fileBase64||'',client:_importClientInfo(),
    });
  }
}

async function _importReportBug(){
  const d=state.importData;
  try{
    let fileContent='';
    if(d.file){
      const n=d.file.name.toLowerCase();
      if(n.endsWith('.xlsx')){
        await _loadSheetJS();
        const buf=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsArrayBuffer(d.file);});
        const wb=window.XLSX.read(buf,{type:'array'});
        fileContent=window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]).slice(0,8000);
      } else {
        fileContent=(await _readFileBase64(d.file)).slice(0,8000);
      }
    }
    const resp=await fetch(GAUTH.AUTH_BACKEND+'/ai/debug-log',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        ts:new Date().toISOString(),success:false,
        fileName:d.file?.name||'',fileType:d.type||'',fileSize:d.file?.size||0,
        settings:{startDate:d.startDate,runDays:d.runDays,keepRest:d.keepRest},
        rawResponse:d.rawResponse||'',rapport:d.rapport||'',parsedCount:d.parsedCount||0,
        tokenUsage:d.tokenUsage||null,aiDuration:d.aiDuration||null,estimatedCostEur:d.estimatedCostEur||null,
        error:d.error||'',fileContent,fileBase64:d.fileBase64||'',client:_importClientInfo(),
      }),
    });
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    showToast('✓ Fout gemeld, bedankt!');
  }catch(e){showToast('❌ Melden mislukt ('+e.message+')');}
}

function oauthDisconnect(){
  if(typeof authClear==='function')authClear();
  localStorage.removeItem('oauth_sheetId');
  if(typeof state!=='undefined'){state.data=null;state.sheetId='';state.sheetName='';}
  if(typeof renderAccountSection==='function')renderAccountSection();
  if(typeof renderConnectSection==='function')renderConnectSection();
  if(typeof renderHeader==='function')renderHeader();
  if(typeof renderActiveView==='function')renderActiveView();
  showToast('Uitgelogd');
}
function disconnectSheet(){
  state.scriptUrl='';state.sheetName='';state.sheetId='';
  localStorage.removeItem('scriptUrl');localStorage.removeItem('sheetName');
  localStorage.removeItem('oauth_sheetId');
  if(typeof authSetSheetId==='function')authSetSheetId('');
  // Wis ook de email-gebaseerde fallback zodat authSheetId() niet herverbindt
  const _em=typeof authEmail==='function'?authEmail():'';
  if(_em){
    localStorage.removeItem('sheetId_'+_em);
    localStorage.removeItem('sheetTabName_'+_em);
    localStorage.removeItem('sheetName_'+_em);
  }
  state.data=null;
  renderActiveView();renderConnectSection();renderHeader();
  showToast('Schema ontkoppeld');
}

// Telegram verify
function verifyTelegram(){
  const user=document.getElementById('telegramUser')?.value.trim();
  if(!user){showToast(T('notif_telegram'));return;}
  showToast(T('tg_verifying'));
  // Show hint to user
  setTimeout(()=>showToast(T('tg_verify_hint')),2600);
}

function updateTelegramStatus(){
  const dot=document.getElementById('tgDot'),txt=document.getElementById('tgStatusText');
  const linked=!!localStorage.getItem('telegramLinked');
  if(dot)dot.className='tg-dot'+(linked?' linked':'');
  if(txt)txt.textContent=linked?T('tg_linked'):T('tg_not_linked');
}

function addPrField(){
  const sel=document.getElementById('prDistSelect'),dist=sel.value;
  if(!dist)return;sel.value='';
  const prs=loadPRs();if(dist in prs)return;
  prs[dist]='';persistPRs(prs);renderPrFields();
}
function removePrField(dist){const prs=loadPRs();delete prs[dist];persistPRs(prs);renderPrFields();}
function updatePR(dist,val){const prs=loadPRs();prs[dist]=val;persistPRs(prs);}

function renderPrFields(){
  const c=document.getElementById('prFields');if(!c)return;
  const prs=loadPRs(),active=PR_ORDER.filter(d=>d in prs);
  if(!active.length){c.innerHTML=`<div style="font-size:11px;color:var(--faint);padding:4px 0">${T('pr_none')}</div>`;return;}
  c.innerHTML=active.map(d=>`
    <div class="pr-row">
      <label class="pr-dist-lbl">${d}</label>
      <input type="text" class="settings-input" style="flex:1" placeholder="${T('pr_placeholder')}" value="${esc(prs[d]||'')}" oninput="updatePR('${d}',this.value)">
      <button onclick="removePrField('${d}')" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:18px;padding:0 4px;line-height:1">×</button>
    </div>`).join('');
}

function renderSettingsFields(){
  // C26/C30: connect section is fully dynamic
  renderConnectSection();
  const tgEl=document.getElementById('telegramUser');if(tgEl)tgEl.value=localStorage.getItem('telegramUser')||'';
  const nameEl=document.getElementById('settingsName');if(nameEl)nameEl.value=localStorage.getItem('userName')||'';
  renderAccountSection();updateTelegramStatus();applyNotifPrefs();applyI18n();
  // Weather location
  const loc=getWeatherLocation();
  const cityEl=document.getElementById('weatherCityInput');
  const hint=document.getElementById('weatherLocationHint');
  if(cityEl&&loc?.city)cityEl.value=loc.city;
  if(hint&&loc)hint.textContent=loc.source==='manual'?'Handmatig ingesteld.':'Automatisch bepaald via IP. Vul handmatig in om te overschrijven.';
}

async function saveWeatherCity(){
  const city=document.getElementById('weatherCityInput')?.value.trim();
  if(!city)return;
  showToast('Locatie opzoeken…');
  const loc=await geocodeCity(city);
  if(!loc){showToast('Stad niet gevonden.');return;}
  setWeatherLocation(loc);
  localStorage.removeItem('weatherCache');
  await fetchWeather();
  showToast('✓ Locatie opgeslagen');
  renderSettingsFields();
  if(state.currentTab==='today')renderToday();
}

function saveSettingsName(){
  localStorage.setItem('userName',document.getElementById('settingsName')?.value||'');
  renderHeader();showToast(T('saved'));
}

function saveSettings(){
  // Apps Script URL from dev section (optional)
  const url=document.getElementById('scriptUrl')?.value.trim()||state.scriptUrl||'';
  state.scriptUrl=url;if(url)localStorage.setItem('scriptUrl',url);
  const sheetRaw=document.getElementById('sheetIdInput')?.value.trim()||'';
  const sheetIdMatch=sheetRaw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const sid=sheetIdMatch?sheetIdMatch[1]:sheetRaw; // fallback: treat as raw ID
  state.sheetId=sid;localStorage.setItem('sheetId',sid);
  const sn=document.getElementById('sheetNameInput')?.value||'';
  state.sheetName=sn;localStorage.setItem('sheetName',sn);
  showToast(T('connecting'));
  showLoading();
  fetchData().then(()=>renderConnectSection());
}

function saveSheetName(){
  state.sheetName=document.getElementById('sheetNameInput')?.value||'';
  localStorage.setItem('sheetName',state.sheetName);
}

function saveNotifPrefs(){
  const daily=!!document.getElementById('notifDaily')?.checked;
  const feedback=!!document.getElementById('notifFeedback')?.checked;
  const p=loadNotifPrefs();
  p.daily=daily;p.feedback=feedback;
  localStorage.setItem('notifPrefs',JSON.stringify(p));
  // Re-render to show/hide time selectors
  const dw=document.getElementById('notifDailyTimes');
  const fw=document.getElementById('notifFeedbackTimes');
  if(dw)dw.style.display=daily?'block':'none';
  if(fw)fw.style.display=feedback?'block':'none';
  _syncSettingsToAccount();
  _syncSettingsToBot().catch(()=>{});
  showToast(T('saved'));
}
function _addNotifTime(key){
  const p=loadNotifPrefs();
  if(!p[key+'Times'])p[key+'Times']=[];
  p[key+'Times'].push('07:00');
  localStorage.setItem('notifPrefs',JSON.stringify(p));
  _renderNotifTimes(key);
  _syncSettingsToAccount();
  _syncSettingsToBot().catch(()=>{});
}
function _removeNotifTime(key,idx){
  const p=loadNotifPrefs();
  if(p[key+'Times'])p[key+'Times'].splice(idx,1);
  localStorage.setItem('notifPrefs',JSON.stringify(p));
  _renderNotifTimes(key);
  _syncSettingsToAccount();
  _syncSettingsToBot().catch(()=>{});
}
function _updateNotifTime(key,idx,val){
  const p=loadNotifPrefs();
  if(!p[key+'Times'])p[key+'Times']=[];
  p[key+'Times'][idx]=val;
  localStorage.setItem('notifPrefs',JSON.stringify(p));
  _syncSettingsToAccount();
  _syncSettingsToBot().catch(()=>{});
}
function _renderNotifTimes(key){
  const el=document.getElementById('notif'+key.charAt(0).toUpperCase()+key.slice(1)+'Times');
  if(!el)return;
  const p=loadNotifPrefs();
  const times=p[key+'Times']||['07:00'];
  el.innerHTML=times.map((t,i)=>`<div style="display:flex;align-items:center;gap:6px;margin-top:6px">
    <input type="time" value="${t}" onchange="_updateNotifTime('${key}',${i},this.value)" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;font-family:var(--font-m);font-size:12px;border-radius:4px;flex:1">
    ${times.length>1?`<button onclick="_removeNotifTime('${key}',${i})" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:16px;padding:0 4px;line-height:1">×</button>`:''}
    <button onclick="_addNotifTime('${key}')" style="background:none;border:1px solid var(--accent);color:var(--accent);cursor:pointer;font-size:14px;padding:2px 8px;border-radius:4px;line-height:1.4">+</button>
  </div>`).join('');
}
function loadNotifPrefs(){try{return JSON.parse(localStorage.getItem('notifPrefs')||'{}');}catch{return{};}}
function applyNotifPrefs(){
  const p=loadNotifPrefs();
  const d=document.getElementById('notifDaily');if(d)d.checked=!!p.daily;
  const f=document.getElementById('notifFeedback');if(f)f.checked=!!p.feedback;
  const dw=document.getElementById('notifDailyTimes');
  const fw=document.getElementById('notifFeedbackTimes');
  if(dw){dw.style.display=p.daily?'block':'none';_renderNotifTimes('daily');}
  if(fw){fw.style.display=p.feedback?'block':'none';_renderNotifTimes('feedback');}
}

function saveTelegram(){
  localStorage.setItem('telegramUser',document.getElementById('telegramUser')?.value||'');
  updateTelegramStatus();
  _syncSettingsToBot().catch(()=>{});
  showToast(T('saved'));
}

async function _syncSettingsToBot(){
  const email=typeof authEmail==='function'?authEmail():'';
  const user=localStorage.getItem('telegramUser')||'';
  if(!email||!user)return;
  let token='';
  try{token=await authEnsureToken();}catch{return;}
  if(!token)return;
  const p=loadNotifPrefs();
  const notifications={
    schema:{enabled:!!p.daily,times:p.dailyTimes||['07:00']},
    feedback:{enabled:!!p.feedback,times:p.feedbackTimes||['20:00']}
  };
  await fetch(GAUTH.AUTH_BACKEND+'/user/settings',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({email,telegramUser:user,notifications})
  });
}

// ── I18N ──────────────────────────────────────────────────────────────────────
function applyI18n(){
  const tabKeys=['today','week','plan','calendar'];
  document.querySelectorAll('#bottomNav .bn-label').forEach((el,i)=>{el.textContent=T(tabKeys[i]);});
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=T(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-opt]').forEach(el=>{el.textContent=T(el.dataset.i18nOpt);});
  const nlBtn=document.getElementById('langBtnNl'),enBtn=document.getElementById('langBtnEn');
  if(nlBtn){nlBtn.style.opacity=state.lang==='nl'?'1':'0.35';nlBtn.style.transform=state.lang==='nl'?'scale(1.15)':'scale(1)';}
  if(enBtn){enBtn.style.opacity=state.lang==='en'?'1':'0.35';enBtn.style.transform=state.lang==='en'?'scale(1.15)':'scale(1)';}
  document.documentElement.lang=state.lang;
  // Update banner text if visible
  const b=document.getElementById('updateBanner');
  if(b&&b.style.display!=='none'){
    document.getElementById('updateBannerText').textContent=T('update_available');
    b.querySelector('button').textContent=T('update_apply');
  }
}

function setLang(lang){
  state.lang=lang;localStorage.setItem('lang',lang);
  applyI18n();applyTheme();renderHeader();renderActiveView();
  showToast(T('saved')); // X14: toast after lang switch, already in new language
}

// ── UI ────────────────────────────────────────────────────────────────────────
function switchTab(tab){
  // Settings alleen zichtbaar als ingelogd
  if(tab==='settings'){
    const _li=typeof authGetToken==='function'&&authGetToken()&&!authIsExpired();
    if(!_li){tab='today';}
  }
  state.currentTab=tab;state.selectedRating=0;
  document.querySelectorAll('#bottomNav .bn-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+tab));
  document.getElementById('scrollArea').scrollTop=0;
  const tabNames={today:'vandaag',week:'week',plan:'training',calendar:'kalender',settings:'instellingen'};
  const dtEl=document.getElementById('dtCurrentTab');
  if(dtEl)dtEl.textContent=tabNames[tab]||tab;
  renderActiveView();
}

function showLoading(){
  const el=document.getElementById('loadingOverlay');
  if(!el)return;
  el.style.display='flex';
  el.classList.remove('hidden');
  // Re-trigger animations
  const logo=el.querySelector('.loading-logo');
  const fill=document.getElementById('loadingBarFill');
  if(logo){logo.style.animation='none';void logo.offsetWidth;logo.style.animation='';}
  if(fill){fill.style.animation='none';void fill.offsetWidth;fill.style.animation='';}
}
function hideLoading(){
  const el=document.getElementById('loadingOverlay');
  el.classList.add('hidden');setTimeout(()=>el.style.display='none',350);
}

function showToast(msg, undoable=false){
  const el=document.getElementById('toast');
  if(undoable&&state._undoBuffer){
    el.innerHTML=`${msg} <button onclick="undoDelete()" style="background:none;border:none;color:var(--accent);font-family:var(--font-m);font-size:10px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;margin-left:8px;padding:0">Ongedaan maken</button>`;
  }else{
    el.textContent=msg;
  }
  el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>{el.classList.remove('show');el.innerHTML='';},4000);
}

async function undoDelete(){
  if(!state._undoBuffer)return;
  clearTimeout(state._undoBuffer.timeout);
  const row=state._undoBuffer.row;
  state._undoBuffer=null;
  document.getElementById('toast').classList.remove('show');
  try{
    await createActivity({
      datum:row.datum, type:row.type, titel:row.titel,
      detail:row.detail, km:row.km, fase:row.fase, feedback:row.feedback,
    });
    showToast('↩ Hersteld');
  }catch(e){showToast('❌ '+humanError(e));}
}

function updateConnectionStatus(ok,err){
  // Update status dot/text if they exist in DOM (connect section when disconnected)
  const dot=document.getElementById('statusDot'),txt=document.getElementById('statusText');
  if(dot)dot.className='status-dot '+(ok?'ok':'err');
  if(txt)txt.textContent=ok?T('connected'):`${T('conn_err')}: ${err||'?'}`;
  // If connected, re-render the connect section to show connected state
  if(ok&&state.currentTab==='settings')renderConnectSection();
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
// U1: click outside sheet dismisses (wegklikbaar)
function shouldShowOnboarding(){
  return !localStorage.getItem('onboardingDone');
}

function onboardingFinish(){
  localStorage.setItem('onboardingDone','1');
  document.getElementById('onboarding').style.display='none';
  renderHeader();renderActiveView();
}

async function onboardingStartConnect(){
  onboardingFinish();
  await oauthConnectFlow();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  initServiceWorker();

  document.getElementById('bottomNav').addEventListener('click',e=>{
    const tab=e.target.closest('.bn-item')?.dataset.tab;if(tab)switchTab(tab);
  });

  // Check URL params for sheet config (X2/X3)
  const urlParams=new URLSearchParams(window.location.search);
  if(urlParams.get('sheet'))state.scriptUrl=urlParams.get('sheet');
  if(urlParams.get('tab'))state.sheetName=urlParams.get('tab');

  if(typeof _checkOauthRedirectReturn==='function')_checkOauthRedirectReturn();
  applyI18n();renderHeader();

  // Desktop: show topbar based on screen width
  (function applyDesktopState(){
    const wide=window.innerWidth>=768;
    const dt=document.getElementById('desktopTopbar');
    if(dt)dt.style.display=wide?'flex':'none';
    renderSidebarPlanInfo();
    renderTopbarAuth();
  })();
  window.addEventListener('resize',function(){
    const wide=window.innerWidth>=768;
    const dt=document.getElementById('desktopTopbar');
    if(dt)dt.style.display=wide?'flex':'none';
    renderTopbarAuth();
  });

  // E7: check if returning from OAuth redirect (code in URL)
  const oauthCode=new URLSearchParams(window.location.search).get('code');
  if(oauthCode){
    history.replaceState({},'',window.location.pathname);
    (async()=>{
      try{
        await _exchangeCode(oauthCode);
        hideLoading();
        renderHeader();renderAccountSection();renderConnectSection();
        switchTab('settings');
        // Small delay so DOM is ready, then show sheet picker
        setTimeout(()=>showOAuthConnectSheet(),300);
      }catch(e){
        showToast('❌ Inloggen mislukt: '+humanError(e));
        hideLoading();renderActiveView();renderHeader();
      }
    })();
    return;
  }

  // E7: if OAuth token + sheet already stored, fetch directly
  if(typeof isOAuthMode==='function'&&isOAuthMode()){
    fetchData();
    return;
  }

  if(shouldShowOnboarding()){
    hideLoading();document.getElementById('onboarding').style.display='flex';
  }else if(state.scriptUrl){
    fetchData();
  }else{
    setTimeout(()=>{hideLoading();renderActiveView();},600);
  }
});

// ── BUG9: Full sign-out — wraps authSignOut with complete schema cleanup ──────
(function(){
  const _orig=typeof authSignOut==='function'?authSignOut:null;
  authSignOut=function(){
    const email=typeof authEmail==='function'?authEmail():'';

    // 1. Reset all schema-related state
    state.data=null;state.sheetId='';state.sheetName='';state.scriptUrl='';
    state.currentFase=null;state.weekOffset=0;state.dayOffset=0;
    state.raceHeaderOpen=false;state.planTypeFilters=[];state.planFilterOpen=false;
    state._prs=null;state._races=null;
    localStorage.removeItem('userRaces');

    // 2. Clear per-email schema localStorage
    if(email){
      ['schemaList_','schemaDeleted_','sheetId_','sheetTabName_','sheetFileName_','accountSnap_']
        .forEach(k=>localStorage.removeItem(k+email));
    }
    ['scriptUrl','sheetName','sheetId','oauth_sheetId'].forEach(k=>localStorage.removeItem(k));

    // 3. Clear rendered tab content — no stale data after logout
    ['todayContent','weekContent','planContent','calContent'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.innerHTML='';
    });
    const racesBar=document.getElementById('racesBar');if(racesBar)racesBar.innerHTML='';
    const phaseTabs=document.getElementById('phaseTabs');if(phaseTabs)phaseTabs.innerHTML='';

    // 4. Call original (clears tokens, re-renders header + active view)
    if(_orig)_orig();
    else{showToast('Uitgelogd');renderActiveView();renderHeader();}
  };
})();
