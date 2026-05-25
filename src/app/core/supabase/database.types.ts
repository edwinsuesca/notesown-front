export interface Book {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  book_id: string;
  user_id: string;
  title: string;
  content: string;
  blind_index: string[];
  created_at: string;
  updated_at: string;
  last_read_at: string;
}

export interface UserKey {
  user_id: string;
  encrypted_cek: string;
  created_at: string;
  updated_at: string;
}
