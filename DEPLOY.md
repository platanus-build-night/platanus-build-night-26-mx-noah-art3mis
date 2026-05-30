# Deploying VERITRACE

The Next.js app lives at the **repo root**. The build-night org repo can't be connected to Vercel, so we mirror to a personal repo and deploy from there. Commits stay mirrored to the org repo for judging.

## 1. Create a personal repo (one time)

```bash
gh repo create veritrace --private --source=. --remote=personal --push=false
# (omit --private for a public repo; pick any name in place of "veritrace")
```

This creates `https://github.com/noah-art3mis/veritrace` under your account. We pass `--push=false` because we want a *dual* push remote set up next, not a separate `personal` remote.

If you'd rather not use `gh`, create the empty repo at https://github.com/new and note its URL.

## 2. Point `origin` at BOTH repos for push

So one `git push` updates the org repo (judging) and your personal repo (deploy):

```bash
git remote set-url --add --push origin https://github.com/platanus-build-night/platanus-build-night-26-mx-noah-art3mis.git
git remote set-url --add --push origin https://github.com/noah-art3mis/veritrace.git
git push origin main          # now goes to both
```

Verify with `git remote -v` — `origin (push)` should list two URLs.

## 3. Import into Vercel (from the personal repo)

In the Vercel dashboard → **Add New… → Project** → import `noah-art3mis/veritrace`, then:

- **Root Directory:** leave as the repo root (`./`) — the app is no longer in a subdirectory
- **Framework Preset:** Next.js (auto-detected)
- **Build / Install / Output:** leave as defaults

### Environment variables (Production + Preview)

Add these two (values are in `.env.local`, which is gitignored and NOT in the repo):

| Name                | Where it's used            |
| ------------------- | -------------------------- |
| `ANTHROPIC_API_KEY` | claim extraction / verify  |
| `EXA_API_KEY`       | de-novo evidence retrieval |

Optional: `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-6`).

## 4. Deploy

Click **Deploy**. After the first deploy, every `git push origin main` auto-deploys (and also lands on the org repo).

## Notes

- The `/api/check` route sets `maxDuration = 60`. On the Vercel Hobby plan this is allowed; the pipeline runs ~10–13s. Because the response **streams**, the graph starts building immediately.
- If live retrieval ever times out or fails on stage, the workbench automatically replays a **cached run** for the three demo chips (see `lib/demo-cache.ts`) — the demo still works fully offline.
- Rehearsing the demo chips **warms Exa's cache**, so on stage they return as fast cache hits.
