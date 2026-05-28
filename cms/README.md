# Cottontail CMS

This folder runs the private editor for the Cottontail website.

The public website can stay static on DigitalOcean. The CMS should run on the home server, save changes to `data/content.json` and `images/uploads`, then publish by committing and pushing those files to GitHub.

## Run Locally

From the repo root:

```bash
cd cms
CMS_USERNAME="kristel" CMS_PASSWORD="bunny123" npm start
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

## Publish Button

The Publish Website button runs:

```bash
git add -A -- data/content.json images/uploads
git commit -m "Update site content YYYY-MM-DD"
git push
```

The Mac Pro needs this repo cloned and GitHub push access already set up.
