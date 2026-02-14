// Header: hide on scroll down, show on scroll up
(function () {
  const header = document.querySelector('header');
  let lastScrollY = window.scrollY;
  const scrollThreshold = 80;

  window.addEventListener('scroll', function () {
    const scrollY = window.scrollY;
    if (scrollY <= scrollThreshold) {
      header.classList.remove('header--hidden');
    } else if (scrollY > lastScrollY) {
      header.classList.add('header--hidden');
    } else {
      header.classList.remove('header--hidden');
    }
    lastScrollY = scrollY;
  }, { passive: true });
})();

// Pricing tabs
const tabs = document.querySelectorAll('.pricing-tab');
const panels = document.querySelectorAll('.pricing-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.target;

    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

// Video lightbox
const modal = document.getElementById('videoModal');
const video = document.getElementById('modalVideo');
const closeBtn = modal.querySelector('.video-close');

document.querySelectorAll('.video-thumb').forEach(button => {
  button.addEventListener('click', () => {
    video.src = button.dataset.video;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    video.currentTime = 0;
    video.play();
  });
});

function closeModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
  video.pause();
  video.src = '';
}

closeBtn.addEventListener('click', closeModal);

modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('active')) {
    closeModal();
  }
});
