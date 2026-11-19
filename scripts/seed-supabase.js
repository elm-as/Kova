#!/usr/bin/env node
// Seed Supabase: create minimal data and an auth user for a fresh DB

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const ts = () => Math.floor(Date.now() / 1000);

async function restPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`REST POST /${path} failed ${res.status}: ${t}`);
  }
  return await res.json();
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Admin create user failed ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data?.id;
}

async function seed() {
  const companyId = 'company-seed';
  // 1) Company
  await restPost('companies', {
    id: companyId,
    name: 'Demo Company',
    email: 'admin@demo.local',
    license_type: 'starter',
    max_users: 3,
    max_positions: 5,
    max_candidates_per_position: 50,
    features: { bulkOperations: false, advancedAnalytics: true, emailTemplates: true, apiAccess: false, customBranding: false },
    license_start_date: ts(),
    license_expiry_date: ts() + 31536000,
    license_is_active: true,
    subscription_status: 'active',
    created_at: ts()
  });

  // 2) Admin user (Auth) and table row
  const adminEmail = 'admin@demo.local';
  const adminPassword = 'Test@1234';
  const authUserId = await adminCreateUser(adminEmail, adminPassword);

  await restPost('users', {
    id: authUserId,
    company_id: companyId,
    name: 'Admin Demo',
    email: adminEmail,
    password_hash: 'seeded-hash',
    role: 'owner',
    last_login_at: null,
    created_at: ts()
  });

  // 3) Position
  await restPost('positions', {
    id: 'pos-seed',
    company_id: companyId,
    title: 'Recruiter',
    description: 'Seed position for testing',
    requirements: '',
    openings: 1,
    status: 'active',
    is_internship: false,
    is_locked: false,
    hired_count: 0,
    archived_at: null,
    created_at: ts()
  });

  // 4) KV store
  await restPost('kv_store', {
    key: 'app-theme',
    value: { theme: 'dark' },
    created_at: ts()
  });

  console.log('Seed completed: company-seed, pos-seed, admin@demo.local');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
