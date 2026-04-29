export interface TokenPayload {
  sub: string;
  role: string;
  user_id: number;
  email?: string;
  phone_number?: string;
  address?: string;
  department?: string;
  exp: number;
}
