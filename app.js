/* =====================================================
   DKS Championship 30/07/2026 , Page Logic (post-event)
   - Full-page scroll-scrub: the whole document scroll
     drives the fixed background video, frame 1 (top) to
     last frame (bottom). Direct seek, live duration read.
   - Story: 5 points cross-fade while the video scrubs.
   - Registration/payment closed - the event has passed.
   ===================================================== */

'use strict';

var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

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
