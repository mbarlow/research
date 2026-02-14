// Image lightbox + lazy video loading

export function initMedia(container) {
  // Lightbox for images
  container.querySelectorAll('img[data-lightbox]').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightbox-img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.remove('hidden');
    });
  });
}

export function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.addEventListener('click', () => {
    lightbox.classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
  });
}
