import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain','.png':'image/png'};
const port=Number(process.env.PORT??4173);
const server=http.createServer(async(req,res)=>{
  try{
    let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(url==='/')url='/index.html';
    const file=path.resolve(root,'.'+url);
    if(!file.startsWith(root+path.sep))throw Error('Invalid path');
    const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Synthia: http://localhost:${port} (static files only; no simulation backend)`));
