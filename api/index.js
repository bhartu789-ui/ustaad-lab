import {neon} from '@neondatabase/serverless';
import QRCode from 'qrcode';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const db=()=>neon(process.env.DATABASE_URL);
const configured=()=>Boolean(process.env.DATABASE_URL&&process.env.ADMIN_PASSWORD&&process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32);
const reply=(res,status,obj)=>res.status(status).json(obj);
const clean=(v,len=120)=>String(v??'').trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,len);
const eq=(a,b)=>{const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
const cookie=(value,age)=>'cp_session='+value+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+age;
function session(req){
 if(!configured())return false;
 const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('cp_session='))?.slice(11)||'';
 const parts=raw.split('.');
 if(parts.length!==2||!(/^\d{13}$/.test(parts[0]))||!(/^[0-9a-f]{64}$/.test(parts[1]))||Number(parts[0])<Date.now())return false;
 const expected=createHmac('sha256',process.env.SESSION_SECRET).update('certifypro.'+parts[0]).digest('hex');
 return eq(expected,parts[1]);
}
function date(v){
 if(!/^\d{4}-\d\d-\d\d$/.test(String(v)))return null;
 const d=new Date(v+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===v?v:null;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const action=clean(req.query?.action||'status',30);
 if(req.method==='GET'&&action==='status')return reply(res,200,{configured:configured(),authenticated:session(req)});
 if(req.method==='POST'&&action==='logout'){
  res.setHeader('Set-Cookie',cookie('',0));
  return reply(res,200,{ok:true});
 }
 if(!configured())return reply(res,503,{error:'Administrator has not configured this server.'});
 try{
  const sql=db();
  if(req.method==='POST'&&action==='login'){
   const ip=clean((req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0]);
   const hash=createHash('sha256').update(ip).digest('hex');
   const failed=await sql.query("SELECT COUNT(*)::int AS n FROM login_failures WHERE ip_hash=$1 AND created_at>NOW()-INTERVAL '15 minutes'",[hash]);
   if(failed[0].n>=8)return reply(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
   const pwd=String(req.body?.password||'');
   if(!pwd||!eq(pwd,process.env.ADMIN_PASSWORD)){
    await sql.query('INSERT INTO login_failures(ip_hash) VALUES ($1)',[hash]);
    return reply(res,401,{error:'Incorrect password.'});
   }
   const expiry=String(Date.now()+8*3600000);
   const signature=createHmac('sha256',process.env.SESSION_SECRET).update('certifypro.'+expiry).digest('hex');
   res.setHeader('Set-Cookie',cookie(expiry+'.'+signature,28800));
   return reply(res,200,{ok:true});
  }
  if(req.method==='GET'&&action==='verify'){
   const id=clean(req.query.id,32).toUpperCase();
   if(!/^CP-\d{4}-[A-F0-9]{12}$/.test(id))return reply(res,200,{status:'invalid'});
   const rows=await sql.query('SELECT id,student_name,course,school,cert_type,issue_date::text AS issue_date,revoked_at FROM certificates WHERE id=$1 LIMIT 1',[id]);
   if(!rows.length)return reply(res,200,{status:'invalid'});
   const {revoked_at,...certificate}=rows[0];
   return reply(res,200,{status:revoked_at?'revoked':'valid',certificate});
  }
  if(req.method==='GET'&&action==='qr'){
   const id=clean(req.query.id,32).toUpperCase();
   if(!/^CP-\d{4}-[A-F0-9]{12}$/.test(id))return reply(res,400,{error:'Invalid ID'});
   const host=(req.headers.host||'').toLowerCase();
   if(!/^[a-z0-9.-]+(:\d+)?$/.test(host))return reply(res,400,{error:'Invalid host'});
   const url='https://'+host+'/verify?id='+encodeURIComponent(id);
   res.setHeader('Content-Type','image/png');
   res.setHeader('Cache-Control','public, max-age=3600');
   return res.status(200).send(await QRCode.toBuffer(url,{type:'png',width:170,margin:1}));
  }
  if(!session(req))return reply(res,401,{error:'Administrator sign-in required.'});
  if(req.method==='GET'&&action==='list'){
   const items=await sql.query('SELECT id,student_name,course,school,cert_type,issue_date::text AS issue_date,template,detail,created_at::text AS created_at FROM certificates WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 100',[]);
   return reply(res,200,{items});
  }
  if(req.method==='POST'&&action==='issue'){
   const records=req.body?.records;
   if(!Array.isArray(records)||records.length<1||records.length>50)return reply(res,400,{error:'Submit 1–50 certificates per batch.'});
   const types=['Achievement','Completion','Participation','Appreciation'];
   const themes=['classic','emerald','royal','minimal'];
   const out=[];
   for(const r of records){
    const obj={student_name:clean(r.student_name,100),course:clean(r.course,120),school:clean(r.school,100),cert_type:clean(r.cert_type,32),issue_date:date(r.issue_date),detail:clean(r.detail,200),template:clean(r.template,16)};
    if(!obj.student_name||!obj.course||!obj.school||!obj.issue_date||!types.includes(obj.cert_type)||!themes.includes(obj.template))return reply(res,400,{error:'Invalid certificate data.'});
    out.push({id:'CP-'+new Date().getUTCFullYear()+'-'+randomBytes(6).toString('hex').toUpperCase(),...obj});
   }
   await sql.query('INSERT INTO certificates(id,student_name,course,school,cert_type,issue_date,detail,template) SELECT id,student_name,course,school,cert_type,issue_date::date,detail,template FROM jsonb_to_recordset($1::jsonb) AS x(id text,student_name text,course text,school text,cert_type text,issue_date text,detail text,template text)',[JSON.stringify(out)]);
   return reply(res,201,{records:out});
  }
  return reply(res,405,{error:'Method not supported'});
 }catch(err){console.error('CertifyPro server:',err.message);return reply(res,500,{error:'Database or server error.'});}
}
