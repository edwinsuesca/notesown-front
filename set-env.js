const fs = require('fs');

const dirPath = './src/environments';
const targetPathProd = `${dirPath}/environment.prod.ts`;
const targetPathDev = `${dirPath}/environment.ts`;

if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const envProd = `export const environment = {
  production: true,
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
};
`;

const envDev = `export const environment = {
  production: false,
  supabaseUrl: '${supabaseUrl || 'placeholder_dev_url'}',
  supabaseAnonKey: '${supabaseAnonKey || 'placeholder_dev_key'}',
};
`;

fs.writeFileSync(targetPathProd, envProd);
fs.writeFileSync(targetPathDev, envDev);

console.log('✔ environment files generated from env vars');
