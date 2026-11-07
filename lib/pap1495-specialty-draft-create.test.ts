import test from 'node:test';
import assert from 'node:assert/strict';
import {HO_STAGING_HOSTNAME,decideHostBoundary} from './host-boundary';
import {parseHoSpecialtyV2Create,handleHoSpecialtyV2Create} from './ho-specialty-v2-create-facade';
import {readSpecialtyV2PathOptions,createSpecialtyV2Draft} from './ho-specialty-v2-reader';
import {BoApiError} from './bo-api-error';

const ids=[
 '01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c',
 '01a03c6e-cc58-7175-bec5-b518313a1584',
 '01a03c6e-cc58-78f3-aa4f-3e9b3ac2afe2',
 '01a03c6e-cc59-725c-a74b-efd1712cd555',
];
const codes=['little-piner-art','little-piner-piano','artchitect','pianohouse'];
const labels=['Little Piner Art','Little Piner Piano','Artchitect','PianoHouse'];
const paths=codes.map((code,i)=>({id:ids[i],code,label:labels[i]}));
const sid='01234567-89ab-7cde-8fab-0123456789ab';
const make=(body:unknown,method='POST')=>new Request('https://'+HO_STAGING_HOSTNAME+'/api/ho/learning/specialties',{
 method,headers:{host:HO_STAGING_HOSTNAME,origin:'https://'+HO_STAGING_HOSTNAME,
 'content-type':'application/json','idempotency-key':'specialty_create_0123456789'},
 ...(method==='POST'?{body:JSON.stringify(body)}:{}),
});

test('PAP-1495 Create: 3 fields only, trimmed name, empty description becomes null',()=>{
 assert.deepEqual(parseHoSpecialtyV2Create({name:'  Anime  ',pathProgramId:ids[0],description:''}),
 {name:'Anime',pathProgramId:ids[0],description:null});
 for(const body of [
  {name:'AB',pathProgramId:ids[0]},
  {name:'Anime',pathProgramId:'little-piner-art'},
  {name:'Anime',pathProgramId:ids[0],tags:[]},
  {name:'Anime',pathProgramId:ids[0],status:'DRAFT'},
  {name:'Anime',pathProgramId:ids[0],levels:[]},
  {name:'Anime',pathProgramId:ids[0],description:'x'.repeat(4001)},
 ])assert.equal(parseHoSpecialtyV2Create(body),null);
});
test('PAP-1495 Create: host boundary admits exact HO GET/POST without other surface leakage',()=>{
 const base='/api/ho/learning/specialties';
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,base,'POST').action,'next');
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,base+'/path-options','GET').action,'next');
 for(const host of ['bo.staging.pinohouse.art','tos.staging.pinohouse.art','ho.pinohouse.art'])
  assert.equal(decideHostBoundary(host,base,'POST').action,'not_found');
 for(const [path,method] of [[base,'PUT'],[base+'/path-options','POST'],[base+'/'+sid,'POST']])
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,path,method).action,'not_found');
});
test('PAP-1495 Create: BFF denies malformed command before Core call, no side effects',async()=>{
 const env={APP_ENV:'staging'} as Parameters<typeof handleHoSpecialtyV2Create>[1];
 const invalid=await handleHoSpecialtyV2Create(make({name:'A',pathProgramId:ids[0]}),env);
 assert.equal(invalid.status,400);
 const withTags=await handleHoSpecialtyV2Create(make({name:'Anime',pathProgramId:ids[0],tags:[]}),env);
 assert.equal(withTags.status,400);
 const noEnv=await handleHoSpecialtyV2Create(make({name:'Anime',pathProgramId:ids[0]}),{APP_ENV:'production'} as typeof env);
 assert.equal(noEnv.status,404);
});
test('PAP-1495 Create: Path options are exactly canonical active UUIDs, not fixture choices',async()=>{
 const signal=new AbortController().signal;
 const fetcher:typeof fetch=async path=>{
  assert.equal(String(path),'/api/ho/learning/specialties/path-options');
  return Response.json({data:paths});
 };
 assert.deepEqual(await readSpecialtyV2PathOptions(fetcher,signal),paths);
 for(const bad of [paths.slice(0,3),[...paths,{id:sid,code:'staging-fixture',label:'Fixture'}],
  [...paths.slice(0,3),{...paths[3],id:paths[0].id}]]){
  const f:typeof fetch=async()=>Response.json({data:bad});
  await assert.rejects(readSpecialtyV2PathOptions(f,signal),(e:unknown)=>e instanceof BoApiError&&e.status===502);
 }
});
test('PAP-1495 Create: successful 201 must be checked against real GET detail before UI success',async()=>{
 const signal=new AbortController().signal;
 const dto={id:sid,pathProgramId:ids[0],name:'Anime',description:null,status:'DRAFT',
  tags:[],version:1,missionCountDistinct:0,prerequisiteIds:[],levels:[]};
 let calls=0;
 const fetcher:typeof fetch=async (url,init)=>{
  calls++;
  if(calls===1){
   assert.equal(String(url),'/api/ho/learning/specialties');
   assert.equal(init?.method,'POST');
   assert.equal(new Headers(init?.headers).get('idempotency-key'),'spec_create_testing_01234567');
   assert.deepEqual(JSON.parse(String(init?.body)),{name:'Anime',pathProgramId:ids[0],description:null});
   return Response.json({data:dto},{status:201});
  }
  assert.equal(String(url),'/api/ho/learning/specialties/'+sid);
  return Response.json({data:dto});
 };
 assert.deepEqual(await createSpecialtyV2Draft({name:'Anime',pathProgramId:ids[0],description:null},
 'spec_create_testing_01234567',fetcher,signal),dto);
 assert.equal(calls,2);
 const forged:typeof fetch=async()=>Response.json({data:{...dto,status:'ACTIVE'}},{status:201});
 await assert.rejects(createSpecialtyV2Draft({name:'Anime',pathProgramId:ids[0],description:null},
 'same_key',forged,signal),(e:unknown)=>e instanceof BoApiError&&e.status===502);
 const denied:typeof fetch=async()=>Response.json({error:{code:'DENIED'}},{status:403});
 await assert.rejects(createSpecialtyV2Draft({name:'Anime',pathProgramId:ids[0],description:null},
 'same_key',denied,signal),(e:unknown)=>e instanceof BoApiError&&e.status===403);
});
