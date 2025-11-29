// app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // GoogleのOAuth2エンドポイントを叩いてアクセストークンを更新
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token refresh failed:', data);
      return NextResponse.json(data, { status: response.status });
    }

    // 新しいアクセストークンと有効期限を返す
    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in, // 秒単位 (通常3600)
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}