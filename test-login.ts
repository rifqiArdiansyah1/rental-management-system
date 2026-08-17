import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

async function checkLogin() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'customer1@test.com',
    password: 'Password123!',
  });

  if (error) {
    console.error('Login failed:', error.message);
  } else {
    console.log('Login success:', data.user.email);
  }
}

checkLogin();
