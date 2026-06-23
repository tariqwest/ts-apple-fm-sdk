#!/usr/bin/env bash
# Prepare and publish apple-fm-sdk to npm and GitHub Releases.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION_TYPE="${1:-patch}"
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]" >&2
  exit 1
fi

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is required. Install: https://cli.github.com/" >&2
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: gh is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
}

package_version() {
  node -p "require('./package.json').version"
}

cleanup_release_artifacts() {
  rm -f apple-fm-sdk-*.tgz
}

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "master" && "$BRANCH" != "main" ]]; then
  echo "Error: release from master/main only (current: $BRANCH)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean" >&2
  exit 1
fi

require_gh

echo "Building release artifacts..."
bun run build:release

echo "Running unit tests..."
bun run test

echo "Dry-run pack..."
npm pack --dry-run

read -r -p "Bump $VERSION_TYPE, publish to npm, and create a GitHub release? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

npm version "$VERSION_TYPE" --no-git-tag-version
VERSION="$(package_version)"
TAG="v${VERSION}"

git add package.json
git commit -m "chore: release ${TAG}"

echo "Creating git tag ${TAG}..."
git tag "${TAG}"

echo "Packing release tarball..."
cleanup_release_artifacts
npm pack
TARBALL="apple-fm-sdk-${VERSION}.tgz"
if [[ ! -f "$TARBALL" ]]; then
  echo "Error: expected tarball ${TARBALL} not found after npm pack" >&2
  exit 1
fi
trap cleanup_release_artifacts EXIT

echo "Publishing to npm..."
npm publish --access public

echo "Pushing commit and tag to GitHub..."
git push origin HEAD
git push origin "${TAG}"

echo "Creating GitHub release ${TAG}..."
if gh release view "${TAG}" >/dev/null 2>&1; then
  echo "GitHub release ${TAG} already exists; uploading tarball asset..."
  gh release upload "${TAG}" "${TARBALL}" --clobber
else
  gh release create "${TAG}" \
    --title "apple-fm-sdk ${TAG}" \
    --generate-notes \
    "${TARBALL}"
fi

RELEASE_URL="$(gh release view "${TAG}" --json url --jq .url)"

cleanup_release_artifacts
trap - EXIT

echo ""
echo "Release complete:"
echo "  npm:    apple-fm-sdk@${VERSION}"
echo "  github: ${RELEASE_URL}"