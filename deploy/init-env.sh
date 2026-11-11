#!/usr/bin/env bash
# Creates .env for the environment this folder belongs to (see lib.sh). Run by
# hand on the server, once: it never overwrites an existing .env.
# The database password and the login secret are generated here; the Resend
# API key is typed in hidden. No secret goes through a chat or git.
#
# Usage: init-env.sh
set -euo pipefail

cd "$(dirname "$0")"
source ./lib.sh

case "$env_name" in
  prod) app_url=https://app.lyna.tech ;;
  staging) app_url=https://test-app.lyna.tech ;;
esac

if [ -e .env ]; then
  echo "$PWD/.env already exists: nothing was changed. Edit it by hand if needed" >&2
  exit 1
fi

echo "Creating $PWD/.env for $env_name ($app_url)"
read -r -s -p "Resend API key for $env_name (hidden, starts with re_): " resend_key
echo
if [ -z "$resend_key" ]; then
  echo "No key: nothing was changed" >&2
  exit 1
fi
read -r -p "Your email (OWNER_EMAIL), only the address: " owner_email

db_password=$(openssl rand -hex 24)
auth_secret=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')

umask 077
cat >.env <<EOF
POSTGRES_USER=crm
POSTGRES_PASSWORD=$db_password
POSTGRES_DB=crm
DATABASE_URL=postgres://crm:$db_password@db:5432/crm
BETTER_AUTH_SECRET=$auth_secret
BETTER_AUTH_URL=$app_url
SMTP_URL=smtps://resend:$resend_key@smtp.resend.com:2465
OWNER_EMAIL=$owner_email
EOF
chmod 600 .env
echo "Created $PWD/.env (only you can read it)"
