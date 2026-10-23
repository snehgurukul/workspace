# Sneh Workspace

Sneh Gurukool's team workspace: projects, boards, sprints, releases, bugs, QA, calendar, wiki, files, whiteboards and team.
It runs entirely on GitHub. This public repository holds only the app's code; all workspace data lives in the private
`snehgurukul/webapp` repository, and each person reads it with their own GitHub key.


- **Site:** a static React app published by GitHub Pages (`.github/workflows/deploy.yml` on every push to `main`).
- **Sign-in:** each person pastes a GitHub personal access token (`repo` and `notifications` scopes). It stays in their browser.
- **Access and roles:** collaborators on `snehgurukul/webapp`. Admin = admin, Maintain = manager, Write = member, Read = viewer.
- **Tasks:** GitHub Issues in `snehgurukul/webapp`. Labels hold project, status, type, priority and release
  (`project:KEY`, `status:Name`, `type:bug`, `priority:high`, `release:v1`). Due date, estimate, bug details, parent and
  blockers sit in a hidden `<!-- sneh:{…} -->` comment at the end of the issue body. Sprints are milestones named `KEY · Sprint name`.
- **Everything else** lives on the `workspace-data` branch:
  - `config.json`: projects, workflows (board columns) and releases
  - `wiki/<space>/<Title>.md`, with sub-pages in `wiki/<space>/<Title>/`; history is the git history
  - `files/…` uploads, `files/tasks/<number>/…` task attachments
  - `qa/<KEY>.json` test cases and runs
  - `whiteboards/<id>.json`
- **Notifications:** GitHub's own (bell in the app, email, GitHub Mobile).
- **Code links:** mention `#123` in a commit or pull request; `Fixes #123` closes the task on merge.
- **Team chat alerts:** a workflow in `snehgurukul/webapp`; add the secret `ALERTS_WEBHOOK_URL` there.

## Develop

```
npm install
npm run dev
```

Set `VITE_REPO_OWNER` / `VITE_REPO_NAME` to point at another repository.
