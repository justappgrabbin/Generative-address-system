// Static bytes only: application execution stays in the browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fs.realpathSync(fileURLToPath(new URL('../..',import.meta.url)));
const port=Number(process.env.PORT??8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((request,response)=>{
 try{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  const name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  let filename=fs.realpathSync(path.join(root,name));
  if(filename!==root&&!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  if(fs.statSync(filename).isDirectory())filename=fs.realpathSync(path.join(filename,'index.html'));
  if(!filename.startsWith(root+path.sep))throw Error('Outside root');
  response.writeHead(200,{'Content-Type':mime[path.extname(filename)]??'application/octet-stream'});
  if(request.method==='HEAD')response.end();else fs.createReadStream(filename).on('error',()=>response.destroy()).pipe(response);
 }catch{response.writeHead(404);response.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Static source: http://127.0.0.1:${port}/document-foundation/index.html`));
