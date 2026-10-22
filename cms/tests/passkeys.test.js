const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { execFileSync } = require('node:child_process');
const { encodeCBOR } = require('@levischuck/tiny-cbor');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cottontail-passkeys-'));
process.env.CMS_PASSKEY_FILE = path.join(dir, 'passkeys.json');
const origin = 'https://edit.cottontailchildcare.com';
const cli = (...args) => execFileSync(process.execPath, [path.join(__dirname, '../passkeys.js'), ...args], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
cli('init');
const { createPasskeys } = require('../passkeys');
let issued = 0;
const service = createPasskeys({ send: (res, status, body, headers) => Object.assign(res, { status, body: JSON.parse(body), headers }), validPassword: p => p === 'test-password', issueSession: () => { issued++; return 'test_session=yes; Secure; HttpOnly'; } });
async function request(route, data = {}, cookie = '', requestOrigin = origin) {
 const req = Readable.from([Buffer.from(JSON.stringify(data))]);
 req.method = 'POST'; req.headers = { origin: requestOrigin, host: new URL(origin).host, cookie }; req.socket = { remoteAddress: '127.0.0.1' };
 const res = {};
 await service.handle(req, res, new URL('/auth/passkey/' + route, origin));
 return res;
}
const challengeCookie = res => res.headers['Set-Cookie'].split(';')[0];
const base64 = v => Buffer.from(v).toString('base64url');
const rpHash = crypto.createHash('sha256').update(new URL(origin).hostname).digest();
const credentials = [];
function authenticatorData(flags, counter) { const c = Buffer.alloc(4); c.writeUInt32BE(counter); return Buffer.concat([rpHash, Buffer.from([flags]), c]); }
async function login(credential, changes = {}) {
 const options = await request('login/options');
 const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: changes.challenge || options.body.challenge, origin: changes.origin || origin }));
 const data = authenticatorData(changes.flags ?? 5, credential.counter + 1);
 const signature = crypto.sign('sha256', Buffer.concat([data, crypto.createHash('sha256').update(client).digest()]), changes.privateKey || credential.privateKey);
 const response = { id: credential.id, rawId: credential.id, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: base64(client), authenticatorData: base64(data), signature: base64(signature), userHandle: credential.userHandle } };
 const cookie = challengeCookie(options);
 const result = await request('login/verify', response, cookie);
 if (result.status === 200) credential.counter++;
 return { result, response, cookie };
}
test('invitation-only enrollment, cryptographic login, replay rejection, and safe enforcement', async () => {
 try {
 assert.equal((await request('register/options', { invite: 'outsider', password: 'test-password' })).status, 400);
 assert.equal((await request('login/options', {}, '', 'https://evil.example')).status, 403);
 cli('invite', 'Kristel', 'Mac');
 const phoneLink = cli('invite', 'Kristel', 'iPhone');
 cli('invite', 'Kristel', 'Mac');
 const deviceInvites = JSON.parse(fs.readFileSync(process.env.CMS_PASSKEY_FILE)).invites;
 assert.equal(deviceInvites.length, 2, 'Replacing Mac link preserves the separate iPhone invitation');
 assert.ok(deviceInvites.some(i => i.hash === crypto.createHash('sha256').update(new URL(phoneLink).hash.slice(1)).digest('hex')));
 for (const name of ['Bryce', 'Kristel']) {
  const link = cli('invite', name), invite = new URL(link).hash.slice(1);
  assert.equal((await request('register/options', { invite, password: 'wrong' })).status, 400);
  const options = await request('register/options', { invite, password: 'test-password' });
  assert.equal(options.status, 200); assert.equal(options.body.authenticatorSelection.userVerification, 'required');
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }), jwk = keys.publicKey.export({ format: 'jwk' });
  const cose = encodeCBOR(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  const id = crypto.randomBytes(32), length = Buffer.alloc(2); length.writeUInt16BE(id.length);
  const authData = Buffer.concat([authenticatorData(0x45, 0), Buffer.alloc(16), length, id, Buffer.from(cose)]);
  const client = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.body.challenge, origin }));
  const response = { id: base64(id), rawId: base64(id), type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: base64(client), attestationObject: base64(encodeCBOR(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))), transports: ['internal'] } };
  const registered = await request('register/verify', response, challengeCookie(options));
  assert.equal(registered.status, 200, JSON.stringify(registered));
  assert.equal((await request('register/options', { invite, password: 'test-password' })).status, 400);
  const credential = { id: base64(id), privateKey: keys.privateKey, userHandle: options.body.user.id, counter: 0 }; credentials.push(credential);
  assert.equal((await login(credential, { origin: 'https://evil.example' })).result.status, 400);
  assert.equal((await login(credential, { flags: 1 })).result.status, 400);
  assert.equal((await login(credential, { challenge: base64('wrong') })).result.status, 400);
  const badKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  assert.equal((await login(credential, { privateKey: badKey })).result.status, 400);
  const signed = await login(credential); assert.equal(signed.result.status, 200);
  assert.equal((await request('login/verify', signed.response, signed.cookie)).status, 400);
  if (name === 'Bryce') assert.throws(() => cli('require'));
 }
 assert.equal(issued, 2, 'Only valid, verified passkey assertions create sessions');
 cli('require'); assert.equal(service.passwordAllowed(), false);
 assert.equal(JSON.parse(cli('status')).users.every(u => u.tested), true);
 assert.equal((fs.statSync(process.env.CMS_PASSKEY_FILE).mode & 0o777), 0o600);
 const restarted = createPasskeys({ send() {}, validPassword() {}, issueSession() {} });
 assert.equal(restarted.passwordAllowed(), false, 'Enforcement survives restart');
 cli('recover'); assert.equal(service.passwordAllowed(), true);
 fs.renameSync(process.env.CMS_PASSKEY_FILE, process.env.CMS_PASSKEY_FILE + '.removed');
 assert.throws(() => service.passwordAllowed(), 'Missing state must not enable password fallback');
 } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
