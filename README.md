# YourPace

A modern fitness tracking application with enterprise-grade CI/CD infrastructure.

## Overview

YourPace is a Next.js-based fitness application with:
- **Frontend**: Next.js with Cognito authentication
- **Infrastructure**: AWS CDK with multi-environment support (dev, staging, production)
- **CI/CD**: GitHub Actions with automated testing, building, and deployment
- **Hosting**: AWS Amplify for frontend, CloudFront for CDN

## Architecture

### Multi-Environment Infrastructure

```mermaid
graph TB
    subgraph "AWS Account (eu-west-1)"
        subgraph "Cognito"
            Auth["User Pool<br/>(Managed Login)"]
            AuthDomain["Auth Domain<br/>(AWS-managed)"]
            CustomAuth["Custom Domain<br/>auth.yourpace.cloud<br/>(Production Only)"]
        end
        
        subgraph "Frontend - Production"
            S3Prod["S3 Bucket<br/>(Static Files)"]
            CFProd["CloudFront<br/>(CDN)"]
            Route53["Route53<br/>(DNS)"]
        end
        
        subgraph "Frontend - Staging"
            S3Stg["S3 Bucket<br/>(Static Files)"]
            CFStg["CloudFront<br/>(CDN)"]
        end
        
        subgraph "Frontend - Dev"
            S3Dev["S3 Bucket<br/>(Static Files)"]
            CFDev["CloudFront<br/>(CDN)"]
        end
        
        subgraph "Database"
            DDB["DynamoDB Tables<br/>Users, Workouts, Exercises, Goals"]
        end
        
        subgraph "Networking"
            VPC["VPC<br/>(Network Isolation)"]
            SG["Security Group<br/>(Lambda Access)"]
        end
    end
    
    subgraph "DNS"
        DNS1["yourpace.cloud"]
        DNS2["www.yourpace.cloud"]
        DNS3["staging.yourpace.cloud"]
        DNS4["dev.yourpace.cloud"]
        DNS5["auth.yourpace.cloud"]
    end
    
    Auth --> AuthDomain
    AuthDomain --> CustomAuth
    
    S3Prod --> CFProd
    S3Stg --> CFStg
    S3Dev --> CFDev
    
    CFProd --> DNS1
    CFProd --> DNS2
    CFStg --> DNS3
    CFDev --> DNS4
    CustomAuth --> DNS5
    
    CFProd --> DDB
    CFStg --> DDB
    CFDev --> DDB
    
    DDB --> VPC
    VPC --> SG
```

### Frontend Architecture

```mermaid
graph TD
    A["Next.js App<br/>App Router"] --> B["Authentication"]
    B --> B1["Cognito Provider"]
    B --> B2["OAuth2 Flow"]
    
    A --> C["Route Groups"]
    C --> C1["(app) - Protected"]
    C --> C2["auth - Public"]
    C --> C3["Root - Public"]
    
    C1 --> C1a["dashboard"]
    C1 --> C1b["workouts"]
    C1 --> C1c["goals"]
    C1 --> C1d["profile"]
    
    C2 --> C2a["signin"]
    C2 --> C2b["signup"]
    C2 --> C2c["callback"]
    
    A --> D["Components"]
    D --> D1["UI Components"]
    D --> D2["Auth Provider"]
    
    A --> E["Libraries"]
    E --> E1["Auth Utils"]
    E --> E2["API Client"]
    E --> E3["Utilities"]
```

### CI/CD Pipeline - Multi-Environment

```mermaid
graph TB
    subgraph "GitHub"
        Dev["develop branch"]
        Stg["staging branch"]
        Main["main branch"]
    end
    
    subgraph "GitHub Actions"
        DevCI["Infrastructure Deploy<br/>+ Frontend Build"]
        StgCI["Infrastructure Deploy<br/>+ Frontend Build"]
        ProdCI["Infrastructure Deploy<br/>+ Frontend Build"]
    end
    
    subgraph "AWS Deployments"
        DevDeploy["dev.yourpace.cloud<br/>CloudFront + S3"]
        StgDeploy["staging.yourpace.cloud<br/>CloudFront + S3"]
        ProdDeploy["yourpace.cloud<br/>www.yourpace.cloud<br/>auth.yourpace.cloud<br/>CloudFront + S3 + Cognito"]
    end
    
    Dev -->|Push| DevCI
    Stg -->|Push| StgCI
    Main -->|Push| ProdCI
    
    DevCI -->|Deploy| DevDeploy
    StgCI -->|Deploy| StgDeploy
    ProdCI -->|Deploy| ProdDeploy
    
    DevDeploy -->|Promote| Stg
    StgDeploy -->|Promote| Main
```

### Deployment Sequence

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant GHA as GitHub Actions
    participant AWS as AWS
    participant CF as CloudFront
    participant Cognito as Cognito

    Dev->>GH: Push to develop
    GH->>GHA: Trigger deploy-infrastructure.yml
    GHA->>GHA: Build frontend & infrastructure
    GHA->>AWS: Deploy CDK (dev environment)
    AWS->>CF: Update CloudFront (dev)
    CF->>CF: Invalidate cache
    
    Note over Dev,CF: Dev deployment complete
    
    Dev->>GH: Merge develop → staging
    GH->>GHA: Trigger deploy-infrastructure.yml
    GHA->>AWS: Deploy CDK (staging environment)
    AWS->>CF: Update CloudFront (staging)
    
    Note over Dev,CF: Staging deployment complete
    
    Dev->>GH: Merge staging → main
    GH->>GHA: Trigger deploy-infrastructure.yml
    GHA->>AWS: Deploy CDK (prod environment)
    AWS->>CF: Update CloudFront (prod)
    AWS->>Cognito: Configure custom domain
    Cognito->>Cognito: Provision auth.yourpace.cloud
    
    Note over Dev,Cognito: Production deployment complete
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
