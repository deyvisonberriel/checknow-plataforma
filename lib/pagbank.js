/**
 * =========================================================
 * CHECK NOW - CLIENTE DE INTEGRAÇÃO PAGBANK V4
 * =========================================================
 * Suporta:
 *  - Criação de Pedidos Pix com QR Code & Copia e Cola
 *  - Criação de Cobranças de Cartão de Crédito Criptografado
 *  - Consulta de Status de Pedido / Polling
 *  - Processamento Seguro de Webhook
 * =========================================================
 */

require('dotenv').config();

class PagBankService {
  constructor() {
    this.token = process.env.PAGBANK_TOKEN || '';
    this.publicKey = process.env.PAGBANK_PUBLIC_KEY || '';
    this.env = (process.env.PAGBANK_ENV || 'sandbox').toLowerCase();
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';

    this.baseUrl = this.env === 'production'
      ? 'https://api.pagseguro.com'
      : 'https://sandbox.api.pagseguro.com';

    // Armazenamento em memória para pedidos em modo de simulação/testes
    this.memoryOrders = new Map();
  }

  /**
   * Headers padrão para a API PagBank V4
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Sanitiza CPF mantendo apenas dígitos (11 caracteres)
   */
  cleanCpf(cpf) {
    return (cpf || '').replace(/\D/g, '');
  }

  /**
   * Extrai DDD e número do telefone/WhatsApp
   */
  formatPhone(phone) {
    const clean = (phone || '').replace(/\D/g, '');
    if (clean.length >= 10) {
      return {
        country: '55',
        area: clean.substring(0, 2),
        number: clean.substring(2)
      };
    }
    return {
      country: '55',
      area: '21',
      number: '999999999'
    };
  }

  /**
   * Verifica se o token configurado é real ou placeholder
   */
  isConfigured() {
    if (this.env === 'production') return true; // Bloqueia fallback e exige a API real em PRD
    return Boolean(this.token && !this.token.includes('SEU_TOKEN') && this.token.length > 20);
  }

  /**
   * 1. Criar Pedido Pix (POST /api/pagbank/create-pix)
   */
  async createPixOrder({ courseId, courseName, customer, amount = 2900 }) {
    const referenceId = `CN-${courseId.toUpperCase()}-${Date.now()}`;
    const cleanCpf = this.cleanCpf(customer.tax_id || customer.cpf);
    const phoneObj = this.formatPhone(customer.phone);
    const expirationDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Se o token não estiver configurado, utiliza simulação realista para desenvolvimento
    if (!this.isConfigured()) {
      const mockOrderId = `ORD-MOCK-${Date.now()}`;
      const mockPixCode = `00020126580014br.gov.bcb.pix0136checknow-sst@pix.pagbank.com.br520400005303986540529.005802BR5925CHECK NOW SST TREINAMENTOS6009SAO PAULO62070503***6304${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const mockOrder = {
        id: mockOrderId,
        reference_id: referenceId,
        status: 'WAITING_PAYMENT',
        courseId,
        courseName,
        customer,
        amount,
        createdAt: Date.now()
      };
      this.memoryOrders.set(mockOrderId, mockOrder);

      // Auto-aprovação de Mock Pix removida para evitar simulações indesejadas.

      return {
        success: true,
        isMock: true,
        orderId: mockOrderId,
        referenceId,
        qrCodeText: mockPixCode,
        qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPixCode)}`,
        expirationDate,
        amount: 29.00,
        status: 'WAITING_PAYMENT'
      };
    }

