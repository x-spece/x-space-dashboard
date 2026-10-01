import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,phone text,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;create publication supabase_realtime;`);
for (const name of ['001_x_space.sql','003_dashboard.sql','003_dashboard.sql']) await db.exec(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[owner,'owner@example.com',other,'07700000001@gmail.com']);
await db.query('insert into x_admins(user_id) values($1)',[owner]);
await db.query('insert into x_profiles(user_id,phone,data) values($1,$2,$3)',[other,'07700000001',{name:'Test'}]);
async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
const test=(ok,msg)=>{if(!ok)throw new Error(msg);console.log('PASS '+msg)};
await actor(other);test((await db.query('select x_admin_access() a')).rows[0].a===false,'merchant denied admin access');
try{await db.query('select x_admin_notify(null,$1)',['test']);throw new Error('not denied')}catch(e){test(e.message.includes('للإدارة'),'merchant cannot broadcast')}
await actor(owner);test((await db.query('select x_admin_access() a')).rows[0].a===true,'owner admin access');
await db.query('select x_admin_notify(null,$1)',['Test notification']);test((await db.query('select * from x_notifications')).rows.length===1,'admin notification saved');
await db.query('insert into x_products(id,data,stock) values($1,$2,$3)',['new',{name:'test',baseCost:5000},5]);test((await db.query("select * from x_audit where action='insert:x_products'")).rows.length===1,'catalogue audit written');
await db.query('update x_settings set data=$1 where id=true',[{deliveryCost:5000}]);test((await db.query("select * from x_audit where action='update:x_settings'")).rows.length===1,'settings audit written');
await actor('','anon');try{await db.query('select x_admin_access()');throw new Error('not denied')}catch(e){test(e.message.includes('permission denied'),'anonymous access RPC denied')}
await db.close();
