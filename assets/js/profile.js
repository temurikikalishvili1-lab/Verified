// Profile icon and dropdown management
document.addEventListener('DOMContentLoaded', function() {
    // Initialize session manager
    if (!window.sessionManager) {
        // Load session.js if not already loaded
        const script = document.createElement('script');
        script.src = 'session.js';
        document.head.appendChild(script);
        script.onload = initProfile;
    } else {
        initProfile();
    }

    function initProfile() {
        // Wait a bit for session manager to be ready
        setTimeout(() => {
            checkLoginStatus();
        }, 100);
    }

    async function checkLoginStatus() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.loggedIn) {
                showProfileIcon(data.user);
                hideLoginRegister();
            } else {
                hideProfileIcon();
                showLoginRegister();
            }
        } catch (error) {
            console.error('Error checking session:', error);
            hideProfileIcon();
            showLoginRegister();
        }
    }

    function showProfileIcon(user) {
        const profileContainer = document.getElementById('profile-container');
        if (profileContainer) {
            profileContainer.classList.add('active');
            
            // Update user info in dropdown
            const profileName = profileContainer.querySelector('.profile-name');
            const profileEmail = profileContainer.querySelector('.profile-email');
            
            if (profileName) {
                profileName.textContent = user.fullname || 'User';
            }
            if (profileEmail) {
                profileEmail.textContent = user.email || '';
            }
        }

        // Also update mobile menu if it exists
        const mobileProfileContainer = document.getElementById('mobile-profile-container');
        if (mobileProfileContainer && user) {
            mobileProfileContainer.innerHTML = `
                <div style="padding: 10px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 10px;">
                    <div style="color: white; font-weight: bold; margin-bottom: 5px;">${user.fullname || 'User'}</div>
                    <div style="color: #999; font-size: 12px; margin-bottom: 10px;">${user.email || ''}</div>
                    <a href="#" class="logout-btn" style="display: block; padding: 10px; color: #ff6b6b; text-decoration: none; border-radius: 5px; text-align: center; border: 1px solid #ff6b6b;">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            `;
        }
    }

    function hideProfileIcon() {
        const profileContainer = document.getElementById('profile-container');
        if (profileContainer) {
            profileContainer.classList.remove('active');
            // Close dropdown if open
            const dropdown = profileContainer.querySelector('.profile-dropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
        }

        // Clear mobile menu
        const mobileProfileContainer = document.getElementById('mobile-profile-container');
        if (mobileProfileContainer) {
            mobileProfileContainer.innerHTML = '';
        }
    }

    function showLoginRegister() {
        const loginBtn = document.querySelector('.login-btn');
        const registerBtn = document.querySelector('.register-btn');
        
        if (loginBtn) loginBtn.style.display = '';
        if (registerBtn) registerBtn.style.display = '';
    }

    function hideLoginRegister() {
        const loginBtn = document.querySelector('.login-btn');
        const registerBtn = document.querySelector('.register-btn');
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
    }

    // Handle profile icon click (toggle dropdown)
    document.addEventListener('click', function(e) {
        const profileIcon = document.querySelector('.profile-icon');
        const profileContainer = document.getElementById('profile-container');
        const dropdown = profileContainer?.querySelector('.profile-dropdown');
        
        if (profileIcon && profileIcon.contains(e.target)) {
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
        } else if (dropdown && !dropdown.contains(e.target) && !profileIcon?.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Handle logout
    document.addEventListener('click', async function(e) {
        if (e.target.closest('.logout-btn')) {
            e.preventDefault();
            
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Clear localStorage
                    localStorage.removeItem('user');
                    
                    // Hide profile, show login/register
                    hideProfileIcon();
                    showLoginRegister();
                    
                    // Redirect to login page
                    window.location.href = '../assets/Login.html';
                } else {
                    alert('Error logging out. Please try again.');
                }
            } catch (error) {
                console.error('Logout error:', error);
                alert('Error logging out. Please try again.');
            }
        }
    });

    // Listen for login events
    window.addEventListener('userLoggedIn', function(e) {
        showProfileIcon(e.detail);
        hideLoginRegister();
    });

    window.addEventListener('userLoggedOut', function() {
        hideProfileIcon();
        showLoginRegister();
    });
});

