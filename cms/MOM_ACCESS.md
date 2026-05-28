# CMS Access For Mom

The editor is hosted privately on the Ubuntu VM through Tailscale.

## Bookmark

Try this first:

```text
https://ubuntu-server.tail2e0ef9.ts.net/
```

If that does not load, use the Tailscale IP:

```text
http://100.67.72.20:3131/admin.html
```

## Sign In

Use:

```text
Username: kristel
Password: bunny123
```

The CMS username and password are stored on the Ubuntu VM in:

```text
/home/bryce/.config/cottontail-cms.env
```

## What She Needs

Her computer or phone needs to be signed into Tailscale and invited to the same tailnet.

Once Tailscale is connected, the bookmark above should open the editor. She can use:

- Save Draft: saves changes on the home server
- Publish Website: pushes changes to GitHub so DigitalOcean redeploys the static website
