#!/usr/bin/env bash
set -euo pipefail

rm -rf public_site
mkdir -p public_site

cp index.html styles.css script.js cms-site.js robots.txt sitemap.xml public_site/
rsync -a --exclude '.DS_Store' data images videos public_site/
