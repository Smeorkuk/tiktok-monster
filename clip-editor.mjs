import {mountQuestionMedia,stopQuestionMedia} from './question-media.mjs?v=3.3.0';
import {adminFetch} from './config.mjs?v=3.3.0';

export function mountClipEditor(host,initial,onChange,onBusy){
 let clip=initial,objectUrl=null,disposed=false,uploading=false,controller=null;
 host.innerHTML='<fieldset><legend>Звук или видео в вопросе</legend><p class="admin-muted">Загрузи готовый фрагмент: видео MP4 — до 10 секунд и 10 МБ; звук MP3, M4A или WAV — до 30 секунд и 5 МБ. Ссылки на TikTok и YouTube ниже остаются источниками, а этот файл воспроизводится прямо в вопросе.</p><label>Выбрать файл<input type="file" accept="video/mp4,audio/mpeg,audio/mp4,audio/wav,.mp4,.m4a,.mp3,.wav" data-clip-file></label><p class="admin-muted">Видео запускается автоматически один раз. После окончания игрок повторяет его нажатием на видео. Звук запускается кнопкой.</p><div data-clip-preview></div><p data-clip-status role="status" aria-live="polite"></p><button class="text-btn" type="button" data-clip-remove>Убрать звук / видео</button></fieldset>';
 const input=host.querySelector('[data-clip-file]'),preview=host.querySelector('[data-clip-preview]'),status=host.querySelector('[data-clip-status]'),remove=host.querySelector('[data-clip-remove]');
 function render(){stopQuestionMedia();preview.replaceChildren();remove.hidden=!clip;if(!clip)return;const player=document.createElement(clip.type==='video'?'video':'audio');player.src=clip.url;player.controls=true;player.preload='metadata';player.playsInline=true;player.className='clip-preview';player.setAttribute('aria-label','Предпросмотр вложения');preview.append(player);const info=document.createElement('p');info.className='admin-muted';info.textContent=`${clip.type==='video'?'Видео':'Звук'} · ${clip.duration.toFixed(2)} с · ${(clip.bytes/1024/1024).toFixed(2)} МБ`;preview.append(info);const test=document.createElement('button');test.type='button';test.className='secondary';test.textContent='Проверить, как увидит игрок';test.onclick=()=>{player.pause();mountQuestionMedia(preview,clip,'preview:'+clip.id);};preview.append(test);}
 render();
 input.addEventListener('change',async()=>{
  const file=input.files[0];if(!file||uploading)return;
  const audio=file.type.startsWith('audio/')||/\.(mp3|m4a|wav)$/i.test(file.name),limit=audio?30:10,maxBytes=(audio?5:10)*1024*1024;
  if(file.size>maxBytes){status.textContent=`Файл больше ${audio?5:10} МБ. Уменьши его размер.`;input.value='';return;}
  uploading=true;input.disabled=remove.disabled=true;onBusy(true);status.textContent='Проверяем длительность…';
  try{
   objectUrl=URL.createObjectURL(file);const media=document.createElement(audio?'audio':'video');media.preload='metadata';media.src=objectUrl;
   const duration=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{media.removeAttribute('src');media.load();reject(Error('Не удалось прочитать файл. Выбери другой формат.'));},15000);media.onloadedmetadata=()=>{clearTimeout(timer);resolve(media.duration);};media.onerror=()=>{clearTimeout(timer);reject(Error('Браузер не смог открыть файл. Видео: MP4; звук: MP3, M4A или WAV.'));};});
   media.removeAttribute('src');media.load();URL.revokeObjectURL(objectUrl);objectUrl=null;
   if(!Number.isFinite(duration)||duration<=0||duration>limit)throw Error(`${audio?'Звук должен':'Видео должно'} быть не длиннее ${limit} секунд. Сначала обрежь файл.`);
   if(disposed)return;status.textContent='Загружаем файл…';controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);let response;
   try{response=await adminFetch('/api/admin/clips',{method:'POST',signal:controller.signal,headers:{'Content-Type':file.type||'application/octet-stream'},body:file});}finally{clearTimeout(timer);}
   const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось загрузить файл.');if(disposed)return;
   clip=data.clip;onChange(clip);render();status.textContent='Файл загружен. Нажми «Сохранить вопрос», чтобы применить вложение.';
  }catch(e){if(!disposed)status.textContent=e.name==='AbortError'?'Загрузка прервана. Попробуй ещё раз.':e.message;}
  finally{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}uploading=false;if(!disposed){input.disabled=remove.disabled=false;input.value='';onBusy(false);}}
 });
 remove.addEventListener('click',()=>{clip=null;onChange(null);render();status.textContent='Вложение убрано из вопроса. Сохрани изменения.';});
 return ()=>{disposed=true;controller?.abort();stopQuestionMedia();preview.querySelector('video,audio')?.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);};
}
