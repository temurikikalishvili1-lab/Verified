// Session management utility
// This script can be included in any page to check login status

class SessionManager {
    constructor() {
        this.user = null;
        this.checkSession();
    }

    async checkSession() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.loggedIn) {
                this.user = data.user;
                // Store in localStorage for quick access
                localStorage.setItem('user', JSON.stringify(data.user));
                // Trigger custom event
                window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: data.user }));
                return true;
            } else {
                this.user = null;
                localStorage.removeItem('user');
                window.dispatchEvent(new CustomEvent('userLoggedOut'));
                return false;
            }
        } catch (error) {
            console.error('Session check error:', error);
            return false;
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.user = null;
                localStorage.removeItem('user');
                window.dispatchEvent(new CustomEvent('userLoggedOut'));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    getUser() {
        // Try to get from memory first
        if (this.user) {
            return this.user;
        }
        
        // Try to get from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                this.user = JSON.parse(storedUser);
                return this.user;
            } catch (e) {
                localStorage.removeItem('user');
            }
        }
        
        return null;
    }

    isLoggedIn() {
        return this.user !== null;
    }
}

// Create global session manager instance
window.sessionManager = new SessionManager();

// Helper function to check if user is logged in (for use in other scripts)
window.isUserLoggedIn = function() {
    return window.sessionManager.isLoggedIn();
};

// Helper function to get current user
window.getCurrentUser = function() {
    return window.sessionManager.getUser();
};

// Helper function to logout
window.logoutUser = async function() {
    const success = await window.sessionManager.logout();
    if (success) {
        window.location.href = 'Login.html';
    }
};

