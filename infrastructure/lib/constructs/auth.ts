import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface AuthProps {
  readonly environment: string;
  readonly domainName?: string;
  readonly certificate?: acm.ICertificate;
}

/**
 * Auth Construct — Cognito User Pool with Managed Login (OAuth2/OIDC).
 *
 * Features:
 *   - Cognito Managed Login (hosted UI)
 *   - Custom domain: auth.yourpace.cloud
 *   - OAuth2/OIDC standard flow
 *   - Email-based sign-in
 *   - No custom Lambda triggers (eliminates circular dependency)
 *   - Professional UX
 */
export class Auth extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly authDomain: string;
  public readonly cognitoDomainName: string;  // AWS-managed Cognito domain for Route53 CNAME

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';

    // ============================================
    // Cognito User Pool (simplified, no triggers)
    // ============================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `yourpace-${props.environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      // Auto-verify emails via Cognito Managed Login
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // Use Cognito's built-in email (no SES Lambda trigger needed)
      email: cognito.UserPoolEmail.withCognito(),
    });

    // ============================================
    // App Client — Web App (OAuth2 code flow)
    // ============================================
    this.userPoolClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: `yourpace-web-${props.environment}`,
      generateSecret: false, // SPA — no client secret
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: props.domainName
          ? [
              `https://${props.domainName}/auth/callback`,
              `https://www.${props.domainName}/auth/callback`,
              'http://localhost:3000/auth/callback', // Local dev
            ]
          : ['http://localhost:3000/auth/callback'],
        logoutUrls: props.domainName
          ? [
              `https://${props.domainName}`,
              `https://www.${props.domainName}`,
              'http://localhost:3000',
            ]
          : ['http://localhost:3000'],
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // ============================================
    // Cognito Managed Login — Custom Domain
    // ============================================
    // Domain format: auth.yourpace.cloud (or auth-dev.yourpace.cloud for non-prod)
    const authSubdomain = props.environment === 'prod'
      ? 'auth'
      : `auth-${props.environment}`;

    const authDomainName = props.domainName
      ? `${authSubdomain}.${props.domainName}`
      : undefined;

    // Configure domain based on whether we have a custom domain and certificate
    if (authDomainName && props.certificate) {
      // Use custom domain with ACM certificate
      this.userPoolDomain = this.userPool.addDomain('Domain', {
        customDomain: {
          domainName: authDomainName,
          certificate: props.certificate,
        },
      });
      this.authDomain = authDomainName;
      // For custom domains, the cognitoDomainName is the same as authDomain
      this.cognitoDomainName = authDomainName;
    } else {
      // Fall back to AWS-managed Cognito domain
      const domainPrefix = `yourpace-auth-${props.environment}`;
      this.userPoolDomain = this.userPool.addDomain('Domain', {
        cognitoDomain: {
          domainPrefix,
        },
      });
      this.authDomain = `${domainPrefix}.auth.eu-west-1.amazoncognito.com`;
      this.cognitoDomainName = this.authDomain;
    }

    this.userPoolId = this.userPool.userPoolId;
    this.userPoolClientId = this.userPoolClient.userPoolClientId;

    // ============================================
    // Stack Outputs
    // ============================================
    new cdk.CfnOutput(scope, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(scope, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    new cdk.CfnOutput(scope, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(scope, 'AuthDomain', {
      value: this.authDomain,
      description: 'Cognito Managed Login domain',
    });

    new cdk.CfnOutput(scope, 'HostedUIUrl', {
      value: `https://${this.authDomain}/login?client_id=${this.userPoolClientId}&response_type=code&scope=openid+email+profile&redirect_uri=https://${props.domainName || 'localhost:3000'}/auth/callback`,
      description: 'Cognito Managed Login URL',
    });
  }
}
