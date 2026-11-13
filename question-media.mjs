// Only the current question loads media. Re-rendering feedback must not restart it.
let active=null;
export function stopQuestionMedia(){if(!active)return;active.element.pause();active.element.removeAttribute('src');active.element.load();active=null;}
export function pauseQuestionMedia(){active?.element.pause();}
export function retainQuestionMedia(){if(!active)return null;const state={key:active.key,element:active.element,time:active.element.currentTime,playing:!active.element.paused,ended:active.element.ended};active.element.pause();return state;}

export function mountQuestionMedia(host,clip,key,previous=null){
 if(!host||!clip){stopQuestionMedia();return;}
 const same=previous?.key===key;
 if(active&&!same)stopQuestionMedia();
 const element=same?previous.element:document.createElement(clip.type==='video'?'video':'audio');
 const video=clip.type==='video';element.preload=video?'auto':'metadata';element.playsInline=true;element.className='question-clip';element.loop=false;
 if(!same){element.src=clip.url;element.controls=!video;}
 host.replaceChildren();const stage=document.createElement('div');stage.className='clip-stage'+(video?' is-video':'');stage.append(element);host.append(stage);
 const action=document.createElement('button');action.type='button';action.className='clip-overlay';action.hidden=true;stage.append(action);
 const status=document.createElement('p');status.className='clip-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);
 let ended=same&&previous.ended,syncMute=()=>{};
 const prompt=label=>{action.textContent=label;action.hidden=false;status.textContent=label;};
 const play=()=>{if(ended||element.ended){element.currentTime=0;ended=false;}action.hidden=true;status.textContent='';let promise;try{promise=element.play();}catch{prompt('Нажми, чтобы воспроизвести');return;}promise?.catch(async error=>{if(active?.element!==element)return;if(video&&error.name==='NotAllowedError'&&!element.muted){element.muted=true;syncMute();try{await element.play();if(active?.element===element)status.textContent='Видео играет без звука. Его можно включить кнопкой ниже.';}catch{if(active?.element===element)prompt('Нажми, чтобы воспроизвести');}}else prompt('Нажми, чтобы воспроизвести');});};
 element.onended=()=>{ended=true;if(video)prompt('↻ Нажми на видео, чтобы повторить');else status.textContent='Можно послушать ещё раз.';};
 element.onplay=()=>{action.hidden=true;status.textContent='';};
 element.onerror=()=>{action.hidden=true;status.textContent='Не удалось воспроизвести файл. Можно пропустить вопрос.';};
 if(video){element.tabIndex=0;element.setAttribute('role','button');element.setAttribute('aria-label','Видеофрагмент. После окончания нажми, чтобы повторить.');element.onclick=()=>{if(ended||element.ended||element.paused)play();};element.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(ended||element.paused)play();}};action.onclick=play;
  const mute=document.createElement('button');mute.type='button';mute.className='clip-sound';const updateMute=()=>{mute.textContent=element.muted?'Включить звук':'Выключить звук';mute.setAttribute('aria-pressed',String(element.muted));};syncMute=updateMute;updateMute();mute.onclick=()=>{element.muted=!element.muted;updateMute();};host.append(mute);
 }
 active={key,element};
 if(same){if(ended&&video)prompt('↻ Нажми на видео, чтобы повторить');else if(previous.playing)play();else if(video&&element.paused)prompt('Продолжить видео');}
 else if(video)play();
}
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseQuestionMedia();});
