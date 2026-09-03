const CATERING = 'https://catering-ai-agenda-dev.vercel.app'
const ONE = 'https://pscs-core.vercel.app'
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const CORE_REF = 'uvyaqklvqcakwfvfopof'

async function scan(origin, needles) {
  const html = await fetch(origin).then((r) => r.text())
  const scripts = [...html.matchAll(/\/_next\/static\/chunks\/[^"' ]+\.js/g)].map((m) => m[0])
  for (const path of scripts.slice(0, 30)) {
    const js = await fetch(origin + path).then((r) => r.text())
    for (const needle of needles) {
      if (js.includes(needle)) return needle
    }
  }
  return 'absent'
}

const cateringRef = await scan(CATERING, [DEV_REF, PROD_REF])
const oneRef = await scan(ONE, [CORE_REF, PROD_REF])
const login = await fetch(`${CATERING}/login`, { redirect: 'manual' })
const callback = await fetch(`${CATERING}/auth/pscs-one/callback`, { redirect: 'manual' })

console.log(
  JSON.stringify({
    catering_alias: CATERING,
    one_alias: ONE,
    catering_js_ref: cateringRef,
    one_js_ref: oneRef,
    catering_login_status: login.status,
    catering_callback_status: callback.status,
  }),
)
