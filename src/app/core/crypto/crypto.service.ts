import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

const LOCAL_CEK_KEY = 'notesown-cek';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly db = inject(SupabaseService).client;

  readonly isReady = signal(false);

  private cek: CryptoKey | null = null;
  private hmacKey: CryptoKey | null = null;

  // ── Initialization ────────────────────────────────────────────────────────

  async initialize(password: string, userId: string): Promise<void> {
    const kek = await this.deriveKek(password, userId);

    const { data } = await this.db
      .from('user_keys')
      .select('encrypted_cek')
      .eq('user_id', userId)
      .single();

    let rawCek: Uint8Array<ArrayBuffer>;

    if (data?.encrypted_cek) {
      rawCek = await this.unwrapKey(data.encrypted_cek, kek);
    } else {
      rawCek = new Uint8Array(32);
      crypto.getRandomValues(rawCek);
      const encryptedCek = await this.wrapKey(rawCek, kek);
      await this.db
        .from('user_keys')
        .upsert({ user_id: userId, encrypted_cek: encryptedCek });
    }

    await this.loadRawCek(rawCek);
    localStorage.setItem(LOCAL_CEK_KEY, this.toBase64(rawCek));
  }

  async tryRestoreFromSession(): Promise<boolean> {
    const stored = localStorage.getItem(LOCAL_CEK_KEY);
    if (!stored) return false;
    try {
      const rawCek = this.fromBase64(stored) as Uint8Array<ArrayBuffer>;
      await this.loadRawCek(rawCek);
      return true;
    } catch {
      localStorage.removeItem(LOCAL_CEK_KEY);
      return false;
    }
  }

  clearKeys(): void {
    this.cek = null;
    this.hmacKey = null;
    localStorage.removeItem(LOCAL_CEK_KEY);
    this.isReady.set(false);
  }

  // ── Password verification ─────────────────────────────────────────────────

  async verifyPassword(password: string, userId: string): Promise<boolean> {
    try {
      const kek = await this.deriveKek(password, userId);
      const { data } = await this.db
        .from('user_keys')
        .select('encrypted_cek')
        .eq('user_id', userId)
        .single();
      if (!data?.encrypted_cek) return false;
      await this.unwrapKey(data.encrypted_cek, kek);
      return true;
    } catch {
      return false;
    }
  }

  // ── Password change (re-wrap CEK with new KEK) ────────────────────────────

  async preparePasswordChange(
    oldPassword: string,
    newPassword: string,
    userId: string,
  ): Promise<{ encryptedCek: string; rawCek: Uint8Array<ArrayBuffer> }> {
    const oldKek = await this.deriveKek(oldPassword, userId);

    const { data, error } = await this.db
      .from('user_keys')
      .select('encrypted_cek')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new Error('No se encontró la clave del usuario');

    const rawCek = await this.unwrapKey(data.encrypted_cek, oldKek);
    const newKek = await this.deriveKek(newPassword, userId);
    const encryptedCek = await this.wrapKey(rawCek, newKek);

    return { encryptedCek, rawCek };
  }

  async commitPasswordChange(
    userId: string,
    encryptedCek: string,
    rawCek: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    const { error } = await this.db
      .from('user_keys')
      .update({ encrypted_cek: encryptedCek })
      .eq('user_id', userId);

    if (error) throw error;

    localStorage.setItem(LOCAL_CEK_KEY, this.toBase64(rawCek));
  }

  // ── Encryption / Decryption ───────────────────────────────────────────────

  async encrypt(plaintext: string): Promise<string> {
    if (!this.cek) throw new Error('CryptoService no inicializado');
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cek,
      encoded,
    );
    return 'enc:' + this.toBase64(iv) + '.' + this.toBase64(new Uint8Array(ciphertext));
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (!this.isEncrypted(ciphertext)) return ciphertext;
    if (!this.cek) throw new Error('CryptoService no inicializado');
    const payload = ciphertext.slice(4);
    const dot = payload.indexOf('.');
    const iv = this.fromBase64(payload.slice(0, dot));
    const ct = this.fromBase64(payload.slice(dot + 1));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.cek, ct);
    return new TextDecoder().decode(plain);
  }

  isEncrypted(value: string): boolean {
    return value.startsWith('enc:');
  }

  // ── Blind Index ───────────────────────────────────────────────────────────

  async buildBlindIndex(htmlContent: string): Promise<string[]> {
    if (!this.hmacKey) throw new Error('CryptoService no inicializado');
    const tokens = this.tokenize(htmlContent);
    const hashes = await Promise.all(tokens.map(t => this.hashToken(t)));
    return [...new Set(hashes)];
  }

  async hashToken(token: string): Promise<string> {
    if (!this.hmacKey) throw new Error('CryptoService no inicializado');
    const encoded = new TextEncoder().encode(token.toLowerCase());
    const sig = await crypto.subtle.sign('HMAC', this.hmacKey, encoded);
    return this.toBase64(new Uint8Array(sig));
  }

  tokenize(text: string): string[] {
    return text
      .replace(/<[^>]*>/g, ' ')
      .toLowerCase()
      .split(/[\s\W]+/)
      .filter(t => t.length > 2);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async loadRawCek(rawCek: Uint8Array<ArrayBuffer>): Promise<void> {
    this.cek = await crypto.subtle.importKey(
      'raw',
      rawCek,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
    this.hmacKey = await crypto.subtle.importKey(
      'raw',
      rawCek,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    this.isReady.set(true);
  }

  private async deriveKek(password: string, userId: string): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(userId),
        iterations: 600_000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private async wrapKey(rawKey: Uint8Array<ArrayBuffer>, kek: CryptoKey): Promise<string> {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      kek,
      rawKey,
    );
    return 'enc:' + this.toBase64(iv) + '.' + this.toBase64(new Uint8Array(ciphertext));
  }

  private async unwrapKey(wrapped: string, kek: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
    const payload = wrapped.slice(4);
    const dot = payload.indexOf('.');
    const iv = this.fromBase64(payload.slice(0, dot));
    const ct = this.fromBase64(payload.slice(dot + 1));
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ct);
    return new Uint8Array(raw as ArrayBuffer);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private fromBase64(b64: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
  }
}
