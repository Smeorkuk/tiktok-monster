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
 if(env.ADMIN_EMAILS?.split(',').map(v=>v.trim().toLowerCase()).includes((req.headers.get('oai-authenticated-user-email')||'').toLowerCase()))return true;
 if(!env.ADMIN_SESSION_KEY)return false;
 const token=/(?:^|;\s*)tt_admin=([0-9]+\.[a-f0-9]{32}\.[a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];if(!token)return false;
 const [expires,nonce,signature]=token.split('.');if(Number(expires)<Date.now()||Number(expires)>Date.now()+13*3600000)return false;
 return equal(signature,await mac(expires+'.'+nonce,env.ADMIN_SESSION_KEY));
}
function validOrigin(req,env){const origin=req.headers.get('origin');return origin===new URL(req.url).origin||origin===env.FRONTEND_ORIGIN;}
async function authRoutes(req,env,path){
 if(path==='/api/auth/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':'tt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
 if(path!=='/api/auth/login'||req.method!=='POST')return null;
 if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_PASSWORD_SALT||!env.ADMIN_SESSION_KEY)return error('Вход администратора ещё не настроен.',503);
 const ip=req.headers.get('cf-connecting-ip')||'unknown',key=await mac('login:'+ip,env.ADMIN_SESSION_KEY),now=Date.now();
 await env.DB.prepare('INSERT INTO auth_rate (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END').bind(key,now+900000,now,now).run();
 const rate=await env.DB.prepare('SELECT count FROM auth_rate WHERE key=?').bind(key).first();if(rate.count>8)return error('Слишком много попыток входа. Подожди 15 минут.',429);
 const b=await body(req);if(typeof b.password!=='string'||b.password.length>128)return error('Неверный пароль.',401);
 if(!equal(await passwordHash(b.password,env.ADMIN_PASSWORD_SALT),env.ADMIN_PASSWORD_HASH))return error('Неверный пароль.',401);
 const payload=(now+12*3600000)+'.'+crypto.randomUUID().replaceAll('-',''),token=payload+'.'+await mac(payload,env.ADMIN_SESSION_KEY);
 return json({ok:true},200,{'Set-Cookie':`tt_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
}

function guest(req){const player=req.headers.get('x-player-token');if(/^[a-f0-9-]{36}$/.test(player||''))return player;return /(?:^|;\s*)tt_player=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];}
function summary(row){const {owner,question_ids,answers,years,...rest}=row;return {...rest,years:JSON.parse(years)};}
async function body(req){if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Требуется JSON.');if(Number(req.headers.get('content-length')||0)>30000)throw Error('Запрос слишком большой.');const text=await req.text();if(text.length>30000)throw Error('Запрос слишком большой.');return JSON.parse(text);}
function score(ids,answers){let points=0,max=0,correct=0;for(const id of ids){const q=byId.get(id);max+=q.level;if(answers[id]===q.answer){points+=q.level;correct++;}}return {points,max,correct,percent:Math.round(points/max*100),answered:Object.keys(answers).length};}
export async function handle(req,env){const url=new URL(req.url),p=url.pathname;const isAdmin=await admin(req,env);
 if(p==='/api/me')return json({isAdmin,tracking:true});
 if(p.startsWith('/api/')){
  if(!env.DB)return error('База результатов временно недоступна.',503);
  if(!['GET','HEAD'].includes(req.method)&&!validOrigin(req,env))return error('Недопустимый источник запроса.',403);
  const auth=await authRoutes(req,env,p);if(auth)return auth;
  if(p==='/api/attempts'&&req.method==='POST'){
   const b=await body(req);const nickname=typeof b.nickname==='string'?b.nickname.trim():'';
   if(nickname.length<2||nickname.length>40||/[\x00-\x1f]/.test(nickname))return error('Ник должен содержать от 2 до 40 символов.');
   if(b.consent!==true)return error('Нужно согласие на сохранение результата.');
   const ids=b.ids;if(!Array.isArray(ids)||ids.length<1||ids.length>72||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))return error('Неверный набор вопросов.');
   const owner=guest(req)||crypto.randomUUID(),now=Date.now();const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE owner=? AND started_at>?').bind(owner,now-3600000).first();if(recent.n>=20)return error('Слишком много попыток. Попробуй через час.',429);
   const id=crypto.randomUUID(),max=ids.reduce((s,id)=>s+byId.get(id).level,0),years=[...new Set(ids.map(id=>byId.get(id).year))].sort();
   await env.DB.prepare('INSERT INTO attempts (id,owner,nickname,started_at,updated_at,question_ids,answers,years,total,max_points) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,owner,nickname,now,now,JSON.stringify(ids),'{}',JSON.stringify(years),ids.length,max).run();
   return json({id,startedAt:now},201,{'Set-Cookie':`tt_player=${owner}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`});
  }
  const match=/^\/api\/attempts\/([a-f0-9-]{36})$/.exec(p);
  if(match&&req.method==='PUT'){
   const row=await env.DB.prepare('SELECT * FROM attempts WHERE id=? AND owner=?').bind(match[1],guest(req)||'').first();if(!row)return error('Попытка не найдена в этом браузере.',404);
   const b=await body(req),ids=JSON.parse(row.question_ids),old=JSON.parse(row.answers),answers=b.answers;
   if(!answers||Array.isArray(answers)||typeof answers!=='object'||Object.keys(answers).some(id=>!ids.includes(id)))return error('Неверные ответы.');
   if(Object.entries(old).some(([id,a])=>answers[id]!==a))return error('Сохранённый ответ нельзя заменить.',409);
   const count=Object.keys(answers).length;if(!ids.slice(0,count).every(id=>Object.hasOwn(answers,id)))return error('Ответы должны идти по порядку.');
   if(Object.entries(answers).some(([id,a])=>a!==null&&!byId.get(id).options.includes(a)))return error('Неизвестный вариант ответа.');
   if(b.finished===true&&count!==ids.length)return error('Есть неотвеченные вопросы.');
   const s=score(ids,answers),finished=row.finished_at||(b.finished===true?Date.now():null);
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
   const detail=/^\/api\/admin\/attempts\/([a-f0-9-]{36})$/.exec(p);if(detail){const row=await env.DB.prepare('SELECT * FROM attempts WHERE id=?').bind(detail[1]).first();if(!row)return error('Попытка не найдена.',404);const answers=JSON.parse(row.answers);return json({...summary(row),questions:JSON.parse(row.question_ids).map(id=>{const q=byId.get(id);return {id,prompt:q.prompt,year:q.year,answer:q.answer,chosen:answers[id],answered:Object.hasOwn(answers,id),correct:answers[id]===q.answer,sources:q.sources};})});}
   return error('Не найдено.',404);
  }
  return error('Не найдено.',404);
 }
 if(!['GET','HEAD'].includes(req.method))return error('Метод не поддерживается.',405);
 let file=p==='/'?'/index.html':p==='/admin'?'/admin.html':p;const asset=assets[file];if(!asset)return new Response('Не найдено',{status:404});
 const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));return new Response(req.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"}});
}
export default {async fetch(req,env){const origin=req.headers.get('origin'),allowed=origin===env.FRONTEND_ORIGIN;let response;
 if(req.method==='OPTIONS'){response=allowed?new Response(null,{status:204}):error('Источник не разрешён.',403);}else{try{response=await handle(req,env);}catch(e){console.error('Ошибка запроса',e?.message);response=error('Не удалось обработать запрос. Повтори позже.',500);}}
 if(allowed&&new URL(req.url).pathname.startsWith('/api/')){const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,X-Player-Token');headers.set('Vary','Origin');response=new Response(response.body,{status:response.status,headers});}return response;}};

