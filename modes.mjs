export const defaultModes=[
{id:'quick',name:'Быстрый скролл',description:'Проверить, в теме ли ты.',count:18,selection:'all',questionIds:[],enabled:true},
{id:'big',name:'Большой заход',description:'От базы до забытых мемов.',count:36,selection:'all',questionIds:[],enabled:true},
{id:'full',name:'Бездна рекомендаций',description:'Весь архив. Без сокращений.',count:0,selection:'all',questionIds:[],enabled:true}
];
export function modePool(mode,questions,years=[2021,2022,2023,2024,2025,2026]){return mode?questions.filter(q=>q.enabled!==false&&years.includes(q.year)&&(mode.selection==='all'||mode.questionIds.includes(q.id))):[];}
export function modeCount(mode,pool){return mode?Math.min(mode.count||pool.length,pool.length):0;}
