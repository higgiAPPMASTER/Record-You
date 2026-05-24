#!/bin/bash
set -e
corepack enable || true
corepack prepare pnpm@10.26.1 --activate || true
