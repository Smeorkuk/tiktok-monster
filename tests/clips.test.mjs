import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';import {database} from '../scripts/sqlite.mjs';import {seedPlayer} from './fixture.mjs';import {inspectClip} from '../worker/clips.mjs';
const box=(type,...chunks)=>{const body=Buffer.concat(chunks),head=Buffer.alloc(8);head.writeUInt32BE(body.length+8);head.write(type,4);return Buffer.concat([head,body]);};
function mp4(seconds,{trackSeconds=seconds,audio=false,editSeconds=null}={}){const timing=Buffer.alloc(20);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(seconds*1000,16);const h=Buffer.alloc(12);h.write(audio?'soun':'vide',8);const samples=Buffer.alloc(16);samples.writeUInt32BE(1,4);samples.writeUInt32BE(1,8);samples.writeUInt32BE(trackSeconds*1000,12);return Buffer.concat([box('ftyp',Buffer.from('isom0000')),box('moov',box('mvhd',timing),box('trak',...(editSeconds===null?[]:[box('edts',(()=>{const e=Buffer.alloc(20);e.writeUInt32BE(1,4);e.writeUInt32BE(editSeconds*1000,8);e.writeInt16BE(1,16);return box('elst',e);})())]),box('mdia',box('mdhd',timing),box('hdlr',h),box('minf',box('stbl',box('stts',samples)))))),box('mdat',Buffer.from([1]))]);}
function wav(seconds){const b=Buffer.alloc(44+seconds*8000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(8000,28);b.writeUInt16LE(1,32);b.writeUInt16LE(8,34);b.write('data',36);b.writeUInt32LE(seconds*8000,40);return b;}
function fixture(){const DB=database();for(const f of ['0000_attempts','0001_auth_rate','0002_question_editor','0003_modes'])DB.exec(readFileSync('drizzle/'+f+'.sql','utf8'));const token=seedPlayer(DB),files=new Map(),env={DB,LOCAL_DEV:true,ADMIN_EMAILS:'owner@test.invalid',BUCKET:{async put(key,body,options){files.set(key,{body,httpMetadata:options.httpMetadata});},async get(key){return files.get(key);}}};const call=(path,{method='GET',body,admin=false,headers={}}={})=>worker.fetch(new Request('https://quiz.test'+path,{method,headers:{origin:'https://quiz.test','Content-Type':body instanceof Uint8Array?'application/octet-stream':'application/json','X-Account-Token':token,...(admin?{'oai-authenticated-user-email':'owner@test.invalid'}:{}),...headers},body:body?(body instanceof Uint8Array?body:JSON.stringify(body)):undefined}),env);return {DB,files,call};}

test('Реальная длительность MP4, M4A, WAV и MP3; повреждённые контейнеры не проходят',()=>{
 assert.equal(inspectClip(mp4(10)).duration,10);assert.equal(inspectClip(mp4(10,{trackSeconds:10.023,editSeconds:10})).duration,10);assert.equal(inspectClip(mp4(2,{trackSeconds:11})).duration,11);assert.equal(inspectClip(mp4(20,{audio:true})).type,'audio');assert.equal(inspectClip(wav(30)).duration,30);
 const frame=Buffer.alloc(417);frame.writeUInt32BE(0xfffb9000);assert.equal(inspectClip(frame).type,'audio');assert.throws(()=>inspectClip(Buffer.from('<svg>not audio</svg>')));assert.throws(()=>inspectClip(mp4(2).subarray(0,50)));const malformed=mp4(2);malformed.writeUInt32BE(0xffffffff,0);assert.throws(()=>inspectClip(malformed));
});

test('Загрузка только администратору: 10 секунд видео, 30 секунд звука, ограниченный размер',async()=>{
 const {DB,files,call}=fixture();assert.equal((await call('/api/admin/clips',{method:'POST',body:mp4(2)})).status,403);
 for(const body of [mp4(11),mp4(1,{trackSeconds:11}),wav(31),Buffer.from('<svg>fake.mp4</svg>'),Buffer.alloc(10*1024*1024+1)])assert.equal((await call('/api/admin/clips',{method:'POST',body,admin:true})).status,400);
 assert.equal(files.size,0);const r=await call('/api/admin/clips',{method:'POST',body:mp4(10),admin:true}),{clip}=await r.json();assert.equal(r.status,201);assert.equal(clip.type,'video');assert.equal(clip.duration,10);assert.equal(files.size,1);
 const audio=await call('/api/admin/clips',{method:'POST',body:wav(30),admin:true});assert.equal(audio.status,201);assert.equal((await audio.json()).clip.type,'audio');
 const media=await call(new URL(clip.url).pathname,{headers:{range:'bytes=0-15'}});assert.equal(media.status,206);assert.equal(media.headers.get('content-type'),'video/mp4');assert.equal((await media.arrayBuffer()).byteLength,16);DB.close();
});

test('Вопрос сохраняет проверенное вложение, публичный API и снимок попытки получают его без ответа',async()=>{
 const {DB,call}=fixture(),original=JSON.parse(readFileSync('web/questions.json','utf8'))[0];const {clip}=await (await call('/api/admin/clips',{method:'POST',body:mp4(2),admin:true})).json();
 let r=await call('/api/admin/questions',{method:'POST',admin:true,body:{...original,enabled:true,clip:{...clip,url:'https://evil.test/long-video.mp4',duration:999}}});assert.equal(r.status,201);const saved=await r.json();assert.deepEqual(saved.clip,clip);
 const catalog=await (await call('/api/questions')).json(),q=catalog.questions.find(q=>q.id===saved.id);assert.deepEqual(q.clip,clip);assert(!('answer'in q));
 r=await call('/api/attempts',{method:'POST',body:{ids:[saved.id],consent:true}});const attempt=await r.json();
 assert.equal((await call('/api/admin/questions/'+saved.id,{method:'PUT',admin:true,body:{...saved,clip:{id:crypto.randomUUID()}}})).status,400);
 r=await call('/api/admin/questions/'+saved.id,{method:'PUT',admin:true,body:{...saved,clip:null}});assert.equal((await r.json()).clip,null);
 const old=await (await call('/api/attempts/'+attempt.id)).json();assert.deepEqual(old.questions[0].clip,clip);DB.close();
});
