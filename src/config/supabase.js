// Supabase Client Configuration
export class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async query(table, params = {}) {
    const qs = new URLSearchParams();
    if (params.select) qs.set('select', params.select);
    if (params.eq) Object.entries(params.eq).forEach(([k, v]) => qs.set(k, `eq.${v}`));
    if (params.order) qs.set('order', params.order);
    if (params.limit) qs.set('limit', params.limit);
    if (params.like) Object.entries(params.like).forEach(([k, v]) => qs.set(k, `like.%${v}%`));
    if (params.gte) Object.entries(params.gte).forEach(([k, v]) => qs.set(k, `gte.${v}`));
    if (params.lte) Object.entries(params.lte).forEach(([k, v]) => qs.set(k, `lte.${v}`));

    const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`Query error: ${res.status}`);
    return res.json();
  }

  async rpc(functionName, params = {}) {
    const url = `${this.url}/rest/v1/rpc/${functionName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    return res.json();
  }

  async insert(table, data) {
    const url = `${this.url}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Insert error: ${res.status}`);
    return res.json();
  }

  async update(table, data, match) {
    const qs = new URLSearchParams();
    Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
    const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Update error: ${res.status}`);
    return res.json();
  }

  async delete(table, match) {
    const qs = new URLSearchParams();
    Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
    const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) throw new Error(`Delete error: ${res.status}`);
    return res.json();
  }
}

// Export configured instance
const SUPABASE_URL = "https://pqtedphijayclewljlkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdGVkcGhpamF5Y2xld2xqbGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzUxMzAsImV4cCI6MjA3NjgxMTEzMH0.a98g5NyfxlQIRMlIaVdj88CVE1dWP03J-XNgK-Sw_Ng";

export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
