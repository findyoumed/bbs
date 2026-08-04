# Lazy Post Attachment Service Walkthrough

LOG_ID: 20260804_1114

## Summary
- Extracted attachment-related behavior from the post service into a dedicated lazy-loaded module to reduce the initial dependency surface.
- Preserved the existing public API on the post service so callers continue to use the same method names.
- Added a retry-safe lazy loader so a failed attachment-module initialization will not leave the service in a permanently broken state.

## What changed
1. Created `public/js/core/postAttachmentService.js` with the existing attachment behaviors for listing, uploading, naming, and downloading files.
2. Updated `public/js/core/postService.js` to load that module only on first attachment use.
3. Kept the post-service methods `loadAttachments`, `uploadAttachment`, `pickAttachmentDownloadName`, and `downloadAttachment` intact for compatibility.

## Verification
- `node --check public/js/core/postService.js`
- `node --check public/js/core/postAttachmentService.js`
- `npm run qa:final`
- `npm run loop:verify`
- `git diff --check`
- `wc -l public/js/core/postService.js`
