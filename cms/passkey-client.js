/* Served locally: credentials and enrollment secrets never go to a CDN. */
(() => {
  const message = document.getElementById('passkey-message');
  const login = document.getElementById('passkey-login');
  const enroll = document.getElementById('passkey-enroll');
  let invitation = location.hash.slice(1);
  if (enroll && invitation) history.replaceState(null, '', location.pathname);
  const post = async (path, data) => {
    const res = await fetch('/auth/passkey/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Please try again.');
    return result;
  };
  const failure = error => {
    message.textContent = error.name === 'NotAllowedError' || error.name === 'AbortError' ? 'Sign-in was cancelled or timed out. You can try again.' : error.message || 'Could not use your passkey. Please try again.';
  };
  if (login) {
    fetch('/auth/passkey/status').then(res => { if (!res.ok) throw new Error('Could not check sign-in settings.'); return res.json(); }).then(state => {
      login.hidden = !state.available;
      document.getElementById('password-login').hidden = state.required;
      if (state.required) message.textContent = 'Use Face ID, Touch ID, or your device passcode to sign in.';
    }).catch(failure);
    login.addEventListener('click', async () => {
      login.disabled = true;
      try {
        message.textContent = 'Approve the passkey prompt on your device.';
        const optionsJSON = await post('login/options', {});
        const response = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
        await post('login/verify', response);
        location.assign('/admin.html');
      } catch (error) { failure(error); }
      finally { login.disabled = false; }
    });
  }
  if (enroll) {
    if (!invitation) { enroll.hidden = true; message.textContent = 'Open your private enrollment link to set up a passkey. Each link works once.'; }
    enroll.addEventListener('submit', async event => {
      event.preventDefault();
      const button = enroll.querySelector('button'), password = document.getElementById('setup-password');
      button.disabled = true;
      try {
        message.textContent = 'Approve the passkey prompt on your device.';
        const optionsJSON = await post('register/options', { invite: invitation, password: password.value });
        password.value = '';
        const response = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
        await post('register/verify', response);
        invitation = '';
        enroll.hidden = true;
        message.textContent = 'Your passkey is saved. Choose “Go to sign in” below, then “Sign in with a passkey” to test it.';
      } catch (error) { failure(error); }
      finally { button.disabled = false; }
    });
  }
})();
