import test from 'node:test';import assert from 'node:assert/strict';
class Element{constructor(tag){this.tag=tag;this.children=[];this.paused=true;this.ended=false;this.currentTime=0;this.muted=false;this.plays=0;this.attributes={};}append(e){this.children.push(e);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this[k];}pause(){this.paused=true;}load(){}play(){this.plays++;if(this.blockSound&&!this.muted)return Promise.reject(Object.assign(Error(),{name:'NotAllowedError'}));this.paused=false;this.ended=false;this.onplay?.();return Promise.resolve();}}
let block=false;globalThis.document={hidden:false,addEventListener(){},createElement(tag){const el=new Element(tag);el.blockSound=block;return el;}};
const {mountQuestionMedia,retainQuestionMedia,stopQuestionMedia,pauseQuestionMedia}=await import('../web/question-media.mjs');
const clip={type:'video',url:'https://example.test/clip.mp4'};

test('Автозапуск один раз, повтор нажатием только после окончания, без цикла',()=>{
 const host=new Element('div');mountQuestionMedia(host,clip,'first');const video=host.children[0].children[0];assert.equal(video.plays,1);assert.equal(video.loop,false);video.onclick();assert.equal(video.plays,1);
 video.ended=true;video.paused=true;video.currentTime=2;video.onended();const overlay=host.children[0].children[1];assert(!overlay.hidden);video.onclick();assert.equal(video.plays,2);assert.equal(video.currentTime,0);assert(overlay.hidden);stopQuestionMedia();assert(video.paused);
});
test('Показ объяснения сохраняет позицию; звук не запускается сам; переход останавливает прежнее медиа',()=>{
 const host=new Element('div');mountQuestionMedia(host,clip,'second');const video=host.children[0].children[0];video.currentTime=1.2;const before=retainQuestionMedia();mountQuestionMedia(host,clip,'second',before);assert.equal(host.children[0].children[0],video);assert.equal(video.currentTime,1.2);
 pauseQuestionMedia();const paused=retainQuestionMedia(),n=video.plays;mountQuestionMedia(host,clip,'second',paused);assert.equal(video.plays,n);
 mountQuestionMedia(host,{type:'audio',url:'https://example.test/audio.mp3'},'third');const audio=host.children[0].children[0];assert(video.paused);assert.equal(audio.plays,0);assert(audio.controls);stopQuestionMedia();
});
test('Блокировка автозапуска со звуком даёт видео без звука и кнопку его включения',async()=>{
 block=true;const host=new Element('div');mountQuestionMedia(host,clip,'muted');await new Promise(resolve=>setImmediate(resolve));const video=host.children[0].children[0];assert(video.muted);assert(!video.paused);const mute=host.children[2];assert.equal(mute.textContent,'Включить звук');mute.onclick();assert(!video.muted);stopQuestionMedia();block=false;
});
