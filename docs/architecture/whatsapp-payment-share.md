# WhatsApp payment share

**DEV only.** Human-assisted share. Zero auto-send.

## Current contract (PR #50)

Catering AI generates the payment message. The operator opens WhatsApp and confirms send.

Canonical web/mobile action:

```text
https://wa.me/<E164>?text=<ENCODED_TEXT>
```

Reuse only:

- `paymentSharePhoneDigits` / E.164
- `buildPaymentShareMessage` (PT/EN/ES)
- `buildPaymentWhatsAppHref`
- server-owned payment URL and amount

Copy message and copy link stay available. The operator always confirms send.

## Physical iOS evidence

`whatsapp-business://send` is rejected by Safari as an invalid address.

`wa.me` / `api.whatsapp.com` opens the WhatsApp iOS associates with the Universal Link. The browser cannot guarantee Messenger vs Business when both apps are installed.

Do not try again with custom schemes, timers, iframes, redirects, or installed-app detection.

## Future Brasinha

The future automatic enterprise conversation layer must use the official WhatsApp Business Platform / API. It must reuse the canonical `paymentShareMessage` contract.

That integration is **not** part of this PR. PR #50 remains human-assisted share only.
