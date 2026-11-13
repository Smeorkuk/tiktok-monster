import {cp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
const api='https://tiktok-monster-valuefinve.stripedshrew2.chatgpt.site';
await rm('pages',{recursive:true,force:true});await mkdir('pages',{recursive:true});await cp('web','pages',{recursive:true});
await writeFile('pages/index.html',(await readFile('pages/index.html','utf8')).replace('href="/admin"','href="'+api+'/admin"'));
await rm('pages/admin.html');await rm('pages/admin.mjs');await writeFile('pages/.nojekyll','');
await writeFile('pages/config.mjs',`export const apiBase=${JSON.stringify(api)};\nexport const adminUrl=apiBase+'/admin';\nexport function apiFetch(path,options={}){let token;try{token=localStorage.getItem('tt-player-token');if(!/^[a-f0-9-]{36}$/.test(token||'')){token=crypto.randomUUID();localStorage.setItem('tt-player-token',token);}}catch{}return fetch(apiBase+path,{...options,credentials:'omit',headers:{...options.headers,...(token?{'X-Player-Token':token}:{})}});}\n`);
console.log('Готова папка pages/ для GitHub Pages.');
