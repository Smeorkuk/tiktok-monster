import {cp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
await rm('pages',{recursive:true,force:true});await mkdir('pages',{recursive:true});await cp('web','pages',{recursive:true});
await mkdir('pages/admin',{recursive:true});
await writeFile('pages/admin/index.html',(await readFile('web/admin.html','utf8')).replace('<head>','<head><base href="../">'));
await writeFile('pages/.nojekyll','');
console.log('Готовы тест, админка и архив для GitHub Pages.');
