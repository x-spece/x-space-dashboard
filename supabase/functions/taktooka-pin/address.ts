export function addressParts(data: any, road = '', nearby: any = null, point?: number[]) {
 const features = Array.isArray(data?.features) ? data.features : [];
 const props = features.find((f: any) => f?.properties?.feature_type === 'street')?.properties ?? features[0]?.properties ?? {};
 const context = props.context ?? {};
 const value = (type: string) => {
  const feature = features.find((f: any) => f?.properties?.feature_type === type)?.properties;
  const item = context[type];
  return clean(item?.name_preferred || item?.name || feature?.name_preferred || feature?.name);
 };
 const province = value('region') || value('place');
 const area = [...new Set([value('locality') || value('district'),value('neighborhood')].filter(Boolean))].join('، ');
 const streetFeature = features.find((f: any) => f?.properties?.feature_type === 'street');
 const xy = streetFeature?.geometry?.coordinates;
 const closeStreet = point && Array.isArray(xy) && xy.length === 2 && xy.every(Number.isFinite) &&
  Math.hypot((xy[1]-point[0])*111320,(xy[0]-point[1])*111320*Math.cos(point[0]*Math.PI/180)) <= 25;
 const street = clean(road) || (closeStreet ? clean(streetFeature?.properties?.name_preferred || streetFeature?.properties?.name) : '');
 const candidates = (Array.isArray(nearby?.features) ? nearby.features : []).map((f: any) => ({
  name: clean(f?.properties?.name_ar || f?.properties?.name),
  distance: f?.properties?.tilequery?.distance,
  layer: f?.properties?.tilequery?.layer,
 })).filter((p: any) => p.layer === 'poi_label' && p.name && Number.isFinite(p.distance) && p.distance >= 0 && p.distance <= 120 && p.name !== street)
 .sort((a: any,b: any) => a.distance-b.distance);
 const landmark = candidates[0]?.name || '';
 const parts = [...new Set([province, area, street].filter(Boolean))];
 const name = [...parts, ...(landmark && !parts.includes(landmark) ? [`قرب ${landmark}`] : [])].join('، ').slice(0,240);
 return {province, area, street, landmark, name};
}
function clean(value: unknown): string {return typeof value === 'string' ? value.trim().slice(0,100) : '';}
export function readAreaName(data: any): string {return addressParts(data).name;}
