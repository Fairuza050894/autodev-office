#!/bin/sh
set -eu
# Hanya container bootstrap tepercaya; tidak dijalankan oleh source klien.
case "$GITEA_USER" in ''|*[!a-zA-Z0-9_-]*) echo 'Invalid Gitea username' >&2; exit 1;; esac
users=$(su git -s /bin/sh -c 'gitea --config /data/gitea/conf/app.ini admin user list')
if ! printf '%s\n' "$users" | grep -Eq "[[:space:]]${GITEA_USER}[[:space:]]"; then
  su git -s /bin/sh -c 'gitea --config /data/gitea/conf/app.ini admin user create --username "$GITEA_USER" --password "$GITEA_PASSWORD" --email git@autodev.local --admin --must-change-password=false'
fi
if [ ! -s /integration/gitea-token ]; then
  umask 077
  su git -s /bin/sh -c 'gitea --config /data/gitea/conf/app.ini admin user generate-access-token --username "$GITEA_USER" --token-name "autodev-platform" --scopes all --raw' > /integration/gitea-token
  chmod 644 /integration/gitea-token
fi
