import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
const assets={};
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.txt':'text/plain; charset=utf-8'};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else assets['/'+path.relative('web',p).split(path.sep).join('/')]=[mime[path.extname(p)]||'application/octet-stream',(await readFile(p)).toString('base64')];}}
await walk('web');await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const bank=JSON.parse(await readFile('web/questions.json','utf8'));const cms=(await readFile('worker/cms.mjs','utf8')).replaceAll('export ','');const code=(await readFile('worker/index.mjs','utf8')).replace("import {cmsRoutes,loadQuestions} from './cms.mjs';",()=>cms).replace("import bank from './bank.mjs';",'const bank='+JSON.stringify(bank)+';').replace("import assets from './assets.mjs';",'const assets='+JSON.stringify(assets)+';');
await writeFile('dist/server/index.js',code);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));console.log('Собран Worker: '+Object.keys(assets).length+' файлов, '+code.length+' символов.');
