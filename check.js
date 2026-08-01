const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://krcbcejbgpjsdnngzpjh.supabase.co";
const SUPABASE_KEY = "sb_secret_ZpC_X2PMlMlmWLEj68OWVQ_jQ1RClld";

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.from('banks').select('slug, design_config').in('country', ['Finlandiya']);
  if (error) console.error(error);
  else data.forEach(b => console.log(b.slug + ': ' + !!(b.design_config && b.design_config.customHtml)));
}
run();