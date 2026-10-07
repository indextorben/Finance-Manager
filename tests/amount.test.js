const test=require('node:test'),assert=require('node:assert/strict');
const {parseAmount,parseOptionalAmount}=require('../src/utils/amount');

test('parseAmount liest deutsche Beträge mit Tausenderpunkten',()=>{
  assert.equal(parseAmount('1.234,56'),1234.56);
  assert.equal(parseAmount('1.234.567,89'),1234567.89);
  assert.equal(parseAmount('1.234'),1234);
  assert.equal(parseAmount('12,5'),12.5);
  assert.equal(parseAmount('1 234,56 €'),1234.56);
});
test('parseAmount liest maschinelle Beträge',()=>{
  assert.equal(parseAmount('1234.56'),1234.56);
  assert.equal(parseAmount(1234.56),1234.56);
  assert.equal(parseAmount('0'),0);
});
test('parseAmount erkennt negative Werte und kann sie ablehnen',()=>{
  assert.equal(parseAmount('-1.234,56'),-1234.56);
  assert.ok(Number.isNaN(parseAmount('-5',{allowNegative:false})));
});
test('parseAmount lehnt ungültige Eingaben ab',()=>{
  for(const v of ['','abc','1,2,3','12,',null,undefined,'--1'])assert.ok(Number.isNaN(parseAmount(v)),`${v} sollte ungültig sein`);
});
test('parseOptionalAmount nutzt den Standardwert nur bei leerer Eingabe',()=>{
  assert.equal(parseOptionalAmount('',0),0);
  assert.equal(parseOptionalAmount('   ',0),0);
  assert.equal(parseOptionalAmount('19,00',0),19);
  assert.ok(Number.isNaN(parseOptionalAmount('abc',0)));
});
