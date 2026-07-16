import { Store, CampaignType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadClickConversion } from './GoogleAdsConversionService'

// ── Tipos Tiendanube ──────────────────────────────────────────────────────────
type TNProduct = { product_id: number; name: string }
type TNOrder = {
  id: number
  contact_name: string
  contact_phone: string
  total: string
  checkout_url?: string
  products: TNProduct[]
  created_at?: string
  payment_status?: string
  status?: string
  paid_at?: string | null
  cancelled_at?: string | null
  shipping_status?: string | null
  shipped_at?: string | null
  updated_at?: string | null
}

// ── WhatsApp Cloud API ────────────────────────────────────────────────────────
const WA_API_URL = 'https://graph.facebook.com/v21.0'

async function sendWhatsAppCloud(
  phoneNumberId: string,
  token: string,
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    })
    if (!res.ok) {
      const err = await res.json() as { error?: { message: string } }
      return { ok: false, error: err.error?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendWhatsAppTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            { type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) },
          ],
        },
      }),
    })
    if (!res.ok) {
      const err = (await res.json()) as { error?: { message: string } }
      return { ok: false, error: err.error?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── Servicio ──────────────────────────────────────────────────────────────────
export class CampaignService {
  constructor(private store: Store) {}

  /**
   * RECOVERY — checkout/abandoned
   * Guarda en MessageLog con scheduled_for = ahora + 30 min.
   * El cron /api/cron/send-pending se encarga del envío real.
   */
  async handleAbandonedCart(data: TNOrder) {
    const campaign = await this.getActiveCampaign(CampaignType.RECOVERY)
    if (!campaign) return

    const customer = await this.upsertCustomer(data)

    // Evitar doble-registro si el mismo carrito ya tiene uno pendiente
    const existing = await prisma.messageLog.findFirst({
      where: {
        store_id: this.store.id,
        customer_id: customer.id,
        campaign_id: campaign.id,
        tipo_evento: 'checkout/abandoned',
        estado: { in: ['PENDING', 'SENT'] },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    })
    if (existing) return

    const config = campaign.configuracion as { message_template: string; wa_phone_number_id: string }
    const cartLink = data.checkout_url ?? 'https://infomicelium.com.ar'
    const firstName = data.contact_name.split(' ')[0]
    const product = data.products[0]?.name?.split(' - ')[0] ?? 'tu pedido'

    const message = this.interpolate(config.message_template, {
      nombre: firstName,
      producto: product,
      link: cartLink,
    })

    await prisma.messageLog.create({
      data: {
        store_id: this.store.id,
        customer_id: customer.id,
        campaign_id: campaign.id,
        estado: 'PENDING',
        tipo_evento: 'checkout/abandoned',
        // el mensaje serializado se guarda en error_details (reutilizamos el campo)
        // para que el cron lo tenga disponible sin recalcular
        error_details: JSON.stringify({ message, phone: customer.telefono }),
        scheduled_for: new Date(Date.now() + 30 * 60 * 1000),
      },
    })
  }

  /**
   * RECOVERY — polling de carritos abandonados (Tiendanube NO tiene webhook
   * checkout/abandoned; hay que consultar /orders?status=open&payment_status=pending).
   * Cadencia de 2 toques por plantilla aprobada de Meta (fuera de ventana de 24h,
   * WhatsApp Cloud API exige template, no texto libre). Llamado por un cron externo
   * (VPS) cada ~30 min. Horario 9-21 AR.
   */
  async pollAbandonedCarts() {
    const campaign = await this.getActiveCampaign(CampaignType.RECOVERY)
    if (!campaign) return { checked: 0, sent: 0, skipped: 'sin campaña activa' }

    const config = campaign.configuracion as {
      wa_phone_number_id: string
      template_name: string
      template_lang: string
    }

    const hourAr = (new Date().getUTCHours() + 24 - 3) % 24
    if (hourAr < 9 || hourAr >= 21) {
      return { checked: 0, sent: 0, skipped: 'fuera de horario 9-21 AR' }
    }

    const TOQUE1_MIN_H = 2
    const VENTANA_MAX_H = 36
    const TOQUE2_AFTER_H = 22

    const orders = await this.fetchPendingOrders()
    let sent = 0

    for (const o of orders) {
      if (!o.contact_phone || !o.created_at) continue
      const ageH = (Date.now() - new Date(o.created_at).getTime()) / 3_600_000
      const customer = await this.upsertCustomer(o)

      const logs = await prisma.messageLog.findMany({
        where: {
          store_id: this.store.id,
          customer_id: customer.id,
          campaign_id: campaign.id,
          tipo_evento: { in: ['cart_recovery_1', 'cart_recovery_2'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      const t1 = logs.find((l) => l.tipo_evento === 'cart_recovery_1')
      const t2 = logs.find((l) => l.tipo_evento === 'cart_recovery_2')

      let touch: 1 | 2 | null = null
      if (!t1 && ageH >= TOQUE1_MIN_H && ageH <= VENTANA_MAX_H) {
        touch = 1
      } else if (t1 && !t2) {
        const hSinceT1 = (Date.now() - t1.createdAt.getTime()) / 3_600_000
        if (hSinceT1 >= TOQUE2_AFTER_H) touch = 2
      }
      if (!touch) continue

      const firstName = o.contact_name.split(' ')[0]
      const product = o.products[0]?.name?.split(' - ')[0] ?? 'tu pedido'
      const link = o.checkout_url ?? 'https://infomicelium.com.ar'

      const log = await prisma.messageLog.create({
        data: {
          store_id: this.store.id,
          customer_id: customer.id,
          campaign_id: campaign.id,
          estado: 'PENDING',
          tipo_evento: `cart_recovery_${touch}`,
        },
      })

      const result = await sendWhatsAppTemplate(
        config.wa_phone_number_id,
        this.store.whatsapp_api_token,
        customer.telefono,
        config.template_name,
        config.template_lang,
        [firstName, product, link]
      )

      await prisma.messageLog.update({
        where: { id: log.id },
        data: { estado: result.ok ? 'SENT' : 'FAILED', error_details: result.ok ? null : result.error },
      })
      if (result.ok) sent++
    }

    return { checked: orders.length, sent }
  }

  private async fetchPendingOrders(): Promise<TNOrder[]> {
    const res = await fetch(
      `https://api.tiendanube.com/v1/${this.store.tiendanube_store_id}/orders?status=open&payment_status=pending&per_page=100`,
      {
        headers: {
          Authentication: `bearer ${this.store.tiendanube_access_token}`,
          'User-Agent': 'MotorWhatsApp (nahuelp182@gmail.com)',
        },
      }
    )
    if (!res.ok) return []
    return (await res.json()) as TNOrder[]
  }

  /**
   * REVIEW — pide reseña/testimonio una vez que el pedido está realmente
   * entregado (shipping_status === 'delivered', dato que Tiendanube ya trae
   * en la orden). Espera un margen desde la entrega para que el cliente lo
   * haya probado. Fallback: si a los MAX_DIAS_FALLBACK de pagado TN nunca
   * marcó delivered (status desactualizado, retiro en persona, etc.) manda
   * igual para no dejar el pedido sin pedir reseña. Corte duro a MAX_DIAS_TOTAL.
   * Llamado por el mismo cron externo que RECOVERY (VPS, cada ~30 min).
   */
  async pollReviewRequests() {
    const campaign = await this.getActiveCampaign(CampaignType.REVIEW)
    if (!campaign) return { checked: 0, sent: 0, skipped: 'sin campaña activa' }

    const config = campaign.configuracion as {
      wa_phone_number_id: string
      template_name: string
      template_lang: string
    }

    const hourAr = (new Date().getUTCHours() + 24 - 3) % 24
    if (hourAr < 9 || hourAr >= 21) {
      return { checked: 0, sent: 0, skipped: 'fuera de horario 9-21 AR' }
    }

    const MIN_DIAS_DESDE_ENTREGA = 1
    const MAX_DIAS_FALLBACK = 15
    const MAX_DIAS_TOTAL = 20

    const orders = await this.fetchRecentPaidOrders()
    let sent = 0

    for (const o of orders) {
      if (!o.contact_phone || !o.paid_at || o.cancelled_at) continue
      const diasDesdePago = (Date.now() - new Date(o.paid_at).getTime()) / 86_400_000
      if (diasDesdePago > MAX_DIAS_TOTAL) continue

      const entregado = o.shipping_status === 'delivered'
      if (entregado) {
        const fechaEntrega = new Date(o.shipped_at ?? o.updated_at ?? o.paid_at)
        const diasDesdeEntrega = (Date.now() - fechaEntrega.getTime()) / 86_400_000
        if (diasDesdeEntrega < MIN_DIAS_DESDE_ENTREGA) continue
      } else if (diasDesdePago < MAX_DIAS_FALLBACK) {
        continue
      }

      const customer = await this.upsertCustomer(o)

      const existing = await prisma.messageLog.findFirst({
        where: {
          store_id: this.store.id,
          customer_id: customer.id,
          campaign_id: campaign.id,
          tipo_evento: 'review_request',
        },
      })
      if (existing) continue

      const firstName = o.contact_name.split(' ')[0]
      const product = o.products[0]?.name?.split(' - ')[0] ?? 'tu pedido'

      const log = await prisma.messageLog.create({
        data: {
          store_id: this.store.id,
          customer_id: customer.id,
          campaign_id: campaign.id,
          estado: 'PENDING',
          tipo_evento: 'review_request',
        },
      })

      const result = await sendWhatsAppTemplate(
        config.wa_phone_number_id,
        this.store.whatsapp_api_token,
        customer.telefono,
        config.template_name,
        config.template_lang,
        [firstName, product]
      )

      await prisma.messageLog.update({
        where: { id: log.id },
        data: { estado: result.ok ? 'SENT' : 'FAILED', error_details: result.ok ? null : result.error },
      })
      if (result.ok) sent++
    }

    return { checked: orders.length, sent }
  }

  private async fetchRecentPaidOrders(): Promise<TNOrder[]> {
    const since = new Date(Date.now() - 21 * 86_400_000).toISOString()
    const res = await fetch(
      `https://api.tiendanube.com/v1/${this.store.tiendanube_store_id}/orders?payment_status=paid&per_page=100&created_at_min=${since}`,
      {
        headers: {
          Authentication: `bearer ${this.store.tiendanube_access_token}`,
          'User-Agent': 'MotorWhatsApp (nahuelp182@gmail.com)',
        },
      }
    )
    if (!res.ok) return []
    return (await res.json()) as TNOrder[]
  }

  /**
   * REFERRAL — order/paid > $200.000
   * Crea cupón único y envía mensaje inmediatamente.
   */
  async handleOrderPaid(data: TNOrder) {
    const totalAmount = parseFloat(data.total)

    // Registrar cliente y gasto en DB para TODOS los pedidos pagos
    const customer = await this.upsertCustomer(data, totalAmount)

    // Google Ads server-side conversion upload
    await this.tryUploadGadsConversion(customer.telefono, data.id, totalAmount)

    // REFERRAL: solo si supera el umbral y hay campaña activa
    if (totalAmount < 200000) return

    const campaign = await this.getActiveCampaign(CampaignType.REFERRAL)
    if (!campaign) return

    // Un solo cupón por cliente por campaña
    const existingCoupon = await prisma.coupon.findFirst({
      where: { store_id: this.store.id, customer_id: customer.id, campaign_id: campaign.id },
    })
    if (existingCoupon) return

    const codigo = this.generateCouponCode(customer.nombre, customer.id)

    await prisma.coupon.create({
      data: {
        store_id: this.store.id,
        customer_id: customer.id,
        campaign_id: campaign.id,
        codigo,
      },
    })

    const config = campaign.configuracion as {
      message_template: string
      discount: number
      wa_phone_number_id: string
    }

    const message = this.interpolate(config.message_template, {
      nombre: customer.nombre.split(' ')[0],
      codigo,
      descuento: String(config.discount ?? 10),
    })

    await this.dispatchMessage({
      phone: customer.telefono,
      message,
      waPhoneNumberId: config.wa_phone_number_id,
      customerId: customer.id,
      campaignId: campaign.id,
      tipoEvento: 'order/paid',
    })
  }

  // Busca el GCLID más reciente del comprador y sube la conversión a Google Ads
  private async tryUploadGadsConversion(phone: string, orderId: number, total: number) {
    try {
      const session = await prisma.gclidSession.findFirst({
        where: {
          store_id: this.store.id,
          phone,
          uploaded: false,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: 'desc' },
      })
      if (!session) return // no hubo clic de Google Ads — nada que subir

      const result = await uploadClickConversion({
        gclid: session.gclid,
        orderTotal: total,
        conversionDateTime: new Date(),
        orderId: String(orderId),
      })

      await prisma.gclidSession.update({
        where: { id: session.id },
        data: {
          uploaded: result.ok,
          phone,
          order_id: String(orderId),
        },
      })
    } catch {
      // silencioso — no romper el flujo de WA si Google Ads falla
    }
  }

  // ── Privados ─────────────────────────────────────────────────────────────────

  private async getActiveCampaign(tipo: CampaignType) {
    return prisma.campaign.findFirst({
      where: { store_id: this.store.id, tipo, is_active: true },
    })
  }

  private async upsertCustomer(data: TNOrder, extraSpend = 0) {
    const telefono = this.normalizePhone(data.contact_phone)
    // Usamos el teléfono normalizado como clave única de cliente real
    // data.id es el ID de la ORDEN, no del cliente — no sirve como clave
    return prisma.customer.upsert({
      where: {
        store_id_tiendanube_customer_id: {
          store_id: this.store.id,
          tiendanube_customer_id: telefono,
        },
      },
      update: { total_spent: { increment: extraSpend } },
      create: {
        store_id: this.store.id,
        tiendanube_customer_id: telefono,
        nombre: data.contact_name,
        telefono,
        total_spent: extraSpend,
      },
    })
  }

  async dispatchMessage(params: {
    phone: string
    message: string
    waPhoneNumberId: string
    customerId: string
    campaignId: string
    tipoEvento: string
  }) {
    const log = await prisma.messageLog.create({
      data: {
        store_id: this.store.id,
        customer_id: params.customerId,
        campaign_id: params.campaignId,
        estado: 'PENDING',
        tipo_evento: params.tipoEvento,
      },
    })

    const result = await sendWhatsAppCloud(
      params.waPhoneNumberId,
      this.store.whatsapp_api_token,
      params.phone,
      params.message
    )

    await prisma.messageLog.update({
      where: { id: log.id },
      data: {
        estado: result.ok ? 'SENT' : 'FAILED',
        error_details: result.ok ? null : result.error,
      },
    })
  }

  private normalizePhone(raw: string): string {
    const d = raw.replace(/\D/g, '')
    // Remove leading 0 (local format)
    const local = d.startsWith('0') ? d.slice(1) : d
    // Already has country code
    if (local.startsWith('549')) return local
    if (local.startsWith('54')) return '549' + local.slice(2)
    // Add Argentina country code + 9 for mobile
    return '549' + local
  }

  private generateCouponCode(nombre: string, id: string): string {
    const name = nombre.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6)
    const shortId = id.slice(-4).toUpperCase()
    return `INFOMI-${name}-${shortId}`
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
  }
}
