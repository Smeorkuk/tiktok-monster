import test from 'node:test';import assert from 'node:assert/strict';
import {renderQuestionCard} from '../web/question-card.mjs';
const base={prompt:'Кто это?',kind:'По картинке',level:1,year:2025,topic:'Тест',options:['Бен','Том'],answer:'Бен',explanation:'Это Бен.',sources:['https://example.org/'],media:[],image:'assets/hero-ben.webp'};
test('Общая карточка скрывает объяснение до ответа и блокирует варианты после выбора',()=>{
 const before=renderQuestionCard({q:base});assert(before.includes('Кто это?'));assert(before.includes('class="question-image"'));assert(!before.includes('Это Бен.'));assert(!before.includes('option correct'));
 const after=renderQuestionCard({q:base,answered:true,chosen:'Том',ok:false,nextLabel:'Проверить ещё раз'});assert(after.includes('option correct'));assert(after.includes('option wrong'));assert(after.includes('disabled'));assert(after.includes('Это Бен.'));assert(after.includes('Проверить ещё раз'));
});
test('Письменный ответ, видео и объяснение отображаются тем же компонентом',()=>{
 const q={...base,options:[],answer:'Меллстрой',clip:{type:'video',url:'https://example.org/clip.mp4'}};
 const before=renderQuestionCard({q});assert(before.includes('id="question-media"'));assert(before.includes('id="text-answer-form"'));assert(!before.includes('Меллстрой'));
 const after=renderQuestionCard({q,answered:true,chosen:'мелстрой',ok:false});assert(after.includes('Правильный ответ:'));assert(after.includes('Меллстрой'));
});
test('Несохранённый текст экранируется, опасные ссылки не становятся кликабельными',()=>{
 const html=renderQuestionCard({q:{...base,prompt:'<img src=x onerror=alert(1)>',explanation:'<script>bad()</script>',sources:['javascript:alert(1)','https://example.org/?x="'],media:['data:text/html,bad']},answered:true});assert(html.includes('&lt;img'));assert(!html.includes('<script>'));assert(!html.includes('href="javascript:'));assert(!html.includes('href="data:'));assert(html.includes('&quot;'));
});
