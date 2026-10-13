import {createClient} from 'npm:@supabase/supabase-js@2.95.3';
import {readSnap} from './snap.ts';
import {addressParts} from './address.ts';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status, headers: {...cors,'Content-Type':'application/json'}});
const calls = new Map<string, number[]>();
Deno.serve(async (req: Request) => {
 if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
 if (req.method !== 'POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
 try {
  const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i,'');
  const {data:{user},error} = await db.auth.getUser(token);
  if (error || !user) return reply({error:'AUTH_REQUIRED'},401);
  const [{data:profile},{data:config,error:configError}] = await Promise.all([db.from('tkt_profiles').select('blocked,captain').eq('user_id',user.id).maybeSingle(),db.rpc('tkt_route_config')]);
  if (!profile || profile.blocked || profile.captain) return reply({error:'RIDER_PROFILE_REQUIRED'},403);
  const body = await req.json();
  const point = body.point;
  const fast = body.fast === true;
  const addressOnly = body.address_only === true;
  if (!Array.isArray(point) || point.length !== 2 || !point.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) || point[0]<29 || point[0]>38 || point[1]<38 || point[1]>49) return reply({error:'INVALID_POINTS'},400);
  const now = Date.now(), recent = (calls.get(user.id) ?? []).filter(n => n > now-60000);
  if (recent.length >= 30) return reply({error:'RATE_LIMIT'},429);
  calls.set(user.id,[...recent, now]);
  if (calls.size > 2000) for (const [id,times] of calls) if (times.at(-1)! < now-60000) calls.delete(id);
  if (configError || !config?.mapbox_token) throw new Error('PIN_UNAVAILABLE');
  async function resolveAddress(location: number[], road = '') {
    const reverse = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
    reverse.search = new URLSearchParams({access_token:config.mapbox_token,longitude:String(location[1]),latitude:String(location[0]),language:'ar',types:'street,neighborhood,locality,place,district,region',permanent:'true'}).toString();
    const nearby = new URL(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${location[1]},${location[0]}.json`);
    nearby.search = new URLSearchParams({access_token:config.mapbox_token,radius:'120',limit:'30',layers:'poi_label'}).toString();
    const get = (url: URL) => fetch(url,{signal:AbortSignal.timeout(2500)}).then(r => r.ok ? r.json() : null).catch(() => null);
    const [area, landmarks] = await Promise.all([get(reverse),get(nearby)]);
    return addressParts(area, road, landmarks, location);
  }
  if (addressOnly) {
    const road = typeof body.street === 'string' ? body.street.slice(0,100) : '';
    return reply({point,...await resolveAddress(point,road)});
  }
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${point[1]},${point[0]};${point[1]},${point[0]+0.00001}`);
  url.search = new URLSearchParams({access_token:config.mapbox_token,radiuses:'75;75',overview:'false',steps:'true',exclude:'motorway,toll,ferry',alternatives:'false'}).toString();
  const response = await fetch(url,{signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('PIN_UNAVAILABLE');
  const snapped = readSnap(await response.json(), point);
  const street = snapped.name;
  if (fast) return reply({...snapped,street});
  return reply({...snapped,...await resolveAddress(snapped.point,street)});
 } catch { return reply({error:'PIN_UNAVAILABLE'},503); }
});
