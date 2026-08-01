import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// .env.local dosyasındaki değerler
const SUPABASE_URL = "https://krcbcejbgpjsdnngzpjh.supabase.co";
const SUPABASE_SERVICE_KEY = "sb_secret_ZpC_X2PMlMlmWLEj68OWVQ_jQ1RClld";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  
  try {
    const files = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort(); // Dosya isimlerine göre sıralı çalışması önemli

    console.log(`Found ${files.length} migration files. Executing...`);

    for (const file of files) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Executing ${file}...`);
      
      // REST API üzerinden doğrudan sorgu çalıştırılamıyor ancak pgcrypto 
      // veya benzeri RPC çağrılarıyla veya doğrudan veritabanı bağlantısıyla yapılabilir.
      // Not: Standart supabase-js client'ında raw SQL query fonksiyonu yoktur. 
      console.log('--- Note: @supabase/supabase-js cannot execute raw SQL directly. ---');
      break;
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

runMigrations();