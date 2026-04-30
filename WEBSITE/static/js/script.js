document.addEventListener('DOMContentLoaded', () => {
    
    // --- THEME & LOGO LOGIC ---
    const logoImg = document.getElementById('main-logo');
    const toggleBtn = document.getElementById('dark-toggle');
    const html = document.documentElement;

    const logoLightPath = logoImg.getAttribute('data-logo-light');
    const logoDarkPath = logoImg.getAttribute('data-logo-dark');

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') { logoImg.src = logoDarkPath; } 
        else { logoImg.src = logoLightPath; }
    }

    // --- MOBILE MENU LOGIC ---
    const mobileToggle = document.getElementById('mobile-toggle');
    const navWrapper = document.getElementById('nav-wrapper');
    const navLinks = document.querySelectorAll('.nav-link-item');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navWrapper.classList.toggle('active');
            // Swap icon between hamburger and close
            const icon = mobileToggle.querySelector('i');
            if (navWrapper.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when a link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navWrapper.classList.remove('active');
                mobileToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
            });
        });
    }

    // --- ROBUST PARALLAX MARQUEE ---
    const tracks = document.querySelectorAll('.marquee-track');
    let currentScroll = 0;
    let targetScroll = window.scrollY || 0;
    let timeOffset = 0;
    
    const loop = () => {
        timeOffset += 0.5; 
        currentScroll += (targetScroll - currentScroll) * 0.075;

        tracks.forEach((track, index) => {
            const direction = index % 2 === 0 ? -1 : 1;
            const speedMult = 0.3 + (index * 0.15); 
            const xOffset = (timeOffset * direction) + (currentScroll * direction * speedMult);
            
            track.style.transform = `translateX(${xOffset}px)`;
        });

        requestAnimationFrame(loop);
    };

    window.addEventListener('scroll', () => { 
        targetScroll = window.scrollY || 0; 
    }, { passive: true });

    if (tracks.length > 0) loop(); 

    // --- INTERSECTION OBSERVER (Scroll Reveals) ---
    const observerOptions = {
        root: null, rootMargin: '0px', threshold: 0.15 
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-item').forEach(el => observer.observe(el));

    // --- MAGNETIC BUTTONS (Touch Protected) ---
    const magneticElements = document.querySelectorAll('.magnetic-btn');
    
    magneticElements.forEach((btn) => {
        btn.addEventListener('mousemove', function(e) {
            // Disable on mobile/touch screens to prevent sticky hover bugs
            if (window.innerWidth <= 768) return;

            const position = btn.getBoundingClientRect();
            const x = e.clientX - position.left - position.width / 2;
            const y = e.clientY - position.top - position.height / 2;
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', function() {
            if (window.innerWidth <= 768) return;

            btn.style.transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)';
            btn.style.transform = 'translate(0px, 0px)';
            setTimeout(() => { btn.style.transition = ''; }, 400);
        });
    });
});