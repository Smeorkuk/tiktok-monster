// Inspect actual container timing instead of trusting file names or browser metadata.
export function inspectClip(bytes){
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=bytes.length;
 const text=(p,n)=>String.fromCharCode(...bytes.subarray(p,p+n));
 const invalid=()=>{throw Error('Не удалось проверить файл. Видео: обычный MP4; звук: MP3, M4A или WAV.');};
 const u32=(p,little=false)=>{if(p<0||p+4>size)invalid();return data.getUint32(p,little);};
 if(size>=12&&text(4,4)==='ftyp'){
  function boxes(start,end){const out=[];for(let p=start;p<end;){if(p+8>end)invalid();let length=u32(p),header=8;if(length===1){if(p+16>end)invalid();length=Number(data.getBigUint64(p+8));header=16;}if(length===0)length=end-p;if(!Number.isSafeInteger(length)||length<header||p+length>end)invalid();out.push({type:text(p+4,4),start:p+header,end:p+length});p+=length;}return out;}
  const top=boxes(0,size),movie=top.find(b=>b.type==='moov');if(!movie||top.some(b=>b.type==='moof')||!top.some(b=>b.type==='mdat'&&b.end>b.start))invalid();
  const children=b=>boxes(b.start,b.end),one=(b,t)=>children(b).find(c=>c.type===t);
  const timing=b=>{if(!b)invalid();const v=bytes[b.start];if(v!==0&&v!==1)invalid();const p=b.start+(v?20:12);if(p+(v?12:8)>b.end)invalid();const scale=u32(p),duration=v?Number(data.getBigUint64(p+4)):u32(p+4);if(!scale||!Number.isSafeInteger(duration)||!duration)invalid();return {scale,duration:duration/scale};};
  if(one(movie,'mvex'))invalid();const movieClock=timing(one(movie,'mvhd'));let duration=movieClock.duration,video=false,audio=false;
  for(const track of children(movie).filter(b=>b.type==='trak')){
   const media=one(track,'mdia');if(!media)invalid();const handler=one(media,'hdlr');if(!handler||handler.start+12>handler.end)invalid();const kind=text(handler.start+8,4);if(!['vide','soun'].includes(kind))continue;
   const clock=timing(one(media,'mdhd')),minf=one(media,'minf'),table=minf&&one(minf,'stbl'),stts=table&&one(table,'stts');if(!stts||stts.start+8>stts.end)invalid();const n=u32(stts.start+4);if(!n||stts.start+8+n*8!==stts.end)invalid();let ticks=0;for(let i=0;i<n;i++)ticks+=u32(stts.start+8+i*8)*u32(stts.start+12+i*8);if(!Number.isSafeInteger(ticks)||ticks<=0)invalid();
   let trackDuration=Math.max(clock.duration,ticks/clock.scale);const edits=one(track,'edts'),elst=edits&&one(edits,'elst');if(elst){const v=bytes[elst.start],width=v===0?12:v===1?20:0;if(!width||elst.start+8>elst.end)invalid();const count=u32(elst.start+4);if(!count||elst.start+8+count*width!==elst.end)invalid();let edited=0;for(let i=0;i<count;i++){const pos=elst.start+8+i*width,segment=v?Number(data.getBigUint64(pos)):u32(pos),offset=v?Number(data.getBigInt64(pos+8)):data.getInt32(pos+4),ratePos=pos+(v?16:8);if(data.getInt16(ratePos)!==1||data.getInt16(ratePos+2)!==0||offset< -1||!Number.isSafeInteger(segment))invalid();if(!Number.isSafeInteger(offset))invalid();edited+=segment/movieClock.scale;}trackDuration=edited;}
   duration=Math.max(duration,trackDuration);video ||=kind==='vide';audio ||=kind==='soun';
  }
  if(!video&&!audio)invalid();return {type:video?'video':'audio',mime:video?'video/mp4':'audio/mp4',extension:video?'mp4':'m4a',duration};
 }
 if(size>=44&&text(0,4)==='RIFF'&&text(8,4)==='WAVE'){
  let rate=0,audioBytes=0;for(let p=12;p+8<=size;){const n=u32(p+4,true);if(p+8+n>size)invalid();if(text(p,4)==='fmt '){if(n<16||data.getUint16(p+8,true)!==1)invalid();rate=u32(p+16,true);}if(text(p,4)==='data')audioBytes+=n;p+=8+n+(n%2);}
  if(!rate||!audioBytes)invalid();return {type:'audio',mime:'audio/wav',extension:'wav',duration:audioBytes/rate};
 }
 // MPEG Layer III: sum frame durations, including variable-bitrate streams.
 let p=0;if(size>=10&&text(0,3)==='ID3'){if([6,7,8,9].some(i=>bytes[i]&128))invalid();p=10+bytes[6]*2097152+bytes[7]*16384+bytes[8]*128+bytes[9]+((bytes[5]&16)?10:0);}
 let duration=0,frames=0;
 while(p+4<=size){
  if(text(p,3)==='TAG'&&size-p===128){p=size;break;}
  const h=u32(p),version=(h>>>19)&3,layer=(h>>>17)&3,bi=(h>>>12)&15,si=(h>>>10)&3;
  if((h>>>21)!==2047||version===1||layer!==1||bi===0||bi===15||si===3)invalid();
  const rate=[44100,48000,32000][si]/(version===3?1:version===2?2:4),bitrate=(version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bi]*1000;
  const length=Math.floor((version===3?144:72)*bitrate/rate)+((h>>>9)&1);if(p+length>size)invalid();duration+=(version===3?1152:576)/rate;p+=length;frames++;
 }
 if(!frames||p!==size)invalid();return {type:'audio',mime:'audio/mpeg',extension:'mp3',duration};
}

