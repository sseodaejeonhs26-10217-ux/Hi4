import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';

test('정적 화면을 제공하고 제거한 API 및 비공개 파일을 제공하지 않는다', async () => {
  const server=createApp();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/','/app.js','/style.css']) assert.equal((await fetch(url+path)).status,200);
    for (const path of ['/api/config','/api/analyze','/.env','/server.mjs','/.git/config']) assert.equal((await fetch(url+path)).status,404);
    assert.equal((await fetch(url+'/api/analyze',{method:'POST'})).status,404);
    const page=await (await fetch(url+'/')).text();
    assert.ok(!page.includes('id="grams"'));assert.ok(!page.includes('ai-settings'));
    assert.ok(page.includes('name="outcome"'));
  } finally {await new Promise(resolve=>server.close(resolve));}
});
