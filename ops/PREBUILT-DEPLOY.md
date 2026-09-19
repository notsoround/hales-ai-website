# Prebuilt website deployment

`deploy-prebuilt-hales-ai.sh` builds and validates the exact `origin/main` commit on the Mac. The shared server receives only static `dist` files, their checksum manifest, nginx configuration, and a two-`COPY` Dockerfile with no `RUN` instruction.

The command requires the reviewed Cupcake page SHA explicitly:

```bash
ops/deploy-prebuilt-hales-ai.sh \
  --release-commit "$(git rev-parse origin/main)" \
  --page-sha256 REVIEWED_SHA256
```

That is inspection/build only. Add `--apply` only after reviewing the release commit, page hash, local Cupcake lint/typecheck/build result, artifact hashes, and this script's diff.

The server refuses a missing pinned nginx image, takes a nonblocking deployment lock, requires memory/disk headroom, and proves the running rollback image healthy before a swap. It disables build networking, uses the current Docker 26 legacy builder's supported memory/CFS quota flags without an unbounded fallback, gives the uniquely named candidate container its own limits, verifies every dist file, smoke-tests HAL, public-chat bundle presence, and Cupcake, then replaces only `hales-ai-website`. The previous image receives a timestamped rollback tag and is restored and smoke-tested automatically if the live smoke test fails. Cleanup removes only the candidate container created by that invocation. It does not run npm, install packages, pull images, reset the server checkout, or use `ALLOW_CANONICAL_OVERRIDE`.

The pinned nginx image is the exact eight-layer prefix of the current production image as verified on September 19, 2026. If it is ever absent or production moves to a different base, update it only after comparing the production root layers; do not enable pulls as a fallback.

The whole-repository lint currently reports six pre-existing explicit-any errors in unchanged BentoGrid, Navbar and SocialFeeds files. This release leaves those public-site components alone; its gate checks the complete Cupcake component directory and page, plus the whole TypeScript project. That limitation is not reported as a clean full-repository lint run.
