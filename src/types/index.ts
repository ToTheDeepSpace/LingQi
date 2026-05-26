export interface Creator {
  id: string;
  phone: string;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  tags: string[];
  city: string | null;
  role_type: string;
  social_links: Record<string, string>;
  wechat: string | null;
  is_visible: boolean;
  is_realname: boolean;
  reject_reason: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  creator_id: string;
  service_type: string;
  price: number;
  duration: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Availability {
  id: string;
  creator_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  note: string | null;
}

export interface Portfolio {
  id: string;
  creator_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuthData {
  id: string;
  display_name: string;
  phone: string;
  token: string;
}
