# Security policy

## Supported version

Security fixes target the latest commit on `master` and the current deployment at <https://okturan.github.io/gcp-audit-dashboard/>. Older commits, forks, and third-party deployments are not maintained by this repository.

## Report a vulnerability privately

Please use [GitHub private vulnerability reporting](https://github.com/okturan/gcp-audit-dashboard/security/advisories/new). Do not disclose a suspected vulnerability in a public issue, discussion, or pull request before a fix is available.

A useful report includes:

- The affected route, commit, browser, and operating system
- Reproduction steps using the built-in synthetic dataset whenever possible
- The security impact and the boundary an attacker crosses
- A minimal proof of concept that does not contain credentials, private GCP exports, customer information, or other personal data
- A suggested mitigation, if you have one

Relevant reports include unsafe audit-export handling, script or markup injection, exposure of imported cloud metadata, dependency or workflow compromise, and deployment behavior that violates the client-side privacy boundary documented in the README.

## Coordinated disclosure

Reports will be reviewed through the private advisory. Please keep the details private while impact and remediation are evaluated. Credit can be included in a published advisory when requested and appropriate.

This repository is a client-side demonstration built around synthetic data. Do not test against cloud projects, credentials, exports, or accounts you do not own or have explicit permission to assess.
