import puppeteer from "puppeteer-core";
import { readFileSync } from "fs";
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tok=readFileSync("/tmp/tok","utf8").trim();
const b=await puppeteer.launch({executablePath:CHROME,headless:"new",args:["--no-sandbox"]});
const p=await b.newPage();
await p.setViewport({width:1536,height:1024,deviceScaleFactor:1});
await p.setCookie({name:"access_token",value:tok,domain:"localhost",path:"/"});
for (const [url,out] of [["/app/documents/listings","/tmp/e9.png"],["/app/documents/new","/tmp/e2.png"]]) {
  await p.goto("http://localhost:3100"+url,{waitUntil:"networkidle0",timeout:240000});
  await new Promise(r=>setTimeout(r,2500));
  await p.screenshot({path:out});
  console.log(url,"ok");
}
await b.close();
