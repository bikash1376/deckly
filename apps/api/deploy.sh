#!/usr/bin/env bash
#
# Push secrets and deploy the Worker.
#
# Reads apps/api/.dev.vars and uploads each value as a Cloudflare secret for the
# named environment, then deploys. Values are piped straight into wrangler and
# never printed, so this is safe to run with someone watching your screen.
#
# Usage:
#   ./deploy.sh              deploy the production environment
#   ./deploy.sh --secrets    upload secrets only, do not deploy
#   ./deploy.sh --dry        show what would happen, change nothing
#
set -euo pipefail

cd "$(dirname "$0")"

ENVIRONMENT="production"
SECRETS_ONLY=false
DRY=false

for arg in "$@"; do
  case "$arg" in
    --secrets) SECRETS_ONLY=true ;;
    --dry)     DRY=true ;;
    --env=*)   ENVIRONMENT="${arg#*=}" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -f .dev.vars ]; then
  echo "No .dev.vars found. Copy .dev.vars.example and fill it in first." >&2
  exit 1
fi

# Every secret the Worker reads. CF_AI_GATEWAY_TOKEN is deliberately absent:
# it is optional, and pushing an empty secret is worse than pushing none.
REQUIRED=(
  DATABASE_URL
  CLERK_SECRET_KEY
  CLERK_PUBLISHABLE_KEY
  GROQ_API_KEY
  REVENUECAT_WEBHOOK_SECRET
)

echo "Checking authentication..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "" >&2
  echo "Not logged in to Cloudflare." >&2
  echo "Run this in your terminal first, it opens a browser:" >&2
  echo "" >&2
  echo "    npx wrangler login" >&2
  echo "" >&2
  exit 1
fi
npx wrangler whoami 2>/dev/null | grep -i "email\|account" || true

read_var() {
  # Pulls one KEY=value out of .dev.vars, stripping surrounding quotes.
  sed -n "s/^[[:space:]]*$1=//p" .dev.vars | head -1 | sed "s/^['\"]//; s/['\"]$//"
}

echo ""
echo "Secrets for environment: $ENVIRONMENT"

MISSING=()
for name in "${REQUIRED[@]}"; do
  value="$(read_var "$name" || true)"
  if [ -z "$value" ]; then
    MISSING+=("$name")
    printf '  %-28s MISSING\n' "$name"
    continue
  fi

  if [ "$DRY" = true ]; then
    printf '  %-28s would upload (%s chars)\n' "$name" "${#value}"
    continue
  fi

  # Piped, never echoed.
  printf '%s' "$value" | npx wrangler secret put "$name" --env "$ENVIRONMENT" >/dev/null 2>&1
  printf '  %-28s uploaded\n' "$name"
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "Missing from .dev.vars: ${MISSING[*]}" >&2
  echo "" >&2
  if printf '%s\n' "${MISSING[@]}" | grep -q REVENUECAT_WEBHOOK_SECRET; then
    echo "REVENUECAT_WEBHOOK_SECRET is only needed once you take payments." >&2
    echo "Without it the webhook rejects everything, which is the safe failure:" >&2
    echo "nobody can grant themselves premium, but real purchases will not land." >&2
    echo "" >&2
  fi
  if [ "$DRY" = false ] && [ ${#MISSING[@]} -gt 1 ]; then
    echo "Too many missing to deploy safely. Fill them in and re-run." >&2
    exit 1
  fi
fi

if [ "$SECRETS_ONLY" = true ] || [ "$DRY" = true ]; then
  echo ""
  echo "Stopping before deploy as requested."
  exit 0
fi

echo ""
echo "Deploying..."
npx wrangler deploy --env "$ENVIRONMENT"

echo ""
echo "Now check it is alive, replacing the host with the URL printed above:"
echo "    curl https://<worker-url>/health"
echo "    curl https://<worker-url>/health/db"
echo ""
echo "Then put that URL in apps/mobile/.env as EXPO_PUBLIC_API_URL and rebuild."
