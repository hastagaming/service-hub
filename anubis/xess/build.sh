#!/data/data/com.termux/files/usr/bin/bash

set -euo pipefail

cd "$(dirname "$0")"
postcss ./xess.css -o xess.min.css