    // Payload oficial PagBank V4 (Pix)
    const payload = {
      reference_id: referenceId,
      customer: {
        name: customer.name,
        email: customer.email,
        tax_id: cleanCpf,
        phones: [
          {
            country: phoneObj.country,
            area: phoneObj.area,
            number: phoneObj.number,
            type: 'MOBILE'
          }
        ]
      },
      items: [
        {
          reference_id: courseId,
          name: `Material Check Now: ${courseName}`,
          quantity: 1,
          unit_amount: amount
        }
      ],
      qr_codes: [
        {
          amount: {
            value: amount
          },
          expiration_date: expirationDate
        }
      ],
      notification_urls: [
        `${this.appUrl}/api/pagbank/webhook`
      ]
    };

    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error_messages ? data.error_messages.map(e => e.description).join(', ') : 'Erro ao processar Pix no PagBank';
        throw new Error(errorMsg);
      }

      const qrCodeObj = data.qr_codes && data.qr_codes[0] ? data.qr_codes[0] : {};
      const qrCodeImage = qrCodeObj.links ? qrCodeObj.links.find(l => l.rel === 'QRCODE.PNG')?.href : '';

      return {
        success: true,
        orderId: data.id,
        referenceId: data.reference_id,
        qrCodeText: qrCodeObj.text || '',
        qrCodeImage: qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeObj.text || '')}`,
        expirationDate: qrCodeObj.expiration_date || expirationDate,
        amount: amount / 100,
        status: 'WAITING_PAYMENT',
        raw: data
      };
    } catch (error) {
      console.error('[PagBank Pix Error]:', error.message);
      throw error;
    }
  }

  /**
   * 2. Criar Pedido Cartão de Crédito (POST /api/pagbank/create-card)
   */
  async createCardOrder({ courseId, courseName, customer, cardToken, amount = 2900, installments = 1 }) {
    const referenceId = `CN-CARD-${courseId.toUpperCase()}-${Date.now()}`;
    const cleanCpf = this.cleanCpf(customer.tax_id || customer.cpf);
    const phoneObj = this.formatPhone(customer.phone);

    // Modo simulação se token não estiver configurado
    if (!this.isConfigured()) {
      const mockOrderId = `ORD-CARD-${Date.now()}`;
      
      this.memoryOrders.set(mockOrderId, {
        id: mockOrderId,
        reference_id: referenceId,
        status: 'PAID',
        courseId,
        courseName,
        customer,
        amount,
        createdAt: new Date().toISOString()
      });

      return {
        success: true,
        isMock: true,
        orderId: mockOrderId,
        referenceId,
        chargeId: `CHAR-MOCK-${Date.now()}`,
        status: 'PAID',
        message: 'Pagamento aprovado com sucesso via simulação PagBank'
      };
    }

    // Payload oficial PagBank V4 (Cartão de Crédito com Token)
    const payload = {
      reference_id: referenceId,
      customer: {
        name: customer.name,
        email: customer.email,
        tax_id: cleanCpf,
        phones: [
          {
            country: phoneObj.country,
            area: phoneObj.area,
            number: phoneObj.number,
            type: 'MOBILE'
          }
        ]
      },
      items: [
        {
          reference_id: courseId,
          name: `Material Check Now: ${courseName}`,
          quantity: 1,
          unit_amount: amount
        }
      ],
      charges: [
        {
          reference_id: `CHAR-${referenceId}`,
          description: `Check Now - ${courseName}`,
          amount: {
            value: amount,
            currency: 'BRL'
          },
          payment_method: {
            type: 'CREDIT_CARD',
            installments: installments,
            capture: true,
            card: {
              encrypted: cardToken
            }
          },
          notification_urls: [
            `${this.appUrl}/api/pagbank/webhook`
          ]
        }
      ]
    };

    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error_messages ? data.error_messages.map(e => e.description).join(', ') : 'Erro ao processar cartão de crédito no PagBank';
        throw new Error(errorMsg);
      }

      const charge = data.charges && data.charges[0] ? data.charges[0] : {};
      const status = charge.status === 'PAID' ? 'PAID' : (charge.status || 'WAITING_PAYMENT');

      return {
        success: true,
        orderId: data.id,
        referenceId: data.reference_id,
        chargeId: charge.id,
        status: status,
        raw: data
      };
    } catch (error) {
      console.error('[PagBank Card Error]:', error.message);
      throw error;
    }
  }

  /**
   * 3. Consultar Status do Pedido (GET /api/pagbank/check-status)
   */
  async getOrderStatus(orderId) {
    if (!this.isConfigured() || orderId.startsWith('ORD-MOCK-')) {
      const mock = this.memoryOrders.get(orderId);
      let status = 'WAITING_PAYMENT';
      if (mock) { status = mock.status; }
      return {
        orderId,
        status,
        isMock: true
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro ao consultar pedido: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Avalia status geral dos QR codes e charges
      let status = 'WAITING_PAYMENT';
      if (data.charges && data.charges.some(c => c.status === 'PAID')) {
        status = 'PAID';
      } else if (data.qr_codes && data.qr_codes.some(q => q.status === 'PAID')) {
        status = 'PAID';
      } else if (data.charges && data.charges.some(c => c.status === 'DECLINED')) {
        status = 'DECLINED';
      } else if (data.charges && data.charges.some(c => c.status === 'CANCELED')) {
        status = 'CANCELED';
      }

      return {
        orderId: data.id,
        referenceId: data.reference_id,
        status: status,
        raw: data
      };
    } catch (error) {
      console.error('[PagBank Check Status Error]:', error.message);
      return {
        orderId,
        status: 'WAITING_PAYMENT',
        error: error.message
      };
    }
  }

  /**
   * 4. Processamento de Webhook (POST /api/pagbank/webhook)
   */
  async handleWebhook(eventPayload) {
    console.log('[PagBank Webhook Event Received]:', JSON.stringify(eventPayload, null, 2));

    const orderId = eventPayload.id || (eventPayload.order && eventPayload.order.id);
    if (!orderId) {
      return { handled: false, error: 'Sem orderId no payload' };
    }

    const orderStatus = await this.getOrderStatus(orderId);

    if (orderStatus.status === 'PAID') {
      console.log(`[PagBank Webhook] Pagamento confirmado para o pedido ${orderId}! Disparando liberação de PDF.`);
      // Aqui o trigger de entrega de PDF (PRD 4) é executado
      return {
        handled: true,
        status: 'PAID',
        orderId: orderId
      };
    }

    return {
      handled: true,
      status: orderStatus.status,
      orderId: orderId
    };
  }
}

module.exports = new PagBankService();
