import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import worker from '../dist/server/index.js';import {database} from '../scripts/sqlite.mjs';
const DB=database();for(const f of ['0000_attempts','0001_auth_rate','0002_question_editor','0003_modes','0004_accounts'])DB.exec(readFileSync('drizzle/'+f+'.sql','utf8'));const env={DB,LOCAL_DEV:true,ADMIN_EMAILS:'owner@test.invalid',FRONTEND_ORIGIN:'https://smeorkuk.github.io'};
async function call(path,{method='GET',body,token,admin=false,ip='192.0.2.8',origin='https://quiz.test'}={}){const r=await worker.fetch(new Request('https://quiz.test'+path,{method,headers:{origin,'Content-Type':'application/json','cf-connecting-ip':ip,...(token?{'X-Account-Token':token}:{}),...(admin?{'oai-authenticated-user-email':'owner@test.invalid'}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
const password='local-test-password-83';let user,second,code,attempt;
test('Аккаунт: уникальный ник, безопасная сессия, пароль и защита админки',async()=>{
 let r=await call('/api/account/register',{method:'POST',body:{nickname:'Игрок_Ёж',password,consent:true}});assert.equal(r.status,201);user=r.data;code=r.data.recoveryCode;assert(!('password_hash' in user.account));
 r=await call('/api/account/register',{method:'POST',body:{nickname:'ИГРОК_еж',password,consent:true}});assert.equal(r.status,409);
 assert.equal((await call('/api/account/login',{method:'POST',body:{nickname:'игрок_еж',password:'incorrect'}})).status,401);
 r=await call('/api/account/login',{method:'POST',body:{nickname:'игрок_еж',password}});assert.equal(r.status,200);second=r.data;
 assert.equal((await call('/api/account/me',{token:user.token})).data.account.nickname,'Игрок_Ёж');assert.equal((await call('/api/account/me',{token:second.token})).data.account.id,user.account.id);
 const stored=await DB.prepare('SELECT * FROM accounts WHERE id=?').bind(user.account.id).first();assert.notEqual(stored.password_hash,password);assert.notEqual(stored.recovery_hash,code);
 assert.equal((await call('/api/admin/stats',{token:user.token})).status,403);
 assert.equal((await call('/api/attempts',{method:'POST',body:{nickname:'ПоддельныйНик',consent:true,ids:['2021-001']}})).status,401);
});
test('Рейтинг: согласие, все годы, один лучший результат и корзина',async()=>{
 const bank=(await call('/api/questions')).data.questions;const modes=(await call('/api/modes')).data.modes;const mode=modes[0];const ids=bank.slice(0,mode.count).map(q=>q.id);const body={nickname:'ЧужойНик',modeId:mode.id,years:[2021,2022,2023,2024,2025,2026],ids,consent:true,publicConsent:true};
 let r=await call('/api/attempts',{method:'POST',token:user.token,body});assert.equal(r.status,201);attempt=r.data.id;
 const answers=Object.fromEntries(ids.map(id=>[id,bank.find(q=>q.id===id).answer]));assert.equal((await call('/api/attempts/'+attempt,{method:'PUT',token:user.token,body:{answers,finished:true}})).status,200);
 assert.equal((await call('/api/admin/attempts/'+attempt,{admin:true})).data.nickname,'Игрок_Ёж');
 let board=await call('/api/leaderboard');assert.equal(board.data.items.length,1);assert.equal(board.data.items[0].percent,100);assert(!('account_id' in board.data.items[0]));assert(!('id' in board.data.items[0]));
 r=await call('/api/attempts',{method:'POST',token:user.token,body:{...body,publicConsent:false}});await call('/api/attempts/'+r.data.id,{method:'PUT',token:user.token,body:{answers,finished:true}});assert.equal((await call('/api/leaderboard')).data.items.length,1);
 assert.equal((await call('/api/admin/attempts/'+attempt,{method:'DELETE',token:user.token})).status,403);
 assert.equal((await call('/api/admin/attempts/'+attempt,{method:'DELETE',admin:true})).status,200);assert.equal((await call('/api/leaderboard')).data.items.length,0);
 assert.equal((await call('/api/attempts/'+attempt,{method:'PUT',token:user.token,body:{answers,finished:true}})).status,410);
 assert.equal((await call('/api/admin/attempts?state=deleted',{admin:true})).data.total,1);
 await call('/api/admin/attempts/'+attempt+'/restore',{method:'POST',admin:true});assert.equal((await call('/api/leaderboard')).data.items.length,1);
 r=await call('/api/attempts',{method:'POST',token:user.token,body});await call('/api/attempts/'+r.data.id,{method:'PUT',token:user.token,body:{answers,finished:true}});assert.equal((await call('/api/leaderboard')).data.items.length,1);
 const opponent=(await call('/api/account/register',{method:'POST',body:{nickname:'OtherPlayer',password,consent:true},ip:'192.0.2.34'})).data;assert.equal((await call('/api/attempts/'+attempt,{method:'PUT',token:opponent.token,body:{answers,finished:true}})).status,404);
 // Changing a question starts a new comparable ranking; old attempts remain in private history.
 const q=(await call('/api/admin/questions',{admin:true})).data.questions[0];await call('/api/admin/questions/'+q.id,{method:'PUT',admin:true,body:{...q,prompt:q.prompt+'!'}});assert.equal((await call('/api/leaderboard')).data.items.length,0);
});
test('Сброс по коду отзывает старые входы, выдаёт новый код и сохраняет аккаунт',async()=>{
 assert.equal((await call('/api/account/recover',{method:'POST',body:{nickname:user.account.nickname,password:'new-test-password',recoveryCode:'0'.repeat(32)}})).status,401);
 let r=await call('/api/account/recover',{method:'POST',body:{nickname:user.account.nickname,password:'new-test-password',recoveryCode:code}});assert.equal(r.status,200);assert.equal(r.data.account.id,user.account.id);assert.notEqual(r.data.recoveryCode,code);
 assert.equal((await call('/api/account/me',{token:user.token})).data.account,null);assert.equal((await call('/api/account/me',{token:second.token})).data.account,null);
 assert.equal((await call('/api/account/login',{method:'POST',body:{nickname:user.account.nickname,password}})).status,401);
 assert.equal((await call('/api/account/login',{method:'POST',body:{nickname:user.account.nickname,password:'new-test-password'}})).status,200);
 assert.equal((await call('/api/account/recover',{method:'POST',body:{nickname:user.account.nickname,password:'next-password',recoveryCode:code}})).status,401);
 const token=r.data.token;await call('/api/account/logout',{method:'POST',token});assert.equal((await call('/api/account/me',{token})).data.account,null);
});
test('Сессия продлевается при использовании, истёкшая не проходит; CORS и лимит входа',async()=>{
 const r=await call('/api/account/login',{method:'POST',body:{nickname:user.account.nickname,password:'new-test-password'}});const token=r.data.token,hash=createHash('sha256').update(token).digest('hex');await DB.prepare('UPDATE player_sessions SET expires_at=? WHERE token_hash=?').bind(Date.now()+10000,hash).run();assert((await call('/api/account/me',{token})).data.account);assert((await DB.prepare('SELECT expires_at FROM player_sessions WHERE token_hash=?').bind(hash).first()).expires_at>Date.now()+20*86400000);
 await DB.prepare('UPDATE player_sessions SET expires_at=? WHERE token_hash=?').bind(Date.now()-1,hash).run();assert.equal((await call('/api/account/me',{token})).data.account,null);
 for(let i=0;i<10;i++)await call('/api/account/login',{method:'POST',body:{nickname:'NoSuchPlayer',password:'wrong-password'},ip:'192.0.2.99'});assert.equal((await call('/api/account/login',{method:'POST',body:{nickname:'NoSuchPlayer',password:'wrong-password'},ip:'192.0.2.99'})).status,429);
 const pre=await worker.fetch(new Request('https://quiz.test/api/account/login',{method:'OPTIONS',headers:{origin:env.FRONTEND_ORIGIN}}),env);assert.match(pre.headers.get('access-control-allow-headers'),/X-Account-Token/);assert.match(pre.headers.get('access-control-allow-methods'),/DELETE/);
});
