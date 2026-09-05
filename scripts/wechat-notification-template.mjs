// Uses current managed runtime configuration. Never prints access tokens/secrets.
// Default: read-only; --apply selects exactly the documented unread-message template.
const appid = process.env.LINGQI_WECHAT_MINI_APP_ID;
const secret = process.env.LINGQI_WECHAT_MINI_APP_SECRET;
if (!appid || !secret) throw new Error('缺少当前微信小程序配置');
const response = await fetch('https://api.weixin.qq.com/cgi-bin/token?'+new URLSearchParams({grant_type:'client_credential',appid,secret}),{signal:AbortSignal.timeout(8000)});
const auth = await response.json();
if (!auth.access_token) throw new Error('微信授权失败：'+auth.errcode);
async function api(path,body) {
  const r = await fetch('https://api.weixin.qq.com'+path+'?'+new URLSearchParams({access_token:auth.access_token}),{
    method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),
  });
  const p=await r.json();
  if(!r.ok || p.errcode) throw new Error('微信接口失败：'+p.errcode+' '+String(p.errmsg||'').slice(0,200));
  return p;
}
const matches = t => t.title==='未读消息提醒' && ['phrase4','thing5','date3'].every(key=>String(t.content).includes('{{'+key+'.DATA}}'));
let templates=await api('/wxaapi/newtmpl/gettemplate');
if(!templates.data?.some(matches) && process.argv.includes('--apply')) {
  console.log('SELECTED',JSON.stringify(await api('/wxaapi/newtmpl/addtemplate',{tid:'4456',kidList:[4,5,3],sceneDesc:'站内业务通知未读提醒'})));
  templates=await api('/wxaapi/newtmpl/gettemplate');
}
console.log(JSON.stringify({appid,matching:templates.data?.filter(matches)||[],templateCount:templates.data?.length||0},null,2));
