import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pbkdf2Sync,createHash} from 'node:crypto';
import worker from '../dist/server/index.js';
import {database} from '../scripts/sqlite.mjs';
import {seedPlayer} from './fixture.mjs';

function fixture(){
 const DB=database();for(const f of ['0000_attempts','0001_auth_rate','0002_question_editor','0003_modes'])DB.exec(readFileSync('drizzle/'+f+'.sql','utf8'));
 const token=seedPlayer(DB),salt='security-test-only',password='disposable-test-password';
 const env={DB,FRONTEND_ORIGIN:'https://smeorkuk.github.io',ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex'),ADMIN_SESSION_KEY:'disposable-test-session-key'};
 const call=(path,method='GET',body,headers={})=>worker.fetch(new Request('https://quiz.test'+path,{method,headers:{origin:env.FRONTEND_ORIGIN,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined}),env);
 return {DB,token,password,call};
}

test('Выход администратора отзывает cookie и копию bearer-токена; другие сессии работают',async()=>{
 const {DB,password,call}=fixture();
 const first=await call('/api/auth/login','POST',{password},{'X-Session-Mode':'cookie'}),body=await first.json();
 assert.equal(first.status,200);assert(!('token' in body));
 const cookie=first.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=None','Partitioned'])assert(cookie.includes(flag));
 const value=cookie.split(';')[0],token=value.split('=')[1];
 assert.equal((await call('/api/admin/stats','GET',undefined,{cookie:'other=x; '+value})).status,200);
 const second=await call('/api/auth/login','POST',{password});const other=(await second.json()).token;
 assert.equal((await call('/api/auth/logout','POST',{}, {cookie:value})).status,200);
 assert.equal((await call('/api/admin/stats','GET',undefined,{cookie:value})).status,403);
 assert.equal((await call('/api/admin/stats','GET',undefined,{Authorization:'Bearer '+token})).status,403);
 assert.equal((await call('/api/admin/stats','GET',undefined,{Authorization:'Bearer '+other})).status,200);
 await DB.prepare('UPDATE admin_sessions SET expires_at=?').bind(Date.now()-1).run();
 assert.equal((await call('/api/admin/stats','GET',undefined,{Authorization:'Bearer '+other})).status,403);
 DB.close();
});

test('Лимит создания атомарен и сохраняется при смене браузерного ID',async()=>{
 const {DB,token,call}=fixture();const results=await Promise.all(Array.from({length:25},()=>call('/api/attempts','POST',{ids:['2021-001'],consent:true},{'X-Account-Token':token,'X-Player-Token':crypto.randomUUID()})));
 assert.equal(results.filter(r=>r.status===201).length,20);assert.equal(results.filter(r=>r.status===429).length,5);
 const row=await DB.prepare('SELECT COUNT(*) AS n FROM attempts').first();assert.equal(row.n,20);DB.close();
});

test('Cookie игрока продлевается, отзывается при выходе; CORS не раскрывает её чужому сайту',async()=>{
 const {DB,token,call}=fixture();
 const cookie='tt_account='+token,r=await call('/api/account/me','GET',undefined,{cookie,'X-Session-Mode':'cookie'}),b=await r.json();assert(b.account);assert(!('token' in b));assert(r.headers.get('set-cookie').includes('Max-Age=2592000'));
 assert.equal(r.headers.get('access-control-allow-credentials'),'true');assert.equal(r.headers.get('access-control-allow-origin'),'https://smeorkuk.github.io');
 const denied=await call('/api/account/logout','POST',{}, {cookie,origin:'https://evil.test'});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
 const out=await call('/api/account/logout','POST',{}, {cookie});assert(out.headers.get('set-cookie').includes('Max-Age=0'));assert.equal((await (await call('/api/account/me','GET',undefined,{cookie})).json()).account,null);DB.close();
});

test('Сервер выбирает состав; каталог и непройденные вопросы не раскрывают ответы',async()=>{
 const {DB,token,call}=fixture(),headers={'X-Account-Token':token};
 for(const path of ['/api/questions','/api/archive']){const data=await (await call(path)).json();for(const q of data.questions)for(const key of ['answer','acceptedAnswers','explanation','topic','sources','media'])assert(!(key in q));}
 const mode=(await (await call('/api/modes')).json()).modes[0];
 const started=await call('/api/attempts','POST',{protocol:2,modeId:mode.id,years:[2021,2022,2023,2024,2025,2026],ids:['unknown-client-selected-question'],consent:true,publicConsent:true},headers);assert.equal(started.status,201);const attempt=await started.json();assert.equal(attempt.questions.length,mode.count);assert(attempt.questions.every(q=>!('answer' in q)));
 const before=await (await call('/api/attempts/'+attempt.id,'GET',undefined,headers)).json();assert(before.questions.every(q=>!('answer' in q)));const first=before.ids[0];
 const unknown=await call('/api/attempts/'+attempt.id,'GET',undefined,{'X-Account-Token':'b'.repeat(64)});assert.equal(unknown.status,404);
 const response=await call('/api/attempts/'+attempt.id,'PUT',{answers:{[first]:null}},headers);assert.equal(response.status,200);const feedback=await response.json();assert.equal(feedback.feedback.length,1);assert.equal(feedback.feedback[0].id,first);assert(feedback.feedback[0].answer);
 const after=await (await call('/api/attempts/'+attempt.id,'GET',undefined,headers)).json();assert(after.questions[0].answer);assert(after.questions.slice(1).every(q=>!('answer' in q)));
 assert.equal((await call('/api/attempts/'+attempt.id,'PUT',{answers:{[first]:feedback.feedback[0].answer}},headers)).status,409);
 const stored=await DB.prepare('SELECT board_key FROM attempts WHERE id=?').bind(attempt.id).first();assert(stored.board_key);DB.close();
});

test('Новый cookie-вход не отправляет токен JavaScript, но оставляет код восстановления',async()=>{
 const {DB,call}=fixture();const r=await call('/api/account/register','POST',{nickname:'CookiePlayer',password:'local-cookie-password',consent:true},{'X-Session-Mode':'cookie'}),b=await r.json();assert.equal(r.status,201);assert(b.recoveryCode);assert(!('token' in b));const cookie=r.headers.get('set-cookie').split(';')[0];assert((await (await call('/api/account/me','GET',undefined,{cookie})).json()).account);
 const hash=createHash('sha256').update(cookie.split('=')[1]).digest('hex');assert(await DB.prepare('SELECT token_hash FROM player_sessions WHERE token_hash=?').bind(hash).first());DB.close();
});
