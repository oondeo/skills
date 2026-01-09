---
name: address_pr_comments
description: Addresses pull request comments using GitHub API. Use when you need to read and respond to PR review comments.
triggers:
- /address_pr_comments
inputs:
  - name: PR_URL
    description: "URL of the pull request"
  - name: BRANCH_NAME
    description: "Branch name corresponds to the pull request"
---

First, check the branch {{ BRANCH_NAME }} and read the diff against the main branch to understand the purpose.

This branch corresponds to this PR {{ PR_URL }}

Next, you should use the GitHub API to read the reviews and comments on this PR and address them.