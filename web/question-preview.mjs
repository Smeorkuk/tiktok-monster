import {renderQuestionCard} from './question-card.mjs?v=3.4.0';
import {normalizeAnswer,isCorrect} from './answers.mjs?v=3.4.0';
import {shuffle} from './engine.mjs?v=3.4.0';
import {mountQuestionMedia,retainQuestionMedia,stopQuestionMedia} from './question-media.mjs?v=3.4.0';

const root=document.querySelector('#question-preview');let q=null,opts=[],answered=false,chosen;
function render(reset=false){
 const previous=reset?null:retainQuestionMedia();if(reset)stopQuestionMedia();
 root.innerHTML='<section class="game"><div class="game-top"><div class="progress-meta"><b>01</b> / 1 <span aria-hidden="true">·</span> Предпросмотр</div><button class="text-btn" type="button" data-preview-reset>Начать сначала</button></div><div class="progress-track" role="progressbar" aria-label="Прогресс предпросмотра" aria-valuenow="'+(answered?1:0)+'" aria-valuemin="0" aria-valuemax="1"><div class="progress-fill" style="width:'+(answered?100:0)+'%"></div></div>'+renderQuestionCard({q,opts,chosen,answered,ok:isCorrect(q,chosen),nextLabel:'Проверить ещё раз'})+'<p class="game-under" role="status" id="preview-message">'+(!q.answer?'Правильный ответ ещё не задан в редакторе.':'Это предпросмотр. Ответ не попадёт в статистику.')+'</p></section>';
 mountQuestionMedia(root.querySelector('#question-media'),q.clip,'question-preview',previous);
}
function answer(value){if(answered)return;if(value!==null&&!q.answer){root.querySelector('#preview-message').textContent='Для проверки сначала укажи правильный ответ в редакторе.';return;}chosen=value;answered=true;render();}
function reset(){answered=false;chosen=undefined;render(true);}
window.addEventListener('message',event=>{
 if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='preview-question')return;
 const draft=event.data.question;if(!draft||typeof draft!=='object'||!Array.isArray(draft.options))return;
 q={...draft,prompt:draft.prompt?.trim()||'Текст вопроса появится здесь',kind:draft.kind?.trim()||'Знаток',explanation:draft.explanation?.trim()||'Здесь будет объяснение правильного ответа.',options:draft.options.map((v,i)=>v.trim()||'Вариант '+(i+1)),sources:draft.sources||[],media:draft.media||[]};opts=shuffle(q.options);reset();
});
root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||!q)return;if(b.hasAttribute('data-preview-reset')||b.dataset.action==='next')reset();else if(b.dataset.action==='skip')answer(null);else if(b.dataset.answer!==undefined)answer(opts[Number(b.dataset.answer)]);});
root.addEventListener('submit',event=>{if(event.target.id!=='text-answer-form')return;event.preventDefault();const value=event.target.elements.writtenAnswer.value.trim();if(!normalizeAnswer(value)){root.querySelector('#written-error').textContent='Введи ответ словами или цифрами.';return;}answer(value);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();window.parent.postMessage({type:'close-question-preview'},location.origin);return;}if(!q||event.repeat||event.ctrlKey||event.metaKey||event.altKey||document.activeElement?.closest('.question-media')||['INPUT','TEXTAREA','BUTTON','A','SUMMARY'].includes(document.activeElement?.tagName))return;const index=event.key==='0'?9:Number(event.key)-1;if(!answered&&/^[0-9]$/.test(event.key)&&index>=0&&index<opts.length){event.preventDefault();answer(opts[index]);}else if(answered&&event.key==='Enter'){event.preventDefault();reset();}});
window.addEventListener('pagehide',stopQuestionMedia);
