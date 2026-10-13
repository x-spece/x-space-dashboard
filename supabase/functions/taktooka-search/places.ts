export function normalize(text: string): string {
 return text.toLowerCase().replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
}
export function readPlaces(data: any, provider: string) {
 return (Array.isArray(data?.features) ? data.features : []).flatMap((f: any) => {
  const p = f?.properties ?? {}, xy = f?.geometry?.coordinates;
  if (!Array.isArray(xy) || xy.length !== 2 || !xy.every(Number.isFinite) || xy[1]<29 || xy[1]>38 || xy[0]<38 || xy[0]>49) return [];
  if (provider === 'photon' && p.countrycode?.toLowerCase() !== 'iq') return [];
  const c = p.context ?? {};
  const title = p.name_preferred || p.name || p.street || p.city;
  if (typeof title !== 'string' || !title.trim()) return [];
  const parts = provider === 'photon' ? [p.state,p.city,p.district,p.street,title] : [c.region?.name,c.place?.name,c.locality?.name,c.neighborhood?.name,c.street?.name,title];
  const label = [...new Set(parts.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim()))].join('، ').slice(0,240);
  return [{label,point:[xy[1],xy[0]],title:title.trim(),provider}];
 });
}
export function rankPlaces(rows: any[], query: string, origin: number[]) {
 const q = normalize(query), words = q.split(' '), unique: any[] = [];
 const distance = (p: number[]) => Math.hypot((p[0]-origin[0])*111320,(p[1]-origin[1])*111320*Math.cos(origin[0]*Math.PI/180));
 const score = (r: any) => {
  const label = normalize(r.label), title = normalize(r.title);
  return (title===q ? 100 : title.startsWith(q) ? 70 : label.includes(q) ? 50 : 0) + words.filter(w=>label.includes(w)).length*10 - Math.min(distance(r.point)/10000,20);
 };
 rows.sort((a,b)=>score(b)-score(a));
 for (const row of rows) {
  if (unique.some(r=>normalize(r.title)===normalize(row.title) && Math.hypot(r.point[0]-row.point[0],r.point[1]-row.point[1])<0.001)) continue;
  unique.push(row);
 }
 return unique.slice(0,10);
}
