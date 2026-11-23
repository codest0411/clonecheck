# Contributing to clonecheck

We welcome contributions to make clonecheck better.

## Development Workflow

1. Ensure Node.js 20+ and Git are installed.
2. Clone repository and run `npm install`.
3. Validate changes:
   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run test:coverage
   ```
4. PRs must preserve >= 90% line coverage and zero runtime dependencies.
