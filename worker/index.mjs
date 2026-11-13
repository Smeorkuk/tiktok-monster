const defaultModes=[
{id:'quick',name:'Быстрый скролл',description:'Проверить, в теме ли ты.',count:18,selection:'all',questionIds:[],enabled:true},
{id:'big',name:'Большой заход',description:'От базы до забытых мемов.',count:36,selection:'all',questionIds:[],enabled:true},
{id:'full',name:'Бездна рекомендаций',description:'Весь архив. Без сокращений.',count:0,selection:'all',questionIds:[],enabled:true}];
function modePool(mode,questions,years=[2021,2022,2023,2024,2025,2026]){return mode?questions.filter(q=>q.enabled!==false&&years.includes(q.year)&&(mode.selection==='all'||mode.questionIds.includes(q.id))):[];}
function modeCount(mode,pool){return mode?Math.min(mode.count||pool.length,pool.length):0;}
function validateModes(modes,questions){if(!Array.isArray(modes)||!modes.length||modes.length>30)throw Error('Допустимо от 1 до 30 режимов.');const ids=new Set(),qids=new Set(questions.map(q=>q.id));return modes.map(m=>{if(!m||typeof m!=='object'||!/^[a-zA-Z0-9_-]{1,80}$/.test(m.id)||ids.has(m.id))throw Error('Неверный или повторяющийся ID режима.');ids.add(m.id);if(typeof m.name!=='string'||!m.name.trim()||m.name.length>100||typeof m.description!=='string'||m.description.length>600)throw Error('Название — до 100 символов; описание — до 600.');if(!Number.isInteger(m.count)||m.count<0||m.count>1000||!['all','manual'].includes(m.selection))throw Error('Проверь число вопросов и состав режима.');if(!Array.isArray(m.questionIds)||new Set(m.questionIds).size!==m.questionIds.length||m.questionIds.some(id=>!qids.has(id)))throw Error('В составе режима есть неизвестные вопросы.');return {id:m.id,name:m.name.trim(),description:m.description.trim(),count:m.count,selection:m.selection,questionIds:m.questionIds,enabled:m.enabled!==false};});}

async function loadModes(env){const row=await env.DB.prepare("SELECT * FROM settings WHERE key='modes'").first();return {modes:row?JSON.parse(row.data):defaultModes,revision:row?.revision||0};}
async function modeRoutes(req,env,p,isAdmin){
 if(p==='/api/archive'&&req.method==='GET')return json({schemaVersion:1,questions:await loadQuestions(env),modes:(await loadModes(env)).modes.filter(m=>m.enabled)});
 if(p==='/api/modes'&&req.method==='GET'){const data=await loadModes(env);return json({...data,modes:data.modes.filter(m=>m.enabled)});}
 if(p!=='/api/admin/modes')return null;if(!isAdmin)return error('Доступ только для администратора.',403);
 if(req.method==='GET')return json(await loadModes(env));if(req.method!=='PUT')return error('Метод не поддерживается.',405);
 const b=await body(req),old=await loadModes(env);if(b.revision!==old.revision)return error('Режимы уже изменены в другой вкладке. Обнови страницу.',409);let modes;try{modes=validateModes(b.modes,await loadQuestions(env,true));}catch(e){return error(e.message);}
 const r=await env.DB.prepare("INSERT INTO settings(key,data,revision) VALUES ('modes',?,1) ON CONFLICT(key) DO UPDATE SET data=excluded.data,revision=settings.revision+1 WHERE settings.revision=?").bind(JSON.stringify(modes),b.revision).run();if(!r.meta.changes)return error('Режимы изменены. Обнови страницу.',409);return json({modes,revision:old.revision+1});
}



