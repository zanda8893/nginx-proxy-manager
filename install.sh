#!/usr/bin/env bash

# Copyright (c) 2021-2024 tteck
# Author: tteck (tteckster)
# License: MIT
# https://github.com/tteck/Proxmox/raw/main/LICENSE

echo "Installing Dependencies"
apt-get update
apt-get -y install \
  sudo \
  mc \
  curl \
  gnupg \
  make \
  gcc \
  g++ \
  ca-certificates \
  apache2-utils \
  logrotate \
  build-essential \
  git \
  wget
echo "Dependencies Installed"

echo "Installing Python Dependencies"
apt-get install -y \
  python3 \
  python3-dev \
  python3-pip \
  python3-venv \
  python3-cffi
pip3 install certbot certbot-dns-multi --break-system-packages
python3 -m venv /opt/certbot/
ln -s /usr/local/bin/certbot /usr/bin/certbot
rm -rf /usr/lib/python3.*/EXTERNALLY-MANAGED
echo "Python Dependencies Installed"

VERSION="$(awk -F'=' '/^VERSION_CODENAME=/{ print $NF }' /etc/os-release)"

echo "Installing Openresty"
wget -qO - https://openresty.org/package/pubkey.gpg | gpg --dearmor -o /etc/apt/trusted.gpg.d/openresty-archive-keyring.gpg
echo -e "deb http://openresty.org/package/debian bullseye openresty" >/etc/apt/sources.list.d/openresty.list
apt-get update
apt-get -y install openresty
echo "Openresty Installed"

echo "Installing Node.js"
bash <(curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh)
source ~/.bashrc
nvm install 16.20.2
ln -sf /root/.nvm/versions/node/v16.20.2/bin/node /usr/bin/node
echo "Node.js Installed"

echo "Installing pnpm"
npm install -g pnpm@8.15
echo "pnpm Installed"

RELEASE=$(curl -s https://api.github.com/repos/NginxProxyManager/nginx-proxy-manager/releases/latest |
  grep "tag_name" |
  awk '{print substr($2, 3, length($2)-4) }')

echo "Setting up Environment"
ln -sf /usr/bin/python3 /usr/bin/python
ln -sf /usr/bin/certbot /opt/certbot/bin/certbot
ln -sf /usr/local/openresty/nginx/sbin/nginx /usr/sbin/nginx
ln -sf /usr/local/openresty/nginx/ /etc/nginx

sed -i 's+^daemon+#daemon+g' docker/rootfs/etc/nginx/nginx.conf

NGINX_CONFS=$(find "$(pwd)" -type f -name "*.conf")
for NGINX_CONF in $NGINX_CONFS; do
  sed -i 's+include conf.d+include /etc/nginx/conf.d+g' "$NGINX_CONF"
done

mkdir -p /var/www/html /etc/nginx/logs
cp -r docker/rootfs/var/www/html/* /var/www/html/
cp -r docker/rootfs/etc/nginx/* /etc/nginx/
cp docker/rootfs/etc/letsencrypt.ini /etc/letsencrypt.ini
cp docker/rootfs/etc/logrotate.d/nginx-proxy-manager /etc/logrotate.d/nginx-proxy-manager
ln -sf /etc/nginx/nginx.conf /etc/nginx/conf/nginx.conf
rm -f /etc/nginx/conf.d/dev.conf

mkdir -p /tmp/nginx/body /run/nginx /data/nginx /data/custom_ssl /data/logs /data/access /data/nginx/default_host \
/data/nginx/default_www /data/nginx/proxy_host /data/nginx/redirection_host /data/nginx/stream /data/nginx/dead_host \
/data/nginx/temp /var/lib/nginx/cache/public /var/lib/nginx/cache/private /var/cache/nginx/proxy_temp

chmod -R 777 /var/cache/nginx
chown root /tmp/nginx

echo resolver "$(awk 'BEGIN{ORS=" "} $1=="nameserver" {print ($2 ~ ":")? "["$2"]": $2}' /etc/resolv.conf);" >/etc/nginx/conf.d/include/resolvers.conf

if [ ! -f /data/nginx/dummycert.pem ] || [ ! -f /data/nginx/dummykey.pem ]; then
  openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 -subj "/O=Nginx Proxy Manager/OU=Dummy Certificate/CN=localhost" \
  -keyout /data/nginx/dummykey.pem -out /data/nginx/dummycert.pem &>/dev/null
fi

mkdir -p /app/global /app/frontend/images
cp -r backend/* /app
cp -r global/* /app/global
echo "Environment Set Up"

echo "Building Frontend"
cd ./frontend
pnpm install
pnpm upgrade
pnpm run build
cp -r dist/* /app/frontend
cp -r app-images/* /app/frontend/images
echo "Frontend Built"

echo "Initializing Backend"
rm -rf /app/config/default.json
if [ ! -f /app/config/production.json ]; then
  cat <<'EOF' >/app/config/production.json
{
  "database": {
    "engine": "knex-native",
    "knex": {
      "client": "sqlite3",
      "connection": {
        "filename": "/data/database.sqlite"
      }
    }
  }
}
EOF
fi
cd /app
pnpm install
pnpm install passport passport-oauth2
echo "Backend Initialized"

echo "Starting Openresty and NPM"
# Run OpenResty and NPM in the background
#/usr/local/openresty/nginx/sbin/nginx -g 'daemon off;' &   # Start OpenResty in the background
#cd /app && /usr/bin/node index.js --abort_on_uncaught_exception --max_old_space_size=250 &
# Star
