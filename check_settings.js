const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://krcbcejbgpjsdnngzpjh.supabase.co";
const SUPABASE_KEY = "sb_secret_ZpC_X2PMlMlmWLEj68OWVQ_jQ1RClld";

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.from('global_settings').select('*');
  if (error) console.error(error);
  else console.log(data);
}
run();