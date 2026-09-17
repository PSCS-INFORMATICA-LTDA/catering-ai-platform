# Future PWA / Web Push

Not implemented in this PR. Notification Center is already channel-neutral
(`web_push` is a valid channel). Later work can add:

- Web App Manifest
- Catering app icon + `apple-touch-icon`
- `display: standalone`
- service worker
- Push API + Notifications API
- push subscriptions by user/device
- notification permission flow
- application badge
- authenticated deep links
- PT / EN / ES push copy

Future events that can reuse the same event table:

- `quote.created` (V1)
- `quote.accepted`
- `deposit.received`
- `payment.received`
- `event.today`
- `event.reminder`
- `inventory.low_stock` — only when real inventory thresholds exist

AI Secretary should consume these same canonical events.
