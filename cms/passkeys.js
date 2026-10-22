const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const webauthn = require('@simplewebauthn/server');

const stateFile = process.env.CMS_PASSKEY_FILE || path.join(os.homedir(), '.config/cottontail-auth/passkeys.json');
const origin = process.env.CMS_PASSKEY_ORIGIN || 'https://edit.cottontailchildcare.com';
const rpID = new URL(origin).hostname;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = () => {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.version !== 1 || !Array.isArray(state.users) || !Array.isArray(state.invites) || typeof state.required !== 'boolean') throw new Error('Invalid passkey configuration');
  return state;
};
const write = state => {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const temp = `${stateFile}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, stateFile);
};

function createPasskeys({ send, validPassword, issueSession }) {
  read(); // Missing or corrupt security state must fail closed at startup.
  const challenges = new Map();
  const limits = new Map();
  const cookieName = '__Host-cottontail_webauthn';
  const json = (res, status, body, headers = {}) => send(res, status, JSON.stringify(body), { 'Content-Type': 'application/json', ...headers });
  const cookie = req => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const challengeCookie = id => `${cookieName}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300`;
  const remember = (res, value, options) => {
    const now = Date.now();
    for (const [id, c] of challenges) if (c.expires <= now) challenges.delete(id);
    if (challenges.size >= 500) return json(res, 429, { error: 'Please try again shortly.' });
    const id = crypto.randomBytes(32).toString('hex');
    challenges.set(id, { ...value, challenge: options.challenge, expires: now + 300000 });
    return json(res, 200, options, { 'Set-Cookie': challengeCookie(id) });
  };
  const take = (req, type) => {
    const id = cookie(req), c = challenges.get(id);
    challenges.delete(id);
    if (!c || c.type !== type || c.expires <= Date.now()) throw new Error('Start again');
    return c;
  };
  const body = async req => {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32768) throw new Error('Request too large');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  return {
    passwordAllowed: () => !read().required,
    async handle(req, res, url) {
      if (!url.pathname.startsWith('/auth/passkey/')) return false;
      if (url.pathname === '/auth/passkey/status' && req.method === 'GET') {
        const state = read();
        json(res, 200, { required: state.required, available: state.users.some(u => u.credentials.length) });
        return true;
      }
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers.host !== new URL(origin).host) {
        json(res, 403, { error: 'Open the editor’s public HTTPS address to use passkeys.' }); return true;
      }
      const now = Date.now(), key = req.socket.remoteAddress;
      for (const [k, v] of limits) if (v.until <= now) limits.delete(k);
      const limit = limits.get(key) || { count: 0, until: now + 60000 };
      limit.count++; limits.set(key, limit);
      if (limit.count > 60) { json(res, 429, { error: 'Too many attempts. Try again in a minute.' }); return true; }
      try {
        const input = await body(req);
        if (url.pathname === '/auth/passkey/register/options') {
          const state = read();
          const inviteHash = digest(String(input.invite || ''));
          const invite = state.invites.find(i => i.hash === inviteHash && i.expires > now);
          if (!invite || !validPassword(String(input.password || ''))) throw new Error('Invalid enrollment');
          const user = state.users.find(u => u.id === invite.userID);
          if (!user) throw new Error('Unknown user');
          const options = await webauthn.generateRegistrationOptions({ rpName: 'Cottontail Website Editor', rpID, userName: user.name, userDisplayName: user.name, userID: Buffer.from(user.id, 'hex'), attestationType: 'none', authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, excludeCredentials: user.credentials.map(c => ({ id: c.id, transports: c.transports })) });
          remember(res, { type: 'register', inviteHash, userID: user.id }, options);
        } else if (url.pathname === '/auth/passkey/register/verify') {
          const c = take(req, 'register');
          const result = await webauthn.verifyRegistrationResponse({ response: input, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
          if (!result.verified) throw new Error('Not verified');
          const state = read();
          if (!state.invites.some(i => i.hash === c.inviteHash && i.expires > Date.now())) throw new Error('Invitation already used');
          const user = state.users.find(u => u.id === c.userID);
          const credential = result.registrationInfo.credential;
          if (!user || state.users.some(u => u.credentials.some(p => p.id === credential.id))) throw new Error('Duplicate credential');
          user.credentials.push({ id: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter, transports: credential.transports, created: Date.now() });
          state.invites = state.invites.filter(i => i.hash !== c.inviteHash);
          write(state);
          json(res, 200, { ok: true }, { 'Set-Cookie': challengeCookie('') });
        } else if (url.pathname === '/auth/passkey/login/options') {
          const options = await webauthn.generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] });
          remember(res, { type: 'login' }, options);
        } else if (url.pathname === '/auth/passkey/login/verify') {
          const c = take(req, 'login');
          const state = read();
          const user = state.users.find(u => u.credentials.some(p => p.id === input.id));
          const stored = user?.credentials.find(p => p.id === input.id);
          if (!stored || (input.response?.userHandle && input.response.userHandle !== Buffer.from(user.id, 'hex').toString('base64url'))) throw new Error('Unknown passkey');
          const result = await webauthn.verifyAuthenticationResponse({ response: input, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: { ...stored, publicKey: Buffer.from(stored.publicKey, 'base64url') } });
          if (!result.verified) throw new Error('Not verified');
          const fresh = read(), freshUser = fresh.users.find(u => u.id === user.id);
          const freshCredential = freshUser?.credentials.find(p => p.id === stored.id);
          if (!freshCredential || freshCredential.counter !== stored.counter) throw new Error('Credential changed; retry');
          freshCredential.counter = result.authenticationInfo.newCounter;
          freshUser.lastLogin = Date.now();
          write(fresh);
          json(res, 200, { ok: true }, { 'Set-Cookie': [issueSession(req), challengeCookie('')] });
        } else json(res, 404, { error: 'Not found' });
      } catch {
        json(res, 400, { error: 'Could not verify. Check your invitation/password, or start again and approve Face ID or Touch ID.' });
      }
      return true;
    },
  };
}

if (require.main === module) {
  const [command, name, device = 'default'] = process.argv.slice(2);
  if (command === 'init') {
    if (fs.existsSync(stateFile)) throw new Error('Already initialized');
    write({ version: 1, required: false, users: [], invites: [] });
    console.log('Passkey setup initialized; password login remains enabled.');
  } else if (command === 'invite') {
    if (!name || !/^[a-zA-Z0-9 _-]{1,60}$/.test(name)) throw new Error('Supply a person’s name');
    if (!/^[a-zA-Z0-9 _-]{1,60}$/.test(device)) throw new Error('Supply a valid device label');
    const state = read();
    let user = state.users.find(u => u.name === name);
    if (!user) { user = { id: crypto.randomBytes(32).toString('hex'), name, credentials: [] }; state.users.push(user); }
    const token = crypto.randomBytes(32).toString('base64url');
    state.invites = state.invites.filter(i => !(i.userID === user.id && (i.device || 'default') === device) && i.expires > Date.now());
    state.invites.push({ hash: digest(token), userID: user.id, device, expires: Date.now() + 7 * 86400000 });
    write(state);
    console.log(`${origin}/passkey-setup#${token}`);
  } else if (command === 'status') {
    const state = read();
    console.log(JSON.stringify({ required: state.required, users: state.users.map(u => ({ name: u.name, passkeys: u.credentials.length, tested: !!u.lastLogin })) }, null, 2));
  } else if (command === 'revoke') {
    const state = read(), user = state.users.find(u => u.name === name);
    if (!user) throw new Error('Unknown person');
    user.credentials = []; delete user.lastLogin;
    state.invites = state.invites.filter(i => i.userID !== user.id);
    write(state);
    console.log('Passkeys revoked for this person. Restart cottontail-cms to invalidate existing sessions.');
  } else if (command === 'require') {
    const state = read();
    if (!['Bryce', 'Kristel'].every(name => state.users.some(u => u.name === name && u.credentials.length && u.lastLogin))) throw new Error('Bryce and Kristel must each register and test a passkey first');
    state.required = true; state.invites = []; write(state);
    console.log('Passkeys required. Restart cottontail-cms now to invalidate previous sessions.');
  } else if (command === 'recover') {
    const state = read(); state.required = false; state.invites = []; write(state);
    console.log('SSH recovery: password login enabled. Restart cottontail-cms and re-enroll approved users.');
  } else throw new Error('Usage: node passkeys.js init|invite NAME [DEVICE]|status|revoke NAME|require|recover');
}
module.exports = { createPasskeys };
