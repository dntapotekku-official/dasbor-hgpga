import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { execSync } from 'node:child_process';

const scrypt_async = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived_key = await scrypt_async(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived_key).toString("hex")}`;
}

const DB_HOST = 'localhost';
const DB_PORT = '3306';
const DB_USER = 'dasbor_user';
const DB_PASS = 'DasborHgp@2026!';
const DB_NAME = 'dashboardhgpga';

const username = 'admin';
const password = 'admin123';
const name = 'Administrator';
const role = 'superadmin';
const uuid = randomUUID();
const hashedPassword = await hashPassword(password);
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

// Write SQL to temp file to avoid shell escaping issues
import { writeFileSync, unlinkSync } from 'node:fs';
const tmpFile = '/tmp/create-admin.sql';
writeFileSync(tmpFile, `INSERT INTO tbl_admin (uuid, name, username, password, role, is_username_change, is_password_change, created_at, updated_at, deleted_at) VALUES ('${uuid}', '${name}', '${username}', '${hashedPassword}', '${role}', 0, 0, '${now}', '${now}', NULL);\n`);

try {
  execSync(`mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p'${DB_PASS}' ${DB_NAME} < ${tmpFile}`, { stdio: 'pipe' });
  console.log('✓ Admin user created successfully!');
  console.log('  UUID:', uuid);
  console.log('  Username:', username);
  console.log('  Password:', password);
  console.log('  Role:', role);
} catch (e) {
  const stderr = e.stderr?.toString() || '';
  if (stderr.includes('Duplicate entry')) {
    console.log('Admin user already exists. Updating password...');
    writeFileSync(tmpFile, `UPDATE tbl_admin SET password='${hashedPassword}' WHERE username='${username}' AND deleted_at IS NULL;\n`);
    execSync(`mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p'${DB_PASS}' ${DB_NAME} < ${tmpFile}`, { stdio: 'pipe' });
    console.log('✓ Password updated for user:', username);
  } else {
    console.error('MySQL error:', stderr);
    process.exit(1);
  }
} finally {
  try { unlinkSync(tmpFile); } catch {}
}

console.log('\nLogin credentials:');
console.log('  Username: admin');
console.log('  Password: admin123');
