// Beträge aus Formularen lesen. Akzeptiert deutsche Eingaben ("1.234,56", "1234,5")
// genauso wie maschinelle Werte ("1234.56") und gibt NaN zurück, wenn nichts Gültiges drin steht.
function parseAmount(value,{allowNegative=true}={}){
  if(typeof value==='number')return Number.isFinite(value)?value:NaN;
  let s=String(value??'').replace(/[\s €]/g,'');
  if(!s)return NaN;
  let sign=1;
  if(/^[-+]/.test(s)){if(s[0]==='-')sign=-1;s=s.slice(1)}
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  if(!/^\d+(\.\d+)?$/.test(s))return NaN;
  const n=Math.round(sign*Number(s)*100)/100;
  if(!Number.isFinite(n))return NaN;
  if(!allowNegative&&n<0)return NaN;
  return n;
}
// Optionales Feld: leer bedeutet "nicht angegeben" und ist kein Fehler.
function parseOptionalAmount(value,fallback=0,opts){
  const s=String(value??'').trim();
  return s?parseAmount(s,opts):fallback;
}
module.exports={parseAmount,parseOptionalAmount};
