// Shubham Raut — shared site behaviour

document.addEventListener('DOMContentLoaded', () => {
  /* Mobile nav toggle */
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = siteNav.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    siteNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Collapsible document groups (Reference Build page) */
  const docGroups = document.querySelectorAll('.doc-group');
  docGroups.forEach((group) => {
    const header = group.querySelector('.doc-group-header');
    if (!header) return;
    header.addEventListener('click', () => {
      group.classList.toggle('open');
      const isOpen = group.classList.contains('open');
      header.setAttribute('aria-expanded', String(isOpen));
    });
  });

  /* Template filter bar (Templates page) */
  const filterButtons = document.querySelectorAll('.filter-btn');
  const templateCards = document.querySelectorAll('.template-card');

  if (filterButtons.length && templateCards.length) {
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        templateCards.forEach((card) => {
          if (filter === 'All' || card.getAttribute('data-framework') === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }
});
