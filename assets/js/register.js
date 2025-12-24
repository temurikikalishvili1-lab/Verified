// Registration form handler
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const registerBtn = document.querySelector('.register-btn');

    // Check if user is already logged in
    checkSession();

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const fullname = document.getElementById('fullname').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Basic validation
        if (!fullname || !email || !phone || !password || !confirmPassword) {
            showMessage('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        // Disable button during submission
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating Account...';

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullname,
                    email,
                    phone,
                    password,
                    confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Registration successful! Redirecting...', 'success');
                // Store user info in localStorage for client-side access
                localStorage.setItem('user', JSON.stringify(data.user));
                // Redirect to main page or dashboard after 1.5 seconds
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1500);
            } else {
                showMessage(data.message || 'Registration failed', 'error');
                registerBtn.disabled = false;
                registerBtn.textContent = 'Create Account';
            }
        } catch (error) {
            console.error('Registration error:', error);
            showMessage('An error occurred. Please try again.', 'error');
            registerBtn.disabled = false;
            registerBtn.textContent = 'Create Account';
        }
    });

    // Function to check if user is already logged in
    async function checkSession() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.loggedIn) {
                // User is already logged in, redirect to main page
                showMessage('You are already logged in. Redirecting...', 'info');
                localStorage.setItem('user', JSON.stringify(data.user));
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1500);
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    // Function to show messages
    function showMessage(message, type) {
        // Remove existing message if any
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
            text-align: center;
            font-weight: bold;
            animation: slideIn 0.3s ease;
        `;

        if (type === 'success') {
            messageDiv.style.backgroundColor = '#4caf50';
            messageDiv.style.color = 'white';
        } else if (type === 'error') {
            messageDiv.style.backgroundColor = '#f44336';
            messageDiv.style.color = 'white';
        } else if (type === 'info') {
            messageDiv.style.backgroundColor = '#2196F3';
            messageDiv.style.color = 'white';
        }

        // Insert message before the form
        form.parentNode.insertBefore(messageDiv, form);

        // Auto remove after 5 seconds (except for success messages that redirect)
        if (type !== 'success' && type !== 'info') {
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
    }
});

