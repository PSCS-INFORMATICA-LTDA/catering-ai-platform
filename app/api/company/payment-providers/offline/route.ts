import {
  rejectSpoofedTenantCompanyId,
  requireApiPermission,
  requireSessionCompanyId,
} from "@/Lib/auth/requireApi";
import { PAYMENT_SETTINGS_PERMISSION } from "@/Lib/payments/companyPaypal";
import { loadCompanyOfflinePaymentSettings } from "@/Lib/payments/companyProviders";
import { writeOperationalAudit } from "@/Lib/orders/writeOperationalAudit";
import { getSupabaseServerClient } from "@/Lib/supabaseServer";

export const dynamic = "force-dynamic";

const MAX_FIELD = 200;
const MAX_INSTRUCTIONS = 1200;

function clean(value: unknown, max = MAX_FIELD) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PUT(request: Request) {
  const auth = await requireApiPermission(PAYMENT_SETTINGS_PERMISSION);
  if (!auth.ok) return auth.response;
  const company = requireSessionCompanyId(auth.session);
  if (!company.ok) return company.response;

  const body = (await request.json().catch(() => null)) as {
    company_id?: string;
    zelle?: Record<string, unknown>;
    bankTransfer?: Record<string, unknown>;
  } | null;
  const spoofed = rejectSpoofedTenantCompanyId(
    company.companyId,
    body?.company_id,
  );
  if (spoofed) return spoofed;
  if (!body?.zelle || !body.bankTransfer) {
    return Response.json(
      { error: "offline_payment_settings_invalid" },
      { status: 400 },
    );
  }

  const zelle = body.zelle;
  const bank = body.bankTransfer;
  const rows = [
    {
      company_id: company.companyId,
      provider: "zelle",
      environment: "sandbox",
      enabled: zelle.enabled === true,
      public_client_id: null,
      metadata: {
        recipient_name: clean(zelle.recipientName),
        recipient_contact: clean(zelle.recipientContact),
        instructions: clean(zelle.instructions, MAX_INSTRUCTIONS),
      },
      updated_at: new Date().toISOString(),
    },
    {
      company_id: company.companyId,
      provider: "bank_transfer",
      environment: "sandbox",
      enabled: bank.enabled === true,
      public_client_id: null,
      metadata: {
        bank_name: clean(bank.bankName),
        account_holder: clean(bank.accountHolder),
        routing_number: clean(bank.routingNumber),
        account_number: clean(bank.accountNumber),
        instructions: clean(bank.instructions, MAX_INSTRUCTIONS),
      },
      updated_at: new Date().toISOString(),
    },
  ];

  const { error } = await getSupabaseServerClient()
    .from("company_payment_providers")
    .upsert(rows, { onConflict: "company_id,provider" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await writeOperationalAudit({
    companyId: company.companyId,
    actorUserId: auth.session.userId,
    entityType: "company_payment_provider",
    entityId: company.companyId,
    action: "offline_payment_settings_updated",
    newData: {
      zelleEnabled: zelle.enabled === true,
      bankTransferEnabled: bank.enabled === true,
      zelleConfigured: Boolean(clean(zelle.recipientContact)),
      bankTransferConfigured: Boolean(clean(bank.accountNumber)),
    },
  });

  return Response.json({
    data: await loadCompanyOfflinePaymentSettings(company.companyId),
  });
}
