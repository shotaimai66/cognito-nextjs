import { Router, Request, Response } from 'express';
import { 
  CognitoIdentityProviderClient, 
  InitiateAuthCommand, 
  GetUserCommand,
  SignUpCommand,
  ConfirmSignUpCommand
} from '@aws-sdk/client-cognito-identity-provider';
import axios from 'axios';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler';
import { createTokenCookie, clearTokenCookies } from '../utils/cookies';

const router = Router();

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'ap-northeast-1',
});

// シークレットハッシュを生成する関数
const generateSecretHash = (username: string): string => {
  const message = username + process.env.COGNITO_CLIENT_ID;
  const hmac = crypto.createHmac('sha256', process.env.COGNITO_CLIENT_SECRET!);
  hmac.update(message);
  return hmac.digest('base64');
};

// Cognitoの認証コードをトークンに交換
router.post('/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    // Cognitoのトークンエンドポイントにリクエスト
    const tokenResponse = await axios.post(
      `${process.env.COGNITO_DOMAIN}/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.COGNITO_CLIENT_ID!,
        client_secret: process.env.COGNITO_CLIENT_SECRET!,
        redirect_uri: `${process.env.FRONTEND_URL}/auth/callback`,
        code,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, id_token, refresh_token } = tokenResponse.data;

    // HttpOnlyクッキーにトークンを保存
    createTokenCookie(res, 'access_token', access_token, 3600); // 1時間
    createTokenCookie(res, 'id_token', id_token, 3600);
    createTokenCookie(res, 'refresh_token', refresh_token, 30 * 24 * 3600); // 30日

    res.json({ success: true });
  } catch (error: any) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(401).json({ error: 'Failed to exchange authorization code' });
  }
}));

// 現在のユーザー情報を取得
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);

    const user = {
      username: response.Username,
      attributes: response.UserAttributes?.reduce((acc, attr) => {
        if (attr.Name && attr.Value) {
          acc[attr.Name] = attr.Value;
        }
        return acc;
      }, {} as Record<string, string>),
    };

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}));

// サインアップ
router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      SecretHash: generateSecretHash(email),
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
      ],
    });

    const response = await cognitoClient.send(command);
    
    res.json({
      success: true,
      userSub: response.UserSub,
      codeDeliveryDetails: response.CodeDeliveryDetails,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message || 'Signup failed' });
  }
}));

// サインアップ確認
router.post('/confirm-signup', asyncHandler(async (req: Request, res: Response) => {
  const { email, confirmationCode } = req.body;

  if (!email || !confirmationCode) {
    return res.status(400).json({ error: 'Email and confirmation code are required' });
  }

  try {
    const command = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      SecretHash: generateSecretHash(email),
      Username: email,
      ConfirmationCode: confirmationCode,
    });

    await cognitoClient.send(command);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Confirm signup error:', error);
    res.status(400).json({ error: error.message || 'Confirmation failed' });
  }
}));

// サインイン
router.post('/signin', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: generateSecretHash(email),
      },
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

      // Cookieにトークンを保存
      createTokenCookie(res, 'access_token', AccessToken!, 3600); // 1時間
      createTokenCookie(res, 'id_token', IdToken!, 3600);
      createTokenCookie(res, 'refresh_token', RefreshToken!, 30 * 24 * 3600); // 30日

      // ユーザー情報を取得
      const getUserCommand = new GetUserCommand({
        AccessToken: AccessToken!,
      });
      
      const userResponse = await cognitoClient.send(getUserCommand);
      
      const user = {
        username: userResponse.Username,
        attributes: userResponse.UserAttributes?.reduce((acc, attr) => {
          if (attr.Name && attr.Value) {
            acc[attr.Name] = attr.Value;
          }
          return acc;
        }, {} as Record<string, string>),
      };

      res.json({ success: true, user });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error: any) {
    console.error('Signin error:', error);
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
}));

// フロントエンドからトークンを受け取ってCookieに保存（互換性のため残す）
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, idToken, refreshToken } = req.body;

  if (!accessToken || !idToken) {
    return res.status(400).json({ error: 'Access token and ID token are required' });
  }

  try {
    // トークンの有効性を確認
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const userResponse = await cognitoClient.send(command);

    // トークンが有効な場合、Cookieに保存
    createTokenCookie(res, 'access_token', accessToken, 3600); // 1時間
    createTokenCookie(res, 'id_token', idToken, 3600);
    
    if (refreshToken) {
      createTokenCookie(res, 'refresh_token', refreshToken, 30 * 24 * 3600); // 30日
    }

    // ユーザー情報を返す
    const user = {
      username: userResponse.Username,
      attributes: userResponse.UserAttributes?.reduce((acc, attr) => {
        if (attr.Name && attr.Value) {
          acc[attr.Name] = attr.Value;
        }
        return acc;
      }, {} as Record<string, string>),
    };

    res.json({ success: true, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}));

// ログアウト
router.post('/logout', (_req: Request, res: Response) => {
  clearTokenCookies(res);
  res.json({ success: true });
});

// トークンのリフレッシュ
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token not found' });
  }

  try {
    const command = new InitiateAuthCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      const { AccessToken, IdToken } = response.AuthenticationResult;

      createTokenCookie(res, 'access_token', AccessToken!, 3600);
      createTokenCookie(res, 'id_token', IdToken!, 3600);

      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Failed to refresh token' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}));

export default router;