import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import GenerativeAddressMorphologyEngine from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const publicDir=path.join(root,'public');const engine=new GenerativeAddressMorphologyEngine();
const send=(res,status,data,type='application/json')=>{res.writeHead(status,{'content-type':type,'access-control-allow-origin':'*'});res.end(type==='application/json'?JSON.stringify(data,null,2):data)};
const body=req=>new Promise((resolve,reject)=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})});
const server=http.createServer(async(req,res)=>{try{
  if(req.method==='GET'&&req.url==='/api/state')return send(res,200,engine.snapshot());
  if(req.method==='GET'&&req.url==='/api/channels')return send(res,200,engine.channels.list());
  if(req.method==='POST'&&req.url==='/api/compile'){const x=await body(req);return send(res,200,engine.run(x.addresses??[],x.context??{}));}
  if(req.method==='POST'&&req.url==='/api/reinforce'){const x=await body(req);return send(res,200,engine.reinforce(x.graphId,x.delta,x.outcome??null));}
  if(req.method==='GET'&&req.url==='/examples/demo-input.json')return send(res,200,JSON.parse(fs.readFileSync(path.join(root,'examples/demo-input.json'),'utf8')));
  const rel=req.url==='/'?'index.html':req.url.replace(/^\//,'');const file=path.normalize(path.join(publicDir,rel));if(!file.startsWith(publicDir)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return send(res,404,{error:'not found'});
  const ext=path.extname(file);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};return send(res,200,fs.readFileSync(file,'utf8'),types[ext]??'text/plain');
}catch(error){send(res,500,{error:String(error?.stack??error)})}});
const port=Number(process.env.PORT??8787);server.listen(port,'127.0.0.1',()=>console.log(`Synthia Address & Morphology Engine: http://127.0.0.1:${port}`));
