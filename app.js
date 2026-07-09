/* =====================================================
   DKS Championship 30/07/2026 , Page Logic
   - Full-page scroll-scrub: the whole document scroll
     drives the fixed background video, frame 1 (top) to
     last frame (bottom). Direct seek, live duration read.
   - Story: 5 points cross-fade while the video scrubs.
   - Live countdown, fast animated scroll, floating pill,
     lead form -> Apps Script (sheet + email), honeypot.
   ===================================================== */

'use strict';

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyX80BdKV6fdp7ylZwmIKVSQOGWLQugqnoEs57EiViBZNdN5zI0U08qsVyo1iebB6N7ow/exec';
var EVENT_TIME = new Date('2026-07-30T17:00:00+03:00').getTime();
var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

/* ====== COUNTDOWN ====== */
(function () {
  var d = document.getElementById('cd-days');
  var h = document.getElementById('cd-hours');
  var m = document.getElementById('cd-mins');
  var s = document.getElementById('cd-secs');
  if (!d || !h || !m || !s) return;
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() {
    var diff = EVENT_TIME - Date.now();
    if (diff <= 0) {
      d.textContent = '00'; h.textContent = '00'; m.textContent = '00'; s.textContent = '00';
      var cap = document.querySelector('.cd-caption');
      if (cap) cap.textContent = 'האירוע התחיל!';
      return;
    }
    d.textContent = pad(Math.floor(diff / 86400000));
    h.textContent = pad(Math.floor(diff / 3600000) % 24);
    m.textContent = pad(Math.floor(diff / 60000) % 60);
    s.textContent = pad(Math.floor(diff / 1000) % 60);
    setTimeout(tick, 1000);
  }
  tick();
})();

/* ====== FULL-PAGE SCRUB + STORY ====== */
(function () {
  var video = document.querySelector('#video-bg .scrub-video');
  var story = document.getElementById('story');
  var points = [].slice.call(document.querySelectorAll('.story-point'));

  if (REDUCED_MOTION) {
    points.forEach(function (p) { p.classList.add('active'); });
    return;
  }
  if (video) { try { video.load(); } catch (e) {} }

  function update() {
    // Global document progress drives the video: top = frame 1, bottom = last frame.
    if (video) {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var progress = maxScroll > 0 ? clamp01(window.pageYOffset / maxScroll) : 0;
      var dur = video.duration; // read live , a cached value races metadata load
      if (dur && isFinite(dur)) {
        var t = progress * (dur - 0.05);
        if (Math.abs(video.currentTime - t) > 0.01) { try { video.currentTime = t; } catch (e) {} }
      }
    }
    // Story progress drives which of the 5 points is centered.
    if (story && points.length) {
      var dist = story.offsetHeight - window.innerHeight;
      var sp = dist > 0 ? clamp01((-story.getBoundingClientRect().top) / dist) : 0;
      var idx = Math.floor(sp * points.length - 0.0001);
      if (idx < 0) idx = 0;
      if (idx > points.length - 1) idx = points.length - 1;
      for (var i = 0; i < points.length; i++) { points[i].classList.toggle('active', i === idx); }
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  if (video) {
    ['loadedmetadata', 'loadeddata', 'durationchange', 'canplay'].forEach(function (ev) {
      video.addEventListener(ev, update);
    });
  }
  update();
})();

/* ====== FAST SCROLL TO REGISTER + FLOATING PILL ====== */
(function () {
  var registerEl = document.getElementById('register');
  var pill = document.getElementById('float-register');
  var hero = document.getElementById('hero');
  if (!registerEl) return;

  function fastScrollToRegister() {
    var targetY = registerEl.getBoundingClientRect().top + window.pageYOffset;
    if (REDUCED_MOTION) { window.scrollTo(0, targetY); return; }
    var startY = window.pageYOffset;
    var delta = targetY - startY;
    var duration = 1400; // fast, but the scrubbed video visibly races forward toward the 30.07 reveal
    var start = performance.now();
    var cancelled = false;
    function cleanup() {
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, cancel); });
    }
    function cancel() { cancelled = true; cleanup(); }
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, cancel, { passive: true }); });
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function frame(now) {
      if (cancelled) return;
      var p = Math.min(1, (now - start) / duration);
      window.scrollTo(0, startY + delta * ease(p));
      if (p < 1) requestAnimationFrame(frame); else cleanup();
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('[data-fast-register]').forEach(function (btn) {
    btn.addEventListener('click', fastScrollToRegister);
  });
  if (pill && hero) {
    pill.hidden = false;
    pill.addEventListener('click', fastScrollToRegister);
    var heroVisible = true;
    var registerVisible = false;
    function refreshPill() { pill.classList.toggle('visible', !heroVisible && !registerVisible); }
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; refreshPill(); }, { threshold: 0.05 }).observe(hero);
    new IntersectionObserver(function (entries) { registerVisible = entries[0].isIntersecting; refreshPill(); }, { threshold: 0.15 }).observe(registerEl);
  }
})();

/* ====== LEAD FORM ====== */
(function () {
  var form = document.getElementById('lead-form');
  var btn = document.getElementById('lead-submit');
  var successEl = document.getElementById('lead-success');
  var errorEl = document.getElementById('lead-error');
  var waFallback = document.getElementById('wa-fallback');
  if (!form || !btn || !successEl || !errorEl || !waFallback) return;

  // normalize pasted phone numbers (dashes/spaces) before pattern validation runs
  var phoneInput = form.querySelector('input[name="phone"]');
  if (phoneInput) {
    phoneInput.addEventListener('input', function () {
      var clean = phoneInput.value.replace(/[\s-]/g, '');
      if (clean !== phoneInput.value) phoneInput.value = clean;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var fd = new FormData(form);
    var payload = {
      formType: 'happening',
      fullName: String(fd.get('fullName') || '').trim(),
      phone: String(fd.get('phone') || '').replace(/[\s-]/g, ''),
      role: String(fd.get('role') || ''),
      notes: String(fd.get('notes') || '').trim(),
      website: String(fd.get('website') || ''), // honeypot
      userAgent: navigator.userAgent
    };

    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = 'שולח';
    errorEl.hidden = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight
      body: JSON.stringify(payload),
      redirect: 'follow'
    })
      .then(function (res) { return res.json(); }) // Apps Script always answers HTTP 200 , trust result.ok
      .then(function (result) {
        if (!result.ok) throw new Error(result.error || 'שגיאה בשליחה');
        form.hidden = true;
        successEl.hidden = false;
        successEl.scrollIntoView({ block: 'nearest' });
      })
      .catch(function (err) {
        console.error('Lead submit failed:', err);
        waFallback.href = 'https://wa.me/972537757323?text=' + encodeURIComponent(
          'היי, אני רוצה להירשם לאליפות DKS 30/07.\nשם: ' + payload.fullName +
          '\nטלפון: ' + payload.phone + '\nתפקיד: ' + payload.role +
          (payload.notes ? '\nהערות: ' + payload.notes : ''));
        errorEl.hidden = false;
        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.textContent = 'שריינו לי מקום';
      });
  });
})();