function normalizeAnswer(value){return typeof value==='string'?value.normalize('NFKC').toLocaleLowerCase('ru-RU').replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';}
function isCorrect(q,value){if(typeof value!=='string')return false;if(q.options.length)return value===q.answer;const normalized=normalizeAnswer(value);return !!normalized&&[q.answer,...(q.acceptedAnswers||[])].some(a=>normalizeAnswer(a)===normalized);}
function validAnswer(q,value){return value===null||(typeof value==='string'&&(q.options.length?q.options.includes(value):value.length<=300&&!!normalizeAnswer(value)));}


async function loadQuestions(env,all=false){const rows=await env.DB.prepare('SELECT * FROM questions ORDER BY updated_at,id').all();const map=new Map(bank.map(q=>[q.id,{...q,enabled:true,revision:0}]));for(const r of rows.results)map.set(r.id,{...JSON.parse(r.data),id:r.id,enabled:!!r.enabled,revision:r.revision});return [...map.values()].filter(q=>all||q.enabled);}
function validateQuestion(input,id){if(!input||typeof input!=='object')throw Error('Неверные данные вопроса.');const text=(key,max,required=false)=>{const v=typeof input[key]==='string'?input[key].trim():'';if(v.length>max||(required&&!v))throw Error('Заполни поле «'+({prompt:'Вопрос',topic:'Название мема',explanation:'Объяснение'}[key]||key)+'» (до '+max+' символов).');return v;};
 const options=Array.isArray(input.options)?input.options.map(v=>typeof v==='string'?v.trim():''):null;if(!options||options.length>10||options.some(v=>!v||v.length>300)||new Set(options).size!==options.length)throw Error('Добавь от 1 до 10 разных вариантов или выбери письменный ответ.');const answer=typeof input.answer==='string'?input.answer.trim():'';if(!answer||answer.length>300||(options.length&&!options.includes(answer)))throw Error('Укажи правильный ответ (до 300 символов).');let acceptedAnswers=[];if(!options.length){if(!normalizeAnswer(answer))throw Error('Ответ должен содержать буквы или цифры.');const aliases=input.acceptedAnswers||[];if(!Array.isArray(aliases)||aliases.length>20||aliases.some(a=>typeof a!=='string'||a.length>300||!normalizeAnswer(a)))throw Error('Допустимо до 20 дополнительных написаний ответа, каждое до 300 символов.');acceptedAnswers=[...new Set(aliases.map(a=>a.trim()))];}if(!Number.isInteger(input.year)||input.year<2021||input.year>2026)throw Error('Год должен быть от 2021 до 2026.');if(![1,2,3].includes(input.level))throw Error('Выбери сложность.');
 const urls=(key)=>{const a=input[key]||[];if(!Array.isArray(a)||a.length>8||a.some(u=>typeof u!=='string'||u.length>2048||!/^https?:\/\/[^\s]+$/i.test(u)))throw Error('Проверь ссылки: нужны адреса http или https (до 8).');return a;};const image=text('image',2048);if(image&&!/^https?:\/\/[^\s]+$/i.test(image)&&!/^assets\/[a-zA-Z0-9_.-]+$/.test(image))throw Error('Укажи прямую ссылку http/https на изображение или загрузи файл.');
 const credit=text('imageCredit',2048);if(credit&&!/^https?:\/\/[^\s]+$/i.test(credit))throw Error('Источник картинки должен быть ссылкой http или https.');
 return {id,topic:text('topic',160,true),prompt:text('prompt',1200,true),year:input.year,level:input.level,kind:text('kind',80)||'Знаток',options,answer,acceptedAnswers,explanation:text('explanation',4000,true),quote:text('quote',600),image:image||null,imageCredit:credit||null,sources:urls('sources'),media:urls('media')};}
async function boundedBytes(req,limit){const reader=req.body?.getReader();if(!reader)return null;const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return null;}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
async function cmsRoutes(req,env,p,isAdmin){
 if(p==='/api/questions'&&req.method==='GET')return json({questions:await loadQuestions(env),modes:(await loadModes(env)).modes.filter(m=>m.enabled)});
 const media=/^\/api\/images\/([a-f0-9-]{36}\.(?:png|jpg|webp))$/.exec(p);if(media&&req.method==='GET'){if(!env.BUCKET)return error('Хранилище изображений недоступно.',503);const object=await env.BUCKET.get('quiz/'+media[1]);if(!object)return error('Изображение не найдено.',404);return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}});}
 if(!p.startsWith('/api/admin/questions')&&p!=='/api/admin/images')return null;
 if(!isAdmin)return error('Доступ только для администратора.',403);
 if(req.method!=='GET'&&!validOrigin(req,env))return error('Редактор доступен только из админки.',403);
 if(p==='/api/admin/images'&&req.method==='POST'){
  if(!env.BUCKET)return error('Хранилище изображений недоступно.',503);const bytes=await boundedBytes(req,2*1024*1024);if(!bytes||bytes.length<12)return error('Нужен файл PNG, JPG или WebP размером до 2 МБ.');let type,extension;if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){type='image/jpeg';extension='jpg';}else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){type='image/png';extension='png';}else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){type='image/webp';extension='webp';}else return error('Формат не поддерживается. Выбери PNG, JPG или WebP.');
  const filename=crypto.randomUUID()+'.'+extension;await env.BUCKET.put('quiz/'+filename,bytes,{httpMetadata:{contentType:type}});return json({url:env.BUCKET.publicUrl?env.BUCKET.publicUrl('quiz/'+filename):new URL('/api/images/'+filename,req.url).href},201);
 }
 if(p==='/api/admin/questions'&&req.method==='GET')return json({questions:await loadQuestions(env,true)});
 const match=/^\/api\/admin\/questions\/([a-zA-Z0-9_-]{1,80})$/.exec(p);const creating=p==='/api/admin/questions'&&req.method==='POST';
 if(!creating&&!(match&&req.method==='PUT'))return error('Метод не поддерживается.',405);
 const b=await body(req),id=creating?'custom-'+crypto.randomUUID():match[1];const questions=await loadQuestions(env,true),existing=questions.find(q=>q.id===id);if(!creating&&!existing)return error('Вопрос не найден.',404);if(creating&&questions.length>=1000)return error('Достигнут лимит в 1000 вопросов.');const expected=existing?.revision||0;if(!creating&&b.revision!==expected)return error('Этот вопрос уже изменён. Вернись в список и открой его заново.',409);
 let q;try{q=validateQuestion(b,id);}catch(e){return error(e.message);}const enabled=b.enabled!==false;
 const result=await env.DB.prepare('INSERT INTO questions (id,data,enabled,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,enabled=excluded.enabled,revision=questions.revision+1,updated_at=excluded.updated_at WHERE questions.revision=?').bind(id,JSON.stringify(q),enabled?1:0,Date.now(),expected).run();if(!result.meta.changes)return error('Вопрос уже изменён. Открой его заново.',409);return json({...q,enabled,revision:expected+1},creating?201:200);
}


