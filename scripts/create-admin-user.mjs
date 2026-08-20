import crypto from 'crypto';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const generateHash = (password, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
};

console.log("ETF Campus - 운영자 계정 생성기");
console.log("================================");

rl.question('사용할 아이디 (username): ', async (username) => {
  if (!username) {
    console.log("아이디를 입력해야 합니다.");
    process.exit(1);
  }
  
  // Hide password input
  let password = '';
  process.stdout.write('사용할 비밀번호 (입력 시 보이지 않음): ');
  
  const onData = async (char) => {
    char = char.toString();
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        console.log('\n');
        
        if (!password) {
          console.log("비밀번호를 입력해야 합니다.");
          process.exit(1);
        }
        
        const userId = crypto.randomUUID();
        try {
          const hash = await generateHash(password, userId);
          
          console.log("\n[생성 완료]\n");
          console.log("아래 SQL을 실행하여 계정을 생성하세요:");
          console.log("-------------------------------------");
          console.log(`INSERT INTO admin_users (user_id, username, password_hash, role_id, status) \nVALUES ('${userId}', '${username}', '${hash}', 'platform.owner', 'active');`);
          console.log("-------------------------------------\n");
          console.log("로컬 개발 환경 D1 실행:");
          console.log(`npx wrangler d1 execute etf-prices-preview --local --command="INSERT INTO admin_users (user_id, username, password_hash, role_id, status) VALUES ('${userId}', '${username}', '${hash}', 'platform.owner', 'active');"\n`);
          console.log("Production D1 실행:");
          console.log(`npx wrangler d1 execute etf-prices --command="..."`);
          process.exit(0);
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
        break;
      case '\u0003': // Ctrl+C
        process.exit();
        break;
      default:
        password += char;
        break;
    }
  };
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onData);
});
