/**
 * =========================================================
 * CHECK NOW - SERVIÇO DE DISPARO DE E-MAIL TRANSACIONAL (RESEND)
 * =========================================================
 */

require('dotenv').config();
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.emailFrom = process.env.EMAIL_FROM || 'Check Now <onboarding@resend.dev>';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    this.resend = this.isConfigured() ? new Resend(this.apiKey) : null;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.startsWith('re_') && this.apiKey.length > 15);
  }

  /**
   * Template HTML responsivo profissional do e-mail
   */
  generateHtmlTemplate({ customerName, courseName, apostilaUrl, certificadoUrl }) {
    const safeApostilaUrl = apostilaUrl || '#';
    const safeCertificadoUrl = certificadoUrl || '#';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Material da Check Now está pronto!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px 12px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #13899C 0%, #0E6877 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
    .card-box { background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .card-title { font-size: 16px; font-weight: 700; color: #166534; margin-bottom: 6px; }
    .btn { display: block; width: 100%; box-sizing: border-box; background-color: #3B8E39; color: #FFFFFF !important; text-align: center; padding: 16px 24px; border-radius: 12px; font-weight: 800; font-size: 15px; text-decoration: none; margin: 16px 0 8px; }
    .btn-secondary { display: block; width: 100%; box-sizing: border-box; background-color: #13899C; color: #FFFFFF !important; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; margin-bottom: 16px; }
    .footer { background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px; text-align: center; font-size: 12px; color: #64748B; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CHECK NOW</h1>
      <p>Cursos e Treinamentos em Segurança do Trabalho</p>
    </div>
    <div class="content">
      <div class="greeting">Olá, ${customerName}! 👋</div>
      <p>Seu pagamento referente ao treinamento abaixo foi <strong>confirmado com sucesso</strong>:</p>
      
      <div class="card-box">
        <div class="card-title">📚 ${courseName}</div>
        <p style="margin:0; font-size: 13px; color: #15803D;">✅ Apostila Técnica Completa em PDF<br>✅ Modelo de Certificado</p>
      </div>

      <p>Você pode acessar e baixar os seus arquivos diretamente pelos botões abaixo ou pelos arquivos em anexo neste e-mail:</p>

      ${apostilaUrl !== '#' ? `<a href="${safeApostilaUrl}" class="btn">⬇️ BAIXAR APOSTILA (PDF)</a>` : ''}
      ${certificadoUrl !== '#' ? `<a href="${safeCertificadoUrl}" class="btn-secondary">⬇️ BAIXAR CERTIFICADO</a>` : ''}
    </div>

    <div class="footer">
      <p><strong>Vander Rana</strong> - Especialista em SST & Gestão de Riscos</p>
      <p>Check Now Assessoria em Segurança do Trabalho</p>
      <p style="margin-top: 8px; font-size: 11px;">Este é um e-mail transacional gerado automaticamente após a aprovação do pedido.</p>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Disparo Principal do E-mail com Anexos via URL do Storage
   */
  async sendCourseMaterial({ customerEmail, customerName, courseId, courseName, materialUrl, certificateUrl }) {
    const finalCourseName = courseName || 'Material Check Now';
    const finalName = customerName || 'Aluno(a)';

    console.log(`[Email Service] Preparando envio de material para ${customerEmail} (Curso: ${finalCourseName})`);

    if (!this.isConfigured()) {
      console.log(`[Resend Mock] E-mail SIMULADO com sucesso!`);
      return { success: true, isMock: true, recipient: customerEmail, courseName: finalCourseName };
    }

    // Preparação dos anexos usando o recurso de URL externa da API do Resend (path)
    const attachments = [];
    if (materialUrl) {
      attachments.push({
        filename: `Apostila_${finalCourseName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        path: materialUrl // O Resend baixa automaticamente da URL e anexa ao e-mail
      });
    }
    if (certificateUrl) {
      attachments.push({
        filename: `Certificado_${finalCourseName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        path: certificateUrl
      });
    }

    const htmlContent = this.generateHtmlTemplate({
      customerName: finalName,
      courseName: finalCourseName,
      apostilaUrl: materialUrl,
      certificadoUrl: certificateUrl
    });

    try {
      const response = await this.resend.emails.send({
        from: this.emailFrom,
        to: [customerEmail],
        subject: `✅ Seu Material Chegou: ${finalCourseName} - Check Now`,
        html: htmlContent,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      console.log(`[Resend Success] E-mail entregue com ID: ${response.data?.id}`);
      return {
        success: true,
        isMock: false,
        emailId: response.data?.id,
        recipient: customerEmail,
        courseName: finalCourseName
      };
    } catch (error) {
      console.error('[Resend Error]:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();
