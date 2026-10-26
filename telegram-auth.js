const crypto=require('node:crypto');
const TELEGRAM_KEY='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
function verifyTelegram(raw,botId,now=Date.now(),publicKeyHex=TELEGRAM_KEY){
 if(typeof raw!=='string'||raw.length>12000||!/^\d{5,20}$/.test(botId||''))return null;
 try{const params=new URLSearchParams(raw),seen=new Set();for(const [k]of params){if(seen.has(k))return null;seen.add(k)}
 const at=Number(params.get('auth_date')),age=now/1000-at;if(!Number.isInteger(at)||age< -30||age>3600)return null;
 const sig=Buffer.from(params.get('signature')||'','base64url');if(sig.length!==64)return null;
 const data=botId+':WebAppData\n'+[...params].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKeyHex,'hex')]),format:'der',type:'spki'});
 if(!crypto.verify(null,Buffer.from(data),key,sig))return null;const user=JSON.parse(params.get('user'));if(!Number.isSafeInteger(user.id)||user.id<=0||typeof user.first_name!=='string')return null;
 return {id:String(user.id),name:user.first_name.slice(0,24)};
 }catch{return null}
}
module.exports={verifyTelegram};
