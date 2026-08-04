# BBS Startup Latency Optimization Checklist

LOG_ID: 20260804_1405

- [x] Remove the font/network critical-path block while preserving fallback styling.
- [x] Start authentication and public bootstrap work without an avoidable serial waterfall.
- [x] Cache public bootstrap statistics longer and refresh them stale-while-revalidate.
- [x] Avoid nonessential repository health probes during cold startup.
- [x] Enable Brotli/gzip for local Node static assets and strengthen Vercel static cache headers safely.
- [x] Add/adjust performance assertions for readiness, cache headers, compression, and API behavior.
- [x] Run syntax checks, requested smoke tests, and startup performance harness.
- [x] Record complete evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
