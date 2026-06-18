/**
 * Generates bcrypt hashes for seed passwords.
 * Run: npm run hash-passwords
 */
const bcrypt = require('bcrypt');

const passwords = {
  Admin123: 'admin@estatehub.co.za',
  Password123: 'buyers/agents (sample accounts)',
};

(async () => {
  console.log('Bcrypt hashes (cost 12):\n');
  for (const [password, note] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 12);
    console.log(`${password} (${note}):`);
    console.log(hash);
    console.log('');
  }
})();
