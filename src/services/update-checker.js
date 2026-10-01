const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');

const repo=process.env.UPDATE_REPO||'indextorben/Finance-Manager';
const branch=process.env.UPDATE_BRANCH||'main';
const intervalMinutes=Math.max(15,Number(process.env.UPDATE_CHECK_INTERVAL_MINUTES)||360);
let timer,inFlight;
let state={status:'idle',repo,branch,checkedAt:null,currentCommit:null,latestCommit:null,latestDate:null,latestMessage:null,latestUrl:null,error:null};

function normalizeCommit(value){return /^[0-9a-f]{7,40}$/i.test(value||'')?String(value).toLowerCase():null}
function readBuildInfo(){
  let currentCommit=normalizeCommit(process.env.APP_COMMIT),builtAt=process.env.APP_BUILD_TIME||null;
  try{let info=JSON.parse(fs.readFileSync(path.join(process.cwd(),'.build-info.json'),'utf8'));currentCommit=currentCommit||normalizeCommit(info.commit);builtAt=builtAt||info.builtAt}catch(e){}
  if(!currentCommit)try{currentCommit=normalizeCommit(execFileSync('git',['rev-parse','HEAD'],{cwd:process.cwd(),encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim())}catch(e){}
  return {currentCommit,builtAt:builtAt&&Number.isFinite(Date.parse(builtAt))?builtAt:null};
}
function compareVersions({currentCommit,builtAt},latestCommit,latestDate){
  if(currentCommit)return currentCommit===latestCommit?'current':'available';
  if(builtAt&&latestDate)return Date.parse(latestDate)>Date.parse(builtAt)+60000?'available':'current';
  return 'unknown';
}
async function checkForUpdates(){
  if(inFlight)return inFlight;
  inFlight=(async()=>{state={...state,status:'checking',error:null};try{
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||!/^[A-Za-z0-9._/-]+$/.test(branch))throw new Error('Update-Repository oder Branch ist ungültig.');
    let headers={'Accept':'application/vnd.github+json','User-Agent':'Finance-Manager-Update-Checker','X-GitHub-Api-Version':'2022-11-28'};if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
    let response=await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`,{headers,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(response.status===404?'Repository oder Branch nicht gefunden.':`GitHub antwortet mit HTTP ${response.status}.`);
    let data=await response.json(),latestCommit=normalizeCommit(data.sha),latestDate=data.commit?.committer?.date||null,local=readBuildInfo();if(!latestCommit)throw new Error('GitHub-Antwort enthält keinen gültigen Commit.');
    state={status:compareVersions(local,latestCommit,latestDate),repo,branch,checkedAt:new Date().toISOString(),currentCommit:local.currentCommit,buildTime:local.builtAt,latestCommit,latestDate,latestMessage:data.commit?.message?.split('\n')[0]||null,latestUrl:data.html_url||`https://github.com/${repo}/commit/${latestCommit}`,error:null};
  }catch(error){state={...state,status:'error',checkedAt:new Date().toISOString(),error:error.message||'Update-Prüfung fehlgeschlagen.'}}finally{inFlight=null}return getStatus()})();return inFlight;
}
function getStatus(){return {...state}}
function start(){if(timer)return;setTimeout(()=>checkForUpdates(),3000).unref();timer=setInterval(()=>checkForUpdates(),intervalMinutes*60*1000);timer.unref()}
function stop(){if(timer)clearInterval(timer);timer=null}

module.exports={checkForUpdates,getStatus,start,stop,compareVersions,readBuildInfo};
