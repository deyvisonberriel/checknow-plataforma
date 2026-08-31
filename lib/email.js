/**
 * =========================================================
 * CHECK NOW - SERVIÇO DE DISPARO DE E-MAIL TRANSACIONAL (RESEND)
 * =========================================================
 */

require('dotenv').config();
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Mapeamento dos cursos para os respectivos arquivos em /public/downloads/
const COURSE_CATALOG = {
  'nr-01': {
    name: 'NR-01 - PGR e Gerenciamento de Riscos',
    apostila: 'NR01_PGR_Risco_Psicossocial_CheckNow.pdf',
    certificado: 'Certificado_NR01.pdf'
  },
  'nr-06': {
    name: 'NR-06 - Equipamentos de Proteção Individual (EPI)',
    apostila: 'NR06_EPI_CheckNow.pdf',
    certificado: 'Certificado_NR06.pdf'
  },
  'nr-10': {
    name: 'NR-10 - Segurança em Instalações Elétricas & SEP',
    apostila: 'NR10_SEP_CheckNow.pdf',
    certificado: 'Certificado_NR10.pdf'
  },
  'nr-11': {
    name: 'NR-11 - Operador de Empilhadeira e Transporte',
    apostila: 'NR11_Empilhadeira_CheckNow.pdf',
    certificado: 'Certificado_NR11.pdf'
  },
  'nr-12': {
    name: 'NR-12 - Segurança no Trabalho em Máquinas',
    apostila: 'NR12_Maquinas_CheckNow.pdf',
    certificado: 'Certificado_NR12.pdf'
  },
  'nr-18-pta': {
    name: 'NR-18 - PTA / PEMT Plataformas Elevatórias',
    apostila: 'NR18_PTA_PEMT_CheckNow.pdf',
    certificado: 'Certificado_NR18_PTA.pdf'
  },
  'nr-18-andaimes': {
    name: 'NR-18 - Montagem e Desmontagem de Andaimes',
    apostila: 'NR18_Montagem_Andaimes_CheckNow.pdf',
    certificado: 'Certificado_NR18_Andaimes.pdf'
  },
  'nr-20': {
    name: 'NR-20 - Inflamáveis e Líquidos Combustíveis',
    apostila: 'NR20_Inflamaveis_CheckNow.pdf',
    certificado: 'Certificado_NR20.pdf'
  },
  'nr-23': {
    name: 'NR-23 - Proteção e Combate a Princípios de Incêndio',
    apostila: 'NR23_Incendio_CheckNow.pdf',
    certificado: 'Certificado_NR23.pdf'
  },
  'nr-32': {
    name: 'NR-32 - Segurança e Saúde em Estabelecimentos de Saúde',
    apostila: 'NR32_Saude_CheckNow.pdf',
    certificado: 'Certificado_NR32.pdf'
  },
  'nr-33': {
    name: 'NR-33 - Espaço Confinado (Trabalhador e Vigia)',
    apostila: 'NR33_Espaco_Confinado_CheckNow.pdf',
    certificado: 'Certificado_NR33.pdf'
  },
  'multiplicador-nr33': {
    name: 'Formação de Multiplicador NR-33 (Instrutor)',
    apostila: 'Multiplicador_NR33_CheckNow.pdf',
    certificado: 'Certificado_Mult_NR33.pdf'
  },
  'nr-35': {
    name: 'NR-35 - Trabalho em Altura',
    apostila: 'NR35_Trabalho_Altura_CheckNow.pdf',
    certificado: 'Certificado_NR35.pdf'
  },
  'multiplicador-nr35': {
    name: 'Formação de Multiplicador NR-35 (Instrutor)',
    apostila: 'Multiplicador_NR35_CheckNow.pdf',
    certificado: 'Certificado_Mult_NR35.pdf'
  },
  'direcao-defensiva': {
    name: 'Direção Defensiva & Gestão de Frotas Corporativas',
    apostila: 'Direcao_Defensiva_CheckNow.pdf',
    certificado: 'Certificado_Direcao.pdf'
  }
};

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
   * Obtém informações e caminhos dos arquivos do curso
   */
  getCourseFiles(courseId) {
    const course = COURSE_CATALOG[courseId] || {
      name: 'Material Técnico de NR',
      apostila: 'NR35_Trabalho_Altura_CheckNow.pdf',
      certificado: 'Certificado_NR35.pdf'
    };

    const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
    const apostilaPath = path.join(downloadsDir, course.apostila);
    const certificadoPath = path.join(downloadsDir, course.certificado);

    return {
      course,
      apostilaPath: fs.existsSync(apostilaPath) ? apostilaPath : null,
      certificadoPath: fs.existsSync(certificadoPath) ? certificadoPath : null,
      apostilaFileName: course.apostila,
      certificadoFileName: course.certificado,
      apostilaDownloadUrl: `${this.appUrl}/downloads/${course.apostila}`,
      certificadoDownloadUrl: `${this.appUrl}/downloads/${course.certificado}`
    };
  }

  /**
   * Template HTML responsivo profissional do e-mail
   */
  generateHtmlTemplate({ customerName, courseName, apostilaUrl, certificadoUrl }) {
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
        <div class="card-title">📦 ${courseName}</div>
        <p style="margin:0; font-size: 13px; color: #15803D;">• Apostila Técnica Completa em PDF (100% Atualizada MTE)<br>• Modelo Editável de Certificado de Conclusão</p>
      </div>

      <p>Você pode acessar e baixar os seus arquivos diretamente pelos botões abaixo:</p>

      <a href="${apostilaUrl}" class="btn">📥 BAIXAR APOSTILA TÉCNICA (PDF)</a>
      <a href="${certificadoUrl}" class="btn-secondary">🎓 BAIXAR MODELO DE CERTIFICADO</a>

      <p style="font-size: 13px; color: #64748B; margin-top: 20px;">
        💡 <em>Dica: Salve os arquivos em seu computador ou celular para ter acesso vitalício sempre que precisar.</em>
      </p>
    </div>

    <div class="footer">
      <p><strong>Vander Rana</strong> — Especialista em SST & Gestão de Riscos</p>
      <p>Check Now Assessoria em Segurança do Trabalho • WhatsApp Suporte: (21) 99113-8370</p>
      <p style="margin-top: 8px; font-size: 11px;">Este é um e-mail transacional gerado automaticamente após a aprovação do seu pedido.</p>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Disparo Principal do E-mail com Anexos ou Links
   */
  async sendCourseMaterial({ customerEmail, customerName, courseId, courseName }) {
    const fileInfo = this.getCourseFiles(courseId);
    const finalCourseName = courseName || fileInfo.course.name;
    const finalName = customerName || 'Aluno(a)';

    console.log(`[Email Service] Preparando envio de material para ${customerEmail} (Curso: ${finalCourseName})`);

    // Modo Simulação / Fallback (quando não há chave do Resend configurada)
    if (!this.isConfigured()) {
      console.log(`[Resend Mock] ✅ E-mail SIMULADO com sucesso!`);
      console.log(`  -> Para: ${finalName} <${customerEmail}>`);
      console.log(`  -> De: ${this.emailFrom}`);
      console.log(`  -> Assunto: 🎓 Seu Material: ${finalCourseName} (Check Now)`);
      console.log(`  -> Link Apostila: ${fileInfo.apostilaDownloadUrl}`);
      console.log(`  -> Link Certificado: ${fileInfo.certificadoDownloadUrl}`);

      return {
        success: true,
        isMock: true,
        message: 'E-mail transacional enviado com sucesso (Modo Simulação)',
        recipient: customerEmail,
        courseName: finalCourseName,
        downloads: {
          apostila: fileInfo.apostilaDownloadUrl,
          certificado: fileInfo.certificadoDownloadUrl
        }
      };
    }

    // Preparação dos anexos para o Resend (se arquivos existirem)
    const attachments = [];
    if (fileInfo.apostilaPath && fs.existsSync(fileInfo.apostilaPath)) {
      attachments.push({
        filename: fileInfo.apostilaFileName,
        content: fs.readFileSync(fileInfo.apostilaPath)
      });
    }
    if (fileInfo.certificadoPath && fs.existsSync(fileInfo.certificadoPath)) {
      attachments.push({
        filename: fileInfo.certificadoFileName,
        content: fs.readFileSync(fileInfo.certificadoPath)
      });
    }

    const htmlContent = this.generateHtmlTemplate({
      customerName: finalName,
      courseName: finalCourseName,
      apostilaUrl: fileInfo.apostilaDownloadUrl,
      certificadoUrl: fileInfo.certificadoDownloadUrl
    });

    try {
      const response = await this.resend.emails.send({
        from: this.emailFrom,
        to: [customerEmail],
        subject: `🎓 Seu Material Chegou: ${finalCourseName} - Check Now`,
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
      // Retorna sucesso para não quebrar a experiência do usuário na UI
      return {
        success: false,
        error: error.message,
        fallbackDownloads: {
          apostila: fileInfo.apostilaDownloadUrl,
          certificado: fileInfo.certificadoDownloadUrl
        }
      };
    }
  }
}

module.exports = new EmailService();
