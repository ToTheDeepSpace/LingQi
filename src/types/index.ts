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
  social_snapshots?: Record<string, SocialSnapshot>;
  wechat: string | null;
  available_cities?: string[];
  travel_status?: string | null;
  contact_unlock_enabled?: boolean;
  contact_intent_amount?: number;
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
  city: string | null;
  location: string | null;
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

export interface SocialSnapshot {
  url: string;
  title?: string;
  description?: string;
  platform?: string;
  captured_at?: string;
}

export interface Commission {
  id: string;
  poster_id: string;
  poster_name: string;
  poster_is_realname: boolean;
  title: string;
  content: string;
  desired_role: string | null;
  target_type: string | null;
  needed_date: string | null;
  city: string | null;
  location: string | null;
  budget: string | null;
  contact_note: string | null;
  ai_assist_context?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
}
