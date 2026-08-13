const navToggle = document.getElementById('navToggle');
const navLinksMobile = document.getElementById('navLinksMobile');

navToggle.addEventListener('click', () => {
  const isOpen = navLinksMobile.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinksMobile.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinksMobile.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});
