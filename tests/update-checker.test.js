const test=require('node:test'),assert=require('node:assert/strict');
const {compareVersions}=require('../src/services/update-checker');

test('update checker erkennt identische Commits',()=>{assert.equal(compareVersions({currentCommit:'abc1234',builtAt:null},'abc1234','2026-10-01T12:00:00Z'),'current')});
test('update checker erkennt abweichende Commits',()=>{assert.equal(compareVersions({currentCommit:'abc1234',builtAt:null},'def5678','2026-10-01T12:00:00Z'),'available')});
test('update checker nutzt im Container den Build-Zeitpunkt',()=>{assert.equal(compareVersions({currentCommit:null,builtAt:'2026-10-01T10:00:00Z'},'def5678','2026-10-01T12:00:00Z'),'available');assert.equal(compareVersions({currentCommit:null,builtAt:'2026-10-01T13:00:00Z'},'def5678','2026-10-01T12:00:00Z'),'current')});