import bank from './bank.mjs';
import assets from './assets.mjs';
const byId=new Map(bank.map(q=>[q.id,q]));
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status=400)=>json({error:message},status);
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function mac(text,key){const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,encoder.encode(text)));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
async function admin(req,env){
 if(env.LOCAL_DEV&&env.ADMIN_EMAILS?.split(',').map(v=>v.trim().toLowerCase()).includes((req.headers.get('oai-authenticated-user-email')||'').toLowerCase()))return true;
 if(!env.ADMIN_SESSION_KEY)return false;
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||/(?:^|;\s*)tt_admin=([0-9]+\.[a-f0-9]{32}\.[a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];if(!token)return false;
 const [expires,nonce,signature]=token.split('.');if(Number(expires)<Date.now()||Number(expires)>Date.now()+13*3600000)return false;
 return equal(signature,await mac(expires+'.'+nonce,env.ADMIN_SESSION_KEY));
}
function validOrigin(req,env){const origin=req.headers.get('origin');return origin===new URL(req.url).origin||origin===env.FRONTEND_ORIGIN;}
async function authRoutes(req,env,path){
 if(path==='/api/auth/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':'tt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
 if(path!=='/api/auth/login'||req.method!=='POST')return null;
 if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_PASSWORD_SALT||!env.ADMIN_SESSION_KEY)return error('Вход администратора ещё не настроен.',503);
 const ip=req.headers.get('cf-connecting-ip')||'unknown',key=await mac('login:'+ip,env.ADMIN_SESSION_KEY),now=Date.now();
 await env.DB.prepare('INSERT INTO auth_rate (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate.expires_at<? THEN 1 ELSE auth_rate.count+1 END, expires_at=CASE WHEN auth_rate.expires_at<? THEN excluded.expires_at ELSE auth_rate.expires_at END').bind(key,now+900000,now,now).run();
 const rate=await env.DB.prepare('SELECT count FROM auth_rate WHERE key=?').bind(key).first();if(rate.count>8)return error('Слишком много попыток входа. Подожди 15 минут.',429);
 const b=await body(req);if(typeof b.password!=='string'||b.password.length>128)return error('Неверный пароль.',401);
 if(!equal(await passwordHash(b.password,env.ADMIN_PASSWORD_SALT),env.ADMIN_PASSWORD_HASH))return error('Неверный пароль.',401);
 const payload=(now+12*3600000)+'.'+crypto.randomUUID().replaceAll('-',''),token=payload+'.'+await mac(payload,env.ADMIN_SESSION_KEY);
 return json({ok:true,token},200,{'Set-Cookie':`tt_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
}

function guest(req){const player=req.headers.get('x-player-token');if(/^[a-f0-9-]{36}$/.test(player||''))return player;return /(?:^|;\s*)tt_player=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];}
function summary(row){const {owner,question_ids,question_snapshot,answers,years,...rest}=row;return {...rest,years:JSON.parse(years)};}
async function body(req){if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Требуется JSON.');if(Number(req.headers.get('content-length')||0)>512000)throw Error('Запрос слишком большой.');const text=await req.text();if(text.length>512000)throw Error('Запрос слишком большой.');return JSON.parse(text);}
function score(ids,answers,map=byId){let points=0,max=0,correct=0;for(const id of ids){const q=map.get(id);max+=q.level;if(isCorrect(q,answers[id])){points+=q.level;correct++;}}return {points,max,correct,percent:Math.round(points/max*100),answered:Object.keys(answers).length};}
export async function handle(req,env){const url=new URL(req.url),p=url.pathname;const isAdmin=await admin(req,env);
 if(p==='/api/me')return json({isAdmin,tracking:true});
 if(p.startsWith('/api/')){
  if(!env.DB)return error('База результатов временно недоступна.',503);
  if(!['GET','HEAD'].includes(req.method)&&!validOrigin(req,env))return error('Недопустимый источник запроса.',403);
  const auth=await authRoutes(req,env,p);if(auth)return auth;
  const modes=await modeRoutes(req,env,p,isAdmin);if(modes)return modes;
  const cms=await cmsRoutes(req,env,p,isAdmin);if(cms)return cms;
  if(p==='/api/attempts'&&req.method==='POST'){
   const b=await body(req);const nickname=typeof b.nickname==='string'?b.nickname.trim():'';
   if(nickname.length<2||nickname.length>40||/[\x00-\x1f]/.test(nickname))return error('Ник должен содержать от 2 до 40 символов.');
   if(b.consent!==true)return error('Нужно согласие на сохранение результата.');
   const current=await loadQuestions(env),active=new Map(current.map(q=>[q.id,q]));const ids=b.ids;if(!Array.isArray(ids)||ids.length<1||ids.length>1000||new Set(ids).size!==ids.length||ids.some(id=>!active.has(id)))return error('Неверный набор вопросов.');
   if(b.revisions&&ids.some(id=>b.revisions[id]!==active.get(id).revision))return error('Автор изменил вопросы. Обнови страницу и начни заново.',409);
   let modeName=null;if(b.modeId){const m=(await loadModes(env)).modes.find(m=>m.id===b.modeId&&m.enabled);const years=b.years;if(!Array.isArray(years)||!years.length||years.some(y=>!Number.isInteger(y)||y<2021||y>2026))return error('Проверь годы.');const pool=modePool(m,current,years);if(!m||ids.length!==modeCount(m,pool)||ids.some(id=>!pool.some(q=>q.id===id)))return error('Состав режима изменён. Обнови страницу.',409);modeName=m.name;}
   const snapshot=ids.map(id=>active.get(id));const owner=guest(req)||crypto.randomUUID(),now=Date.now();const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE owner=? AND started_at>?').bind(owner,now-3600000).first();if(recent.n>=20)return error('Слишком много попыток. Попробуй через час.',429);
   const id=crypto.randomUUID(),max=ids.reduce((s,id)=>s+active.get(id).level,0),years=[...new Set(ids.map(id=>active.get(id).year))].sort();
   await env.DB.prepare('INSERT INTO attempts (id,owner,nickname,started_at,updated_at,question_ids,answers,years,total,max_points,question_snapshot,mode_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,nickname,now,now,JSON.stringify(ids),'{}',JSON.stringify(years),ids.length,max,JSON.stringify(snapshot),modeName).run();
   return json({id,startedAt:now},201,{'Set-Cookie':`tt_player=${owner}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`});
  }
  const match=/^\/api\/attempts\/([a-f0-9-]{36})$/.exec(p);
  if(match&&req.method==='PUT'){
   const row=await env.DB.prepare('SELECT * FROM attempts WHERE id=? AND owner=?').bind(match[1],guest(req)||'').first();if(!row)return error('Попытка не найдена в этом браузере.',404);
   const map=row.question_snapshot?new Map(JSON.parse(row.question_snapshot).map(q=>[q.id,q])):byId;const b=await body(req),ids=JSON.parse(row.question_ids),old=JSON.parse(row.answers),answers=b.answers;
   if(!answers||Array.isArray(answers)||typeof answers!=='object'||Object.keys(answers).some(id=>!ids.includes(id)))return error('Неверные ответы.');
   if(Object.entries(old).some(([id,a])=>answers[id]!==a))return error('Сохранённый ответ нельзя заменить.',409);
   const count=Object.keys(answers).length;if(!ids.slice(0,count).every(id=>Object.hasOwn(answers,id)))return error('Ответы должны идти по порядку.');
   if(Object.entries(answers).some(([id,a])=>!validAnswer(map.get(id),a)))return error('Неизвестный вариант ответа.');
   if(b.finished===true&&count!==ids.length)return error('Есть неотвеченные вопросы.');
   const s=score(ids,answers,map),finished=row.finished_at||(b.finished===true?Date.now():null);
   const result=await env.DB.prepare('UPDATE attempts SET answers=?,answered=?,correct=?,points=?,percent=?,updated_at=?,finished_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(answers),s.answered,s.correct,s.points,s.percent,Date.now(),finished,row.id,row.revision).run();
   if(!result.meta.changes)return error('Попытка обновлена в другой вкладке. Повтори сохранение.',409);
   return json({saved:true,finished:!!finished,...s});
  }
  if(p.startsWith('/api/admin')){
   if(!isAdmin)return error('Доступ только для администратора.',403);
   if(req.method!=='GET')return error('Метод не поддерживается.',405);
   if(p==='/api/admin/stats'){
    const totals=await env.DB.prepare('SELECT COUNT(*) total, SUM(CASE WHEN finished_at IS NOT NULL THEN 1 ELSE 0 END) finished, ROUND(AVG(CASE WHEN finished_at IS NOT NULL THEN percent END),1) average, COUNT(DISTINCT nickname) nicknames FROM attempts').first();
    return json(totals);
   }
   if(p==='/api/admin/attempts'){
    const search=(url.searchParams.get('q')||'').trim().slice(0,40),state=url.searchParams.get('state'),offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
    const where=['nickname LIKE ?'];const args=['%'+search.replace(/[\\%_]/g,'\\$&')+'%'];where[0]+=" ESCAPE '\\'";
    if(state==='finished')where.push('finished_at IS NOT NULL');if(state==='active')where.push('finished_at IS NULL');
    const clause=where.join(' AND '),n=await env.DB.prepare('SELECT COUNT(*) n FROM attempts WHERE '+clause).bind(...args).first();
    const rows=await env.DB.prepare('SELECT * FROM attempts WHERE '+clause+' ORDER BY started_at DESC,id DESC LIMIT 30 OFFSET ?').bind(...args,offset).all();return json({items:rows.results.map(summary),total:n.n,offset});
   }
   const detail=/^\/api\/admin\/attempts\/([a-f0-9-]{36})$/.exec(p);if(detail){const row=await env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(detail[1]).first();if(!row)return error('Попытка не найдена.',404);const map=row.question_snapshot?new Map(JSON.parse(row.question_snapshot).map(q=>[q.id,q])):byId;const answers=JSON.parse(row.answers);return json({...summary(row),questions:JSON.parse(row.question_ids).map(id=>{const q=map.get(id);return {id,prompt:q.prompt,year:q.year,answer:q.answer,chosen:answers[id],answered:Object.hasOwn(answers,id),correct:isCorrect(q,answers[id]),sources:q.sources};})});}
   return error('Не найдено.',404);
  }
  return error('Не найдено.',404);
 }
 if(!['GET','HEAD'].includes(req.method))return error('Метод не поддерживается.',405);
 let file=p==='/'?'/index.html':p==='/archive/'?'/archive/index.html':(p==='/admin'||p==='/admin/')?'/admin.html':p;try{file=decodeURIComponent(file);}catch{return error('Неверный адрес.',400);}const asset=assets[file];if(!asset)return new Response('Не найдено',{status:404});
 const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));return new Response(req.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"}});
}
export default {async fetch(req,env){const origin=req.headers.get('origin'),allowed=origin===env.FRONTEND_ORIGIN;let response;
 if(req.method==='OPTIONS'){response=allowed?new Response(null,{status:204}):error('Источник не разрешён.',403);}else{try{response=await handle(req,env);}catch(e){console.error('Ошибка запроса',e?.message);response=error('Не удалось обработать запрос. Повтори позже.',500);}}
 if(allowed&&new URL(req.url).pathname.startsWith('/api/')){const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,X-Player-Token,Authorization');headers.set('Vary','Origin');response=new Response(response.body,{status:response.status,headers});}return response;}};


