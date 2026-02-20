# YourPace

A modern fitness tracking application with enterprise-grade CI/CD infrastructure.

## Overview

YourPace is a Next.js-based fitness application with:
- **Frontend**: Next.js with Cognito authentication
- **Infrastructure**: AWS CDK with multi-environment support (dev, staging, production)
- **CI/CD**: GitHub Actions with automated testing, building, and deployment
- **Hosting**: AWS Amplify for frontend, CloudFront for CDN

## Architecture

### Frontend Structure

```mermaid
graph TD
    A["Next.js App"] --> B["App Directory"]
    B --> C["Auth Routes"]
    B --> D["Protected Routes"]
    B --> E["Public Routes"]
    
    C --> C1["signin"]
    C --> C2["signup"]
    C --> C3["auth/callback"]
    
    D --> D1["dashboard"]
    D --> D2["workouts"]
    D --> D3["goals"]
    D --> D4["profile"]
    
    E --> E1["home"]
    
    A --> F["Components"]
    F --> F1["UI Components"]
    F --> F2["Auth Provider"]
    
    A --> G["Libraries"]
    G --> G1["Auth Utils"]
    G --> G2["API Client"]
    G --> G3["Utilities"]
```

### Infrastructure Architecture

```mermaid
graph TB
    subgraph "AWS Account"
        subgraph "Cognito"
            Auth["User Pool<br/>Managed Login"]
        end
        
        subgraph "Frontend"
            S3["S3 Bucket<br/>Static Files"]
            CF["CloudFront<br/>CDN"]
            Route53["Route53<br/>DNS"]
        end
        
        subgraph "Backend"
            API["API Gateway<br/>HTTP API"]
            Lambda["Lambda<br/>Functions"]
        end
        
        subgraph "Database"
            DDB["DynamoDB<br/>Tables"]
        end
        
        subgraph "Networking"
            VPC["VPC"]
            NAT["NAT Gateway"]
        end
    end
    
    S3 --> CF
    CF --> Route53
    Auth --> API
    API --> Lambda
    Lambda --> DDB
    Lambda --> VPC
    VPC --> NAT
```

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Development"
        Dev["develop branch"]
        DevCI["CI Workflow"]
        DevAmp["Amplify Build"]
        DevDeploy["dev.{DOMAIN}"]
    end
    
    subgraph "Staging"
        Stg["staging branch"]
        StgCI["CI Workflow"]
        StgAmp["Amplify Build"]
        StgDeploy["staging.{DOMAIN}"]
    end
    
    subgraph "Production"
        Prod["main branch"]
        ProdCI["CI Workflow"]
        ProdAmp["Amplify Build"]
        ProdInfra["Infrastructure Deploy"]
        ProdDeploy["{DOMAIN}"]
    end
    
    Dev --> DevCI --> DevAmp --> DevDeploy
    
    DevDeploy -->|Promote| Stg
    Stg --> StgCI --> StgAmp --> StgDeploy
    
    StgDeploy -->|Promote| Prod
    Prod --> ProdCI --> ProdAmp --> ProdDeploy
    ProdCI --> ProdInfra
```

### Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant GHA as GitHub Actions
    participant Amp as Amplify
    participant AWS as AWS

    Dev->>GH: Push to develop
    GH->>GHA: Trigger CI Workflow
    GHA->>GHA: Lint & Build
    GHA->>Amp: Trigger Webhook
    Amp->>Amp: Build & Deploy
    Amp->>AWS: Update CloudFront
    
    Note over Dev,AWS: Development Complete
    
    Dev->>GHA: Manual: Promote develop→staging
    GHA->>GH: Create PR
    Dev->>GH: Review & Merge
    GH->>GHA: Trigger CI Workflow
    GHA->>Amp: Trigger Webhook
    Amp->>AWS: Deploy to staging
    
    Note over Dev,AWS: Staging Complete
    
    Dev->>GHA: Manual: Promote staging→main
    GHA->>GH: Create PR
    Dev->>GH: Review & Merge
    GH->>GHA: Trigger CI + Infrastructure
    GHA->>Amp: Trigger Webhook
    GHA->>AWS: Deploy Infrastructure
    Amp->>AWS: Deploy to production
```

## Project Structure

