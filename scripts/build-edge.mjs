const clips=(await (await import('node:fs/promises')).readFile('worker/clips.mjs','utf8')).replaceAll('export ','');
const heroDefaults=(await import('../web/hero.mjs')).defaultHeroImages;
const appearance=(await (await import('node:fs/promises')).readFile('worker/appearance.mjs','utf8')).replace("import {defaultHeroImages} from '../web/hero.mjs';",'const defaultHeroImages='+JSON.stringify(heroDefaults)+';').replaceAll('export ','');
const players=(await (await import('node:fs/promises')).readFile('worker/players.mjs','utf8')).replaceAll('export ','');
import {readFile,writeFile} from 'node:fs/promises';
const bank=JSON.parse(await readFile('web/questions.json','utf8'));
const api=(await readFile('worker/index.mjs','utf8')).replace("import {clipRoutes,resolveQuestionClip} from './clips.mjs';",()=>clips).replace("import {playerRoutes,playerAccount,publicBoard,prepareRanking} from './players.mjs';",()=>players).replace("import {loadAppearance,appearanceRoutes} from './appearance.mjs';",()=>appearance).replace("import bank from './bank.mjs';",'const bank='+JSON.stringify(bank)+';').replace("import assets from './assets.mjs';",'const assets={};');
await writeFile('supabase/functions/quiz-api/api.mjs',api);
console.log('Supabase API собран из worker/index.mjs.');
