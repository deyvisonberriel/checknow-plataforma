/**
 * =========================================================
 * CHECK NOW - SERVIDOR EXPRESS, API PAGBANK V4 & RESEND EMAIL
 * =========================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pagbank = require('./lib/pagbank');
const emailService = require('./lib/email');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Servir pasta de downloads seguros
const downloadsPath = path.join(__dirname, 'public', 'downloads');
app.use('/downloads', express.static(downloadsPath));

// 2. Servir arquivos estáticos da landing page
app.use(express.static(path.join(__dirname)));

// 3. Rota de Configurações Públicas (Frontend)
app.get('/api/pagbank/config', (req, res) => {
  res.json({
    success: true,
    publicKey: process.env.PAGBANK_PUBLIC_KEY || '',
    env: process.env.PAGBANK_ENV || 'sandbox',
    isConfigured: pagbank.isConfigured()
  });
});

// 3.1 Rota de Configurações de Analytics e Rastreamento
app.get('/api/analytics/config', (req, res) => {
  res.json({
    gaId: process.env.NEXT_PUBLIC_GA_ID || process.env.GA_ID || '',
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID || '',
    gtmId: process.env.NEXT_PUBLIC_GTM_ID || process.env.GTM_ID || ''
  });
});

// 4. Rota: Criar Pedido Pix (POST /api/pagbank/create-pix)
app.post('/api/pagbank/create-pix', async (req, res) => {
  try {
    const { courseId, courseName, customer, amount } = req.body;

    if (!customer || !customer.name || !customer.email || (!customer.tax_id && !customer.cpf)) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios do comprador incompletos (Nome, E-mail, CPF).'
      });
    }

    const order = await pagbank.createPixOrder({
      courseId: courseId || 'nr-35',
      courseName: courseName || 'Material Didático NR',
      customer,
      amount: amount || 2700
    });

    res.json(order);
  } catch (error) {
    console.error('[API Create Pix Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar Pix no PagBank.'
    });
  }
});

// 5. Rota: Criar Pedido Cartão de Crédito (POST /api/pagbank/create-card)
app.post('/api/pagbank/create-card', async (req, res) => {
  try {
    const { courseId, courseName, customer, cardToken, cardData, amount } = req.body;

    if (!customer || !customer.name || !customer.email || (!customer.tax_id && !customer.cpf)) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios do comprador incompletos.'
      });
    }

    const tokenToUse = cardToken || cardData?.encrypted || 'MOCK_CARD_TOKEN';

    const order = await pagbank.createCardOrder({
      courseId: courseId || 'nr-35',
      courseName: courseName || 'Material Didático NR',
      customer,
      cardToken: tokenToUse,
      amount: amount || 2700,
      installments: 1
    });

    // Se aprovado, dispara o envio de e-mail automaticamente
    if (order.status === 'PAID') {
      emailService.sendCourseMaterial({
        customerEmail: customer.email,
        customerName: customer.name,
        courseId: courseId || 'nr-35',
        courseName: courseName || 'Material Didático NR'
      }).catch(err => console.error('[Auto Email Error]:', err));
    }

    res.json(order);
  } catch (error) {
    console.error('[API Create Card Error]:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar cobrança no cartão.'
    });
  }
});

// 6. Rota: Consultar Status do Pedido para Polling (GET /api/pagbank/check-status)
app.get('/api/pagbank/check-status', async (req, res) => {
  try {
    const orderId = req.query.orderId || req.query.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro orderId é obrigatório.'
      });
    }

    const result = await pagbank.getOrderStatus(orderId);
    
    // Se mudou para PAID, dispara entrega automática por e-mail caso ainda não tenha sido disparada
    if (result.status === 'PAID' && result.isMock) {
      const mock = pagbank.memoryOrders.get(orderId);
      if (mock && !mock.emailDispatched) {
        mock.emailDispatched = true;
        emailService.sendCourseMaterial({
          customerEmail: mock.customer.email,
          customerName: mock.customer.name,
          courseId: mock.courseId,
          courseName: mock.courseName
        }).catch(err => console.error('[Auto Mock Email Error]:', err));
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 7. Rota: Webhook Oficial PagBank (POST /api/pagbank/webhook)
app.post('/api/pagbank/webhook', async (req, res) => {
  try {
    const result = await pagbank.handleWebhook(req.body);
    
    if (result.status === 'PAID') {
      const orderData = result.order || {};
      const customer = orderData.customer || {};
      const items = orderData.items || [];
      const item = items[0] || {};

      if (!process.env.RESEND_API_KEY) {
        console.log(`[Mock Webhook] Mock Email Enviado com Sucesso para: ${customer.email || 'desconhecido'}`);
      } else {
        emailService.sendCourseMaterial({
          customerEmail: customer.email,
          customerName: customer.name,
          courseId: item.reference_id || 'nr-35',
          courseName: item.name || 'Material Didático Check Now'
        }).catch(err => console.error('[Webhook Email Error]:', err));
      }
    }

    res.status(200).json({
      received: true,
      result
    });
  } catch (error) {
    console.error('[Webhook Error]:', error);
    res.status(200).json({
      received: true,
      error: error.message
    });
  }
});

// 8. Rota: Disparo de E-mail via Resend (POST /api/send-material)
app.post('/api/send-material', async (req, res) => {
  try {
    const { customerEmail, customerName, courseId, courseName } = req.body;

    if (!customerEmail) {
      return res.status(400).json({ success: false, error: 'customerEmail é obrigatório.' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.log(`[Resend Mock] Chave não configurada. E-mail simulado para: ${customerEmail}`);
      return res.json({ success: true, isMock: true, message: 'Mock Email Enviado' });
    }

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const finalCourseName = courseName || 'Material Didático Check Now';

    console.log(`Tentando enviar e-mail via Resend para: ${customerEmail}`);

    const data = await resend.emails.send({
      from: emailFrom,
      to: [customerEmail],
      subject: `Seu Material Check Now: ${finalCourseName}`,
      html: `<h1>Pagamento Confirmado!</h1><p>Obrigado por adquirir o material. Acesse seus downloads no site.</p>`
    });

    console.log('Resposta do Resend:', data);

    if (data.error) {
      console.error('Erro Resend (API Error):', data.error);
      return res.status(400).json({ success: false, error: data.error.message || 'Erro na API do Resend' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro Resend (Exceção):', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Rota: Download Seguro de Material e Certificado (GET /api/download/:courseId/:type)
app.get('/api/download/:courseId/:type', (req, res) => {
  try {
    const { courseId, type } = req.params;
    const fileInfo = emailService.getCourseFiles(courseId);

    let targetFilePath = null;
    let targetFileName = null;

    if (type === 'certificado') {
      targetFilePath = fileInfo.certificadoPath;
      targetFileName = fileInfo.certificadoFileName;
    } else {
      targetFilePath = fileInfo.apostilaPath;
      targetFileName = fileInfo.apostilaFileName;
    }

    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      // Fallback/Mock: Retornar arquivo genérico se não encontrar o real no MVP
      console.log(`[Mock Download] Gerando arquivo temporário para: ${targetFileName}`);
      const mockContent = `Arquivo original pendente na pasta /public/downloads.\n\nSimulação de Arquivo Baixado:\nCurso: ${courseId}\nTipo: ${type}\nNome do Arquivo Esperado: ${targetFileName}`;
      
      res.setHeader('Content-Type', 'text/plain'); // Usando text/plain provisório para evitar erro de PDF corrompido
      res.setHeader('Content-Disposition', `attachment; filename="MOCK_${targetFileName}.txt"`);
      return res.send(mockContent);
    }

    res.download(targetFilePath, targetFileName);
  } catch (error) {
    res.status(500).send('Erro ao processar download');
  }
});


// ==========================================
// 10. ADMIN CMS & DATA MANAGEMENT (PRD 5)
// ==========================================
const dataFilePath = path.join(__dirname, 'data', 'courses.json');

// Middleware de Autentica��o Simples
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (token === `Bearer ${process.env.ADMIN_PASSWORD}`) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'N�o autorizado. Senha incorreta.' });
  }
};

// Ler Cursos
const readCourses = () => {
  if (!fs.existsSync(dataFilePath)) return [];
  const data = fs.readFileSync(dataFilePath, 'utf8');
  return JSON.parse(data);
};

// Salvar Cursos
const writeCourses = (courses) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(courses, null, 2), 'utf8');
};

// Rota: Login do Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: password });
  } else {
    res.status(401).json({ success: false, error: 'Senha incorreta.' });
  }
});

// Rota: Obter todos os cursos
app.get('/api/admin/courses', (req, res) => {
  res.json({ success: true, courses: readCourses() });
});

// Rota: Criar curso
app.post('/api/admin/courses', adminAuth, (req, res) => {
  try {
    const courses = readCourses();
    const newCourse = { id: req.body.tag.toLowerCase().replace(/[^a-z0-9]/g, '-'), ...req.body };
    courses.push(newCourse);
    writeCourses(courses);
    res.json({ success: true, course: newCourse });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Atualizar curso
app.put('/api/admin/courses/:id', adminAuth, (req, res) => {
  try {
    let courses = readCourses();
    const index = courses.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      courses[index] = { ...courses[index], ...req.body, id: req.params.id };
      writeCourses(courses);
      res.json({ success: true, course: courses[index] });
    } else {
      res.status(404).json({ success: false, error: 'Curso n�o encontrado.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Excluir curso
app.delete('/api/admin/courses/:id', adminAuth, (req, res) => {
  try {
    let courses = readCourses();
    courses = courses.filter(c => c.id !== req.params.id);
    writeCourses(courses);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir Painel Admin (SPA Frontend)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Check Now Platform (PagBank + Resend)',
    timestamp: new Date().toISOString()
  });
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Check Now Platform rodando em: http://localhost:${PORT}`);
  console.log(`💳 Gateway PagBank (Ambiente: ${process.env.PAGBANK_ENV || 'sandbox'})`);
  console.log(`📧 Serviço de E-mail Resend (${emailService.isConfigured() ? 'PRODUÇÃO ATIVA' : 'MODO SIMULAÇÃO ATIVO'})`);
  console.log(`📂 Downloads disponíveis em: /downloads/ ou /api/download/`);
  console.log(`=======================================================`);
});
