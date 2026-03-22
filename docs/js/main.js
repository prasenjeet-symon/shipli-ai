// ── Starfield background ──
const canvas = document.getElementById('stars-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  const STAR_COUNT = 120;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.7
          ? `rgba(255, 45, 149,`    // pink
          : Math.random() > 0.5
            ? `rgba(0, 240, 255,`   // cyan
            : `rgba(224, 208, 240,` // white
      });
    }
  }

  let frame = 0;
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    stars.forEach(star => {
      const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.opacity * twinkle;
      ctx.fillStyle = star.color + alpha + ')';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();

      // Glow for larger stars
      if (star.size > 1.2) {
        ctx.fillStyle = star.color + (alpha * 0.15) + ')';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      star.y += star.speed;
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    });
    requestAnimationFrame(drawStars);
  }

  resize();
  createStars();
  drawStars();
  window.addEventListener('resize', () => { resize(); createStars(); });
}

// ── Copy to clipboard ──
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

// ── Mobile nav toggle ──
const toggle = document.querySelector('.mobile-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    toggle.textContent = navLinks.classList.contains('open') ? '\u2715' : '\u2630';
  });
}

// ── Scroll animation ──
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
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

// ── Terminal typing animation ──
const terminalBody = document.querySelector('.terminal-body');
if (terminalBody && terminalBody.dataset.lines) {
  const lines = JSON.parse(terminalBody.dataset.lines);
  terminalBody.innerHTML = '';
  let i = 0;
  function typeLine() {
    if (i >= lines.length) return;
    const div = document.createElement('div');
    div.innerHTML = lines[i];
    div.style.opacity = '0';
    div.style.transform = 'translateX(-8px)';
    div.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    terminalBody.appendChild(div);
    requestAnimationFrame(() => {
      div.style.opacity = '1';
      div.style.transform = 'translateX(0)';
    });
    i++;
    setTimeout(typeLine, i <= 2 ? 500 : 200);
  }
  setTimeout(typeLine, 800);
}
