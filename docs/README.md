# YourPace Documentation

## CI/CD Setup

YourPace uses GitHub Actions for automated CI/CD with three environments: dev, staging, and production.

### Quick Start

1. **Setup Guide** - Start here: [`SETUP.md`](./SETUP.md)
2. **GitHub Secrets** - Configure secrets: [`GITHUB_SECRETS.md`](./GITHUB_SECRETS.md)
3. **Workflows** - See `.github/workflows/` for workflow definitions

### Key Files

- `.github/workflows/ci.yml` - CI checks and Amplify triggers
- `.github/workflows/deploy-infrastructure.yml` - Infrastructure deployment
- `.github/workflows/promote.yml` - Promotion workflow
- `infrastructure/.env.example` - Environment variable template

### Deployment Flow

```
develop → CI → Amplify → dev.yourpace.cloud
   ↓
Promote to staging → CI → Amplify → staging.yourpace.cloud
   ↓
Promote to main → CI → Amplify → yourpace.cloud
                → Infrastructure Deployment (if infra changed)
```

### Environment URLs

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | https://dev.{DOMAIN_NAME} | develop |
| Staging | https://staging.{DOMAIN_NAME} | staging |
| Production | https://{DOMAIN_NAME} | main |

Replace `{DOMAIN_NAME}` with your actual domain name (configured in GitHub secrets).

### Setup Time

- AWS OIDC: 10 minutes
- GitHub Secrets: 5 minutes
- Amplify Apps: 15 minutes
- Git Branches: 5 minutes
- Branch Protection: 5 minutes
- Testing: 15 minutes
- Infrastructure Multi-Env: 30 minutes
- **Total: ~90 minutes**

### Support

For issues:
1. Check GitHub Actions logs for error messages
2. Check AWS CloudFormation events for infrastructure errors
3. Check Amplify build logs for frontend build issues
4. See `SETUP.md` troubleshooting section

### Security

✅ OIDC authentication (no long-lived credentials)  
✅ Secrets stored in GitHub (not in code)  
✅ Destructive change detection  
✅ Manual approvals for production  
✅ Branch protection rules  

See `SETUP.md` for more details.
