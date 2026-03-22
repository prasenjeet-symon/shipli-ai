// ── Starfield + Floating Spaceships background ──
const canvas = document.getElementById('stars-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  let ships = [];
  const STAR_COUNT = 140;
  const SHIP_COUNT = 3;

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

  // Alien saucer — detailed circular UFO design
  const shipDesigns = [
    function drawSaucer(ctx, s) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.rotate(s.tilt);

      const a = s.opacity;

      // Tractor beam / underside glow cone
      const beamPulse = Math.sin(s.blinkPhase * 0.7) * 0.15 + 0.15;
      ctx.beginPath();
      ctx.moveTo(-6, 5);
      ctx.lineTo(-14, 28);
      ctx.lineTo(14, 28);
      ctx.lineTo(6, 5);
      ctx.closePath();
      const beamGrad = ctx.createLinearGradient(0, 5, 0, 28);
      beamGrad.addColorStop(0, `rgba(0, 224, 240, ${a * beamPulse})`);
      beamGrad.addColorStop(1, `rgba(0, 224, 240, 0)`);
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Outer glow ring
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 224, 240, ${a * 0.08})`;
      ctx.fill();

      // Main saucer body — lower hull
      ctx.beginPath();
      ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI);
      const hullGrad = ctx.createLinearGradient(0, 0, 0, 7);
      hullGrad.addColorStop(0, `rgba(80, 30, 140, ${a * 0.5})`);
      hullGrad.addColorStop(1, `rgba(30, 10, 60, ${a * 0.6})`);
      ctx.fillStyle = hullGrad;
      ctx.fill();

      // Main saucer body — upper disc
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 5, 0, Math.PI, 0);
      const discGrad = ctx.createLinearGradient(0, -5, 0, 0);
      discGrad.addColorStop(0, `rgba(0, 200, 220, ${a * 0.35})`);
      discGrad.addColorStop(1, `rgba(80, 30, 140, ${a * 0.4})`);
      ctx.fillStyle = discGrad;
      ctx.fill();

      // Rim highlight
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 224, 240, ${a * 0.5})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Inner ring detail
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 3.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(160, 48, 224, ${a * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Glass dome
      ctx.beginPath();
      ctx.ellipse(0, -3, 6, 5, 0, Math.PI, 0);
      const domeGrad = ctx.createRadialGradient(0, -5, 0, 0, -3, 6);
      domeGrad.addColorStop(0, `rgba(180, 140, 255, ${a * 0.4})`);
      domeGrad.addColorStop(0.6, `rgba(100, 40, 200, ${a * 0.25})`);
      domeGrad.addColorStop(1, `rgba(60, 20, 120, ${a * 0.15})`);
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = `rgba(180, 140, 255, ${a * 0.4})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Dome highlight arc
      ctx.beginPath();
      ctx.ellipse(-1, -5, 3, 2, -0.3, Math.PI, 0);
      ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.25})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Rotating rim lights
      const lightCount = 8;
      for (let i = 0; i < lightCount; i++) {
        const angle = (i / lightCount) * Math.PI * 2 + s.blinkPhase * 0.5;
        const lx = Math.cos(angle) * 13;
        const ly = Math.sin(angle) * 4;
        const blink = Math.sin(s.blinkPhase * 2 + i * 1.2) * 0.5 + 0.5;
        // Light glow
        ctx.beginPath();
        ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 64, ${a * blink * 0.15})`;
        ctx.fill();
        // Light core
        ctx.beginPath();
        ctx.arc(lx, ly, 0.8, 0, Math.PI * 2);
        const colors = ['255, 215, 64', '0, 224, 240', '255, 45, 149'];
        ctx.fillStyle = `rgba(${colors[i % 3]}, ${a * blink * 0.9})`;
        ctx.fill();
      }

      // Underside engine glow
      ctx.beginPath();
      ctx.ellipse(0, 5, 8, 2.5, 0, 0, Math.PI);
      const enginePulse = Math.sin(s.blinkPhase * 1.3) * 0.1 + 0.2;
      const engGrad = ctx.createRadialGradient(0, 5, 0, 0, 5, 8);
      engGrad.addColorStop(0, `rgba(255, 45, 149, ${a * enginePulse})`);
      engGrad.addColorStop(1, `rgba(255, 45, 149, 0)`);
      ctx.fillStyle = engGrad;
      ctx.fill();

      ctx.restore();
    }
  ];

  function createShips() {
    ships = [];
    for (let i = 0; i < SHIP_COUNT; i++) {
      const heading = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.5;
      ships.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        scale: (Math.random() * 0.045 + 0.045) * canvas.width / 16,
        opacity: Math.random() * 0.2 + 0.15,
        tilt: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI * 2,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpeed: Math.random() * 0.04 + 0.02,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.01 + 0.005,
        turnTimer: Math.random() * 300 + 200,
        turnCountdown: Math.random() * 300 + 200,
        design: 0,
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

      // Roaming — periodically pick a new direction
      s.turnCountdown--;
      if (s.turnCountdown <= 0) {
        const newHeading = Math.random() * Math.PI * 2;
        const newSpeed = Math.random() * 0.8 + 0.5;
        s.vx = Math.cos(newHeading) * newSpeed;
        s.vy = Math.sin(newHeading) * newSpeed;
        s.turnCountdown = Math.random() * 400 + 200;
        s.tilt = (Math.random() - 0.5) * 0.4;
      }

      // Smooth movement with wobble
      s.x += s.vx + Math.sin(s.wobblePhase) * 0.3;
      s.y += s.vy + Math.cos(s.wobblePhase * 0.7) * 0.2;

      // Wrap around edges
      const margin = 60 * s.scale;
      if (s.x < -margin) s.x = canvas.width + margin;
      if (s.x > canvas.width + margin) s.x = -margin;
      if (s.y < -margin) s.y = canvas.height + margin;
      if (s.y > canvas.height + margin) s.y = -margin;

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
