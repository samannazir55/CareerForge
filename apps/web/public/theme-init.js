// Runs before paint to avoid a flash of light mode. Default is dark
// unless the user previously chose light and it's saved in localStorage.
(function () {
    try {
      var stored = localStorage.getItem('cf-theme');
      var theme = stored === 'light' ? 'light' : 'dark';
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();