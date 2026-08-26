#!/usr/bin/env bash
# ---------------------------------------------------------------
# Pulls every asset referenced in index.html into ./images
#
#   bash download-assets.sh
#   then find-and-replace the https://www.figma.com/... URLs in
#   index.html with the images/... path noted above each <img>.
#
# NOTE: these Figma MCP URLs expire roughly 7 days after they were
# generated (2026-08-26). Run this soon, or re-export from Figma.
# ---------------------------------------------------------------
set -euo pipefail
mkdir -p images
B="https://www.figma.com/api/mcp/asset"

get () { echo "→ $2"; curl -fsSL "$B/$1" -o "images/$2"; }

get a6f35f2a-ec60-4289-9327-181569449636.svg icon-social-1.svg
get ca893435-ea20-41b0-9cd2-f375d9d4a052.svg icon-social-2.svg
get dd829770-f139-40a9-926c-a7f2a536e29b.png avatar.png
get b0d24215-9d28-4b7d-a5f5-b93dcfe80fee.png hero-portrait.png

get 6e2112d7-d537-42d7-8a4c-b52e1f3c6cb2.png project-01.png
get b1fbd448-567a-492f-8d54-d38c559c320b.png project-02.png
get e18a232f-fdee-4f31-9ebd-ab793aa97c9a.png project-03.png
get 78fd5d7a-69ce-4aad-a39f-0b0b9cbfffb8.png project-04.png
get 86c5f8b2-19d5-4aa2-983e-698bb2f4aa65.png project-05.png
get 321d5de6-c031-46d6-8729-eba7767aaf23.png project-06.png
get b9cf1d8a-512b-44a7-ac4b-330561c5cbce.png project-07.png
get e9b3e798-7fa8-4665-bd02-9f4a77729aaf.png project-08.png
get fe4c6061-66e3-407c-9428-dd4b03dd8799.png project-09.png
get 93f893f7-c2ba-43b7-9ed0-131832a42c94.png project-10.png
get ed8c19c4-5f31-426a-ab09-9fb829ab3406.png project-11.png
get 2b15e050-a104-49be-b6af-27e68a600769.png project-12.png
get 94f57c2d-fe56-47de-ba63-ec2d73f5dd79.png project-13.png
get 937d3695-9674-461c-95e6-67748a1a1b47.png project-14.png
get 2747ee26-5822-4f45-a626-b33f8f6719a0.png project-15.png
get b876b670-8345-48e3-94cf-1c171dc6d300.png project-16.png
get de49ecba-7396-473a-95ce-c4a96f139e87.png project-17.png
get c0ee0960-440e-42f6-b60d-7af4492e6215.png project-18.png
get 9e093390-3c40-4a2a-b631-d3a2eb82eecd.png project-19.png

echo "Done — 23 files in ./images"
