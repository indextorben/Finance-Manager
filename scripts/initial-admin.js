require('dotenv').config();
const argon2=require('argon2');
const db=require('../src/config/db');
(async()=>{
  const username=process.env.INITIAL_ADMIN_USERNAME||'Torben';
  const password=process.env.INITIAL_ADMIN_PASSWORD||'Start-Finance-2026!';
  const email=process.env.INITIAL_ADMIN_EMAIL||'torben@localhost';
  const name=process.env.INITIAL_ADMIN_NAME||'Torben';
  const found=await db.query('SELECT id FROM users WHERE lower(username)=lower($1)',[username]);
  if(!found.rowCount){
    const hash=await argon2.hash(password,{type:argon2.argon2id});
    const r=await db.query("INSERT INTO users(username,email,name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,'ADMIN',true) RETURNING id",[username,email,name,hash]);
    await db.query('INSERT INTO tax_settings(user_id) VALUES($1) ON CONFLICT DO NOTHING',[r.rows[0].id]);
    console.log(`Initial administrator created: ${username}`);
  } else console.log('Initial administrator already exists; leaving credentials unchanged.');
  await db.end();
})().catch(e=>{console.error(e);process.exit(1)});
