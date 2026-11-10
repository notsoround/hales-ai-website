import {signedIn,nav,browser,server} from './lib.mjs';
const v=await signedIn(390,'caribbean');const {p}=v;
await nav(p,'Assistant');await p.getByRole('button',{name:'Show floating companion',exact:true}).click();await p.getByRole('button',{name:'Minimize assistant',exact:true}).click();
await nav(p,'Today');await p.waitForTimeout(800);
const pos=async()=>p.evaluate(()=>{const l=document.querySelector('.cc-assistant-launcher');return l?l.getAttribute('style'):'none'});
const seen=[await pos()];for(let i=0;i<8;i++){await p.mouse.wheel(0,300);await p.waitForTimeout(300);seen.push(await pos());}
console.log(seen.join('\n'));await browser.close();await server.close();
