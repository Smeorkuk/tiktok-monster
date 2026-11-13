const players=(await (await import('node:fs/promises')).readFile('worker/players.mjs','utf8')).replaceAll('export ','');
import {readFile,writeFile} from 'node:fs/promises';
const bank=JSON.parse(await readFile('web/questions.json','utf8'));
const api=(await readFile('worker/index.mjs','utf8')).replace("import {playerRoutes,playerAccount,publicBoard,prepareRanking} from './players.mjs';",()=>players).replace("import bank from './bank.mjs';",'const bank='+JSON.stringify(bank)+';').replace("import assets from './assets.mjs';",'const assets={};');
await writeFile('supabase/functions/quiz-api/api.mjs',api);
console.log('Supabase API собран из worker/index.mjs.');
