// Copy to clipboard
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.copy || btn.previousElementSibling?.textContent?.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  });
});

// Mobile nav toggle
const toggle = document.querySelector('.mobile-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    toggle.textContent = navLinks.classList.contains('open') ? '\u2715' : '\u2630';
  });
}

// Scroll animation
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .step, .store-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Terminal typing animation
const terminalBody = document.querySelector('.terminal-body');
if (terminalBody && terminalBody.dataset.lines) {
  const lines = JSON.parse(terminalBody.dataset.lines);
  terminalBody.innerHTML = '';
  let i = 0;
  function typeLine() {
    if (i >= lines.length) return;
    const div = document.createElement('div');
    div.innerHTML = lines[i];
    terminalBody.appendChild(div);
    i++;
    setTimeout(typeLine, i <= 2 ? 600 : 300);
  }
  setTimeout(typeLine, 500);
}
