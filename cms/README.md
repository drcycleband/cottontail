# Cottontail CMS

This folder runs the visual editor for the Cottontail website.

For browser-only access without Tailscale, follow [Hosted setup](HOSTED_SETUP.md).
The editor previews the real website; outlined text and photos can be edited directly.

The public website can stay static on DigitalOcean. The CMS should run on the home server, save changes to `data/content.json` and `images/uploads`, then publish by committing and pushing those files to GitHub.

## Run Locally

Install the dependencies with `npm ci` in `cms`, then initialize passkey state
once with `node passkeys.js init` before the first start. See [Passkey setup and
recovery](PASSKEYS.md). Existing deployments must preserve their passkey state.

From the repo root:

```bash
cd cms
CMS_USERNAME="kristel" CMS_PASSWORD="CHOOSE_A_UNIQUE_PASSWORD" npm start
```

Then open:

```text
http://localhost:3131/admin.html
```

For the home server, use Tailscale or your local network address:

```text
http://YOUR-SERVER-ADDRESS:3131/admin.html
```

The sign-in username and password come from `CMS_USERNAME` and `CMS_PASSWORD`.
The editor now presents a sign-in page at `/login`, with a 12-hour session and a
Sign out button. Restarting the editor signs everyone out. Ten failed sign-in
attempts from the same connection address trigger a 15-minute cooldown; clients
behind the same reverse proxy share that limit. Use HTTPS for remote access.

## Publish Button

The Publish Website button runs:

```bash
git add -A -- data/content.json images/uploads
git commit -m "Update site content YYYY-MM-DD"
git push
```

The Mac Pro needs this repo cloned and GitHub push access already set up.

## Testimonials

Choose **Manage testimonials → Add testimonial**, paste the review and enter the reviewer’s name. Rating, date, source, and original review link are optional. Close the dialog to preview changes, then Save Draft or Publish Website. Reviews can also be edited, reordered, or removed here. The original 10 Shapo reviews were copied in full into `data/content.json`; this section no longer needs Shapo or Google sign-in.

Deploy the updated `cms/server.js`, `cms/admin.html`, and `cms/admin.js` together: the server must preserve the new `testimonials` content field. Restart the CMS after updating the server. The public build uses the existing `build-static.sh` workflow.
