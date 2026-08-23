export function ThemeScript() {
  const script = `
    (function () {
      try {
        var path = location.pathname || '';
        if (path.indexOf('/quote/') === 0) {
          var wizardActive = false;
          try {
            for (var i = 0; i < sessionStorage.length; i++) {
              var key = sessionStorage.key(i) || '';
              if (key.indexOf('public-quote-active:') === 0 && sessionStorage.getItem(key) === '1') {
                wizardActive = true;
                break;
              }
            }
          } catch (e) {}
          if (wizardActive) {
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.setAttribute('data-public-wizard-theme', 'light-locked');
            document.documentElement.style.colorScheme = 'light';
          } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.removeAttribute('data-public-wizard-theme');
            document.documentElement.style.colorScheme = 'dark';
          }
          return;
        }
        var storageKey = 'cdl-theme';
        var theme = localStorage.getItem(storageKey);
        if (theme !== 'light' && theme !== 'dark') {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {}
    })();
  `

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
