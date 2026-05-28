const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const cmsRoot = __dirname;
const root = path.resolve(__dirname, "..");
const contentPath = path.join(root, "data", "content.json");
const uploadDir = path.join(root, "images", "uploads");
const port = Number(process.env.PORT || 3131);
const host = process.env.HOST || "0.0.0.0";
const adminPassword = process.env.CMS_PASSWORD || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;

  req.on("data", chunk => {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) {
      reject(new Error("Uploads are limited to 12 MB."));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});

const isAuthorized = req => {
  if (!adminPassword) return true;

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return false;

  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const password = decoded.split(":").slice(1).join(":");
  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(adminPassword);
  return passwordBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(passwordBuffer, expectedBuffer);
};

const requireAuth = (req, res) => {
  if (isAuthorized(req)) return true;

  send(res, 401, "Password required.", {
    "WWW-Authenticate": 'Basic realm="Cottontail CMS"',
    "Content-Type": "text/plain; charset=utf-8"
  });
  return false;
};

const safeJson = value => {
  const next = {
    texts: value.texts && typeof value.texts === "object" ? value.texts : {},
    images: value.images && typeof value.images === "object" ? value.images : {},
    gallery: Array.isArray(value.gallery) ? value.gallery : []
  };

  return JSON.stringify(next, null, 2);
};

const saveContent = async body => {
  const parsed = JSON.parse(body.toString("utf8"));
  await fs.promises.writeFile(contentPath, `${safeJson(parsed)}\n`);
};

const extensionFromMime = mime => {
  const clean = String(mime || "").toLowerCase().split(";")[0].trim();
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp"
  }[clean] || "";
};

const parseMultipartImage = (body, contentType) => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Missing upload boundary.");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    const partStart = cursor + boundary.length + 2;
    const nextBoundary = body.indexOf(boundary, partStart);
    if (nextBoundary === -1) break;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), partStart);
    if (headerEnd === -1 || headerEnd > nextBoundary) break;

    const headers = body.slice(partStart, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    const dataEnd = nextBoundary - 2;

    if (headers.includes('name="image"')) {
      const filenameMatch = headers.match(/filename="([^"]+)"/i);
      const mimeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      const filename = filenameMatch ? filenameMatch[1] : "upload";
      const ext = extensionFromMime(mimeMatch && mimeMatch[1]) || path.extname(filename).toLowerCase();

      if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
        throw new Error("Please upload a JPG, PNG, GIF, or WEBP image.");
      }

      return {
        data: body.slice(dataStart, dataEnd),
        extension: ext === ".jpeg" ? ".jpg" : ext
      };
    }

    cursor = nextBoundary;
  }

  throw new Error("No image was uploaded.");
};

const handleUpload = async (req, res) => {
  const body = await readBody(req);
  const image = parseMultipartImage(body, req.headers["content-type"] || "");
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${image.extension}`;
  const filePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filePath, image.data);

  send(res, 200, JSON.stringify({ path: `images/uploads/${filename}` }), {
    "Content-Type": "application/json; charset=utf-8"
  });
};

const runGit = async args => {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: root,
    maxBuffer: 1024 * 1024
  });

  return `${stdout || ""}${stderr || ""}`.trim();
};

const publishSite = async () => {
  const before = await runGit(["status", "--porcelain", "--", "data/content.json", "images/uploads"]);
  if (!before) {
    return {
      ok: true,
      published: false,
      message: "There are no saved CMS changes to publish."
    };
  }

  await runGit(["add", "-A", "--", "data/content.json", "images/uploads"]);

  const staged = await runGit(["diff", "--cached", "--name-only", "--", "data/content.json", "images/uploads"]);
  if (!staged) {
    return {
      ok: true,
      published: false,
      message: "There are no saved CMS changes to publish."
    };
  }

  const date = new Date().toISOString().slice(0, 10);
  await runGit(["commit", "-m", `Update site content ${date}`]);
  const pushOutput = await runGit(["push"]);

  return {
    ok: true,
    published: true,
    message: "Published to GitHub. DigitalOcean should redeploy shortly.",
    details: pushOutput
  };
};

const serveAdminFile = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fileName = path.basename(decodeURIComponent(url.pathname));
  const requestedPath = path.join(cmsRoot, fileName);

  try {
    const stat = await fs.promises.stat(requestedPath);
    if (!stat.isFile()) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const ext = path.extname(requestedPath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(requestedPath).pipe(res);
  } catch {
    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
};

const serveFile = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") pathname = "/index.html";
  const requestedPath = path.normalize(path.join(root, pathname));

  if (!requestedPath.startsWith(root)) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const stat = await fs.promises.stat(requestedPath);
    if (!stat.isFile()) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const ext = path.extname(requestedPath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(requestedPath).pipe(res);
  } catch {
    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/content" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const body = await fs.promises.readFile(contentPath);
      send(res, 200, body, { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/content" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      await saveContent(await readBody(req));
      send(res, 200, JSON.stringify({ ok: true }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/upload" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      await handleUpload(req, res);
      return;
    }

    if (url.pathname === "/api/publish" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const result = await publishSite();
      send(res, 200, JSON.stringify(result), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (["/admin.html", "/admin.css", "/admin.js"].includes(url.pathname)) {
      if (!requireAuth(req, res)) return;
      await serveAdminFile(req, res);
      return;
    }

    await serveFile(req, res);
  } catch (error) {
    send(res, 500, error.message || "Server error", { "Content-Type": "text/plain; charset=utf-8" });
  }
});

server.listen(port, host, () => {
  console.log(`Cottontail CMS running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  console.log("Set CMS_PASSWORD before starting the server to protect the editor.");
});
