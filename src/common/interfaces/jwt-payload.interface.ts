export interface JwtPayload {
  sub: string;
  role: 'customer' | 'admin' | 'super_admin' | 'viewer';
  phoneNumber?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}