```
yourpace/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # Next.js app directory
│   │   ├── (app)/           # Protected routes
│   │   ├── auth/            # Auth routes
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components
│   │   └── ui/              # UI components
│   ├── lib/                 # Utilities and helpers
│   └── package.json         # Frontend dependencies
├── infrastructure/          # AWS CDK infrastructure
│   ├── lib/                 # CDK constructs
│   │   ├── constructs/      # Reusable constructs
│   │   ├── lambdas/         # Lambda functions
│   │   └── stacks/          # CDK stacks
│   ├── bin/                 # CDK entry point
│   └── package.json         # Infrastructure dependencies
├── .github/
│   └── workflows/           # GitHub Actions workflows
│       ├── ci.yml           # CI checks and Amplify triggers
│       ├── deploy-infrastructure.yml  # Infrastructure deployment
│       └── promote.yml      # Promotion workflow
├── docs/                    # Documentation
│   ├── README.md            # CI/CD overview
│   ├── SETUP.md             # Setup guide
│   └── GITHUB_SECRETS.md    # Secrets configuration
└── README.md                # This file
```

## Environments

| Environment | Branch | URL | Auto-Deploy |
|-------------|--------|-----|-------------|
| Development | develop | https://dev.{DOMAIN} | On push |
| Staging | staging | https://staging.{DOMAIN} | On merge |
| Production | main | https://{DOMAIN} | On merge |

## Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured with SSO profiles
- Git

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

**Infrastructure:**
```bash
cd infrastructure
npm install
npm run build
```

## Setup & Configuration

### For New Team Members

1. Read [`docs/README.md`](./docs/README.md) for overview
2. Follow [`docs/SETUP.md`](./docs/SETUP.md) for complete setup
3. Reference [`docs/GITHUB_SECRETS.md`](./docs/GITHUB_SECRETS.md) for secrets

### For Existing Setup

All sensitive configuration is stored in GitHub secrets. See [`docs/GITHUB_SECRETS.md`](./docs/GITHUB_SECRETS.md) for the complete list.

## Development Workflow

### Making Changes

1. Create a feature branch from `develop`
2. Make your changes
3. Push to your branch
4. Create a PR to `develop`
5. CI workflow runs automatically
6. After approval, merge to `develop`
7. Changes deploy to dev environment

### Promoting to Staging

1. Go to GitHub Actions → Promote workflow
2. Select "develop → staging"
3. Review the created PR
4. Merge the PR
5. Changes deploy to staging environment

### Promoting to Production

1. Go to GitHub Actions → Promote workflow
2. Select "staging → production"
3. Review the created PR
4. Merge the PR
5. Changes deploy to production environment
6. If infrastructure changed, deployment workflow runs with approval

## Security

### Best Practices

✅ **OIDC Authentication** - No long-lived AWS credentials in GitHub  
✅ **Secrets Management** - All sensitive values in GitHub secrets  
✅ **Destructive Change Detection** - Prevents accidental infrastructure deletion  
✅ **Manual Approvals** - Required for production infrastructure changes  
✅ **Branch Protection** - Enforced PR reviews before merging  
✅ **Audit Trail** - All deployments logged in GitHub Actions and AWS CloudTrail  

### Sensitive Information

⚠️ **Never commit:**
- AWS credentials or account IDs
- API keys or tokens
- Domain names or hosted zone IDs
- Amplify webhook URLs
- Any other secrets

All sensitive values must be stored in GitHub secrets.

## Troubleshooting

### CI Workflow Fails

1. Check GitHub Actions logs for error messages
2. Verify frontend builds locally: `cd frontend && npm run build`
3. Check Node.js version: `node --version` (should be 20+)

### Amplify Build Fails

1. Check Amplify console build logs
2. Verify environment variables are set correctly
3. Check frontend build locally

### Infrastructure Deployment Fails

1. Check CloudFormation events in AWS console
2. Verify AWS credentials and permissions
3. Check CDK context variables are passed correctly

### Webhook Not Triggering

1. Verify webhook URL in GitHub secrets
2. Check Amplify app webhook settings
3. Test webhook manually: `curl -X POST <WEBHOOK_URL> -H "Content-Type: application/json" -d '{}'`

## Documentation

- [`docs/README.md`](./docs/README.md) - CI/CD overview
- [`docs/SETUP.md`](./docs/SETUP.md) - Complete setup guide (8 phases)
- [`docs/GITHUB_SECRETS.md`](./docs/GITHUB_SECRETS.md) - Secrets configuration
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) - Infrastructure deployment details
- [`COGNITO_MANAGED_LOGIN_GUIDE.md`](./COGNITO_MANAGED_LOGIN_GUIDE.md) - Authentication setup

## Support

For issues or questions:

1. Check the relevant documentation file
2. Review GitHub Actions logs for error messages
3. Check AWS CloudFormation events for infrastructure errors
4. Check Amplify build logs for frontend issues

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure CI workflow passes
4. Create a PR with a clear description
5. Wait for approval and merge

## License

[Add your license here]

## Contact

[Add contact information here]

---

**Repository**: https://github.com/DigiAye/yourpace  
**Documentation**: See `docs/` directory  
**Last Updated**: February 20, 2026
