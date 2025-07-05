import { Response } from 'express';

export const createTokenCookie = (res: Response, name: string, value: string, maxAge: number) => {
  const domain = process.env.NODE_ENV === 'production' 
    ? process.env.COOKIE_DOMAIN 
    : '.local.example.com'; // ローカル環境では親ドメインを指定
    
  res.cookie(name, value, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE as 'strict' | 'lax' | 'none') || 'lax',
    maxAge: maxAge * 1000, // 秒をミリ秒に変換
    domain: domain,
    path: '/',
  });
};

export const clearTokenCookies = (res: Response) => {
  const domain = process.env.NODE_ENV === 'production' 
    ? process.env.COOKIE_DOMAIN 
    : '.local.example.com'; // ローカル環境では親ドメインを指定
    
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE as 'strict' | 'lax' | 'none') || 'lax',
    domain: domain,
    path: '/',
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('id_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
};