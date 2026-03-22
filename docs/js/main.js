// ── Starfield + Floating Spaceships background ──
const canvas = document.getElementById('stars-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  let ships = [];
  const STAR_COUNT = 140;
  const SHIP_COUNT = 8;

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

  // Spaceship designs — drawn with canvas paths
  const shipDesigns = [
    // Classic saucer
    function drawSaucer(ctx, s) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.rotate(s.tilt);
      // Dome
      ctx.beginPath();
      ctx.ellipse(0, -4, 6, 5, 0, Math.PI, 0);
      ctx.fillStyle = `rgba(160, 48, 224, ${s.opacity * 0.6})`;
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 224, 240, ${s.opacity * 0.4})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 224, 240, ${s.opacity * 0.7})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Lights
      for (let lx = -8; lx <= 8; lx += 4) {
        ctx.beginPath();
        ctx.arc(lx, 0, 1, 0, Math.PI * 2);
        const blink = Math.sin(s.blinkPhase + lx * 0.5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 215, 64, ${s.opacity * blink * 0.8})`;
        ctx.fill();
      }
      // Engine glow
      ctx.beginPath();
      ctx.ellipse(0, 4, 8, 2, 0, 0, Math.PI);
      ctx.fillStyle = `rgba(255, 45, 149, ${s.opacity * 0.2})`;
      ctx.fill();
      ctx.restore();
    },
    // Arrow fighter
    function drawFighter(ctx, s) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.rotate(s.angle);
      // Body
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-6, 8);
      ctx.lineTo(0, 5);
      ctx.lineTo(6, 8);
      ctx.closePath();
      ctx.fillStyle = `rgba(0, 224, 240, ${s.opacity * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 224, 240, ${s.opacity * 0.7})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      // Wings
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fillStyle = `rgba(160, 48, 224, ${s.opacity * 0.5})`;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(12, 10);
      ctx.lineTo(4, 8);
      ctx.closePath();
      ctx.fill();
      // Cockpit
      ctx.beginPath();
      ctx.arc(0, -2, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 64, ${s.opacity * 0.6})`;
      ctx.fill();
      // Engine trail
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.lineTo(0, 8 + 6 + Math.sin(s.blinkPhase) * 3);
      ctx.lineTo(2, 8);
      ctx.fillStyle = `rgba(255, 45, 149, ${s.opacity * 0.4})`;
      ctx.fill();
      ctx.restore();
    },
    // Tiny cruiser
    function drawCruiser(ctx, s) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.rotate(s.angle);
      // Hull
      ctx.beginPath();
      ctx.roundRect(-4, -10, 8, 20, 3);
      ctx.fillStyle = `rgba(160, 48, 224, ${s.opacity * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(160, 48, 224, ${s.opacity * 0.6})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      // Side pods
      ctx.beginPath();
      ctx.roundRect(-10, -2, 5, 8, 2);
      ctx.roundRect(5, -2, 5, 8, 2);
      ctx.fillStyle = `rgba(0, 224, 240, ${s.opacity * 0.3})`;
      ctx.fill();
      // Bridge light
      ctx.beginPath();
      ctx.arc(0, -6, 1.5, 0, Math.PI * 2);
      const pulse = Math.sin(s.blinkPhase) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(0, 224, 240, ${s.opacity * pulse})`;
      ctx.fill();
      // Engine exhaust
      ctx.beginPath();
      ctx.moveTo(-3, 10);
      ctx.lineTo(0, 10 + 4 + Math.sin(s.blinkPhase * 1.5) * 2);
      ctx.lineTo(3, 10);
      ctx.fillStyle = `rgba(255, 45, 149, ${s.opacity * 0.35})`;
      ctx.fill();
      ctx.restore();
    }
  ];

  function createShips() {
    ships = [];
    for (let i = 0; i < SHIP_COUNT; i++) {
      ships.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        scale: (Math.random() * 0.065 + 0.065) * canvas.width / 14,
        opacity: Math.random() * 0.25 + 0.1,
        tilt: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpeed: Math.random() * 0.04 + 0.02,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.008 + 0.003,
        design: Math.floor(Math.random() * shipDesigns.length),
      });
    }
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    // Draw stars
    stars.forEach(star => {
      const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.opacity * twinkle;
      ctx.fillStyle = star.color + alpha + ')';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
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

    // Draw spaceships
    ships.forEach(s => {
      s.blinkPhase += s.blinkSpeed;
      s.wobblePhase += s.wobbleSpeed;

      // Gentle floating movement
      s.x += s.vx + Math.sin(s.wobblePhase) * 0.15;
      s.y += s.vy + Math.cos(s.wobblePhase * 0.7) * 0.1;

      // Wrap around edges
      if (s.x < -30) s.x = canvas.width + 30;
      if (s.x > canvas.width + 30) s.x = -30;
      if (s.y < -30) s.y = canvas.height + 30;
      if (s.y > canvas.height + 30) s.y = -30;

      shipDesigns[s.design](ctx, s);
    });

    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  createShips();
  draw();
  window.addEventListener('resize', () => { resize(); createStars(); createShips(); });
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
