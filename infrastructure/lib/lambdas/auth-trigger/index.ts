/**
 * YourPace — Cognito Custom Auth Trigger (Magic Link)
 *
 * Handles three Cognito Lambda triggers:
 *   1. DefineAuthChallenge   — decides what challenge to issue
 *   2. CreateAuthChallenge   — generates the magic link / OTP and sends email
 *   3. VerifyAuthChallenge   — validates the user's response
 *
 * Flow:
 *   User enters email → Cognito calls DefineAuthChallenge
 *   → Cognito calls CreateAuthChallenge (sends magic link email)
 *   → User clicks link / enters OTP
 *   → Cognito calls VerifyAuthChallenge
 *   → If correct, user is authenticated
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as crypto from 'crypto';

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

// ============================================
// Types
// ============================================
interface CognitoTriggerEvent {
  triggerSource: string;
  request: {
    userAttributes: Record<string, string>;
    challengeName?: string;
    session?: Array<{
      challengeName: string;
      challengeResult: boolean;
      challengeMetadata?: string;
    }>;
    challengeAnswer?: string;
    privateChallengeParameters?: Record<string, string>;
    publicChallengeParameters?: Record<string, string>;
  };
  response: {
    challengeName?: string;
    issueTokens?: boolean;
    failAuthentication?: boolean;
    publicChallengeParameters?: Record<string, string>;
    privateChallengeParameters?: Record<string, string>;
    challengeMetadata?: string;
    answerCorrect?: boolean;
  };
  userName: string;
}

// ============================================
// Handler
// ============================================
export const handler = async (event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> => {
  console.log('Auth trigger:', event.triggerSource, JSON.stringify(event, null, 2));

  switch (event.triggerSource) {
    case 'DefineAuthChallenge_Authentication':
      return defineAuthChallenge(event);

    case 'CreateAuthChallenge_Authentication':
      return createAuthChallenge(event);

    case 'VerifyAuthChallengeResponse_Authentication':
      return verifyAuthChallenge(event);

    default:
      console.warn('Unknown trigger source:', event.triggerSource);
      return event;
  }
};

// ============================================
// 1. Define Auth Challenge
// ============================================
function defineAuthChallenge(event: CognitoTriggerEvent): CognitoTriggerEvent {
  const session = event.request.session || [];

  if (session.length === 0) {
    // First attempt — issue custom challenge
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
  } else if (session.length === 1 && session[0].challengeResult === true) {
    // Challenge passed — issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // Failed or too many attempts
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
}

// ============================================
// 2. Create Auth Challenge (send magic link)
// ============================================
async function createAuthChallenge(event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> {
  // Generate a secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  // Get email from multiple sources (in order of preference)
  let email = event.request.userAttributes['email'];
  
  // Try clientMetadata (passed from frontend)
  if (!email && (event.request as any).clientMetadata?.email) {
    email = (event.request as any).clientMetadata.email;
  }
  
  // Try publicChallengeParameters (fallback)
  if (!email && event.request.publicChallengeParameters?.email) {
    email = event.request.publicChallengeParameters.email;
  }
  
  // Last resort: use userName if it looks like an email
  if (!email && event.userName && event.userName.includes('@')) {
    email = event.userName;
  }
  
  const domainName = process.env.DOMAIN_NAME || 'yourpace.cloud';
  const environment = process.env.ENVIRONMENT || 'dev';

  console.log(`CreateAuthChallenge: email="${email}", userName="${event.userName}", userNotFound=${(event.request as any).userNotFound}`);

  // Send magic link email via SES
  if (email && email.includes('@')) {
    try {
      const magicLink = `https://${domainName}/auth/verify?code=${otp}&email=${encodeURIComponent(email)}`;

      await ses.send(new SendEmailCommand({
        Source: `noreply@${domainName}`,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Your YourPace sign-in link' },
          Body: {
            Html: {
              Data: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                  <h2>Sign in to YourPace</h2>
                  <p>Click the link below to sign in. This link expires in 15 minutes.</p>
                  <a href="${magicLink}" style="
                    display: inline-block;
                    background: #000;
                    color: #fff;
                    padding: 12px 24px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-weight: bold;
                  ">Sign in to YourPace</a>
                  <p style="color: #666; font-size: 14px;">
                    Or enter this code: <strong>${otp}</strong>
                  </p>
                  <p style="color: #999; font-size: 12px;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                </div>
              `,
            },
            Text: {
              Data: `Sign in to YourPace\n\nYour code: ${otp}\n\nOr click: ${magicLink}\n\nExpires in 15 minutes.`,
            },
          },
        },
      }));

      console.log(`Magic link sent to ${email} (${environment})`);
    } catch (err) {
      console.error('Failed to send magic link email:', err);
      // Don't throw — still set the challenge so we don't leak info
    }
  }

  // Store OTP in private parameters (not exposed to client)
  event.response.publicChallengeParameters = {
    email: email || '',
  };
  event.response.privateChallengeParameters = {
    answer: otp,
    expiresAt: expiresAt.toString(),
  };
  event.response.challengeMetadata = `OTP_${otp}`;

  return event;
}

// ============================================
// 3. Verify Auth Challenge
// ============================================
async function verifyAuthChallenge(event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> {
  const expectedAnswer = event.request.privateChallengeParameters?.answer;
  const expiresAt = parseInt(event.request.privateChallengeParameters?.expiresAt || '0', 10);
  const providedAnswer = event.request.challengeAnswer;

  const isExpired = Date.now() > expiresAt;
  const isCorrect = providedAnswer === expectedAnswer;

  event.response.answerCorrect = isCorrect && !isExpired;

  if (isExpired) {
    console.log('OTP expired');
  } else if (!isCorrect) {
    console.log('OTP incorrect');
  } else {
    console.log('OTP verified successfully');
    // User is authenticated - Cognito will handle confirmation on next sign-in
  }

  return event;
}
