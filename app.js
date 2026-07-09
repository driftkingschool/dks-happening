/* =====================================================
   DKS Championship 30/07/2026 , Page Logic
   - Live countdown to the event
   - Scroll-scrubbed video (Bangkok recipe: direct seek,
     live duration read, no rAF for scroll updates)
   - Fast animated scroll to #register + floating pill
   - Lead form -> Apps Script (sheet + email), honeypot
   ===================================================== */

'use strict';

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyX80BdKV6fdp7ylZwmIKVSQOGWLQugqnoEs57EiViBZNdN5zI0U08qsVyo1iebB6N7ow/exec';
var EVENT_TIME = new Date('2026-07-30T17:00:00+03:00').getTime();
var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ====== COUNTDOWN ====== */
(function () {
  var d = document.getElementById('cd-days');
  var h = document.getElementById('cd-hours');
  var m = document.getElementById('cd-mins');
  var s = document.getElementById('cd-secs');
  if (!d) return;
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

/* ====== SCROLL-SCRUB VIDEO (Bangkok recipe) ====== */
(function () {
  var scene = document.querySelector('.scrub-scene');
  if (!scene) return;
  var video = scene.querySelector('.scrub-video');
  var steps = [].slice.call(scene.querySelectorAll('.scrub-step'));
  if (!video || !steps.length) return;
  if (REDUCED_MOTION) {
    scene.classList.add('no-scrub');
    steps.forEach(function (s) { s.classList.add('active'); });
    return;
  }
  try { video.load(); } catch (e) {}
  function update() {
    var top = scene.getBoundingClientRect().top;
    var dist = scene.offsetHeight - window.innerHeight;
    var progress = dist > 0 ? Math.min(1, Math.max(0, (-top) / dist)) : 0;
    var d = video.duration; // read live , cached value races metadata load
    if (d && isFinite(d)) {
      var t = progress * (d - 0.05);
      if (Math.abs(video.currentTime - t) > 0.01) { try { video.currentTime = t; } catch (e) {} }
    }
    var idx = Math.floor(progress * steps.length - 0.0001);
    if (idx < 0) idx = 0;
    if (idx > steps.length - 1) idx = steps.length - 1;
    for (var i = 0; i < steps.length; i++) { steps[i].classList.toggle('active', i === idx); }
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  ['loadedmetadata', 'loadeddata', 'durationchange', 'canplay'].forEach(function (ev) {
    video.addEventListener(ev, update);
  });
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
    var duration = 1300; // fast, but the scrubbed video visibly races forward
    var start = performance.now();
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      window.scrollTo(0, startY + delta * ease(p));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('[data-fast-register]').forEach(function (btn) {
    btn.addEventListener('click', fastScrollToRegister);
  });
  if (pill) {
    pill.hidden = false;
    pill.addEventListener('click', fastScrollToRegister);
    var heroVisible = true;
    var registerVisible = false;
    function refreshPill() {
      pill.classList.toggle('visible', !heroVisible && !registerVisible);
    }
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      refreshPill();
    }, { threshold: 0.05 }).observe(hero);
    new IntersectionObserver(function (entries) {
      registerVisible = entries[0].isIntersecting;
      refreshPill();
    }, { threshold: 0.15 }).observe(registerEl);
  }
})();

/* ====== LEAD FORM ====== */
(function () {
  var form = document.getElementById('lead-form');
  if (!form) return;
  var btn = document.getElementById('lead-submit');
  var successEl = document.getElementById('lead-success');
  var errorEl = document.getElementById('lead-error');

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
      // text/plain avoids a CORS preflight against Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    })
      .then(function (res) { return res.json(); }) // Apps Script always answers HTTP 200 , trust result.ok only
      .then(function (result) {
        if (!result.ok) throw new Error(result.error || 'שגיאה בשליחה');
        form.hidden = true;
        successEl.hidden = false;
        successEl.scrollIntoView({ block: 'nearest' });
      })
      .catch(function (err) {
        console.error('Lead submit failed:', err);
        document.getElementById('wa-fallback').href =
          'https://wa.me/972537757323?text=' + encodeURIComponent(
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
