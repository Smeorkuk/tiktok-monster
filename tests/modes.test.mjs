import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import worker from '../dist/server/index.js';import {database} from '../scripts/sqlite.mjs';import {modePool,modeCount} from '../web/modes.mjs';
const DB=database();for(const f of ['0000_attempts','0001_auth_rate','0002_question_editor','0003_modes'])DB.exec(readFileSync('drizzle/'+f+'.sql','utf8'));const env={DB,LOCAL_DEV:true,ADMIN_EMAILS:'owner@test.invalid'};
async function call(path,method='GET',data,owner=false){return worker.fetch(new Request('https://quiz.test'+path,{method,headers:{Origin:'https://quiz.test','Content-Type':'application/json',...(owner?{'oai-authenticated-user-email':'owner@test.invalid'}:{})},body:data?JSON.stringify(data):undefined}),env);}
test('Режимы: закрытая запись, ручной состав, ревизии и серверная проверка попытки',async()=>{
 assert.equal((await call('/api/admin/modes')).status,403);
 const bank=(await(await call('/api/questions')).json()).questions;
 const original=await(await call('/api/admin/modes','GET',undefined,true)).json();
 const modes=[{id:'custom',name:'Моя подборка',description:'Только выбранные',count:0,selection:'manual',questionIds:bank.slice(0,2).map(q=>q.id),enabled:true},{id:'hidden',name:'Черновик',description:'',count:1,selection:'all',questionIds:[],enabled:false}];
 assert.equal((await call('/api/admin/modes','PUT',{modes,revision:original.revision},true)).status,200);
 assert.equal((await call('/api/admin/modes','PUT',{modes,revision:original.revision},true)).status,409);
 const visible=(await(await call('/api/modes')).json()).modes;assert.equal(visible.length,1);
 const pool=modePool(visible[0],bank);assert.equal(pool.length,2);assert.equal(modeCount(visible[0],pool),2);
 const payload={nickname:'Проверка режима',consent:true,modeId:'custom',years:[2021],ids:pool.map(q=>q.id)};
 assert.equal((await call('/api/attempts','POST',payload)).status,201);
 assert.equal((await call('/api/attempts','POST',{...payload,ids:[bank[5].id,bank[6].id]})).status,409);
 assert.equal((await call('/api/attempts','POST',{...payload,ids:payload.ids.slice(0,1)})).status,409);
 assert.equal((await call('/api/attempts','POST',{...payload,modeId:'hidden'})).status,409);
 const archived=await(await call('/api/archive')).json();assert.equal(archived.questions.length,72);
});
