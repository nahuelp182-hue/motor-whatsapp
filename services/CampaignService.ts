import { Store, CampaignType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ── Tipos Tiendanube ──────────────────────────────────────────────────────────
type TNProduct = { product_id: number; name: string }
type TNOrder = {
  id: number
  contact_name: string
  contact_phone: string
  total: string
  checkout_url?: string
  products: TNProduct[]
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
   * REFERRAL — order/paid > $200.000
   * Crea cupón único y envía mensaje inmediatamente.
   */
  async handleOrderPaid(data: TNOrder) {
    const totalAmount = parseFloat(data.total)

    // Registrar cliente y gasto en DB para TODOS los pedidos pagos
    const customer = await this.upsertCustomer(data, totalAmount)

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
