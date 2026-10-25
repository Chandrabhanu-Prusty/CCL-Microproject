# GitHub Workflow

Repository: https://github.com/Chandrabhanu-Prusty/CCL-Microproject

## Branches

- `main` — integrated and reasonably stable code.
- `feature/frontend` — Chandrabhanu.
- `feature/aws-auth-events` — Neilsen.
- `feature/rsvp-waitlist-checkin` — Preeti.

If a branch already exists, use it rather than creating a duplicate.

## Initial setup

1. Clone the repository locally.
2. Open the project root in Antigravity.
3. Use the scaffold prompt in `ANTIGRAVITY_PROMPTS.md`.
4. Add the supplied documentation under `docs/`.
5. Commit the initial structure.
6. Each member creates or checks out their assigned branch.

## Commit and pull request rules

- Commit focused changes with clear messages, e.g. `feat: add event listing page`.
- Pull latest `main` before starting a new task.
- Avoid changing another member's files unless agreed.
- Open a pull request into `main`.
- Describe the change, tests performed, environment variable names required, and known issues.
- Review and test before merging.

## Secrets and configuration

Never commit `.env` files, AWS access keys, JWT signing secrets, passwords, tokens, or private attendee data. Commit `.env.example` only with placeholder values and variable names. Use Vercel environment settings for frontend variables and Lambda environment settings for backend configuration.

## Suggested commit sequence

1. `docs: add Marque project documentation`
2. `chore: scaffold frontend and backend directories`
3. `feat: add frontend shell and routing`
4. `feat: add auth and event API`
5. `feat: add RSVP and waitlist workflows`
6. `feat: add ticket check-in and manual lookup`
7. `test: add MVP API and booking tests`
8. `docs: add deployment and demo instructions`
