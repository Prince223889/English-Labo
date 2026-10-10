/*
 * English Arena configuration.
 * SEULES valeurs autorisées ici : l'URL du projet et la clé PUBLISHABLE (commence par sb_publishable) ou la clé anon.
 * JAMAIS la clé « secret » ni la clé « service role » : GitHub bloque le push, et n'importe qui pourrait la lire.
 */
window.EA_CONFIG = {
  appName: 'English Arena',
  className: 'Terminale · English Lab',
  mode: 'supabase', // 'local' pour tester sans internet
  supabaseUrl: 'https://ckflhvtdaaxmbfrfekyb.supabase.co',
  supabaseAnonKey: 'sb_publishable_WZ9VEXOVKWnlLgFJ6WkxBQ_zy4XEhDF'
};
