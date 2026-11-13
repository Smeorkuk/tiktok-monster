import {pauseQuestionMedia} from './question-media.mjs?v=3.4.0';

export function openQuestionPreview(question,returnFocus){
 pauseQuestionMedia();document.querySelectorAll('#ed-clip video,#ed-clip audio').forEach(el=>el.pause());
 const dialog=document.createElement('dialog');dialog.className='question-preview-dialog';dialog.setAttribute('aria-labelledby','question-preview-title');
 dialog.innerHTML='<div class="question-preview-toolbar"><div><h2 id="question-preview-title">Предпросмотр вопроса</h2><p>Текущие изменения из редактора. Ничего не сохраняется в вопрос или статистику.</p></div><button class="secondary" type="button" data-preview-close>Вернуться к редактору ×</button><div class="question-preview-sizes" role="group" aria-label="Размер предпросмотра"><button class="secondary" type="button" data-preview-size="wide" aria-pressed="true">По ширине окна</button><button class="secondary" type="button" data-preview-size="phone" aria-pressed="false">Телефон</button></div></div><div class="question-preview-stage"><iframe title="Вопрос глазами игрока" allow="autoplay"></iframe></div>';
 const frame=dialog.querySelector('iframe');frame.src=new URL('./question-preview.html',import.meta.url).href;
 frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'preview-question',question},location.origin));
 function size(value){dialog.dataset.size=value;for(const b of dialog.querySelectorAll('[data-preview-size]'))b.setAttribute('aria-pressed',String(b.dataset.previewSize===value));}
 size(matchMedia('(max-width:650px)').matches?'phone':'wide');
 dialog.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.hasAttribute('data-preview-close'))dialog.close();if(b?.dataset.previewSize)size(b.dataset.previewSize);});
 const closeMessage=event=>{if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='close-question-preview')dialog.close();};window.addEventListener('message',closeMessage);
 dialog.addEventListener('close',()=>{window.removeEventListener('message',closeMessage);frame.remove();dialog.remove();returnFocus?.focus();},{once:true});
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-preview-close]').focus();
}
