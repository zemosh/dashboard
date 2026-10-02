#!/bin/sh
# Nahraje dashboard na borderku (https://home.zemosh.cz).
#
# Z PowerShellu ve složce projektu:  wsl ./deploy.sh
# rsync běží ve WSL, SSH přes Windows ssh.exe (klíč z Windows agenta, ~/.ssh/config).
set -eu
cd "$(dirname "$0")"

# Ve WSL systémový OpenSSH z Windows (ssh.exe z Gitu agenta s klíčem nevidí)
SSH=ssh
WIN_SSH=/mnt/c/Windows/System32/OpenSSH/ssh.exe
[ -x "$WIN_SSH" ] && SSH=$WIN_SSH

rsync -rtvz --delete --chmod=D755,F644 -e "$SSH" \
    --exclude '.git*' --exclude deploy.sh --exclude README.md \
    ./ borderka:/srv/sites/home.zemosh.cz/

echo
echo "Nahráno. Po změně souborů zvyš VERSION v sw.js, jinak si prohlížeče drží starou verzi."
