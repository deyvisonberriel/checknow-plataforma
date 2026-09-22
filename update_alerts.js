const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const alert1 = `if (emailResult.success) {
                    alert('E-mail de confirmação enviado via Resend!');
                  } else {
                    alert('Erro no envio do e-mail: ' + (emailResult.error || 'Falha desconhecida no servidor.'));
                  }`;

const alert1Replace = `if (!emailResult.success) {
                    console.warn('Erro no envio do e-mail: ' + (emailResult.error || 'Falha desconhecida no servidor.'));
                  }`;

const alert2 = `alert("Simulação: O ambiente atual não suporta a rota /api. Na Vercel o e-mail será enviado! (Erro original: " + errEmail.message + ")");`;
const alert2Replace = `console.warn("Simulação (Vercel): E-mail será enviado silenciosamente. Erro: " + errEmail.message);`;

// Also notice that the indentation might differ for the third block, so let's use regex instead.

c = c.replace(/alert\('E-mail de confirmação enviado via Resend!'\);/g, "console.log('E-mail enviado via Resend (silencioso)');");

c = c.replace(/alert\('Erro no envio do e-mail: ' \+ \(emailResult\.error \|\| 'Falha desconhecida no servidor\.'\)\);/g, "console.error('Erro no envio do e-mail: ' + (emailResult.error || 'Falha desconhecida no servidor.'));");

c = c.replace(/alert\("Simulação: O ambiente atual não suporta a rota \/api\. Na Vercel o e-mail será enviado! \(Erro original: " \+ errEmail\.message \+ "\)"\);/g, "console.warn('Simulação/Dev: ' + errEmail.message);");

fs.writeFileSync('index.html', c, 'utf8');
console.log('Frontend Alerts Removed');
