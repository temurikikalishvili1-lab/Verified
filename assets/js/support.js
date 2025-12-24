document.addEventListener('DOMContentLoaded', () => {
    // Mobile navbar toggle
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');
    if (navbarToggle && navbarMenu) {
      navbarToggle.addEventListener('click', () => {
        navbarToggle.classList.toggle('active');
        navbarMenu.classList.toggle('active');
      });
  
      navbarMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navbarToggle.classList.remove('active');
          navbarMenu.classList.remove('active');
        });
      });
    }
  
    // FAQ accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      question?.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
        } else {
          question.setAttribute('aria-expanded', 'false');
        }
      });
    });
  
    // Support form handling (client-side only)
    const form = document.getElementById('support-request-form');
    const alertBox = document.getElementById('form-alert');
  
    if (form && alertBox) {
      form.addEventListener('submit', event => {
        event.preventDefault();
  
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
  
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
  
        // Optionally log for debugging; replace with real API call when ready
        console.log('Support request prepared:', payload);
  
        alertBox.textContent = 'მოთხოვნა მიღებულია! ვუპასუხებთ 15-30 წუთში სამუშაო საათებში.';
        alertBox.classList.remove('error');
        alertBox.classList.add('success');
        alertBox.style.display = 'block';
  
        form.reset();
  
        // Reapply default selections after reset
        const emailChannel = form.querySelector('input[name="channel"][value="email"]');
        if (emailChannel) emailChannel.checked = true;
        const normalPriority = form.querySelector('input[name="priority"][value="normal"]');
        if (normalPriority) normalPriority.checked = true;
      });
    }
  });
  