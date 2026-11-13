const PLAYER_SESSION_MS=30*24*3600000;
const playerDigest=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
async function playerPassword(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:600000,hash:'SHA-256'},key,256));}
function playerNickname(value){if(typeof value!=='string')throw Error('Укажи ник.');const name=value.normalize('NFKC').trim();if(!/^[\p{L}\p{N}_.-]{3,24}$/u.test(name))throw Error('Ник: 3–24 буквы, цифры, точки, дефисы или подчёркивания, без пробелов.');return {name,key:name.toLocaleLowerCase('ru-RU').replaceAll('ё','е')};}
function checkPlayerPassword(password){if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Пароль должен содержать от 8 до 128 символов.');}
async function playerLimit(req,env,kind,nickname='',limit=10){const now=Date.now(),ip=req.headers.get('cf-connecting-ip')||'unknown';for(const value of [kind+':ip:'+ip,...(nickname?[kind+':name:'+nickname]:[])]){const key='player:'+await playerDigest(value);await env.DB.prepare('INSERT INTO auth_rate (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate.expires_at<? THEN 1 ELSE auth_rate.count+1 END,expires_at=CASE WHEN auth_rate.expires_at<? THEN excluded.expires_at ELSE auth_rate.expires_at END').bind(key,now+900000,now,now).run();const rate=await env.DB.prepare('SELECT count FROM auth_rate WHERE key=?').bind(key).first();const threshold=value.startsWith(kind+':ip:')?(kind==='register'?30:60):limit;if(rate.count>threshold)return error('Слишком много попыток. Подожди 15 минут.',429);}return null;}
function publicAccount(row){return row?{id:row.id,nickname:row.nickname}:null;}
export async function playerAccount(req,env){const token=req.headers.get('x-account-token');if(!/^[a-f0-9]{64}$/.test(token||''))return null;return await env.DB.prepare('SELECT a.id,a.nickname FROM accounts a JOIN player_sessions s ON s.account_id=a.id AND s.auth_version=a.auth_version WHERE s.token_hash=? AND s.expires_at>?').bind(await playerDigest(token),Date.now()).first();}
async function playerSession(env,account){const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await env.DB.prepare('INSERT INTO player_sessions(token_hash,account_id,auth_version,created_at,expires_at) VALUES (?,?,?,?,?)').bind(await playerDigest(token),account.id,account.auth_version,Date.now(),Date.now()+PLAYER_SESSION_MS).run();return token;}
export async function playerRoutes(req,env,p){
 if(!p.startsWith('/api/account/'))return null;
 if(p==='/api/account/me'&&req.method==='GET'){const account=await playerAccount(req,env);if(account)await env.DB.prepare('UPDATE player_sessions SET expires_at=? WHERE token_hash=? AND expires_at<?').bind(Date.now()+PLAYER_SESSION_MS,await playerDigest(req.headers.get('x-account-token')),Date.now()+PLAYER_SESSION_MS-86400000).run();return json({account:publicAccount(account)});}
 if(req.method!=='POST')return error('Метод не поддерживается.',405);
 if(p==='/api/account/logout'){const token=req.headers.get('x-account-token');if(token)await env.DB.prepare('DELETE FROM player_sessions WHERE token_hash=?').bind(await playerDigest(token)).run();return json({ok:true});}
 if(!['/api/account/register','/api/account/login','/api/account/recover'].includes(p))return error('Не найдено.',404);
 const b=await body(req);let nick;try{nick=playerNickname(b.nickname);checkPlayerPassword(b.password);}catch(e){return error(e.message);}
 const rate=await playerLimit(req,env,p.split('/').pop(),nick.key,p.endsWith('register')?5:10);if(rate)return rate;
 if(p==='/api/account/register'){
  if(b.consent!==true)return error('Подтверди создание аккаунта и сохранение ника.');
  const existing=await env.DB.prepare('SELECT id FROM accounts WHERE nickname_key=?').bind(nick.key).first();if(existing)return error('Этот ник уже занят. Войди в свой аккаунт или выбери другой.',409);
  const account={id:crypto.randomUUID(),nickname:nick.name,auth_version:1},salt=crypto.randomUUID(),recoveryCode=crypto.randomUUID().replaceAll('-','');
  const inserted=await env.DB.prepare('INSERT INTO accounts(id,nickname,nickname_key,password_hash,password_salt,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(nickname_key) DO NOTHING').bind(account.id,nick.name,nick.key,await playerPassword(b.password,salt),salt,await playerDigest(recoveryCode),Date.now()).run();if(!inserted.meta.changes)return error('Этот ник уже занят.',409);
  return json({account:publicAccount(account),token:await playerSession(env,account),recoveryCode},201);
 }
 const account=await env.DB.prepare('SELECT * FROM accounts WHERE nickname_key=?').bind(nick.key).first();
 if(p==='/api/account/recover'){
  const code=typeof b.recoveryCode==='string'?b.recoveryCode.toLowerCase().replace(/[\s-]/g,''):'';
  if(!/^[a-f0-9]{32}$/.test(code)||!account||!equal(account.recovery_hash,await playerDigest(code)))return error('Неверный ник или код восстановления.',401);
  const salt=crypto.randomUUID(),recoveryCode=crypto.randomUUID().replaceAll('-','');const updated=await env.DB.prepare('UPDATE accounts SET password_hash=?,password_salt=?,recovery_hash=?,auth_version=auth_version+1 WHERE id=? AND auth_version=?').bind(await playerPassword(b.password,salt),salt,await playerDigest(recoveryCode),account.id,account.auth_version).run();if(!updated.meta.changes)return error('Данные уже изменились. Повтори восстановление.',409);
  account.auth_version++;return json({account:publicAccount(account),token:await playerSession(env,account),recoveryCode});
 }
 const valid=equal(account?.password_hash||'0'.repeat(64),await playerPassword(b.password,account?.password_salt||'missing-account'));
 if(!account||!valid)return error('Неверный ник или пароль.',401);
 return json({account:publicAccount(account),token:await playerSession(env,account)});
}
export async function prepareRanking(env,modeId,questions){const m=(await loadModes(env)).modes.find(m=>m.id===modeId&&m.enabled);if(!m)return null;const pool=modePool(m,questions);return {mode:m,key:await playerDigest(JSON.stringify({id:m.id,count:m.count,selection:m.selection,pool:pool.map(q=>[q.id,q.revision||0,q.level]).sort((a,b)=>a[0].localeCompare(b[0]))}))};}
export async function publicBoard(req,env){const url=new URL(req.url),modes=(await loadModes(env)).modes.filter(m=>m.enabled);const modeId=url.searchParams.get('mode')||modes[0]?.id;const ranking=await prepareRanking(env,modeId,await loadQuestions(env));
 const stats=await env.DB.prepare('SELECT COUNT(*) AS attempts,COUNT(DISTINCT account_id) AS players,ROUND(AVG(percent),1) AS average FROM attempts WHERE finished_at IS NOT NULL AND deleted_at IS NULL').first();
 if(!ranking)return json({modes,items:[],stats,modeId:null});
 const rows=await env.DB.prepare(`SELECT nickname,percent,points,max_points,correct,total,duration,finished_at FROM (SELECT a.nickname,t.percent,t.points,t.max_points,t.correct,t.total,t.finished_at,t.finished_at-t.started_at AS duration,ROW_NUMBER() OVER (PARTITION BY t.account_id ORDER BY t.percent DESC,t.points DESC,(t.finished_at-t.started_at) ASC,t.finished_at ASC,t.id ASC) AS board_position FROM attempts t JOIN accounts a ON a.id=t.account_id WHERE t.board_key=? AND t.public_consent=1 AND t.finished_at IS NOT NULL AND t.deleted_at IS NULL) ranked WHERE board_position=1 ORDER BY percent DESC,points DESC,duration ASC,finished_at ASC,nickname ASC LIMIT 100`).bind(ranking.key).all();
 return json({modes,modeId,items:rows.results,stats,version:ranking.key.slice(0,10)});
}