export async function resolveQuestionClip(env,input){
 if(input==null)return null;if(!input||typeof input!=='object'||!/^[a-f0-9-]{36}$/.test(input.id||''))throw Error('Выбери загруженный звук или видео.');
 const row=await env.DB.prepare('SELECT data FROM settings WHERE key=?').bind('clip:'+input.id).first();if(!row)throw Error('Вложение не найдено. Загрузи файл заново.');return JSON.parse(row.data);
}

export async function clipRoutes(req,env,p,isAdmin){
 if(p==='/api/admin/clips'){
  if(!isAdmin)return error('Доступ только для администратора.',403);if(req.method!=='POST')return error('Метод не поддерживается.',405);if(!env.BUCKET)return error('Хранилище недоступно.',503);
  const bytes=await boundedBytes(req,10*1024*1024);if(!bytes||bytes.length<12)return error('Нужен файл до 10 МБ.');let info;try{info=inspectClip(bytes);}catch(e){return error(e.message);}
  const max=info.type==='video'?10:30;if(!Number.isFinite(info.duration)||info.duration<=0||info.duration>max)return error(`${info.type==='video'?'Видео':'Звук'} длиннее ${max} секунд. Сначала обрежь файл.`);
  if(info.type==='audio'&&bytes.length>5*1024*1024)return error('Звук должен быть не больше 5 МБ.');
  const id=crypto.randomUUID(),filename=id+'.'+info.extension,key='quiz-media/'+filename;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:info.mime}});
  const clip={id,type:info.type,duration:info.duration,bytes:bytes.length,url:env.BUCKET.publicUrl?env.BUCKET.publicUrl(key):new URL('/api/clips/'+filename,req.url).href};
  await env.DB.prepare('INSERT INTO settings(key,data,revision) VALUES (?,?,1)').bind('clip:'+id,JSON.stringify(clip)).run();return json({clip},201);
 }
 const match=/^\/api\/clips\/([a-f0-9-]{36}\.(?:mp4|m4a|mp3|wav))$/.exec(p);if(!match||!['GET','HEAD'].includes(req.method))return null;if(!env.BUCKET)return error('Хранилище недоступно.',503);
 const object=await env.BUCKET.get('quiz-media/'+match[1]);if(!object)return error('Файл не найден.',404);const bytes=object.body instanceof Uint8Array?object.body:new Uint8Array(await new Response(object.body).arrayBuffer());
 const headers={'Content-Type':object.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Accept-Ranges':'bytes','Content-Length':String(bytes.length)};
 const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.get('range')||'');if(range){const start=Number(range[1]),end=Math.min(Number(range[2]||bytes.length-1),bytes.length-1);if(start>end||start>=bytes.length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.length}});headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=String(end-start+1);return new Response(req.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers});}
 return new Response(req.method==='HEAD'?null:bytes,{headers});
}
